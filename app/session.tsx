import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { appendQuestionHistory, appendResult, getRecentQuestionIds, readAppState } from "../lib/storage";
import { calculateQuizTime, getNextDifficulty, getUnlockedLevelsForGrade, normalizeQuestions, scoreQuestions } from "../lib/quiz";
import { getSubjectById, getTopicById, grades, QUESTIONS_PER_LEVEL } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import { generateCoachPlan, generateFeedback, generateQuestions } from "../services/ai";
import type { Difficulty, Question, QuestionFocusMode, QuestionResponse, SessionResult, TestMode, UserProfile } from "../types/app";

type SessionPhase = "setup" | "loading" | "active" | "review";

export default function SessionScreen() {
  const params = useLocalSearchParams<{
    subjectId?: string;
    mode?: TestMode;
    level?: string;
    grade?: string;
    difficulty?: Difficulty;
    focusMode?: QuestionFocusMode;
    topicId?: string;
    autoStart?: string;
  }>();

  const subject = getSubjectById(params.subjectId);
  const mode: TestMode = params.mode === "training" ? "training" : "quiz";
  const presetLevel = Number(params.level ?? 1);
  const hasPresetGrade = typeof params.grade === "string" && grades.includes(params.grade);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [grade, setGrade] = useState(() =>
    typeof params.grade === "string" && grades.includes(params.grade) ? params.grade : grades[0]
  );
  const [focusMode, setFocusMode] = useState<QuestionFocusMode>(
    params.focusMode === "topic" ? "topic" : "general"
  );
  const [topicId, setTopicId] = useState<string | null>(
    typeof params.topicId === "string" ? params.topicId : null
  );
  const [selectedLevel, setSelectedLevel] = useState(Math.max(1, presetLevel));
  const [difficulty, setDifficulty] = useState<Difficulty>(() =>
    params.difficulty && ["Beginner", "Intermediate", "Advanced", "Expert"].includes(params.difficulty)
      ? params.difficulty
      : "Beginner"
  );
  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Array<string | null>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [questionSource, setQuestionSource] = useState<QuestionResponse["source"] | null>(null);
  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    readAppState().then((state) => {
      const current = state.profiles.find((item) => item.id === state.currentProfileId) ?? null;
      setProfile(current);
      setResults(current ? state.results[current.id] ?? [] : []);
      if (!current && params.subjectId) {
        router.replace({ pathname: "/select-profile", params: { subject: params.subjectId } });
      }
    });
  }, [params.subjectId]);

  useEffect(() => {
    if (typeof params.grade === "string" && grades.includes(params.grade)) {
      setGrade(params.grade);
    }

    if (params.focusMode === "topic" || params.focusMode === "general") {
      setFocusMode(params.focusMode);
    }

    if (typeof params.topicId === "string") {
      setTopicId(params.topicId);
    }

    if (params.difficulty && ["Beginner", "Intermediate", "Advanced", "Expert"].includes(params.difficulty)) {
      setDifficulty(params.difficulty);
    }
  }, [params.grade, params.difficulty, params.focusMode, params.topicId]);

  useEffect(() => {
    if (!subject) {
      return;
    }

    if (focusMode === "topic") {
      const hasCurrentTopic = topicId && subject.topics.some((topic) => topic.id === topicId);
      if (!hasCurrentTopic) {
        setTopicId(subject.topics[0]?.id ?? null);
      }
      return;
    }

    setTopicId(null);
  }, [focusMode, subject, topicId]);

  const unlockedLevels = useMemo(() => {
    if (!subject) {
      return [1];
    }

    return getUnlockedLevelsForGrade(results, subject.id, grade);
  }, [grade, results, subject]);

  const selectedTopic = useMemo(() => getTopicById(subject, topicId ?? undefined), [subject, topicId]);

  useEffect(() => {
    if (unlockedLevels.length === 0) {
      setSelectedLevel(1);
      return;
    }

    if (typeof params.level === "string" && params.autoStart === "1") {
      const requestedLevel = Number(params.level);
      if (unlockedLevels.includes(requestedLevel)) {
        setSelectedLevel(requestedLevel);
        return;
      }
    }

    setSelectedLevel(unlockedLevels[unlockedLevels.length - 1]);
  }, [grade, unlockedLevels, params.autoStart, params.level]);

  useEffect(() => {
    if (phase !== "active") {
      return;
    }

    const interval = setInterval(() => {
      if (mode === "quiz") {
        setTimeLeft((value) => {
          if (value <= 1) {
            clearInterval(interval);
            finishSession();
            return 0;
          }
          return value - 1;
        });
      } else {
        setElapsed((value) => value + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, mode]);

  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex]);

  const loadQuestions = async () => {
    if (!subject) {
      return;
    }

    setPhase("loading");
    try {
      const recentQuestionIds = profile ? await getRecentQuestionIds(profile.id, subject.id) : [];
      const response = await generateQuestions({
        subject,
        grade,
        difficulty,
        mode,
        level: selectedLevel,
        questionCount: QUESTIONS_PER_LEVEL,
        focusMode,
        topicId: selectedTopic?.id,
        topicLabel: selectedTopic?.label,
        profile,
        recentQuestionIds,
      });

      const nextQuestions = normalizeQuestions(response.questions);
      setQuestionSource(response.source);
      if (profile) {
        await appendQuestionHistory(
          profile.id,
          subject.id,
          nextQuestions.map((question) => question.id)
        );
      }
      setQuestions(nextQuestions);
      setAnswers(Array(nextQuestions.length).fill(null));
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setElapsed(0);
      setTimeLeft(mode === "quiz" ? calculateQuizTime(selectedLevel) : 0);
      setPhase("active");
    } catch (error) {
      setQuestionSource(null);
      Alert.alert("Unable to start session", "Question generation failed. Check your AI configuration or use demo mode.");
      setPhase("setup");
    }
  };

  useEffect(() => {
    if (params.autoStart !== "1") {
      return;
    }

    if (hasAutoStartedRef.current) {
      return;
    }

    if (!subject || !profile || phase !== "setup") {
      return;
    }

    hasAutoStartedRef.current = true;
    loadQuestions();
  }, [params.autoStart, subject, profile, phase]);

  const chooseAnswer = (option: string) => {
    if (phase !== "active") {
      return;
    }

    const nextAnswers = [...answers];
    nextAnswers[currentIndex] = option;
    setAnswers(nextAnswers);
    setSelectedAnswer(option);
    setPhase("review");

    if (mode === "quiz") {
      setTimeout(() => {
        advance(nextAnswers);
      }, 1100);
    }
  };

  const advance = (nextAnswers = answers) => {
    setSelectedAnswer(null);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((value) => value + 1);
      setPhase("active");
    } else {
      finishSession(nextAnswers);
    }
  };

  const finishSession = async (finalAnswers = answers) => {
    if (!subject || !profile || questions.length === 0) {
      return;
    }

    const score = scoreQuestions(questions, finalAnswers);
    const bonusCoins = mode === "quiz" && score.score === 100 ? Math.floor(Math.max(timeLeft, 0) * 0.05) : 0;
    const practiceLabel = selectedTopic?.label ?? subject.name;
    let feedback = `You completed your ${practiceLabel} session. Keep building your confidence one level at a time.`;
    let studyPlan = [
      `Review the key ideas from ${practiceLabel.toLowerCase()} before your next session.`,
      `Repeat this level in training mode if any question felt difficult.`,
      `Move steadily and focus on accuracy first, then speed.`,
    ];

    try {
      feedback = await generateFeedback({
        score: score.score,
        subject,
        grade,
        focusMode,
        topicLabel: selectedTopic?.label,
        profile,
      });
    } catch {
      // Keep the local fallback message.
    }

    try {
      studyPlan = await generateCoachPlan({
        resultScore: score.score,
        subject,
        grade,
        level: selectedLevel,
        focusMode,
        topicLabel: selectedTopic?.label,
        profile,
      });
    } catch {
      // Keep the local fallback study plan.
    }

    const result = {
      id: `${Date.now()}`,
      date: new Date().toISOString(),
      subjectId: subject.id,
      subjectName: subject.name,
      level: selectedLevel,
      difficulty,
      grade,
      mode,
      focusMode,
      topicId: selectedTopic?.id,
      topicLabel: selectedTopic?.label,
      score: score.score,
      timeTakenSeconds: mode === "quiz" ? calculateQuizTime(selectedLevel) - timeLeft : elapsed,
      correctAnswers: score.correctAnswers,
      totalQuestions: score.totalQuestions,
      coinsEarned: bonusCoins,
      aiFeedback: feedback,
      aiStudyPlan: studyPlan,
    };

    await appendResult(profile.id, result);
    router.replace({
      pathname: "/results",
      params: {
        result: JSON.stringify(result),
        nextDifficulty: getNextDifficulty(difficulty),
      },
    });
  };

  if (!subject) {
    return (
      <AppBackground>
        <View style={styles.panel}>
          <Text style={styles.title}>Subject not found</Text>
          <PrimaryButton label="Return home" onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  if (phase === "setup") {
    return (
      <AppBackground>
        <View style={styles.panel}>
          <Text style={styles.title}>{subject.name} session</Text>
          <Text style={styles.subtitle}>
            {hasPresetGrade ? `Selected grade: ${grade}. Choose difficulty and start your ${mode} session.` : `Choose grade and start your ${mode} session.`}
          </Text>

          {!hasPresetGrade ? (
            <>
              <Text style={styles.label}>Grade</Text>
              <View style={styles.choiceWrap}>
                {grades.slice(0, 8).map((entry) => (
                  <Pressable
                    key={entry}
                    onPress={() => setGrade(entry)}
                    style={[styles.choiceChip, grade === entry ? styles.choiceChipActive : null]}
                  >
                    <Text style={[styles.choiceText, grade === entry ? styles.choiceTextActive : null]}>{entry}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.label}>Question Focus</Text>
          <View style={styles.choiceWrap}>
            <Pressable
              onPress={() => setFocusMode("general")}
              style={[styles.choiceChip, focusMode === "general" ? styles.choiceChipActive : null]}
            >
              <Text style={[styles.choiceText, focusMode === "general" ? styles.choiceTextActive : null]}>General</Text>
            </Pressable>
            <Pressable
              onPress={() => setFocusMode("topic")}
              style={[styles.choiceChip, focusMode === "topic" ? styles.choiceChipActive : null]}
            >
              <Text style={[styles.choiceText, focusMode === "topic" ? styles.choiceTextActive : null]}>Topic Focus</Text>
            </Pressable>
          </View>
          <Text style={styles.hintText}>
            {focusMode === "general"
              ? "General mixes questions from different topics in this subject."
              : "Topic Focus keeps the whole session inside one selected topic."}
          </Text>

          {focusMode === "topic" ? (
            <>
              <Text style={styles.label}>Choose Topic</Text>
              <View style={styles.choiceWrap}>
                {subject.topics.map((topic) => (
                  <Pressable
                    key={topic.id}
                    onPress={() => setTopicId(topic.id)}
                    style={[styles.topicChip, topicId === topic.id ? styles.choiceChipActive : null]}
                  >
                    <Text style={[styles.topicText, topicId === topic.id ? styles.choiceTextActive : null]}>{topic.label}</Text>
                  </Pressable>
                ))}
              </View>
              {selectedTopic ? <Text style={styles.hintText}>{selectedTopic.description}</Text> : null}
            </>
          ) : null}

          <Text style={styles.label}>Unlocked Levels</Text>
          <Text style={styles.hintText}>The highest unlocked level for {grade} is selected for you.</Text>
          <View style={styles.choiceWrap}>
            {unlockedLevels.map((entry) => (
              <Pressable
                key={`${grade}-level-${entry}`}
                onPress={() => setSelectedLevel(entry)}
                style={[styles.levelChip, selectedLevel === entry ? styles.choiceChipActive : null]}
              >
                <Text style={[styles.levelText, selectedLevel === entry ? styles.choiceTextActive : null]}>Level {entry}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Difficulty</Text>
          <View style={styles.choiceWrap}>
            {(["Beginner", "Intermediate", "Advanced", "Expert"] as Difficulty[]).map((entry) => (
              <Pressable
                key={entry}
                onPress={() => setDifficulty(entry)}
                style={[styles.choiceChip, difficulty === entry ? styles.choiceChipActive : null]}
              >
                <Text style={[styles.choiceText, difficulty === entry ? styles.choiceTextActive : null]}>{entry}</Text>
              </Pressable>
            ))}
          </View>

          <PrimaryButton label={`Start ${mode}`} onPress={loadQuestions} />
        </View>
      </AppBackground>
    );
  }

  if (phase === "loading") {
    return (
      <AppBackground scroll={false}>
        <View style={styles.centerPanel}>
          <Text style={styles.title}>Preparing your session</Text>
          <Text style={styles.subtitle}>Loading questions for {subject.name}.</Text>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <View style={styles.panel}>
          <View style={styles.topRow}>
          <View>
            <Text style={styles.titleSmall}>{subject.name}</Text>
            <Text style={styles.subtitle}>
              {grade} | Level {selectedLevel} | {difficulty}
            </Text>
            <Text style={styles.focusLine}>
              {focusMode === "topic" && selectedTopic ? `Topic focus: ${selectedTopic.label}` : "General mixed practice"}
            </Text>
          </View>
          <View style={styles.topRight}>
            {questionSource ? (
              <View style={[styles.sourceBadge, questionSource === "remote" ? styles.sourceBadgeRemote : null]}>
                <Text style={[styles.sourceBadgeText, questionSource === "remote" ? styles.sourceBadgeTextRemote : null]}>
                  Test source: {questionSource === "remote" ? "AI" : questionSource === "local" ? "Local bank" : "Demo"}
                </Text>
              </View>
            ) : null}
            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>{mode === "quiz" ? `${timeLeft}s` : `${elapsed}s`}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.progressText}>
          Question {currentIndex + 1} of {questions.length}
        </Text>
        <Text style={styles.question}>{currentQuestion?.prompt}</Text>

        <View style={styles.optionList}>
          {currentQuestion?.options.map((option, optionIndex) => {
            const isCorrect = option === currentQuestion.answer;
            const isChosen = option === selectedAnswer;
            const highlight =
              phase === "review"
                ? isCorrect
                  ? styles.optionCorrect
                  : isChosen
                    ? styles.optionWrong
                    : null
                : null;

            return (
              <Pressable
                key={`${currentQuestion?.id ?? "question"}-${optionIndex}-${option}`}
                onPress={() => chooseAnswer(option)}
                style={[styles.optionButton, highlight]}
              >
                <Text style={styles.optionText}>{option}</Text>
              </Pressable>
            );
          })}
        </View>

        {phase === "review" ? (
          <View style={styles.explanationCard}>
            <Text style={styles.explanationTitle}>
              {selectedAnswer === currentQuestion?.answer ? "Correct" : "Keep going"}
            </Text>
            <Text style={styles.explanationText}>{currentQuestion?.explanation}</Text>
            {mode === "training" ? <PrimaryButton label="Next question" onPress={() => advance()} /> : null}
          </View>
        ) : null}
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 18,
    borderRadius: 26,
    backgroundColor: palette.white,
    padding: 18,
    ...shadows.card,
  },
  centerPanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: "800",
  },
  titleSmall: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: palette.slate,
    marginTop: 8,
    lineHeight: 22,
  },
  label: {
    color: palette.slate,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 8,
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  choiceChip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F2F5F8",
  },
  choiceChipActive: {
    backgroundColor: palette.navy,
  },
  choiceText: {
    color: palette.navy,
    fontWeight: "700",
  },
  choiceTextActive: {
    color: palette.white,
  },
  hintText: {
    color: palette.slate,
    lineHeight: 20,
    marginBottom: 8,
  },
  levelChip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F2F5F8",
  },
  levelText: {
    color: palette.navy,
    fontWeight: "700",
  },
  topicChip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F2F5F8",
  },
  topicText: {
    color: palette.navy,
    fontWeight: "700",
  },
  focusLine: {
    color: palette.navy,
    marginTop: 6,
    fontWeight: "700",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  topRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  sourceBadge: {
    borderRadius: 999,
    backgroundColor: "#FFF4DE",
    borderWidth: 1,
    borderColor: "#F2C982",
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 150,
  },
  sourceBadgeRemote: {
    backgroundColor: "#DDF7EA",
    borderColor: "#57BF95",
  },
  sourceBadgeText: {
    color: "#8A5A00",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  sourceBadgeTextRemote: {
    color: "#0A7D58",
  },
  timerBadge: {
    minWidth: 78,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#E0F5FB",
    alignItems: "center",
    justifyContent: "center",
  },
  timerText: {
    color: palette.navy,
    fontWeight: "800",
    fontSize: 16,
  },
  progressText: {
    marginTop: 16,
    color: palette.slate,
    fontWeight: "700",
  },
  question: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 32,
    marginTop: 12,
  },
  optionList: {
    gap: 12,
    marginTop: 18,
  },
  optionButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DFE7EF",
    backgroundColor: "#F8FBFD",
    padding: 16,
  },
  optionText: {
    color: palette.ink,
    fontSize: 16,
    lineHeight: 22,
  },
  optionCorrect: {
    backgroundColor: "#DDF7EA",
    borderColor: "#57BF95",
  },
  optionWrong: {
    backgroundColor: "#FBE1E5",
    borderColor: "#E07A8B",
  },
  explanationCard: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: "#F3F9FC",
    padding: 16,
  },
  explanationTitle: {
    color: palette.navy,
    fontSize: 18,
    fontWeight: "800",
  },
  explanationText: {
    color: palette.slate,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 14,
  },
});

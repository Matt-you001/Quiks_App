import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { appendResult, readAppState } from "../lib/storage";
import { calculateQuizTime, getNextDifficulty, normalizeQuestions, scoreQuestions } from "../lib/quiz";
import { getSubjectById, grades, QUESTIONS_PER_LEVEL } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import { generateCoachPlan, generateFeedback, generateQuestions } from "../services/ai";
import type { Difficulty, Question, TestMode, UserProfile } from "../types/app";

type SessionPhase = "setup" | "loading" | "active" | "review";

export default function SessionScreen() {
  const params = useLocalSearchParams<{
    subjectId?: string;
    mode?: TestMode;
    level?: string;
    grade?: string;
    difficulty?: Difficulty;
    autoStart?: string;
  }>();

  const subject = getSubjectById(params.subjectId);
  const mode: TestMode = params.mode === "training" ? "training" : "quiz";
  const level = Number(params.level ?? 1);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [grade, setGrade] = useState(() =>
    typeof params.grade === "string" && grades.includes(params.grade) ? params.grade : grades[0]
  );
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
  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    readAppState().then((state) => {
      const current = state.profiles.find((item) => item.id === state.currentProfileId) ?? null;
      setProfile(current);
      if (!current && params.subjectId) {
        router.replace({ pathname: "/select-profile", params: { subject: params.subjectId } });
      }
    });
  }, [params.subjectId]);

  useEffect(() => {
    if (typeof params.grade === "string" && grades.includes(params.grade)) {
      setGrade(params.grade);
    }

    if (params.difficulty && ["Beginner", "Intermediate", "Advanced", "Expert"].includes(params.difficulty)) {
      setDifficulty(params.difficulty);
    }
  }, [params.grade, params.difficulty]);

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
      const response = await generateQuestions({
        subject,
        grade,
        difficulty,
        mode,
        level,
        questionCount: QUESTIONS_PER_LEVEL,
        profile,
      });

      const nextQuestions = normalizeQuestions(response.questions);
      setQuestions(nextQuestions);
      setAnswers(Array(nextQuestions.length).fill(null));
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setElapsed(0);
      setTimeLeft(mode === "quiz" ? calculateQuizTime(level) : 0);
      setPhase("active");
    } catch (error) {
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
    let feedback = `You completed your ${subject.name} session. Keep building your confidence one level at a time.`;
    let studyPlan = [
      `Review the key ideas from ${subject.name.toLowerCase()} before your next session.`,
      `Repeat this level in training mode if any question felt difficult.`,
      `Move steadily and focus on accuracy first, then speed.`,
    ];

    try {
      feedback = await generateFeedback({
        score: score.score,
        subject,
        grade,
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
        level,
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
      level,
      difficulty,
      grade,
      mode,
      score: score.score,
      timeTakenSeconds: mode === "quiz" ? calculateQuizTime(level) - timeLeft : elapsed,
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
          <Text style={styles.subtitle}>Choose grade and start your {mode} session.</Text>

          <Text style={styles.label}>Grade</Text>
          <View style={styles.choiceWrap}>
            {grades.slice(0, 8).map((entry) => (
              <Pressable key={entry} onPress={() => setGrade(entry)} style={[styles.choiceChip, grade === entry ? styles.choiceChipActive : null]}>
                <Text style={[styles.choiceText, grade === entry ? styles.choiceTextActive : null]}>{entry}</Text>
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
              {grade} | Level {level} | {difficulty}
            </Text>
          </View>
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>{mode === "quiz" ? `${timeLeft}s` : `${elapsed}s`}</Text>
          </View>
        </View>

        <Text style={styles.progressText}>
          Question {currentIndex + 1} of {questions.length}
        </Text>
        <Text style={styles.question}>{currentQuestion?.prompt}</Text>

        <View style={styles.optionList}>
          {currentQuestion?.options.map((option) => {
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
              <Pressable key={option} onPress={() => chooseAnswer(option)} style={[styles.optionButton, highlight]}>
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
    marginTop: 16,
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
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { getDifficultyLabel, t } from "../lib/i18n";
import { appendQuestionHistory, appendResult, getRecentQuestionIds, readAppState } from "../lib/storage";
import { calculateQuizTime, getLevelProgressForGrade, getNextDifficulty, normalizeQuestions, scoreQuestions } from "../lib/quiz";
import { getSubjectById, getTopicById, grades, QUESTIONS_PER_LEVEL } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import {
  generateCoachPlan,
  generateFeedback,
  generateQuestions,
  getCompetitionStatus,
  sendCompetitionChat,
  submitCompetitionResult,
  updateCompetitionProgress,
} from "../services/ai";
import type {
  CompetitionChatMessage,
  CompetitionLiveProgress,
  Difficulty,
  Question,
  QuestionFocusMode,
  QuestionResponse,
  SessionResult,
  TestMode,
  UserProfile,
} from "../types/app";

type SessionPhase = "setup" | "loading" | "countdown" | "active" | "review" | "awaitingResult";

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
    competitionId?: string;
    competitionOpponentName?: string;
  }>();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const language = profile?.language ?? "en";
  const subject = getSubjectById(params.subjectId, language);
  const mode: TestMode = params.mode === "training" ? "training" : "quiz";
  const presetLevel = Number(params.level ?? 1);
  const hasPresetGrade = typeof params.grade === "string" && grades.includes(params.grade);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [grade, setGrade] = useState(() =>
    typeof params.grade === "string" && grades.includes(params.grade) ? params.grade : grades[0]
  );
  const [focusMode, setFocusMode] = useState<QuestionFocusMode>(params.focusMode === "topic" ? "topic" : "general");
  const [topicId, setTopicId] = useState<string | null>(typeof params.topicId === "string" ? params.topicId : null);
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(Math.max(1, presetLevel));
  const [levelTouched, setLevelTouched] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>(() =>
    params.difficulty && ["Beginner", "Intermediate", "Advanced", "Expert"].includes(params.difficulty)
      ? params.difficulty
      : appVariant.defaultDifficulty
  );
  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Array<string | null>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [questionSource, setQuestionSource] = useState<QuestionResponse["source"] | null>(null);
  const [competitionChats, setCompetitionChats] = useState<CompetitionChatMessage[]>([]);
  const [competitionLiveProgress, setCompetitionLiveProgress] = useState<CompetitionLiveProgress[]>([]);
  const [competitionStartAt, setCompetitionStartAt] = useState<number | null>(null);
  const [competitionEndAt, setCompetitionEndAt] = useState<number | null>(null);
  const [pendingCompetitionResult, setPendingCompetitionResult] = useState<SessionResult | null>(null);
  const hasAutoStartedRef = useRef(false);
  const isCompetition = typeof params.competitionId === "string";
  const competitionOpponentName =
    typeof params.competitionOpponentName === "string" ? params.competitionOpponentName : undefined;
  const competitionQuickMessages = useMemo(
    () =>
      appVariant.id === "uni"
        ? [
            "Challenge accepted.",
            "Strong start.",
            "Well played.",
            "This is intense.",
            "I'm not done yet.",
            "Respect.",
          ]
        : [
            "Bring it on!",
            "I'm ready!",
            "Nice one!",
            "This is close!",
            "I won that round!",
            "Good game!",
          ],
    []
  );
  const competitionQuickEmojis = useMemo(
    () => ["\u{1F525}", "\u{1F4AA}", "\u{1F44F}", "\u{1F605}", "\u{1F60E}", "\u{1F91D}", "\u{26A1}", "\u{1F3AF}"],
    []
  );

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
    setLevelTouched(false);
  }, [grade]);

  const levelProgress = useMemo(() => {
    if (!subject) {
      return [{ level: 1, isPassed: false, isNextUnlocked: true }];
    }

    return getLevelProgressForGrade(results, subject.id, grade);
  }, [grade, results, subject]);

  const selectedTopic = useMemo(() => getTopicById(subject, topicId ?? undefined), [subject, topicId]);

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

    setIsTopicDropdownOpen(false);
    setTopicId(null);
  }, [focusMode, subject, topicId]);

  useEffect(() => {
    const availableLevels = levelProgress.map((entry) => entry.level);
    const preferredLevel = availableLevels[availableLevels.length - 1];
    if (availableLevels.length === 0) {
      setSelectedLevel(1);
      return;
    }

    if (typeof params.level === "string" && params.autoStart === "1") {
      const requestedLevel = Number(params.level);
      if (availableLevels.includes(requestedLevel)) {
        setSelectedLevel(requestedLevel);
        return;
      }
    }

    setSelectedLevel((current) => {
      if (!levelTouched) {
        return preferredLevel;
      }

      if (availableLevels.includes(current)) {
        return current;
      }

      return preferredLevel;
    });
  }, [levelProgress, levelTouched, params.autoStart, params.level]);

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

  useEffect(() => {
    if (phase !== "countdown" || !competitionStartAt) {
      return;
    }

    const interval = setInterval(() => {
      const secondsUntilStart = Math.max(0, Math.ceil((competitionStartAt - Date.now()) / 1000));
      if (secondsUntilStart <= 0) {
        clearInterval(interval);
        setPhase("active");
      }
    }, 250);

    return () => clearInterval(interval);
  }, [competitionStartAt, phase]);

  useEffect(() => {
    if (!isCompetition || !profile || !["countdown", "active", "review", "awaitingResult"].includes(phase)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await getCompetitionStatus({
          playerId: profile.id,
          competitionId: params.competitionId,
        });
        if (response.competition?.chats) {
          setCompetitionChats(response.competition.chats);
        }
        if (response.competition?.liveProgress) {
          setCompetitionLiveProgress(response.competition.liveProgress);
        }
        if (response.competition?.startAt) {
          setCompetitionStartAt(response.competition.startAt);
        }
        if (response.competition?.endAt) {
          setCompetitionEndAt(response.competition.endAt);
        }

        if (pendingCompetitionResult && response.status === "completed") {
          const finalResult: SessionResult = {
            ...pendingCompetitionResult,
            competitionOutcome: response.outcome ?? pendingCompetitionResult.competitionOutcome ?? "pending",
            competitionOpponentName: response.opponentName ?? pendingCompetitionResult.competitionOpponentName,
            competitionOpponentId: response.opponentId ?? pendingCompetitionResult.competitionOpponentId,
            competitionPlayerScore: response.playerScore ?? pendingCompetitionResult.competitionPlayerScore,
            competitionOpponentScore: response.opponentScore ?? pendingCompetitionResult.competitionOpponentScore,
            competitionPlayerTimeSeconds:
              response.playerTimeTakenSeconds ?? pendingCompetitionResult.competitionPlayerTimeSeconds,
            competitionOpponentTimeSeconds:
              response.opponentTimeTakenSeconds ?? pendingCompetitionResult.competitionOpponentTimeSeconds,
          };
          await appendResult(profile.id, finalResult);
          setPendingCompetitionResult(null);
          router.replace({
            pathname: "/results",
            params: {
              result: JSON.stringify(finalResult),
              nextDifficulty: getNextDifficulty(difficulty),
            },
          });
        }
      } catch {
        // Keep the existing chat list on screen.
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [difficulty, isCompetition, params.competitionId, pendingCompetitionResult, phase, profile]);

  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex]);
  const opponentProgress = useMemo(
    () => competitionLiveProgress.find((entry) => entry.playerId !== profile?.id),
    [competitionLiveProgress, profile?.id]
  );
  const ownCompetitionProgress = useMemo(
    () => competitionLiveProgress.find((entry) => entry.playerId === profile?.id),
    [competitionLiveProgress, profile?.id]
  );

  const loadQuestions = async () => {
    if (!subject || !profile) {
      return;
    }

    setPhase("loading");
    try {
      if (isCompetition) {
        const competitionStatus = await getCompetitionStatus({
          playerId: profile.id,
          competitionId: params.competitionId,
        });

        if (!["matched", "completed"].includes(competitionStatus.status) || !competitionStatus.competition) {
          throw new Error("Competition match is not ready.");
        }

        const nextQuestions = normalizeQuestions(competitionStatus.competition.questions);
        setQuestionSource("remote");
        setCompetitionChats(competitionStatus.competition.chats ?? []);
        setCompetitionLiveProgress(competitionStatus.competition.liveProgress ?? []);
        setCompetitionStartAt(competitionStatus.competition.startAt ?? null);
        setCompetitionEndAt(competitionStatus.competition.endAt ?? null);
        setQuestions(nextQuestions);
        setAnswers(Array(nextQuestions.length).fill(null));
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setElapsed(0);
        setTimeLeft(
          competitionStatus.competition.endAt && competitionStatus.competition.startAt
            ? Math.max(0, Math.floor((competitionStatus.competition.endAt - competitionStatus.competition.startAt) / 1000))
            : calculateQuizTime(selectedLevel)
        );
        setPhase(
          competitionStatus.competition.startAt && competitionStatus.competition.startAt > Date.now() ? "countdown" : "active"
        );
        return;
      }

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
      Alert.alert(t(language, "unableToStartSession"), t(language, "questionGenerationFailed"));
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
    void syncCompetitionProgress(nextAnswers);

    if (mode === "quiz") {
      setTimeout(() => {
        advance(nextAnswers);
      }, 1100);
    }
  };

  const handleCompetitionQuickMessage = async (message: string) => {
    if (!isCompetition || !params.competitionId || !profile) {
      return;
    }

    try {
      const response = await sendCompetitionChat({
        competitionId: params.competitionId,
        playerId: profile.id,
        message,
      });
      setCompetitionChats(response.chats);
    } catch {
      // Keep the session flowing even if chat fails.
    }
  };

  const syncCompetitionProgress = async (nextAnswers: Array<string | null>, finished = false) => {
    if (!isCompetition || !params.competitionId || !profile) {
      return;
    }

    const score = scoreQuestions(questions, nextAnswers);
    try {
      const response = await updateCompetitionProgress({
        competitionId: params.competitionId,
        playerId: profile.id,
        answeredCount: nextAnswers.filter(Boolean).length,
        correctAnswers: score.correctAnswers,
        score: score.score,
        finished,
      });
      setCompetitionLiveProgress(response.competition.liveProgress ?? []);
      setCompetitionChats(response.competition.chats ?? competitionChats);
    } catch {
      // Live score updates should never block the session.
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
    const timeTakenSeconds = mode === "quiz" ? calculateQuizTime(selectedLevel) - timeLeft : elapsed;
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

    const result: SessionResult = {
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
      timeTakenSeconds,
      correctAnswers: score.correctAnswers,
      totalQuestions: score.totalQuestions,
      coinsEarned: bonusCoins,
      aiFeedback: feedback,
      aiStudyPlan: studyPlan,
    };

    if (isCompetition && params.competitionId) {
      await syncCompetitionProgress(finalAnswers, true);
      try {
        const competitionResult = await submitCompetitionResult({
          competitionId: params.competitionId,
          playerId: profile.id,
          score: score.score,
          correctAnswers: score.correctAnswers,
          totalQuestions: score.totalQuestions,
          timeTakenSeconds,
        });

        result.competitionId = params.competitionId;
        result.competitionOpponentName = competitionResult.opponentName || competitionOpponentName;
        result.competitionOpponentId = competitionResult.opponentId;
        result.competitionOutcome = competitionResult.outcome;
        result.competitionPlayerScore = competitionResult.playerScore;
        result.competitionOpponentScore = competitionResult.opponentScore;
        result.competitionPlayerTimeSeconds = competitionResult.playerTimeTakenSeconds;
        result.competitionOpponentTimeSeconds = competitionResult.opponentTimeTakenSeconds;

        if (competitionResult.status === "submitted" || competitionResult.outcome === "pending") {
          setPendingCompetitionResult(result);
          setPhase("awaitingResult");
          return;
        }
      } catch {
        result.competitionId = params.competitionId;
        result.competitionOpponentName = competitionOpponentName;
        result.competitionOutcome = "pending";
        result.competitionPlayerScore = score.score;
        setPendingCompetitionResult(result);
        setPhase("awaitingResult");
        return;
      }
    }

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
          <Text style={styles.title}>{t(language, appVariant.curriculumSingular === "course" ? "courseNotFound" : "subjectNotFound")}</Text>
          <PrimaryButton label={t(language, "backHome")} onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  if (phase === "setup") {
    return (
      <AppBackground>
        <View style={styles.panel}>
          <Text style={styles.title}>{t(language, "sessionTitle", { subject: subject.name })}</Text>
          <Text style={styles.subtitle}>
            {hasPresetGrade
              ? t(language, "selectedGradeStartHint", {
                  grade,
                  mode: mode === "training" ? appVariant.trainingLabel.toLowerCase() : appVariant.quizLabel.toLowerCase(),
                })
              : t(language, "chooseGradeStartHint", {
                  mode: mode === "training" ? appVariant.trainingLabel.toLowerCase() : appVariant.quizLabel.toLowerCase(),
                })}
          </Text>

          {!hasPresetGrade ? (
            <>
              <Text style={styles.label}>{t(language, "grade")}</Text>
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

          <Text style={styles.label}>{t(language, "questionFocus")}</Text>
          <View style={styles.choiceWrap}>
            <Pressable
              onPress={() => setFocusMode("general")}
              style={[styles.choiceChip, focusMode === "general" ? styles.choiceChipActive : null]}
            >
              <Text style={[styles.choiceText, focusMode === "general" ? styles.choiceTextActive : null]}>{t(language, "general")}</Text>
            </Pressable>
            <Pressable
              onPress={() => setFocusMode("topic")}
              style={[styles.choiceChip, focusMode === "topic" ? styles.choiceChipActive : null]}
            >
              <Text style={[styles.choiceText, focusMode === "topic" ? styles.choiceTextActive : null]}>
                {appVariant.id === "uni" ? t(language, "specialized") : t(language, "topicFocus")}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.hintText}>
            {focusMode === "general"
              ? t(language, "generalHint", { item: appVariant.curriculumSingular })
              : appVariant.id === "uni"
                ? t(language, "specializedHint")
                : t(language, "topicHint")}
          </Text>

          {focusMode === "topic" ? (
            <>
              <Text style={styles.label}>{t(language, "chooseTopic")}</Text>
              <Pressable
                onPress={() => setIsTopicDropdownOpen((value) => !value)}
                style={[styles.dropdownTrigger, isTopicDropdownOpen ? styles.dropdownTriggerActive : null]}
              >
                <View style={styles.dropdownTextWrap}>
                  <Text style={styles.dropdownLabel}>{selectedTopic?.label ?? t(language, "selectTopic")}</Text>
                  <Text style={styles.dropdownHint}>{t(language, "topicPickerHint")}</Text>
                </View>
                <MaterialCommunityIcons
                  name={isTopicDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={24}
                  color={palette.navy}
                />
              </Pressable>
              {isTopicDropdownOpen ? (
                <View style={styles.dropdownMenu}>
                  <ScrollView nestedScrollEnabled style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                    {subject.topics.map((topic) => (
                      <Pressable
                        key={topic.id}
                        onPress={() => {
                          setTopicId(topic.id);
                          setIsTopicDropdownOpen(false);
                        }}
                        style={[styles.dropdownItem, topic.id === topicId ? styles.dropdownItemActive : null]}
                      >
                        <Text style={[styles.dropdownItemTitle, topic.id === topicId ? styles.dropdownItemTitleActive : null]}>
                          {topic.label}
                        </Text>
                        <Text style={[styles.dropdownItemText, topic.id === topicId ? styles.dropdownItemTextActive : null]}>
                          {topic.description}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              {selectedTopic ? <Text style={styles.hintText}>{selectedTopic.description}</Text> : null}
            </>
          ) : null}

          <Text style={styles.label}>{t(language, "unlockedLevels")}</Text>
          <Text style={styles.hintText}>{t(language, "highestUnlockedSelected", { grade })}</Text>
          <View style={styles.choiceWrap}>
            {levelProgress.map((entry) => (
              <Pressable
                key={`${grade}-level-${entry.level}`}
                onPress={() => {
                  setLevelTouched(true);
                  setSelectedLevel(entry.level);
                }}
                style={[styles.levelChip, selectedLevel === entry.level ? styles.choiceChipActive : null]}
              >
                <Text style={[styles.levelText, selectedLevel === entry.level ? styles.choiceTextActive : null]}>
                  {t(language, "levelLabel")} {entry.level}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{t(language, "difficulty")}</Text>
          <View style={styles.choiceWrap}>
            {(["Beginner", "Intermediate", "Advanced", "Expert"] as Difficulty[]).map((entry) => (
              <Pressable
                key={entry}
                onPress={() => setDifficulty(entry)}
                style={[styles.choiceChip, difficulty === entry ? styles.choiceChipActive : null]}
              >
                <Text style={[styles.choiceText, difficulty === entry ? styles.choiceTextActive : null]}>
                  {getDifficultyLabel(language, entry)}
                </Text>
              </Pressable>
            ))}
          </View>

          <PrimaryButton
            label={t(language, "start", { mode: mode === "training" ? appVariant.trainingLabel : appVariant.quizLabel })}
            onPress={loadQuestions}
          />
        </View>
      </AppBackground>
    );
  }

  if (phase === "loading") {
    return (
      <AppBackground scroll={false}>
        <View style={styles.centerPanel}>
          <Text style={styles.title}>{t(language, "preparingSession")}</Text>
          <Text style={styles.subtitle}>{t(language, "loadingQuestionsFor", { subject: subject.name })}</Text>
        </View>
      </AppBackground>
    );
  }

  if (phase === "countdown") {
    const countdown = Math.max(1, Math.ceil(((competitionStartAt ?? Date.now()) - Date.now()) / 1000));
    return (
      <AppBackground scroll={false}>
        <View style={styles.centerPanel}>
          <Text style={styles.title}>{subject.name}</Text>
          <Text style={styles.subtitle}>{t(language, "challengeAccepted")}</Text>
          <Text style={styles.countdownText}>{countdown}</Text>
          <Text style={styles.subtitle}>{t(language, "countdownToStart", { count: countdown })}</Text>
        </View>
      </AppBackground>
    );
  }

  if (phase === "awaitingResult") {
    return (
      <AppBackground scroll={false}>
        <View style={styles.centerPanel}>
          <Text style={styles.title}>{t(language, "competitionSummary")}</Text>
          <Text style={styles.subtitle}>{t(language, "waitingOpponentResult")}</Text>
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
              {grade} | {t(language, "levelLabel")} {selectedLevel} | {getDifficultyLabel(language, difficulty)}
            </Text>
            <Text style={styles.focusLine}>
              {focusMode === "topic" && selectedTopic ? `Topic focus: ${selectedTopic.label}` : "General mixed practice"}
            </Text>
            {isCompetition && competitionOpponentName ? (
              <Text style={styles.competitionLine}>
                {t(language, "opponent")}: {competitionOpponentName}
              </Text>
            ) : null}
          </View>
          <View style={styles.topRight}>
            {questionSource ? (
              <View style={[styles.sourceBadge, questionSource === "remote" ? styles.sourceBadgeRemote : null]}>
                <Text style={[styles.sourceBadgeText, questionSource === "remote" ? styles.sourceBadgeTextRemote : null]}>
                  {questionSource === "remote" ? t(language, "testSourceAi") : questionSource === "local" ? t(language, "testSourceLocal") : t(language, "testSourceDemo")}
                </Text>
              </View>
            ) : null}
            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>{mode === "quiz" ? `${timeLeft}s` : `${elapsed}s`}</Text>
            </View>
          </View>
        </View>

        {isCompetition ? (
          <View style={styles.liveScoreCard}>
            <Text style={styles.chatTitle}>{t(language, "liveScores")}</Text>
            <Text style={styles.liveScoreLine}>
              You: {ownCompetitionProgress?.score ?? 0}% ({ownCompetitionProgress?.answeredCount ?? 0}/{questions.length})
            </Text>
            <Text style={styles.liveScoreLine}>
              {competitionOpponentName ?? t(language, "opponent")}: {opponentProgress?.score ?? 0}% ({opponentProgress?.answeredCount ?? 0}/{questions.length})
            </Text>
          </View>
        ) : null}

        <Text style={styles.progressText}>
          {t(language, "questionCount", { current: currentIndex + 1, total: questions.length })}
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
              {selectedAnswer === currentQuestion?.answer ? t(language, "correct") : t(language, "keepGoing")}
            </Text>
            <Text style={styles.explanationText}>{currentQuestion?.explanation}</Text>
            {mode === "training" ? <PrimaryButton label={t(language, "nextQuestion")} onPress={() => advance()} /> : null}
          </View>
        ) : null}

        {isCompetition ? (
          <View style={styles.chatCard}>
            <Text style={styles.chatTitle}>{t(language, "competitionChat")}</Text>
            {competitionChats.length > 0 ? (
              <View style={styles.chatFeed}>
                {competitionChats.slice(-3).map((chat) => (
                  <View
                    key={chat.id}
                    style={[
                      styles.chatBubble,
                      chat.senderId === profile?.id ? styles.chatBubbleOwn : styles.chatBubbleOpponent,
                    ]}
                  >
                    <Text style={styles.chatSender}>{chat.senderId === profile?.id ? "You" : chat.senderName}</Text>
                    <Text style={styles.chatMessage}>{chat.message}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.chatEmpty}>{t(language, "noMessagesYet")}</Text>
            )}

            <Text style={styles.chatSectionLabel}>{t(language, "quickMessages")}</Text>
            <View style={styles.chatChipWrap}>
              {competitionQuickMessages.map((message) => (
                <Pressable
                  key={message}
                  onPress={() => handleCompetitionQuickMessage(message)}
                  style={styles.chatChip}
                >
                  <Text style={styles.chatChipText}>{message}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.chatSectionLabel}>{t(language, "quickEmojis")}</Text>
            <View style={styles.chatChipWrap}>
              {competitionQuickEmojis.map((emoji) => (
                <Pressable key={emoji} onPress={() => handleCompetitionQuickMessage(emoji)} style={styles.emojiChip}>
                  <Text style={styles.emojiChipText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
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
  dropdownTrigger: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    backgroundColor: "#F9FBFD",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dropdownTriggerActive: {
    borderColor: palette.navy,
  },
  dropdownTextWrap: {
    flex: 1,
  },
  dropdownLabel: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  dropdownHint: {
    color: palette.slate,
    marginTop: 4,
    lineHeight: 18,
    fontSize: 12,
  },
  dropdownMenu: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    backgroundColor: palette.white,
    overflow: "hidden",
  },
  dropdownScroll: {
    maxHeight: 260,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3F7",
  },
  dropdownItemActive: {
    backgroundColor: "#EAF7FD",
  },
  dropdownItemTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  dropdownItemTitleActive: {
    color: palette.navy,
  },
  dropdownItemText: {
    color: palette.slate,
    marginTop: 4,
    lineHeight: 18,
    fontSize: 12,
  },
  dropdownItemTextActive: {
    color: palette.navy,
  },
  focusLine: {
    color: palette.navy,
    marginTop: 6,
    fontWeight: "700",
  },
  competitionLine: {
    color: "#0A7D58",
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
  countdownText: {
    color: palette.white,
    fontSize: 72,
    fontWeight: "900",
    marginVertical: 10,
  },
  progressText: {
    marginTop: 16,
    color: palette.slate,
    fontWeight: "700",
  },
  chatCard: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: "#F4F9FC",
    padding: 14,
  },
  chatTitle: {
    color: palette.navy,
    fontSize: 16,
    fontWeight: "800",
  },
  chatFeed: {
    gap: 8,
    marginTop: 10,
  },
  chatBubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chatBubbleOwn: {
    backgroundColor: "#DDF7EA",
    alignSelf: "flex-end",
  },
  chatBubbleOpponent: {
    backgroundColor: palette.white,
    alignSelf: "flex-start",
  },
  chatSender: {
    color: palette.navy,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
  },
  chatMessage: {
    color: palette.ink,
    lineHeight: 20,
  },
  chatEmpty: {
    color: palette.slate,
    marginTop: 10,
    lineHeight: 20,
  },
  chatSectionLabel: {
    color: palette.slate,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 8,
  },
  chatChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chatChip: {
    borderRadius: 999,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chatChipText: {
    color: palette.navy,
    fontWeight: "700",
  },
  liveScoreCard: {
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: "#EEF7FB",
    padding: 14,
  },
  liveScoreLine: {
    color: palette.navy,
    marginTop: 8,
    fontWeight: "700",
    lineHeight: 20,
  },
  emojiChip: {
    borderRadius: 999,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiChipText: {
    fontSize: 22,
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

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, BackHandler, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { DemoAdBanner } from "../components/DemoAdBanner";
import { PremiumFeatureDialog } from "../components/PremiumFeatureDialog";
import { cancelCompetitionReminderNotifications, scheduleCompetitionReminderNotifications } from "../lib/notifications";
import { PrimaryButton } from "../components/PrimaryButton";
import { MathText } from "../components/MathText";
import { appVariant } from "../lib/app-variant";
import { canShowAds } from "../lib/ads";
import { getDifficultyLabel, t } from "../lib/i18n";
import { getLocalQuestions } from "../lib/question-bank";
import { appendQuestionHistory, appendResult, getRecentQuestionIds, readAppState, upsertResult } from "../lib/storage";
import { canUseAiToday, canUseClassroom, hasProAccess } from "../lib/subscription";
import { calculateQuizTime, getDifficultyForLevel, getDifficultyLevelRange, getLevelProgressForGrade, getNextDifficulty, GRADE_LEVEL_COUNT, normalizeQuestions, scoreQuestions } from "../lib/quiz";
import {
  getSubjectById,
  getSubjectDisplayName,
  getTopicById,
  grades,
  QUESTIONS_PER_LEVEL,
  validateTopicInput,
} from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import {
  acceptCompetitionRematch,
  generateCoachPlan,
  generateFeedback,
  generateQuestions,
  getClassroomActivityDetails,
  getCompetitionRematchStatus,
  getCompetitionStatus,
  requestCompetitionRematch,
  recordClassroomActivitySecurityEvent,
  sendCompetitionChat,
  submitClassroomActivity,
  submitCompetitionResult,
  updateCompetitionProgress,
} from "../services/ai";
import type {
  CompetitionChatMessage,
  CompetitionLiveProgress,
  CompetitionRematchResponse,
  Difficulty,
  ClassroomExitPolicy,
  Question,
  QuestionFocusMode,
  QuestionRequest,
  QuestionResponse,
  SessionResult,
  Subject,
  SubscriptionTier,
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
    classroomActivityId?: string;
    cbtAccessCode?: string;
  }>();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>("free");
  const language = profile?.language ?? "en";
  const subject = getSubjectById(params.subjectId, language);
  const mode: TestMode = params.mode === "training" ? "training" : "quiz";
  const presetLevel = Math.min(Math.max(Number(params.level ?? 1), 1), GRADE_LEVEL_COUNT);
  const isCompetition = typeof params.competitionId === "string";
  const isClassroomActivity = typeof params.classroomActivityId === "string";
  const usesAssignedDifficulty = isCompetition || isClassroomActivity;
  const hasPresetGrade = typeof params.grade === "string" && grades.includes(params.grade);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [grade, setGrade] = useState(() =>
    typeof params.grade === "string" && grades.includes(params.grade) ? params.grade : grades[0]
  );
  const [focusMode, setFocusMode] = useState<QuestionFocusMode>(params.focusMode === "topic" ? "topic" : "general");
  const [topicId, setTopicId] = useState<string | null>(typeof params.topicId === "string" ? params.topicId : null);
  const [isCustomTopic, setIsCustomTopic] = useState(false);
  const [customTopicInput, setCustomTopicInput] = useState("");
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(presetLevel);
  const [levelTouched, setLevelTouched] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>(() =>
    usesAssignedDifficulty && params.difficulty && ["Beginner", "Intermediate", "Advanced", "Expert"].includes(params.difficulty)
      ? params.difficulty
      : getDifficultyForLevel(presetLevel)
  );
  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Array<string | null>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [questionSource, setQuestionSource] = useState<QuestionResponse["source"] | null>(null);
  const [showAiUpgrade, setShowAiUpgrade] = useState(false);
  const [pendingLocalRequest, setPendingLocalRequest] = useState<QuestionRequest | null>(null);
  const [activitySubjectName, setActivitySubjectName] = useState<string | null>(subject?.name ?? null);
  const [activityTopicLabel, setActivityTopicLabel] = useState<string | null>(null);
  const [activityExitPolicy, setActivityExitPolicy] = useState<ClassroomExitPolicy>("warn_record");
  const [activityHasWrittenQuestions, setActivityHasWrittenQuestions] = useState(false);
  const [skippedQuestionIds, setSkippedQuestionIds] = useState<string[]>([]);
  const [competitionChats, setCompetitionChats] = useState<CompetitionChatMessage[]>([]);
  const [competitionLiveProgress, setCompetitionLiveProgress] = useState<CompetitionLiveProgress[]>([]);
  const [competitionStartAt, setCompetitionStartAt] = useState<number | null>(null);
  const [competitionEndAt, setCompetitionEndAt] = useState<number | null>(null);
  const [pendingCompetitionResult, setPendingCompetitionResult] = useState<SessionResult | null>(null);
  const [competitionRematchState, setCompetitionRematchState] = useState<CompetitionRematchResponse | null>(null);
  const [isRequestingCompetitionRematch, setIsRequestingCompetitionRematch] = useState(false);
  const [isAcceptingCompetitionRematch, setIsAcceptingCompetitionRematch] = useState(false);
  const hasAutoStartedRef = useRef(false);
  const lastScheduledCompetitionRef = useRef<string | null>(null);
  const isFinishingRef = useRef(false);
  const activitySubmittedRef = useRef(false);
  const activePhaseRef = useRef<SessionPhase>("setup");
  const answersRef = useRef<Array<string | null>>([]);
  const initialTimedSessionSecondsRef = useRef(0);
  const sessionResultIdRef = useRef<string>(`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
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
      if (typeof params.classroomActivityId === "string" && !canUseClassroom(state.subscriptionTier)) {
        Alert.alert(t("en", "classroomTitle"), t("en", "classroomProRequired"), [
          { text: t("en", "cancel"), style: "cancel", onPress: () => router.replace("/") },
          {
            text: t("en", "upgradeToPro"),
            onPress: () => router.replace({ pathname: "/subscription", params: { source: "classroom" } } as never),
          },
        ]);
        return;
      }

      const current = state.profiles.find((item) => item.id === state.currentProfileId) ?? null;
      setProfile(current);
      setResults(current ? state.results[current.id] ?? [] : []);
      setSubscriptionTier(state.subscriptionTier);
      if (!current && params.subjectId) {
        router.replace({ pathname: "/select-profile", params: { subject: params.subjectId } });
      }
    });
  }, [params.subjectId]);

  useEffect(() => {
    isFinishingRef.current = false;
    initialTimedSessionSecondsRef.current = 0;
    sessionResultIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }, [params.classroomActivityId, params.competitionId, params.subjectId, grade, mode, selectedLevel]);

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

    if (usesAssignedDifficulty && params.difficulty && ["Beginner", "Intermediate", "Advanced", "Expert"].includes(params.difficulty)) {
      setDifficulty(params.difficulty);
    }
  }, [params.grade, params.difficulty, params.focusMode, params.topicId, usesAssignedDifficulty]);

  useEffect(() => {
    if (!usesAssignedDifficulty) {
      setDifficulty(getDifficultyForLevel(selectedLevel));
    }
  }, [selectedLevel, usesAssignedDifficulty]);

  useEffect(() => {
    if (subject?.name) {
      setActivitySubjectName(subject.name);
    }
  }, [subject?.name]);

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
  const customTopicValidation = useMemo(
    () => (isCustomTopic ? validateTopicInput(subject, customTopicInput, language) : null),
    [customTopicInput, isCustomTopic, language, subject]
  );
  const resolvedTopic = useMemo(() => {
    if (isCustomTopic && customTopicValidation?.status === "valid") {
      return getTopicById(subject, customTopicValidation.matchedTopicId);
    }

    return selectedTopic;
  }, [customTopicValidation, isCustomTopic, selectedTopic, subject]);
  const resolvedTopicLabel = useMemo(() => {
    if (focusMode !== "topic") {
      return undefined;
    }

    if (isCustomTopic) {
      if (customTopicValidation?.status === "valid") {
        return customTopicValidation.matchedTopicLabel ?? customTopicValidation.input;
      }

      const trimmedCustomTopic = customTopicInput.trim();
      return trimmedCustomTopic || undefined;
    }

    return selectedTopic?.label;
  }, [customTopicInput, customTopicValidation, focusMode, isCustomTopic, selectedTopic]);
  const resolvedSubjectName = activitySubjectName ?? subject?.name ?? "Session";
  const resolvedFocusLabel =
    focusMode === "topic"
      ? activityTopicLabel ?? resolvedTopicLabel ?? resolvedTopic?.label ?? null
      : null;
  const sourceBadgeLabel =
    questionSource === "remote" ? "TS1" : questionSource === "local" ? "TS2" : questionSource === "demo" ? "TS3" : null;
  const effectiveSubject = useMemo<Subject | null>(() => {
    if (subject) {
      return subject;
    }

    if (!activitySubjectName && !isClassroomActivity) {
      return null;
    }

    const fallbackActivityName = activitySubjectName ?? "Classroom activity";
    return {
      id: params.subjectId ?? `custom-${fallbackActivityName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: fallbackActivityName,
      tagline: "Classroom subject",
      icon: "book-open-variant",
      accent: ["#0E5C63", "#7EE2D9"],
      description: "Classroom activity subject",
      aiPromptHint: `Treat ${fallbackActivityName} as the classroom subject for this activity.`,
      topics: resolvedFocusLabel
        ? [
            {
              id: params.topicId ?? `topic-${resolvedFocusLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
              label: resolvedFocusLabel,
              description: "Classroom topic",
              keywords: [resolvedFocusLabel.toLowerCase()],
            },
          ]
        : [],
    };
  }, [activitySubjectName, isClassroomActivity, params.subjectId, params.topicId, resolvedFocusLabel, subject]);

  useEffect(() => {
    if (!subject) {
      return;
    }

    if (!isClassroomActivity && focusMode === "topic") {
      if (isCustomTopic) {
        return;
      }

      const hasCurrentTopic = topicId && subject.topics.some((topic) => topic.id === topicId);
      if (!hasCurrentTopic) {
        setTopicId(subject.topics[0]?.id ?? null);
      }
      return;
    }

    setIsTopicDropdownOpen(false);
    setIsCustomTopic(false);
    setCustomTopicInput("");
    setTopicId(null);
  }, [focusMode, isCustomTopic, subject, topicId]);

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
            void finishSession(answersRef.current, { autoSubmitted: true, exitReason: "time_expired" });
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
    if (!isCompetition || !params.competitionId) {
      return;
    }

    if (phase === "countdown" && competitionStartAt && subject) {
      const reminderKey = [
        params.competitionId,
        competitionStartAt,
        competitionOpponentName ?? "",
        params.subjectId ?? subject.id,
        grade,
        selectedLevel,
        difficulty,
        focusMode,
        params.topicId ?? "",
      ].join(":");

      if (lastScheduledCompetitionRef.current === reminderKey) {
        return;
      }

      lastScheduledCompetitionRef.current = reminderKey;
      void scheduleCompetitionReminderNotifications({
        competitionId: params.competitionId,
        subjectId: params.subjectId ?? subject.id,
        grade,
        level: String(selectedLevel),
        difficulty,
        focusMode,
        topicId: params.topicId,
        opponentName: competitionOpponentName,
        startAt: competitionStartAt,
        soonTitle: t(language, "competitionReminderSoonTitle"),
        soonBody: t(language, "competitionReminderSoonBody", {
          subject: resolvedSubjectName,
          opponent: competitionOpponentName ?? t(language, "opponent"),
        }),
        startTitle: t(language, "competitionReminderNowTitle"),
        startBody: t(language, "competitionReminderNowBody", {
          subject: resolvedSubjectName,
          opponent: competitionOpponentName ?? t(language, "opponent"),
        }),
      });
      return;
    }

    if (phase === "active" || phase === "review" || phase === "awaitingResult") {
      lastScheduledCompetitionRef.current = null;
      void cancelCompetitionReminderNotifications(params.competitionId);
    }
  }, [
    competitionOpponentName,
    competitionStartAt,
    difficulty,
    focusMode,
    grade,
    isCompetition,
    language,
    params.competitionId,
    params.subjectId,
    params.topicId,
    phase,
    resolvedSubjectName,
    selectedLevel,
    subject,
  ]);

  useEffect(() => {
    if (!isCompetition || !profile || !["countdown", "active", "review", "awaitingResult"].includes(phase)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const [response, rematchResponse] = await Promise.all([
          getCompetitionStatus({
            playerId: profile.id,
            competitionId: params.competitionId,
          }),
          getCompetitionRematchStatus({
            sourceCompetitionId: params.competitionId!,
            playerId: profile.id,
          }),
        ]);
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
        setCompetitionRematchState(rematchResponse);

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
            competitionParticipantCount:
              response.participantCount ?? pendingCompetitionResult.competitionParticipantCount,
            competitionMode: response.mode ?? pendingCompetitionResult.competitionMode,
            competitionPlacement: response.playerPosition ?? pendingCompetitionResult.competitionPlacement,
            competitionStandings: response.standings ?? pendingCompetitionResult.competitionStandings,
          };
          await upsertResult(profile.id, finalResult);
          setPendingCompetitionResult(null);
          isFinishingRef.current = false;
          router.replace({
            pathname: "/results",
            params: {
              result: JSON.stringify(finalResult),
              nextDifficulty: usesAssignedDifficulty ? getNextDifficulty(difficulty) : getDifficultyForLevel(selectedLevel + 1),
            },
          });
        }
      } catch {
        // Keep the existing chat list on screen.
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [difficulty, isCompetition, params.competitionId, pendingCompetitionResult, phase, profile]);

  const requestLiveRematch = async () => {
    if (!canUseCompetitionRematch || !params.competitionId || !profile || !subject) {
      return;
    }

    setIsRequestingCompetitionRematch(true);
    try {
      const response = await requestCompetitionRematch({
        sourceCompetitionId: params.competitionId,
        playerId: profile.id,
        subject,
        grade,
        level: selectedLevel + 1,
        difficulty,
        focusMode,
        topicId: selectedTopic?.id,
        topicLabel: selectedTopic?.label,
        durationSeconds: calculateQuizTime(selectedLevel + 1),
        profile,
      });
      setCompetitionRematchState(response);
    } finally {
      setIsRequestingCompetitionRematch(false);
    }
  };

  const acceptLiveRematch = async () => {
    if (!canUseCompetitionRematch || !params.competitionId || !profile) {
      return;
    }

    setIsAcceptingCompetitionRematch(true);
    try {
      const response = await acceptCompetitionRematch({
        sourceCompetitionId: params.competitionId,
        playerId: profile.id,
        profile,
      });
      setCompetitionRematchState(response);
    } finally {
      setIsAcceptingCompetitionRematch(false);
    }
  };

  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex]);
  const opponentProgress = useMemo(
    () => competitionLiveProgress.find((entry) => entry.playerId !== profile?.id),
    [competitionLiveProgress, profile?.id]
  );
  const ownCompetitionProgress = useMemo(
    () => competitionLiveProgress.find((entry) => entry.playerId === profile?.id),
    [competitionLiveProgress, profile?.id]
  );
  const canUseCompetitionRematch = Boolean(isCompetition && profile && hasProAccess(subscriptionTier));

  const startQuestionSession = async (request: QuestionRequest, response: QuestionResponse) => {
    const nextQuestions = normalizeQuestions(response.questions);
    setQuestionSource(response.source);
    if (request.profile) {
      await appendQuestionHistory(
        request.profile.id,
        request.subject.id,
        nextQuestions.map((question) => question.id)
      );
    }
    setQuestions(nextQuestions);
    setAnswers(Array(nextQuestions.length).fill(null));
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setElapsed(0);
    setTimeLeft(request.mode === "quiz" ? calculateQuizTime(request.level) : 0);
    setPhase("active");
  };

  const continueWithLocalQuestions = async () => {
    const request = pendingLocalRequest;
    setShowAiUpgrade(false);
    setPendingLocalRequest(null);
    if (!request) {
      return;
    }

    setPhase("loading");
    try {
      await startQuestionSession(request, {
        questions: getLocalQuestions(request),
        source: "local",
      });
    } catch {
      setQuestionSource(null);
      Alert.alert(t(language, "unableToStartSession"), t(language, "questionGenerationFailed"));
      setPhase("setup");
    }
  };

  const loadQuestions = async () => {
    if (!profile || (!subject && !isClassroomActivity)) {
      return;
    }

    let requestTopicId = resolvedTopic?.id;
    let requestTopicLabel = resolvedTopicLabel;

    if (focusMode === "topic") {
      if (isCustomTopic) {
        const freshTopicValidation = validateTopicInput(subject, customTopicInput, language);

        if (freshTopicValidation.status === "empty") {
          Alert.alert(t(language, "chooseTopic"), t(language, "customTopicRequired"));
          return;
        }

        if (freshTopicValidation.status === "wrong-subject") {
          Alert.alert(
            t(language, "chooseTopic"),
            t(language, "customTopicWrongSubject", {
              topic: freshTopicValidation.matchedTopicLabel ?? freshTopicValidation.input,
              subject: resolvedSubjectName,
              matchedSubject: freshTopicValidation.matchedSubjectName ?? resolvedSubjectName,
            })
          );
          return;
        }

        requestTopicId =
          freshTopicValidation.status === "valid" ? freshTopicValidation.matchedTopicId ?? undefined : undefined;
        requestTopicLabel =
          freshTopicValidation.status === "valid"
            ? freshTopicValidation.matchedTopicLabel ?? freshTopicValidation.input
            : freshTopicValidation.input;

      } else if (!selectedTopic) {
        Alert.alert(t(language, "chooseTopic"), t(language, "customTopicRequired"));
        return;
      }
    }

    setPhase("loading");
    try {
      if (isClassroomActivity) {
        const assignment = await getClassroomActivityDetails({
          profile,
          activityId: params.classroomActivityId!,
          accessCode: params.cbtAccessCode,
        });
        if (assignment.activity.submitted) {
          Alert.alert("Classroom", `You have already submitted this ${assignment.activity.type}.`);
          router.replace("/classroom");
          return;
        }

        if (assignment.activity.status === "closed") {
          Alert.alert("Classroom", `This ${assignment.activity.type} is already closed.`);
          router.replace("/classroom");
          return;
        }

        const nextQuestions = assignment.questions.map((question) => ({
          ...question,
          type: question.type === "written" ? "written" as const : "objective" as const,
          points: Math.max(1, Number(question.points ?? 1)),
          options: Array.isArray(question.options) ? question.options : [],
          answer: "",
          explanation: "",
        }));
        setActivitySubjectName(
          getSubjectDisplayName(assignment.activity.subjectId, assignment.activity.subjectName, language)
        );
        setActivityTopicLabel(assignment.activity.topicLabel ?? null);
        setActivityExitPolicy(assignment.activity.exitPolicy ?? "warn_record");
        setActivityHasWrittenQuestions(nextQuestions.some((question) => question.type === "written"));
        setSkippedQuestionIds([]);
        setQuestionSource("remote");
        setCompetitionChats([]);
        setCompetitionLiveProgress([]);
        setCompetitionStartAt(assignment.activity.startAt ?? null);
        setCompetitionEndAt(assignment.activity.endAt ?? null);
        setQuestions(nextQuestions);
        setAnswers(Array(nextQuestions.length).fill(null));
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setElapsed(0);
        const absoluteRemainingSeconds = Math.max(1, Math.floor((assignment.activity.endAt - Date.now()) / 1000));
        const perAttemptSeconds = Math.max(60, assignment.activity.durationMinutes * 60);
        const classroomTimeLimitSeconds = Math.min(absoluteRemainingSeconds, perAttemptSeconds);
        initialTimedSessionSecondsRef.current = classroomTimeLimitSeconds;
        setTimeLeft(classroomTimeLimitSeconds);
        setPhase(assignment.activity.startAt > Date.now() ? "countdown" : "active");
        return;
      }

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

      if (!effectiveSubject) {
        throw new Error("Subject is unavailable for this session.");
      }

      const recentQuestionIds = profile ? await getRecentQuestionIds(profile.id, effectiveSubject.id) : [];
      const request: QuestionRequest = {
        subject: effectiveSubject,
        grade,
        difficulty,
        mode,
        level: selectedLevel,
        questionCount: QUESTIONS_PER_LEVEL,
        focusMode,
        topicId: requestTopicId,
        topicLabel: requestTopicLabel,
        profile,
        recentQuestionIds,
      };
      const allowAi = hasProAccess(subscriptionTier) || canUseAiToday(subscriptionTier, results);
      if (!allowAi) {
        setPendingLocalRequest(request);
        setPhase("setup");
        setShowAiUpgrade(true);
        return;
      }

      const response = await generateQuestions(request);
      await startQuestionSession(request, response);
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

    if ((!subject && !isClassroomActivity) || !profile || phase !== "setup") {
      return;
    }

    hasAutoStartedRef.current = true;
    loadQuestions();
  }, [isClassroomActivity, params.autoStart, subject, profile, phase]);

  const chooseAnswer = (option: string) => {
    if (phase !== "active") {
      return;
    }

    const nextAnswers = [...answers];
    nextAnswers[currentIndex] = option;
    setAnswers(nextAnswers);
    setSelectedAnswer(option);
    if (isClassroomActivity) {
      setSkippedQuestionIds((current) => current.filter((id) => id !== currentQuestion?.id));
      setTimeout(() => advance(nextAnswers), 180);
      return;
    }
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
    if (isClassroomActivity) {
      const unanswered = questions
        .map((question, index) => ({ question, index }))
        .filter(({ index }) => !String(nextAnswers[index] ?? "").trim());
      const ordinary = unanswered.find(({ question }) => !skippedQuestionIds.includes(question.id));
      const deferred = unanswered.find(({ question }) => skippedQuestionIds.includes(question.id));
      const next = ordinary ?? deferred;
      if (next) {
        setCurrentIndex(next.index);
        setPhase("active");
      } else {
        void finishSession(nextAnswers);
      }
      return;
    }
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((value) => value + 1);
      setPhase("active");
    } else {
      finishSession(nextAnswers);
    }
  };

  const saveWrittenAnswer = () => {
    if (phase !== "active" || currentQuestion?.type !== "written") return;
    const nextAnswers = [...answers];
    nextAnswers[currentIndex] = String(nextAnswers[currentIndex] ?? "").trim();
    setAnswers(nextAnswers);
    setSkippedQuestionIds((current) => current.filter((id) => id !== currentQuestion.id));
    advance(nextAnswers);
  };

  const skipClassroomQuestion = () => {
    if (!isClassroomActivity || phase !== "active" || !currentQuestion) return;
    const nextSkipped = skippedQuestionIds.includes(currentQuestion.id)
      ? skippedQuestionIds
      : [...skippedQuestionIds, currentQuestion.id];
    setSkippedQuestionIds(nextSkipped);
    const next = questions
      .map((question, index) => ({ question, index }))
      .find(({ question, index }) => index !== currentIndex && !String(answers[index] ?? "").trim() && !nextSkipped.includes(question.id))
      ?? questions
        .map((question, index) => ({ question, index }))
        .find(({ index }) => index !== currentIndex && !String(answers[index] ?? "").trim());
    if (!next) {
      Alert.alert("Question review", "This is the remaining unanswered question. Answer it or submit your activity from the review controls.");
      return;
    }
    setSelectedAnswer(null);
    setCurrentIndex(next.index);
  };

  const finishSession = async (
    finalAnswers = answers,
    completion: { autoSubmitted?: boolean; exitReason?: string } = {}
  ) => {
    if (!profile || questions.length === 0) {
      return;
    }

    if (isFinishingRef.current) {
      return;
    }

    isFinishingRef.current = true;

    const effectiveSubject =
      subject ??
      ({
        id: params.subjectId ?? "custom-classroom-subject",
        name: activitySubjectName ?? "Custom subject",
        tagline: "",
        icon: "book-open-variant",
        accent: ["#0E5C63", "#7EE2D9"],
        description: "",
        aiPromptHint: "Teacher-authored classroom subject.",
        topics: [],
      } as const);

    const score = scoreQuestions(questions, finalAnswers);
    const timeTakenSeconds = isClassroomActivity
      ? Math.max(1, initialTimedSessionSecondsRef.current - timeLeft)
      : mode === "quiz"
        ? Math.max(1, calculateQuizTime(selectedLevel) - timeLeft)
        : Math.max(1, elapsed);
    const bonusCoins = mode === "quiz" && score.score === 100 ? Math.floor(Math.max(timeLeft, 0) * 0.05) : 0;
    const practiceLabel = resolvedFocusLabel ?? effectiveSubject.name;
    let feedback = `You completed your ${practiceLabel} session. Keep building your confidence one level at a time.`;
    let studyPlan = [
      `Review the key ideas from ${practiceLabel.toLowerCase()} before your next session.`,
      `Repeat this level in training mode if any question felt difficult.`,
      `Move steadily and focus on accuracy first, then speed.`,
    ];

    if (hasProAccess(subscriptionTier) && !isClassroomActivity) {
      try {
          feedback = await generateFeedback({
            score: score.score,
            subject: effectiveSubject,
            grade,
            focusMode,
            topicLabel: resolvedFocusLabel ?? undefined,
            profile,
          });
      } catch {
        // Keep the local fallback message.
      }

      try {
        studyPlan = await generateCoachPlan({
          resultScore: score.score,
          subject: effectiveSubject,
          grade,
          level: selectedLevel,
          focusMode,
          topicLabel: resolvedFocusLabel ?? undefined,
          profile,
        });
      } catch {
        // Keep the local fallback study plan.
      }
    }

    const result: SessionResult = {
        id: sessionResultIdRef.current,
        date: new Date().toISOString(),
        subjectId: effectiveSubject.id,
        subjectName: effectiveSubject.name,
      level: selectedLevel,
      difficulty,
      grade,
      mode,
        focusMode,
        topicId: resolvedTopic?.id,
        topicLabel: resolvedFocusLabel ?? resolvedTopic?.label,
      score: score.score,
      timeTakenSeconds,
      correctAnswers: score.correctAnswers,
      totalQuestions: score.totalQuestions,
      coinsEarned: bonusCoins,
      aiFeedback: feedback,
      aiStudyPlan: studyPlan,
      questionSource: questionSource ?? undefined,
      classroomActivityId: typeof params.classroomActivityId === "string" ? params.classroomActivityId : undefined,
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
        result.competitionParticipantCount = competitionResult.participantCount;
        result.competitionMode = competitionResult.mode;
        result.competitionPlacement = competitionResult.playerPosition;
        result.competitionStandings = competitionResult.standings;

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

    if (isClassroomActivity && params.classroomActivityId) {
      try {
        const submitted = await submitClassroomActivity({
          profile,
          activityId: params.classroomActivityId,
          answers: questions.map((question, index) => ({ questionId: question.id, answer: String(finalAnswers[index] ?? "").trim() })),
          timeTakenSeconds,
          autoSubmitted: completion.autoSubmitted,
          exitReason: completion.exitReason,
        });
        result.score = submitted.submission.score;
        result.correctAnswers = submitted.submission.correctAnswers;
        result.totalQuestions = submitted.submission.totalQuestions;
        result.aiFeedback = submitted.submission.gradingStatus === "awaiting_marking"
          ? "Your objective answers have been marked. Your final score will be available after your teacher marks the written section."
          : completion.autoSubmitted
            ? "Your saved work was automatically submitted under the activity exit policy."
            : result.aiFeedback;
        activitySubmittedRef.current = true;
      } catch (error) {
        isFinishingRef.current = false;
        Alert.alert("Submission not completed", error instanceof Error ? error.message : "Reconnect and submit again.");
        return;
      }
    }

    result.aiStudyPlan = hasProAccess(subscriptionTier) ? studyPlan : studyPlan.slice(0, 2);

    await appendResult(profile.id, result);
    isFinishingRef.current = false;

    if (isClassroomActivity && params.classroomActivityId) {
      router.replace({
        pathname: "/classroom-result" as never,
        params: {
          activityId: params.classroomActivityId,
        },
      } as never);
      return;
    }

    router.replace({
      pathname: "/results",
      params: {
        result: JSON.stringify(result),
        nextDifficulty: usesAssignedDifficulty ? getNextDifficulty(difficulty) : getDifficultyForLevel(selectedLevel + 1),
      },
    });
  };

  useEffect(() => {
    activePhaseRef.current = phase;
    answersRef.current = answers;
  }, [answers, phase]);

  const recordSecurityEvent = async (eventType: "exit_attempt" | "app_background" | "tab_hidden") => {
    if (!profile || !params.classroomActivityId || activitySubmittedRef.current) return;
    try {
      await recordClassroomActivitySecurityEvent({
        profile,
        activityId: params.classroomActivityId,
        event: { eventId: `${profile.id}-${Date.now()}-${eventType}`, eventType, occurredAt: Date.now() },
      });
    } catch {
      // A temporary event-log failure must not erase the student's saved answers.
    }
  };

  const requestClassroomExit = () => {
    if (!isClassroomActivity || !["active", "review"].includes(activePhaseRef.current) || activitySubmittedRef.current) return false;
    if (activityExitPolicy === "strict_submit") {
      void finishSession(answersRef.current, { autoSubmitted: true, exitReason: "strict_exit" });
      return true;
    }
    void recordSecurityEvent("exit_attempt");
    const submitAndExit = activityExitPolicy === "confirm_submit";
    Alert.alert(
      submitAndExit ? "Submit and leave activity?" : "Leave activity?",
      submitAndExit
        ? "Your saved answers will be submitted and this attempt will end."
        : "This exit will be recorded. You may return while the activity remains open.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: submitAndExit ? "Submit and leave" : "Leave",
          style: submitAndExit ? "destructive" : "default",
          onPress: () => submitAndExit
            ? void finishSession(answersRef.current, { autoSubmitted: true, exitReason: "confirmed_exit" })
            : router.replace("/classroom"),
        },
      ]
    );
    return true;
  };

  const confirmClassroomSubmission = () => {
    const unanswered = answersRef.current.filter((answer) => !String(answer ?? "").trim()).length;
    Alert.alert(
      "Submit activity?",
      unanswered > 0
        ? `${unanswered} question(s) are unanswered. Submitting now will end this attempt.`
        : "Your answers will be submitted for marking and this attempt will end.",
      [
        { text: "Continue activity", style: "cancel" },
        { text: "Submit", onPress: () => void finishSession(answersRef.current) },
      ]
    );
  };

  const confirmQuitSession = () => {
    if (isClassroomActivity || !["active", "review"].includes(activePhaseRef.current) || isFinishingRef.current) return;
    const unanswered = answersRef.current.filter((answer) => !String(answer ?? "").trim()).length;
    Alert.alert(
      "Quit this session?",
      unanswered > 0
        ? `${unanswered} question(s) are unanswered. Your current answers will be scored and the session will end.`
        : "Your current answers will be scored and the session will end.",
      [
        { text: "Continue session", style: "cancel" },
        { text: "Quit and finish", style: "destructive", onPress: () => void finishSession(answersRef.current, { exitReason: "user_quit" }) },
      ]
    );
  };

  useEffect(() => {
    if (!isClassroomActivity) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", requestClassroomExit);
    return () => subscription.remove();
  }, [activityExitPolicy, isClassroomActivity, profile, params.classroomActivityId]);

  useEffect(() => {
    if (!isClassroomActivity) return;
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      const leaving = previousState === "active" && nextState !== "active";
      previousState = nextState;
      if (!leaving || !["active", "review"].includes(activePhaseRef.current) || activitySubmittedRef.current) return;
      if (activityExitPolicy === "strict_submit") {
        void finishSession(answersRef.current, { autoSubmitted: true, exitReason: "app_background" });
      } else {
        void recordSecurityEvent("app_background");
      }
    });
    return () => subscription.remove();
  }, [activityExitPolicy, isClassroomActivity, profile, params.classroomActivityId]);

  useEffect(() => {
    if (!isClassroomActivity || Platform.OS !== "web" || typeof document === "undefined") return;
    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden" || !["active", "review"].includes(activePhaseRef.current) || activitySubmittedRef.current) return;
      if (activityExitPolicy === "strict_submit") {
        void finishSession(answersRef.current, { autoSubmitted: true, exitReason: "tab_hidden" });
      } else {
        void recordSecurityEvent("tab_hidden");
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!["active", "review"].includes(activePhaseRef.current) || activitySubmittedRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onHistoryBack = () => {
      if (!["active", "review"].includes(activePhaseRef.current) || activitySubmittedRef.current) return;
      globalThis.history.pushState({ quiksActivityGuard: true }, "", globalThis.location.href);
      requestClassroomExit();
    };
    globalThis.history.pushState({ quiksActivityGuard: true }, "", globalThis.location.href);
    document.addEventListener("visibilitychange", onVisibilityChange);
    globalThis.addEventListener("beforeunload", onBeforeUnload);
    globalThis.addEventListener("popstate", onHistoryBack);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      globalThis.removeEventListener("beforeunload", onBeforeUnload);
      globalThis.removeEventListener("popstate", onHistoryBack);
    };
  }, [activityExitPolicy, isClassroomActivity, profile, params.classroomActivityId]);

  if (!effectiveSubject) {
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
          <Text style={styles.title}>{t(language, "sessionTitle", { subject: resolvedSubjectName })}</Text>
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
                  <Text style={styles.dropdownLabel}>
                    {isCustomTopic ? customTopicInput || t(language, "otherTopic") : selectedTopic?.label ?? t(language, "selectTopic")}
                  </Text>
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
                    {effectiveSubject.topics.map((topic) => (
                      <Pressable
                        key={topic.id}
                        onPress={() => {
                          setIsCustomTopic(false);
                          setCustomTopicInput("");
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
                    <Pressable
                      onPress={() => {
                        setIsCustomTopic(true);
                        setTopicId(null);
                        setIsTopicDropdownOpen(false);
                      }}
                      style={[styles.dropdownItem, isCustomTopic ? styles.dropdownItemActive : null]}
                    >
                      <Text style={[styles.dropdownItemTitle, isCustomTopic ? styles.dropdownItemTitleActive : null]}>
                        {t(language, "otherTopic")}
                      </Text>
                      <Text style={[styles.dropdownItemText, isCustomTopic ? styles.dropdownItemTextActive : null]}>
                        {t(language, "customTopicHint")}
                      </Text>
                    </Pressable>
                  </ScrollView>
                </View>
              ) : null}
              {isCustomTopic ? (
                <>
                  <TextInput
                    value={customTopicInput}
                    onChangeText={setCustomTopicInput}
                    style={styles.customTopicInput}
                    placeholder={t(language, "enterCustomTopic")}
                    placeholderTextColor="#7C8EA3"
                    autoCapitalize="words"
                  />
                  <Text style={styles.hintText}>
                    {customTopicValidation?.status === "valid"
                      ? customTopicValidation.correctedFrom
                        ? t(language, "customTopicSuggestion", {
                            topic: customTopicValidation.matchedTopicLabel ?? customTopicValidation.input,
                            input: customTopicValidation.input,
                          })
                        : t(language, "customTopicRecognized", {
                            topic: customTopicValidation.matchedTopicLabel ?? customTopicValidation.input,
                            subject: effectiveSubject.name,
                          })
                        : customTopicValidation?.status === "custom"
                          ? t(language, "customTopicAccepted", {
                              topic: customTopicValidation.input,
                            })
                      : customTopicValidation?.status === "wrong-subject"
                        ? t(language, "customTopicWrongSubject", {
                            topic: customTopicValidation.matchedTopicLabel ?? customTopicValidation.input,
                            subject: effectiveSubject.name,
                            matchedSubject: customTopicValidation.matchedSubjectName ?? effectiveSubject.name,
                          })
                        : customTopicValidation?.status === "unknown"
                          ? t(language, "customTopicUnknown", {
                              topic: customTopicValidation.input,
                              subject: effectiveSubject.name,
                            })
                          : t(language, "customTopicHint")}
                  </Text>
                </>
              ) : selectedTopic ? (
                <Text style={styles.hintText}>{selectedTopic.description}</Text>
              ) : null}
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
            <View style={[styles.choiceChip, styles.choiceChipActive]}>
              <Text style={[styles.choiceText, styles.choiceTextActive]}>{getDifficultyLabel(language, difficulty)}</Text>
            </View>
          </View>
          {!usesAssignedDifficulty ? (
            <Text style={styles.hintText}>
              {t(language, "difficultyLevelRange", {
                first: getDifficultyLevelRange(difficulty).firstLevel,
                last: getDifficultyLevelRange(difficulty).lastLevel,
              })}
            </Text>
          ) : null}

          <PrimaryButton
            label={t(language, "start", { mode: mode === "training" ? appVariant.trainingLabel : appVariant.quizLabel })}
            onPress={loadQuestions}
          />
        </View>
        <PremiumFeatureDialog
          visible={showAiUpgrade}
          title={t(language, "upgradeToPro")}
          message={t(language, "freeAiLimitReached")}
          upgradeLabel={t(language, "upgradeToPro")}
          cancelLabel={t(language, "cancel")}
          onClose={continueWithLocalQuestions}
          onUpgrade={() => {
            setShowAiUpgrade(false);
            setPendingLocalRequest(null);
            router.push({ pathname: "/subscription", params: { source: "ai-practice" } } as never);
          }}
        />
      </AppBackground>
    );
  }

  if (phase === "loading") {
    return (
      <AppBackground scroll={false}>
        <View style={styles.centerPanel}>
          <Text style={styles.title}>{t(language, "preparingSession")}</Text>
          <Text style={styles.subtitle}>{t(language, "loadingQuestionsFor", { subject: resolvedSubjectName })}</Text>
        </View>
      </AppBackground>
    );
  }

  if (phase === "countdown") {
    const countdown = Math.max(1, Math.ceil(((competitionStartAt ?? Date.now()) - Date.now()) / 1000));
    return (
      <AppBackground scroll={false}>
        <View style={styles.centerPanel}>
          <Text style={styles.title}>{resolvedSubjectName}</Text>
          
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
    <AppBackground scroll={Platform.OS === "web"}>
      <ScrollView
        style={[styles.questionScroll, Platform.OS === "web" ? styles.questionScrollWeb : null]}
        contentContainerStyle={styles.questionScrollContent}
        scrollEnabled={Platform.OS !== "web"}
        showsVerticalScrollIndicator={false}
      >
        {canShowAds(subscriptionTier) ? (
          <View style={styles.questionBanner}>
            <DemoAdBanner language={language} format="banner" compact />
          </View>
        ) : null}
        <View style={styles.panel}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.titleSmall}>{resolvedSubjectName}</Text>
            <Text style={styles.subtitle}>
              {grade} | {t(language, "levelLabel")} {selectedLevel} | {getDifficultyLabel(language, difficulty)}
            </Text>
            <Text style={styles.focusLine}>
              {focusMode === "topic" && resolvedFocusLabel
                ? t(language, "topicFocusLabel", { topic: resolvedFocusLabel })
                : t(language, "generalMixedPractice")}
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
                  {sourceBadgeLabel}
                </Text>
              </View>
            ) : null}
            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>{mode === "quiz" ? `${timeLeft}s` : `${elapsed}s`}</Text>
            </View>
            {!isClassroomActivity ? <Pressable accessibilityRole="button" style={styles.quitButton} onPress={confirmQuitSession}><Text style={styles.quitButtonText}>Quit</Text></Pressable> : null}
          </View>
        </View>

        {isCompetition ? (
          <>
            <View style={styles.liveScoreCard}>
              <Text style={styles.chatTitle}>{t(language, "liveScores")}</Text>
              <Text style={styles.liveScoreLine}>
                You: {ownCompetitionProgress?.score ?? 0}% ({ownCompetitionProgress?.answeredCount ?? 0}/{questions.length})
              </Text>
              <Text style={styles.liveScoreLine}>
                {competitionOpponentName ?? t(language, "opponent")}: {opponentProgress?.score ?? 0}% ({opponentProgress?.answeredCount ?? 0}/{questions.length})
              </Text>
            </View>

            <View style={styles.rematchActionWrap}>
              {canUseCompetitionRematch ? (
                competitionRematchState?.status === "incoming" ? (
                  <PrimaryButton
                    label={t(language, "acceptRematch")}
                    onPress={acceptLiveRematch}
                    loading={isAcceptingCompetitionRematch}
                  />
                ) : competitionRematchState?.status === "requested" ? (
                  <PrimaryButton label={t(language, "rematchRequested")} variant="secondary" onPress={() => {}} disabled />
                ) : competitionRematchState?.status === "accepted" ? (
                  <PrimaryButton label={t(language, "rematchStarting")} variant="secondary" onPress={() => {}} disabled />
                ) : (
                  <PrimaryButton
                    label={t(language, "requestRematch")}
                    variant="secondary"
                    onPress={requestLiveRematch}
                    loading={isRequestingCompetitionRematch}
                  />
                )
              ) : (
                <PrimaryButton
                  label={t(language, "upgradeToPro")}
                  variant="secondary"
                  onPress={() => router.push({ pathname: "/subscription" } as never)}
                />
              )}
            </View>
          </>
        ) : null}

        <Text style={styles.progressText}>
          {t(language, "questionCount", { current: currentIndex + 1, total: questions.length })}
        </Text>
        {isClassroomActivity && activityExitPolicy !== "warn_record" ? (
          <View style={styles.securityNotice}>
            <Text style={styles.securityNoticeTitle}>{activityExitPolicy === "strict_submit" ? "Strict CBT mode" : "Protected activity"}</Text>
            <Text style={styles.securityNoticeText}>{activityExitPolicy === "strict_submit" ? "Leaving this screen, changing tabs or placing the app in the background automatically submits your saved work." : "If you confirm an in-app exit, your saved work will be submitted and the attempt will end."}</Text>
          </View>
        ) : null}
        {currentQuestion?.image ? <Image source={{ uri: `data:${currentQuestion.image.mimeType};base64,${currentQuestion.image.dataBase64}` }} style={styles.questionImage} resizeMode="contain" accessibilityLabel={currentQuestion.image.altText ?? "Question illustration"}/> : null}
        <MathText
          value={currentQuestion?.prompt}
          textStyle={styles.question}
          containerStyle={styles.questionContainer}
        />

        {currentQuestion?.type === "written" ? (
          <View style={styles.writtenAnswerCard}>
            <Text style={styles.writtenAnswerLabel}>Written answer · {currentQuestion.points ?? 1} mark(s)</Text>
            <TextInput
              value={String(answers[currentIndex] ?? "")}
              onChangeText={(value) => setAnswers((current) => current.map((answer, index) => index === currentIndex ? value : answer))}
              placeholder="Type your answer here"
              placeholderTextColor="#7C8EA3"
              multiline
              textAlignVertical="top"
              style={styles.writtenAnswerInput}
            />
            <Text style={styles.writtenAnswerHint}>Maximum suggested length: {currentQuestion.maxWords ?? 500} words. Your response is preserved when you move to another question.</Text>
            <PrimaryButton label="Save and continue" onPress={saveWrittenAnswer}/>
          </View>
        ) : <View style={styles.optionList}>
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
                <MathText value={option} textStyle={styles.optionText} />
              </Pressable>
            );
          })}
        </View>}

        {isClassroomActivity && phase === "active" ? (
          <View style={styles.classroomNavigationActions}>
            <PrimaryButton label="Skip and return later" variant="secondary" onPress={skipClassroomQuestion} style={styles.classroomNavigationButton}/>
            <PrimaryButton label="Submit activity" onPress={confirmClassroomSubmission} style={styles.classroomNavigationButton}/>
            <PrimaryButton label="Quit activity" variant="ghost" onPress={requestClassroomExit} style={styles.classroomNavigationButton}/>
          </View>
        ) : null}

        {isClassroomActivity && activityHasWrittenQuestions ? <Text style={styles.pendingMarkingHint}>This activity contains written answers. Your final score will be available after your teacher completes the marking.</Text> : null}

        {phase === "review" ? (
          <View style={styles.explanationCard}>
            <Text style={styles.explanationTitle}>
              {selectedAnswer === currentQuestion?.answer ? t(language, "correct") : t(language, "keepGoing")}
            </Text>
            <MathText
              value={currentQuestion?.explanation}
              textStyle={styles.explanationText}
              containerStyle={styles.explanationTextContainer}
            />
            {mode === "training" ? (
              <View style={styles.explanationActions}>
                <PrimaryButton label={t(language, "nextQuestion")} onPress={() => advance()} style={styles.explanationActionButton} />
                <PrimaryButton
                  label={t(language, "learnMore")}
                  variant="secondary"
                  onPress={() => router.push({
                    pathname: "/learning-hub" as never,
                    params: {
                      subjectId: effectiveSubject.id,
                      subjectName: resolvedSubjectName,
                      topicName: activityTopicLabel ?? resolvedTopicLabel ?? selectedTopic?.label ?? "Concept behind this answer",
                      grade,
                      context: `Question: ${currentQuestion?.prompt ?? ""}\nCorrect answer: ${currentQuestion?.answer ?? ""}\nExplanation: ${currentQuestion?.explanation ?? ""}`,
                    },
                  } as never)}
                  style={styles.explanationActionButton}
                />
              </View>
            ) : null}
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
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  questionBanner: {
    minHeight: 50,
    marginTop: 10,
    backgroundColor: "transparent",
  },
  questionScroll: {
    flex: 1,
  },
  questionScrollWeb: {
    flex: 0,
    overflow: "visible",
  },
  questionScrollContent: {
    paddingBottom: 24,
  },
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
  customTopicInput: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    backgroundColor: "#F9FBFD",
    paddingHorizontal: 14,
    color: palette.ink,
    marginTop: 12,
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
  quitButton: {
    minWidth: 78,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#B42318",
    backgroundColor: "#FFF0EE",
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: "center",
  },
  quitButtonText: {
    color: "#B42318",
    fontWeight: "900",
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
  securityNotice: {
    marginTop: 14,
    borderRadius: 16,
    padding: 13,
    backgroundColor: "#FFF4E8",
    borderWidth: 1,
    borderColor: "#F0B36B",
  },
  securityNoticeTitle: {
    color: "#8A4300",
    fontWeight: "900",
  },
  securityNoticeText: {
    color: "#70451D",
    lineHeight: 20,
    marginTop: 4,
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
  rematchActionWrap: {
    marginTop: 12,
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
  },
  questionContainer: {
    marginTop: 12,
  },
  questionImage: {
    width: "100%",
    height: 280,
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: "#F4F8FA",
  },
  writtenAnswerCard: {
    marginTop: 18,
    gap: 10,
  },
  writtenAnswerLabel: {
    color: palette.navy,
    fontWeight: "900",
  },
  writtenAnswerInput: {
    minHeight: 170,
    borderWidth: 1,
    borderColor: "#C9D7E2",
    borderRadius: 16,
    padding: 14,
    color: palette.ink,
    backgroundColor: "#FBFDFF",
    textAlignVertical: "top",
  },
  writtenAnswerHint: {
    color: palette.slate,
    fontSize: 12,
    lineHeight: 18,
  },
  classroomNavigationActions: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  classroomNavigationButton: {
    flexGrow: 1,
    flexBasis: 210,
    marginTop: 0,
  },
  pendingMarkingHint: {
    marginTop: 14,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#EEF7FB",
    color: palette.navy,
    fontWeight: "700",
    lineHeight: 20,
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
  },
  explanationTextContainer: {
    marginTop: 8,
    marginBottom: 14,
  },
  explanationActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  explanationActionButton: {
    flex: 1,
    marginTop: 0,
  },
});

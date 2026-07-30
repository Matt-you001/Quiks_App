import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { BackIconButton } from "../components/BackIconButton";
import { DemoAdBanner } from "../components/DemoAdBanner";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { getDifficultyLabel, t } from "../lib/i18n";
import { calculateQuizTime, getLevelProgressForGrade } from "../lib/quiz";
import {
  clearPendingCompetitionChallenge,
  getPendingCompetitionChallenge,
  syncRemotePushRegistration,
  trackPendingCompetitionChallenge,
} from "../lib/notifications";
import { canJoinCompetitionToday, shouldShowUpgradePrompts } from "../lib/subscription";
import { readAppState } from "../lib/storage";
import { getLocalizedSubjects, getSubjectById, getSubjectDisplayName, getTopicById, grades } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import {
  acceptCompetitionChallenge,
  createCompetitionChallenge,
  decideCompetitionChallengeAsCreator,
  getCompetitionStatus,
  getCompetitionChallengeStatus,
  getCompetitionLeaderboard,
  listCompetitionChallenges,
} from "../services/ai";
import type {
  CompetitionChallengeNotificationDiagnostics,
  CompetitionChallengeStatus,
  CompetitionChallengeSummary,
  CompetitionTopPerformer,
  Difficulty,
  QuestionFocusMode,
  SessionResult,
  SubscriptionTier,
  UserProfile,
} from "../types/app";

type CompetitionScreenMode = "create" | "accept" | "waiting";
type WaitingRole = "creator" | "accepter";

export default function CompetitionScreen() {
  const params = useLocalSearchParams<{ subjectId?: string; grade?: string; challengeId?: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>("free");
  const [screenMode, setScreenMode] = useState<CompetitionScreenMode>("accept");
  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);
  const [acceptingChallengeId, setAcceptingChallengeId] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<CompetitionChallengeSummary[]>([]);
  const [topPerformers, setTopPerformers] = useState<CompetitionTopPerformer[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<CompetitionChallengeSummary | null>(null);
  const [waitingRole, setWaitingRole] = useState<WaitingRole | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(params.subjectId ?? null);
  const [grade, setGrade] = useState(() =>
    typeof params.grade === "string" && grades.includes(params.grade) ? params.grade : grades[0]
  );
  const [focusMode, setFocusMode] = useState<QuestionFocusMode>("general");
  const [topicId, setTopicId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(appVariant.defaultDifficulty);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [levelTouched, setLevelTouched] = useState(false);
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const [isDecidingChallenge, setIsDecidingChallenge] = useState(false);
  const notifiedAcceptedRef = useRef(false);
  const acceptedSoundPlayer = useAudioPlayer(require("../assets/audio/challenge-accepted.wav"));
  const language = profile?.language ?? "en";
  const localizedSubjects = useMemo(() => getLocalizedSubjects(language), [language]);
  const subject = getSubjectById(selectedSubjectId ?? undefined, language) ?? null;
  const setupSubject = subject ?? localizedSubjects[0] ?? null;
  const canJoinMoreCompetitions = canJoinCompetitionToday(subscriptionTier, results);

  useEffect(() => {
    readAppState().then((state) => {
      const current = state.profiles.find((item) => item.id === state.currentProfileId) ?? null;
      setProfile(current);
      setResults(current ? state.results[current.id] ?? [] : []);
      setSubscriptionTier(state.subscriptionTier);
    });
  }, []);

  useEffect(() => {
    if (!profile) {
      return;
    }

    let cancelled = false;

    const loadPendingChallenge = async () => {
      try {
        const pendingChallenge =
          typeof params.challengeId === "string" && params.challengeId
            ? { challengeId: params.challengeId, source: "notification" as const }
            : await getPendingCompetitionChallenge().then((pending) =>
                pending && pending.playerId === profile.id
                  ? { challengeId: pending.challengeId, source: "storage" as const }
                  : null
              );

        if (!pendingChallenge) {
          return;
        }

        const response = await getCompetitionChallengeStatus({
          challengeId: pendingChallenge.challengeId,
          playerId: profile.id,
        });

        if (cancelled) {
          return;
        }

        if (
          response.status === "not_found" ||
          response.status === "declined" ||
          response.status === "cancelled"
        ) {
          await clearPendingCompetitionChallenge();
          return;
        }

        if (response.challenge) {
          setActiveChallenge(response.challenge);
          setWaitingRole(response.challenge.creatorId === profile.id ? "creator" : "accepter");
          setScreenMode("waiting");
        }

        if (response.status === "accepted" && response.competition) {
          router.replace({
            pathname: "/session",
            params: {
              subjectId: response.challenge?.subjectId ?? params.subjectId ?? "",
              grade: response.challenge?.grade ?? params.grade ?? "",
              level: String(response.challenge?.level ?? 1),
              difficulty: response.challenge?.difficulty ?? appVariant.defaultDifficulty,
              focusMode: response.challenge?.focusMode ?? "general",
              topicId: response.challenge?.topicId,
              competitionId: response.competition.competitionId,
              competitionOpponentName: response.competition.opponentName,
              autoStart: "1",
              mode: "quiz",
            },
          });
          return;
        }
      } catch {
        // Leave the screen available for manual refresh from the competition board.
      }
    };

    void loadPendingChallenge();

    return () => {
      cancelled = true;
    };
  }, [params.challengeId, params.grade, params.subjectId, profile]);

  const levelProgress = useMemo(() => {
    if (!setupSubject) {
      return [{ level: 1, isPassed: false, isNextUnlocked: true }];
    }
    return getLevelProgressForGrade(results, setupSubject.id, grade);
  }, [grade, results, setupSubject]);

  useEffect(() => {
    setLevelTouched(false);
  }, [grade, setupSubject?.id]);

  useEffect(() => {
    const availableLevels = levelProgress.map((entry) => entry.level);
    const preferredLevel = availableLevels[availableLevels.length - 1];
    if (availableLevels.length === 0) {
      setSelectedLevel(1);
      return;
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
  }, [levelProgress, levelTouched]);

  useEffect(() => {
    if (!setupSubject) {
      return;
    }

    if (focusMode === "topic") {
      const hasCurrentTopic = topicId && setupSubject.topics.some((topic) => topic.id === topicId);
      if (!hasCurrentTopic) {
        setTopicId(setupSubject.topics[0]?.id ?? null);
      }
      return;
    }

    setTopicId(null);
    setIsTopicDropdownOpen(false);
  }, [focusMode, setupSubject, topicId]);

  const selectedTopic = useMemo(() => getTopicById(setupSubject, topicId ?? undefined), [setupSubject, topicId]);

  useEffect(() => {
    if (screenMode !== "accept" || !profile) {
      return;
    }

    let cancelled = false;
    const tick = async () => {
      try {
        const [challengeResponse, leaderboardResponse] = await Promise.all([
          listCompetitionChallenges({
            playerId: profile.id,
          }),
          getCompetitionLeaderboard({
            playerId: profile.id,
          }),
        ]);
        if (!cancelled) {
          setChallenges(challengeResponse.challenges);
          setTopPerformers(leaderboardResponse.performers);
        }
      } catch {
        // Keep the current list on screen.
      }
    };

    tick();
    const interval = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [profile, screenMode, subject?.id]);

  useEffect(() => {
    if (!profile || screenMode === "waiting") {
      return;
    }

    let cancelled = false;

    const recoverMatchedCompetition = async () => {
      try {
        const response = await getCompetitionStatus({ playerId: profile.id });
        if (cancelled || response.status !== "matched" || !response.competition) {
          return;
        }

        const pendingChallenge = await getPendingCompetitionChallenge();
        if (cancelled || !pendingChallenge) {
          return;
        }

        await clearPendingCompetitionChallenge();
        router.replace({
          pathname: "/session",
          params: {
            subjectId: pendingChallenge.subjectId,
            grade: pendingChallenge.grade,
            level: pendingChallenge.level,
            difficulty: pendingChallenge.difficulty,
            focusMode: pendingChallenge.focusMode,
            topicId: pendingChallenge.topicId,
            competitionId: response.competition.competitionId,
            competitionOpponentName: response.competition.opponentName,
            autoStart: "1",
            mode: "quiz",
          },
        });
      } catch {
        // If recovery fails, the normal competition screen stays available.
      }
    };

    void recoverMatchedCompetition();

    return () => {
      cancelled = true;
    };
  }, [profile, screenMode]);

  useEffect(() => {
    if (screenMode !== "waiting" || !profile || !activeChallenge) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await getCompetitionChallengeStatus({
          challengeId: activeChallenge.challengeId,
          playerId: profile.id,
        });

        if (response.challenge) {
          setActiveChallenge(response.challenge);
        }

        if (response.status === "awaiting_creator_confirmation") {
          return;
        }

        if (response.status === "accepted" && response.competition) {
          await clearPendingCompetitionChallenge();
          if (!notifiedAcceptedRef.current) {
            notifiedAcceptedRef.current = true;
            try {
              acceptedSoundPlayer.seekTo(0);
              acceptedSoundPlayer.play();
            } catch {
              // Keep the acceptance notification visible even if audio fails.
            }
            Alert.alert(t(language, "challengeAccepted"));
          }

          router.replace({
            pathname: "/session",
            params: {
              subjectId: activeChallenge.subjectId,
              grade: activeChallenge.grade,
              level: String(activeChallenge.level),
              difficulty: activeChallenge.difficulty,
              focusMode: activeChallenge.focusMode,
              topicId: activeChallenge.topicId,
              competitionId: response.competition.competitionId,
              competitionOpponentName: response.competition.opponentName,
              autoStart: "1",
              mode: "quiz",
            },
          });
          return;
        }

        if (response.status === "declined" || response.status === "cancelled" || response.status === "not_found") {
          await clearPendingCompetitionChallenge();
          setActiveChallenge(null);
          setWaitingRole(null);
          setScreenMode("accept");
          Alert.alert("Challenge cancelled", "This challenge will not continue.");
        }
      } catch {
        // Stay on the waiting page.
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeChallenge, language, profile, screenMode]);

  const createChallenge = async () => {
    if (!profile || !setupSubject) {
      return;
    }
    if (!canJoinMoreCompetitions) {
      Alert.alert(t(language, "competitionArena"), t(language, "freeCompetitionLimitReached"), [
        { text: t(language, "cancel"), style: "cancel" },
        { text: t(language, "upgradeToPro"), onPress: () => router.push({ pathname: "/subscription", params: { source: "competition" } } as never) },
      ]);
      return;
    }

    setIsCreatingChallenge(true);
    try {
      await syncRemotePushRegistration();
      const response = await createCompetitionChallenge({
        subject: setupSubject,
        grade,
        level: selectedLevel,
        difficulty,
        focusMode,
        topicId: selectedTopic?.id,
        topicLabel: selectedTopic?.label,
        profile,
        durationSeconds: calculateQuizTime(selectedLevel),
      });
      notifiedAcceptedRef.current = false;
      setActiveChallenge(response.challenge);
      setWaitingRole("creator");
      await trackPendingCompetitionChallenge({
        challengeId: response.challenge.challengeId,
        playerId: profile.id,
        playerLanguage: language,
        subjectId: response.challenge.subjectId,
        grade: response.challenge.grade,
        level: String(response.challenge.level),
        difficulty: response.challenge.difficulty,
        focusMode: response.challenge.focusMode,
        topicId: response.challenge.topicId,
      });
      setScreenMode("waiting");
      Alert.alert(t(language, "challengeCreated"), t(language, "challengeCreatedHint"));
    } finally {
      setIsCreatingChallenge(false);
    }
  };

  const acceptChallenge = async (challenge: CompetitionChallengeSummary) => {
    if (!profile) {
      return;
    }
    if (!canJoinMoreCompetitions) {
      Alert.alert(t(language, "competitionArena"), t(language, "freeCompetitionLimitReached"), [
        { text: t(language, "cancel"), style: "cancel" },
        { text: t(language, "upgradeToPro"), onPress: () => router.push({ pathname: "/subscription", params: { source: "competition" } } as never) },
      ]);
      return;
    }

    setAcceptingChallengeId(challenge.challengeId);
    try {
      const response = await acceptCompetitionChallenge({
        challengeId: challenge.challengeId,
        playerId: profile.id,
        profile,
      });
      setActiveChallenge(response.challenge);
      setWaitingRole("accepter");
      setScreenMode("waiting");
      Alert.alert("Challenge accepted", `Waiting for ${challenge.creatorName} to confirm and start the competition.`);
    } finally {
      setAcceptingChallengeId(null);
    }
  };

  const decideAsCreator = async (decision: "accept" | "decline") => {
    if (!profile || !activeChallenge) {
      return;
    }

    setIsDecidingChallenge(true);
    try {
      const response = await decideCompetitionChallengeAsCreator({
        challengeId: activeChallenge.challengeId,
        playerId: profile.id,
        decision,
      });

      if (decision === "decline" || response.status === "declined" || response.status === "cancelled") {
        await clearPendingCompetitionChallenge();
        setActiveChallenge(null);
        setWaitingRole(null);
        setScreenMode("accept");
        Alert.alert("Challenge cancelled", "You declined the challenge, so the competition has been cancelled.");
        return;
      }

      if (response.competition) {
        await clearPendingCompetitionChallenge();
        router.replace({
          pathname: "/session",
          params: {
            subjectId: activeChallenge.subjectId,
            grade: activeChallenge.grade,
            level: String(activeChallenge.level),
            difficulty: activeChallenge.difficulty,
            focusMode: activeChallenge.focusMode,
            topicId: activeChallenge.topicId,
            competitionId: response.competition.competitionId,
            competitionOpponentName: response.competition.opponentName,
            autoStart: "1",
            mode: "quiz",
          },
        });
      }
    } finally {
      setIsDecidingChallenge(false);
    }
  };

  const getWaitingBody = (challenge: CompetitionChallengeSummary, status: CompetitionChallengeStatus, role: WaitingRole | null) => {
    if (status === "awaiting_creator_confirmation" && role === "creator") {
      return `${challenge.acceptedByName ?? "Another learner"} accepted your challenge. Accept to start the competition in 10 seconds, or decline to cancel it.`;
    }

    if (status === "awaiting_creator_confirmation" && role === "accepter") {
      return `Waiting for ${challenge.creatorName} to confirm your challenge before the competition begins.`;
    }

    return t(language, "waitingForAcceptance");
  };

  const getPushDiagnostics = (
    challenge: CompetitionChallengeSummary,
    role: WaitingRole | null
  ): CompetitionChallengeNotificationDiagnostics | null => {
    if (role === "creator") {
      return challenge.creatorNotification ?? null;
    }

    if (role === "accepter") {
      return challenge.accepterNotification ?? null;
    }

    return null;
  };

  const formatPushDiagnosticText = (
    diagnostics: CompetitionChallengeNotificationDiagnostics | null,
    role: WaitingRole | null
  ) => {
    if (!diagnostics) {
      return null;
    }

    const target = role === "creator" ? "creator" : "accepter";

    switch (diagnostics.lastStatus) {
      case "sent":
        return `Push alert sent to the ${target} device.`;
      case "sending":
        return `Sending push alert to the ${target} device...`;
      case "not_registered":
        return `No registered push device was found for the ${target}. Open the app on that learner and allow notifications.`;
      case "failed":
        return diagnostics.lastError
          ? `Push delivery failed: ${diagnostics.lastError}`
          : `Push delivery failed for the ${target} device.`;
      case "pending":
      default:
        return "Push diagnostics are waiting for the next competition update.";
    }
  };

  if (!profile) {
    return (
      <AppBackground>
        <View style={styles.card}>
          <Text style={styles.title}>{t(language, "chooseLearner")}</Text>
          <Text style={styles.text}>{t(language, "pickLearnerFirst")}</Text>
          <PrimaryButton label={t(language, "backHome")} onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  const subjectSelector = (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{appVariant.curriculumSingular === "course" ? "Course" : "Subject"}</Text>
      <View style={styles.choiceWrap}>
        {screenMode === "accept" ? (
          <Pressable
            key="all-subjects"
            onPress={() => setSelectedSubjectId(null)}
            style={[styles.choiceChip, !subject ? styles.choiceChipActive : null]}
          >
            <Text style={[styles.choiceText, !subject ? styles.choiceTextActive : null]}>{t(language, "competitionArena")}</Text>
          </Pressable>
        ) : null}
        {localizedSubjects.map((entry) => (
          <Pressable
            key={entry.id}
            onPress={() => setSelectedSubjectId(entry.id)}
            style={[styles.choiceChip, subject?.id === entry.id ? styles.choiceChipActive : null]}
          >
            <Text style={[styles.choiceText, subject?.id === entry.id ? styles.choiceTextActive : null]}>{entry.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  if (screenMode === "waiting" && activeChallenge) {
    const waitingStatus = activeChallenge.status ?? "open";
    const creatorMustConfirm = waitingStatus === "awaiting_creator_confirmation" && waitingRole === "creator";
    const pushDiagnostics = getPushDiagnostics(activeChallenge, waitingRole);
    const pushDiagnosticText = formatPushDiagnosticText(pushDiagnostics, waitingRole);

    return (
      <AppBackground>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>{creatorMustConfirm ? t(language, "challengeAccepted") : t(language, "challengeCreated")}</Text>
          <Text style={styles.title}>{getSubjectDisplayName(activeChallenge.subjectId, activeChallenge.subjectName, language)}</Text>
          <Text style={styles.heroText}>{getWaitingBody(activeChallenge, waitingStatus, waitingRole)}</Text>
          <Text style={styles.heroText}>
            {activeChallenge.grade} | {t(language, "levelLabel")} {activeChallenge.level} | {getDifficultyLabel(language, activeChallenge.difficulty)}
          </Text>
          {pushDiagnosticText ? (
            <View style={styles.diagnosticsCard}>
              <Text style={styles.diagnosticsTitle}>Push diagnostics</Text>
              <Text
                style={[
                  styles.diagnosticsText,
                  pushDiagnostics?.lastStatus === "failed" || pushDiagnostics?.lastStatus === "not_registered"
                    ? styles.diagnosticsTextWarning
                    : null,
                ]}
              >
                {pushDiagnosticText}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.actionColumn}>
          {creatorMustConfirm ? (
            <>
              <PrimaryButton label="Start Competition" onPress={() => decideAsCreator("accept")} loading={isDecidingChallenge} />
              <PrimaryButton label="Decline Challenge" variant="secondary" onPress={() => decideAsCreator("decline")} disabled={isDecidingChallenge} />
            </>
          ) : null}
          <PrimaryButton label={t(language, "backHome")} variant="ghost" onPress={() => router.replace("/")} disabled={isDecidingChallenge} />
        </View>
      </AppBackground>
    );
  }

  if (screenMode === "accept") {
    return (
      <AppBackground>
        <BackIconButton fallbackHref="/" />
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>{t(language, "challengeBoard")}</Text>
          <Text style={styles.title}>{t(language, "competitionArena")}</Text>
          <Text style={styles.heroText}>{t(language, "challengeBoardHint")}</Text>
        </View>

        <View style={styles.topActionRow}>
          <PrimaryButton
            label={t(language, "createChallenge")}
            onPress={() => {
              if (!selectedSubjectId && localizedSubjects[0]) {
                setSelectedSubjectId(localizedSubjects[0].id);
              }
              setScreenMode("create");
            }}
            style={styles.topActionButton}
            disabled={!canJoinMoreCompetitions}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t(language, "topPerformers")}</Text>
          <Text style={styles.text}>{t(language, "topPerformersHint")}</Text>
          {topPerformers.length > 0 ? (
            <View style={styles.performerList}>
              {topPerformers.map((performer, index) => (
                <View key={performer.playerId} style={styles.performerRow}>
                  <View style={styles.performerRankBadge}>
                    <Text style={styles.performerRankText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.performerMeta}>
                    <Text style={styles.performerName}>{performer.playerName}</Text>
                    <Text style={styles.performerWins}>{t(language, "dailyWins", { count: performer.wins })}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.text}>{t(language, "noTopPerformersYet")}</Text>
          )}
        </View>

        {shouldShowUpgradePrompts(subscriptionTier) ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t(language, "currentPlan")}</Text>
            <Text style={styles.text}>{t(language, "freeCompetitionLimitReached")}</Text>
            <PrimaryButton
              label={t(language, "upgradeToPro")}
              variant="secondary"
              onPress={() => router.push({ pathname: "/subscription" } as never)}
            />
          </View>
        ) : null}

        {subscriptionTier === "free" ? <DemoAdBanner language={language} /> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t(language, "openChallenges")}</Text>
          {challenges.length > 0 ? (
            <View style={styles.challengeList}>
              {challenges.map((challenge) => (
                <View key={challenge.challengeId} style={styles.challengeCard}>
                  <Text style={styles.challengeTitle}>{challenge.creatorName}</Text>
                  <Text style={styles.challengeMeta}>
                    {getSubjectDisplayName(challenge.subjectId, challenge.subjectName, language)} | {challenge.grade} | {t(language, "levelLabel")} {challenge.level}
                  </Text>
                  <Text style={styles.challengeMeta}>
                    {getDifficultyLabel(language, challenge.difficulty)} | {challenge.topicLabel ?? t(language, "generalMixedPractice")}
                  </Text>
                  <PrimaryButton
                    label={t(language, "acceptChallenge")}
                    variant="secondary"
                    onPress={() => acceptChallenge(challenge)}
                    loading={acceptingChallengeId === challenge.challengeId}
                    disabled={!canJoinMoreCompetitions}
                  />
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.text}>{t(language, "noChallengesAvailable")}</Text>
          )}
        </View>

        <View style={styles.actionColumn}>
          <PrimaryButton label={t(language, "backHome")} variant="ghost" onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  if (screenMode === "create" && setupSubject) {
    return (
      <AppBackground>
        <BackIconButton fallbackHref="/" />
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>{t(language, "createChallenge")}</Text>
          <Text style={styles.title}>{setupSubject.name}</Text>
          <Text style={styles.heroText}>{t(language, "createChallengeHint")}</Text>
        </View>

        {subjectSelector}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t(language, "grade")}</Text>
          <View style={styles.choiceWrap}>
            {grades.slice(0, 8).map((entry) => (
              <Pressable key={entry} onPress={() => setGrade(entry)} style={[styles.choiceChip, grade === entry ? styles.choiceChipActive : null]}>
                <Text style={[styles.choiceText, grade === entry ? styles.choiceTextActive : null]}>{entry}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t(language, "questionFocus")}</Text>
          <View style={styles.choiceWrap}>
            <Pressable onPress={() => setFocusMode("general")} style={[styles.choiceChip, focusMode === "general" ? styles.choiceChipActive : null]}>
              <Text style={[styles.choiceText, focusMode === "general" ? styles.choiceTextActive : null]}>{t(language, "general")}</Text>
            </Pressable>
            <Pressable onPress={() => setFocusMode("topic")} style={[styles.choiceChip, focusMode === "topic" ? styles.choiceChipActive : null]}>
              <Text style={[styles.choiceText, focusMode === "topic" ? styles.choiceTextActive : null]}>
                {appVariant.id === "uni" ? t(language, "specialized") : t(language, "topicFocus")}
              </Text>
            </Pressable>
          </View>

          {focusMode === "topic" ? (
            <>
              <Text style={styles.sectionTitle}>{t(language, "chooseTopic")}</Text>
              <Pressable onPress={() => setIsTopicDropdownOpen((value) => !value)} style={[styles.dropdownTrigger, isTopicDropdownOpen ? styles.dropdownTriggerActive : null]}>
                <View style={styles.dropdownTextWrap}>
                  <Text style={styles.dropdownLabel}>{selectedTopic?.label ?? t(language, "selectTopic")}</Text>
                  <Text style={styles.dropdownHint}>{t(language, "topicPickerHint")}</Text>
                </View>
                <MaterialCommunityIcons name={isTopicDropdownOpen ? "chevron-up" : "chevron-down"} size={24} color={palette.navy} />
              </Pressable>
              {isTopicDropdownOpen ? (
                <View style={styles.dropdownMenu}>
                  <ScrollView nestedScrollEnabled style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                    {setupSubject.topics.map((topic) => (
                      <Pressable
                        key={topic.id}
                        onPress={() => {
                          setTopicId(topic.id);
                          setIsTopicDropdownOpen(false);
                        }}
                        style={[styles.dropdownItem, topic.id === topicId ? styles.dropdownItemActive : null]}
                      >
                        <Text style={[styles.dropdownItemTitle, topic.id === topicId ? styles.dropdownItemTitleActive : null]}>{topic.label}</Text>
                        <Text style={[styles.dropdownItemText, topic.id === topicId ? styles.dropdownItemTextActive : null]}>{topic.description}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t(language, "unlockedLevels")}</Text>
          <Text style={styles.text}>{t(language, "highestUnlockedSelected", { grade })}</Text>
          <View style={styles.choiceWrap}>
            {levelProgress.map((entry) => (
              <Pressable
                key={`${grade}-challenge-level-${entry.level}`}
                onPress={() => {
                  setLevelTouched(true);
                  setSelectedLevel(entry.level);
                }}
                style={[styles.levelChip, selectedLevel === entry.level ? styles.choiceChipActive : null]}
              >
                <Text style={[styles.choiceText, selectedLevel === entry.level ? styles.choiceTextActive : null]}>
                  {t(language, "levelLabel")} {entry.level}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t(language, "difficulty")}</Text>
          <View style={styles.choiceWrap}>
            {(["Beginner", "Intermediate", "Advanced", "Expert"] as Difficulty[]).map((entry) => (
              <Pressable key={entry} onPress={() => setDifficulty(entry)} style={[styles.choiceChip, difficulty === entry ? styles.choiceChipActive : null]}>
                <Text style={[styles.choiceText, difficulty === entry ? styles.choiceTextActive : null]}>{getDifficultyLabel(language, entry)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.actionColumn}>
          <PrimaryButton
            label={t(language, "createChallenge")}
            onPress={createChallenge}
            loading={isCreatingChallenge}
            disabled={!canJoinMoreCompetitions}
          />
          <PrimaryButton
            label={t(language, "acceptChallenge")}
            variant="secondary"
            onPress={() => {
              setSelectedSubjectId(null);
              setScreenMode("accept");
            }}
            disabled={isCreatingChallenge}
          />
          <PrimaryButton label={t(language, "backHome")} variant="ghost" onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  heroCard: {
    marginTop: 12,
    borderRadius: 30,
    padding: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  eyebrow: {
    color: "#D5F0FB",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    marginTop: 10,
    color: palette.white,
    fontSize: 30,
    fontWeight: "900",
  },
  heroText: {
    marginTop: 10,
    color: "#EAF6FC",
    lineHeight: 22,
  },
  diagnosticsCard: {
    marginTop: 14,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    gap: 6,
  },
  diagnosticsTitle: {
    color: palette.white,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  diagnosticsText: {
    color: "#EAF6FC",
    lineHeight: 20,
  },
  diagnosticsTextWarning: {
    color: "#FFE3A8",
  },
  card: {
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: palette.white,
    padding: 18,
    ...shadows.card,
  },
  topActionRow: {
    marginTop: 18,
    alignItems: "flex-start",
  },
  topActionButton: {
    minWidth: 190,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },
  text: {
    color: palette.slate,
    lineHeight: 22,
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  levelChip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F2F5F8",
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
  challengeList: {
    gap: 12,
  },
  challengeCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#F7FBFD",
    borderWidth: 1,
    borderColor: "#DFE8F0",
    gap: 8,
  },
  challengeTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  performerList: {
    gap: 10,
    marginTop: 14,
  },
  performerRow: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#F7FBFD",
    borderWidth: 1,
    borderColor: "#DFE8F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  performerRankBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.navy,
  },
  performerRankText: {
    color: palette.white,
    fontWeight: "900",
  },
  performerMeta: {
    flex: 1,
  },
  performerName: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  performerWins: {
    color: palette.slate,
    marginTop: 4,
    lineHeight: 20,
  },
  challengeMeta: {
    color: palette.slate,
    lineHeight: 20,
  },
  actionColumn: {
    gap: 12,
    marginTop: 18,
  },
});

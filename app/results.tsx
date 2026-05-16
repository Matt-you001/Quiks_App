import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { DemoAdBanner } from "../components/DemoAdBanner";
import { PrimaryButton } from "../components/PrimaryButton";
import { canShowAds, showInterstitialAd } from "../lib/ads";
import { getSubjectPassStreak, shouldOfferBreather } from "../lib/breathers";
import { t } from "../lib/i18n";
import { calculateQuizTime } from "../lib/quiz";
import { hasProAccess } from "../lib/subscription";
import { readAppState } from "../lib/storage";
import { getSubjectById, SCORE_THRESHOLD } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import {
  acceptCompetitionRematch,
  getCompetitionRematchStatus,
  requestCompetitionRematch,
} from "../services/ai";
import type { AppLanguage, CompetitionRematchResponse, Difficulty, SessionResult, SubscriptionTier, UserProfile } from "../types/app";

const allowedDifficulties: Difficulty[] = ["Beginner", "Intermediate", "Advanced", "Expert"];

export default function ResultsScreen() {
  const params = useLocalSearchParams<{ result?: string; nextDifficulty?: string }>();
  const [showBreather, setShowBreather] = useState(false);
  const [passStreak, setPassStreak] = useState(0);
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>("free");
  const [rematchState, setRematchState] = useState<CompetitionRematchResponse | null>(null);
  const [isRequestingRematch, setIsRequestingRematch] = useState(false);
  const [isAcceptingRematch, setIsAcceptingRematch] = useState(false);
  const rematchNavigatedRef = useRef(false);

  const result = useMemo(() => {
    if (!params.result || Array.isArray(params.result)) {
      return null;
    }

    try {
      return JSON.parse(params.result) as SessionResult;
    } catch {
      return null;
    }
  }, [params.result]);

  useEffect(() => {
    let cancelled = false;

    if (!result) {
      return () => {
        cancelled = true;
      };
    }

    readAppState().then((state) => {
      if (cancelled) {
        return;
      }

      const currentProfileId = state.currentProfileId;
      const profileResults = currentProfileId ? state.results[currentProfileId] ?? [] : [];
      const profile = state.profiles.find((item) => item.id === currentProfileId) ?? null;
      const streak = getSubjectPassStreak(profileResults, result.subjectId);

      setLanguage(profile?.language ?? "en");
      setProfile(profile);
      setSubscriptionTier(state.subscriptionTier);
      setPassStreak(streak);
      setShowBreather(shouldOfferBreather(profileResults, result));
    });

    return () => {
      cancelled = true;
    };
  }, [result]);

  useEffect(() => {
    if (!result || !canShowAds(subscriptionTier)) {
      return;
    }

    void showInterstitialAd();
  }, [result, subscriptionTier]);

  const passed = result ? result.score >= SCORE_THRESHOLD : false;
  const rematchSubject = result ? getSubjectById(result.subjectId, language) : null;
  const nextDifficulty =
    result && params.nextDifficulty && !Array.isArray(params.nextDifficulty) && allowedDifficulties.includes(params.nextDifficulty as Difficulty)
      ? (params.nextDifficulty as Difficulty)
      : result?.difficulty ?? "Beginner";

  const heading = result ? (passed ? (result.score === 100 ? t(language, "excellentWork") : t(language, "greatJob")) : t(language, "keepTrying")) : t(language, "noResultFound");
  const summary = result && passed
    ? t(language, "passedLevel", { level: result.level, subject: result.topicLabel ?? result.subjectName })
    : result
      ? t(language, "notPassedLevel", { level: result.level, subject: result.topicLabel ?? result.subjectName })
      : "";
  const isCompetition = Boolean(result?.competitionId);
  const canUseRematch = Boolean(
    result?.competitionId &&
      profile &&
      hasProAccess(subscriptionTier) &&
      rematchSubject &&
      result?.competitionOutcome &&
      result.competitionOutcome !== "pending"
  );
  const competitionOutcomeText =
    result?.competitionOutcome === "won"
      ? t(language, "wonCompetition")
      : result?.competitionOutcome === "lost"
        ? t(language, "lostCompetition")
        : result?.competitionOutcome === "draw"
          ? t(language, "drewCompetition")
          : t(language, "waitingOpponentResult");

  useEffect(() => {
    if (!canUseRematch || !result?.competitionId || !profile) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await getCompetitionRematchStatus({
          sourceCompetitionId: result.competitionId!,
          playerId: profile.id,
        });
        if (cancelled) {
          return;
        }
        setRematchState(response);
        if (response.status === "accepted" && response.competition && !rematchNavigatedRef.current) {
          rematchNavigatedRef.current = true;
          router.replace({
            pathname: "/session",
            params: {
              subjectId: result.subjectId,
              grade: result.grade,
              level: String(response.nextLevel ?? result.level + 1),
              difficulty: result.difficulty,
              focusMode: result.focusMode ?? "general",
              topicId: result.topicId,
              competitionId: response.competition.competitionId,
              competitionOpponentName: response.competition.opponentName,
              autoStart: "1",
              mode: "quiz",
            },
          });
        }
      } catch {
        // Keep the results screen stable if rematch status fails.
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [canUseRematch, profile, result]);

  if (!result) {
    return (
      <AppBackground>
        <View style={styles.card}>
          <Text style={styles.title}>{t(language, "noResultFound")}</Text>
          <PrimaryButton label={t(language, "backHome")} onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  const backHome = () => {
    router.replace("/");
  };

  const repeatLevel = () => {
    router.replace({
      pathname: "/session",
      params: {
        subjectId: result.subjectId,
        mode: result.mode,
        level: String(result.level),
        grade: result.grade,
        difficulty: result.difficulty,
        focusMode: result.focusMode ?? "general",
        topicId: result.topicId,
        autoStart: "1",
      },
    });
  };

  const goToNextLevel = () => {
    router.replace({
      pathname: "/session",
      params: {
        subjectId: result.subjectId,
        mode: result.mode,
        level: String(result.level + 1),
        grade: result.grade,
        difficulty: nextDifficulty,
        focusMode: result.focusMode ?? "general",
        topicId: result.topicId,
        autoStart: "1",
      },
    });
  };

  const openBreather = () => {
    router.push({
      pathname: "/breather",
      params: {
        subjectId: result.subjectId,
        subjectName: result.subjectName,
        level: String(result.level),
        grade: result.grade,
        mode: result.mode,
        difficulty: result.difficulty,
        nextDifficulty,
        streak: String(passStreak),
        focusMode: result.focusMode ?? "general",
        topicId: result.topicId,
        topicLabel: result.topicLabel,
      },
    });
  };

  const requestRematch = async () => {
    if (!canUseRematch || !profile || !result.competitionId || !rematchSubject) {
      return;
    }

    setIsRequestingRematch(true);
    try {
      const response = await requestCompetitionRematch({
        sourceCompetitionId: result.competitionId,
        playerId: profile.id,
        subject: rematchSubject,
        grade: result.grade,
        level: result.level + 1,
        difficulty: result.difficulty,
        focusMode: result.focusMode,
        topicId: result.topicId,
        topicLabel: result.topicLabel,
        durationSeconds: calculateQuizTime(result.level + 1),
        profile,
      });
      setRematchState(response);
    } finally {
      setIsRequestingRematch(false);
    }
  };

  const acceptRematch = async () => {
    if (!canUseRematch || !profile || !result.competitionId) {
      return;
    }

    setIsAcceptingRematch(true);
    try {
      const response = await acceptCompetitionRematch({
        sourceCompetitionId: result.competitionId,
        playerId: profile.id,
        profile,
      });
      setRematchState(response);
      if (response.competition) {
        rematchNavigatedRef.current = true;
        router.replace({
          pathname: "/session",
          params: {
            subjectId: result.subjectId,
            grade: result.grade,
            level: String(response.nextLevel ?? result.level + 1),
            difficulty: result.difficulty,
            focusMode: result.focusMode ?? "general",
            topicId: result.topicId,
            competitionId: response.competition.competitionId,
            competitionOpponentName: response.competition.opponentName,
            autoStart: "1",
            mode: "quiz",
          },
        });
      }
    } finally {
      setIsAcceptingRematch(false);
    }
  };

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>{heading}</Text>
        <Text style={styles.heroTitle}>{result.score}%</Text>
        <Text style={styles.heroText}>
          {result.subjectName} | {result.grade} | Level {result.level}
        </Text>
        <Text style={styles.heroText}>{result.topicLabel ? t(language, "topicFocusLabel", { topic: result.topicLabel }) : t(language, "generalMixedPractice")}</Text>
        <Text style={styles.heroSummary}>{summary}</Text>
      </View>

      {passed && showBreather ? (
        <View style={styles.rewardCard}>
          <Text style={styles.rewardEyebrow}>{t(language, "rewardUnlocked")}</Text>
          <Text style={styles.rewardTitle}>{t(language, "takeLearningBreather")}</Text>
          <Text style={styles.rewardText}>
            {t(language, "breatherRewardText", {
              count: passStreak,
              levelWord: passStreak === 1 ? "level" : "levels",
              subject: result.subjectName,
            })}
          </Text>
        </View>
      ) : null}

      {isCompetition ? (
        <View style={styles.card}>
          <Text style={styles.title}>{t(language, "competitionSummary")}</Text>
          <Text style={styles.summaryLine}>
            {t(language, "opponent")}: {result.competitionOpponentName ?? "-"}
          </Text>
          <Text style={styles.summaryLine}>{competitionOutcomeText}</Text>
          <Text style={styles.summaryLine}>
            You: {result.competitionPlayerScore ?? result.score}% in {result.competitionPlayerTimeSeconds ?? result.timeTakenSeconds}s
          </Text>
          {typeof result.competitionOpponentScore === "number" ? (
            <Text style={styles.summaryLine}>
              {result.competitionOpponentName ?? t(language, "opponent")}: {result.competitionOpponentScore}% in{" "}
              {result.competitionOpponentTimeSeconds ?? 0}s
            </Text>
          ) : null}
          {canUseRematch ? (
            <View style={styles.rematchActions}>
              {rematchState?.status === "incoming" ? (
                <>
                  <Text style={styles.rematchHint}>{t(language, "rematchIncoming")}</Text>
                  <PrimaryButton label={t(language, "acceptRematch")} onPress={acceptRematch} loading={isAcceptingRematch} />
                </>
              ) : rematchState?.status === "requested" ? (
                <>
                  <Text style={styles.rematchHint}>{t(language, "waitingRematchAcceptance")}</Text>
                  <PrimaryButton label={t(language, "rematchRequested")} variant="secondary" onPress={() => {}} disabled />
                </>
              ) : (
                <PrimaryButton label={t(language, "requestRematch")} variant="secondary" onPress={requestRematch} loading={isRequestingRematch} />
              )}
            </View>
          ) : isCompetition && !hasProAccess(subscriptionTier) ? (
            <View style={styles.rematchActions}>
              <Text style={styles.rematchHint}>{t(language, "manageSubscription")}</Text>
              <PrimaryButton
                label={t(language, "upgradeToPro")}
                variant="secondary"
                onPress={() => router.push({ pathname: "/subscription" } as never)}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.title}>{t(language, "performanceMessage")}</Text>
        <Text style={styles.feedback}>{result.aiFeedback}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{t(language, "sessionSummary")}</Text>
        <Text style={styles.summaryLine}>
          {t(language, "correctAnswers")}: {result.correctAnswers}/{result.totalQuestions}
        </Text>
        <Text style={styles.summaryLine}>{t(language, "timeUsed")}: {result.timeTakenSeconds}s</Text>
        <Text style={styles.summaryLine}>{t(language, "coinsEarned")}: {result.coinsEarned}</Text>
        <Text style={styles.summaryLine}>{t(language, "mode")}: {result.mode}</Text>
        <Text style={styles.summaryLine}>{t(language, "focus")}: {result.topicLabel ?? t(language, "generalMixedPractice")}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{t(language, "studyPlan")}</Text>
        {result.aiStudyPlan.map((item) => (
          <Text key={item} style={styles.planLine}>
            - {item}
          </Text>
        ))}
      </View>

      {canShowAds(subscriptionTier) ? <DemoAdBanner language={language} /> : null}

      <View style={styles.actionColumn}>
        {passed && showBreather ? <PrimaryButton label={t(language, "takeLearningBreather")} onPress={openBreather} /> : null}
        {passed ? (
          <PrimaryButton
            label={showBreather ? t(language, "skipBreatherAndContinue") : t(language, "nextLevel")}
            variant={showBreather ? "secondary" : "primary"}
            onPress={goToNextLevel}
          />
        ) : null}
        <PrimaryButton label={t(language, "repeatThisLevel")} variant={passed ? "secondary" : "primary"} onPress={repeatLevel} />
        <PrimaryButton label={t(language, "backHome")} variant="ghost" onPress={backHome} />
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginTop: 12,
    borderRadius: 30,
    padding: 24,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroEyebrow: {
    color: "#D5F0FB",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontSize: 12,
    fontWeight: "800",
  },
  heroTitle: {
    color: palette.white,
    fontSize: 56,
    fontWeight: "900",
    marginTop: 12,
  },
  heroText: {
    color: "#E5F5FB",
    marginTop: 8,
    lineHeight: 22,
  },
  heroSummary: {
    color: "#EAF6FC",
    marginTop: 10,
    lineHeight: 22,
    fontSize: 15,
  },
  rewardCard: {
    marginTop: 18,
    backgroundColor: "#FFF4DE",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F2C982",
  },
  rewardEyebrow: {
    color: "#9A6400",
    textTransform: "uppercase",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  rewardTitle: {
    color: "#493000",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 8,
  },
  rewardText: {
    color: "#6A5130",
    marginTop: 10,
    lineHeight: 22,
  },
  card: {
    marginTop: 18,
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 18,
    ...shadows.card,
  },
  title: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
  },
  feedback: {
    color: palette.slate,
    lineHeight: 24,
    fontSize: 16,
  },
  summaryLine: {
    color: palette.slate,
    lineHeight: 24,
  },
  rematchActions: {
    marginTop: 14,
    gap: 10,
  },
  rematchHint: {
    color: palette.slate,
    lineHeight: 22,
  },
  planLine: {
    color: palette.slate,
    lineHeight: 24,
    marginBottom: 6,
  },
  actionColumn: {
    gap: 12,
    marginTop: 18,
  },
});

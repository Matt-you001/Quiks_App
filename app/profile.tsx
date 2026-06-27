import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { BackIconButton } from "../components/BackIconButton";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { signOutAccount } from "../lib/firebase";
import { getLanguageLabel, t } from "../lib/i18n";
import { syncRevenueCatIdentity } from "../lib/revenuecat";
import { canCreateAnotherProfile } from "../lib/subscription";
import { logoutAccount, readAppState } from "../lib/storage";
import { SCORE_THRESHOLD } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import type { SessionResult, UserProfile } from "../types/app";

function getGradeRank(grade: string) {
  const gradeNumber = Number(grade.replace(/[^\d]/g, ""));
  if (Number.isFinite(gradeNumber) && gradeNumber > 0) {
    return gradeNumber;
  }

  if (grade === "High School") {
    return 13;
  }

  if (grade === "University") {
    return 14;
  }

  return 0;
}

function isSameLocalDay(dateIso: string) {
  const now = new Date();
  const value = new Date(dateIso);

  return (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate()
  );
}

function formatResultDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatGoalDuration(totalSeconds: number) {
  if (totalSeconds < 3600) {
    return formatResultDuration(totalSeconds);
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

export default function ProfileScreen() {
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [subscriptionTier, setSubscriptionTier] = useState<"free" | "pro">("free");
  const [profileCount, setProfileCount] = useState(0);

  const load = useCallback(async () => {
    const state = await readAppState();
    if (!state.isAuthenticated) {
      router.replace({ pathname: "/signup" } as never);
      return;
    }
    const profile = state.profiles.find((item) => item.id === state.currentProfileId) ?? null;
    setActiveProfile(profile);
    setResults(profile ? state.results[profile.id] ?? [] : []);
    setSubscriptionTier(state.subscriptionTier);
    setProfileCount(state.profiles.length);
  }, []);

  const handleLogout = async () => {
    await signOutAccount().catch(() => undefined);
    await logoutAccount();
    await syncRevenueCatIdentity(null).catch(() => undefined);
    router.replace({ pathname: "/login" } as never);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const bestScore = results.length > 0 ? `${Math.max(...results.map((result) => result.score))}%` : "0%";
  const language = activeProfile?.language ?? "en";
  const latestPerformance = results[0] ? `${results[0].score}% in ${results[0].subjectName}` : t(language, "noSessionsYet");

  const highestAttainment = useMemo(() => {
    const passedResults = results.filter((result) => result.score >= SCORE_THRESHOLD);
    if (passedResults.length === 0) {
      return { grade: t(language, "notReachedYet"), level: "-" };
    }

    const best = passedResults.reduce((currentBest, result) => {
      if (!currentBest) {
        return result;
      }

      const gradeDiff = getGradeRank(result.grade) - getGradeRank(currentBest.grade);
      if (gradeDiff > 0) {
        return result;
      }

      if (gradeDiff === 0 && result.level > currentBest.level) {
        return result;
      }

      return currentBest;
    }, passedResults[0]);

    return {
      grade: best.grade,
      level: String(best.level),
    };
  }, [language, results]);

  const todaySeconds = results.filter((result) => isSameLocalDay(result.date)).reduce((sum, result) => sum + result.timeTakenSeconds, 0);
  const todayResults = results.filter((result) => isSameLocalDay(result.date));
  const goalMinutes = activeProfile?.dailyGoalMinutes ?? 0;
  const goalSeconds = goalMinutes * 60;
  const competitionResults = results.filter((result) => Boolean(result.competitionId));
  const competitionWins = competitionResults.filter((result) => result.competitionOutcome === "won").length;
  const canCreateMoreProfiles = canCreateAnotherProfile(subscriptionTier, profileCount);
  const isMobile = Platform.OS !== "web";

  const handleDeleteAccount = async () => {
    const deletionUrl = `https://techsolutionproviders.net/account-deletion-quiks.html?variant=${appVariant.id}`;

    Alert.alert(
      t(language, "deleteAccountTitle"),
      t(language, "deleteAccountMessage"),
      [
        {
          text: t(language, "cancel"),
          style: "cancel",
        },
        {
          text: t(language, "openDeletionCenter"),
          onPress: async () => {
            try {
              await Linking.openURL(deletionUrl);
            } catch {
              Alert.alert(t(language, "deleteAccountUnavailableTitle"), t(language, "deleteAccountUnavailableMessage"));
            }
          },
        },
      ]
    );
  };

  let goalFeedback = t(language, "noTargetYet");
  if (activeProfile) {
    if (todaySeconds > goalSeconds) {
      goalFeedback = t(language, "targetExceeded");
    } else if (todaySeconds === goalSeconds) {
      goalFeedback = t(language, "targetReached");
    } else {
      goalFeedback = t(language, "targetNotReached", {
        minutes: Math.ceil(Math.max(goalSeconds - todaySeconds, 0) / 60),
      });
    }
  }

  if (!activeProfile) {
    return (
      <AppBackground>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{t(language, "profileNoSelection")}</Text>
            <Text style={styles.emptyText}>{t(language, "profileCreateOrChoose")}</Text>
            <View style={styles.actionColumn}>
            <PrimaryButton
              label={t(language, "createProfile")}
              onPress={() => router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never)}
            />
            <PrimaryButton label={t(language, "backHome")} variant="ghost" onPress={() => router.replace("/")} />
          </View>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <BackIconButton fallbackHref="/" />
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIdentity}>
            <Text style={styles.heroTitle}>{activeProfile.name}</Text>
            <Text style={styles.heroSubtitle}>
              {t(language, "age")} {activeProfile.age} | {activeProfile.targetExam}
            </Text>
          </View>
        </View>
        <View>
          <Text style={styles.heroText}>{t(language, "dailyTarget")}: {activeProfile.dailyGoalMinutes} minutes</Text>
          <View style={styles.attainmentCard}>
            <Text style={styles.attainmentLabel}>{t(language, "highestAttained")}</Text>
            <Text style={styles.attainmentValue}>{highestAttainment.grade}</Text>
            <Text style={styles.attainmentSubtext}>{t(language, "levelLabel")} {highestAttainment.level}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t(language, "todaysStudyTime")}</Text>
        <Text style={styles.metricHighlight}>
          {formatGoalDuration(todaySeconds)} / {goalMinutes} min
        </Text>
        <Text style={styles.metricText}>{goalFeedback}</Text>
        {todayResults.length > 0 ? (
          <View style={styles.todayHistoryWrap}>
            {todayResults.slice(0, 6).map((result) => (
              <View key={result.id} style={styles.todayHistoryItem}>
                <Text style={styles.todayHistoryTitle}>
                  {result.subjectName} · {result.score}% · {result.grade}
                </Text>
                <Text style={styles.todayHistoryMeta}>
                  {result.mode} · {result.totalQuestions}Q · {formatResultDuration(result.timeTakenSeconds)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.metricText}>{t(language, "noSessionsYet")}</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t(language, "learningRecord")}</Text>
        <Text style={styles.metricText}>{t(language, "bestScore")}: {bestScore}</Text>
        <Text style={styles.metricText}>{t(language, "sessionsCompleted")}: {results.length}</Text>
        <Text style={styles.metricText}>{t(language, "latestScore")}: {latestPerformance}</Text>
      </View>

      {competitionResults.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t(language, "competitionSummary")}</Text>
          <Text style={styles.metricText}>{t(language, "competitionWins")}: {competitionWins}</Text>
          <Text style={styles.metricText}>{t(language, "challengesPlayed")}: {competitionResults.length}</Text>
          {competitionResults.slice(0, 3).map((result) => (
            <Text key={result.id} style={styles.metricText}>
              {result.subjectName}: {result.competitionOutcome ?? "pending"} vs {result.competitionOpponentName ?? "-"} ({result.score}%)
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t(language, "profileDetails")}</Text>
        <Text style={styles.metricText}>{t(language, "targetExam")}: {activeProfile.targetExam}</Text>
        <Text style={styles.metricText}>{t(language, "dailyTarget")}: {activeProfile.dailyGoalMinutes} minutes</Text>
        <Text style={styles.metricText}>{t(language, "currentLanguage")}: {getLanguageLabel(activeProfile.language)}</Text>
        <Text style={styles.metricText}>
          {t(language, "roleLabel")}: {activeProfile.role === "teacher" ? t(language, "teacherRole") : t(language, "studentRole")}
        </Text>
        <Text style={styles.metricText}>{t(language, "quiksIdLabel")}: {activeProfile.quiksId}</Text>
      </View>

      <View style={styles.actionGrid}>
        <PrimaryButton
          label={t(language, "editProfileAction")}
          onPress={() => router.push({ pathname: "/profile-editor", params: { mode: "edit" } } as never)}
          style={styles.gridButton}
          compact
        />
        {activeProfile ? (
          <PrimaryButton
            label={t(language, "classroomTitle")}
            variant="secondary"
            onPress={() => router.push({ pathname: "/classroom" } as never)}
            style={styles.gridButton}
            compact
          />
        ) : null}
        <PrimaryButton
          label={t(language, "subscription")}
          variant="secondary"
          onPress={() => router.push({ pathname: "/subscription" } as never)}
          style={styles.gridButton}
          compact
        />
        <PrimaryButton
          label={t(language, "createProfile")}
          variant="secondary"
          onPress={() =>
            canCreateMoreProfiles
              ? router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never)
              : router.push({ pathname: "/subscription" } as never)
          }
          style={styles.gridButton}
          compact
        />
        <PrimaryButton label={t(language, "logOut")} variant="secondary" onPress={handleLogout} style={styles.gridButton} compact />
        {isMobile ? (
          <PrimaryButton
            label={t(language, "deleteAccount")}
            variant="secondary"
            onPress={handleDeleteAccount}
            style={styles.gridButton}
            compact
          />
        ) : null}
        <PrimaryButton label={t(language, "backHome")} variant="ghost" onPress={() => router.replace("/")} style={styles.gridButton} compact />
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginTop: 12,
    borderRadius: 28,
    padding: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  heroIdentity: {
    flex: 1,
  },
  heroTitle: {
    color: palette.white,
    fontSize: 28,
    fontWeight: "900",
  },
  heroSubtitle: {
    marginTop: 8,
    color: "#E8F4FB",
    lineHeight: 22,
  },
  heroText: {
    marginTop: 16,
    color: "#D8EDF8",
    lineHeight: 22,
  },
  attainmentCard: {
    minWidth: 128,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    padding: 14,
  },
  attainmentLabel: {
    color: "#D5F0FB",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  attainmentValue: {
    color: palette.white,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 8,
  },
  attainmentSubtext: {
    color: "#D8EDF8",
    marginTop: 4,
    fontSize: 13,
  },
  card: {
    marginTop: 18,
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 18,
    ...shadows.card,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
  },
  metricHighlight: {
    color: palette.navy,
    fontSize: 28,
    fontWeight: "900",
  },
  metricText: {
    color: palette.slate,
    lineHeight: 24,
    marginTop: 6,
  },
  todayHistoryWrap: {
    marginTop: 12,
    gap: 10,
  },
  todayHistoryItem: {
    borderRadius: 16,
    backgroundColor: "#F6FAFC",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E3EDF4",
  },
  todayHistoryTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  todayHistoryMeta: {
    marginTop: 4,
    color: palette.slate,
    fontSize: 13,
  },
  emptyCard: {
    marginTop: 30,
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 20,
    ...shadows.card,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 26,
    fontWeight: "800",
  },
  emptyText: {
    color: palette.slate,
    marginTop: 10,
    lineHeight: 22,
  },
  actionColumn: {
    marginTop: 18,
    gap: 12,
  },
  actionGrid: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridButton: {
    flexBasis: "31%",
    flexGrow: 1,
    minWidth: 0,
  },
});

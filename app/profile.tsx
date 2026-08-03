import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { AppBackground } from "../components/AppBackground";
import { BackIconButton } from "../components/BackIconButton";
import { DemoAdBanner } from "../components/DemoAdBanner";
import { PremiumFeatureDialog } from "../components/PremiumFeatureDialog";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { canShowAds } from "../lib/ads";
import { signOutAccount } from "../lib/firebase";
import { getLanguageLabel, t } from "../lib/i18n";
import { syncRevenueCatIdentity } from "../lib/revenuecat";
import { canCreateAnotherProfile } from "../lib/subscription";
import { logoutAccount, readAppState, setCurrentProfile, setSubscriptionTier as storeSubscriptionTier } from "../lib/storage";
import { SCORE_THRESHOLD } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import { getAccountSubscriptionStatus } from "../services/ai";
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

function getLocalDateKey(dateValue: string | Date) {
  const value = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameLocalDay(dateIso: string, targetDateKey?: string) {
  const comparisonDateKey = targetDateKey ?? getLocalDateKey(new Date());
  return getLocalDateKey(dateIso) === comparisonDateKey;
}

function getHistoryLocale(language: string) {
  switch (language) {
    case "fr":
      return "fr-FR";
    case "de":
      return "de-DE";
    case "es":
      return "es-ES";
    case "pt":
      return "pt-PT";
    case "zh":
      return "zh-CN";
    case "ar":
      return "ar-EG";
    case "sw":
      return "sw-KE";
    default:
      return "en-GB";
  }
}

function formatHistoryDayLabel(dateKey: string, language: string) {
  const value = new Date(`${dateKey}T00:00:00`);
  return value.toLocaleDateString(getHistoryLocale(language), {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [subscriptionUpdatedAt, setSubscriptionUpdatedAt] = useState(0);
  const [profileCount, setProfileCount] = useState(0);
  const [premiumPrompt, setPremiumPrompt] = useState<"profiles" | "classroom" | null>(null);

  const load = useCallback(async () => {
    const state = await readAppState();
    if (!state.isAuthenticated) {
      router.replace({ pathname: "/signup" } as never);
      return;
    }
    const profile =
      state.profiles.find((item) => item.id === state.currentProfileId) ??
      state.profiles[0] ??
      null;

    if (profile && profile.id !== state.currentProfileId) {
      await setCurrentProfile(profile.id).catch(() => undefined);
    }

    setActiveProfile(profile);
    setResults(profile ? state.results[profile.id] ?? [] : []);
    setSubscriptionTier(state.subscriptionTier);
    setSubscriptionExpiresAt(state.subscriptionExpiresAt);
    setSubscriptionUpdatedAt(state.subscriptionUpdatedAt);
    setProfileCount(state.profiles.length);

    if (state.account) {
      const refreshSubscription =
        Platform.OS === "web"
          ? getAccountSubscriptionStatus({ accountUid: state.account.uid }).then(async (status) => {
              await storeSubscriptionTier(status.active ? "pro" : "free", status.expiresAt);
            })
          : syncRevenueCatIdentity(state.account).then(() => undefined);

      void refreshSubscription
        .then(async () => {
          const refreshedState = await readAppState();
          setSubscriptionTier(refreshedState.subscriptionTier);
          setSubscriptionExpiresAt(refreshedState.subscriptionExpiresAt);
          setSubscriptionUpdatedAt(refreshedState.subscriptionUpdatedAt);
        })
        .catch(() => undefined);
    }
  }, []);

  const handleLogout = async () => {
    await logoutAccount();
    await signOutAccount().catch(() => undefined);
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
  const [selectedHistoryDay, setSelectedHistoryDay] = useState<string | null>(null);
  const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);

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

  const resultsByDay = useMemo(() => {
    const grouped = new Map<string, SessionResult[]>();

    for (const result of results) {
      const dayKey = getLocalDateKey(result.date);
      const bucket = grouped.get(dayKey) ?? [];
      bucket.push(result);
      grouped.set(dayKey, bucket);
    }

    return Array.from(grouped.entries())
      .map(([dateKey, dayResults]) => ({
        dateKey,
        results: dayResults.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()),
        totalSeconds: dayResults.reduce((sum, result) => sum + result.timeTakenSeconds, 0),
      }))
      .sort((left, right) => right.dateKey.localeCompare(left.dateKey));
  }, [results]);

  const todayDateKey = getLocalDateKey(new Date());
  const availableHistoryDays = useMemo(() => {
    const allDays = new Set(resultsByDay.map((entry) => entry.dateKey));
    allDays.add(todayDateKey);

    return Array.from(allDays).sort((left, right) => right.localeCompare(left));
  }, [resultsByDay, todayDateKey]);

  useEffect(() => {
    const fallbackDay = availableHistoryDays[0] ?? null;

    setSelectedHistoryDay((current) => {
      if (current && availableHistoryDays.includes(current)) {
        return current;
      }

      return fallbackDay;
    });
  }, [availableHistoryDays]);

  const selectedHistory = resultsByDay.find((entry) => entry.dateKey === selectedHistoryDay) ?? null;
  const selectedHistoryLabel = selectedHistoryDay
    ? formatHistoryDayLabel(selectedHistoryDay, language)
    : null;
  const isTodaySelected = !selectedHistoryDay || selectedHistoryDay === todayDateKey;
  const todaySeconds = results
    .filter((result) => isSameLocalDay(result.date, todayDateKey))
    .reduce((sum, result) => sum + result.timeTakenSeconds, 0);
  const displayedResults = selectedHistory?.results ?? [];
  const displayedSeconds = selectedHistory?.totalSeconds ?? 0;
  const goalMinutes = activeProfile?.dailyGoalMinutes ?? 0;
  const goalSeconds = goalMinutes * 60;
  const competitionResults = results.filter((result) => Boolean(result.competitionId));
  const competitionWins = competitionResults.filter((result) => result.competitionOutcome === "won").length;
  const canCreateMoreProfiles = canCreateAnotherProfile(subscriptionTier, profileCount);
  const isMobile = Platform.OS !== "web";
  const subscriptionExpiryLabel = useMemo(() => {
    if (subscriptionTier !== "pro") {
      return null;
    }

    if (!subscriptionExpiresAt) {
      return subscriptionUpdatedAt > 0
        ? t(language, "lifetimeAccess")
        : t(language, "planStatusRefreshing");
    }

    const expiryDate = new Date(subscriptionExpiresAt);
    if (!Number.isFinite(expiryDate.getTime())) {
      return t(language, "planStatusRefreshing");
    }

    return expiryDate.toLocaleDateString(language, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [language, subscriptionExpiresAt, subscriptionTier, subscriptionUpdatedAt]);

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

  const copyQuiksId = async () => {
    if (!activeProfile?.quiksId) {
      return;
    }

    try {
      await Clipboard.setStringAsync(activeProfile.quiksId);
      Alert.alert(t(language, "profileDetails"), `${t(language, "quiksIdLabel")} copied.`);
    } catch {
      Alert.alert(t(language, "profileDetails"), `Unable to copy ${t(language, "quiksIdLabel")}.`);
    }
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
        <View style={styles.historyControls}>
          <Pressable
            onPress={() => setIsHistoryDropdownOpen((current) => !current)}
            style={({ pressed }) => [
              styles.historyDropdown,
              pressed && styles.historyDropdownPressed,
            ]}
          >
            <Text style={styles.historyDropdownLabel}>
              {selectedHistoryLabel ?? t(language, "noSessionsYet")}
            </Text>
            <Text style={styles.historyDropdownChevron}>
              {isHistoryDropdownOpen ? "▲" : "▼"}
            </Text>
          </Pressable>

          {isHistoryDropdownOpen && availableHistoryDays.length > 0 ? (
            <View style={styles.historyDropdownMenu}>
              {availableHistoryDays.map((dateKey) => {
                const isActive = dateKey === selectedHistoryDay;
                return (
                  <Pressable
                    key={dateKey}
                    onPress={() => {
                      setSelectedHistoryDay(dateKey);
                      setIsHistoryDropdownOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.historyDropdownOption,
                      isActive && styles.historyDropdownOptionActive,
                      pressed && styles.historyDropdownOptionPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.historyDropdownOptionText,
                        isActive && styles.historyDropdownOptionTextActive,
                      ]}
                    >
                      {formatHistoryDayLabel(dateKey, language)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
        <Text style={styles.metricHighlight}>
          {formatGoalDuration(displayedSeconds)}{isTodaySelected ? ` / ${goalMinutes} min` : ""}
        </Text>
        <Text style={styles.metricText}>
          {isTodaySelected
            ? goalFeedback
            : t(language, "historyDaySummary", {
                count: displayedResults.length,
                date: selectedHistoryLabel ?? "-",
              })}
        </Text>
        {displayedResults.length > 0 ? (
          <View style={styles.todayHistoryWrap}>
            {displayedResults.slice(0, 8).map((result) => (
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

      {canShowAds(subscriptionTier) ? <DemoAdBanner language={language} format="banner" /> : null}

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
        <Pressable onPress={copyQuiksId} style={styles.copyMetricRow}>
          <Text style={styles.metricText}>{t(language, "quiksIdLabel")}: {activeProfile.quiksId}</Text>
          <Text style={styles.copyMetricAction}>Copy</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t(language, "currentPlan")}</Text>
        <View style={[styles.planBadge, subscriptionTier === "pro" ? styles.planBadgePro : styles.planBadgeFree]}>
          <Text style={[styles.planBadgeText, subscriptionTier === "pro" ? styles.planBadgeTextPro : null]}>
            {subscriptionTier === "pro" ? t(language, "proPlan") : t(language, "freePlan")}
          </Text>
        </View>
        {subscriptionTier === "pro" && subscriptionExpiryLabel ? (
          <Text style={styles.metricText}>
            {t(language, "planExpires")}: {subscriptionExpiryLabel}
          </Text>
        ) : (
          <Text style={styles.metricText}>{t(language, "freePlanStatus")}</Text>
        )}
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
            onPress={() => {
              if (subscriptionTier !== "pro") {
                setPremiumPrompt("classroom");
                return;
              }
              router.push({ pathname: "/classroom" } as never);
            }}
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
          onPress={() => {
            if (!canCreateMoreProfiles) {
              setPremiumPrompt("profiles");
              return;
            }
            router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never);
          }}
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
      <PremiumFeatureDialog
        visible={premiumPrompt !== null}
        title={premiumPrompt === "profiles" ? t(language, "profileLimitReachedTitle") : t(language, "classroomTitle")}
        message={premiumPrompt === "profiles" ? t(language, "profileLimitReachedMessage") : t(language, "classroomProRequired")}
        upgradeLabel={t(language, "upgradeToPro")}
        cancelLabel={t(language, "cancel")}
        onClose={() => setPremiumPrompt(null)}
        onUpgrade={() => {
          const source = premiumPrompt === "classroom" ? "classroom" : "profiles";
          setPremiumPrompt(null);
          router.push({ pathname: "/subscription", params: { source } } as never);
        }}
      />
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
  copyMetricRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  copyMetricAction: {
    color: palette.navy,
    fontSize: 13,
    fontWeight: "800",
  },
  planBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#EEF2F6",
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  planBadgePro: {
    backgroundColor: "#DDF8ED",
  },
  planBadgeFree: {
    backgroundColor: "#EEF2F6",
  },
  planBadgeText: {
    color: palette.slate,
    fontSize: 15,
    fontWeight: "900",
  },
  planBadgeTextPro: {
    color: "#087A55",
  },
  historyControls: {
    marginTop: 12,
    marginBottom: 10,
    position: "relative",
    zIndex: 5,
  },
  historyDropdown: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7E5EF",
    backgroundColor: "#F6FAFC",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyDropdownPressed: {
    opacity: 0.9,
  },
  historyDropdownLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  historyDropdownChevron: {
    color: palette.navy,
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 10,
  },
  historyDropdownMenu: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D7E5EF",
    backgroundColor: palette.white,
    overflow: "hidden",
  },
  historyDropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  historyDropdownOptionActive: {
    backgroundColor: "#EAF5FB",
  },
  historyDropdownOptionPressed: {
    opacity: 0.85,
  },
  historyDropdownOptionText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  historyDropdownOptionTextActive: {
    color: palette.navy,
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

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { DemoAdBanner } from "../components/DemoAdBanner";
import { PrimaryButton } from "../components/PrimaryButton";
import { StatPill } from "../components/StatPill";
import { appVariant } from "../lib/app-variant";
import { getLanguageLabel, t } from "../lib/i18n";
import { canCreateAnotherProfile, shouldShowUpgradePrompts } from "../lib/subscription";
import { readAppState, setCurrentProfile } from "../lib/storage";
import { getLocalizedSubjects, SCORE_THRESHOLD } from "../lib/subjects";
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

export default function HomeScreen() {
  const [authChecked, setAuthChecked] = useState(false);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentProfileId, setCurrentProfileIdState] = useState<string | null>(null);
  const [resultsByProfile, setResultsByProfile] = useState<Record<string, SessionResult[]>>({});
  const [subscriptionTier, setSubscriptionTier] = useState<"free" | "pro">("free");

  const loadData = useCallback(async () => {
    const state = await readAppState();
    if (!state.isAuthenticated) {
      setAuthChecked(true);
      router.replace({ pathname: "/login" } as never);
      return;
    }
    setProfiles(state.profiles);
    setCurrentProfileIdState(state.currentProfileId);
    setResultsByProfile(state.results);
    setSubscriptionTier(state.subscriptionTier);
    setAuthChecked(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === currentProfileId) ?? null,
    [profiles, currentProfileId]
  );

  const activeProfileResults = useMemo(
    () => (activeProfile ? resultsByProfile[activeProfile.id] ?? [] : []),
    [activeProfile, resultsByProfile]
  );
  const language = activeProfile?.language ?? "en";
  const localizedSubjects = useMemo(() => getLocalizedSubjects(language), [language]);

  const highestUnlockedBySubject = useMemo(() => {
    if (!activeProfile) {
      return [];
    }

    return localizedSubjects
      .map((subject) => {
        const passedResults = activeProfileResults.filter(
          (result) => result.subjectId === subject.id && result.score >= SCORE_THRESHOLD
        );

        if (passedResults.length === 0) {
          return null;
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
          subjectId: subject.id,
          subjectName: subject.name,
          grade: best.grade,
          level: best.level + 1,
        };
      })
      .filter((entry): entry is { subjectId: string; subjectName: string; grade: string; level: number } => Boolean(entry))
      .sort((left, right) => {
        const gradeDiff = getGradeRank(right.grade) - getGradeRank(left.grade);
        if (gradeDiff !== 0) {
          return gradeDiff;
        }

        return right.level - left.level;
      });
  }, [activeProfile, activeProfileResults, localizedSubjects]);

  const selectProfile = async (profileId: string) => {
    await setCurrentProfile(profileId);
    setCurrentProfileIdState(profileId);
  };

  const openSubject = (subjectId: string) => {
    if (!activeProfile) {
      router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never);
      return;
    }

    router.push({ pathname: "/subject/[slug]", params: { slug: subjectId } });
  };

  const canCreateMoreProfiles = canCreateAnotherProfile(subscriptionTier, profiles.length);

  if (!authChecked) {
    return (
      <AppBackground>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>{appVariant.appName}</Text>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <Text style={styles.title}>{appVariant.heroTitle}</Text>
        <Text style={styles.audienceBadge}>{appVariant.audienceLabel}</Text>
        <Text style={styles.subtitle}>{appVariant.heroSubtitle}</Text>

        <View style={styles.statRow}>
          <StatPill label={`${appVariant.profileNoun}s`} value={String(profiles.length)} />
          <StatPill label={`Selected ${appVariant.profileNoun}`} value={activeProfile?.name ?? t(language, "noneSelected")} />
        </View>

        <View style={styles.ctaRow}>
          <PrimaryButton
            label={t(language, "homeCreateProfile")}
            onPress={() =>
              canCreateMoreProfiles
                ? router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never)
                : router.push({ pathname: "/subscription" } as never)
            }
            style={styles.flexButton}
          />
          <PrimaryButton
            label={activeProfile ? t(language, "homeOpenProfile") : t(language, "homeChooseLearner")}
            variant="secondary"
            onPress={() => router.push(activeProfile ? "/profile" : "/")}
            style={styles.flexButton}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t(language, "studentsList")}</Text>
        <Text style={styles.cardHint}>{t(language, "selectLearnerPrompt")}</Text>

        {profiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t(language, "noProfilesYet")}</Text>
            <PrimaryButton
              label={t(language, "createFirstLearner")}
              onPress={() => router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never)}
            />
          </View>
        ) : (
          profiles.map((profile) => {
            const profileResults = resultsByProfile[profile.id] ?? [];
            const latest = profileResults[0];
            const isActive = profile.id === currentProfileId;

            return (
              <Pressable
                key={profile.id}
                onPress={() => selectProfile(profile.id)}
                style={[styles.studentRow, isActive ? styles.studentRowActive : null]}
              >
                {isActive ? (
                  <View style={styles.activeIndicator}>
                    <MaterialCommunityIcons name="check-circle" size={18} color={palette.white} />
                  </View>
                ) : null}

                <View style={styles.studentAvatar}>
                  <Text style={styles.studentAvatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
                </View>

                <View style={styles.studentMeta}>
                  <Text style={styles.studentName}>{profile.name}</Text>
                  <Text style={styles.studentSubtext}>
                    {t(language, "age")} {profile.age} | {profile.targetExam}
                  </Text>
                  <Text style={styles.studentSubtext}>
                    {latest
                      ? `${t(language, "lastActivity")}: ${latest.subjectName} Level ${latest.level} (${latest.score}%)`
                      : t(language, "noSessionsYet")}
                  </Text>
                  <Text style={styles.studentSubtext}>
                    {t(language, "currentLanguage")}: {getLanguageLabel(profile.language)}
                  </Text>
                </View>

                <View style={[styles.studentBadge, isActive ? styles.studentBadgeActive : null]}>
                  <Text style={[styles.studentBadgeText, isActive ? styles.studentBadgeTextActive : null]}>
                    {isActive ? t(language, "selected") : t(language, "select")}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>

      <View style={[styles.activeLearnerCard, !activeProfile ? styles.activeLearnerCardMuted : null]}>
        <View style={styles.activeLearnerHeader}>
          <Text style={styles.activeLearnerEyebrow}>{t(language, "currentLearner")}</Text>
          {activeProfile ? (
            <View style={styles.activeLearnerBadge}>
              <MaterialCommunityIcons name="account-check-outline" size={16} color={palette.white} />
              <Text style={styles.activeLearnerBadgeText}>{t(language, "ready")}</Text>
            </View>
          ) : null}
        </View>

        {activeProfile ? (
          <>
            <Text style={styles.activeLearnerName}>{activeProfile.name}</Text>
            <Text style={styles.activeLearnerText}>
              {t(language, "age")} {activeProfile.age} | {activeProfile.targetExam}
            </Text>
            <Text style={styles.progressTitle}>{t(language, "highestUnlockedBySubject")}</Text>
            {highestUnlockedBySubject.length > 0 ? (
              <View style={styles.progressWrap}>
                {highestUnlockedBySubject.map((entry) => (
                  <View key={entry.subjectId} style={styles.progressChip}>
                    <Text style={styles.progressChipTitle}>{entry.subjectName}</Text>
                    <Text style={styles.progressChipText}>
                      {entry.grade} | {t(language, "levelLabel")} {entry.level}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.activeLearnerText}>{t(language, "noUnlockedProgressYet")}</Text>
            )}
          </>
        ) : (
          <>
            <Text style={styles.activeLearnerName}>{t(language, "noStudentSelected")}</Text>
            <Text style={styles.activeLearnerText}>
              {t(language, "pickLearnerFirst")}
            </Text>
          </>
        )}
      </View>

      {appVariant.id !== "children" ? (
        <View style={styles.homeActionColumn}>
          <PrimaryButton
            label="Classroom"
            variant="secondary"
            onPress={() =>
              activeProfile
                ? router.push("/classroom" as never)
                : router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never)
            }
          />
          <PrimaryButton
            label={t(language, "enterCompetition")}
            onPress={() =>
              activeProfile
                ? router.push("/competition" as never)
                : router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never)
            }
            style={styles.homeCompetitionButton}
          />
        </View>
      ) : null}

      {shouldShowUpgradePrompts(subscriptionTier) ? (
        <View style={styles.subscriptionCard}>
          <Text style={styles.homeCompetitionTitle}>{t(language, "currentPlan")}</Text>
          <Text style={styles.homeCompetitionText}>
            {subscriptionTier === "pro" ? t(language, "proPlanStatus") : t(language, "freePlanStatus")}
          </Text>
          <PrimaryButton
            label={t(language, "upgradeToPro")}
            variant="secondary"
            onPress={() => router.push({ pathname: "/subscription" } as never)}
          />
        </View>
      ) : null}

      {subscriptionTier === "free" && appVariant.id !== "children" ? <DemoAdBanner language={language} /> : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{appVariant.curriculumPlural}</Text>
        <Text style={styles.sectionHint}>
          {activeProfile
            ? t(language, "subjectsHintSelected", { name: activeProfile.name, item: appVariant.curriculumSingular })
            : t(language, "subjectsHintUnselected", { item: appVariant.curriculumSingular })}
        </Text>
      </View>

      <View style={styles.subjectGrid}>
        {localizedSubjects.map((subject) => (
          <Pressable key={subject.id} onPress={() => openSubject(subject.id)} style={styles.subjectPressable}>
            <LinearGradient colors={subject.accent} style={[styles.subjectCard, !activeProfile ? styles.subjectCardDim : null]}>
              <MaterialCommunityIcons name={subject.icon as never} size={28} color={palette.white} />
              <Text style={styles.subjectName}>{subject.name}</Text>
              <Text style={styles.subjectTagline}>{subject.tagline}</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    marginTop: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: palette.white,
    fontSize: 22,
    fontWeight: "800",
  },
  heroCard: {
    marginTop: 12,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: 22,
  },
  title: {
    color: palette.white,
    fontSize: 42,
    fontWeight: "900",
    marginTop: 10,
  },
  subtitle: {
    color: "#E9F4FA",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  audienceBadge: {
    alignSelf: "flex-start",
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    color: palette.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 18,
  },
  ctaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  flexButton: {
    flex: 1,
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
    fontSize: 22,
    fontWeight: "800",
  },
  cardHint: {
    color: palette.slate,
    marginTop: 8,
    lineHeight: 22,
  },
  emptyState: {
    marginTop: 16,
    gap: 12,
  },
  emptyText: {
    color: palette.slate,
  },
  studentRow: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DEE7EF",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    position: "relative",
  },
  studentRowActive: {
    backgroundColor: "#EAF7FD",
    borderColor: "#7CCFE7",
    borderWidth: 2,
  },
  activeIndicator: {
    position: "absolute",
    top: -8,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.success,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: palette.white,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  studentAvatarText: {
    color: palette.white,
    fontSize: 18,
    fontWeight: "800",
  },
  studentMeta: {
    flex: 1,
  },
  studentName: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  studentSubtext: {
    color: palette.slate,
    marginTop: 4,
    lineHeight: 20,
  },
  studentBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#EEF3F7",
  },
  studentBadgeActive: {
    backgroundColor: palette.navy,
  },
  studentBadgeText: {
    color: palette.navy,
    fontWeight: "700",
    fontSize: 12,
  },
  studentBadgeTextActive: {
    color: palette.white,
  },
  activeLearnerCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#EAF7FD",
    borderWidth: 1,
    borderColor: "#9CDCF2",
  },
  activeLearnerCardMuted: {
    backgroundColor: "#F3F6F9",
    borderColor: "#D9E2EA",
  },
  activeLearnerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activeLearnerEyebrow: {
    color: palette.navy,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  activeLearnerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: palette.navy,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeLearnerBadgeText: {
    color: palette.white,
    fontWeight: "700",
    fontSize: 12,
  },
  activeLearnerName: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 10,
  },
  activeLearnerText: {
    color: palette.slate,
    marginTop: 6,
    lineHeight: 22,
  },
  progressTitle: {
    color: palette.navy,
    marginTop: 14,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  progressWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  progressChip: {
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.68)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 132,
  },
  progressChipTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  progressChipText: {
    color: palette.slate,
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  homeCompetitionButton: {
    marginTop: 0,
  },
  homeActionColumn: {
    marginTop: 18,
    gap: 12,
  },
  subscriptionCard: {
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: palette.white,
    padding: 18,
    ...shadows.card,
  },
  homeCompetitionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  homeCompetitionText: {
    color: palette.slate,
    marginTop: 8,
    marginBottom: 14,
    lineHeight: 22,
  },
  sectionHeader: {
    marginTop: 26,
    marginBottom: 14,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 26,
    fontWeight: "800",
  },
  sectionHint: {
    color: palette.slate,
    marginTop: 4,
    fontSize: 15,
  },
  subjectGrid: {
    gap: 14,
  },
  subjectPressable: {
    borderRadius: 26,
  },
  subjectCard: {
    borderRadius: 26,
    padding: 18,
    minHeight: 152,
    ...shadows.card,
  },
  subjectCardDim: {
    opacity: 0.75,
  },
  subjectName: {
    color: palette.white,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 16,
  },
  subjectTagline: {
    color: "rgba(255,255,255,0.88)",
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
  },
});

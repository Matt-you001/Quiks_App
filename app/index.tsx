import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { Fragment, useCallback, useMemo, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { DemoAdBanner } from "../components/DemoAdBanner";
import { PremiumFeatureDialog } from "../components/PremiumFeatureDialog";
import { PrimaryButton } from "../components/PrimaryButton";
import { StatPill } from "../components/StatPill";
import { appVariant } from "../lib/app-variant";
import { canShowAds } from "../lib/ads";
import { readClassroomInvitationCodeFromLocation } from "../lib/classroom-invite";
import { getLanguageLabel, t } from "../lib/i18n";
import { syncRemotePushRegistration } from "../lib/notifications";
import { canCreateAnotherProfile, canUseClassroom } from "../lib/subscription";
import { readAppState, setCurrentProfile } from "../lib/storage";
import { getLocalizedSubjects, SCORE_THRESHOLD } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import { readWebCheckoutIntentFromLocation } from "../lib/web-checkout";
import type { SessionResult, UserProfile } from "../types/app";

const heroLogos = {
  children: require("../assets/images/quiks-children-playstore-icon-512.png"),
  teens: require("../assets/images/quiks-teens-playstore-icon-512.png"),
  uni: require("../assets/images/quiks-uni-playstore-icon-512.png"),
} as const;

function getVariantAudienceLabel(language: string) {
  if (language === "fr") {
    if (appVariant.id === "children") return "Ages 5 a 12 ans";
    if (appVariant.id === "teens") return "Ages 11 a 20 ans";
    return "Tertiaire et universite";
  }

  if (language === "es") {
    if (appVariant.id === "children") return "Edades 5 a 12";
    if (appVariant.id === "teens") return "Edades 11 a 20";
    return "Terciario y universidad";
  }

  if (language === "pt") {
    if (appVariant.id === "children") return "Idades 5 a 12";
    if (appVariant.id === "teens") return "Idades 11 a 20";
    return "Ensino superior e universidade";
  }

  if (language === "sw") {
    if (appVariant.id === "children") return "Umri wa miaka 5 hadi 12";
    if (appVariant.id === "teens") return "Umri wa miaka 11 hadi 20";
    return "Taasisi ya juu na chuo kikuu";
  }

  if (language === "zh") {
    if (appVariant.id === "children") return "5至12岁";
    if (appVariant.id === "teens") return "11至20岁";
    return "高等及大学";
  }

  if (language === "ar") {
    if (appVariant.id === "children") return "من 5 إلى 12 سنة";
    if (appVariant.id === "teens") return "من 11 إلى 20 سنة";
    return "التعليم العالي والجامعة";
  }

  if (language === "de") {
    if (appVariant.id === "children") return "Alter 5 bis 12";
    if (appVariant.id === "teens") return "Alter 11 bis 20";
    return "Tertiar und Universitat";
  }

  return appVariant.audienceLabel;
}

function getVariantHeroSubtitle(language: string) {
  if (language === "fr") {
    if (appVariant.id === "children") {
      return "Une application lumineuse pour les jeunes apprenants avec une pratique guidee, un suivi par profil et un accompagnement rassurant.";
    }
    if (appVariant.id === "teens") {
      return "Une pratique orientee examens pour les collegiens et lyceens avec des exercices plus pousses, des revisions ciblees et un meilleur suivi.";
    }
    return "Un appui avance pour les etudiants du superieur avec une pratique ciblee, une generation de questions par IA et de meilleurs flux academiques.";
  }

  if (language === "es") {
    if (appVariant.id === "children") {
      return "Una app de aprendizaje clara para ninos con practica guiada, progreso por perfil y apoyo amigable.";
    }
    if (appVariant.id === "teens") {
      return "Practica orientada a examenes para secundaria y college con ejercicios mas profundos, repaso enfocado y mejor seguimiento.";
    }
    return "Apoyo avanzado para estudiantes terciarios con practica enfocada, generacion de preguntas con IA y mejores flujos academicos.";
  }

  if (language === "pt") {
    if (appVariant.id === "children") {
      return "Um app de aprendizagem acolhedor para criancas com pratica guiada, progresso por perfil e apoio amigavel.";
    }
    if (appVariant.id === "teens") {
      return "Pratica pronta para exames para alunos do secundario e college com exercicios mais profundos, revisao focada e melhor acompanhamento.";
    }
    return "Suporte avancado para estudantes do ensino superior com pratica focada, geracao de questoes por IA e fluxos academicos mais fortes.";
  }

  if (language === "sw") {
    if (appVariant.id === "children") {
      return "Programu rafiki ya kujifunza kwa watoto yenye mazoezi ya kuongozwa, maendeleo ya wasifu na msaada wa karibu.";
    }
    if (appVariant.id === "teens") {
      return "Mazoezi ya kujiandaa kwa mitihani kwa wanafunzi wa sekondari na college yenye majaribio ya kina, marudio maalum na ufuatiliaji bora.";
    }
    return "Msaada wa juu kwa wanafunzi wa taasisi za juu wenye mazoezi yaliyolengwa, utengenezaji wa maswali kwa AI na mtiririko imara wa kitaaluma.";
  }

  return appVariant.heroSubtitle;
}

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
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const [authChecked, setAuthChecked] = useState(false);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentProfileId, setCurrentProfileIdState] = useState<string | null>(null);
  const [resultsByProfile, setResultsByProfile] = useState<Record<string, SessionResult[]>>({});
  const [subscriptionTier, setSubscriptionTier] = useState<"free" | "pro">("free");
  const [premiumPrompt, setPremiumPrompt] = useState<"profiles" | "classroom" | null>(null);

  const loadData = useCallback(async () => {
    const state = await readAppState({ awaitCloudRefresh: true });
    const webCheckout = readWebCheckoutIntentFromLocation();
    const classroomJoinCode = readClassroomInvitationCodeFromLocation();
    if (!state.isAuthenticated) {
      setAuthChecked(true);
      router.replace(
        webCheckout.checkout
          ? ({
              pathname: "/signup",
              params: {
                redirect: "subscription",
                ...(webCheckout.plan ? { plan: webCheckout.plan } : {}),
              },
            } as never)
          : ({ pathname: "/signup" } as never)
      );
      return;
    }

    if (webCheckout.checkout) {
      setAuthChecked(true);
      router.replace(
        webCheckout.plan
          ? ({ pathname: "/subscription", params: { plan: webCheckout.plan } } as never)
          : ({ pathname: "/subscription" } as never)
      );
      return;
    }

    const resolvedProfileId =
      state.currentProfileId && state.profiles.some((profile) => profile.id === state.currentProfileId)
        ? state.currentProfileId
        : state.profiles[0]?.id ?? null;

    setProfiles(state.profiles);
    setCurrentProfileIdState(resolvedProfileId);
    setResultsByProfile(state.results);
    setSubscriptionTier(state.subscriptionTier);
    setAuthChecked(true);
    if (classroomJoinCode) {
      if (canUseClassroom(state.subscriptionTier)) {
        router.replace({ pathname: "/classroom", params: { joinCode: classroomJoinCode } } as never);
      } else {
        setPremiumPrompt("classroom");
      }
    }
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
  const selectedProfileLabel = activeProfile?.name ?? t(language, "noneSelected");
  const heroAudienceLabel = getVariantAudienceLabel(language);
  const heroSubtitle = getVariantHeroSubtitle(language);
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
    setCurrentProfileIdState(profileId);
    await setCurrentProfile(profileId);
    await syncRemotePushRegistration();
  };

  const openSubject = (subjectId: string) => {
    if (!activeProfile) {
      router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never);
      return;
    }

    router.push({ pathname: "/subject/[slug]", params: { slug: subjectId } });
  };

  const canCreateMoreProfiles = canCreateAnotherProfile(subscriptionTier, profiles.length);
  const subjectColumns = width >= 1420 ? 5 : width >= 1120 ? 4 : width >= 820 ? 3 : width >= 560 ? 2 : 1;
  const subjectGap = 14;
  const desktopCanvasWidth = isWeb ? Math.max(width - 40, 320) : Math.min(Math.max(width - 40, 320), 1200);
  const subjectCardWidth =
    subjectColumns === 1
      ? desktopCanvasWidth
      : Math.floor((desktopCanvasWidth - subjectGap * (subjectColumns - 1)) / subjectColumns);
  const showWideActions = width >= 900;

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
    <AppBackground webContentWidth="wide">
      <View style={[styles.heroCard, isWeb ? styles.heroCardWeb : null, isWeb ? styles.homeSurfaceWeb : null]}>
        {!isWeb ? <Image source={heroLogos[appVariant.id]} style={styles.heroLogo} resizeMode="cover" /> : null}
        <Text style={[styles.title, isWeb ? styles.titleWeb : null]}>{appVariant.heroTitle}</Text>
        <Text style={styles.audienceBadge}>{heroAudienceLabel}</Text>
        <Text style={styles.subtitle}>{heroSubtitle}</Text>

        <View style={styles.statRow}>
          <StatPill label={`${appVariant.profileNoun}s`} value={String(profiles.length)} />
          <StatPill label={t(language, "currentLearner")} value={selectedProfileLabel} />
        </View>

        <View style={styles.ctaRow}>
          <PrimaryButton
            label={t(language, "homeCreateProfile")}
            onPress={() => {
              if (!canCreateMoreProfiles) {
                setPremiumPrompt("profiles");
                return;
              }
              router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never);
            }}
            style={styles.flexButton}
          />
          <PrimaryButton
            label={activeProfile ? t(language, "homeOpenProfile") : t(language, "homeChooseLearner")}
            variant="secondary"
            onPress={async () => {
              if (activeProfile) {
                await setCurrentProfile(activeProfile.id);
                setCurrentProfileIdState(activeProfile.id);
                await syncRemotePushRegistration();
                router.push("/profile");
                return;
              }

              router.push("/");
            }}
            style={styles.flexButton}
          />
        </View>
      </View>

      {canShowAds(subscriptionTier) ? <DemoAdBanner language={language} format="banner" /> : null}

      <View style={[styles.card, isWeb ? styles.homeSurfaceWeb : null]}>
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

      <View
        style={[
          styles.activeLearnerCard,
          !activeProfile ? styles.activeLearnerCardMuted : null,
          isWeb ? styles.homeSurfaceWeb : null,
        ]}
      >
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

      <View
        style={[
          styles.homeActionColumn,
          showWideActions ? styles.homeActionRowDesktop : null,
          isWeb ? styles.homeSurfaceWeb : null,
        ]}
      >
        <PrimaryButton
          label={canUseClassroom(subscriptionTier) ? "Classroom" : "Classroom"}
          variant="secondary"
          onPress={() => {
            if (!canUseClassroom(subscriptionTier)) {
              setPremiumPrompt("classroom");
              return;
            }

            activeProfile
              ? router.push("/classroom" as never)
              : router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never);
          }}
          style={showWideActions ? styles.homeActionButtonDesktop : undefined}
        />
        <PrimaryButton
          label={t(language, "competitionArena")}
          onPress={() =>
            activeProfile
              ? router.push("/competition" as never)
              : router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never)
          }
          style={showWideActions ? styles.homeActionButtonDesktop : styles.homeCompetitionButton}
        />
        <PrimaryButton
          label={t(language, "learningHub")}
          variant="secondary"
          onPress={() => router.push("/learning-hub" as never)}
          style={showWideActions ? styles.homeActionButtonDesktop : undefined}
        />
        <PrimaryButton
          label="Quiks School"
          variant="secondary"
          onPress={() => router.push("/school" as never)}
          style={showWideActions ? styles.homeActionButtonDesktop : undefined}
        />
      </View>

      {subscriptionTier === "free" ? (
        <View style={[styles.subscriptionCard, isWeb ? styles.homeSurfaceWeb : null]}>
          <Text style={styles.homeCompetitionTitle}>{t(language, "currentPlan")}</Text>
          <Text style={styles.homeCompetitionText}>{t(language, "freePlanStatus")}</Text>
          <PrimaryButton
            label={t(language, "upgradeToPro")}
            variant="secondary"
            onPress={() => router.push({ pathname: "/subscription" } as never)}
          />
        </View>
      ) : null}

      {canShowAds(subscriptionTier) ? <DemoAdBanner language={language} format="banner" /> : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{appVariant.curriculumPlural}</Text>
        <Text style={styles.sectionHint}>
          {activeProfile
            ? t(language, "subjectsHintSelected", { name: activeProfile.name, item: appVariant.curriculumSingular })
            : t(language, "subjectsHintUnselected", { item: appVariant.curriculumSingular })}
        </Text>
      </View>

      <View style={styles.subjectGrid}>
        {localizedSubjects.map((subject, subjectIndex) => (
          <Fragment key={subject.id}>
            <Pressable
              onPress={() => openSubject(subject.id)}
              style={[styles.subjectPressable, { width: subjectCardWidth }, isWeb ? styles.subjectPressableWeb : null]}
            >
              <LinearGradient colors={subject.accent} style={[styles.subjectCard, !activeProfile ? styles.subjectCardDim : null]}>
                <MaterialCommunityIcons name={subject.icon as never} size={28} color={palette.white} />
                <Text style={styles.subjectName}>{subject.name}</Text>
                <Text style={styles.subjectTagline}>{subject.tagline}</Text>
              </LinearGradient>
            </Pressable>
            {!isWeb && canShowAds(subscriptionTier) && subjectIndex === Math.floor((localizedSubjects.length - 1) / 2) ? (
              <View style={styles.subjectAdSlot}>
                <DemoAdBanner language={language} format="banner" />
              </View>
            ) : null}
          </Fragment>
        ))}
      </View>
      <PremiumFeatureDialog
        visible={premiumPrompt !== null}
        title={premiumPrompt === "profiles" ? t(language, "profileLimitReachedTitle") : t(language, "classroomTitle")}
        message={premiumPrompt === "profiles" ? t(language, "profileLimitReachedMessage") : t(language, "classroomProRequired")}
        upgradeLabel={t(language, "upgradeToPro")}
        cancelLabel={t(language, "cancel")}
        showUpgradeAction={premiumPrompt !== "profiles" || subscriptionTier !== "pro"}
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
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: 22,
  },
  heroCardWeb: {
    paddingTop: 12,
  },
  heroLogo: {
    width: 120,
    height: 120,
    borderRadius: 28,
    marginBottom: 18,
  },
  title: {
    color: palette.white,
    fontSize: 42,
    fontWeight: "900",
  },
  titleWeb: {
    marginTop: -2,
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
  homeActionRowDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  homeActionButtonDesktop: {
    flex: 1,
  },
  subscriptionCard: {
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: palette.white,
    padding: 18,
    ...shadows.card,
  },
  homeSurfaceWeb: {
    width: "100%",
    maxWidth: 576,
    alignSelf: "center",
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  subjectAdSlot: {
    width: "100%",
  },
  subjectPressable: {
    borderRadius: 26,
  },
  subjectPressableWeb: {
    flexGrow: 1,
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

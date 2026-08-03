import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { DemoAdBanner } from "../components/DemoAdBanner";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { canShowAds } from "../lib/ads";
import { getBreatherContent } from "../lib/breathers";
import { t } from "../lib/i18n";
import { readAppState } from "../lib/storage";
import { getSubjectById } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import { generateBreather } from "../services/ai";
import type { AppLanguage, BreatherContent, Difficulty, SubscriptionTier, TestMode, UserProfile } from "../types/app";

const allowedDifficulties: Difficulty[] = ["Beginner", "Intermediate", "Advanced", "Expert"];

export default function BreatherScreen() {
  const params = useLocalSearchParams<{
    subjectId?: string;
    subjectName?: string;
    level?: string;
    grade?: string;
    mode?: TestMode;
    difficulty?: Difficulty;
    nextDifficulty?: string;
    streak?: string;
    focusMode?: "general" | "topic";
    topicId?: string;
    topicLabel?: string;
  }>();

  const level = Number(params.level ?? 1);
  const streak = Number(params.streak ?? 0);
  const mode: TestMode = params.mode === "training" ? "training" : "quiz";
  const difficulty =
    params.difficulty && allowedDifficulties.includes(params.difficulty) ? params.difficulty : "Beginner";
  const nextDifficulty =
    params.nextDifficulty && !Array.isArray(params.nextDifficulty) && allowedDifficulties.includes(params.nextDifficulty as Difficulty)
      ? (params.nextDifficulty as Difficulty)
      : difficulty;
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>("free");

  useEffect(() => {
    readAppState().then((state) => {
      const profile = state.profiles.find((item) => item.id === state.currentProfileId) ?? null;
      setLanguage(profile?.language ?? "en");
      setProfile(profile);
      setSubscriptionTier(state.subscriptionTier);
    });
  }, []);
  const resolvedSubject = getSubjectById(params.subjectId, language);
  const subject = resolvedSubject ?? (params.subjectName ? { name: params.subjectName } : null);

  if (!params.subjectId || !subject) {
    return (
      <AppBackground>
        <View style={styles.card}>
          <Text style={styles.title}>{t(language, "breatherNotAvailable")}</Text>
          <PrimaryButton label={t(language, "backHome")} onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  const fallbackContent = getBreatherContent(params.subjectId, level, streak, language);
  const [content, setContent] = useState<BreatherContent | null>(null);
  const heroEyebrow =
    appVariant.id === "uni" ? t(language, "studyBreather") : appVariant.id === "teens" ? t(language, "revisionBreather") : t(language, "learningBreather");

  useEffect(() => {
    if (!params.subjectId || !resolvedSubject || !profile) {
      setContent(fallbackContent);
      return;
    }

    let cancelled = false;
    setContent(fallbackContent);

    generateBreather({
      subject: resolvedSubject,
      grade: typeof params.grade === "string" ? params.grade : "Unknown",
      level,
      streak,
      mode,
      difficulty,
      focusMode: params.focusMode === "topic" ? "topic" : "general",
      topicId: typeof params.topicId === "string" ? params.topicId : undefined,
      topicLabel: typeof params.topicLabel === "string" ? params.topicLabel : undefined,
      profile,
    })
      .then((nextContent) => {
        if (!cancelled) {
          setContent(nextContent);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContent(fallbackContent);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    difficulty,
    fallbackContent,
    level,
    mode,
    params.focusMode,
    params.grade,
    params.subjectId,
    params.topicId,
    params.topicLabel,
    profile,
    streak,
    resolvedSubject,
  ]);

  const continueLearning = () => {
    router.replace({
      pathname: "/session",
      params: {
        subjectId: params.subjectId,
        mode,
        level: String(level + 1),
        grade: params.grade,
        difficulty: nextDifficulty,
        focusMode: params.focusMode,
        topicId: params.topicId,
        autoStart: "1",
      },
    });
  };

  const repeatLevel = () => {
    router.replace({
      pathname: "/session",
      params: {
        subjectId: params.subjectId,
        mode,
        level: String(level),
        grade: params.grade,
        difficulty,
        focusMode: params.focusMode,
        topicId: params.topicId,
        autoStart: "1",
      },
    });
  };

  if (!content) {
    return (
      <AppBackground>
        <View style={styles.card}>
          <Text style={styles.title}>{heroEyebrow}</Text>
          <Text style={styles.bodyText}>{t(language, "preparingSession")}</Text>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>{heroEyebrow}</Text>
        <Text style={styles.heroTitle}>{content.title}</Text>
        <Text style={styles.heroText}>
          {subject.name} | {t(language, "levelLabel")} {level} {t(language, "completedLabel")}
        </Text>
        <Text style={styles.heroText}>{content.intro}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{content.formatLabel ?? t(language, "storyLabel")}</Text>
        <Text style={styles.bodyText}>{content.story}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t(language, "quickTakeaways")}</Text>
        {content.facts.map((item) => (
          <Text key={item} style={styles.factLine}>
            - {item}
          </Text>
        ))}
      </View>

      {canShowAds(subscriptionTier) ? <DemoAdBanner language={language} format="banner" /> : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{content.teachingTitle ?? t(language, "whatThisTeaches")}</Text>
        <Text style={styles.bodyText}>{content.teachingPoint ?? content.reflection}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t(language, "reflection")}</Text>
        <Text style={styles.bodyText}>{content.reflection}</Text>
      </View>

      <View style={styles.actionColumn}>
        <PrimaryButton label={content.continueLabel ?? t(language, "continueLearning")} onPress={continueLearning} />
        <PrimaryButton label={t(language, "repeatThisLevel")} variant="secondary" onPress={repeatLevel} />
        <PrimaryButton label={t(language, "backHome")} variant="ghost" onPress={() => router.replace("/")} />
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
    fontSize: 32,
    fontWeight: "900",
    marginTop: 10,
    lineHeight: 38,
  },
  heroText: {
    color: "#EAF6FC",
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
    fontSize: 28,
    fontWeight: "800",
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
  },
  bodyText: {
    color: palette.slate,
    lineHeight: 24,
    fontSize: 16,
  },
  factLine: {
    color: palette.slate,
    lineHeight: 24,
    marginBottom: 8,
  },
  actionColumn: {
    gap: 12,
    marginTop: 18,
  },
});

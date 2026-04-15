import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { StatPill } from "../components/StatPill";
import { getProfileResults, readAppState } from "../lib/storage";
import { subjects } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import type { SessionResult, UserProfile } from "../types/app";

export default function HomeScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);

  const loadData = useCallback(async () => {
    const state = await readAppState();
    const activeProfile = state.profiles.find((item) => item.id === state.currentProfileId) ?? null;
    setProfile(activeProfile);
    if (activeProfile) {
      setResults(await getProfileResults(activeProfile.id));
    } else {
      setResults([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const totalCoins = results.reduce((sum, result) => sum + result.coinsEarned, 0);
  const bestScore = results[0] ? `${Math.max(...results.map((result) => result.score))}%` : "0%";

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>AI-powered learning, rebuilt for mobile</Text>
        <Text style={styles.title}>Quiks</Text>
        <Text style={styles.subtitle}>
          A faster, native study app for Android with adaptive quizzes, progress tracking, and an AI coach.
        </Text>

        <View style={styles.statRow}>
          <StatPill label="Active learner" value={profile?.name ?? "Guest"} />
          <StatPill label="Best score" value={bestScore} />
          <StatPill label="Coins" value={String(totalCoins)} />
        </View>

        <View style={styles.ctaRow}>
          <PrimaryButton
            label={profile ? "Manage profile" : "Create profile"}
            onPress={() => router.push("/profile")}
            style={styles.flexButton}
          />
          <PrimaryButton
            label="AI coach"
            variant="secondary"
            onPress={() => router.push("/profile")}
            style={styles.flexButton}
          />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Subjects</Text>
        <Text style={styles.sectionHint}>Tap a subject to choose mode and start learning.</Text>
      </View>

      <View style={styles.subjectGrid}>
        {subjects.map((subject) => (
          <Pressable
            key={subject.id}
            onPress={() => router.push({ pathname: "/subject/[slug]", params: { slug: subject.id } })}
            style={styles.subjectPressable}
          >
            <LinearGradient colors={subject.accent} style={styles.subjectCard}>
              <MaterialCommunityIcons name={subject.icon as never} size={28} color={palette.white} />
              <Text style={styles.subjectName}>{subject.name}</Text>
              <Text style={styles.subjectTagline}>{subject.tagline}</Text>
              <Text style={styles.subjectDescription}>{subject.description}</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </View>

      <View style={styles.aiPanel}>
        <Text style={styles.aiPanelTitle}>AI Integration Path</Text>
        <Text style={styles.aiPanelText}>
          Quiks now uses a native AI service layer. In demo mode it generates testable content locally, and when you
          connect a secure backend endpoint it can serve real questions, feedback, and study plans without exposing API
          secrets inside the app.
        </Text>
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginTop: 12,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: 22,
  },
  eyebrow: {
    color: "#C6E8F8",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontSize: 12,
    fontWeight: "700",
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
  subjectDescription: {
    color: "rgba(255,255,255,0.88)",
    marginTop: 10,
    lineHeight: 20,
  },
  aiPanel: {
    marginTop: 26,
    borderRadius: 24,
    backgroundColor: palette.white,
    padding: 20,
    ...shadows.card,
  },
  aiPanelTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  aiPanelText: {
    color: palette.slate,
    marginTop: 10,
    lineHeight: 22,
  },
});

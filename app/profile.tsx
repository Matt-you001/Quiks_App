import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { readAppState } from "../lib/storage";
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

export default function ProfileScreen() {
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);

  const load = useCallback(async () => {
    const state = await readAppState();
    const profile = state.profiles.find((item) => item.id === state.currentProfileId) ?? null;
    setActiveProfile(profile);
    setResults(profile ? state.results[profile.id] ?? [] : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const bestScore = results.length > 0 ? `${Math.max(...results.map((result) => result.score))}%` : "0%";
  const latestPerformance = results[0] ? `${results[0].score}% in ${results[0].subjectName}` : "No sessions yet";

  const highestAttainment = useMemo(() => {
    const passedResults = results.filter((result) => result.score >= SCORE_THRESHOLD);
    if (passedResults.length === 0) {
      return { grade: "Not reached yet", level: "-" };
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
  }, [results]);

  const todaySeconds = results.filter((result) => isSameLocalDay(result.date)).reduce((sum, result) => sum + result.timeTakenSeconds, 0);
  const todayMinutes = Math.round(todaySeconds / 60);
  const goalMinutes = activeProfile?.dailyGoalMinutes ?? 0;

  let goalFeedback = "No study target available yet.";
  if (activeProfile) {
    if (todayMinutes > goalMinutes) {
      goalFeedback = "Daily target exceeded. Excellent consistency today.";
    } else if (todayMinutes === goalMinutes) {
      goalFeedback = "Daily target reached. Well done.";
    } else {
      goalFeedback = `Daily target not reached yet. ${Math.max(goalMinutes - todayMinutes, 0)} minute(s) to go.`;
    }
  }

  if (!activeProfile) {
    return (
      <AppBackground>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No student selected</Text>
            <Text style={styles.emptyText}>Create a profile first or return home and choose a learner.</Text>
            <View style={styles.actionColumn}>
            <PrimaryButton
              label="Create profile"
              onPress={() => router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never)}
            />
            <PrimaryButton label="Back Home" variant="ghost" onPress={() => router.replace("/")} />
          </View>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIdentity}>
            <Text style={styles.heroTitle}>{activeProfile.name}</Text>
            <Text style={styles.heroSubtitle}>
              Age {activeProfile.age} | {activeProfile.targetExam}
            </Text>
          </View>
        </View>
        <View>
          <Text style={styles.heroText}>Goal: {activeProfile.dailyGoalMinutes} minutes</Text>
          <View style={styles.attainmentCard}>
            <Text style={styles.attainmentLabel}>Highest attained</Text>
            <Text style={styles.attainmentValue}>{highestAttainment.grade}</Text>
            <Text style={styles.attainmentSubtext}>Level {highestAttainment.level}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today&apos;s study time</Text>
        <Text style={styles.metricHighlight}>
          {todayMinutes} min / {goalMinutes} min
        </Text>
        <Text style={styles.metricText}>{goalFeedback}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Learning record</Text>
        <Text style={styles.metricText}>Best score: {bestScore}</Text>
        <Text style={styles.metricText}>Sessions completed: {results.length}</Text>
        <Text style={styles.metricText}>Latest score: {latestPerformance}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile details</Text>
        <Text style={styles.metricText}>Target exam: {activeProfile.targetExam}</Text>
        <Text style={styles.metricText}>Daily target: {activeProfile.dailyGoalMinutes} minutes</Text>
      </View>

      <View style={styles.actionColumn}>
        <PrimaryButton label="Edit Profile" onPress={() => router.push({ pathname: "/profile-editor", params: { mode: "edit" } } as never)} />
        <PrimaryButton
          label="Create Another Profile"
          variant="secondary"
          onPress={() => router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never)}
        />
        <PrimaryButton label="Back Home" variant="ghost" onPress={() => router.replace("/")} />
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
});

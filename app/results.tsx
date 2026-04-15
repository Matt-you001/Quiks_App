import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { SCORE_THRESHOLD } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import type { Difficulty, SessionResult } from "../types/app";

const allowedDifficulties: Difficulty[] = ["Beginner", "Intermediate", "Advanced", "Expert"];

export default function ResultsScreen() {
  const params = useLocalSearchParams<{ result?: string; nextDifficulty?: string }>();

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

  if (!result) {
    return (
      <AppBackground>
        <View style={styles.card}>
          <Text style={styles.title}>No result found</Text>
          <PrimaryButton label="Back Home" onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  const passed = result.score >= SCORE_THRESHOLD;
  const nextDifficulty =
    params.nextDifficulty && !Array.isArray(params.nextDifficulty) && allowedDifficulties.includes(params.nextDifficulty as Difficulty)
      ? (params.nextDifficulty as Difficulty)
      : result.difficulty;

  const heading = passed ? (result.score === 100 ? "Excellent work" : "Great job") : "Keep trying";
  const summary = passed
    ? `You passed Level ${result.level} in ${result.subjectName}.`
    : `You did not pass Level ${result.level} yet, but you can improve with another try.`;

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
        autoStart: "1",
      },
    });
  };

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>{heading}</Text>
        <Text style={styles.heroTitle}>{result.score}%</Text>
        <Text style={styles.heroText}>
          {result.subjectName} | {result.grade} | Level {result.level}
        </Text>
        <Text style={styles.heroSummary}>{summary}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Performance message</Text>
        <Text style={styles.feedback}>{result.aiFeedback}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Session summary</Text>
        <Text style={styles.summaryLine}>
          Correct answers: {result.correctAnswers}/{result.totalQuestions}
        </Text>
        <Text style={styles.summaryLine}>Time used: {result.timeTakenSeconds}s</Text>
        <Text style={styles.summaryLine}>Coins earned: {result.coinsEarned}</Text>
        <Text style={styles.summaryLine}>Mode: {result.mode}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Study plan</Text>
        {result.aiStudyPlan.map((item) => (
          <Text key={item} style={styles.planLine}>
            • {item}
          </Text>
        ))}
      </View>

      <View style={styles.actionColumn}>
        {passed ? <PrimaryButton label="Next Level" onPress={goToNextLevel} /> : null}
        <PrimaryButton label="Repeat" variant={passed ? "secondary" : "primary"} onPress={repeatLevel} />
        <PrimaryButton label="Back Home" variant="ghost" onPress={backHome} />
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

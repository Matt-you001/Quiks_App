import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { getBreatherContent } from "../lib/breathers";
import { getSubjectById } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import type { Difficulty, TestMode } from "../types/app";

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
  }>();

  const subject = getSubjectById(params.subjectId) ?? (params.subjectName ? { name: params.subjectName } : null);
  const level = Number(params.level ?? 1);
  const streak = Number(params.streak ?? 0);
  const mode: TestMode = params.mode === "training" ? "training" : "quiz";
  const difficulty =
    params.difficulty && allowedDifficulties.includes(params.difficulty) ? params.difficulty : "Beginner";
  const nextDifficulty =
    params.nextDifficulty && !Array.isArray(params.nextDifficulty) && allowedDifficulties.includes(params.nextDifficulty as Difficulty)
      ? (params.nextDifficulty as Difficulty)
      : difficulty;

  if (!params.subjectId || !subject) {
    return (
      <AppBackground>
        <View style={styles.card}>
          <Text style={styles.title}>Breather not available</Text>
          <PrimaryButton label="Back Home" onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  const content = getBreatherContent(params.subjectId, level, streak);

  const continueLearning = () => {
    router.replace({
      pathname: "/session",
      params: {
        subjectId: params.subjectId,
        mode,
        level: String(level + 1),
        grade: params.grade,
        difficulty: nextDifficulty,
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
        autoStart: "1",
      },
    });
  };

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Learning breather</Text>
        <Text style={styles.heroTitle}>{content.title}</Text>
        <Text style={styles.heroText}>
          {subject.name} | Level {level} completed
        </Text>
        <Text style={styles.heroText}>{content.intro}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{content.formatLabel ?? "Story"}</Text>
        <Text style={styles.bodyText}>{content.story}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Quick takeaways</Text>
        {content.facts.map((item) => (
          <Text key={item} style={styles.factLine}>
            • {item}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{content.teachingTitle ?? "What this teaches"}</Text>
        <Text style={styles.bodyText}>{content.teachingPoint ?? content.reflection}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Reflection</Text>
        <Text style={styles.bodyText}>{content.reflection}</Text>
      </View>

      <View style={styles.actionColumn}>
        <PrimaryButton label={content.continueLabel ?? "Continue learning"} onPress={continueLearning} />
        <PrimaryButton label="Repeat This Level" variant="secondary" onPress={repeatLevel} />
        <PrimaryButton label="Back Home" variant="ghost" onPress={() => router.replace("/")} />
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

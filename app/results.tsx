import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { getSubjectPassStreak, shouldOfferBreather } from "../lib/breathers";
import { readAppState } from "../lib/storage";
import { SCORE_THRESHOLD } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import type { Difficulty, SessionResult } from "../types/app";

const allowedDifficulties: Difficulty[] = ["Beginner", "Intermediate", "Advanced", "Expert"];

export default function ResultsScreen() {
  const params = useLocalSearchParams<{ result?: string; nextDifficulty?: string }>();
  const [showBreather, setShowBreather] = useState(false);
  const [passStreak, setPassStreak] = useState(0);

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
      const streak = getSubjectPassStreak(profileResults, result.subjectId);

      setPassStreak(streak);
      setShowBreather(shouldOfferBreather(profileResults, result));
    });

    return () => {
      cancelled = true;
    };
  }, [result]);

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
    ? `You passed Level ${result.level} in ${result.topicLabel ?? result.subjectName}.`
    : `You did not pass Level ${result.level} in ${result.topicLabel ?? result.subjectName} yet, but you can improve with another try.`;

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
        <Text style={styles.heroText}>{result.topicLabel ? `Topic focus: ${result.topicLabel}` : "General mixed practice"}</Text>
        <Text style={styles.heroSummary}>{summary}</Text>
      </View>

      {passed && showBreather ? (
        <View style={styles.rewardCard}>
          <Text style={styles.rewardEyebrow}>Reward unlocked</Text>
          <Text style={styles.rewardTitle}>Take a learning breather</Text>
          <Text style={styles.rewardText}>
            You have passed {passStreak} {passStreak === 1 ? "level" : "levels"} in {result.subjectName}. A short,
            story-based reset is ready if you want one before the next exercise.
          </Text>
        </View>
      ) : null}

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
        <Text style={styles.summaryLine}>Focus: {result.topicLabel ?? "General mixed practice"}</Text>
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
        {passed && showBreather ? <PrimaryButton label="Take Learning Breather" onPress={openBreather} /> : null}
        {passed ? (
          <PrimaryButton
            label={showBreather ? "Skip Breather and Continue" : "Next Level"}
            variant={showBreather ? "secondary" : "primary"}
            onPress={goToNextLevel}
          />
        ) : null}
        <PrimaryButton label="Repeat This Level" variant={passed ? "secondary" : "primary"} onPress={repeatLevel} />
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

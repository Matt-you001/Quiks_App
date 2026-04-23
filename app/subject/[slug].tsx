import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../../components/AppBackground";
import { PrimaryButton } from "../../components/PrimaryButton";
import { getUnlockedLevelsForGrade } from "../../lib/quiz";
import { readAppState } from "../../lib/storage";
import { getSubjectById, grades } from "../../lib/subjects";
import { palette, shadows } from "../../lib/theme";
import type { SessionResult, UserProfile } from "../../types/app";

export default function SubjectDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const subject = getSubjectById(slug);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [mode, setMode] = useState<"quiz" | "training">("quiz");
  const [selectedGrade, setSelectedGrade] = useState(grades[0]);

  const load = useCallback(async () => {
    const state = await readAppState();
    const currentProfile = state.profiles.find((item) => item.id === state.currentProfileId) ?? null;
    if (!currentProfile && slug) {
      router.replace({ pathname: "/select-profile", params: { subject: slug } });
      return;
    }
    setProfile(currentProfile);
    setResults(currentProfile ? state.results[currentProfile.id] ?? [] : []);
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const gradeOptions = grades.slice(0, 8);

  const bestUnlockedGrade = useMemo(() => {
    if (!subject) {
      return grades[0];
    }

    const reversed = [...gradeOptions].reverse();
    const found = reversed.find((grade) => getUnlockedLevelsForGrade(results, subject.id, grade).length > 1);
    return found ?? gradeOptions[0];
  }, [gradeOptions, results, subject]);

  useEffect(() => {
    setSelectedGrade(bestUnlockedGrade);
  }, [bestUnlockedGrade]);

  if (!subject) {
    return (
      <AppBackground>
        <View style={styles.fallbackCard}>
          <Text style={styles.subjectTitle}>Subject not found</Text>
          <PrimaryButton label="Back home" onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <MaterialCommunityIcons name={subject.icon as never} size={34} color={palette.white} />
        <Text style={styles.subjectTitle}>{subject.name}</Text>
        <Text style={styles.subjectDescription}>{subject.description}</Text>
        <Text style={styles.profileLine}>Active learner: {profile?.name ?? "None selected"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Choose mode</Text>
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setMode("training")}
            style={[styles.modeButton, mode === "training" ? styles.modeActive : null]}
          >
            <Text style={[styles.modeLabel, mode === "training" ? styles.modeLabelActive : null]}>Training</Text>
            <Text style={styles.modeHint}>Slower pace with explanations</Text>
          </Pressable>
          <Pressable onPress={() => setMode("quiz")} style={[styles.modeButton, mode === "quiz" ? styles.modeActive : null]}>
            <Text style={[styles.modeLabel, mode === "quiz" ? styles.modeLabelActive : null]}>Quiz</Text>
            <Text style={styles.modeHint}>Timed challenge for performance</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Grade</Text>
        <Text style={styles.levelHint}>Choose a grade first. Your unlocked levels will show on the start card.</Text>
        <View style={styles.gradeWrap}>
          {gradeOptions.map((grade) => (
            <Pressable
              key={grade}
              onPress={() => setSelectedGrade(grade)}
              style={[styles.gradeChip, selectedGrade === grade ? styles.gradeChipActive : null]}
            >
              <Text style={[styles.gradeChipText, selectedGrade === grade ? styles.gradeChipTextActive : null]}>{grade}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>AI coach for this subject</Text>
        <Text style={styles.coachText}>
          Quiks can generate question sets, feedback, and follow-up study plans for {subject.name.toLowerCase()}.
        </Text>
        <PrimaryButton
          label={`Open ${mode} setup`}
          onPress={() =>
            router.push({
              pathname: "/session",
              params: { subjectId: subject.id, mode, grade: selectedGrade },
            })
          }
        />
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 30,
    padding: 22,
  },
  subjectTitle: {
    marginTop: 14,
    color: palette.white,
    fontSize: 30,
    fontWeight: "800",
  },
  subjectDescription: {
    marginTop: 8,
    color: "#E8F4FB",
    lineHeight: 22,
  },
  profileLine: {
    marginTop: 12,
    color: "#C7E9F7",
    fontWeight: "700",
  },
  card: {
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: palette.white,
    padding: 18,
    ...shadows.card,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: "row",
    gap: 12,
  },
  modeButton: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#F4F7FA",
    borderWidth: 1,
    borderColor: "#DFE8F0",
  },
  modeActive: {
    backgroundColor: "#DFF2FA",
    borderColor: "#63C2E8",
  },
  modeLabel: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  modeLabelActive: {
    color: palette.navy,
  },
  modeHint: {
    color: palette.slate,
    marginTop: 8,
    lineHeight: 20,
  },
  gradeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gradeChip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F2F5F8",
  },
  gradeChipActive: {
    backgroundColor: palette.navy,
  },
  gradeChipText: {
    color: palette.navy,
    fontWeight: "700",
  },
  gradeChipTextActive: {
    color: palette.white,
  },
  levelHint: {
    color: palette.slate,
    marginBottom: 10,
    lineHeight: 20,
  },
  coachText: {
    color: palette.slate,
    lineHeight: 22,
    marginBottom: 14,
  },
  fallbackCard: {
    marginTop: 40,
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 20,
  },
});

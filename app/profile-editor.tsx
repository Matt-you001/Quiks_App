import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { readAppState, upsertProfile } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import type { UserProfile } from "../types/app";

const defaultForm = {
  name: "",
  age: "",
  targetExam: "General school prep",
  dailyGoalMinutes: "20",
};

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ProfileEditorScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const isEditMode = params.mode === "edit";

  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    readAppState().then((state) => {
      const activeProfile = state.profiles.find((profile) => profile.id === state.currentProfileId) ?? null;

      if (isEditMode && activeProfile) {
        setEditingProfile(activeProfile);
        setForm({
          name: activeProfile.name,
          age: String(activeProfile.age),
          targetExam: activeProfile.targetExam,
          dailyGoalMinutes: String(activeProfile.dailyGoalMinutes),
        });
        return;
      }

      setEditingProfile(null);
      setForm(defaultForm);
    });
  }, [isEditMode]);

  const saveProfile = async () => {
    if (!form.name.trim()) {
      Alert.alert("Name required", "Please enter a learner name.");
      return;
    }

    const age = Number(form.age);
    const goal = Number(form.dailyGoalMinutes);

    if (!Number.isFinite(age) || age < 3) {
      Alert.alert("Invalid age", "Please enter a valid age.");
      return;
    }

    if (!Number.isFinite(goal) || goal < 5) {
      Alert.alert("Invalid goal", "Please enter at least 5 minutes for the daily goal.");
      return;
    }

    setSaving(true);

    const profile: UserProfile = {
      id: editingProfile?.id ?? createId(),
      name: form.name.trim(),
      age,
      targetExam: form.targetExam.trim() || "General school prep",
      dailyGoalMinutes: goal,
    };

    await upsertProfile(profile);
    setSaving(false);
    router.replace("/profile");
  };

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <Text style={styles.title}>{isEditMode ? "Edit profile" : "Create profile"}</Text>
        <Text style={styles.subtitle}>
          {isEditMode
            ? "Update this learner's details and save the changes."
            : "Create a dedicated student profile so progress and results stay personal."}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={form.name}
          onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
          style={styles.input}
          placeholder="Enter learner name"
          placeholderTextColor="#7C8EA3"
        />

        <Text style={styles.label}>Age</Text>
        <TextInput
          value={form.age}
          onChangeText={(value) => setForm((current) => ({ ...current, age: value }))}
          style={styles.input}
          placeholder="Age"
          keyboardType="number-pad"
          placeholderTextColor="#7C8EA3"
        />

        <Text style={styles.label}>Target exam</Text>
        <TextInput
          value={form.targetExam}
          onChangeText={(value) => setForm((current) => ({ ...current, targetExam: value }))}
          style={styles.input}
          placeholder="WAEC, school prep, olympiad..."
          placeholderTextColor="#7C8EA3"
        />

        <Text style={styles.label}>Daily goal in minutes</Text>
        <TextInput
          value={form.dailyGoalMinutes}
          onChangeText={(value) => setForm((current) => ({ ...current, dailyGoalMinutes: value }))}
          style={styles.input}
          placeholder="20"
          keyboardType="number-pad"
          placeholderTextColor="#7C8EA3"
        />

        <View style={styles.actionColumn}>
          <PrimaryButton label={isEditMode ? "Save changes" : "Create profile"} onPress={saveProfile} loading={saving} />
          <PrimaryButton label="Cancel" variant="ghost" onPress={() => router.back()} />
        </View>
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
  title: {
    color: palette.white,
    fontSize: 32,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 10,
    color: "#E8F4FB",
    lineHeight: 22,
  },
  card: {
    marginTop: 18,
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 18,
    ...shadows.card,
  },
  label: {
    color: palette.slate,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    backgroundColor: "#F9FBFD",
    paddingHorizontal: 14,
    color: palette.ink,
  },
  actionColumn: {
    marginTop: 18,
    gap: 12,
  },
});

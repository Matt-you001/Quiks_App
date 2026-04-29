import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, t } from "../lib/i18n";
import { readAppState, upsertProfile } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import type { AppLanguage, UserProfile } from "../types/app";

const defaultForm = {
  name: "",
  age: "",
  targetExam: appVariant.defaultTargetExam,
  dailyGoalMinutes: String(appVariant.defaultDailyGoalMinutes),
  language: DEFAULT_LANGUAGE as AppLanguage,
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
          language: activeProfile.language ?? DEFAULT_LANGUAGE,
        });
        return;
      }

      setEditingProfile(null);
      setForm(defaultForm);
    });
  }, [isEditMode]);

  const saveProfile = async () => {
    if (!form.name.trim()) {
      Alert.alert(t(form.language, "nameRequiredTitle"), t(form.language, "nameRequiredMessage"));
      return;
    }

    const age = Number(form.age);
    const goal = Number(form.dailyGoalMinutes);

    if (!Number.isFinite(age) || age < 3) {
      Alert.alert(t(form.language, "invalidAgeTitle"), t(form.language, "invalidAgeMessage"));
      return;
    }

    if (!Number.isFinite(goal) || goal < 5) {
      Alert.alert(t(form.language, "invalidGoalTitle"), t(form.language, "invalidGoalMessage"));
      return;
    }

    setSaving(true);

    const profile: UserProfile = {
      id: editingProfile?.id ?? createId(),
      name: form.name.trim(),
      age,
      targetExam: form.targetExam.trim() || "General school prep",
      dailyGoalMinutes: goal,
      language: form.language,
    };

    await upsertProfile(profile);
    setSaving(false);
    router.replace("/profile");
  };

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <Text style={styles.title}>{isEditMode ? t(form.language, "editProfile") : t(form.language, "createProfile")}</Text>
        <Text style={styles.subtitle}>
          {isEditMode ? t(form.language, "updateLearnerDetails") : appVariant.profileEditorSubtitle}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t(form.language, "name")}</Text>
        <TextInput
          value={form.name}
          onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
          style={styles.input}
          placeholder={t(form.language, "enterLearnerName")}
          placeholderTextColor="#7C8EA3"
        />

        <Text style={styles.label}>{t(form.language, "age")}</Text>
        <TextInput
          value={form.age}
          onChangeText={(value) => setForm((current) => ({ ...current, age: value }))}
          style={styles.input}
          placeholder={t(form.language, "age")}
          keyboardType="number-pad"
          placeholderTextColor="#7C8EA3"
        />

        <Text style={styles.label}>{t(form.language, "targetExam")}</Text>
        <TextInput
          value={form.targetExam}
          onChangeText={(value) => setForm((current) => ({ ...current, targetExam: value }))}
          style={styles.input}
          placeholder={appVariant.targetExamPlaceholder}
          placeholderTextColor="#7C8EA3"
        />

        <Text style={styles.label}>{t(form.language, "dailyGoalMinutes")}</Text>
        <TextInput
          value={form.dailyGoalMinutes}
          onChangeText={(value) => setForm((current) => ({ ...current, dailyGoalMinutes: value }))}
          style={styles.input}
          placeholder={String(appVariant.defaultDailyGoalMinutes)}
          keyboardType="number-pad"
          placeholderTextColor="#7C8EA3"
        />

        <Text style={styles.label}>{t(form.language, "language")}</Text>
        <View style={styles.languageWrap}>
          {LANGUAGE_OPTIONS.map((entry) => (
            <Pressable
              key={entry.code}
              onPress={() => setForm((current) => ({ ...current, language: entry.code }))}
              style={[styles.languageChip, form.language === entry.code ? styles.languageChipActive : null]}
            >
              <Text style={[styles.languageChipText, form.language === entry.code ? styles.languageChipTextActive : null]}>
                {entry.nativeLabel}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.actionColumn}>
          <PrimaryButton
            label={isEditMode ? t(form.language, "saveChanges") : t(form.language, "createProfile")}
            onPress={saveProfile}
            loading={saving}
          />
          <PrimaryButton label={t(form.language, "cancel")} variant="ghost" onPress={() => router.back()} />
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
  languageWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  languageChip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F2F5F8",
  },
  languageChipActive: {
    backgroundColor: palette.navy,
  },
  languageChipText: {
    color: palette.navy,
    fontWeight: "700",
  },
  languageChipTextActive: {
    color: palette.white,
  },
  actionColumn: {
    marginTop: 18,
    gap: 12,
  },
});

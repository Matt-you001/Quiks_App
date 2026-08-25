import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PremiumFeatureDialog } from "../components/PremiumFeatureDialog";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, t } from "../lib/i18n";
import { syncRemotePushRegistration } from "../lib/notifications";
import { canCreateAnotherProfile } from "../lib/subscription";
import { readAppState, upsertProfile } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import type { AppLanguage, SubscriptionTier, UserProfile, UserRole } from "../types/app";

const defaultForm = {
  name: "",
  age: "",
  targetExam: appVariant.defaultTargetExam,
  preferredCurriculum: "",
  dailyGoalMinutes: String(appVariant.defaultDailyGoalMinutes),
  schoolName: "",
  teachingFocus: "",
  language: DEFAULT_LANGUAGE as AppLanguage,
  role: "student" as UserRole,
};

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

function createQuiksId(name: string, role: UserRole) {
  const prefix = role === "teacher" ? "QT" : "QS";
  const nameToken = name.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 3).padEnd(3, "X");
  const randomToken = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${nameToken}${randomToken}`;
}

export default function ProfileEditorScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const isEditMode = params.mode === "edit";

  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [showProfileUpgrade, setShowProfileUpgrade] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>("free");

  useEffect(() => {
    readAppState().then((state) => {
      setSubscriptionTier(state.subscriptionTier);
      const activeProfile = state.profiles.find((profile) => profile.id === state.currentProfileId) ?? null;

      if (isEditMode && activeProfile) {
        setEditingProfile(activeProfile);
        setForm({
          name: activeProfile.name,
          age: String(activeProfile.age),
          targetExam: activeProfile.targetExam,
          preferredCurriculum: activeProfile.preferredCurriculum ?? "",
          dailyGoalMinutes: String(activeProfile.dailyGoalMinutes),
          schoolName: activeProfile.schoolName ?? "",
          teachingFocus: activeProfile.teachingFocus ?? "",
          language: activeProfile.language ?? DEFAULT_LANGUAGE,
          role: activeProfile.role ?? "student",
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

    const isTeacher = form.role === "teacher";
    const age = Number(form.age);
    const goal = Number(form.dailyGoalMinutes);

    if (!isTeacher) {
      if (!Number.isFinite(age) || age < 3) {
        Alert.alert(t(form.language, "invalidAgeTitle"), t(form.language, "invalidAgeMessage"));
        return;
      }

      if (!Number.isFinite(goal) || goal < 5) {
        Alert.alert(t(form.language, "invalidGoalTitle"), t(form.language, "invalidGoalMessage"));
        return;
      }
    }

    if (!editingProfile) {
      const state = await readAppState();
      if (!canCreateAnotherProfile(state.subscriptionTier, state.profiles.length)) {
        setShowProfileUpgrade(true);
        return;
      }
    }

    setSaving(true);

    const profile: UserProfile = {
      id: editingProfile?.id ?? createId(),
      updatedAt: Date.now(),
      name: form.name.trim(),
      age: isTeacher ? (Number.isFinite(age) && age >= 18 ? age : editingProfile?.age ?? 18) : age,
      targetExam: isTeacher ? t(form.language, "teacherAccount") : form.targetExam.trim() || "General school prep",
      preferredCurriculum:
        !isTeacher && appVariant.id !== "uni" ? form.preferredCurriculum.trim() : "",
      dailyGoalMinutes: isTeacher ? 0 : goal,
      schoolName: isTeacher ? form.schoolName.trim() : "",
      teachingFocus: isTeacher ? form.teachingFocus.trim() : "",
      language: form.language,
      role: form.role,
      quiksId: editingProfile?.quiksId ?? createQuiksId(form.name.trim(), form.role),
    };

    try {
      await upsertProfile(profile);
      await syncRemotePushRegistration();
      router.replace(isEditMode ? "/profile" : "/");
    } catch (error) {
      console.warn("Profile cloud sync failed.", error);
      Alert.alert(
        "Profile sync failed",
        "The profile was saved on this device, but it could not be synced to your account. Check your connection and try saving again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppBackground webContentWidth="narrow">
      <View style={styles.heroCard}>
        <Text style={styles.title}>{isEditMode ? t(form.language, "editProfile") : t(form.language, "createProfile")}</Text>
        <Text style={styles.subtitle}>
          {isEditMode ? t(form.language, "updateLearnerDetails") : t(form.language, "createProfileSubtitle")}
        </Text>
      </View>

      <View style={styles.card}>
        <>
          <Text style={styles.label}>{t(form.language, "classroomRole")}</Text>
          <View style={styles.languageWrap}>
            {([
              { code: "student", label: t(form.language, "studentRole") },
              { code: "teacher", label: t(form.language, "teacherRole") },
            ] as const).map((entry) => (
              <Pressable
                key={entry.code}
                onPress={() => setForm((current) => ({ ...current, role: entry.code }))}
                style={[styles.languageChip, form.role === entry.code ? styles.languageChipActive : null]}
              >
                <Text
                  style={[styles.languageChipText, form.role === entry.code ? styles.languageChipTextActive : null]}
                >
                  {entry.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>

        <Text style={styles.label}>{t(form.language, "name")}</Text>
        <TextInput
          value={form.name}
          onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
          style={styles.input}
          placeholder={t(form.language, "enterLearnerName")}
          placeholderTextColor="#7C8EA3"
        />

        {form.role === "teacher" ? (
          <>
            <Text style={styles.label}>{t(form.language, "age")}</Text>
            <TextInput
              value={form.age}
              onChangeText={(value) => setForm((current) => ({ ...current, age: value }))}
              style={styles.input}
              placeholder={t(form.language, "optional")}
              keyboardType="number-pad"
              placeholderTextColor="#7C8EA3"
            />

            <Text style={styles.label}>{t(form.language, "schoolName")}</Text>
            <TextInput
              value={form.schoolName}
              onChangeText={(value) => setForm((current) => ({ ...current, schoolName: value }))}
              style={styles.input}
              placeholder={t(form.language, "optional")}
              placeholderTextColor="#7C8EA3"
            />

            <Text style={styles.label}>{t(form.language, "teachingFocus")}</Text>
            <TextInput
              value={form.teachingFocus}
              onChangeText={(value) => setForm((current) => ({ ...current, teachingFocus: value }))}
              style={styles.input}
              placeholder={t(form.language, "optional")}
              placeholderTextColor="#7C8EA3"
            />
          </>
        ) : (
          <>
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

            {appVariant.id !== "uni" ? (
              <>
                <Text style={styles.label}>{t(form.language, "preferredCurriculum")}</Text>
                <TextInput
                  value={form.preferredCurriculum}
                  onChangeText={(value) => setForm((current) => ({ ...current, preferredCurriculum: value }))}
                  style={styles.input}
                  placeholder={t(form.language, "preferredCurriculumPlaceholder")}
                  placeholderTextColor="#7C8EA3"
                />
              </>
            ) : null}

            <Text style={styles.label}>{t(form.language, "dailyGoalMinutes")}</Text>
            <TextInput
              value={form.dailyGoalMinutes}
              onChangeText={(value) => setForm((current) => ({ ...current, dailyGoalMinutes: value }))}
              style={styles.input}
              placeholder={String(appVariant.defaultDailyGoalMinutes)}
              keyboardType="number-pad"
              placeholderTextColor="#7C8EA3"
            />
          </>
        )}

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
      <PremiumFeatureDialog
        visible={showProfileUpgrade}
        title={t(form.language, "profileLimitReachedTitle")}
        message={t(form.language, "profileLimitReachedMessage")}
        upgradeLabel={t(form.language, "upgradeToPro")}
        cancelLabel={t(form.language, "cancel")}
        showUpgradeAction={subscriptionTier !== "pro"}
        onClose={() => setShowProfileUpgrade(false)}
        onUpgrade={() => {
          setShowProfileUpgrade(false);
          router.push({ pathname: "/subscription", params: { source: "profiles" } } as never);
        }}
      />
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

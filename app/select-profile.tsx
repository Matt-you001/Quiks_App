import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { getLanguageLabel, t } from "../lib/i18n";
import { syncRemotePushRegistration } from "../lib/notifications";
import { canCreateAnotherProfile } from "../lib/subscription";
import { readAppState, setCurrentProfile } from "../lib/storage";
import { getSubjectById } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import type { SubscriptionTier, UserProfile } from "../types/app";

export default function SelectProfileScreen() {
  const { subject } = useLocalSearchParams<{ subject?: string }>();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>("free");
  const language = profiles[0]?.language ?? "en";
  const selectedSubject = getSubjectById(subject, language);

  const load = useCallback(async () => {
    const state = await readAppState();
    setProfiles(state.profiles);
    setSubscriptionTier(state.subscriptionTier);
    if (state.profiles.length === 0 && subject) {
      router.replace({ pathname: "/profile-editor", params: { mode: "create" } } as never);
    }
  }, [subject]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const continueWithProfile = async (profileId: string) => {
    await setCurrentProfile(profileId);
    await syncRemotePushRegistration();
    if (subject) {
      router.replace({ pathname: "/subject/[slug]", params: { slug: subject } });
    }
  };

  const canCreateMoreProfiles = canCreateAnotherProfile(subscriptionTier, profiles.length);

  return (
    <AppBackground>
      <View style={styles.hero}>
        <Text style={styles.title}>{t(language, "chooseLearner")}</Text>
        <Text style={styles.subtitle}>
          {selectedSubject ? t(language, "whoIsPracticing", { subject: selectedSubject.name }) : t(language, "selectLearnerForSession")}
        </Text>
      </View>

      <View style={styles.card}>
        {profiles.map((profile) => (
          <View key={profile.id} style={styles.profileCard}>
            <View>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.meta}>
                {t(language, "age")} {profile.age} | {profile.targetExam} | {getLanguageLabel(profile.language)}
              </Text>
            </View>
            <PrimaryButton label={t(language, "use")} onPress={() => continueWithProfile(profile.id)} style={styles.useButton} />
          </View>
        ))}
        <PrimaryButton
          label={t(language, "createLearner")}
          variant="secondary"
          onPress={() =>
            canCreateMoreProfiles
              ? router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never)
              : router.push({ pathname: "/subscription" } as never)
          }
        />
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: 18,
  },
  title: {
    color: palette.white,
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 8,
    color: "#E4F2FB",
    lineHeight: 22,
  },
  card: {
    marginTop: 18,
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 18,
    gap: 14,
    ...shadows.card,
  },
  profileCard: {
    borderWidth: 1,
    borderColor: "#E2EAF1",
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  name: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  meta: {
    color: palette.slate,
    marginTop: 4,
  },
  useButton: {
    alignSelf: "flex-start",
    minWidth: 90,
  },
});

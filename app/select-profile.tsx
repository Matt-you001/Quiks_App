import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { readAppState, setCurrentProfile } from "../lib/storage";
import { getSubjectById } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import type { UserProfile } from "../types/app";

export default function SelectProfileScreen() {
  const { subject } = useLocalSearchParams<{ subject?: string }>();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const selectedSubject = getSubjectById(subject);

  const load = useCallback(async () => {
    const state = await readAppState();
    setProfiles(state.profiles);
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
    if (subject) {
      router.replace({ pathname: "/subject/[slug]", params: { slug: subject } });
    }
  };

  return (
    <AppBackground>
      <View style={styles.hero}>
        <Text style={styles.title}>Choose learner</Text>
        <Text style={styles.subtitle}>
          {selectedSubject ? `Who is practicing ${selectedSubject.name} today?` : "Select the learner for this session."}
        </Text>
      </View>

      <View style={styles.card}>
        {profiles.map((profile) => (
          <View key={profile.id} style={styles.profileCard}>
            <View>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.meta}>
                Age {profile.age} • {profile.targetExam}
              </Text>
            </View>
            <PrimaryButton label="Use" onPress={() => continueWithProfile(profile.id)} style={styles.useButton} />
          </View>
        ))}
        <PrimaryButton
          label="Create learner"
          variant="secondary"
          onPress={() => router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never)}
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

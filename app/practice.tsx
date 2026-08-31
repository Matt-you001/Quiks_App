import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { appVariant } from "../lib/app-variant";
import { readAppState } from "../lib/storage";
import { getLocalizedSubjects } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import type { UserProfile } from "../types/app";

export default function PracticeScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checked, setChecked] = useState(false);

  useFocusEffect(useCallback(() => {
    void (async () => {
      const state = await readAppState({ awaitCloudRefresh: true });
      if (!state.isAuthenticated) {
        router.replace("/login" as never);
        return;
      }
      const selected = state.profiles.find((entry) => entry.id === state.currentProfileId) ?? state.profiles[0] ?? null;
      setProfile(selected);
      setChecked(true);
    })();
  }, []));

  const language = profile?.language ?? "en";
  const subjects = useMemo(() => getLocalizedSubjects(language), [language]);
  const columns = width >= 1120 ? 4 : width >= 820 ? 3 : width >= 560 ? 2 : 1;
  const gap = 14;
  const canvasWidth = isWeb ? Math.min(Math.max(width - 72, 320), 1200) : Math.max(width - 40, 280);
  const cardWidth = columns === 1 ? canvasWidth : Math.floor((canvasWidth - gap * (columns - 1)) / columns);

  if (!checked) return <AppBackground><Text style={styles.loading}>Loading practice subjects…</Text></AppBackground>;

  return (
    <AppBackground webContentWidth="wide">
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>PRACTICE / QUIZ</Text>
        <Text style={styles.title}>Choose a {appVariant.curriculumSingular.toLowerCase()}</Text>
        <Text style={styles.subtitle}>{profile ? `Practising as ${profile.name}` : "Create or select a learner profile to begin."}</Text>
      </View>
      <View style={styles.grid}>
        {subjects.map((subject) => (
          <Pressable
            key={subject.id}
            onPress={() => profile
              ? router.push({ pathname: "/subject/[slug]", params: { slug: subject.id } })
              : router.push({ pathname: "/profile-editor", params: { mode: "create" } } as never)}
            style={[styles.pressable, { width: cardWidth }]}
          >
            <LinearGradient colors={subject.accent} style={styles.card}>
              <MaterialCommunityIcons name={subject.icon as never} size={29} color={palette.white} />
              <Text style={styles.subject}>{subject.name}</Text>
              <Text style={styles.tagline}>{subject.tagline}</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 40, textAlign: "center", color: palette.navy, fontWeight: "800" },
  hero: { backgroundColor: palette.navy, borderRadius: 26, padding: 24, marginBottom: 18, ...shadows.card },
  eyebrow: { color: "#70E2D8", fontWeight: "900", letterSpacing: 1.4 },
  title: { color: palette.white, fontSize: 30, fontWeight: "900", marginTop: 7 },
  subtitle: { color: "#D8E8EE", fontSize: 16, marginTop: 7 },
  grid: { width: "100%", maxWidth: 1200, alignSelf: "center", flexDirection: "row", flexWrap: "wrap", gap: 14 },
  pressable: { minWidth: 0 },
  card: { minHeight: 185, borderRadius: 24, padding: 22, justifyContent: "space-between", ...shadows.card },
  subject: { color: palette.white, fontSize: 23, fontWeight: "900", marginTop: 18 },
  tagline: { color: "rgba(255,255,255,0.9)", fontSize: 15, lineHeight: 21, marginTop: 8 },
});

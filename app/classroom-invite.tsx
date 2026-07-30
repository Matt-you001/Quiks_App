import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { t } from "../lib/i18n";
import { canUseClassroom } from "../lib/subscription";
import { readAppState } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import { acceptClassroomInvitationLink } from "../services/ai";
import type { AppLanguage, UserProfile } from "../types/app";

export default function ClassroomInviteScreen() {
  const params = useLocalSearchParams<{ joinCode?: string; className?: string }>();
  const joinCode = typeof params.joinCode === "string" ? params.joinCode.trim().toUpperCase() : "";
  const className = typeof params.className === "string" ? params.className.trim() : "";
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<"free" | "pro">("free");
  const language: AppLanguage = profile?.language ?? "en";

  const load = useCallback(async () => {
    setLoading(true);
    const state = await readAppState();
    setIsAuthenticated(state.isAuthenticated);
    setProfile(state.profiles.find((entry) => entry.id === state.currentProfileId) ?? state.profiles[0] ?? null);
    setSubscriptionTier(state.subscriptionTier);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const authParams = {
    redirect: "classroom-invite",
    joinCode,
    ...(className ? { className } : {}),
  };

  const acceptInvitation = async () => {
    if (!profile || !joinCode || !canUseClassroom(subscriptionTier)) {
      return;
    }

    setAccepting(true);
    try {
      const response = await acceptClassroomInvitationLink({
        studentProfile: profile,
        classCode: joinCode,
      });
      Alert.alert(t(language, "classroomTitle"), response.message, [
        {
          text: "Open Classroom",
          onPress: () => router.replace("/classroom"),
        },
      ]);
    } catch (error) {
      Alert.alert(
        t(language, "classroomTitle"),
        error instanceof Error ? error.message : "Unable to accept this classroom invitation."
      );
    } finally {
      setAccepting(false);
    }
  };

  const declineInvitation = () => {
    router.replace("/");
  };

  if (loading) {
    return (
      <AppBackground>
        <View style={styles.card}>
          <Text style={styles.title}>Opening invitation…</Text>
        </View>
      </AppBackground>
    );
  }

  if (!joinCode) {
    return (
      <AppBackground>
        <View style={styles.card}>
          <Text style={styles.title}>Invalid classroom invitation</Text>
          <Text style={styles.message}>This invitation does not contain a valid class code.</Text>
          <PrimaryButton label={t(language, "backHome")} onPress={declineInvitation} />
        </View>
      </AppBackground>
    );
  }

  if (!isAuthenticated) {
    return (
      <AppBackground>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>{appVariant.appName}</Text>
          <Text style={styles.title}>Classroom invitation</Text>
          <Text style={styles.message}>
            Sign in to view and respond to the invitation{className ? ` for ${className}` : ""}.
          </Text>
          <PrimaryButton
            label={t(language, "signIn")}
            onPress={() => router.push({ pathname: "/login", params: authParams } as never)}
          />
          <PrimaryButton
            label={t(language, "signUp")}
            variant="secondary"
            onPress={() => router.push({ pathname: "/signup", params: authParams } as never)}
          />
          <PrimaryButton label={t(language, "reject")} variant="ghost" onPress={declineInvitation} />
        </View>
      </AppBackground>
    );
  }

  if (!profile) {
    return (
      <AppBackground>
        <View style={styles.card}>
          <Text style={styles.title}>Choose a student profile</Text>
          <Text style={styles.message}>
            Create or select the student profile that should join this classroom, then open the invitation again.
          </Text>
          <PrimaryButton label={t(language, "backHome")} onPress={declineInvitation} />
        </View>
      </AppBackground>
    );
  }

  if (!canUseClassroom(subscriptionTier)) {
    return (
      <AppBackground>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>{appVariant.appName}</Text>
          <Text style={styles.title}>Subscription required</Text>
          <Text style={styles.message}>{t(language, "classroomProRequired")}</Text>
          <PrimaryButton
            label={t(language, "upgradeToPro")}
            onPress={() => router.push({ pathname: "/subscription", params: { source: "classroom" } } as never)}
          />
          <PrimaryButton label={t(language, "reject")} variant="secondary" onPress={declineInvitation} />
        </View>
      </AppBackground>
    );
  }

  if (profile.role !== "student") {
    return (
      <AppBackground>
        <View style={styles.card}>
          <Text style={styles.title}>Student profile required</Text>
          <Text style={styles.message}>Only a student profile can accept a classroom invitation.</Text>
          <PrimaryButton label={t(language, "reject")} variant="secondary" onPress={declineInvitation} />
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{appVariant.appName}</Text>
        <Text style={styles.title}>Classroom invitation</Text>
        <Text style={styles.message}>
          {profile.name}, you have been invited to join {className || `the class with code ${joinCode}`}.
        </Text>
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>{t(language, "classCode")}</Text>
          <Text style={styles.code}>{joinCode}</Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton
            label={t(language, "accept")}
            onPress={acceptInvitation}
            loading={accepting}
            style={styles.action}
          />
          <PrimaryButton
            label={t(language, "reject")}
            variant="secondary"
            onPress={declineInvitation}
            disabled={accepting}
            style={styles.action}
          />
        </View>
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 42,
    borderRadius: 28,
    backgroundColor: palette.white,
    padding: 22,
    gap: 16,
    ...shadows.card,
  },
  eyebrow: {
    color: palette.navy,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 35,
  },
  message: {
    color: palette.slate,
    fontSize: 16,
    lineHeight: 24,
  },
  codeCard: {
    borderRadius: 18,
    backgroundColor: "#EEF8FB",
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  codeLabel: {
    color: palette.slate,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  code: {
    color: palette.navy,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 3,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  action: {
    flex: 1,
  },
});

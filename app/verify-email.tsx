import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import {
  changeEmailWithVerification,
  formatFirebaseError,
  getAuthenticatedAccount,
  refreshEmailVerification,
  resendEmailVerification,
  signOutAccount,
} from "../lib/firebase";
import {
  completeVerifiedAuthentication,
  getAuthContinuationParams,
  getContinuationRoute,
} from "../lib/auth-flow";
import { logoutAccount } from "../lib/storage";
import { palette, shadows } from "../lib/theme";

type Action = "resend" | "check" | "change" | "logout";

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{
    redirect?: string;
    plan?: string;
    joinCode?: string;
    className?: string;
    returnTo?: string;
    schoolCode?: string;
  }>();
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [busy, setBusy] = useState<Action | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; tone: "error" | "success" } | null>(null);

  const continuation = getAuthContinuationParams(params);

  useFocusEffect(
    useCallback(() => {
      const account = getAuthenticatedAccount();
      if (!account) {
        router.replace({ pathname: "/login", params: continuation } as never);
        return;
      }
      setEmail(account.email);
    }, [params.className, params.joinCode, params.plan, params.redirect, params.returnTo, params.schoolCode])
  );

  const run = async (action: Action, operation: () => Promise<void>) => {
    setBusy(action);
    setFeedback(null);
    try {
      await operation();
    } catch (error) {
      setFeedback({ message: formatFirebaseError(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const handleResend = () =>
    run("resend", async () => {
      const account = await resendEmailVerification();
      setEmail(account.email);
      setFeedback({ message: "A new verification email was sent to " + account.email + ".", tone: "success" });
    });

  const handleVerified = () =>
    run("check", async () => {
      const account = await refreshEmailVerification();
      setEmail(account.email);
      if (!account.emailVerified) {
        setFeedback({
          message: "Firebase has not confirmed this email yet. Open the verification link, then try again.",
          tone: "error",
        });
        return;
      }
      await completeVerifiedAuthentication(account);
      router.replace(getContinuationRoute(continuation) as never);
    });

  const handleChangeEmail = () => {
    if (!showChangeEmail) {
      setShowChangeEmail(true);
      setFeedback(null);
      return;
    }
    void run("change", async () => {
      const pendingEmail = await changeEmailWithVerification(newEmail);
      setFeedback({
        message: "Firebase sent a confirmation link to " + pendingEmail + ". Open it, then choose I Have Verified.",
        tone: "success",
      });
      setNewEmail("");
    });
  };

  const handleLogout = () =>
    run("logout", async () => {
      await logoutAccount();
      await signOutAccount();
      router.replace({ pathname: "/login", params: continuation } as never);
    });

  return (
    <AppBackground webContentWidth="narrow">
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>{appVariant.appName}</Text>
        <Text style={styles.title}>Verify Email</Text>
        <Text style={styles.subtitle}>
          Firebase sent a verification link to your email. Your account records, school invitation,
          licence and protected features will remain unchanged until Firebase confirms the address.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Email address</Text>
        <Text style={styles.email}>{email || "Loading..."}</Text>

        {showChangeEmail ? (
          <>
            <Text style={styles.label}>New email address</Text>
            <TextInput
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Enter your new email"
              placeholderTextColor="#7E93A8"
              style={styles.input}
            />
            <Text style={styles.hint}>
              Firebase will change the address only after you open the link sent to the new email.
            </Text>
          </>
        ) : null}

        {feedback ? (
          <View style={[styles.feedback, feedback.tone === "success" && styles.feedbackSuccess]}>
            <Text style={[styles.feedbackText, feedback.tone === "success" && styles.feedbackTextSuccess]}>
              {feedback.message}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton label="I Have Verified" onPress={handleVerified} loading={busy === "check"} disabled={busy !== null && busy !== "check"} />
          <PrimaryButton label="Resend" variant="secondary" onPress={handleResend} loading={busy === "resend"} disabled={busy !== null && busy !== "resend"} />
          <PrimaryButton
            label={showChangeEmail ? "Send Change Email Link" : "Change Email"}
            variant="secondary"
            onPress={handleChangeEmail}
            loading={busy === "change"}
            disabled={(showChangeEmail && !newEmail.trim()) || (busy !== null && busy !== "change")}
          />
          <PrimaryButton label="Log Out" variant="ghost" onPress={handleLogout} loading={busy === "logout"} disabled={busy !== null && busy !== "logout"} />
        </View>
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginTop: 18,
    borderRadius: 28,
    padding: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  eyebrow: {
    color: "#D8EDF8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 10,
    color: palette.white,
    fontSize: 32,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 10,
    color: "#E8F4FB",
    lineHeight: 22,
  },
  card: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    backgroundColor: palette.white,
    ...shadows.card,
  },
  label: {
    marginTop: 10,
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  email: {
    marginTop: 8,
    color: palette.navy,
    fontSize: 18,
    fontWeight: "900",
  },
  input: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D9E4EE",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: palette.ink,
    backgroundColor: "#F8FBFD",
  },
  hint: {
    marginTop: 8,
    color: "#53697D",
    fontSize: 13,
    lineHeight: 19,
  },
  feedback: {
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0527A",
    backgroundColor: "#FFF0F4",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackSuccess: {
    borderColor: "#20A36E",
    backgroundColor: "#EFFAF5",
  },
  feedbackText: {
    color: "#A3264A",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  feedbackTextSuccess: {
    color: "#13704D",
  },
  actions: {
    marginTop: 20,
    gap: 12,
  },
});
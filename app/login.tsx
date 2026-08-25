import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { getGoogleAuthRedirectUri, googleAuthConfig } from "../lib/auth-config";
import {
  beginNativeGoogleSignIn,
  formatGoogleSignInError,
  hasGoogleSignInConfig,
  isNativeGoogleSignInSupported,
} from "../lib/google-auth";
import {
  formatFirebaseError,
  getAuthenticatedAccount,
  getFirebaseConfigErrorMessage,
  isFirebaseConfigured,
  sendResetPasswordEmail,
  signInWithEmailAccount,
  signInWithGoogleAccount,
  waitForFirebaseAuthAccount,
} from "../lib/firebase";
import { t } from "../lib/i18n";
import { syncRevenueCatIdentityForAuthentication } from "../lib/revenuecat";
import { readAppState, setAuthenticatedAccount } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import { getPostAuthRoute } from "../lib/web-checkout";
import type { AppLanguage } from "../types/app";

function GoogleLoginButton({
  onSuccess,
  onError,
}: {
  onSuccess: (idToken: string, accessToken?: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const language = "en";
  const [googleLoading, setGoogleLoading] = useState(false);
  const isNativeFlow = isNativeGoogleSignInSupported();
  const [request, response, promptAsync] = !isNativeFlow
    ? (
        require("expo-auth-session/providers/google") as typeof import("expo-auth-session/providers/google")
      ).useIdTokenAuthRequest({
        clientId: googleAuthConfig.webClientId || googleAuthConfig.expoClientId,
        iosClientId: googleAuthConfig.iosClientId,
        redirectUri: getGoogleAuthRedirectUri(),
      })
    : [null, null, null];
  const onSuccessRef = useRef(onSuccess);
  const handledGoogleResponseKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    if (isNativeFlow) {
      return;
    }

    const completeGoogle = async () => {
      if (!response) {
        return;
      }

      const responseParams = "params" in response ? response.params : {};
      const responseKey = [
        response.type,
        responseParams.state ?? "",
        responseParams.id_token ?? "",
        responseParams.error ?? "",
      ].join(":");
      if (handledGoogleResponseKeyRef.current === responseKey) {
        return;
      }
      handledGoogleResponseKeyRef.current = responseKey;

      if (response.type === "error") {
        setGoogleLoading(false);
        onError(response.error?.message || response.params.error_description || t(language, "invalidCredentialsMessage"));
        return;
      }

      if (response.type !== "success") {
        return;
      }

      const idToken = response.params.id_token;
      const accessToken = response.params.access_token;
      if (!idToken) {
        setGoogleLoading(false);
        onError("Google did not return the identity token required to complete sign-in. Please try again.");
        return;
      }

      try {
        await onSuccessRef.current(idToken, accessToken);
      } finally {
        setGoogleLoading(false);
      }
    };

    void completeGoogle();
  }, [isNativeFlow, onError, response]);

  return (
    <PrimaryButton
      label={t(language, "continueWithGoogle")}
      variant="secondary"
      onPress={async () => {
        setGoogleLoading(true);
        try {
          if (isNativeFlow) {
            const { idToken, accessToken } = await beginNativeGoogleSignIn();
            await onSuccess(idToken, accessToken);
          } else {
            await promptAsync?.();
          }
        } catch (error) {
          onError(formatGoogleSignInError(error));
        } finally {
          setGoogleLoading(false);
        }
      }}
      loading={googleLoading}
      disabled={Platform.OS !== "web" && !isNativeFlow && !request}
    />
  );
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ redirect?: string; plan?: string; joinCode?: string; className?: string; returnTo?: string }>();
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<{ message: string; tone: "error" | "success" } | null>(null);
  const hasGoogleConfig = hasGoogleSignInConfig();

  const reportAuthError = useCallback((message: string) => {
    setAuthFeedback({ message, tone: "error" });
    if (Platform.OS !== "web") {
      Alert.alert(t(language, "invalidCredentialsTitle"), message);
    }
  }, [language]);

  useFocusEffect(
    useCallback(() => {
      readAppState().then(async (state) => {
        const preferredLanguage =
          state.profiles.find((profile) => profile.id === state.currentProfileId)?.language ??
          state.profiles[0]?.language ??
          "en";
        setLanguage(preferredLanguage);

        const firebaseAccount = Platform.OS === "web" ? await waitForFirebaseAuthAccount() : getAuthenticatedAccount();
        if (firebaseAccount) {
          // Firebase browser persistence has already restored this account.
          // readAppState above opens its account-scoped cache and starts the
          // cloud refresh, so do not block the returning user on network I/O.
          void syncRevenueCatIdentityForAuthentication(firebaseAccount);
        }
        if (firebaseAccount || (Platform.OS !== "web" && state.isAuthenticated)) {
          const nextRoute = getPostAuthRoute(params.redirect, params.plan, params.joinCode, params.className, params.returnTo);
          router.replace(nextRoute as never);
        }
      });
    }, [params.className, params.joinCode, params.plan, params.redirect, params.returnTo])
  );

  const handleLogin = async () => {
    if (!isFirebaseConfigured()) {
      reportAuthError(
        `${t(language, "authNotConfiguredMessage")} ${getFirebaseConfigErrorMessage() ?? "Firebase env not detected in this build."}`
      );
      return;
    }

    setAuthFeedback(null);
    setLoading(true);
    try {
      const account = await signInWithEmailAccount(email, password);
      // Hydrate the complete account state before the plan sync writes its
      // updated tier. Running these together can let a one-profile browser
      // cache overwrite the fully hydrated Firestore document.
      await setAuthenticatedAccount(account, true);
      await syncRevenueCatIdentityForAuthentication(account);
      router.replace(getPostAuthRoute(params.redirect, params.plan, params.joinCode, params.className, params.returnTo) as never);
    } catch (error) {
      reportAuthError(formatFirebaseError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!isFirebaseConfigured()) {
      reportAuthError(
        `${t(language, "authNotConfiguredMessage")} ${getFirebaseConfigErrorMessage() ?? "Firebase env not detected in this build."}`
      );
      return;
    }

    try {
      await sendResetPasswordEmail(email);
      setAuthFeedback({ message: t(language, "passwordResetSentMessage"), tone: "success" });
      if (Platform.OS !== "web") {
        Alert.alert(t(language, "passwordResetSentTitle"), t(language, "passwordResetSentMessage"));
      }
    } catch (error) {
      reportAuthError(formatFirebaseError(error));
    }
  };

  return (
    <AppBackground webContentWidth="narrow">
          <View style={styles.heroCard}>
            <Text style={styles.eyebrow}>{appVariant.appName}</Text>
            <Text style={styles.title}>{t(language, "welcomeBack")}</Text>
            <Text style={styles.subtitle}>{t(language, "authSubtitle")}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{t(language, "email")}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder={t(language, "enterEmail")}
              placeholderTextColor="#7E93A8"
              style={styles.input}
              returnKeyType="next"
            />

            <Text style={styles.label}>{t(language, "password")}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder={t(language, "enterPassword")}
              placeholderTextColor="#7E93A8"
              style={styles.input}
              returnKeyType="done"
            />

            <View style={styles.actionColumn}>
              {authFeedback ? (
                <View style={[styles.feedbackCard, authFeedback.tone === "success" && styles.feedbackCardSuccess]}>
                  <Text style={[styles.feedbackText, authFeedback.tone === "success" && styles.feedbackTextSuccess]}>
                    {authFeedback.message}
                  </Text>
                </View>
              ) : null}
              <PrimaryButton label={t(language, "signIn")} onPress={handleLogin} loading={loading} />
              {hasGoogleConfig ? (
                <GoogleLoginButton
                  onError={reportAuthError}
                  onSuccess={async (idToken, accessToken) => {
                    try {
                      const account = await signInWithGoogleAccount(idToken, accessToken);
                      await setAuthenticatedAccount(account, true);
                      await syncRevenueCatIdentityForAuthentication(account);
                      router.replace(
                        getPostAuthRoute(params.redirect, params.plan, params.joinCode, params.className, params.returnTo) as never
                      );
                    } catch (error) {
                      reportAuthError(formatFirebaseError(error));
                    }
                  }}
                />
              ) : null}
              <PrimaryButton label={t(language, "forgotPassword")} variant="ghost" onPress={handleForgotPassword} />
              <PrimaryButton
                label={t(language, "noAccountYet")}
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/signup",
                    params: {
                      ...(params.redirect ? { redirect: params.redirect } : {}),
                      ...(params.plan ? { plan: params.plan } : {}),
                      ...(params.joinCode ? { joinCode: params.joinCode } : {}),
                      ...(params.className ? { className: params.className } : {}),
                      ...(params.returnTo ? { returnTo: params.returnTo } : {}),
                    },
                  } as never)
                }
              />
            </View>
          </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 18,
    ...shadows.card,
  },
  label: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 10,
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
  actionColumn: {
    marginTop: 20,
    gap: 12,
  },
  feedbackCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0527A",
    backgroundColor: "#FFF0F4",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackCardSuccess: {
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
});

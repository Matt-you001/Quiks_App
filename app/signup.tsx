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
  signInWithGoogleAccount,
  signUpWithEmailAccount,
  waitForFirebaseAuthAccount,
} from "../lib/firebase";
import { t } from "../lib/i18n";
import { syncRevenueCatIdentityForAuthentication } from "../lib/revenuecat";
import { readAppState, setAuthenticatedAccount } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import { getPostAuthRoute } from "../lib/web-checkout";
import type { AppLanguage } from "../types/app";

function GoogleSignupButton({
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
        onError("Google did not return the identity token required to complete sign-up. Please try again.");
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

export default function SignupScreen() {
  const params = useLocalSearchParams<{ redirect?: string; plan?: string; joinCode?: string; className?: string; returnTo?: string }>();
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);
  const hasGoogleConfig = hasGoogleSignInConfig();

  const reportAuthError = useCallback((message: string) => {
    setAuthFeedback(message);
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

  const handleSignup = async () => {
    if (!isFirebaseConfigured()) {
      reportAuthError(
        `${t(language, "authNotConfiguredMessage")} ${getFirebaseConfigErrorMessage() ?? "Firebase env not detected in this build."}`
      );
      return;
    }

    const state = await readAppState();
    if (state.account?.provider === "email" && state.account.email === email.trim().toLowerCase()) {
      reportAuthError(t(language, "accountExistsMessage"));
      return;
    }

    if (password.length < 6) {
      reportAuthError(t(language, "passwordTooShortMessage"));
      return;
    }

    if (password !== confirmPassword) {
      reportAuthError(t(language, "passwordMismatchMessage"));
      return;
    }

    setAuthFeedback(null);
    setLoading(true);
    try {
      const account = await signUpWithEmailAccount("", email, password);
      // Finish the cloud profile merge before persisting subscription state so
      // plan synchronization cannot overwrite profiles from another device.
      await setAuthenticatedAccount(account, true);
      await syncRevenueCatIdentityForAuthentication(account);
      router.replace(getPostAuthRoute(params.redirect, params.plan, params.joinCode, params.className, params.returnTo) as never);
    } catch (error) {
      reportAuthError(formatFirebaseError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBackground webContentWidth="narrow">
          <View style={styles.heroCard}>
            <Text style={styles.eyebrow}>{appVariant.appName}</Text>
            <Text style={styles.title}>{t(language, "createAccount")}</Text>
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
              returnKeyType="next"
            />

            <Text style={styles.label}>{t(language, "confirmPassword")}</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder={t(language, "reEnterPassword")}
              placeholderTextColor="#7E93A8"
              style={styles.input}
              returnKeyType="done"
            />

            <View style={styles.actionColumn}>
              {authFeedback ? (
                <View style={styles.feedbackCard}>
                  <Text style={styles.feedbackText}>{authFeedback}</Text>
                </View>
              ) : null}
              <PrimaryButton label={t(language, "signUp")} onPress={handleSignup} loading={loading} />
              {hasGoogleConfig ? (
                <GoogleSignupButton
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
              <PrimaryButton
                label={t(language, "alreadyHaveAccount")}
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/login",
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
  feedbackText: {
    color: "#A3264A",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
});

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { googleAuthConfig } from "../lib/auth-config";
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
}: {
  onSuccess: (idToken: string, accessToken?: string) => Promise<void>;
}) {
  const language = "en";
  const [googleLoading, setGoogleLoading] = useState(false);
  const isNativeFlow = isNativeGoogleSignInSupported();
  const [request, response, promptAsync] = !isNativeFlow
    ? (
        require("expo-auth-session/providers/google") as typeof import("expo-auth-session/providers/google")
      ).useAuthRequest({
        clientId: googleAuthConfig.webClientId || googleAuthConfig.expoClientId,
        iosClientId: googleAuthConfig.iosClientId,
      })
    : [null, null, null];

  useEffect(() => {
    if (isNativeFlow) {
      return;
    }

    const WebBrowser = require("expo-web-browser") as typeof import("expo-web-browser");
    WebBrowser.maybeCompleteAuthSession();
  }, [isNativeFlow]);

  useEffect(() => {
    if (isNativeFlow) {
      return;
    }

    const completeGoogle = async () => {
      if (response?.type !== "success") {
        return;
      }

      const idToken = response.params.id_token;
      const accessToken = response.params.access_token;
      if (!idToken) {
        setGoogleLoading(false);
        return;
      }

      try {
        await onSuccess(idToken, accessToken);
      } finally {
        setGoogleLoading(false);
      }
    };

    void completeGoogle();
  }, [isNativeFlow, onSuccess, response]);

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
          Alert.alert(t(language, "invalidCredentialsTitle"), formatGoogleSignInError(error));
        } finally {
          setGoogleLoading(false);
        }
      }}
      loading={googleLoading}
      disabled={!isNativeFlow && !request}
    />
  );
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ redirect?: string; plan?: string; joinCode?: string; className?: string; returnTo?: string }>();
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const hasGoogleConfig = hasGoogleSignInConfig();

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
          await setAuthenticatedAccount(firebaseAccount, true);
          await syncRevenueCatIdentityForAuthentication(firebaseAccount);
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
      Alert.alert(
        t(language, "authNotConfiguredTitle"),
        `${t(language, "authNotConfiguredMessage")}\n\n${getFirebaseConfigErrorMessage() ?? "Firebase env not detected in this build."}`
      );
      return;
    }

    setLoading(true);
    try {
      const account = await signInWithEmailAccount(email, password);
      await setAuthenticatedAccount(account, true);
      await syncRevenueCatIdentityForAuthentication(account);
      router.replace(getPostAuthRoute(params.redirect, params.plan, params.joinCode, params.className, params.returnTo) as never);
    } catch (error) {
      Alert.alert(t(language, "invalidCredentialsTitle"), formatFirebaseError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!isFirebaseConfigured()) {
      Alert.alert(
        t(language, "authNotConfiguredTitle"),
        `${t(language, "authNotConfiguredMessage")}\n\n${getFirebaseConfigErrorMessage() ?? "Firebase env not detected in this build."}`
      );
      return;
    }

    try {
      await sendResetPasswordEmail(email);
      Alert.alert(t(language, "passwordResetSentTitle"), t(language, "passwordResetSentMessage"));
    } catch (error) {
      Alert.alert(t(language, "invalidCredentialsTitle"), formatFirebaseError(error));
    }
  };

  return (
    <AppBackground scroll={false}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
              <PrimaryButton label={t(language, "signIn")} onPress={handleLogin} loading={loading} />
              {hasGoogleConfig ? (
                <GoogleLoginButton
                  onSuccess={async (idToken, accessToken) => {
                    try {
                      const account = await signInWithGoogleAccount(idToken, accessToken);
                      await setAuthenticatedAccount(account, true);
                      await syncRevenueCatIdentityForAuthentication(account);
                      router.replace(
                        getPostAuthRoute(params.redirect, params.plan, params.joinCode, params.className, params.returnTo) as never
                      );
                    } catch {
                      Alert.alert(t(language, "invalidCredentialsTitle"), t(language, "invalidCredentialsMessage"));
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
        </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 240,
  },
  scrollView: {
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
});

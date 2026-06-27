import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
  signInWithGoogleAccount,
  signUpWithEmailAccount,
} from "../lib/firebase";
import { t } from "../lib/i18n";
import { syncRevenueCatIdentity } from "../lib/revenuecat";
import { readAppState, setAuthenticatedAccount } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import { getPostAuthRoute } from "../lib/web-checkout";

function GoogleSignupButton({
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

export default function SignupScreen() {
  const language = "en";
  const params = useLocalSearchParams<{ redirect?: string; plan?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const hasGoogleConfig = hasGoogleSignInConfig();

  useFocusEffect(
    useCallback(() => {
      readAppState().then((state) => {
        if (state.isAuthenticated || getAuthenticatedAccount()) {
          const nextRoute = getPostAuthRoute(params.redirect, params.plan);
          router.replace(nextRoute as never);
        }
      });
    }, [params.plan, params.redirect])
  );

  const handleSignup = async () => {
    if (!isFirebaseConfigured()) {
      Alert.alert(
        t(language, "authNotConfiguredTitle"),
        `${t(language, "authNotConfiguredMessage")}\n\n${getFirebaseConfigErrorMessage() ?? "Firebase env not detected in this build."}`
      );
      return;
    }

    const state = await readAppState();
    if (state.account?.provider === "email" && state.account.email === email.trim().toLowerCase()) {
      Alert.alert(t(language, "accountExistsTitle"), t(language, "accountExistsMessage"));
      router.replace({ pathname: "/login" } as never);
      return;
    }

    if (password.length < 6) {
      Alert.alert(t(language, "passwordTooShortTitle"), t(language, "passwordTooShortMessage"));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t(language, "passwordMismatchTitle"), t(language, "passwordMismatchMessage"));
      return;
    }

    setLoading(true);
    try {
      const account = await signUpWithEmailAccount("", email, password);
      await setAuthenticatedAccount(account, true);
      await syncRevenueCatIdentity(account).catch(() => undefined);
      router.replace(getPostAuthRoute(params.redirect, params.plan) as never);
    } catch (error) {
      Alert.alert(t(language, "invalidCredentialsTitle"), formatFirebaseError(error));
    } finally {
      setLoading(false);
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
              {/*<PrimaryButton label={t(language, "signUp")} onPress={handleSignup} loading={loading} />
              {hasGoogleConfig ? (
                <GoogleSignupButton
                  onSuccess={async (idToken, accessToken) => {
                    try {
                      const account = await signInWithGoogleAccount(idToken, accessToken);
                      await setAuthenticatedAccount(account, true);
                      await syncRevenueCatIdentity(account).catch(() => undefined);
                      router.replace(getPostAuthRoute(params.redirect, params.plan) as never);
                    } catch {
                      Alert.alert(t(language, "invalidCredentialsTitle"), t(language, "invalidCredentialsMessage"));
                    }
                  }}
                />
              ) : null}*/}
              <PrimaryButton
                label={t(language, "alreadyHaveAccount")}
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/login",
                    params: {
                      ...(params.redirect ? { redirect: params.redirect } : {}),
                      ...(params.plan ? { plan: params.plan } : {}),
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
    paddingBottom: 280,
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

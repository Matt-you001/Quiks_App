import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
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
  formatFirebaseError,
  getAuthenticatedAccount,
  getFirebaseConfigErrorMessage,
  isFirebaseConfigured,
  sendResetPasswordEmail,
  signInWithEmailAccount,
  signInWithGoogleAccount,
} from "../lib/firebase";
import { t } from "../lib/i18n";
import { readAppState, setAuthenticatedAccount } from "../lib/storage";
import { palette, shadows } from "../lib/theme";

function GoogleLoginButton({
  onSuccess,
}: {
  onSuccess: (idToken: string, accessToken?: string) => Promise<void>;
}) {
  const Google = require("expo-auth-session/providers/google") as typeof import("expo-auth-session/providers/google");
  const WebBrowser = require("expo-web-browser") as typeof import("expo-web-browser");
  const language = "en";
  const [googleLoading, setGoogleLoading] = useState(false);
  const [request, response, promptAsync] = Google.useAuthRequest(googleAuthConfig);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, [WebBrowser]);

  useEffect(() => {
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
  }, [onSuccess, response]);

  return (
    <PrimaryButton
      label={t(language, "continueWithGoogle")}
      variant="secondary"
      onPress={async () => {
        setGoogleLoading(true);
        await promptAsync();
      }}
      loading={googleLoading}
      disabled={!request}
    />
  );
}

export default function LoginScreen() {
  const language = "en";
  const scrollRef = useRef<ScrollView>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const hasGoogleConfig = Boolean(googleAuthConfig.androidClientId || googleAuthConfig.expoClientId);

  const revealPasswordField = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 320, animated: true });
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      readAppState().then((state) => {
        if (state.isAuthenticated || getAuthenticatedAccount()) {
          router.replace("/");
        }
      });
    }, [])
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
      router.replace("/");
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? 24 : 0}
        style={styles.flex}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
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
              onFocus={revealPasswordField}
            />

            <View style={styles.actionColumn}>
              <PrimaryButton label={t(language, "signIn")} onPress={handleLogin} loading={loading} />
              {hasGoogleConfig ? (
                <GoogleLoginButton
                  onSuccess={async (idToken, accessToken) => {
                    try {
                      const account = await signInWithGoogleAccount(idToken, accessToken);
                      await setAuthenticatedAccount(account, true);
                      router.replace("/");
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
                onPress={() => router.push({ pathname: "/signup" } as never)}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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

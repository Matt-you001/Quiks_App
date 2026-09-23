import { router, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, View } from "react-native";
import { appVariant } from "../lib/app-variant";
import { preloadAppOpenAd, showAppOpenAd } from "../lib/ads";
import {
  getAuthenticatedAccount,
  isAccountEmailVerified,
  waitForFirebaseAuthAccount,
} from "../lib/firebase";
import { completeVerifiedAuthentication, getVerifyEmailRoute } from "../lib/auth-flow";
import { readAppState, setAuthenticatedAccount } from "../lib/storage";
import {
  useNotificationNavigation,
  usePendingChallengeWatcher,
  useRemotePushRegistration,
} from "../lib/notifications";
import { palette } from "../lib/theme";

if (Platform.OS === "web") {
  // The OAuth popup redirects to the variant root, so complete the handshake
  // before the protected-route gate can send that popup to /signup.
  WebBrowser.maybeCompleteAuthSession();
}

export default function RootLayout() {
  useNotificationNavigation();
  usePendingChallengeWatcher();
  useRemotePushRegistration();
  const appStateRef = useRef(AppState.currentState);
  const hydratedAccountUidRef = useRef<string | null>(null);
  const segments = useSegments();
  const rootSegment = segments[0];
  const [webAuthReady, setWebAuthReady] = useState(false);

  useEffect(() => {
    const route = String(rootSegment ?? "");
    if (route === "login" || route === "signup" || route === "verify-email") {
      setWebAuthReady(true);
      return;
    }

    let cancelled = false;
    if (!getAuthenticatedAccount()) {
      setWebAuthReady(false);
    }

    const protectVariantRoute = async () => {
      const account = await waitForFirebaseAuthAccount();
      if (cancelled) {
        return;
      }

      const returnTo =
        Platform.OS === "web" && typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/";

      if (!account) {
        hydratedAccountUidRef.current = null;
        await setAuthenticatedAccount(null, false);
        router.replace({ pathname: "/signup", params: { returnTo } } as never);
        return;
      }

      if (!isAccountEmailVerified(account)) {
        hydratedAccountUidRef.current = null;
        await setAuthenticatedAccount(account, false);
        router.replace(getVerifyEmailRoute({ returnTo }) as never);
        return;
      }

      if (hydratedAccountUidRef.current !== account.uid) {
        await completeVerifiedAuthentication(account);
        hydratedAccountUidRef.current = account.uid;
      }

      if (!cancelled) {
        setWebAuthReady(true);
      }
    };

    void protectVariantRoute();
    return () => {
      cancelled = true;
    };
  }, [rootSegment]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.navy).catch(() => undefined);
  }, []);

  useEffect(() => {
    void readAppState().then((state) => preloadAppOpenAd(state.subscriptionTier));

    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if ((previousState === "background" || previousState === "inactive") && nextState === "active") {
        void readAppState().then((state) => showAppOpenAd(state.subscriptionTier));
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!webAuthReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.navy }}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={palette.white} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          title: appVariant.appName,
          contentStyle: {
            backgroundColor: palette.paper,
          },
          animation: "slide_from_right",
        }}
      />
    </>
  );
}

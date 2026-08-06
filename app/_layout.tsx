import { router, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, View } from "react-native";
import { appVariant } from "../lib/app-variant";
import { preloadAppOpenAd, showAppOpenAd } from "../lib/ads";
import { waitForFirebaseAuthAccount } from "../lib/firebase";
import { syncRevenueCatIdentityForAuthentication } from "../lib/revenuecat";
import { readAppState, setAuthenticatedAccount } from "../lib/storage";
import {
  useNotificationNavigation,
  usePendingChallengeWatcher,
  useRemotePushRegistration,
} from "../lib/notifications";
import { palette } from "../lib/theme";

export default function RootLayout() {
  useNotificationNavigation();
  usePendingChallengeWatcher();
  useRemotePushRegistration();
  const appStateRef = useRef(AppState.currentState);
  const hydratedAccountUidRef = useRef<string | null>(null);
  const segments = useSegments();
  const [webAuthReady, setWebAuthReady] = useState(Platform.OS !== "web");

  useEffect(() => {
    if (Platform.OS !== "web") {
      setWebAuthReady(true);
      return;
    }

    const route = segments[0];
    if (route === "login" || route === "signup") {
      setWebAuthReady(true);
      return;
    }

    let cancelled = false;
    setWebAuthReady(false);

    const protectVariantRoute = async () => {
      const account = await waitForFirebaseAuthAccount();
      if (cancelled) {
        return;
      }

      if (!account) {
        hydratedAccountUidRef.current = null;
        await setAuthenticatedAccount(null, false);
        const returnTo =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/";
        router.replace({ pathname: "/signup", params: { returnTo } } as never);
        return;
      }

      if (hydratedAccountUidRef.current !== account.uid) {
        await setAuthenticatedAccount(account, true);
        await syncRevenueCatIdentityForAuthentication(account);
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
  }, [segments]);

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

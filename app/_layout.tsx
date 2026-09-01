import { router, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, View } from "react-native";
import { appVariant } from "../lib/app-variant";
import { preloadAppOpenAd, showAppOpenAd } from "../lib/ads";
import { waitForFirebaseAuthAccount } from "../lib/firebase";
import { syncRevenueCatIdentityForAuthentication } from "../lib/revenuecat";
import { syncAdministrativeProfileForAccount } from "../lib/school-identity";
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
  const [webAuthReady, setWebAuthReady] = useState(Platform.OS !== "web");

  useEffect(() => {
    if (Platform.OS === "web") return;
    // Firebase restores native sessions independently of the local app cache.
    // Reconcile both and refresh administrative roles on every cold start so a
    // newly approved school administrator does not have to sign out first.
    void waitForFirebaseAuthAccount().then(async (account) => {
      if (!account) return;
      await setAuthenticatedAccount(account, true);
      await syncAdministrativeProfileForAccount(account).catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") {
      setWebAuthReady(true);
      return;
    }

    const route = rootSegment;
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
        // A returning web user already has an account-scoped local cache.
        // Restore the route immediately, then refresh cloud state and plan in
        // the background. Explicit sign-in still performs the awaited first
        // cloud merge before it navigates here.
        await setAuthenticatedAccount(account, true);
        // Resolve app-owner/school-admin identity before showing a protected
        // route so a browser refresh cannot briefly downgrade the account.
        await syncAdministrativeProfileForAccount(account).catch(() => undefined);
        void syncRevenueCatIdentityForAuthentication(account);
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

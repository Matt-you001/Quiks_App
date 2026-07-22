import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { appVariant } from "../lib/app-variant";
import { preloadAppOpenAd, showAppOpenAd } from "../lib/ads";
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

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.navy).catch(() => undefined);
  }, []);

  useEffect(() => {
    void preloadAppOpenAd();

    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if ((previousState === "background" || previousState === "inactive") && nextState === "active") {
        void showAppOpenAd();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

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

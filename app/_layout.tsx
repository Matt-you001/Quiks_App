import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { appVariant } from "../lib/app-variant";
import { useNotificationNavigation } from "../lib/notifications";
import { palette } from "../lib/theme";

export default function RootLayout() {
  useNotificationNavigation();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.navy).catch(() => undefined);
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

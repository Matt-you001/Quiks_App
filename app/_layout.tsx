import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { palette } from "../lib/theme";

export default function RootLayout() {
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.navy).catch(() => undefined);
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: palette.paper,
          },
          animation: "slide_from_right",
        }}
      />
    </>
  );
}

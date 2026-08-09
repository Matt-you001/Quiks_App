import { LinearGradient } from "expo-linear-gradient";
import { PropsWithChildren } from "react";
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { palette } from "../lib/theme";
import { VariantSiteHeader } from "./VariantSiteHeader";
import { WebLegalFooter } from "./WebLegalFooter";

interface AppBackgroundProps extends PropsWithChildren {
  scroll?: boolean;
  webContentWidth?: "narrow" | "standard" | "wide";
}

export function AppBackground({ children, scroll = true, webContentWidth = "standard" }: AppBackgroundProps) {
  const { width } = useWindowDimensions();
  const useDesktopShell = width >= 1024;
  const pageContent =
    Platform.OS === "web" ? (
      <View
        style={[
          styles.webContent,
          webContentWidth === "narrow"
            ? styles.webContentNarrow
            : webContentWidth === "wide"
              ? styles.webContentWide
              : styles.webContentStandard,
        ]}
      >
        {children}
      </View>
    ) : (
      children
    );
  const content = (
    <View style={styles.content}>
      <View style={[styles.contentShell, useDesktopShell ? styles.contentShellDesktop : null]}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />
        <VariantSiteHeader />
        {pageContent}
        <WebLegalFooter />
      </View>
    </View>
  );

  return (
    <LinearGradient colors={[palette.gradientTop, palette.gradientMid, palette.gradientBottom]} style={styles.fill}>
      <SafeAreaView style={styles.fill}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  contentShell: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 4,
    position: "relative",
  },
  contentShellDesktop: {
    alignSelf: "center",
    maxWidth: 1200,
  },
  webContent: {
    width: "100%",
    flexGrow: 1,
    alignSelf: "center",
  },
  webContentNarrow: {
    maxWidth: 576,
  },
  webContentStandard: {
    maxWidth: 728,
  },
  webContentWide: {
    maxWidth: 1200,
  },
  glowTop: {
    position: "absolute",
    top: 28,
    right: -12,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: palette.glowTop,
  },
  glowBottom: {
    position: "absolute",
    bottom: 70,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: palette.glowBottom,
  },
});

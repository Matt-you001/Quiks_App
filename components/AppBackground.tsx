import { LinearGradient } from "expo-linear-gradient";
import { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { palette } from "../lib/theme";

interface AppBackgroundProps extends PropsWithChildren {
  scroll?: boolean;
}

export function AppBackground({ children, scroll = true }: AppBackgroundProps) {
  const content = (
    <View style={styles.content}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      {children}
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
    paddingHorizontal: 20,
    paddingBottom: 28,
    position: "relative",
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

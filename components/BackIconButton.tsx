import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Platform, StyleSheet, ViewStyle } from "react-native";
import { palette } from "../lib/theme";

interface BackIconButtonProps {
  fallbackHref?: string;
  style?: ViewStyle;
}

export function BackIconButton({ fallbackHref = "/", style }: BackIconButtonProps) {
  const handlePress = () => {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.replace(fallbackHref as never);
  };

  return (
    <Pressable onPress={handlePress} style={[styles.button, style]}>
      <MaterialCommunityIcons name="arrow-left" size={22} color={palette.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(7, 39, 46, 0.34)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 10,
  },
});

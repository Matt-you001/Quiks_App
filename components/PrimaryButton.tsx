import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextStyle, ViewStyle } from "react-native";
import { palette } from "../lib/theme";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  compact?: boolean;
}

export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
  labelStyle,
  compact,
}: PrimaryButtonProps) {
  const variantStyle = styles[variant];
  const textStyle = styles[`${variant}Text` as const];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        Platform.OS === "web" ? styles.webBase : null,
        compact ? styles.compactBase : null,
        variantStyle,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "ghost" ? palette.navy : palette.white} />
      ) : (
        <Text numberOfLines={1} style={[textStyle, compact ? styles.compactText : null, labelStyle]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  webBase: {
    width: "100%",
    maxWidth: 288,
    alignSelf: "center",
  },
  compactBase: {
    minHeight: 32,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  primary: {
    backgroundColor: palette.navy,
  },
  secondary: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: "rgba(8, 17, 31, 0.08)",
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(11, 31, 51, 0.16)",
  },
  primaryText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryText: {
    color: palette.navy,
    fontSize: 16,
    fontWeight: "700",
  },
  ghostText: {
    color: palette.navy,
    fontSize: 16,
    fontWeight: "700",
  },
  compactText: {
    fontSize: 12,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.6,
  },
});

import { StyleSheet, Text, View } from "react-native";
import { palette } from "../lib/theme";

interface StatPillProps {
  label: string;
  value: string;
}

export function StatPill({ label, value }: StatPillProps) {
  return (
    <View style={styles.pill}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minWidth: 104,
  },
  value: {
    color: palette.navy,
    fontSize: 20,
    fontWeight: "800",
  },
  label: {
    color: palette.slate,
    fontSize: 12,
    marginTop: 4,
  },
});

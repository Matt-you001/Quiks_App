import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "./PrimaryButton";
import { palette, shadows } from "../lib/theme";

interface PremiumFeatureDialogProps {
  visible: boolean;
  title: string;
  message: string;
  upgradeLabel: string;
  cancelLabel: string;
  onUpgrade: () => void;
  onClose: () => void;
}

export function PremiumFeatureDialog({
  visible,
  title,
  message,
  upgradeLabel,
  cancelLabel,
  onUpgrade,
  onClose,
}: PremiumFeatureDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>PRO</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <PrimaryButton label={upgradeLabel} onPress={onUpgrade} />
          <PrimaryButton label={cancelLabel} variant="ghost" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(8, 20, 36, 0.62)",
  },
  card: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    borderRadius: 26,
    padding: 22,
    gap: 14,
    backgroundColor: palette.white,
    ...shadows.card,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: palette.mint,
  },
  badgeText: {
    color: palette.navy,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: {
    color: palette.ink,
    fontSize: 23,
    fontWeight: "900",
  },
  message: {
    color: palette.slate,
    fontSize: 16,
    lineHeight: 24,
  },
});

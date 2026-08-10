import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { palette, shadows } from "../lib/theme";
import { PrimaryButton } from "./PrimaryButton";

interface ReviewPromptDialogProps {
  visible: boolean;
  title: string;
  message: string;
  reviewLabel: string;
  laterLabel: string;
  onReview: () => void;
  onLater: () => void;
}

export function ReviewPromptDialog({
  visible,
  title,
  message,
  reviewLabel,
  laterLabel,
  onReview,
  onLater,
}: ReviewPromptDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <Pressable style={styles.backdrop} onPress={onLater}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <View style={styles.iconCircle}><Text style={styles.icon}>★</Text></View>
          <Text style={styles.stars}>★★★★★</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <PrimaryButton label={reviewLabel} onPress={onReview} />
          <PrimaryButton label={laterLabel} variant="ghost" onPress={onLater} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(8, 20, 36, 0.62)" },
  card: { width: "100%", maxWidth: 460, alignSelf: "center", alignItems: "stretch", borderRadius: 26, padding: 22, gap: 12, backgroundColor: palette.white, ...shadows.card },
  iconCircle: { width: 62, height: 62, alignSelf: "center", borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: palette.mint },
  icon: { color: palette.navy, fontSize: 30, fontWeight: "900" },
  stars: { color: palette.warn, fontSize: 24, letterSpacing: 3, textAlign: "center", fontWeight: "900" },
  title: { color: palette.ink, fontSize: 23, textAlign: "center", fontWeight: "900" },
  message: { color: palette.slate, fontSize: 16, lineHeight: 24, textAlign: "center", marginBottom: 4 },
});

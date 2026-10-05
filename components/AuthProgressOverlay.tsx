import { useEffect, useRef } from "react";
import { Animated, Easing, Modal, StyleSheet, Text, View } from "react-native";
import { appVariant } from "../lib/app-variant";
import { palette, shadows } from "../lib/theme";

interface AuthProgressOverlayProps {
  visible: boolean;
  title: string;
  message: string;
}

export function AuthProgressOverlay({ visible, title, message }: AuthProgressOverlayProps) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      spin.setValue(0);
      pulse.setValue(0);
      return;
    }

    const spinAnimation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    spinAnimation.start();
    pulseAnimation.start();
    return () => {
      spinAnimation.stop();
      pulseAnimation.stop();
    };
  }, [pulse, spin, visible]);

  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const markScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.75] });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={styles.backdrop} accessibilityViewIsModal accessibilityLiveRegion="polite">
        <View style={styles.card}>
          <View style={styles.animationWrap}>
            <Animated.View style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: markScale }] }]} />
            <Animated.View style={[styles.orbit, { transform: [{ rotate: rotation }] }]}>
              <View style={styles.orbitDot} />
            </Animated.View>
            <Animated.View style={[styles.mark, { transform: [{ scale: markScale }] }]}>
              <Text style={styles.markText}>Q</Text>
            </Animated.View>
          </View>
          <Text style={styles.brand}>{appVariant.appName}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(8, 17, 31, 0.66)",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 30,
    backgroundColor: palette.white,
    ...shadows.card,
  },
  animationWrap: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: palette.aqua,
  },
  orbit: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: palette.mist,
  },
  orbitDot: {
    position: "absolute",
    top: -6,
    left: 42,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.aqua,
  },
  mark: {
    width: 66,
    height: 66,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.navy,
  },
  markText: {
    color: palette.white,
    fontSize: 38,
    fontWeight: "900",
  },
  brand: {
    marginTop: 14,
    color: palette.aqua,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 8,
    color: palette.ink,
    fontSize: 23,
    fontWeight: "900",
    textAlign: "center",
  },
  message: {
    marginTop: 8,
    color: palette.slate,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});

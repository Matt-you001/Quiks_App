import { FontAwesome6 } from "@expo/vector-icons";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { appVariant } from "../lib/app-variant";
import { palette } from "../lib/theme";

const mobileAppLinks = {
  children: "https://play.google.com/store/apps/details?id=com.quiks.mobile",
  teens: "https://play.google.com/store/apps/details?id=com.quiks.teens",
  uni: "https://play.google.com/store/apps/details?id=com.quiks.uni",
} as const;

const legalLinks = [
  { label: "Pricing", href: "https://quiks.site/pricing.html" },
  { label: "Terms", href: "https://quiks.site/terms.html" },
  { label: "Privacy", href: "https://quiks.site/privacy.html" },
  { label: "Refund", href: "https://quiks.site/refund.html" },
  { label: "Support", href: "https://quiks.site/contact.html" },
];

export function WebLegalFooter() {
  if (Platform.OS !== "web") {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.brand}>Tech Solution Providers Ltd</Text>

      <View style={styles.downloadSection}>
        <Text style={styles.downloadTitle}>Download App</Text>
        <View style={styles.storeButtons}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Download ${appVariant.appName} for Android`}
            onPress={() => {
              void Linking.openURL(mobileAppLinks[appVariant.id]);
            }}
            style={({ pressed }) => [styles.storeButton, styles.androidButton, pressed ? styles.storeButtonPressed : null]}
          >
            <FontAwesome6 name="android" size={22} color="#FFFFFF" />
            <View>
              <Text style={styles.storeEyebrow}>GET IT ON</Text>
              <Text style={styles.storeName}>Android</Text>
            </View>
          </Pressable>

          <View
            accessibilityLabel={`${appVariant.appName} for iOS is coming soon`}
            accessibilityState={{ disabled: true }}
            style={[styles.storeButton, styles.iosButton]}
          >
            <FontAwesome6 name="apple" size={24} color="#FFFFFF" />
            <View>
              <Text style={styles.storeEyebrow}>COMING SOON ON</Text>
              <Text style={styles.storeName}>iOS</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.links}>
        {legalLinks.map((link) => (
          <Text
            key={link.label}
            accessibilityRole="link"
            style={styles.link}
            onPress={() => {
              void Linking.openURL(link.href);
            }}
          >
            {link.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 24,
    marginBottom: 8,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: palette.navy,
    alignItems: "center",
    gap: 16,
  },
  brand: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  downloadSection: {
    width: "100%",
    alignItems: "center",
    gap: 10,
  },
  downloadTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  storeButtons: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  storeButton: {
    minWidth: 154,
    minHeight: 58,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  androidButton: {
    backgroundColor: "#237A45",
  },
  iosButton: {
    backgroundColor: "#111827",
  },
  storeButtonPressed: {
    opacity: 0.82,
  },
  storeEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  storeName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 1,
  },
  links: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 14,
  },
  link: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
});

import { Linking, Platform, StyleSheet, Text, View } from "react-native";
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
  { label: "Download App", href: mobileAppLinks[appVariant.id] },
  { label: "Support", href: "https://quiks.site/contact.html" },
];

export function WebLegalFooter() {
  if (Platform.OS !== "web") {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.brand}>Tech Solution Providers Ltd</Text>
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
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    gap: 10,
  },
  brand: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  links: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 14,
  },
  link: {
    color: palette.white,
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});

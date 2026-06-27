import { router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View, Image, useWindowDimensions } from "react-native";
import { appVariant } from "../lib/app-variant";
import { palette } from "../lib/theme";

const headerLogos = {
  children: require("../assets/images/quiks-children-playstore-icon-512.png"),
  teens: require("../assets/images/quiks-teens-playstore-icon-512.png"),
  uni: require("../assets/images/quiks-uni-playstore-icon-512.png"),
} as const;

const mobileAppLinks = {
  children: "https://play.google.com/store/apps/details?id=com.quiks.mobile",
  teens: "https://play.google.com/store/apps/details?id=com.quiks.teens",
  uni: "https://play.google.com/store/apps/details?id=com.quiks.uni",
} as const;

const sharedLinks = [
  { label: "Home", href: "/" },
  { label: "Profile", href: "/profile" },
  { label: "Subscription", href: "/subscription" },
] as const;

const advancedLinks = [
  { label: "Classroom", href: "/classroom" },
  { label: "Competition", href: "/competition" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function VariantSiteHeader() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);
  const internalLinks = appVariant.id === "children" ? sharedLinks : [...sharedLinks.slice(0, 2), ...advancedLinks, sharedLinks[2]];
  const isCompact = width < 920;

  if (Platform.OS !== "web") {
    return null;
  }

  useEffect(() => {
    if (!isCompact) {
      setMenuOpen(false);
    }
  }, [isCompact]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <Pressable onPress={() => router.push("/" as never)} style={styles.brand}>
          <Image source={headerLogos[appVariant.id]} style={styles.logo} resizeMode="cover" />
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandName}>{appVariant.appName}</Text>
            <Text style={styles.brandTag}>Learn fast. Grow steady.</Text>
          </View>
        </Pressable>

        {isCompact ? (
          <Pressable
            onPress={() => setMenuOpen((current) => !current)}
            style={[styles.menuButton, menuOpen ? styles.menuButtonActive : null]}
            accessibilityRole="button"
            accessibilityLabel={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            <Text style={styles.menuButtonText}>{menuOpen ? "×" : "≡"}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.nav, isCompact ? styles.navCompact : null, isCompact && !menuOpen ? styles.navHidden : null]}>
        {internalLinks.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Pressable
              key={link.href}
              onPress={() => {
                setMenuOpen(false);
                router.push(link.href as never);
              }}
              style={[styles.navLink, isCompact ? styles.navLinkCompact : null, active ? styles.navLinkActive : null]}
            >
              <Text style={[styles.navText, active ? styles.navTextActive : null]}>{link.label}</Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => {
            setMenuOpen(false);
            void Linking.openURL(mobileAppLinks[appVariant.id]);
          }}
          style={[styles.navLink, isCompact ? styles.navLinkCompact : null]}
        >
          <Text style={styles.navText}>Download App</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setMenuOpen(false);
            void Linking.openURL("https://quiks.site/contact.html");
          }}
          style={[styles.navLink, isCompact ? styles.navLinkCompact : null]}
        >
          <Text style={styles.navText}>Support</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 10,
    marginBottom: 18,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: "rgba(8, 26, 33, 0.28)",
    gap: 16,
  },
  headerTopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 18,
  },
  brandTextWrap: {
    gap: 4,
  },
  brandName: {
    color: palette.white,
    fontSize: 28,
    fontWeight: "900",
  },
  brandTag: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 15,
    fontWeight: "600",
  },
  nav: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  navCompact: {
    width: "100%",
    justifyContent: "flex-start",
  },
  navHidden: {
    display: "none",
  },
  navLink: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  navLinkCompact: {
    width: "100%",
  },
  navLinkActive: {
    backgroundColor: palette.navy,
    borderColor: "rgba(255,255,255,0.12)",
  },
  navText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: "800",
  },
  navTextActive: {
    color: palette.white,
  },
  menuButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  menuButtonActive: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  menuButtonText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: "800",
  },
});

import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { appVariant } from "../lib/app-variant";
import { getBannerAdUnitId, getMobileAdsModule, initializeMobileAds } from "../lib/ads";
import { t } from "../lib/i18n";
import { palette, shadows } from "../lib/theme";
import type { AppLanguage } from "../types/app";

type DemoAdBannerProps = {
  language: AppLanguage;
};

export function DemoAdBanner({ language }: DemoAdBannerProps) {
  const [nativeAdsReady, setNativeAdsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    initializeMobileAds().then((ready) => {
      if (!cancelled) {
        setNativeAdsReady(ready);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (appVariant.id === "children") {
    return null;
  }

  const mobileAds = getMobileAdsModule();
  if (mobileAds && nativeAdsReady) {
    const { BannerAd, BannerAdSize } = mobileAds;

    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Sponsored</Text>
        <Text style={styles.title}>{t(language, "sponsoredLearningSpot")}</Text>
        <View style={styles.bannerWrap}>
          <BannerAd
            unitId={getBannerAdUnitId(mobileAds)}
            size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Sponsored</Text>
      <Text style={styles.title}>{t(language, "sponsoredLearningSpot")}</Text>
      <Text style={styles.text}>{t(language, "demoAdBannerHint")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E8D398",
    backgroundColor: "#FFF7E4",
    padding: 18,
    ...shadows.card,
  },
  eyebrow: {
    color: "#8B5E00",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 8,
  },
  text: {
    color: palette.slate,
    lineHeight: 22,
    marginTop: 8,
  },
  bannerWrap: {
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFDF8",
  },
});

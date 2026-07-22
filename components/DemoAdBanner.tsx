import { type ReactElement, useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { appVariant } from "../lib/app-variant";
import { getBannerAdUnitId, getMobileAdsModule, getNativeAdUnitId, initializeMobileAds } from "../lib/ads";
import { t } from "../lib/i18n";
import { palette, shadows } from "../lib/theme";
import type { AppLanguage } from "../types/app";

type DemoAdBannerProps = {
  language: AppLanguage;
};

export function DemoAdBanner({ language }: DemoAdBannerProps) {
  const [adsReady, setAdsReady] = useState(false);
  const [nativeAd, setNativeAd] = useState<unknown | null>(null);
  const isWeb = Platform.OS === "web";

  useEffect(() => {
    if (isWeb) {
      return;
    }

    let cancelled = false;

    initializeMobileAds().then((ready) => {
      if (!cancelled) {
        setAdsReady(ready);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isWeb]);

  useEffect(() => {
    if (isWeb) {
      return;
    }

    const mobileAds = getMobileAdsModule();
    if (!mobileAds || !adsReady) {
      return;
    }

    let cancelled = false;

    mobileAds.NativeAd.createForAdRequest(getNativeAdUnitId(mobileAds), {
      requestNonPersonalizedAdsOnly: true,
    })
      .then((loadedAd) => {
        if (!cancelled) {
          setNativeAd(loadedAd);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNativeAd(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adsReady, isWeb]);

  if (appVariant.id === "children") {
    return null;
  }

  if (isWeb) {
    const placeholderId = appVariant.id === "teens" ? "adsense-slot-teens-banner" : "adsense-slot-uni-banner";

    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{t(language, "sponsoredLearningSpot")}</Text>
        <Text style={styles.title}>{t(language, "sponsoredLearningSpot")}</Text>
        <Text style={styles.text}>
          This web slot is prepared for Google AdSense deployment on {appVariant.appName}. Replace the placeholder with
          your live script and slot ID when approval is complete.
        </Text>
        <View nativeID={placeholderId} style={styles.webSlot}>
          <Text style={styles.webSlotLabel}>AdSense-ready banner</Text>
          <Text style={styles.webSlotMeta}>{placeholderId}</Text>
          <Text style={styles.webSlotHint}>Teens and Uni web only</Text>
        </View>
      </View>
    );
  }

  const mobileAds = getMobileAdsModule();
  if (mobileAds && adsReady) {
    const { BannerAd, BannerAdSize } = mobileAds;

    let nativeAdCard: ReactElement | null = null;

    if (nativeAd) {
      try {
        const adsPackage = require("react-native-google-mobile-ads") as any;

        const { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } = adsPackage;
        const adData = nativeAd as {
          headline?: string;
          body?: string;
          callToAction?: string;
          advertiser?: string;
        };

        nativeAdCard = (
          <NativeAdView nativeAd={nativeAd} style={styles.nativeCard}>
            <Text style={styles.nativeBadge}>Sponsored</Text>
            <NativeMediaView style={styles.nativeMedia} />
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.nativeHeadline}>{adData.headline || t(language, "sponsoredLearningSpot")}</Text>
            </NativeAsset>
            {adData.body ? (
              <NativeAsset assetType={NativeAssetType.BODY}>
                <Text style={styles.nativeBody}>{adData.body}</Text>
              </NativeAsset>
            ) : null}
            <View style={styles.nativeFooter}>
              {adData.advertiser ? <Text style={styles.nativeAdvertiser}>{adData.advertiser}</Text> : <View />}
              {adData.callToAction ? (
                <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
                  <View style={styles.nativeCtaWrap}>
                    <Text style={styles.nativeCtaText}>{adData.callToAction}</Text>
                  </View>
                </NativeAsset>
              ) : null}
            </View>
          </NativeAdView>
        );
      } catch {
        nativeAdCard = null;
      }
    }

    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{t(language, "sponsoredLearningSpot")}</Text>
        <Text style={styles.title}>{t(language, "sponsoredLearningSpot")}</Text>
        {nativeAdCard}
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
      <Text style={styles.eyebrow}>{t(language, "sponsoredLearningSpot")}</Text>
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
  nativeCard: {
    marginTop: 14,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 10,
  },
  nativeBadge: {
    color: "#8B5E00",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  nativeMedia: {
    width: "100%",
    minHeight: 160,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
  },
  nativeHeadline: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  nativeBody: {
    color: palette.slate,
    fontSize: 14,
    lineHeight: 20,
  },
  nativeFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  nativeAdvertiser: {
    color: palette.slate,
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  nativeCtaWrap: {
    borderRadius: 999,
    backgroundColor: palette.navy,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  nativeCtaText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  webSlot: {
    marginTop: 14,
    minHeight: 110,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.navy,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 6,
  },
  webSlotLabel: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  webSlotMeta: {
    color: palette.navy,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  webSlotHint: {
    color: palette.slate,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});

import { type ReactElement, useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { appVariant } from "../lib/app-variant";
import { getBannerAdUnitId, getMobileAdsModule, getNativeAdUnitId, initializeMobileAds } from "../lib/ads";
import { t } from "../lib/i18n";
import { palette, shadows } from "../lib/theme";
import type { AppLanguage } from "../types/app";

type DemoAdBannerProps = {
  language: AppLanguage;
  format?: "banner" | "native";
  compact?: boolean;
};

export function DemoAdBanner({ language, format = "native", compact = false }: DemoAdBannerProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [adsReady, setAdsReady] = useState(false);
  const [initializationFinished, setInitializationFinished] = useState(false);
  const [initializationRetryKey, setInitializationRetryKey] = useState(0);
  const [bannerLoadFailed, setBannerLoadFailed] = useState(false);
  const [bannerRetryKey, setBannerRetryKey] = useState(0);
  const [bannerDimensions, setBannerDimensions] = useState<{ width: number; height: number } | null>(null);
  const [nativeAd, setNativeAd] = useState<unknown | null>(null);
  const isWeb = Platform.OS === "web";
  const minimumBannerWidth = Math.min(320, windowWidth);
  const bannerWidth = Math.max(
    1,
    Math.floor(Math.min(Math.max(windowWidth - 40, minimumBannerWidth), 1200))
  );
  const useAdaptiveBanner = !compact;

  useEffect(() => {
    if (isWeb) {
      return;
    }

    let cancelled = false;

    initializeMobileAds()
      .then((ready) => {
        if (!cancelled) {
          setAdsReady(ready);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInitializationFinished(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initializationRetryKey, isWeb]);

  useEffect(() => {
    if (isWeb || adsReady || !initializationFinished) {
      return;
    }

    const retryTimer = setTimeout(() => {
      setInitializationFinished(false);
      setInitializationRetryKey((currentKey) => currentKey + 1);
    }, 30_000);

    return () => clearTimeout(retryTimer);
  }, [adsReady, initializationFinished, isWeb]);

  useEffect(() => {
    if (isWeb || format !== "native") {
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
  }, [adsReady, format, isWeb]);

  useEffect(() => {
    if (!bannerLoadFailed || format !== "banner" || isWeb) {
      return;
    }

    const retryTimer = setTimeout(() => {
      setBannerLoadFailed(false);
      setBannerDimensions(null);
      setBannerRetryKey((currentKey) => currentKey + 1);
    }, 30_000);

    return () => clearTimeout(retryTimer);
  }, [bannerLoadFailed, format, isWeb]);

  if (appVariant.id === "children" && !isWeb) {
    return null;
  }

  if (isWeb) {
    return null;
  }

  const mobileAds = getMobileAdsModule();
  if (mobileAds && adsReady) {
    const { BannerAd, BannerAdSize } = mobileAds;

    if (format === "banner" && bannerLoadFailed) {
      return compact ? <View style={styles.compactLoadingSlot} /> : null;
    }

    let nativeAdCard: ReactElement | null = null;

    if (nativeAd) {
      const { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } = mobileAds;
      if (NativeAdView && NativeAsset && NativeAssetType && NativeMediaView) {
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
      }
    }

    return (
      <View
        style={[
          styles.card,
          format === "banner" ? styles.bannerCard : null,
          compact ? styles.compactCard : null,
        ]}
      >
        {format === "native" && !compact ? (
          <Text style={styles.eyebrow}>{t(language, "sponsoredLearningSpot")}</Text>
        ) : null}
        {format === "native" && !compact ? (
          <Text style={styles.title}>{t(language, "sponsoredLearningSpot")}</Text>
        ) : null}
        {format === "native" ? nativeAdCard : (
          <View
            style={[
              styles.bannerWrap,
              compact ? styles.compactBannerWrap : null,
              bannerDimensions ? { minHeight: bannerDimensions.height } : null,
            ]}
          >
            <BannerAd
              key={bannerRetryKey}
              unitId={getBannerAdUnitId(mobileAds, useAdaptiveBanner)}
              size={useAdaptiveBanner ? BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER : BannerAdSize.BANNER}
              width={useAdaptiveBanner ? bannerWidth : undefined}
              requestOptions={{ requestNonPersonalizedAdsOnly: true }}
              onAdLoaded={(dimensions) => {
                setBannerDimensions(dimensions);
                setBannerLoadFailed(false);
              }}
              onAdFailedToLoad={(error) => {
                console.warn(
                  `AdMob banner failed to load for ${appVariant.id} (${getBannerAdUnitId(mobileAds, useAdaptiveBanner)}):`,
                  error
                );
                setBannerLoadFailed(true);
              }}
            />
          </View>
        )}
      </View>
    );
  }

  if (!initializationFinished || (format === "banner" && !bannerLoadFailed)) {
    return compact ? <View style={styles.compactLoadingSlot} /> : null;
  }

  return (
    <View
      style={[
        styles.card,
        format === "banner" ? styles.bannerCard : null,
        compact ? styles.compactCard : null,
      ]}
    >
      {format === "native" && !compact ? (
        <Text style={styles.eyebrow}>{t(language, "sponsoredLearningSpot")}</Text>
      ) : null}
      {format === "native" && !compact ? (
        <Text style={styles.title}>{t(language, "sponsoredLearningSpot")}</Text>
      ) : null}
      {format === "native" && !compact ? <Text style={styles.text}>{t(language, "demoAdBannerHint")}</Text> : null}
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
  bannerCard: {
    width: "100%",
    minHeight: 50,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    padding: 0,
    alignItems: "center",
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  compactCard: {
    height: 54,
    minHeight: 50,
    marginTop: 0,
    borderRadius: 8,
    padding: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
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
    width: "100%",
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  compactBannerWrap: {
    width: "100%",
    height: 50,
    minHeight: 50,
    marginTop: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  compactLoadingSlot: {
    minHeight: 50,
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
    aspectRatio: 1.91,
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
  compactWebSlot: {
    width: "100%",
    height: 50,
    minHeight: 50,
    marginTop: 0,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  webSlotLabel: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  compactWebSlotLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
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

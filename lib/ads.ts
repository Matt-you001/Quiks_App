import Constants from "expo-constants";
import type { ComponentType } from "react";
import { Platform } from "react-native";
import { appVariant } from "./app-variant";
import type { SubscriptionTier } from "../types/app";

type MobileAdsModule = {
  TestIds: {
    ADAPTIVE_BANNER: string;
    INTERSTITIAL: string;
  };
  BannerAd: ComponentType<{
    unitId: string;
    size: string;
    requestOptions?: {
      requestNonPersonalizedAdsOnly?: boolean;
    };
  }>;
  BannerAdSize: {
    LARGE_ANCHORED_ADAPTIVE_BANNER: string;
  };
  InterstitialAd: {
    createForAdRequest: (
      unitId: string,
      options?: { requestNonPersonalizedAdsOnly?: boolean }
    ) => {
      addAdEventListener: (event: string, listener: () => void) => () => void;
      show: () => void;
      load: () => void;
    };
  };
  AdEventType: {
    LOADED: string;
    CLOSED: string;
    ERROR: string;
  };
  default: () => {
    initialize: () => Promise<unknown>;
  };
};

const fallbackAdsConfig = {
  EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: "ca-app-pub-3940256099942544~3347511713",
  EXPO_PUBLIC_ADMOB_IOS_APP_ID: "ca-app-pub-3940256099942544~1458002511",
  EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: "",
  EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID: "",
} as const;

const extra = {
  ...(Constants.expoConfig?.extra ?? {}),
  ...(((Constants as unknown as { manifest?: { extra?: Record<string, string | undefined> } }).manifest?.extra ?? {})),
  ...(
    (
      Constants as unknown as {
        manifest2?: {
          extra?: {
            expoClient?: {
              extra?: Record<string, string | undefined>;
            };
          };
        };
      }
    ).manifest2?.extra?.expoClient?.extra ?? {}
  ),
} as Record<string, string | undefined>;

function normalizeEnvValue(value?: string) {
  if (!value) {
    return undefined;
  }

  return value.replace(/^"(.*)"$/, "$1");
}

const adsConfig = {
  bannerUnitId: normalizeEnvValue(
    process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID ??
      extra.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID ??
      fallbackAdsConfig.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID
  ),
  interstitialUnitId: normalizeEnvValue(
    process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID ??
      extra.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID ??
      fallbackAdsConfig.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID
  ),
  interstitialEnabled:
    normalizeEnvValue(
      process.env.EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS ??
        extra.EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS ??
        "false"
    ) === "true",
};

let mobileAdsInitPromise: Promise<boolean> | null = null;

export function canShowAds(subscriptionTier: SubscriptionTier) {
  return appVariant.id !== "children" && subscriptionTier === "free";
}

export function getMobileAdsModule(): MobileAdsModule | null {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    return require("react-native-google-mobile-ads") as MobileAdsModule;
  } catch {
    return null;
  }
}

export function getBannerAdUnitId(module: MobileAdsModule) {
  return adsConfig.bannerUnitId || module.TestIds.ADAPTIVE_BANNER;
}

export function getInterstitialAdUnitId(module: MobileAdsModule) {
  return adsConfig.interstitialUnitId || module.TestIds.INTERSTITIAL;
}

export async function initializeMobileAds() {
  if (appVariant.id === "children" || Platform.OS === "web") {
    return false;
  }

  const mobileAds = getMobileAdsModule();
  if (!mobileAds) {
    return false;
  }

  if (!mobileAdsInitPromise) {
    mobileAdsInitPromise = mobileAds
      .default()
      .initialize()
      .then(() => true)
      .catch(() => false);
  }

  return mobileAdsInitPromise;
}

export async function showInterstitialAd() {
  if (!adsConfig.interstitialEnabled || Platform.OS === "web") {
    return false;
  }

  const mobileAds = getMobileAdsModule();
  if (!mobileAds) {
    return false;
  }

  const initialized = await initializeMobileAds();
  if (!initialized) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    const interstitial = mobileAds.InterstitialAd.createForAdRequest(getInterstitialAdUnitId(mobileAds), {
      requestNonPersonalizedAdsOnly: true,
    });
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    };

    const finish = (didShow: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(didShow);
    };

    const unsubscribeLoaded = interstitial.addAdEventListener(mobileAds.AdEventType.LOADED, () => {
      try {
        interstitial.show();
      } catch {
        finish(false);
      }
    });
    const unsubscribeClosed = interstitial.addAdEventListener(mobileAds.AdEventType.CLOSED, () => {
      finish(true);
    });
    const unsubscribeError = interstitial.addAdEventListener(mobileAds.AdEventType.ERROR, () => {
      finish(false);
    });

    timeoutHandle = setTimeout(() => finish(false), 15000);
    interstitial.load();
  });
}

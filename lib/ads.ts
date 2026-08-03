import Constants from "expo-constants";
import type { ComponentType } from "react";
import { Platform } from "react-native";
import { appVariant } from "./app-variant";
import { readAppState } from "./storage";
import type { SubscriptionTier } from "../types/app";

type MobileAdsModule = {
  TestIds: {
    ADAPTIVE_BANNER: string;
    BANNER: string;
    INTERSTITIAL: string;
    NATIVE: string;
    APP_OPEN: string;
  };
  BannerAd: ComponentType<{
    unitId: string;
    size: string;
    width?: number;
    requestOptions?: {
      requestNonPersonalizedAdsOnly?: boolean;
    };
    onAdLoaded?: (dimensions: { width: number; height: number }) => void;
    onAdFailedToLoad?: (error: Error) => void;
  }>;
  BannerAdSize: {
    BANNER: string;
    ANCHORED_ADAPTIVE_BANNER: string;
    LARGE_ANCHORED_ADAPTIVE_BANNER: string;
  };
  NativeAdView?: ComponentType<any>;
  NativeAsset?: ComponentType<any>;
  NativeMediaView?: ComponentType<any>;
  NativeAssetType?: {
    HEADLINE: string;
    BODY: string;
    CALL_TO_ACTION: string;
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
  AppOpenAd: {
    createForAdRequest: (
      unitId: string,
      options?: { requestNonPersonalizedAdsOnly?: boolean }
    ) => {
      addAdEventListener: (event: string, listener: () => void) => () => void;
      show: () => void;
      load: () => void;
    };
  };
  NativeAd: {
    createForAdRequest: (
      unitId: string,
      options?: { requestNonPersonalizedAdsOnly?: boolean }
    ) => Promise<unknown>;
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
  EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID: "",
  EXPO_PUBLIC_ADMOB_APP_OPEN_UNIT_ID: "",
} as const;

const variantAdUnitFallbacks = {
  children: {
    bannerUnitId: "",
    interstitialUnitId: "",
    nativeUnitId: "",
    appOpenUnitId: "",
  },
  teens: {
    bannerUnitId: "ca-app-pub-8208154537756936/6053620064",
    interstitialUnitId: "ca-app-pub-8208154537756936/1933612894",
    nativeUnitId: "ca-app-pub-8208154537756936/8641244637",
    appOpenUnitId: "ca-app-pub-8208154537756936/9717532902",
  },
  uni: {
    bannerUnitId: "",
    interstitialUnitId: "",
    nativeUnitId: "",
    appOpenUnitId: "",
  },
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
  bannerUnitId:
    variantAdUnitFallbacks[appVariant.id].bannerUnitId ||
    normalizeEnvValue(extra.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID ?? process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID),
  interstitialUnitId:
    variantAdUnitFallbacks[appVariant.id].interstitialUnitId ||
    normalizeEnvValue(extra.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID ?? process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID),
  nativeUnitId:
    variantAdUnitFallbacks[appVariant.id].nativeUnitId ||
    normalizeEnvValue(extra.EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID ?? process.env.EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID),
  appOpenUnitId:
    variantAdUnitFallbacks[appVariant.id].appOpenUnitId ||
    normalizeEnvValue(extra.EXPO_PUBLIC_ADMOB_APP_OPEN_UNIT_ID ?? process.env.EXPO_PUBLIC_ADMOB_APP_OPEN_UNIT_ID),
  interstitialEnabled:
    normalizeEnvValue(
      process.env[`EXPO_PUBLIC_${appVariant.id.toUpperCase()}_ENABLE_INTERSTITIAL_ADS`] ??
        extra.EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS ??
        process.env.EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS ??
        "false"
    ) === "true",
};

let mobileAdsInitPromise: Promise<boolean> | null = null;
let appOpenAdLoaded = false;
let appOpenAdLoading = false;
let appOpenAdInstance: {
  show: () => void;
  load: () => void;
  addAdEventListener: (event: string, listener: () => void) => () => void;
} | null = null;
let lastAppOpenShownAt = 0;

const APP_OPEN_COOLDOWN_MS = 3 * 60 * 1000;

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

export function getBannerAdUnitId(module: MobileAdsModule, adaptive = true) {
  if (__DEV__) {
    return adaptive ? module.TestIds.ADAPTIVE_BANNER : module.TestIds.BANNER;
  }

  return adsConfig.bannerUnitId || (adaptive ? module.TestIds.ADAPTIVE_BANNER : module.TestIds.BANNER);
}

export function getInterstitialAdUnitId(module: MobileAdsModule) {
  return adsConfig.interstitialUnitId || module.TestIds.INTERSTITIAL;
}

export function getNativeAdUnitId(module?: MobileAdsModule) {
  return adsConfig.nativeUnitId || module?.TestIds.NATIVE || "";
}

export function getAppOpenAdUnitId(module?: MobileAdsModule) {
  return adsConfig.appOpenUnitId || module?.TestIds.APP_OPEN || "";
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
      .catch(() => {
        mobileAdsInitPromise = null;
        return false;
      });
  }

  return mobileAdsInitPromise;
}

export async function showInterstitialAd(subscriptionTier: SubscriptionTier) {
  if (!canShowAds(subscriptionTier) || !adsConfig.interstitialEnabled || Platform.OS === "web") {
    return false;
  }

  const storedState = await readAppState();
  if (!canShowAds(storedState.subscriptionTier)) {
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
      void readAppState()
        .then((latestState) => {
          if (!canShowAds(latestState.subscriptionTier)) {
            finish(false);
            return;
          }

          try {
            interstitial.show();
          } catch {
            finish(false);
          }
        })
        .catch(() => finish(false));
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

function ensureAppOpenAdLoaded(mobileAds: MobileAdsModule) {
  if (appOpenAdLoaded || appOpenAdLoading) {
    return;
  }

  appOpenAdLoading = true;
  const appOpenAd = mobileAds.AppOpenAd.createForAdRequest(getAppOpenAdUnitId(mobileAds), {
    requestNonPersonalizedAdsOnly: true,
  });

  appOpenAdInstance = appOpenAd;

  appOpenAd.addAdEventListener(mobileAds.AdEventType.LOADED, () => {
    appOpenAdLoaded = true;
    appOpenAdLoading = false;
  });

  appOpenAd.addAdEventListener(mobileAds.AdEventType.ERROR, () => {
    appOpenAdLoaded = false;
    appOpenAdLoading = false;
  });

  appOpenAd.addAdEventListener(mobileAds.AdEventType.CLOSED, () => {
    appOpenAdLoaded = false;
    appOpenAdLoading = false;
    lastAppOpenShownAt = Date.now();
    ensureAppOpenAdLoaded(mobileAds);
  });

  appOpenAd.load();
}

export async function preloadAppOpenAd(subscriptionTier: SubscriptionTier) {
  if (!canShowAds(subscriptionTier) || !adsConfig.appOpenUnitId || Platform.OS === "web") {
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

  ensureAppOpenAdLoaded(mobileAds);
  return true;
}

export async function showAppOpenAd(subscriptionTier: SubscriptionTier) {
  if (!canShowAds(subscriptionTier) || !adsConfig.appOpenUnitId || Platform.OS === "web") {
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

  if (Date.now() - lastAppOpenShownAt < APP_OPEN_COOLDOWN_MS) {
    ensureAppOpenAdLoaded(mobileAds);
    return false;
  }

  ensureAppOpenAdLoaded(mobileAds);

  if (!appOpenAdLoaded || !appOpenAdInstance) {
    return false;
  }

  try {
    appOpenAdLoaded = false;
    appOpenAdInstance.show();
    return true;
  } catch {
    appOpenAdLoaded = false;
    appOpenAdLoading = false;
    ensureAppOpenAdLoaded(mobileAds);
    return false;
  }
}

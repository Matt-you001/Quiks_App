import type { ExpoConfig } from "expo/config";

type AppVariant = "children" | "teens" | "uni";

const variant = ((process.env.APP_VARIANT ?? "children") as AppVariant);
const variantSubscriptionFallbacks: Record<AppVariant, { monthly: string; yearly: string }> = {
  children: {
    monthly: "pri_01ktmm16hbdzdw2t1k8adnf62p",
    yearly: "pri_01ktmm5s5t0ad93yrdae3rr8vf",
  },
  teens: {
    monthly: "pri_01ktw7bftss9tz8fj059vjnbfy",
    yearly: "pri_01ktw7er8a15qf2d4pw7v0s4b8",
  },
  uni: {
    monthly: "pri_01ktmmh5xf4yn0yn1vwq8pg2rh",
    yearly: "pri_01ktmmm7cmh5tg4tm93cv8pk5e",
  },
};
const variantEntitlementFallbacks: Record<AppVariant, string> = {
  children: "entl5792d09222",
  teens: "entl799f03ddcc",
  uni: "entl5ab41c922b",
};
const variantRevenueCatFallbacks: Record<
  AppVariant,
  {
    androidApiKey: string;
    iosApiKey: string;
    webApiKey: string;
  }
> = {
  children: {
    androidApiKey: "goog_jPXDDFSylXKTcMvzPNPPhTHIyeA",
    iosApiKey: "",
    webApiKey: "pdl_uDcNQNxHeNqGuOkDvOYPPlbVuAyp",
  },
  teens: {
    androidApiKey: "goog_ciDxoaodJlvQwkRHzOEqvZFsktJ",
    iosApiKey: "",
    webApiKey: "pdl_WQjymgirStoqLGNJCSLDrLJqlFJV",
  },
  uni: {
    androidApiKey: "goog_jMWcZCwUSjbsYzrLdmREAjyMNYY",
    iosApiKey: "",
    webApiKey: "pdl_zMZDPBTDiEmPYiEvOBcZSQVGkgpY",
  },
};
const variantPaddleClientTokenFallbacks: Record<AppVariant, string> = {
  children: "live_58cf05e9abc2e3daa263e2d86b1",
  teens: "live_58cf05e9abc2e3daa263e2d86b1",
  uni: "live_58cf05e9abc2e3daa263e2d86b1",
};
const variantAdMobAppIdFallbacks: Record<
  AppVariant,
  {
    androidAppId: string;
    iosAppId: string;
  }
> = {
  children: {
    androidAppId: "ca-app-pub-3940256099942544~3347511713",
    iosAppId: "ca-app-pub-3940256099942544~1458002511",
  },
  teens: {
    androidAppId: "ca-app-pub-8208154537756936~9297449247",
    iosAppId: "ca-app-pub-3940256099942544~1458002511",
  },
  uni: {
    androidAppId: "ca-app-pub-3940256099942544~3347511713",
    iosAppId: "ca-app-pub-3940256099942544~1458002511",
  },
};
const variantAdMobUnitFallbacks: Record<
  AppVariant,
  {
    bannerUnitId: string;
    interstitialUnitId: string;
    nativeUnitId: string;
    appOpenUnitId: string;
  }
> = {
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
};
const variantInterstitialAdsEnabledFallbacks: Record<AppVariant, boolean> = {
  children: false,
  teens: true,
  uni: false,
};
const variantGoogleClientFallbacks: Record<
  AppVariant,
  {
    expoClientId: string;
    androidClientId: string;
    iosClientId: string;
    webClientId: string;
  }
> = {
  children: {
    expoClientId: "",
    androidClientId: "51562512706-nhgm58kmbr32kem4r1dcegiodklerf0v.apps.googleusercontent.com",
    iosClientId: "",
    webClientId: "51562512706-nn2608mm73d6uritkf9363077bkt8o9g.apps.googleusercontent.com",
  },
  teens: {
    expoClientId: "",
    androidClientId: "620960153485-gjk04n3i285iig3t3tu1c5lr76n70b1v.apps.googleusercontent.com",
    iosClientId: "",
    webClientId: "620960153485-d1rstle8l9ou8n9frfv4td102q81b5rj.apps.googleusercontent.com",
  },
  uni: {
    expoClientId: "",
    androidClientId: "656940564357-0nr4qronf5e38t4ki5t7i0ur6thrppg7.apps.googleusercontent.com",
    iosClientId: "",
    webClientId: "656940564357-of0e62ugcgdnb4jt98q7qm80cn2mnr5v.apps.googleusercontent.com",
  },
};
const variantFirebaseFallbacks: Record<
  AppVariant,
  {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  }
> = {
  children: {
    apiKey: "AIzaSyDSICe2NTtANURfwcQPYWlywx3OPiJ7kEA",
    authDomain: "synapse-trainer-y0kk3.firebaseapp.com",
    projectId: "synapse-trainer-y0kk3",
    storageBucket: "synapse-trainer-y0kk3.firebasestorage.app",
    messagingSenderId: "51562512706",
    appId: "1:51562512706:web:6854bbc7b9d26a378a08db",
  },
  teens: {
    apiKey: "AIzaSyCaIDjm7Hn-zeGhwcJJgfOed4XbX_w-Wy0",
    authDomain: "quiks-teens.firebaseapp.com",
    projectId: "quiks-teens",
    storageBucket: "quiks-teens.firebasestorage.app",
    messagingSenderId: "620960153485",
    appId: "1:620960153485:android:d62374f03ea6e243f847c4",
  },
  uni: {
    apiKey: "AIzaSyBXu6Z1yTF17N1RuUItGQmadpYIYG61zlA",
    authDomain: "quiks-uni.firebaseapp.com",
    projectId: "quiks-uni",
    storageBucket: "quiks-uni.firebasestorage.app",
    messagingSenderId: "656940564357",
    appId: "1:656940564357:android:c5d7f9a7d55954f4438eec",
  },
};
const fallbackPublicEnv = {
  EXPO_PUBLIC_AI_API_URL: "https://quiks-app.onrender.com",
  EXPO_PUBLIC_AI_MODE: "live",
  EXPO_PUBLIC_GEMINI_MODEL: "gemini-2.5-flash",
  EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: "ca-app-pub-3940256099942544~3347511713",
  EXPO_PUBLIC_ADMOB_IOS_APP_ID: "ca-app-pub-3940256099942544~1458002511",
  EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: "",
  EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID: "",
  EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID: "",
  EXPO_PUBLIC_ADMOB_APP_OPEN_UNIT_ID: "",
  EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS: "false",
  EXPO_PUBLIC_ENABLE_SUBSCRIPTION_RESTRICTIONS: "true",
  EXPO_PUBLIC_ENABLE_SUBSCRIPTION_PURCHASES: "true",
  EXPO_PUBLIC_FIREBASE_API_KEY: "AIzaSyDSICe2NTtANURfwcQPYWlywx3OPiJ7kEA",
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "synapse-trainer-y0kk3.firebaseapp.com",
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: "synapse-trainer-y0kk3",
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: "synapse-trainer-y0kk3.firebasestorage.app",
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "51562512706",
  EXPO_PUBLIC_FIREBASE_APP_ID: "1:51562512706:web:6854bbc7b9d26a378a08db",
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: "731653268489-ra82v49q54t8l7plc0dbhbr02kcgvce1.apps.googleusercontent.com",
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "731653268489-1fl65svp5hrs5on074gfel7o1b8f7u1f.apps.googleusercontent.com",
} as const;

function readEnvValue(key: keyof NodeJS.ProcessEnv | keyof typeof fallbackPublicEnv) {
  const value = process.env[key];
  if (value) {
    return value.replace(/^"(.*)"$/, "$1");
  }

  return fallbackPublicEnv[key as keyof typeof fallbackPublicEnv];
}

function readVariantSubscriptionProductId(kind: "monthly" | "yearly") {
  const variantKey = `EXPO_PUBLIC_${variant.toUpperCase()}_PRO_${kind.toUpperCase()}_PRODUCT_ID` as keyof NodeJS.ProcessEnv;
  const genericKey = `EXPO_PUBLIC_PRO_${kind.toUpperCase()}_PRODUCT_ID` as keyof NodeJS.ProcessEnv;
  const value = process.env[variantKey] ?? process.env[genericKey] ?? variantSubscriptionFallbacks[variant][kind];
  return value ? value.replace(/^"(.*)"$/, "$1") : "";
}

function readVariantEntitlementId() {
  const variantKey = `EXPO_PUBLIC_${variant.toUpperCase()}_PRO_ENTITLEMENT_ID` as keyof NodeJS.ProcessEnv;
  const genericKey = "EXPO_PUBLIC_PRO_ENTITLEMENT_ID" as keyof NodeJS.ProcessEnv;
  const value = process.env[variantKey] ?? process.env[genericKey] ?? variantEntitlementFallbacks[variant];
  return value ? value.replace(/^"(.*)"$/, "$1") : "";
}

function readVariantRevenueCatApiKey(kind: "androidApiKey" | "iosApiKey" | "webApiKey") {
  const suffixMap = {
    androidApiKey: "ANDROID_API_KEY",
    iosApiKey: "IOS_API_KEY",
    webApiKey: "WEB_API_KEY",
  } as const;
  const variantKey = `EXPO_PUBLIC_${variant.toUpperCase()}_REVENUECAT_${suffixMap[kind]}` as keyof NodeJS.ProcessEnv;
  const genericKey = `EXPO_PUBLIC_REVENUECAT_${suffixMap[kind]}` as keyof NodeJS.ProcessEnv;
  const value = process.env[variantKey] ?? process.env[genericKey] ?? variantRevenueCatFallbacks[variant][kind];
  return value ? value.replace(/^"(.*)"$/, "$1") : "";
}

function readVariantPaddleClientToken() {
  const variantKey = `EXPO_PUBLIC_${variant.toUpperCase()}_PADDLE_CLIENT_TOKEN` as keyof NodeJS.ProcessEnv;
  const genericKey = "EXPO_PUBLIC_PADDLE_CLIENT_TOKEN" as keyof NodeJS.ProcessEnv;
  const value = process.env[variantKey] ?? process.env[genericKey] ?? variantPaddleClientTokenFallbacks[variant];
  return value ? value.replace(/^"(.*)"$/, "$1") : "";
}

function readVariantAdMobAppId(kind: "androidAppId" | "iosAppId") {
  const suffixMap = {
    androidAppId: "ANDROID_APP_ID",
    iosAppId: "IOS_APP_ID",
  } as const;
  const variantKey = `EXPO_PUBLIC_${variant.toUpperCase()}_ADMOB_${suffixMap[kind]}` as keyof NodeJS.ProcessEnv;
  const genericKey = `EXPO_PUBLIC_ADMOB_${suffixMap[kind]}` as keyof NodeJS.ProcessEnv;
  const variantFallback = variantAdMobAppIdFallbacks[variant][kind];
  const value = variantFallback || process.env[variantKey] || process.env[genericKey];
  return value ? value.replace(/^"(.*)"$/, "$1") : "";
}

function readVariantAdMobUnitId(
  kind: "bannerUnitId" | "interstitialUnitId" | "nativeUnitId" | "appOpenUnitId"
) {
  const suffixMap = {
    bannerUnitId: "BANNER_UNIT_ID",
    interstitialUnitId: "INTERSTITIAL_UNIT_ID",
    nativeUnitId: "NATIVE_UNIT_ID",
    appOpenUnitId: "APP_OPEN_UNIT_ID",
  } as const;
  const variantKey = `EXPO_PUBLIC_${variant.toUpperCase()}_ADMOB_${suffixMap[kind]}` as keyof NodeJS.ProcessEnv;
  const genericKey = `EXPO_PUBLIC_ADMOB_${suffixMap[kind]}` as keyof NodeJS.ProcessEnv;
  const variantFallback = variantAdMobUnitFallbacks[variant][kind];
  const value = variantFallback || process.env[variantKey] || process.env[genericKey];
  return value ? value.replace(/^"(.*)"$/, "$1") : "";
}

function readVariantInterstitialAdsEnabled() {
  const variantKey = `EXPO_PUBLIC_${variant.toUpperCase()}_ENABLE_INTERSTITIAL_ADS` as keyof NodeJS.ProcessEnv;
  const genericKey = "EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS" as keyof NodeJS.ProcessEnv;
  const value =
    process.env[variantKey] ??
    process.env[genericKey] ??
    String(variantInterstitialAdsEnabledFallbacks[variant]);
  return value.replace(/^"(.*)"$/, "$1");
}

function readVariantGoogleClientId(kind: "expoClientId" | "androidClientId" | "iosClientId" | "webClientId") {
  const suffixMap = {
    expoClientId: "EXPO_CLIENT_ID",
    androidClientId: "ANDROID_CLIENT_ID",
    iosClientId: "IOS_CLIENT_ID",
    webClientId: "WEB_CLIENT_ID",
  } as const;
  const variantKey = `EXPO_PUBLIC_${variant.toUpperCase()}_GOOGLE_${suffixMap[kind]}` as keyof NodeJS.ProcessEnv;
  const genericKey = `EXPO_PUBLIC_GOOGLE_${suffixMap[kind]}` as keyof NodeJS.ProcessEnv;
  const variantFallback = variantGoogleClientFallbacks[variant][kind];

  // Android and web OAuth clients are part of each variant's native identity.
  // Keep the checked-in values authoritative so stale EAS variables cannot revive a deleted client.
  if ((kind === "androidClientId" || kind === "webClientId") && variantFallback) {
    return variantFallback;
  }

  const expectedProjectNumber = variantGoogleClientFallbacks[variant].webClientId.split("-")[0];
  const candidates = [process.env[variantKey], process.env[genericKey], variantFallback];

  for (const candidate of candidates) {
    const value = candidate?.replace(/^"(.*)"$/, "$1");
    if (value?.startsWith(`${expectedProjectNumber}-`)) {
      return value;
    }
  }

  return variantFallback;
}

function readVariantFirebaseValue(kind: keyof (typeof variantFirebaseFallbacks)[AppVariant]) {
  const suffixMap = {
    apiKey: "API_KEY",
    authDomain: "AUTH_DOMAIN",
    projectId: "PROJECT_ID",
    storageBucket: "STORAGE_BUCKET",
    messagingSenderId: "MESSAGING_SENDER_ID",
    appId: "APP_ID",
  } as const;
  const variantKey = `EXPO_PUBLIC_${variant.toUpperCase()}_FIREBASE_${suffixMap[kind]}` as keyof NodeJS.ProcessEnv;
  const configured = process.env[variantKey]?.replace(/^"(.*)"$/, "$1");
  return configured || variantFirebaseFallbacks[variant][kind];
}

const variantConfig: Record<AppVariant, { name: string; slug: string; scheme: string; androidPackage: string }> = {
  children: {
    name: "Quiks Children",
    slug: "quiks",
    scheme: "quiks-children",
    androidPackage: "com.quiks.mobile",
  },
  teens: {
    name: "Quiks Teens",
    slug: "quiks-teens",
    scheme: "quiks-teens",
    androidPackage: "com.quiks.teens",
  },
  uni: {
    name: "Quiks Uni",
    slug: "quiks-uni",
    scheme: "quiks-uni",
    androidPackage: "com.quiks.uni",
  },
};

const current = variantConfig[variant] ?? variantConfig.children;
const variantBackgrounds: Record<AppVariant, string> = {
  children: "#7A2CC8",
  teens: "#11444A",
  uni: "#0B1F33",
};
const backgroundColor = variantBackgrounds[variant] ?? variantBackgrounds.children;
const variantProjectIds: Partial<Record<AppVariant, string>> = {
  children: "f2fa2ea0-d0d5-4f61-a469-0eb14602adfa",
  teens: "26af832f-3b36-4b19-9bae-3be8183c3731",
  uni: "75486e6a-cc21-44a6-abb8-8c565611a9ba",
};
const envProjectId =
  process.env.EAS_PROJECT_ID ??
  process.env[`EAS_PROJECT_ID_${variant.toUpperCase()}` as keyof NodeJS.ProcessEnv];
const easProjectId = envProjectId || variantProjectIds[variant];

const config: ExpoConfig = {
  name: current.name,
  slug: current.slug,
  scheme: current.scheme,
  version: "1.0.0",
  orientation: "default",
  userInterfaceStyle: "light",
  icon: `./assets/images/quiks-${variant}-icon-1024.png`,
  splash: {
    resizeMode: "contain",
    backgroundColor,
  },
  assetBundlePatterns: ["**/*"],
  android: {
    package: current.androidPackage,
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: `${variant}.quiks.site`,
            pathPrefix: "/classroom-invite.html",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    googleServicesFile:
      variant === "children"
        ? "./src/google-services-children.json"
        : variant === "teens"
          ? "./src/google-services-teens.json"
        : variant === "uni"
          ? "./src/google-services-uni.json"
          : undefined,
    blockedPermissions:
      variant === "children"
        ? [
            "com.google.android.gms.permission.AD_ID",
            "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
          ]
        : undefined,
    adaptiveIcon: {
      foregroundImage: `./assets/images/quiks-${variant}-adaptive-foreground.png`,
      backgroundColor,
    },
    edgeToEdgeEnabled: true,
  },
  plugins: [
    [
      "expo-router",
      {
        root: "./app",
      },
    ],
    [
      "react-native-google-mobile-ads",
      {
        androidAppId: readVariantAdMobAppId("androidAppId"),
        iosAppId: readVariantAdMobAppId("iosAppId"),
        userTrackingUsageDescription: "This identifier will be used to deliver relevant ads to you.",
      },
    ] as const,
    "expo-audio",
    "expo-web-browser",
    "expo-notifications",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    APP_VARIANT: variant,
    EXPO_PUBLIC_APP_VARIANT: variant,
    EXPO_PUBLIC_AI_API_URL: readEnvValue("EXPO_PUBLIC_AI_API_URL"),
    EXPO_PUBLIC_AI_MODE: readEnvValue("EXPO_PUBLIC_AI_MODE"),
    EXPO_PUBLIC_GEMINI_MODEL: readEnvValue("EXPO_PUBLIC_GEMINI_MODEL"),
    EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: readVariantAdMobAppId("androidAppId"),
    EXPO_PUBLIC_ADMOB_IOS_APP_ID: readVariantAdMobAppId("iosAppId"),
    EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: readVariantAdMobUnitId("bannerUnitId"),
    EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID: readVariantAdMobUnitId("interstitialUnitId"),
    EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID: readVariantAdMobUnitId("nativeUnitId"),
    EXPO_PUBLIC_ADMOB_APP_OPEN_UNIT_ID: readVariantAdMobUnitId("appOpenUnitId"),
    EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS: readVariantInterstitialAdsEnabled(),
    EXPO_PUBLIC_ENABLE_SUBSCRIPTION_RESTRICTIONS: readEnvValue("EXPO_PUBLIC_ENABLE_SUBSCRIPTION_RESTRICTIONS"),
    EXPO_PUBLIC_ENABLE_SUBSCRIPTION_PURCHASES: readEnvValue("EXPO_PUBLIC_ENABLE_SUBSCRIPTION_PURCHASES"),
    EXPO_PUBLIC_FIREBASE_API_KEY: readVariantFirebaseValue("apiKey"),
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: readVariantFirebaseValue("authDomain"),
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: readVariantFirebaseValue("projectId"),
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: readVariantFirebaseValue("storageBucket"),
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: readVariantFirebaseValue("messagingSenderId"),
    EXPO_PUBLIC_FIREBASE_APP_ID: readVariantFirebaseValue("appId"),
    EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID: readVariantGoogleClientId("expoClientId"),
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: readVariantGoogleClientId("androidClientId"),
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: readVariantGoogleClientId("iosClientId"),
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: readVariantGoogleClientId("webClientId"),
    EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: readVariantRevenueCatApiKey("androidApiKey"),
    EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: readVariantRevenueCatApiKey("iosApiKey"),
    EXPO_PUBLIC_REVENUECAT_WEB_API_KEY: readVariantRevenueCatApiKey("webApiKey"),
    EXPO_PUBLIC_PADDLE_CLIENT_TOKEN: readVariantPaddleClientToken(),
    EXPO_PUBLIC_PRO_ENTITLEMENT_ID: readVariantEntitlementId(),
    EXPO_PUBLIC_PRO_MONTHLY_PRODUCT_ID: readVariantSubscriptionProductId("monthly"),
    EXPO_PUBLIC_PRO_YEARLY_PRODUCT_ID: readVariantSubscriptionProductId("yearly"),
    "react-native-google-mobile-ads": {
      android_app_id: readVariantAdMobAppId("androidAppId"),
      ios_app_id: readVariantAdMobAppId("iosAppId"),
    },
    router: {
      root: "./app",
    },
    ...(easProjectId
      ? {
          eas: {
            projectId: easProjectId,
          },
        }
      : {}),
  },
};

export default config;

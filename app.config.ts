import type { ExpoConfig } from "expo/config";

type AppVariant = "children" | "teens" | "uni";

const variant = ((process.env.APP_VARIANT ?? "children") as AppVariant);
const variantSubscriptionFallbacks: Record<AppVariant, { monthly: string; yearly: string }> = {
  children: {
    monthly: "quiks_children_pro_monthly",
    yearly: "quiks_children_pro_yearly",
  },
  teens: {
    monthly: "quiks_teens_pro_monthly",
    yearly: "quiks_teens_pro_yearly",
  },
  uni: {
    monthly: "quiks_uni_pro_monthly",
    yearly: "quiks_uni_pro_yearly",
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
  EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS: "false",
  EXPO_PUBLIC_ENABLE_SUBSCRIPTION_RESTRICTIONS: "false",
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
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: `./assets/images/quiks-${variant}-icon-1024.png`,
  splash: {
    resizeMode: "contain",
    backgroundColor,
  },
  assetBundlePatterns: ["**/*"],
  android: {
    package: current.androidPackage,
    blockedPermissions: variant === "children" ? ["com.google.android.gms.permission.AD_ID"] : undefined,
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
    "expo-iap",
    [
      "react-native-google-mobile-ads",
      {
        androidAppId: readEnvValue("EXPO_PUBLIC_ADMOB_ANDROID_APP_ID"),
        iosAppId: readEnvValue("EXPO_PUBLIC_ADMOB_IOS_APP_ID"),
        userTrackingUsageDescription: "This identifier will be used to deliver relevant ads to you.",
      },
    ] as const,
    "expo-audio",
    "expo-web-browser",
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
    EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: readEnvValue("EXPO_PUBLIC_ADMOB_ANDROID_APP_ID"),
    EXPO_PUBLIC_ADMOB_IOS_APP_ID: readEnvValue("EXPO_PUBLIC_ADMOB_IOS_APP_ID"),
    EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: readEnvValue("EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID"),
    EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID: readEnvValue("EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID"),
    EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS: readEnvValue("EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS"),
    EXPO_PUBLIC_ENABLE_SUBSCRIPTION_RESTRICTIONS: readEnvValue("EXPO_PUBLIC_ENABLE_SUBSCRIPTION_RESTRICTIONS"),
    EXPO_PUBLIC_FIREBASE_API_KEY: readEnvValue("EXPO_PUBLIC_FIREBASE_API_KEY"),
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: readEnvValue("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: readEnvValue("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: readEnvValue("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: readEnvValue("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    EXPO_PUBLIC_FIREBASE_APP_ID: readEnvValue("EXPO_PUBLIC_FIREBASE_APP_ID"),
    EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID: readEnvValue("EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID"),
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: readEnvValue("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID"),
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: readEnvValue("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"),
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: readEnvValue("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"),
    EXPO_PUBLIC_PRO_MONTHLY_PRODUCT_ID: readVariantSubscriptionProductId("monthly"),
    EXPO_PUBLIC_PRO_YEARLY_PRODUCT_ID: readVariantSubscriptionProductId("yearly"),
    "react-native-google-mobile-ads": {
      android_app_id: readEnvValue("EXPO_PUBLIC_ADMOB_ANDROID_APP_ID"),
      ios_app_id: readEnvValue("EXPO_PUBLIC_ADMOB_IOS_APP_ID"),
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

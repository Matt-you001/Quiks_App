import type { ExpoConfig } from "expo/config";

type AppVariant = "children" | "teens" | "uni";

const variant = ((process.env.APP_VARIANT ?? "children") as AppVariant);

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
    "expo-audio",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    APP_VARIANT: variant,
    EXPO_PUBLIC_APP_VARIANT: variant,
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

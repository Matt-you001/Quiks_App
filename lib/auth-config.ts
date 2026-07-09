import Constants from "expo-constants";
import { appVariant } from "./app-variant";

const fallbackGoogleConfig = {
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

function resolveGoogleClientId(kind: "expoClientId" | "androidClientId" | "iosClientId" | "webClientId") {
  const suffixMap = {
    expoClientId: "EXPO_CLIENT_ID",
    androidClientId: "ANDROID_CLIENT_ID",
    iosClientId: "IOS_CLIENT_ID",
    webClientId: "WEB_CLIENT_ID",
  } as const;
  const variantPrefix = appVariant.id.toUpperCase();
  const variantKey = `EXPO_PUBLIC_${variantPrefix}_GOOGLE_${suffixMap[kind]}` as const;
  const genericKey = `EXPO_PUBLIC_GOOGLE_${suffixMap[kind]}` as const;
  const variantFallback = fallbackGoogleConfig[appVariant.id][kind];

  if (kind === "androidClientId") {
    return normalizeEnvValue(process.env[variantKey] ?? extra[variantKey] ?? variantFallback);
  }

  return normalizeEnvValue(
    process.env[variantKey] ??
      extra[variantKey] ??
      process.env[genericKey] ??
      extra[genericKey] ??
      variantFallback
  );
}

export const googleAuthConfig = {
  expoClientId: resolveGoogleClientId("expoClientId"),
  androidClientId: resolveGoogleClientId("androidClientId"),
  iosClientId: resolveGoogleClientId("iosClientId"),
  webClientId: resolveGoogleClientId("webClientId"),
};

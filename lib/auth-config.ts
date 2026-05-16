import Constants from "expo-constants";

const fallbackGoogleConfig = {
  androidClientId: "731653268489-ra82v49q54t8l7plc0dbhbr02kcgvce1.apps.googleusercontent.com",
  webClientId: "731653268489-1fl65svp5hrs5on074gfel7o1b8f7u1f.apps.googleusercontent.com",
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

export const googleAuthConfig = {
  expoClientId: normalizeEnvValue(
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ?? extra.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID
  ),
  androidClientId: normalizeEnvValue(
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
      extra.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
      fallbackGoogleConfig.androidClientId
  ),
  iosClientId: normalizeEnvValue(
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? extra.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  ),
  webClientId: normalizeEnvValue(
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
      extra.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
      fallbackGoogleConfig.webClientId
  ),
};

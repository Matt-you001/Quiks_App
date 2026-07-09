import { Platform } from "react-native";
import { appVariant } from "./app-variant";
import { googleAuthConfig } from "./auth-config";

type NativeGoogleSigninModule = typeof import("@react-native-google-signin/google-signin");

let nativeConfigured = false;
const GOOGLE_SIGN_IN_ENABLED = true;

function getNativeGoogleModule(): NativeGoogleSigninModule {
  return require("@react-native-google-signin/google-signin") as NativeGoogleSigninModule;
}

function configureNativeGoogleSignin() {
  if (Platform.OS === "web" || nativeConfigured) {
    return;
  }

  const { GoogleSignin } = getNativeGoogleModule();
  GoogleSignin.configure({
    scopes: ["email", "profile"],
    webClientId: googleAuthConfig.webClientId || undefined,
    iosClientId: googleAuthConfig.iosClientId || undefined,
  });
  nativeConfigured = true;
}

export function hasGoogleSignInConfig() {
  if (!GOOGLE_SIGN_IN_ENABLED) {
    return false;
  }

  return Platform.OS === "web"
    ? Boolean(googleAuthConfig.webClientId || googleAuthConfig.expoClientId)
    : Boolean(googleAuthConfig.webClientId);
}

export function isNativeGoogleSignInSupported() {
  return Platform.OS === "android" || Platform.OS === "ios";
}

export async function beginNativeGoogleSignIn() {
  if (!isNativeGoogleSignInSupported()) {
    throw new Error("Native Google sign-in is not supported on this platform.");
  }

  configureNativeGoogleSignin();

  const { GoogleSignin } = getNativeGoogleModule();
  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const response = await GoogleSignin.signIn();
  if (response.type !== "success") {
    throw new Error("Google sign-in was cancelled.");
  }

  const tokens = await GoogleSignin.getTokens();
  const idToken = response.data.idToken ?? tokens.idToken;
  if (!idToken) {
    throw new Error("Google did not return an ID token. Check the Google web client ID for this variant.");
  }

  return {
    idToken,
    accessToken: tokens.accessToken,
  };
}

export async function clearNativeGoogleSession() {
  if (!isNativeGoogleSignInSupported()) {
    return;
  }

  try {
    const { GoogleSignin } = getNativeGoogleModule();
    await GoogleSignin.signOut();
  } catch {
    // Ignore native sign-out issues so account logout is never blocked.
  }
}

export function formatGoogleSignInError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("non-recoverable sign in failure")) {
    return `Google sign-in is still being rejected by the Android app configuration. For ${appVariant.appName}, confirm the Firebase Android app uses package ${appVariant.androidPackage}, the SHA fingerprints are added there, and the current build includes the correct linked Firebase Android config file for that variant.`;
  }

  if (message.includes("cancel")) {
    return "Google sign-in was cancelled.";
  }

  if (message.includes("PLAY_SERVICES_NOT_AVAILABLE")) {
    return "Google Play Services is not available or needs an update on this device.";
  }

  if (message.includes("DEVELOPER_ERROR")) {
    return "Google sign-in is configured incorrectly for this app build. Check the package name, SHA fingerprints, and web client ID.";
  }

  if (message.includes("custom URI scheme")) {
    return "This Google sign-in client is not valid for the browser redirect flow. The app needs the native Google sign-in path for this build.";
  }

  return message;
}

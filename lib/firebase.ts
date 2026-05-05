import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import type { Persistence } from "firebase/auth";
import type { AppAccount, StoredAppState } from "../types/app";

const rnAuth = require("@firebase/auth") as {
  getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
};

const extra = {
  ...(Constants.expoConfig?.extra ?? {}),
  ...(((Constants as unknown as { manifest?: { extra?: Record<string, string | undefined> } }).manifest?.extra ?? {})),
} as Record<string, string | undefined>;
function normalizeEnvValue(value?: string) {
  if (!value) {
    return undefined;
  }

  return value.replace(/^"(.*)"$/, "$1");
}

const firebaseConfig = {
  apiKey: normalizeEnvValue(process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? extra.EXPO_PUBLIC_FIREBASE_API_KEY),
  authDomain: normalizeEnvValue(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? extra.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: normalizeEnvValue(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? extra.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: normalizeEnvValue(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? extra.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: normalizeEnvValue(
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? extra.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  ),
  appId: normalizeEnvValue(process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? extra.EXPO_PUBLIC_FIREBASE_APP_ID),
};

const isConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

const firebaseApp = isConfigured ? (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)) : null;
export const firebaseAuth: Auth | null = (() => {
  if (!firebaseApp) {
    return null;
  }

  try {
    const persistence = rnAuth.getReactNativePersistence?.(AsyncStorage);
    return initializeAuth(firebaseApp, {
      ...(persistence ? { persistence } : {}),
    });
  } catch {
    return getAuth(firebaseApp);
  }
})();
export const firebaseDb = firebaseApp ? getFirestore(firebaseApp) : null;

function toAccount(user: User, provider?: "email" | "google"): AppAccount {
  const guessedProvider =
    provider ??
    (user.providerData.some((entry) => entry.providerId === "google.com") ? "google" : "email");

  return {
    uid: user.uid,
    name: user.displayName?.trim() || user.email?.split("@")[0] || "Learner",
    email: user.email?.trim().toLowerCase() || "",
    provider: guessedProvider,
  };
}

export function isFirebaseConfigured() {
  return Boolean(firebaseApp && firebaseAuth);
}

export function getFirebaseConfigStatus() {
  return {
    apiKey: Boolean(firebaseConfig.apiKey),
    authDomain: Boolean(firebaseConfig.authDomain),
    projectId: Boolean(firebaseConfig.projectId),
    appId: Boolean(firebaseConfig.appId),
  };
}

export function getFirebaseConfigErrorMessage() {
  const status = getFirebaseConfigStatus();
  const missing = Object.entries(status)
    .filter(([, ready]) => !ready)
    .map(([key]) => key);

  if (missing.length === 0) {
    return null;
  }

  return `Missing Firebase config: ${missing.join(", ")}`;
}

export function formatFirebaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("auth/operation-not-allowed")) {
    return "Email/password sign-in is not enabled yet in Firebase Authentication.";
  }

  if (message.includes("auth/invalid-api-key")) {
    return "The Firebase API key is invalid for this build.";
  }

  if (message.includes("auth/network-request-failed")) {
    return "Network request failed. Check your internet connection and try again.";
  }

  if (message.includes("auth/email-already-in-use")) {
    return "This email is already registered. Try signing in instead.";
  }

  if (message.includes("auth/invalid-credential")) {
    return "The Firebase credentials for this build are not valid.";
  }

  return message;
}

export function getAuthenticatedAccount() {
  if (!firebaseAuth?.currentUser) {
    return null;
  }

  return toAccount(firebaseAuth.currentUser);
}

export async function signUpWithEmailAccount(name: string, email: string, password: string) {
  if (!firebaseAuth) {
    throw new Error("Firebase auth is not configured.");
  }

  const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
  if (name.trim()) {
    await updateProfile(credential.user, {
      displayName: name.trim(),
    });
  }
  return toAccount(credential.user, "email");
}

export async function signInWithEmailAccount(email: string, password: string) {
  if (!firebaseAuth) {
    throw new Error("Firebase auth is not configured.");
  }

  const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  return toAccount(credential.user, "email");
}

export async function signInWithGoogleAccount(idToken: string, accessToken?: string) {
  if (!firebaseAuth) {
    throw new Error("Firebase auth is not configured.");
  }

  const googleCredential = GoogleAuthProvider.credential(idToken, accessToken);
  const credential = await signInWithCredential(firebaseAuth, googleCredential);
  return toAccount(credential.user, "google");
}

export async function sendResetPasswordEmail(email: string) {
  if (!firebaseAuth) {
    throw new Error("Firebase auth is not configured.");
  }

  await sendPasswordResetEmail(firebaseAuth, email.trim());
}

export async function signOutAccount() {
  if (!firebaseAuth) {
    return;
  }

  await signOut(firebaseAuth);
}

export async function loadCloudState(userId: string) {
  if (!firebaseDb) {
    return null;
  }

  const snapshot = await getDoc(doc(firebaseDb, "users", userId));
  if (!snapshot.exists()) {
    return null;
  }

  return (snapshot.data().state ?? null) as Partial<StoredAppState> | null;
}

export async function saveCloudState(userId: string, state: StoredAppState) {
  if (!firebaseDb) {
    return;
  }

  await setDoc(
    doc(firebaseDb, "users", userId),
    {
      state: {
        profiles: state.profiles,
        currentProfileId: state.currentProfileId,
        results: state.results,
        subscriptionTier: state.subscriptionTier,
      },
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

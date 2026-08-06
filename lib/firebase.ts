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
  onAuthStateChanged,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import type { Persistence } from "firebase/auth";
import type { AppAccount, StoredAppState } from "../types/app";
import { clearNativeGoogleSession } from "./google-auth";
import { appVariant } from "./app-variant";

const rnAuth = require("@firebase/auth") as {
  getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
};
const fallbackFirebaseConfigs = {
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
} as const;
const fallbackFirebaseConfig = fallbackFirebaseConfigs[appVariant.id];

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

function resolveFirebaseValue(
  suffix: "API_KEY" | "AUTH_DOMAIN" | "PROJECT_ID" | "STORAGE_BUCKET" | "MESSAGING_SENDER_ID" | "APP_ID",
  fallback: string
) {
  const variantKey = `EXPO_PUBLIC_${appVariant.id.toUpperCase()}_FIREBASE_${suffix}`;
  const genericKey = `EXPO_PUBLIC_FIREBASE_${suffix}`;
  return normalizeEnvValue(
    process.env[variantKey] ?? extra[variantKey] ?? extra[genericKey] ?? process.env[genericKey] ?? fallback
  );
}

const firebaseConfig = {
  apiKey: resolveFirebaseValue("API_KEY", fallbackFirebaseConfig.apiKey),
  authDomain: resolveFirebaseValue("AUTH_DOMAIN", fallbackFirebaseConfig.authDomain),
  projectId: resolveFirebaseValue("PROJECT_ID", fallbackFirebaseConfig.projectId),
  storageBucket: resolveFirebaseValue("STORAGE_BUCKET", fallbackFirebaseConfig.storageBucket),
  messagingSenderId: resolveFirebaseValue("MESSAGING_SENDER_ID", fallbackFirebaseConfig.messagingSenderId),
  appId: resolveFirebaseValue("APP_ID", fallbackFirebaseConfig.appId),
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

export function waitForFirebaseAuthAccount() {
  if (!firebaseAuth) {
    return Promise.resolve<AppAccount | null>(null);
  }

  return new Promise<AppAccount | null>((resolve) => {
    let unsubscribe: () => void = () => undefined;
    unsubscribe = onAuthStateChanged(
      firebaseAuth,
      (user) => {
        unsubscribe();
        resolve(user ? toAccount(user) : null);
      },
      () => {
        unsubscribe();
        resolve(null);
      }
    );
  });
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
  await clearNativeGoogleSession();
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
        subscriptionExpiresAt: state.subscriptionExpiresAt,
        subscriptionUpdatedAt: state.subscriptionUpdatedAt,
      },
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

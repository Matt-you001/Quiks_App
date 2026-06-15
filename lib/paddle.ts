import Constants from "expo-constants";
import { Platform } from "react-native";
import { initializePaddle, type CheckoutOpenOptions, type Paddle, type PaddleEventData } from "@paddle/paddle-js";
import { appVariant } from "./app-variant";

const fallbackPaddleClientTokens = {
  children: "live_58cf05e9abc2e3daa263e2d86b1",
  teens: "live_58cf05e9abc2e3daa263e2d86b1",
  uni: "live_58cf05e9abc2e3daa263e2d86b1",
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

function readPaddleClientToken() {
  const variantPrefix = appVariant.id.toUpperCase();
  const variantKey = `EXPO_PUBLIC_${variantPrefix}_PADDLE_CLIENT_TOKEN` as const;
  const genericKey = "EXPO_PUBLIC_PADDLE_CLIENT_TOKEN" as const;

  return (
    normalizeEnvValue(
      process.env[variantKey] ??
        extra[variantKey] ??
        process.env[genericKey] ??
        extra[genericKey]
    ) ?? fallbackPaddleClientTokens[appVariant.id]
  );
}

let paddlePromise: Promise<Paddle | undefined> | null = null;
let configuredToken: string | null = null;

function handlePaddleEvent(event: PaddleEventData) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.log("[Paddle event]", event.name ?? event.type ?? "unknown", event.data ?? null);
}

export function getPaddleClientToken() {
  return readPaddleClientToken();
}

export function hasPaddleClientToken() {
  return Boolean(readPaddleClientToken());
}

export async function ensurePaddleConfigured() {
  if (Platform.OS !== "web") {
    return null;
  }

  const token = readPaddleClientToken();
  if (!token) {
    throw new Error("Paddle client-side token is not configured.");
  }

  if (!paddlePromise || configuredToken !== token) {
    configuredToken = token;
    paddlePromise = initializePaddle({
      environment: "production",
      token,
      eventCallback: handlePaddleEvent,
    });
  }

  return (await paddlePromise) ?? null;
}

export async function openPaddleCheckout(priceId: string) {
  if (Platform.OS !== "web") {
    throw new Error("Paddle checkout is only available on web.");
  }

  const paddle = await ensurePaddleConfigured();
  if (!paddle) {
    throw new Error("Paddle could not be initialized.");
  }

  const checkoutOptions: CheckoutOpenOptions = {
    items: [{ priceId, quantity: 1 }],
    settings: {
      displayMode: "overlay",
      theme: "light",
    },
  };

  paddle.Checkout.open(checkoutOptions);
}

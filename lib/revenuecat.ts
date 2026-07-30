import Constants from "expo-constants";
import { Platform } from "react-native";
import Purchases, { type CustomerInfo } from "react-native-purchases";
import type { AppAccount } from "../types/app";
import { appVariant } from "./app-variant";
import { getAuthenticatedAccount } from "./firebase";
import { setSubscriptionTier } from "./storage";

const fallbackEntitlementIds = {
  children: "entl5792d09222",
  teens: "entl799f03ddcc",
  uni: "entl5ab41c922b",
} as const;

const fallbackRevenueCatKeys = {
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

function readRevenueCatApiKey(kind: "androidApiKey" | "iosApiKey" | "webApiKey") {
  const suffixMap = {
    androidApiKey: "ANDROID_API_KEY",
    iosApiKey: "IOS_API_KEY",
    webApiKey: "WEB_API_KEY",
  } as const;
  const variantPrefix = appVariant.id.toUpperCase();
  const variantKey = `EXPO_PUBLIC_${variantPrefix}_REVENUECAT_${suffixMap[kind]}` as const;
  const genericKey = `EXPO_PUBLIC_REVENUECAT_${suffixMap[kind]}` as const;
  const fallbackValue = fallbackRevenueCatKeys[appVariant.id][kind];

  return normalizeEnvValue(
    process.env[variantKey] ??
      extra[variantKey] ??
      process.env[genericKey] ??
      extra[genericKey] ??
      fallbackValue
  );
}

function readEntitlementId() {
  const variantPrefix = appVariant.id.toUpperCase();
  const variantKey = `EXPO_PUBLIC_${variantPrefix}_PRO_ENTITLEMENT_ID` as const;
  const genericKey = "EXPO_PUBLIC_PRO_ENTITLEMENT_ID" as const;

  return normalizeEnvValue(
    process.env[variantKey] ??
      extra[variantKey] ??
      process.env[genericKey] ??
      extra[genericKey] ??
      fallbackEntitlementIds[appVariant.id]
  );
}

const revenueCatConfig = {
  androidApiKey: readRevenueCatApiKey("androidApiKey"),
  iosApiKey: readRevenueCatApiKey("iosApiKey"),
  webApiKey: readRevenueCatApiKey("webApiKey"),
  proEntitlementId: readEntitlementId(),
};

let configuredApiKey: string | null = null;
let configuredAppUserId: string | null = null;
let listenerAttached = false;

function getActiveRevenueCatApiKey() {
  if (Platform.OS === "android") {
    return revenueCatConfig.androidApiKey;
  }

  if (Platform.OS === "ios") {
    return revenueCatConfig.iosApiKey || revenueCatConfig.androidApiKey;
  }

  if (Platform.OS === "web") {
    return revenueCatConfig.webApiKey || revenueCatConfig.androidApiKey;
  }

  return revenueCatConfig.androidApiKey;
}

export function getRevenueCatEntitlementId() {
  return revenueCatConfig.proEntitlementId ?? "";
}

export function getRevenueCatConfigStatus() {
  return {
    apiKey: Boolean(getActiveRevenueCatApiKey()),
    entitlementId: Boolean(revenueCatConfig.proEntitlementId),
  };
}

export function getRevenueCatConfigErrorMessage() {
  const status = getRevenueCatConfigStatus();
  const missing = Object.entries(status)
    .filter(([, ready]) => !ready)
    .map(([key]) => key);

  if (missing.length === 0) {
    return null;
  }

  return `Missing RevenueCat config: ${missing.join(", ")}`;
}

export function hasRevenueCatConfig() {
  const status = getRevenueCatConfigStatus();
  return status.apiKey && status.entitlementId;
}

export function hasActiveProEntitlement(customerInfo: CustomerInfo) {
  const entitlementId = getRevenueCatEntitlementId();
  if (entitlementId) {
    const configuredEntitlement =
      customerInfo.entitlements.active[entitlementId] ??
      customerInfo.entitlements.all[entitlementId];

    if (configuredEntitlement?.isActive) {
      return true;
    }
  }

  // Each Quiks variant has one paid tier. Keep Pro access working if the
  // dashboard entitlement identifier changes or a Play product has not yet
  // been attached to the configured entitlement.
  const hasAnyActiveEntitlement = Object.values(customerInfo.entitlements.active).some(
    (entitlement) => entitlement.isActive
  );

  return hasAnyActiveEntitlement || customerInfo.activeSubscriptions.length > 0;
}

async function syncTierFromCustomerInfo(customerInfo: CustomerInfo) {
  const active = hasActiveProEntitlement(customerInfo);
  await setSubscriptionTier(active ? "pro" : "free");
  return active;
}

async function syncSubscriberAttributes(account: AppAccount | null) {
  if (!account) {
    return;
  }

  await Promise.allSettled([
    account.email ? Purchases.setEmail(account.email) : Promise.resolve(),
    account.name ? Purchases.setDisplayName(account.name) : Promise.resolve(),
    Purchases.setAttributes({
      quiks_variant: appVariant.id,
      quiks_provider: account.provider,
    }),
  ]);
}

function attachCustomerInfoListener() {
  if (listenerAttached) {
    return;
  }

  Purchases.addCustomerInfoUpdateListener((customerInfo) => {
    void syncTierFromCustomerInfo(customerInfo);
  });
  listenerAttached = true;
}

export async function ensureRevenueCatConfigured(account: AppAccount | null = getAuthenticatedAccount()) {
  const apiKey = getActiveRevenueCatApiKey();
  if (!apiKey) {
    throw new Error("RevenueCat SDK key is not configured.");
  }

  const currentAppUserId = account?.uid ?? null;
  const isConfigured = await Purchases.isConfigured().catch(() => false);

  if (!isConfigured || configuredApiKey !== apiKey) {
    Purchases.configure({
      apiKey,
      appUserID: currentAppUserId,
      diagnosticsEnabled: false,
      shouldShowInAppMessagesAutomatically: true,
    });
    configuredApiKey = apiKey;
    configuredAppUserId = currentAppUserId;
    attachCustomerInfoListener();
    await syncSubscriberAttributes(account);
    return;
  }

  attachCustomerInfoListener();

  if (currentAppUserId && configuredAppUserId !== currentAppUserId) {
    await Purchases.logIn(currentAppUserId);
    configuredAppUserId = currentAppUserId;
    await syncSubscriberAttributes(account);
    return;
  }

  if (!currentAppUserId && configuredAppUserId) {
    const customerInfo = await Purchases.logOut();
    configuredAppUserId = null;
    await syncTierFromCustomerInfo(customerInfo);
  }
}

export async function syncRevenueCatIdentity(account: AppAccount | null) {
  await ensureRevenueCatConfigured(account);
  await Purchases.invalidateCustomerInfoCache();
  const customerInfo = await Purchases.getCustomerInfo();
  await syncTierFromCustomerInfo(customerInfo);
}

export async function syncRevenueCatIdentityForAuthentication(account: AppAccount) {
  const syncPromise = syncRevenueCatIdentity(account).catch(() => undefined);
  await Promise.race([
    syncPromise,
    new Promise<void>((resolve) => {
      setTimeout(resolve, 1500);
    }),
  ]);
}

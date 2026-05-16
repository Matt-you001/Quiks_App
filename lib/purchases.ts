import Constants from "expo-constants";
import { appVariant } from "./app-variant";
import { setSubscriptionTier } from "./storage";

type ExpoIapModule = typeof import("expo-iap");
type ProductSubscription = import("expo-iap").ProductSubscription;
type Purchase = import("expo-iap").Purchase;

export interface SubscriptionPlan {
  productId: string;
  title: string;
  description: string;
  displayPrice: string;
  period: "monthly" | "yearly" | "unknown";
}

type SubscriptionPeriod = SubscriptionPlan["period"];

export interface SubscriptionStoreState {
  plans: SubscriptionPlan[];
  active: boolean;
  available: boolean;
  reason?: string;
}

export interface SubscriptionPurchaseResult {
  active: boolean;
  pending: boolean;
  message?: string;
}

const fallbackProductIds = {
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

const productIds = {
  monthly:
    normalizeEnvValue(process.env.EXPO_PUBLIC_PRO_MONTHLY_PRODUCT_ID ?? extra.EXPO_PUBLIC_PRO_MONTHLY_PRODUCT_ID) ??
    fallbackProductIds[appVariant.id].monthly,
  yearly:
    normalizeEnvValue(process.env.EXPO_PUBLIC_PRO_YEARLY_PRODUCT_ID ?? extra.EXPO_PUBLIC_PRO_YEARLY_PRODUCT_ID) ??
    fallbackProductIds[appVariant.id].yearly,
};

let connectionReady = false;

function getExpoIapModule(): ExpoIapModule | null {
  try {
    return require("expo-iap") as ExpoIapModule;
  } catch {
    return null;
  }
}

function getSubscriptionProductIds() {
  return [productIds.monthly, productIds.yearly].filter(Boolean);
}

function inferPeriod(productId: string, title: string) {
  const combined = `${productId} ${title}`.toLowerCase();
  if (combined.includes("year")) {
    return "yearly";
  }
  if (combined.includes("month")) {
    return "monthly";
  }
  return "unknown" as SubscriptionPeriod;
}

function normalizePlans(items: ProductSubscription[]) {
  const rank: Record<SubscriptionPeriod, number> = {
    monthly: 0,
    yearly: 1,
    unknown: 2,
  };

  return items
    .map((item) => ({
      productId: item.id,
      title: item.displayName ?? item.title ?? item.id,
      description: item.description ?? "",
      displayPrice: item.displayPrice ?? "",
      period: inferPeriod(item.id, item.displayName ?? item.title ?? item.id) as SubscriptionPeriod,
    }))
    .sort((left, right) => rank[left.period] - rank[right.period]);
}

async function ensureConnection() {
  const iap = getExpoIapModule();
  if (!iap) {
    return null;
  }

  if (!connectionReady) {
    await iap.initConnection();
    connectionReady = true;
  }

  return iap;
}

async function updateStoredTierFromActive(active: boolean) {
  const nextTier = active ? "pro" : "free";
  await setSubscriptionTier(nextTier);
  return nextTier;
}

export async function endPurchaseConnection() {
  const iap = getExpoIapModule();
  if (!iap || !connectionReady) {
    return;
  }

  try {
    await iap.endConnection();
  } finally {
    connectionReady = false;
  }
}

export function purchaseRuntimeAvailable() {
  return Boolean(getExpoIapModule());
}

export function subscriptionsConfigured() {
  return getSubscriptionProductIds().length > 0;
}

export async function loadSubscriptionStoreState(): Promise<SubscriptionStoreState> {
  const iap = await ensureConnection();
  const subscriptionIds = getSubscriptionProductIds();

  if (!iap) {
    return {
      plans: [],
      active: false,
      available: false,
      reason: "runtime_unavailable",
    };
  }

  if (subscriptionIds.length === 0) {
    return {
      plans: [],
      active: false,
      available: false,
      reason: "products_missing",
    };
  }

  const fetched = await iap.fetchProducts({
    skus: subscriptionIds,
    type: "subs",
  });

  const plans = normalizePlans((fetched ?? []).filter((item): item is ProductSubscription => item.type === "subs"));
  const active = await iap.hasActiveSubscriptions(subscriptionIds);
  await updateStoredTierFromActive(active);

  return {
    plans,
    active,
    available: true,
    reason: plans.length === 0 ? "products_unavailable" : undefined,
  };
}

function getPurchaseRequest(productId: string) {
  return {
    type: "subs" as const,
    request: {
      apple: {
        sku: productId,
      },
      ios: {
        sku: productId,
      },
      android: {
        skus: [productId],
      },
      google: {
        skus: [productId],
      },
    },
  };
}

function resolvePurchase(result: Purchase | Purchase[] | null | undefined) {
  if (!result) {
    return null;
  }

  return Array.isArray(result) ? result[0] ?? null : result;
}

export async function purchaseProSubscription(productId: string): Promise<SubscriptionPurchaseResult> {
  const iap = await ensureConnection();
  const subscriptionIds = getSubscriptionProductIds();

  if (!iap) {
    return {
      active: false,
      pending: false,
      message: "runtime_unavailable",
    };
  }

  const rawPurchase = await iap.requestPurchase(getPurchaseRequest(productId));
  const purchase = resolvePurchase(rawPurchase);

  if (purchase) {
    await iap.finishTransaction({
      purchase,
      isConsumable: false,
    });
  }

  const active = await iap.hasActiveSubscriptions(subscriptionIds);
  await updateStoredTierFromActive(active);

  return {
    active,
    pending: !active,
  };
}

export async function restoreProSubscription(): Promise<SubscriptionPurchaseResult> {
  const iap = await ensureConnection();
  const subscriptionIds = getSubscriptionProductIds();

  if (!iap) {
    return {
      active: false,
      pending: false,
      message: "runtime_unavailable",
    };
  }

  await iap.restorePurchases();
  const active = await iap.hasActiveSubscriptions(subscriptionIds);
  await updateStoredTierFromActive(active);

  return {
    active,
    pending: false,
  };
}

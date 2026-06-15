import Constants from "expo-constants";
import Purchases, { PACKAGE_TYPE, type PurchasesPackage } from "react-native-purchases";
import { appVariant } from "./app-variant";
import { getAuthenticatedAccount } from "./firebase";
import {
  ensureRevenueCatConfigured,
  getRevenueCatConfigErrorMessage,
  getRevenueCatEntitlementId,
  hasActiveProEntitlement,
  hasRevenueCatConfig,
} from "./revenuecat";
import { setSubscriptionTier } from "./storage";

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
    monthly: "pri_01ktmm16hbdzdw2t1k8adnf62p",
    yearly: "pri_01ktmm5s5t0ad93yrdae3rr8vf",
  },
  teens: {
    monthly: "pri_01ktw7bftss9tz8fj059vjnbfy",
    yearly: "pri_01ktw7er8a15qf2d4pw7v0s4b8",
  },
  uni: {
    monthly: "pri_01ktmmh5xf4yn0yn1vwq8pg2rh",
    yearly: "pri_01ktmmm7cmh5tg4tm93cv8pk5e",
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
const packageCache = new Map<string, PurchasesPackage>();

function getSubscriptionProductIds() {
  return [productIds.monthly, productIds.yearly].filter(Boolean);
}

function inferPeriod(aPackage: PurchasesPackage) {
  if (aPackage.packageType === PACKAGE_TYPE.ANNUAL) {
    return "yearly" as SubscriptionPeriod;
  }

  if (aPackage.packageType === PACKAGE_TYPE.MONTHLY) {
    return "monthly" as SubscriptionPeriod;
  }

  const period = aPackage.product.subscriptionPeriod?.toUpperCase() ?? "";
  if (period.includes("Y")) {
    return "yearly" as SubscriptionPeriod;
  }

  if (period.includes("M")) {
    return "monthly" as SubscriptionPeriod;
  }

  return "unknown" as SubscriptionPeriod;
}

function normalizePlans(items: PurchasesPackage[]) {
  const rank: Record<SubscriptionPeriod, number> = {
    monthly: 0,
    yearly: 1,
    unknown: 2,
  };

  return items
    .map((item) => ({
      productId: item.identifier,
      title: item.product.title ?? item.identifier,
      description: item.product.description ?? "",
      displayPrice: item.product.priceString ?? "",
      period: inferPeriod(item),
    }))
    .sort((left, right) => rank[left.period] - rank[right.period]);
}

async function updateStoredTierFromActive(active: boolean) {
  const nextTier = active ? "pro" : "free";
  await setSubscriptionTier(nextTier);
  return nextTier;
}

export async function endPurchaseConnection() {
  return;
}

export function purchaseRuntimeAvailable() {
  return true;
}

export function subscriptionsConfigured() {
  return hasRevenueCatConfig();
}

export function getProEntitlementId() {
  return getRevenueCatEntitlementId();
}

export async function loadSubscriptionStoreState(): Promise<SubscriptionStoreState> {
  if (!hasRevenueCatConfig()) {
    return {
      plans: [],
      active: false,
      available: false,
      reason: "sdk_key_missing",
    };
  }

  await ensureRevenueCatConfigured(getAuthenticatedAccount());
  const offerings = await Purchases.getOfferings();
  const availablePackages = offerings.current?.availablePackages ?? [];
  packageCache.clear();
  for (const item of availablePackages) {
    packageCache.set(item.identifier, item);
  }

  const customerInfo = await Purchases.getCustomerInfo();
  const plans = normalizePlans(availablePackages);
  const active = hasActiveProEntitlement(customerInfo);
  await updateStoredTierFromActive(active);

  return {
    plans,
    active,
    available: availablePackages.length > 0,
    reason: plans.length === 0 ? "products_unavailable" : undefined,
  };
}

async function getCachedPackage(packageId: string) {
  const cached = packageCache.get(packageId);
  if (cached) {
    return cached;
  }

  const offerings = await Purchases.getOfferings();
  const availablePackages = offerings.current?.availablePackages ?? [];
  packageCache.clear();
  for (const item of availablePackages) {
    packageCache.set(item.identifier, item);
  }

  return packageCache.get(packageId) ?? null;
}

export async function purchaseProSubscription(productId: string): Promise<SubscriptionPurchaseResult> {
  if (!hasRevenueCatConfig()) {
    return {
      active: false,
      pending: false,
      message: getRevenueCatConfigErrorMessage() ?? "sdk_key_missing",
    };
  }

  await ensureRevenueCatConfigured(getAuthenticatedAccount());
  const selectedPackage = await getCachedPackage(productId);
  if (!selectedPackage) {
    return {
      active: false,
      pending: false,
      message: "products_unavailable",
    };
  }

  const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
  const active = hasActiveProEntitlement(customerInfo);
  await updateStoredTierFromActive(active);

  return {
    active,
    pending: !active,
  };
}

export async function restoreProSubscription(): Promise<SubscriptionPurchaseResult> {
  if (!hasRevenueCatConfig()) {
    return {
      active: false,
      pending: false,
      message: getRevenueCatConfigErrorMessage() ?? "sdk_key_missing",
    };
  }

  await ensureRevenueCatConfigured(getAuthenticatedAccount());
  const customerInfo = await Purchases.restorePurchases();
  const active = hasActiveProEntitlement(customerInfo);
  await updateStoredTierFromActive(active);

  return {
    active,
    pending: false,
  };
}

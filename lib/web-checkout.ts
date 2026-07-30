import { Platform } from "react-native";

export type SubscriptionPlanPeriod = "monthly" | "yearly";

export function normalizeSubscriptionPlanPeriod(value?: string | string[] | null): SubscriptionPlanPeriod | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "monthly" || raw === "yearly") {
    return raw;
  }

  return null;
}

export function isWebCheckoutIntent(value?: string | string[] | null) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "1" || raw === "true" || raw === "yes";
}

export function readWebCheckoutIntentFromLocation() {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return {
      checkout: false,
      plan: null as SubscriptionPlanPeriod | null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    checkout: isWebCheckoutIntent(params.get("checkout")),
    plan: normalizeSubscriptionPlanPeriod(params.get("plan")),
  };
}

export function getPostAuthRoute(
  redirect?: string | string[] | null,
  plan?: string | string[] | null,
  joinCode?: string | string[] | null,
  className?: string | string[] | null
): {
  pathname: "/" | "/subscription" | "/classroom-invite";
  params?: { plan?: SubscriptionPlanPeriod; joinCode?: string; className?: string };
} {
  const normalizedRedirect = Array.isArray(redirect) ? redirect[0] : redirect;
  if (normalizedRedirect === "subscription") {
    const normalizedPlan = normalizeSubscriptionPlanPeriod(plan);
    return normalizedPlan
      ? { pathname: "/subscription", params: { plan: normalizedPlan } }
      : { pathname: "/subscription" };
  }

  if (normalizedRedirect === "classroom-invite") {
    const normalizedCode = (Array.isArray(joinCode) ? joinCode[0] : joinCode)?.trim().toUpperCase();
    const normalizedClassName = (Array.isArray(className) ? className[0] : className)?.trim();
    return {
      pathname: "/classroom-invite",
      params: {
        ...(normalizedCode ? { joinCode: normalizedCode } : {}),
        ...(normalizedClassName ? { className: normalizedClassName } : {}),
      },
    };
  }

  return { pathname: "/" };
}

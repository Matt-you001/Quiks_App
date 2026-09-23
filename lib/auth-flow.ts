import type { Href } from "expo-router";
import type { AppAccount } from "../types/app";
import { isAccountEmailVerified } from "./firebase";
import { syncRevenueCatIdentityForAuthentication } from "./revenuecat";
import { syncAdministrativeProfileForAccount } from "./school-identity";
import { setAuthenticatedAccount } from "./storage";
import { getPostAuthRoute } from "./web-checkout";

export interface AuthContinuationParams {
  redirect?: string;
  plan?: string;
  joinCode?: string;
  className?: string;
  returnTo?: string;
  schoolCode?: string;
}

function value(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function getAuthContinuationParams(
  params: AuthContinuationParams,
  schoolCodeOverride?: string
): AuthContinuationParams {
  const schoolCode = (schoolCodeOverride ?? value(params.schoolCode))?.trim().toUpperCase();
  return {
    ...(value(params.redirect) ? { redirect: value(params.redirect) } : {}),
    ...(value(params.plan) ? { plan: value(params.plan) } : {}),
    ...(value(params.joinCode) ? { joinCode: value(params.joinCode) } : {}),
    ...(value(params.className) ? { className: value(params.className) } : {}),
    ...(value(params.returnTo) ? { returnTo: value(params.returnTo) } : {}),
    ...(schoolCode ? { schoolCode } : {}),
  };
}

export function getVerifyEmailRoute(
  params: AuthContinuationParams,
  schoolCodeOverride?: string
): Href {
  return {
    pathname: "/verify-email",
    params: getAuthContinuationParams(params, schoolCodeOverride),
  } as unknown as Href;
}

export function getContinuationRoute(params: AuthContinuationParams): Href {
  const normalized = getAuthContinuationParams(params);
  return (normalized.schoolCode
    ? { pathname: "/school-enrol", params: { code: normalized.schoolCode } }
    : getPostAuthRoute(
        normalized.redirect,
        normalized.plan,
        normalized.joinCode,
        normalized.className,
        normalized.returnTo
      )) as Href;
}

export async function completeVerifiedAuthentication(account: AppAccount) {
  if (!isAccountEmailVerified(account)) {
    throw new Error("Verify your email address before continuing.");
  }
  await setAuthenticatedAccount(account, true);
  await syncAdministrativeProfileForAccount(account).catch(() => undefined);
  await syncRevenueCatIdentityForAuthentication(account);
}
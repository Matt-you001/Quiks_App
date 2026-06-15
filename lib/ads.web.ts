import { appVariant } from "./app-variant";
import type { SubscriptionTier } from "../types/app";

export function canShowAds(subscriptionTier: SubscriptionTier) {
  return appVariant.id !== "children" && subscriptionTier === "free";
}

export function getMobileAdsModule() {
  return null;
}

export function getBannerAdUnitId() {
  return "";
}

export function getInterstitialAdUnitId() {
  return "";
}

export async function initializeMobileAds() {
  return false;
}

export async function showInterstitialAd() {
  return false;
}

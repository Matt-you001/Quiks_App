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

export function getNativeAdUnitId() {
  return "";
}

export function getAppOpenAdUnitId() {
  return "";
}

export async function initializeMobileAds() {
  return false;
}

export async function showInterstitialAd() {
  return false;
}

export async function preloadAppOpenAd(_subscriptionTier: SubscriptionTier) {
  return false;
}

export async function showAppOpenAd(_subscriptionTier: SubscriptionTier) {
  return false;
}

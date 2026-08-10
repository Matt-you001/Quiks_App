import { Linking } from "react-native";
import { appVariant } from "./app-variant";

const REVIEW_MIN_SUCCESSFUL_SESSIONS = 5;
const REVIEW_PROMPT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export function shouldShowReviewPrompt(
  successfulSessionCount: number,
  lastShownAt: string | null,
  completedAt: string | null,
  now = Date.now()
) {
  if (completedAt || successfulSessionCount < REVIEW_MIN_SUCCESSFUL_SESSIONS) return false;
  if (!lastShownAt) return true;
  const lastShownTime = new Date(lastShownAt).getTime();
  return !Number.isFinite(lastShownTime) || now - lastShownTime >= REVIEW_PROMPT_COOLDOWN_MS;
}

export function getPlayStoreReviewUrl() {
  return `https://play.google.com/store/apps/details?id=${appVariant.androidPackage}&showAllReviews=true`;
}

export async function openPlayStoreReview() {
  const nativeUrl = `market://details?id=${appVariant.androidPackage}&showAllReviews=true`;
  try {
    await Linking.openURL(nativeUrl);
  } catch {
    await Linking.openURL(getPlayStoreReviewUrl());
  }
}

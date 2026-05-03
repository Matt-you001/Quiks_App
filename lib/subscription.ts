import { appVariant } from "./app-variant";
import type { SessionResult, SubscriptionTier } from "../types/app";

const FREE_PROFILE_LIMIT = 1;

const FREE_AI_SESSION_LIMITS = {
  children: 2,
  teens: 3,
  uni: 3,
} as const;

const FREE_COMPETITION_LIMITS = {
  children: 0,
  teens: 2,
  uni: 2,
} as const;

function isSameLocalDay(dateIso: string) {
  const now = new Date();
  const value = new Date(dateIso);

  return (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate()
  );
}

export function isProTier(subscriptionTier: SubscriptionTier) {
  return subscriptionTier === "pro";
}

export function getProfileLimit(subscriptionTier: SubscriptionTier) {
  return isProTier(subscriptionTier) ? Number.POSITIVE_INFINITY : FREE_PROFILE_LIMIT;
}

export function canCreateAnotherProfile(subscriptionTier: SubscriptionTier, profileCount: number) {
  return profileCount < getProfileLimit(subscriptionTier);
}

export function getDailyAiSessionLimit(subscriptionTier: SubscriptionTier) {
  return isProTier(subscriptionTier) ? Number.POSITIVE_INFINITY : FREE_AI_SESSION_LIMITS[appVariant.id];
}

export function getDailyCompetitionLimit(subscriptionTier: SubscriptionTier) {
  return isProTier(subscriptionTier) ? Number.POSITIVE_INFINITY : FREE_COMPETITION_LIMITS[appVariant.id];
}

export function getDailyAiSessionsUsed(results: SessionResult[]) {
  return results.filter((result) => isSameLocalDay(result.date) && result.questionSource === "remote" && !result.competitionId).length;
}

export function getDailyCompetitionsUsed(results: SessionResult[]) {
  return results.filter((result) => isSameLocalDay(result.date) && Boolean(result.competitionId)).length;
}

export function canUseAiToday(subscriptionTier: SubscriptionTier, results: SessionResult[]) {
  return getDailyAiSessionsUsed(results) < getDailyAiSessionLimit(subscriptionTier);
}

export function canJoinCompetitionToday(subscriptionTier: SubscriptionTier, results: SessionResult[]) {
  return getDailyCompetitionsUsed(results) < getDailyCompetitionLimit(subscriptionTier);
}

export function shouldShowUpgradePrompts(subscriptionTier: SubscriptionTier) {
  return appVariant.id !== "children" && !isProTier(subscriptionTier);
}

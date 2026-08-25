import Constants from "expo-constants";
import { appVariant } from "./app-variant";
import type { SessionResult, SubscriptionTier } from "../types/app";

const FREE_PROFILE_LIMIT = 1;
const PRO_PROFILE_LIMIT = 2;

const FREE_AI_SESSION_LIMITS = {
  children: 2,
  teens: 3,
  uni: 3,
} as const;

const FREE_COMPETITION_LIMITS = {
  children: 2,
  teens: 2,
  uni: 2,
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

const subscriptionRestrictionsEnabled =
  normalizeEnvValue(
    process.env.EXPO_PUBLIC_ENABLE_SUBSCRIPTION_RESTRICTIONS ??
      extra.EXPO_PUBLIC_ENABLE_SUBSCRIPTION_RESTRICTIONS ??
      "false"
  ) === "true";

const subscriptionPurchasesEnabled =
  normalizeEnvValue(
    process.env.EXPO_PUBLIC_ENABLE_SUBSCRIPTION_PURCHASES ??
      extra.EXPO_PUBLIC_ENABLE_SUBSCRIPTION_PURCHASES ??
      "false"
  ) === "true";

function isSameLocalDay(dateIso: string) {
  const now = new Date();
  const value = new Date(dateIso);

  return (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate()
  );
}

export function areSubscriptionRestrictionsEnabled() {
  return subscriptionRestrictionsEnabled;
}

export function areSubscriptionPurchasesEnabled() {
  return subscriptionPurchasesEnabled;
}

export function hasProAccess(subscriptionTier: SubscriptionTier) {
  return !subscriptionRestrictionsEnabled || subscriptionTier === "pro";
}

export function isProTier(subscriptionTier: SubscriptionTier) {
  return subscriptionTier === "pro";
}

export function canUseClassroom(subscriptionTier: SubscriptionTier) {
  return isProTier(subscriptionTier);
}

export function getProfileLimit(subscriptionTier: SubscriptionTier) {
  if (!subscriptionRestrictionsEnabled) {
    return Number.POSITIVE_INFINITY;
  }

  return isProTier(subscriptionTier) ? PRO_PROFILE_LIMIT : FREE_PROFILE_LIMIT;
}

export function canCreateAnotherProfile(subscriptionTier: SubscriptionTier, profileCount: number) {
  return profileCount < getProfileLimit(subscriptionTier);
}

export function getDailyAiSessionLimit(subscriptionTier: SubscriptionTier) {
  return hasProAccess(subscriptionTier) ? Number.POSITIVE_INFINITY : FREE_AI_SESSION_LIMITS[appVariant.id];
}

export function getDailyCompetitionLimit(subscriptionTier: SubscriptionTier) {
  return hasProAccess(subscriptionTier) ? Number.POSITIVE_INFINITY : FREE_COMPETITION_LIMITS[appVariant.id];
}

export function getDailyLearningHubLimit(subscriptionTier: SubscriptionTier) {
  return isProTier(subscriptionTier) ? Number.POSITIVE_INFINITY : 1;
}

export function getDailyLearningHubGenerationsUsed(generationDates: string[]) {
  return generationDates.filter(isSameLocalDay).length;
}

export function canGenerateLearningHubToday(subscriptionTier: SubscriptionTier, generationDates: string[]) {
  return getDailyLearningHubGenerationsUsed(generationDates) < getDailyLearningHubLimit(subscriptionTier);
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
  return subscriptionRestrictionsEnabled && appVariant.id !== "children" && !isProTier(subscriptionTier);
}

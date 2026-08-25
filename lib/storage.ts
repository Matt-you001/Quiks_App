import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteCloudProfile, getAuthenticatedAccount, isFirebaseConfigured, loadCloudState, saveCloudState } from "./firebase";
import { DEFAULT_LANGUAGE, normalizeLanguage } from "./i18n";
import { getSubjectDisplayName } from "./subjects";
import type { AppAccount, SessionResult, StoredAppState, SubscriptionTier, UserProfile, UserRole } from "../types/app";

const STORAGE_KEY = "quiks_mobile_state_v1";
const QUESTION_HISTORY_KEY = "quiks_question_history_v1";
// Authentication should never leave the user waiting on a slow Firestore
// request. If the first read misses this window, the existing background
// refresh still merges the cloud profiles as soon as the request completes.
const CLOUD_READ_TIMEOUT_MS = 2000;
const CLOUD_WRITE_WAIT_MS = 3000;
const CLOUD_REFRESH_INTERVAL_MS = 30_000;
const cloudRefreshInFlight = new Set<string>();
const lastCloudRefreshAt = new Map<string, number>();

function getAccountStorageKey(accountUid: string) {
  return `${STORAGE_KEY}:${accountUid}`;
}

const defaultState: StoredAppState = {
  account: null,
  isAuthenticated: false,
  profiles: [],
  currentProfileId: null,
  results: {},
  learningHubGenerationDates: [],
  reviewPromptLastShownAt: null,
  reviewCompletedAt: null,
  subscriptionTier: "free",
  subscriptionExpiresAt: null,
  subscriptionUpdatedAt: 0,
};

function normalizeProfile(profile: UserProfile): UserProfile {
  return {
    ...profile,
    updatedAt: Number.isFinite(profile.updatedAt) ? profile.updatedAt : 0,
    targetExam: profile.targetExam ?? "",
    preferredCurriculum: typeof profile.preferredCurriculum === "string" ? profile.preferredCurriculum : "",
    dailyGoalMinutes: Number.isFinite(profile.dailyGoalMinutes) ? profile.dailyGoalMinutes : 0,
    schoolName: typeof profile.schoolName === "string" ? profile.schoolName : "",
    teachingFocus: typeof profile.teachingFocus === "string" ? profile.teachingFocus : "",
    language: normalizeLanguage(profile.language ?? DEFAULT_LANGUAGE),
    role: normalizeUserRole(profile.role),
    quiksId: normalizeQuiksId(profile.quiksId, profile.id),
  };
}

function normalizeUserRole(role?: string): UserRole {
  return role === "teacher" ? "teacher" : "student";
}

function normalizeQuiksId(quiksId: string | undefined, seed: string) {
  if (typeof quiksId === "string" && quiksId.trim().length >= 6) {
    return quiksId.trim().toUpperCase();
  }

  const compactSeed = seed.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `QX-${compactSeed.slice(0, 8).padEnd(8, "0")}`;
}

function normalizeState(state: Partial<StoredAppState>): StoredAppState {
  const profiles = (state.profiles ?? []).map(normalizeProfile);
  const preferredProfileId = state.currentProfileId ?? profiles[0]?.id ?? null;
  const results = Object.fromEntries(
    Object.entries(state.results ?? {}).map(([profileId, profileResults]) => {
      const language = profiles.find((profile) => profile.id === profileId)?.language ?? DEFAULT_LANGUAGE;
      return [
        profileId,
        profileResults.map((result) => ({
          ...result,
          subjectName: getSubjectDisplayName(result.subjectId, result.subjectName, language),
        })),
      ];
    })
  );

  const subscriptionTier = state.subscriptionTier === "pro" ? "pro" : "free";
  const learningHubGenerationDates = Array.isArray(state.learningHubGenerationDates)
    ? state.learningHubGenerationDates
        .filter((value): value is string => typeof value === "string" && Number.isFinite(new Date(value).getTime()))
        .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())
        .slice(-90)
    : [];
  const subscriptionExpiresAt =
    subscriptionTier === "pro" && typeof state.subscriptionExpiresAt === "string"
      ? state.subscriptionExpiresAt
      : null;
  const reviewPromptLastShownAt =
    typeof state.reviewPromptLastShownAt === "string" && Number.isFinite(new Date(state.reviewPromptLastShownAt).getTime())
      ? state.reviewPromptLastShownAt
      : null;
  const reviewCompletedAt =
    typeof state.reviewCompletedAt === "string" && Number.isFinite(new Date(state.reviewCompletedAt).getTime())
      ? state.reviewCompletedAt
      : null;

  // Subscription limits govern whether another profile may be created. They
  // must never trim profiles that already belong to the account: web plan
  // hydration can briefly report "free" before the subscription lookup
  // completes, and destructive normalization would otherwise overwrite the
  // complete cloud record with a one-profile snapshot.
  return {
    account: state.account ?? null,
    isAuthenticated: Boolean(state.isAuthenticated && state.account),
    profiles,
    currentProfileId: profiles.some((profile) => profile.id === preferredProfileId)
      ? preferredProfileId
      : profiles[0]?.id ?? null,
    results,
    learningHubGenerationDates,
    reviewPromptLastShownAt,
    reviewCompletedAt,
    subscriptionTier,
    subscriptionExpiresAt,
    subscriptionUpdatedAt:
      typeof state.subscriptionUpdatedAt === "number" && Number.isFinite(state.subscriptionUpdatedAt)
        ? state.subscriptionUpdatedAt
        : 0,
  };
}

function mergeProfiles(localProfiles: UserProfile[], remoteProfiles: UserProfile[]) {
  const merged = new Map(remoteProfiles.map((profile) => [profile.id, normalizeProfile(profile)]));

  for (const profile of localProfiles) {
    const normalizedLocal = normalizeProfile(profile);
    const remote = merged.get(normalizedLocal.id);
    if (!remote || (normalizedLocal.updatedAt ?? 0) >= (remote.updatedAt ?? 0)) {
      merged.set(normalizedLocal.id, normalizedLocal);
    }
  }

  return Array.from(merged.values());
}

function mergeResultsMap(
  localResults: Record<string, SessionResult[]>,
  remoteResults: Record<string, SessionResult[]>
) {
  const profileIds = new Set([...Object.keys(localResults), ...Object.keys(remoteResults)]);
  const merged: Record<string, SessionResult[]> = {};

  for (const profileId of profileIds) {
    const byId = new Map<string, SessionResult>();

    for (const result of remoteResults[profileId] ?? []) {
      byId.set(result.id, result);
    }

    for (const result of localResults[profileId] ?? []) {
      const existing = byId.get(result.id);
      if (!existing) {
        byId.set(result.id, result);
        continue;
      }

      const localDate = new Date(result.date).getTime();
      const remoteDate = new Date(existing.date).getTime();
      if (Number.isFinite(localDate) && (!Number.isFinite(remoteDate) || localDate >= remoteDate)) {
        byId.set(result.id, result);
      }
    }

    merged[profileId] = Array.from(byId.values()).sort(
      (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
    );
  }

  return merged;
}

function mergeStoredStates(
  localState: StoredAppState,
  remoteState: Partial<StoredAppState>,
  remoteAccount: AppAccount | null
): StoredAppState {
  const normalizedRemote = normalizeState(remoteState);
  const profiles = mergeProfiles(localState.profiles, normalizedRemote.profiles);
  const results = mergeResultsMap(localState.results, normalizedRemote.results);
  const learningHubGenerationDates = Array.from(
    new Set([...localState.learningHubGenerationDates, ...normalizedRemote.learningHubGenerationDates])
  );
  const preferredProfileId =
    localState.currentProfileId ??
    normalizedRemote.currentProfileId ??
    profiles[0]?.id ??
    null;
  const localSubscriptionIsNewer =
    localState.subscriptionUpdatedAt > normalizedRemote.subscriptionUpdatedAt;
  const remoteSubscriptionIsNewer =
    normalizedRemote.subscriptionUpdatedAt > localState.subscriptionUpdatedAt;
  const selectedSubscription = localSubscriptionIsNewer
    ? localState
    : remoteSubscriptionIsNewer
      ? normalizedRemote
      : localState.subscriptionTier === "pro"
        ? localState
        : normalizedRemote;
  const latestReviewPromptTime = [localState.reviewPromptLastShownAt, normalizedRemote.reviewPromptLastShownAt]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
  const latestReviewCompletionTime = [localState.reviewCompletedAt, normalizedRemote.reviewCompletedAt]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

  return normalizeState({
    account: remoteAccount ?? localState.account ?? normalizedRemote.account ?? null,
    isAuthenticated: Boolean(remoteAccount ?? localState.account ?? normalizedRemote.account),
    profiles,
    currentProfileId: profiles.some((profile) => profile.id === preferredProfileId) ? preferredProfileId : profiles[0]?.id ?? null,
    results,
    learningHubGenerationDates,
    reviewPromptLastShownAt: latestReviewPromptTime,
    reviewCompletedAt: latestReviewCompletionTime,
    subscriptionTier: selectedSubscription.subscriptionTier,
    subscriptionExpiresAt: selectedSubscription.subscriptionExpiresAt,
    subscriptionUpdatedAt: selectedSubscription.subscriptionUpdatedAt,
  });
}

async function readStoredState(key: string): Promise<StoredAppState | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return normalizeState(JSON.parse(raw) as StoredAppState);
  } catch {
    return null;
  }
}

async function readLocalAppState(accountUid?: string): Promise<StoredAppState> {
  const sharedState = await readStoredState(STORAGE_KEY);
  const resolvedUid = accountUid ?? getAuthenticatedAccount()?.uid ?? sharedState?.account?.uid;
  if (!resolvedUid) {
    return sharedState ?? defaultState;
  }

  const accountState = await readStoredState(getAccountStorageKey(resolvedUid));
  if (accountState) {
    if (sharedState?.account?.uid === resolvedUid) {
      return mergeStoredStates(
        accountState,
        sharedState,
        accountState.account ?? sharedState.account
      );
    }
    return accountState;
  }

  if (sharedState?.account?.uid === resolvedUid) {
    return sharedState;
  }

  // Migrate profiles left by builds that cleared the account field during
  // logout before per-account caches were introduced.
  if (!sharedState?.account && (sharedState?.profiles.length ?? 0) > 0) {
    return sharedState!;
  }

  return defaultState;
}

async function persistLocalAppState(state: StoredAppState) {
  const serialized = JSON.stringify(state);
  await AsyncStorage.setItem(STORAGE_KEY, serialized);
  if (state.account?.uid) {
    await AsyncStorage.setItem(getAccountStorageKey(state.account.uid), serialized);
  }
}

async function readMutableAppState(): Promise<StoredAppState> {
  const remoteAccount = getAuthenticatedAccount();
  const localState = await readLocalAppState(remoteAccount?.uid);

  if (!remoteAccount) {
    return localState;
  }

  return normalizeState({
    ...localState,
    account: remoteAccount,
    isAuthenticated: true,
  });
}

async function loadCloudStateWithTimeout(uid: string) {
  return Promise.race([
    loadCloudState(uid).then((state) => ({ completed: true as const, state })),
    new Promise<{ completed: false; state: null }>((resolve) => {
      setTimeout(() => resolve({ completed: false, state: null }), CLOUD_READ_TIMEOUT_MS);
    }),
  ]);
}

function syncCloudStateInBackground(accountUid: string, normalized: StoredAppState) {
  if (!isFirebaseConfigured()) {
    return;
  }

  void saveCloudState(accountUid, normalized).catch((error) => {
    console.warn(`Cloud profile sync failed for account ${accountUid}.`, error);
  });
}

async function saveCloudStateWithTimeout(accountUid: string, normalized: StoredAppState) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const savePromise = saveCloudState(accountUid, normalized);

  await Promise.race([
    savePromise,
    new Promise<void>((resolve) => {
      timeoutId = setTimeout(resolve, CLOUD_WRITE_WAIT_MS);
    }),
  ]);

  if (timeoutId) {
    clearTimeout(timeoutId);
  }
}

async function hydrateStateFromCloud(account: AppAccount, localState: StoredAppState) {
  if (!isFirebaseConfigured()) {
    return localState;
  }

  const cloudResult = await loadCloudStateWithTimeout(account.uid);
  if (!cloudResult.completed || !cloudResult.state) {
    return localState;
  }

  const hydrated = mergeStoredStates(localState, cloudResult.state, account);
  await persistLocalAppState(hydrated);
  lastCloudRefreshAt.set(account.uid, Date.now());
  const remoteProfileCount = normalizeState(cloudResult.state).profiles.length;
  if (hydrated.profiles.length > remoteProfileCount) {
    // Repair a cloud record that was previously truncated by an older build.
    // The device holding the richer account cache becomes the recovery source.
    syncCloudStateInBackground(account.uid, hydrated);
  }
  return hydrated;
}

function refreshCloudStateInBackground(account: AppAccount) {
  if (!isFirebaseConfigured() || cloudRefreshInFlight.has(account.uid)) {
    return;
  }

  const lastRefresh = lastCloudRefreshAt.get(account.uid) ?? 0;
  if (Date.now() - lastRefresh < CLOUD_REFRESH_INTERVAL_MS) {
    return;
  }

  lastCloudRefreshAt.set(account.uid, Date.now());
  cloudRefreshInFlight.add(account.uid);
  void loadCloudState(account.uid)
    .then(async (remoteState) => {
      if (!remoteState) {
        return;
      }

      const latestLocal = await readLocalAppState(account.uid);
      if (latestLocal.account?.uid !== account.uid) {
        return;
      }

      const refreshed = mergeStoredStates(latestLocal, remoteState, account);
      await persistLocalAppState(refreshed);
    })
    .catch((error) => {
      console.warn(`Cloud profile refresh failed for account ${account.uid}.`, error);
    })
    .finally(() => {
      cloudRefreshInFlight.delete(account.uid);
    });
}

export async function readAppState(options?: { awaitCloudRefresh?: boolean }): Promise<StoredAppState> {
  try {
    const remoteAccount = getAuthenticatedAccount();
    let localState = await readLocalAppState(remoteAccount?.uid);
    if (!remoteAccount) {
      return localState;
    }

    const accountLocalState =
      localState.account?.uid === remoteAccount.uid || (!localState.account && localState.profiles.length > 0)
        ? localState
        : normalizeState({
            ...defaultState,
            account: remoteAccount,
            isAuthenticated: true,
          });
    const merged = normalizeState({
      ...accountLocalState,
      account: remoteAccount,
      isAuthenticated: true,
    } satisfies StoredAppState);

    await persistLocalAppState(merged);
    if (options?.awaitCloudRefresh) {
      try {
        return await hydrateStateFromCloud(remoteAccount, merged);
      } catch (error) {
        console.warn(`Cloud profile refresh failed for account ${remoteAccount.uid}.`, error);
      }
    }
    refreshCloudStateInBackground(remoteAccount);
    return merged;
  } catch (error) {
    console.warn("App state hydration failed; using the account's local cache.", error);
    return readLocalAppState();
  }
}

export async function writeAppState(nextState: StoredAppState, options?: { awaitCloudSync?: boolean }) {
  const normalized = normalizeState(nextState);
  await persistLocalAppState(normalized);
  if (normalized.account?.uid && normalized.isAuthenticated && isFirebaseConfigured()) {
    if (options?.awaitCloudSync) {
      await saveCloudStateWithTimeout(normalized.account.uid, normalized);
    } else {
      syncCloudStateInBackground(normalized.account.uid, normalized);
    }
  }
}

export async function upsertProfile(profile: UserProfile) {
  const state = await readMutableAppState();
  const normalizedProfile = normalizeProfile(profile);
  const index = state.profiles.findIndex((item) => item.id === normalizedProfile.id);

  if (index >= 0) {
    state.profiles[index] = normalizedProfile;
  } else {
    state.profiles.push(normalizedProfile);
  }

  state.currentProfileId = normalizedProfile.id;
  await writeAppState(state, { awaitCloudSync: true });
  return state;
}

export async function deleteProfile(profileId: string) {
  const state = await readMutableAppState();
  state.profiles = state.profiles.filter((profile) => profile.id !== profileId);
  delete state.results[profileId];
  if (state.currentProfileId === profileId) {
    state.currentProfileId = state.profiles[0]?.id ?? null;
  }
  await writeAppState(state, { awaitCloudSync: true });
  if (state.account?.uid && state.isAuthenticated && isFirebaseConfigured()) {
    await deleteCloudProfile(state.account.uid, profileId);
  }
  return state;
}

export async function setCurrentProfile(profileId: string | null) {
  const state = await readMutableAppState();
  state.currentProfileId = profileId;
  await writeAppState(state);
  return state;
}

export async function appendResult(profileId: string, result: SessionResult) {
  const state = await readMutableAppState();
  const existing = state.results[profileId] ?? [];
  const resultTime = new Date(result.date).getTime();
  const deduped = existing.filter(
    (item) => {
      if (item.id === result.id) {
        return false;
      }

      if (item.competitionId && result.competitionId && item.competitionId === result.competitionId) {
        return false;
      }

      const itemTime = new Date(item.date).getTime();
      const isLikelyDuplicateLocalSession =
        !item.competitionId &&
        !result.competitionId &&
        item.subjectId === result.subjectId &&
        item.grade === result.grade &&
        item.level === result.level &&
        item.mode === result.mode &&
        item.focusMode === result.focusMode &&
        item.topicId === result.topicId &&
        item.score === result.score &&
        item.correctAnswers === result.correctAnswers &&
        item.totalQuestions === result.totalQuestions &&
        Math.abs(item.timeTakenSeconds - result.timeTakenSeconds) <= 3 &&
        Math.abs(itemTime - resultTime) <= 15_000;

      return !isLikelyDuplicateLocalSession;
    }
  );
  state.results[profileId] = [result, ...deduped];
  await writeAppState(state);
  return state;
}

export async function upsertResult(profileId: string, result: SessionResult) {
  const state = await readMutableAppState();
  const existing = state.results[profileId] ?? [];
  const nextResults = [...existing];
  const existingIndex = nextResults.findIndex(
    (item) =>
      item.id === result.id ||
      Boolean(item.competitionId && result.competitionId && item.competitionId === result.competitionId)
  );

  if (existingIndex >= 0) {
    nextResults[existingIndex] = result;
  } else {
    nextResults.unshift(result);
  }

  state.results[profileId] = nextResults.sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );
  await writeAppState(state);
  return state;
}

export async function setSubscriptionTier(
  subscriptionTier: SubscriptionTier,
  subscriptionExpiresAt: string | null = null
) {
  // Subscription refreshes can happen immediately after authentication. Merge
  // the latest cloud state first so updating the plan never publishes a stale
  // local profile snapshot over the account's complete profile collection.
  const state = await readAppState({ awaitCloudRefresh: true });
  state.subscriptionTier = subscriptionTier;
  state.subscriptionExpiresAt = subscriptionTier === "pro" ? subscriptionExpiresAt : null;
  state.subscriptionUpdatedAt = Date.now();
  const normalized = normalizeState(state);
  await writeAppState(normalized);
  return normalized;
}

export async function recordLearningHubGeneration(dateIso = new Date().toISOString()) {
  const state = await readMutableAppState();
  state.learningHubGenerationDates = Array.from(new Set([...state.learningHubGenerationDates, dateIso]))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())
    .slice(-90);
  await writeAppState(state, { awaitCloudSync: true });
  return state;
}

export async function recordReviewPromptShown(dateIso = new Date().toISOString()) {
  const state = await readMutableAppState();
  state.reviewPromptLastShownAt = dateIso;
  await writeAppState(state, { awaitCloudSync: true });
  return state;
}

export async function recordReviewCompleted(dateIso = new Date().toISOString()) {
  const state = await readMutableAppState();
  state.reviewCompletedAt = dateIso;
  await writeAppState(state, { awaitCloudSync: true });
  return state;
}

export async function setAuthenticatedAccount(account: AppAccount | null, isAuthenticated: boolean) {
  const localState = await readLocalAppState(account?.uid);
  if (!account || !isAuthenticated) {
    const signedOutState = normalizeState({
      ...localState,
      account,
      isAuthenticated: false,
    });
    await writeAppState(signedOutState);
    return signedOutState;
  }

  const accountLocalState =
    localState.account?.uid === account.uid || (!localState.account && localState.profiles.length > 0)
      ? normalizeState({
          ...localState,
          account,
          isAuthenticated: true,
        })
      : normalizeState({
          ...defaultState,
          account,
          isAuthenticated: true,
        });

  let hydratedState = accountLocalState;
  let cloudReadCompleted = !isFirebaseConfigured();

  if (isFirebaseConfigured()) {
    lastCloudRefreshAt.set(account.uid, Date.now());
    try {
      const cloudResult = await loadCloudStateWithTimeout(account.uid);
      cloudReadCompleted = cloudResult.completed;
      if (cloudResult.completed && cloudResult.state) {
        hydratedState = mergeStoredStates(accountLocalState, cloudResult.state, account);
      }
    } catch {
      // Authenticate locally without risking an overwrite of an unread cloud state.
    }
  }

  await persistLocalAppState(hydratedState);
  if (cloudReadCompleted && isFirebaseConfigured()) {
    syncCloudStateInBackground(account.uid, hydratedState);
  } else {
    lastCloudRefreshAt.delete(account.uid);
    refreshCloudStateInBackground(account);
  }
  return hydratedState;
}

export async function logoutAccount() {
  const state = await readLocalAppState();

  if (state.account?.uid && state.isAuthenticated && isFirebaseConfigured()) {
    await saveCloudStateWithTimeout(state.account.uid, state);
  }

  state.isAuthenticated = false;
  state.currentProfileId = null;
  const signedOutState = normalizeState(state);
  await persistLocalAppState(signedOutState);
  return signedOutState;
}

export async function getProfileResults(profileId: string) {
  const state = await readAppState();
  return state.results[profileId] ?? [];
}

type QuestionHistoryState = Record<string, string[]>;

async function readQuestionHistoryState(): Promise<QuestionHistoryState> {
  const raw = await AsyncStorage.getItem(QUESTION_HISTORY_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as QuestionHistoryState;
    return parsed ?? {};
  } catch {
    return {};
  }
}

async function writeQuestionHistoryState(nextState: QuestionHistoryState) {
  await AsyncStorage.setItem(QUESTION_HISTORY_KEY, JSON.stringify(nextState));
}

function createQuestionHistoryKey(profileId: string, subjectId: string) {
  return `${profileId}:${subjectId}`;
}

export async function getRecentQuestionIds(profileId: string, subjectId: string) {
  const state = await readQuestionHistoryState();
  return state[createQuestionHistoryKey(profileId, subjectId)] ?? [];
}

export async function appendQuestionHistory(profileId: string, subjectId: string, questionIds: string[]) {
  const state = await readQuestionHistoryState();
  const key = createQuestionHistoryKey(profileId, subjectId);
  const existing = state[key] ?? [];
  const merged = [...questionIds, ...existing.filter((id) => !questionIds.includes(id))].slice(0, 80);
  state[key] = merged;
  await writeQuestionHistoryState(state);
  return merged;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthenticatedAccount, isFirebaseConfigured, loadCloudState, saveCloudState } from "./firebase";
import { DEFAULT_LANGUAGE, normalizeLanguage } from "./i18n";
import { areSubscriptionRestrictionsEnabled } from "./subscription";
import { getSubjectDisplayName } from "./subjects";
import type { AppAccount, SessionResult, StoredAppState, SubscriptionTier, UserProfile, UserRole } from "../types/app";

const STORAGE_KEY = "quiks_mobile_state_v1";
const QUESTION_HISTORY_KEY = "quiks_question_history_v1";
const CLOUD_READ_TIMEOUT_MS = 1500;
const CLOUD_WRITE_WAIT_MS = 1000;
const CLOUD_REFRESH_INTERVAL_MS = 30_000;
const cloudRefreshInFlight = new Set<string>();
const lastCloudRefreshAt = new Map<string, number>();

const defaultState: StoredAppState = {
  account: null,
  isAuthenticated: false,
  profiles: [],
  currentProfileId: null,
  results: {},
  subscriptionTier: "free",
};

function enforceProfileLimit(state: StoredAppState): StoredAppState {
  if (!areSubscriptionRestrictionsEnabled()) {
    return state;
  }

  if (state.subscriptionTier !== "free" || state.profiles.length <= 1) {
    return state;
  }

  const firstProfile = state.profiles[0] ?? null;
  const nextResults = firstProfile
    ? { [firstProfile.id]: state.results[firstProfile.id] ?? [] }
    : {};

  return {
    ...state,
    profiles: firstProfile ? [firstProfile] : [],
    currentProfileId: firstProfile?.id ?? null,
    results: nextResults,
  };
}

function normalizeProfile(profile: UserProfile): UserProfile {
  return {
    ...profile,
    targetExam: profile.targetExam ?? "",
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

  return enforceProfileLimit({
    account: state.account ?? null,
    isAuthenticated: Boolean(state.isAuthenticated && state.account),
    profiles,
    currentProfileId: profiles.some((profile) => profile.id === preferredProfileId)
      ? preferredProfileId
      : profiles[0]?.id ?? null,
    results,
    subscriptionTier: state.subscriptionTier === "pro" ? "pro" : "free",
  });
}

function mergeProfiles(localProfiles: UserProfile[], remoteProfiles: UserProfile[]) {
  const merged = [...localProfiles];
  const seen = new Set(localProfiles.map((profile) => profile.id));

  for (const profile of remoteProfiles) {
    if (!seen.has(profile.id)) {
      merged.push(profile);
      seen.add(profile.id);
    }
  }

  return merged;
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
  const preferredProfileId =
    localState.currentProfileId ??
    normalizedRemote.currentProfileId ??
    profiles[0]?.id ??
    null;

  return normalizeState({
    account: remoteAccount ?? localState.account ?? normalizedRemote.account ?? null,
    isAuthenticated: Boolean(remoteAccount ?? localState.account ?? normalizedRemote.account),
    profiles,
    currentProfileId: profiles.some((profile) => profile.id === preferredProfileId) ? preferredProfileId : profiles[0]?.id ?? null,
    results,
    subscriptionTier:
      localState.subscriptionTier === "pro" || normalizedRemote.subscriptionTier === "pro" ? "pro" : "free",
  });
}

async function readLocalAppState(): Promise<StoredAppState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultState;
  }

  try {
    return normalizeState(JSON.parse(raw) as StoredAppState);
  } catch {
    return defaultState;
  }
}

async function readMutableAppState(): Promise<StoredAppState> {
  const localState = await readLocalAppState();
  const remoteAccount = getAuthenticatedAccount();

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

  void saveCloudState(accountUid, normalized).catch(() => {
    // Keep local progress even if cloud sync is temporarily unavailable.
  });
}

async function saveCloudStateWithTimeout(accountUid: string, normalized: StoredAppState) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const savePromise = saveCloudState(accountUid, normalized).catch(() => {
    // The local mutation remains available for a later cloud-sync retry.
  });

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

      const latestLocal = await readLocalAppState();
      if (latestLocal.account?.uid !== account.uid) {
        return;
      }

      const refreshed = mergeStoredStates(latestLocal, remoteState, account);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(refreshed));
    })
    .catch(() => {
      // Keep local navigation responsive while cloud refresh retries later.
    })
    .finally(() => {
      cloudRefreshInFlight.delete(account.uid);
    });
}

export async function readAppState(): Promise<StoredAppState> {
  let localState = await readLocalAppState();

  try {
    const remoteAccount = getAuthenticatedAccount();
    if (!remoteAccount) {
      return localState;
    }

    const accountLocalState =
      localState.account?.uid === remoteAccount.uid
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

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    refreshCloudStateInBackground(remoteAccount);
    return merged;
  } catch {
    return localState;
  }
}

export async function writeAppState(nextState: StoredAppState, options?: { awaitCloudSync?: boolean }) {
  const normalized = normalizeState(nextState);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
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
  await writeAppState(state);
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

export async function setSubscriptionTier(subscriptionTier: SubscriptionTier) {
  const state = await readMutableAppState();
  state.subscriptionTier = subscriptionTier;
  const normalized = normalizeState(state);
  await writeAppState(normalized);
  return normalized;
}

export async function setAuthenticatedAccount(account: AppAccount | null, isAuthenticated: boolean) {
  const localState = await readLocalAppState();
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
    localState.account?.uid === account.uid
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

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(hydratedState));
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
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(signedOutState));
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

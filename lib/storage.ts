import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SessionResult, StoredAppState, UserProfile } from "../types/app";

const STORAGE_KEY = "quiks_mobile_state_v1";

const defaultState: StoredAppState = {
  profiles: [],
  currentProfileId: null,
  results: {},
};

export async function readAppState(): Promise<StoredAppState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultState;
  }

  try {
    const parsed = JSON.parse(raw) as StoredAppState;
    return {
      profiles: parsed.profiles ?? [],
      currentProfileId: parsed.currentProfileId ?? null,
      results: parsed.results ?? {},
    };
  } catch {
    return defaultState;
  }
}

export async function writeAppState(nextState: StoredAppState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

export async function upsertProfile(profile: UserProfile) {
  const state = await readAppState();
  const index = state.profiles.findIndex((item) => item.id === profile.id);

  if (index >= 0) {
    state.profiles[index] = profile;
  } else {
    state.profiles.push(profile);
  }

  state.currentProfileId = profile.id;
  await writeAppState(state);
  return state;
}

export async function deleteProfile(profileId: string) {
  const state = await readAppState();
  state.profiles = state.profiles.filter((profile) => profile.id !== profileId);
  delete state.results[profileId];
  if (state.currentProfileId === profileId) {
    state.currentProfileId = state.profiles[0]?.id ?? null;
  }
  await writeAppState(state);
  return state;
}

export async function setCurrentProfile(profileId: string | null) {
  const state = await readAppState();
  state.currentProfileId = profileId;
  await writeAppState(state);
  return state;
}

export async function appendResult(profileId: string, result: SessionResult) {
  const state = await readAppState();
  const existing = state.results[profileId] ?? [];
  state.results[profileId] = [result, ...existing];
  await writeAppState(state);
  return state;
}

export async function getProfileResults(profileId: string) {
  const state = await readAppState();
  return state.results[profileId] ?? [];
}

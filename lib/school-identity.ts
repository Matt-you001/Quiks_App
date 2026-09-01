import type { AppAccount, SchoolIdentityResponse, UserProfile } from "../types/app";
import { getSchoolIdentity } from "../services/ai";
import { readAppState, setCurrentProfile, upsertProfile } from "./storage";

function administrativeProfileId(account: AppAccount) {
  return `admin-${account.uid}`;
}

function administrativeQuiksId(account: AppAccount) {
  const compact = account.uid.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `QX-A-${compact.slice(0, 8).padEnd(8, "0")}`;
}

export async function syncAdministrativeProfileForAccount(account: AppAccount) {
  const identity = await getSchoolIdentity();
  const administratorMembership = identity.administratorMemberships[0];
  const administrativeRole = identity.isAppOwner
    ? "app_owner"
    : administratorMembership
      ? "school_admin"
      : null;

  if (!administrativeRole) {
    return { identity, profile: null };
  }

  const state = await readAppState({ awaitCloudRefresh: true });
  const previousCurrentProfileId = state.currentProfileId;
  const id = administrativeProfileId(account);
  const existing = state.profiles.find(
    (profile) => profile.id === id || profile.administrativeAccountUid === account.uid
  );
  const profile: UserProfile = {
    id,
    updatedAt: Date.now(),
    name: identity.viewer.displayName || account.name || identity.viewer.email.split("@")[0] || "Quiks Administrator",
    age: existing?.age ?? 0,
    targetExam: administrativeRole === "app_owner" ? "Quiks App Administration" : "School Administration",
    preferredCurriculum: "",
    dailyGoalMinutes: existing?.dailyGoalMinutes || 45,
    schoolName: administratorMembership?.schoolName ?? existing?.schoolName ?? "Quiks School",
    teachingFocus: administrativeRole === "app_owner" ? "Quiks School portfolio" : "School administration",
    language: existing?.language ?? "en",
    role: "teacher",
    quiksId: existing?.quiksId ?? administrativeQuiksId(account),
    administrativeRole,
    administrativeAccountUid: account.uid,
    ...(administratorMembership ? { administrativeSchoolId: administratorMembership.schoolId } : {}),
  };

  const nextState = await upsertProfile(profile);
  if (previousCurrentProfileId && previousCurrentProfileId !== id) {
    await setCurrentProfile(previousCurrentProfileId);
  }
  return {
    identity,
    profile: nextState.profiles.find((entry) => entry.id === id) ?? profile,
  };
}

export function isAdministrativeProfile(profile: UserProfile) {
  return profile.administrativeRole === "app_owner" || profile.administrativeRole === "school_admin";
}

export function countLearnerProfiles(profiles: UserProfile[]) {
  return profiles.filter((profile) => !isAdministrativeProfile(profile)).length;
}

export function describeAdministrativeIdentity(identity: SchoolIdentityResponse) {
  if (identity.isAppOwner) return "Quiks App Owner";
  if (identity.administratorMemberships.length > 0) return "School Administrator";
  return null;
}

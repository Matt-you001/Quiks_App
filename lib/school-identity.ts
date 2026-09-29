import type { AppAccount, SchoolIdentityResponse, UserProfile } from "../types/app";
import { getSchoolIdentity } from "../services/ai";
import { readAppState, setCurrentProfile, upsertProfile } from "./storage";
import { appVariant } from "./app-variant";

function administrativeProfileId(account: AppAccount) {
  return `admin-${account.uid}`;
}

function administrativeQuiksId(account: AppAccount) {
  const compact = account.uid.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `QX-A-${compact.slice(0, 8).padEnd(8, "0")}`;
}

function unavailablePackageEntitlements() {
  return {
    "academic.student": { status: "unavailable" as const, startsAt: null, expiresAt: null },
    "academic.school": { status: "unavailable" as const, startsAt: null, expiresAt: null },
  };
}

export async function refreshSchoolProfileAccess(profile: UserProfile) {
  if (!profile.schoolMembershipId) return profile;
  try {
    const identity = await getSchoolIdentity();
    const membership = identity.memberships?.find((entry) => entry.membershipId === profile.schoolMembershipId);
    if (!membership) return { ...profile, academicPackageEntitlements: unavailablePackageEntitlements() };
    const updated: UserProfile = {
      ...profile,
      updatedAt: Date.now(),
      schoolName: membership.schoolName,
      schoolId: membership.schoolId,
      schoolClassNaming: membership.schoolClassNaming,
      schoolCurriculum: membership.schoolCurriculum,
      preferredCurriculum: membership.schoolCurriculum || profile.preferredCurriculum,
      academicPackages: membership.academicPackages,
      academicPackageEntitlements: membership.academicPackageEntitlements,
      schoolLicenceStatus: membership.schoolLicenceStatus,
      schoolLicenceExpiresAt: membership.schoolLicenceExpiresAt,
    };
    await upsertProfile(updated);
    return updated;
  } catch {
    return { ...profile, academicPackageEntitlements: unavailablePackageEntitlements() };
  }
}

export async function syncAdministrativeProfileForAccount(account: AppAccount) {
  const identity = await getSchoolIdentity();
  // Stable membership-derived profiles connect enrolment, classrooms and CBT.
  // Existing personal profiles and their learning history are never removed.
  const beforeSync = await readAppState({ awaitCloudRefresh: true });
  const selectedBeforeSync = beforeSync.currentProfileId;
  for (const membership of identity.memberships ?? []) {
    if (membership.status !== "active") continue;
    const id = `school-${appVariant.id}-${membership.membershipId}`;
    const existingSchoolProfile = beforeSync.profiles.find((profile) => profile.id === id);
    await upsertProfile({
      id, updatedAt: Date.now(), name: membership.displayName,
      age: existingSchoolProfile?.age ?? 0,
      targetExam: membership.role === "student" ? "School learning" : "School teaching",
      dailyGoalMinutes: existingSchoolProfile?.dailyGoalMinutes ?? 45,
      language: existingSchoolProfile?.language ?? "en",
      role: membership.role === "student" ? "student" : "teacher",
      quiksId: `QX-S-${appVariant.id.toUpperCase()}-${membership.membershipId.toUpperCase()}`,
      schoolName: membership.schoolName, schoolId: membership.schoolId,
      preferredCurriculum: membership.schoolCurriculum || existingSchoolProfile?.preferredCurriculum || "",
      schoolCurriculum: membership.schoolCurriculum || "",
      schoolMembershipId: membership.membershipId,
      schoolClassNaming: membership.schoolClassNaming,
      academicPackages: membership.academicPackages,
      academicPackageEntitlements: membership.academicPackageEntitlements,
      schoolLicenceStatus: membership.schoolLicenceStatus,
      schoolLicenceExpiresAt: membership.schoolLicenceExpiresAt,
      ...(membership.role === "school_admin" ? { administrativeRole: "school_admin" as const, administrativeAccountUid: account.uid, administrativeSchoolId: membership.schoolId } : {}),
    });
  }
  if (selectedBeforeSync) {
    const previous = beforeSync.profiles.find((profile) => profile.id === selectedBeforeSync);
    const administrativeMembership = identity.memberships?.find((membership) => membership.status === "active" && membership.schoolId === previous?.administrativeSchoolId);
    await setCurrentProfile(administrativeMembership && !identity.isAppOwner
      ? `school-${appVariant.id}-${administrativeMembership.membershipId}` : selectedBeforeSync);
  }
  const administratorMembership = identity.administratorMemberships[0];
  const administrativeRole = identity.isAppOwner
    ? "app_owner"
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
  // School student/teacher profiles are real usable profiles and count toward
  // the licence allowance. Only the automatically-created owner/admin control
  // identity is excluded from learner-profile limits.
  return profiles.filter((profile) => !isAdministrativeProfile(profile)).length;
}

export function describeAdministrativeIdentity(identity: SchoolIdentityResponse) {
  if (identity.isAppOwner) return "Quiks App Owner";
  if (identity.administratorMemberships.length > 0) return "School Administrator";
  return null;
}

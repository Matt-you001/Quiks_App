import type { SchoolAcademicPackageCode, SubscriptionTier, UserProfile } from "../types/app";

export interface AcademicPackageAccess {
  allowed: boolean;
  reason: "active" | "not_purchased" | "not_started" | "package_expired" | "school_licence_expired" | "school_licence_inactive" | "unavailable";
  title: string;
  message: string;
}

type AcademicAccessProfile = Pick<UserProfile, "administrativeRole" | "schoolId" | "schoolMembershipId" | "schoolLicenceStatus" | "schoolLicenceExpiresAt" | "academicPackageEntitlements" | "academicPackages">;

function packageName(code: SchoolAcademicPackageCode) {
  return code === "academic.student" ? "Student Package" : "School Package";
}

export function getAcademicPackageAccess(profile: AcademicAccessProfile | null | undefined, code: SchoolAcademicPackageCode): AcademicPackageAccess {
  if (!profile || profile.administrativeRole === "app_owner" || (!profile.schoolId && !profile.schoolMembershipId)) {
    return { allowed: true, reason: "active", title: "Access available", message: "Access is available." };
  }
  const name = packageName(code);
  if (profile.schoolLicenceStatus === "expired") {
    const ended = profile.schoolLicenceExpiresAt ? ` It ended on ${new Date(profile.schoolLicenceExpiresAt).toLocaleDateString()}.` : "";
    return { allowed: false, reason: "school_licence_expired", title: "School licence expired", message: `Your school's main Quiks licence has expired.${ended} Ask the school administrator to renew it.` };
  }
  if (profile.schoolLicenceStatus === "suspended" || profile.schoolLicenceStatus === "draft") {
    return { allowed: false, reason: "school_licence_inactive", title: "School licence inactive", message: profile.schoolLicenceStatus === "draft" ? "Your school's main Quiks licence has not started yet." : "Your school's main Quiks licence is suspended. Ask the school administrator or Quiks support for assistance." };
  }
  const entitlement = profile.academicPackageEntitlements?.[code];
  if (entitlement?.status === "unavailable") {
    return { allowed: false, reason: "unavailable", title: "Entitlement temporarily unavailable", message: "Quiks could not verify your school's package entitlement right now. Check your connection and retry shortly. No school records have been removed." };
  }
  if (entitlement?.status === "expired") {
    const ended = entitlement.expiresAt ? ` It ended on ${new Date(entitlement.expiresAt).toLocaleDateString()}.` : "";
    return { allowed: false, reason: "package_expired", title: `${name} expired`, message: `Your school's ${name} has expired.${ended} Ask the school administrator to renew this package.` };
  }
  if (entitlement?.status === "not_started") {
    const starts = entitlement.startsAt ? ` Access starts on ${new Date(entitlement.startsAt).toLocaleDateString()}.` : "";
    return { allowed: false, reason: "not_started", title: `${name} not started`, message: `Your school's ${name} is not active yet.${starts}` };
  }
  if (entitlement?.status === "not_purchased") {
    return { allowed: false, reason: "not_purchased", title: `${name} not purchased`, message: `Your school has not purchased the ${name}. Ask the school administrator or Quiks App Owner to enable it.` };
  }
  if (entitlement?.status === "active" || profile.academicPackages?.includes(code)) {
    return { allowed: true, reason: "active", title: "Access available", message: "Access is available." };
  }
  // Profiles created before package separation remain usable until verified
  // identity data is available. An explicit empty package list fails clearly.
  if (!Array.isArray(profile.academicPackages)) {
    return { allowed: true, reason: "active", title: "Access available", message: "Access is available." };
  }
  return { allowed: false, reason: "not_purchased", title: `${name} not purchased`, message: `Your school has not purchased the ${name}. Ask the school administrator or Quiks App Owner to enable it.` };
}

export function hasAcademicPackage(profile: AcademicAccessProfile | null | undefined, code: SchoolAcademicPackageCode) {
  return getAcademicPackageAccess(profile, code).allowed;
}

export function academicPackageMessage(code: SchoolAcademicPackageCode, profile?: AcademicAccessProfile | null) {
  return getAcademicPackageAccess(profile, code).message;
}

export function getEffectiveStudentTier(
  profile: AcademicAccessProfile | null | undefined,
  individualTier: SubscriptionTier
): SubscriptionTier {
  if (individualTier === "pro" || profile?.administrativeRole === "app_owner") return "pro";
  if (!profile?.schoolId && !profile?.schoolMembershipId) return individualTier;
  return getAcademicPackageAccess(profile, "academic.student").allowed ? "pro" : "free";
}

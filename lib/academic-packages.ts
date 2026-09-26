import type { SchoolAcademicPackageCode, UserProfile } from "../types/app";

export function hasAcademicPackage(profile: UserProfile | null | undefined, code: SchoolAcademicPackageCode) {
  if (!profile || profile.administrativeRole === "app_owner") return true;
  if (!profile.schoolId && !profile.schoolMembershipId) return true;
  // Profiles cached before package separation remain usable until their next
  // verified school-identity sync adds an explicit package list.
  if (!Array.isArray(profile.academicPackages)) return true;
  return profile.academicPackages.includes(code);
}

export function academicPackageMessage(code: SchoolAcademicPackageCode) {
  return code === "academic.student"
    ? "Your school's licence does not include the Student Package. Ask the school administrator or Quiks App Owner to enable it."
    : "Your school's licence does not include the School Package. Ask the school administrator or Quiks App Owner to enable it.";
}

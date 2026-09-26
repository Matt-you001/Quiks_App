import { getAppOwnerEntitlement, getSchoolAdministrationContext } from "./school-store.mjs";
import { SCHOOL_ACADEMIC_PACKAGES, listAcademicGrants, replaceAcademicGrants } from "./school-admin-grants.mjs";

function requireOwner(principal) {
  if (!getAppOwnerEntitlement(principal)) {
    throw Object.assign(new Error("Only the configured Quiks App Owner can manage academic packages."), { statusCode: 403 });
  }
}

export async function schoolAcademicPackagesRequest(principal, payload) {
  requireOwner(principal);
  const schoolId = String(payload.schoolId || "").trim();
  if (!schoolId) throw Object.assign(new Error("A school is required."), { statusCode: 400 });
  const context = await getSchoolAdministrationContext(principal, schoolId);
  const grants = payload.update
    ? await replaceAcademicGrants({ school: context.school, principal, packages: payload.packages, startsAt: payload.startsAt, endsAt: payload.endsAt })
    : await listAcademicGrants(schoolId);
  return { packages: SCHOOL_ACADEMIC_PACKAGES, grants };
}

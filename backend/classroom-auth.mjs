import { verifyFirebaseRequest } from "./firebase-auth.mjs";
import { listPrincipalMemberships, assertInstitutionalFeature } from "./school-store.mjs";
import { authorizeClassroomRequest } from "./classroom-store.mjs";

export function accessError(message, statusCode = 403) {
  return Object.assign(new Error(message), { statusCode });
}

export function schoolClassroomProfile(membership, variant) {
  return {
    id: `school-${variant}-${membership.membershipId}`,
    quiksId: `QX-S-${variant.toUpperCase()}-${membership.membershipId.toUpperCase()}`,
    name: membership.displayName,
    role: membership.role === "student" ? "student" : "teacher",
    schoolId: membership.schoolId,
    schoolMembershipId: membership.membershipId,
  };
}

function decodeValue(value = {}) {
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([k, v]) => [k, decodeValue(v)]));
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decodeValue);
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  return null;
}

// Use the caller's ID token, not an admin credential: Firestore rules still apply.
// Never use an account UID or project ID supplied in the JSON body.
export async function loadVerifiedAccountProfiles(request, principal, fetcher = fetch) {
  const rawToken = request.headers["x-firebase-id-token"];
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(principal.projectId)}/databases/(default)/documents/users/${encodeURIComponent(principal.uid)}?mask.fieldPaths=state.profiles`;
  const response = await fetcher(url, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) return [];
  if (!response.ok) throw accessError("Unable to verify your saved classroom profile. Retry when profile sync is available.", 503);
  const document = await response.json();
  const profiles = decodeValue(document.fields?.state)?.profiles;
  return Array.isArray(profiles) ? profiles : [];
}

export async function authenticateClassroomRequest(request, path, body, dependencies = {}) {
  const verify = dependencies.verify ?? verifyFirebaseRequest;
  const membershipsFor = dependencies.membershipsFor ?? listPrincipalMemberships;
  const loadProfiles = dependencies.loadProfiles ?? loadVerifiedAccountProfiles;
  const authorize = dependencies.authorize ?? authorizeClassroomRequest;
  const principal = await verify(request);
  const variant = body.appVariant ?? "children";
  if (!["children", "teens", "uni"].includes(variant)) throw accessError("Invalid app variant.", 400);
  const actorKeys = ["profile", "teacherProfile", "studentProfile", "actorProfile"].filter((key) => body[key]);
  if (actorKeys.length !== 1) throw accessError("Exactly one classroom actor is required.", 400);
  const key = actorKeys[0];
  if (["/classroom/classes/claim", "/classroom/classes/student-code"].includes(path) && key !== "teacherProfile") throw accessError("A teacher profile is required.", 400);
  const id = body[key]?.id;
  if (typeof id !== "string" || !id || ["__proto__", "constructor", "prototype"].includes(id)) throw accessError("Invalid profile identity.", 400);
  let actor;
  if (id.startsWith("school-")) {
    const membership = (await membershipsFor(principal)).find((entry) => `school-${variant}-${entry.membershipId}` === id);
    if (!membership || membership.status !== "active") throw accessError("An active school membership is required for this profile.");
    actor = schoolClassroomProfile(membership, variant);
  } else {
    const saved = (await loadProfiles(request, principal)).find((profile) => profile.id === id);
    if (!saved) throw accessError("This classroom profile is not saved under the signed-in account. Sync the profile and retry.");
    // Only approved school profiles may carry institutional scope. User-editable
    // Firestore fields cannot grant school/admin roles or link a school.
    actor = { id, name: saved.name, quiksId: saved.quiksId, role: saved.role === "teacher" ? "teacher" : "student" };
  }
  if (!actor.name || !actor.quiksId) throw accessError("Complete and sync the profile before opening Classroom.", 400);
  actor.principalId = principal.principalId;
  if (key === "teacherProfile" && actor.role !== "teacher") throw accessError("Only teachers can perform this classroom action.");
  if ((key === "studentProfile" || path.endsWith("/assignments/submit")) && actor.role !== "student") throw accessError("Only students can perform this classroom action.");
  if (actor.schoolId) {
    const check = dependencies.feature ?? assertInstitutionalFeature;
    await check(principal, actor.schoolId, "classroom", variant);
    if (path.includes("lesson-notes")) await check(principal, actor.schoolId, "lessonNotes", variant);
    if (path.endsWith("/candidates") || path.endsWith("/refine") || path.endsWith("/lesson-notes/activity/create")) await check(principal, actor.schoolId, "ai", variant);
  }
  const trusted = { ...body, [key]: actor, appVariant: variant };
  const context = await authorize(path, trusted, actor, key);
  if (actor.schoolId && (body.assessmentMode === "cbt" || context?.assessmentMode === "cbt")) {
    await (dependencies.feature ?? assertInstitutionalFeature)(principal, actor.schoolId, "cbt", variant);
  }
  return trusted;
}

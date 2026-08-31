import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const configuredStorePath = String(process.env.SCHOOL_STORE_PATH ?? "").trim();
const storePath = configuredStorePath
  ? isAbsolute(configuredStorePath)
    ? configuredStorePath
    : resolve(currentDirectory, configuredStorePath)
  : join(currentDirectory, "data", "school-store.json");
const dataDirectory = dirname(storePath);
const temporaryStorePath = `${storePath}.tmp`;

const defaultStore = {
  schools: {},
  memberships: {},
  invitations: {},
  auditEvents: {},
};

const defaultProfileFields = [
  { id: "fullName", label: "Full name", type: "text", enabled: true, required: true, roles: ["teacher", "student"], system: true },
  { id: "admissionNumber", label: "Admission or staff number", type: "text", enabled: true, required: true, roles: ["teacher", "student"], system: true },
  { id: "email", label: "Email address", type: "email", enabled: true, required: true, roles: ["teacher", "student"], system: true },
  { id: "phone", label: "Phone number", type: "phone", enabled: false, required: false, roles: ["teacher", "student"], system: true },
  { id: "dateOfBirth", label: "Date of birth", type: "date", enabled: false, required: false, roles: ["student"], system: true },
  { id: "gender", label: "Gender", type: "select", enabled: false, required: false, options: ["Female", "Male", "Prefer not to say"], roles: ["student"], system: true },
  { id: "grade", label: "Grade or year", type: "text", enabled: true, required: true, roles: ["student"], system: true },
  { id: "classArm", label: "Class arm", type: "text", enabled: false, required: false, roles: ["student"], system: true },
  { id: "department", label: "Department", type: "text", enabled: false, required: false, roles: ["teacher", "student"], system: true },
  { id: "parentName", label: "Parent or guardian name", type: "text", enabled: false, required: false, roles: ["student"], system: true },
  { id: "parentPhone", label: "Parent or guardian phone", type: "phone", enabled: false, required: false, roles: ["student"], system: true },
  { id: "parentEmail", label: "Parent or guardian email", type: "email", enabled: false, required: false, roles: ["student"], system: true },
];

const defaultFeatures = {
  ai: true,
  classroom: true,
  cbt: true,
  lessonNotes: true,
  reports: true,
  integrations: false,
};

let storeCache = null;
let writeQueue = Promise.resolve();

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

async function ensureStore() {
  await mkdir(dataDirectory, { recursive: true });
  if (storeCache) return storeCache;

  try {
    const raw = await readFile(storePath, "utf8");
    storeCache = { ...defaultStore, ...JSON.parse(raw) };
  } catch {
    storeCache = cloneValue(defaultStore);
    await writeFile(storePath, JSON.stringify(storeCache, null, 2), "utf8");
  }
  return storeCache;
}

async function persistStore(store) {
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    await writeFile(temporaryStorePath, JSON.stringify(store, null, 2), "utf8");
    await rename(temporaryStorePath, storePath);
  });
  await writeQueue;
}

async function mutateStore(mutator) {
  const store = await ensureStore();
  const result = await mutator(store);
  await persistStore(store);
  return cloneValue(result);
}

function ownerValues(name) {
  return new Set(
    String(process.env[name] ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isOwner(principal) {
  const ownerPrincipals = ownerValues("QUIKS_OWNER_PRINCIPAL_IDS");
  const ownerUids = ownerValues("QUIKS_OWNER_UIDS");
  const ownerEmails = ownerValues("QUIKS_OWNER_EMAILS");
  return (
    ownerPrincipals.has(principal.principalId.toLowerCase()) ||
    ownerUids.has(principal.uid.toLowerCase()) ||
    (principal.email && ownerEmails.has(principal.email.toLowerCase()))
  );
}

function requireOwner(principal) {
  if (!isOwner(principal)) throw new Error("Only a configured Quiks owner can perform this action.");
}

function generateCode(existingCodes, length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (existingCodes.has(code));
  return code;
}

function normalizeAllowedVariants(values) {
  const allowed = new Set(["children", "teens", "uni"]);
  const normalized = Array.isArray(values) ? values.filter((value) => allowed.has(value)) : [];
  return normalized.length > 0 ? [...new Set(normalized)] : ["children", "teens", "uni"];
}

function getEffectiveLicenceStatus(licence) {
  if (licence.status === "suspended" || licence.status === "draft") return licence.status;
  const now = Date.now();
  if (now < licence.startAt) return "draft";
  if (now >= licence.endAt) return "expired";
  return "active";
}

function membershipsForSchool(store, schoolId) {
  return Object.values(store.memberships).filter((membership) => membership.schoolId === schoolId);
}

function buildSchoolSummary(store, school) {
  const memberships = membershipsForSchool(store, school.id);
  const active = memberships.filter((membership) => membership.status === "active");
  const studentCount = active.filter((membership) => membership.role === "student").length;
  const teacherCount = active.filter((membership) => membership.role === "teacher").length;
  const adminCount = active.filter((membership) => membership.role === "school_admin").length;
  return {
    schoolId: school.id,
    schoolCode: school.schoolCode,
    name: school.name,
    status: getEffectiveLicenceStatus(school.licence),
    licence: { ...school.licence, status: getEffectiveLicenceStatus(school.licence) },
    createdAt: school.createdAt,
    studentCount,
    teacherCount,
    adminCount,
    pendingCount: memberships.filter((membership) => membership.status === "pending").length,
    seatUsagePercent:
      school.licence.studentSeatLimit > 0
        ? Math.min(100, Math.round((studentCount / school.licence.studentSeatLimit) * 100))
        : 0,
  };
}

function buildMembership(store, membership) {
  return {
    membershipId: membership.membershipId,
    schoolId: membership.schoolId,
    schoolName: store.schools[membership.schoolId]?.name ?? "School",
    role: membership.role,
    status: membership.status,
    email: membership.email,
    displayName: membership.displayName,
    appVariant: membership.appVariant,
    profileData: membership.profileData ?? {},
    createdAt: membership.createdAt,
    joinedAt: membership.joinedAt,
  };
}

function membershipMatchesPrincipal(membership, principal) {
  return membership.principalId === principal.principalId || Boolean(
    principal.emailVerified && principal.email && membership.email === principal.email
  );
}

function getAdminMembership(store, schoolId, principal) {
  return Object.values(store.memberships).find(
    (membership) =>
      membership.schoolId === schoolId &&
      membershipMatchesPrincipal(membership, principal) &&
      membership.role === "school_admin" &&
      membership.status === "active"
  );
}

function requireSchoolAdmin(store, schoolId, principal) {
  if (isOwner(principal)) return;
  if (!getAdminMembership(store, schoolId, principal)) {
    throw new Error("Only an active school administrator can perform this action.");
  }
}

function recordAudit(store, principal, action, schoolId, details = {}) {
  const eventId = randomUUID();
  store.auditEvents[eventId] = {
    eventId,
    principalId: principal.principalId,
    email: principal.email,
    action,
    schoolId,
    details,
    createdAt: Date.now(),
  };
}

function validateProfileFields(fields) {
  if (!Array.isArray(fields) || fields.length === 0 || fields.length > 40) {
    throw new Error("Provide between 1 and 40 school profile fields.");
  }
  const allowedTypes = new Set(["text", "email", "phone", "number", "date", "select", "boolean"]);
  const ids = new Set();
  return fields.map((field) => {
    const id = String(field.id ?? "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    const label = String(field.label ?? "").trim().slice(0, 80);
    if (!id || !label || ids.has(id) || !allowedTypes.has(field.type)) {
      throw new Error("Every profile field must have a unique ID, label, and supported type.");
    }
    ids.add(id);
    const roles = Array.isArray(field.roles)
      ? field.roles.filter((role) => role === "teacher" || role === "student")
      : [];
    return {
      id,
      label,
      type: field.type,
      enabled: Boolean(field.enabled),
      required: Boolean(field.enabled && field.required),
      ...(field.type === "select"
        ? {
            options: [...new Set((field.options ?? []).map((option) => String(option).trim()).filter(Boolean))].slice(0, 30),
          }
        : {}),
      roles: roles.length > 0 ? [...new Set(roles)] : ["teacher", "student"],
      system: Boolean(field.system),
    };
  });
}

function validateProfileData(school, role, profileData, principal) {
  const fields = school.profileFields.filter((field) => field.enabled && field.roles.includes(role));
  const cleaned = {};
  for (const field of fields) {
    let value = profileData?.[field.id];
    if (field.id === "email" && !value) value = principal.email;
    if (field.id === "fullName" && !value) value = principal.name;
    if (field.required && (value === undefined || value === null || String(value).trim() === "")) {
      throw new Error(`${field.label} is required by this school.`);
    }
    if (value === undefined || value === null || String(value).trim() === "") continue;
    if (field.type === "boolean") {
      cleaned[field.id] = Boolean(value);
      continue;
    }
    if (field.type === "number") {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue)) throw new Error(`${field.label} must be a number.`);
      cleaned[field.id] = numberValue;
      continue;
    }
    const stringValue = String(value).trim().slice(0, 500);
    if (field.type === "select" && field.options?.length && !field.options.includes(stringValue)) {
      throw new Error(`Choose a valid option for ${field.label}.`);
    }
    cleaned[field.id] = stringValue;
  }
  return cleaned;
}

function ensureSeatAvailable(store, school, role, excludeMembershipId) {
  if (role === "school_admin") return;
  const counted = membershipsForSchool(store, school.id).filter(
    (membership) =>
      membership.membershipId !== excludeMembershipId &&
      membership.role === role &&
      (membership.status === "active" || membership.status === "pending")
  ).length;
  const limit = role === "student" ? school.licence.studentSeatLimit : school.licence.teacherSeatLimit;
  if (limit > 0 && counted >= limit) throw new Error(`This school's ${role} seat limit has been reached.`);
}

function buildEntitlement(store, membership, appVariant) {
  const school = store.schools[membership.schoolId];
  if (!school || membership.status !== "active") return null;
  const status = getEffectiveLicenceStatus(school.licence);
  const variantAllowed = school.licence.allowedVariants.includes(appVariant);
  const reason =
    status === "suspended"
      ? "suspended"
      : status === "draft"
        ? "not_started"
        : status === "expired"
          ? "expired"
          : !variantAllowed
            ? "variant_not_licensed"
            : "active";
  return {
    schoolId: school.id,
    schoolName: school.name,
    role: membership.role,
    active: reason === "active",
    expiresAt: new Date(school.licence.endAt).toISOString(),
    allowedVariants: school.licence.allowedVariants,
    reason,
  };
}

export function getSchoolStoreDiagnostics() {
  return {
    configured: Boolean(configuredStorePath),
    persistentPathExpected: storePath.startsWith("/var/data/"),
    ownerConfigured:
      ownerValues("QUIKS_OWNER_PRINCIPAL_IDS").size > 0 ||
      ownerValues("QUIKS_OWNER_UIDS").size > 0 ||
      ownerValues("QUIKS_OWNER_EMAILS").size > 0,
  };
}

export async function getSchoolPublicDetails(schoolCode) {
  const store = await ensureStore();
  const code = String(schoolCode ?? "").trim().toUpperCase();
  const invitation = store.invitations[code];
  const school = invitation && invitation.expiresAt > Date.now()
    ? store.schools[invitation.schoolId]
    : Object.values(store.schools).find((entry) => entry.schoolCode === code);
  if (!school) throw new Error("School code not found.");
  return {
    schoolId: school.id,
    schoolCode: school.schoolCode,
    name: school.name,
    status: getEffectiveLicenceStatus(school.licence),
    allowedVariants: school.licence.allowedVariants,
    profileFields: school.profileFields,
    enrolmentOpen: school.enrolmentOpen,
    ...(invitation ? { invitationCode: invitation.invitationCode } : {}),
  };
}

export async function createSchool(principal, payload) {
  requireOwner(principal);
  return mutateStore(async (store) => {
    const name = String(payload.name ?? "").trim().slice(0, 120);
    const startAt = Number(payload.startAt);
    const endAt = Number(payload.endAt);
    if (!name || !Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
      throw new Error("School name and a valid licence period are required.");
    }
    const schoolId = randomUUID();
    const schoolCode = generateCode(new Set(Object.values(store.schools).map((school) => school.schoolCode)), 7);
    const createdAt = Date.now();
    const school = {
      id: schoolId,
      schoolCode,
      name,
      enrolmentOpen: true,
      profileFields: cloneValue(defaultProfileFields),
      licence: {
        plan: ["term", "session", "pilot", "custom"].includes(payload.plan) ? payload.plan : "term",
        status: "active",
        startAt,
        endAt,
        studentSeatLimit: Math.max(1, Math.floor(Number(payload.studentSeatLimit ?? 1))),
        teacherSeatLimit: Math.max(1, Math.floor(Number(payload.teacherSeatLimit ?? 1))),
        allowedVariants: normalizeAllowedVariants(payload.allowedVariants),
        gracePeriodDays: Math.max(0, Math.floor(Number(payload.gracePeriodDays ?? 0))),
        features: { ...defaultFeatures },
      },
      createdAt,
      createdByPrincipalId: principal.principalId,
    };
    store.schools[schoolId] = school;
    const membershipId = randomUUID();
    store.memberships[membershipId] = {
      membershipId,
      schoolId,
      principalId: principal.principalId,
      email: principal.email,
      displayName: principal.name,
      role: "school_admin",
      status: "active",
      profileData: { fullName: principal.name, email: principal.email },
      createdAt,
      joinedAt: createdAt,
    };
    recordAudit(store, principal, "school.created", schoolId, { name, schoolCode });
    return buildSchoolSummary(store, school);
  });
}

export async function updateSchoolLicence(principal, schoolId, licencePatch) {
  requireOwner(principal);
  return mutateStore(async (store) => {
    const school = store.schools[schoolId];
    if (!school) throw new Error("School not found.");
    const next = { ...school.licence, ...licencePatch };
    next.allowedVariants = normalizeAllowedVariants(next.allowedVariants);
    next.studentSeatLimit = Math.max(1, Math.floor(Number(next.studentSeatLimit)));
    next.teacherSeatLimit = Math.max(1, Math.floor(Number(next.teacherSeatLimit)));
    next.startAt = Number(next.startAt);
    next.endAt = Number(next.endAt);
    if (!Number.isFinite(next.startAt) || !Number.isFinite(next.endAt) || next.endAt <= next.startAt) {
      throw new Error("The school licence dates are invalid.");
    }
    school.licence = next;
    recordAudit(store, principal, "school.licence.updated", schoolId, { endAt: next.endAt, status: next.status });
    return buildSchoolSummary(store, school);
  });
}

export async function getOwnerDashboard(principal) {
  requireOwner(principal);
  const store = await ensureStore();
  const schools = Object.values(store.schools).map((school) => buildSchoolSummary(store, school));
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return {
    totals: {
      schools: schools.length,
      activeSchools: schools.filter((school) => school.status === "active").length,
      students: schools.reduce((sum, school) => sum + school.studentCount, 0),
      teachers: schools.reduce((sum, school) => sum + school.teacherCount, 0),
      administrators: schools.reduce((sum, school) => sum + school.adminCount, 0),
      expiringWithin30Days: schools.filter(
        (school) => school.status === "active" && school.licence.endAt >= now && school.licence.endAt <= now + thirtyDays
      ).length,
    },
    schools: schools.sort((left, right) => left.name.localeCompare(right.name)),
  };
}

export async function listPrincipalMemberships(principal) {
  const store = await ensureStore();
  return Object.values(store.memberships)
    .filter((membership) => membershipMatchesPrincipal(membership, principal))
    .map((membership) => buildMembership(store, membership))
    .sort((left, right) => left.schoolName.localeCompare(right.schoolName));
}

export async function getSchoolDetails(principal, schoolId) {
  const store = await ensureStore();
  requireSchoolAdmin(store, schoolId, principal);
  const school = store.schools[schoolId];
  if (!school) throw new Error("School not found.");
  return {
    school: buildSchoolSummary(store, school),
    profileFields: cloneValue(school.profileFields),
    memberships: membershipsForSchool(store, schoolId)
      .map((membership) => buildMembership(store, membership))
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
  };
}

export async function updateSchoolProfileFields(principal, schoolId, fields) {
  return mutateStore(async (store) => {
    requireSchoolAdmin(store, schoolId, principal);
    const school = store.schools[schoolId];
    if (!school) throw new Error("School not found.");
    school.profileFields = validateProfileFields(fields);
    recordAudit(store, principal, "school.profile_fields.updated", schoolId, { fieldCount: fields.length });
    return school.profileFields;
  });
}

export async function inviteSchoolMember(principal, schoolId, email, role) {
  return mutateStore(async (store) => {
    requireSchoolAdmin(store, schoolId, principal);
    const school = store.schools[schoolId];
    if (!school) throw new Error("School not found.");
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    if (!normalizedEmail.includes("@") || !["school_admin", "teacher", "student"].includes(role)) {
      throw new Error("A valid email and school role are required.");
    }
    ensureSeatAvailable(store, school, role);
    const invitationCode = generateCode(new Set(Object.keys(store.invitations)), 10);
    const expiresAt = Date.now() + 14 * 24 * 60 * 60 * 1000;
    store.invitations[invitationCode] = {
      invitationCode,
      schoolId,
      email: normalizedEmail,
      role,
      expiresAt,
      createdAt: Date.now(),
      createdByPrincipalId: principal.principalId,
    };
    recordAudit(store, principal, "school.member.invited", schoolId, { email: normalizedEmail, role });
    return { invitationCode, expiresAt };
  });
}

export async function enrolInSchool(principal, payload) {
  return mutateStore(async (store) => {
    const code = String(payload.schoolCode ?? "").trim().toUpperCase();
    const school = Object.values(store.schools).find((entry) => entry.schoolCode === code);
    if (!school) throw new Error("School code not found.");
    const invitationCode = String(payload.invitationCode ?? "").trim().toUpperCase();
    const invitation = invitationCode ? store.invitations[invitationCode] : null;
    const role = invitation?.role ?? (payload.role === "teacher" ? "teacher" : "student");
    if (invitation) {
      if (invitation.schoolId !== school.id || invitation.expiresAt <= Date.now()) {
        throw new Error("This school invitation is invalid or expired.");
      }
      if (invitation.email && principal.email !== invitation.email) {
        throw new Error("Sign in with the email address that received this school invitation.");
      }
    } else if (!school.enrolmentOpen) {
      throw new Error("This school accepts invitation-only enrolment.");
    }
    if (payload.appVariant && !school.licence.allowedVariants.includes(payload.appVariant)) {
      throw new Error("This Quiks variant is not included in the school's licence.");
    }
    const existing = Object.values(store.memberships).find(
      (membership) => membership.schoolId === school.id && membershipMatchesPrincipal(membership, principal)
    );
    ensureSeatAvailable(store, school, role, existing?.membershipId);
    const profileData = validateProfileData(school, role === "school_admin" ? "teacher" : role, payload.profileData, principal);
    const now = Date.now();
    const membership = existing ?? {
      membershipId: randomUUID(),
      schoolId: school.id,
      createdAt: now,
    };
    Object.assign(membership, {
      principalId: principal.principalId,
      email: principal.email,
      displayName: String(profileData.fullName ?? principal.name),
      role,
      status: invitation ? "active" : "pending",
      appVariant: payload.appVariant,
      profileData,
      ...(invitation ? { joinedAt: now } : {}),
    });
    store.memberships[membership.membershipId] = membership;
    if (invitation) delete store.invitations[invitationCode];
    recordAudit(store, principal, "school.enrolment.submitted", school.id, { role, status: membership.status });
    return {
      membership: buildMembership(store, membership),
      entitlement: buildEntitlement(store, membership, payload.appVariant ?? "children") ?? {
        schoolId: school.id,
        schoolName: school.name,
        role,
        active: false,
        expiresAt: new Date(school.licence.endAt).toISOString(),
        allowedVariants: school.licence.allowedVariants,
        reason: "not_started",
      },
    };
  });
}

export async function updateMembershipStatus(principal, schoolId, membershipId, status) {
  return mutateStore(async (store) => {
    requireSchoolAdmin(store, schoolId, principal);
    const school = store.schools[schoolId];
    const membership = store.memberships[membershipId];
    if (!school || !membership || membership.schoolId !== schoolId) throw new Error("School membership not found.");
    if (!['invited', 'pending', 'active', 'suspended'].includes(status)) throw new Error("Invalid membership status.");
    if (status === "active") ensureSeatAvailable(store, school, membership.role, membershipId);
    membership.status = status;
    if (status === "active" && !membership.joinedAt) membership.joinedAt = Date.now();
    recordAudit(store, principal, "school.membership.updated", schoolId, { membershipId, status });
    return buildMembership(store, membership);
  });
}

export async function getInstitutionalEntitlement(principal, appVariant) {
  const store = await ensureStore();
  const entitlements = Object.values(store.memberships)
    .filter((membership) => membershipMatchesPrincipal(membership, principal))
    .map((membership) => buildEntitlement(store, membership, appVariant))
    .filter(Boolean)
    .sort((left, right) => Number(right.active) - Number(left.active) || new Date(right.expiresAt).getTime() - new Date(left.expiresAt).getTime());
  return entitlements[0] ?? null;
}

export async function assertInstitutionalFeature(principal, schoolId, feature, appVariant) {
  const store = await ensureStore();
  const membership = Object.values(store.memberships).find(
    (entry) => entry.schoolId === schoolId && membershipMatchesPrincipal(entry, principal) && entry.status === "active"
  );
  if (!membership) throw new Error("An active school membership is required.");
  const school = store.schools[schoolId];
  const entitlement = buildEntitlement(store, membership, appVariant);
  if (!entitlement?.active) throw new Error("The school's Quiks licence is not active for this app.");
  if (!school.licence.features?.[feature]) throw new Error(`The school licence does not include ${feature}.`);
  return { school, membership, entitlement };
}

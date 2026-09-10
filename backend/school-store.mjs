import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
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
const backupStorePath = `${storePath}.backup`;
const temporaryBackupStorePath = `${backupStorePath}.tmp`;

const defaultStore = {
  schools: {},
  individualLicences: {},
  memberships: {},
  invitations: {},
  auditEvents: {},
  pendingSchoolPurchases: {},
  schoolBillingPurchases: {},
  schoolBillingWebhookEvents: {},
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

const SCHOOL_PRICE_CATALOGUE = Object.freeze({
  pri_01m22sf7c2yapaxmrsqvcc4q26: { packageId: "per-learner", packageName: "Per Learner Access", period: "term" },
  pri_01m23awdptxksm2xxwkv1pcy6y: { packageId: "per-learner", packageName: "Per Learner Access", period: "session" },
  pri_01m22zx25r919nw4xgcnshxpet: { packageId: "starter", packageName: "Essential School", period: "term", learnerRange: [10, 100] },
  pri_01m2309pdzp0kf8s4ccrcemt6d: { packageId: "starter", packageName: "Essential School", period: "session", learnerRange: [10, 100] },
  pri_01m231caaj1z0fn97rppasvmfm: { packageId: "growth", packageName: "Growth School", period: "term", learnerRange: [101, 200] },
  pri_01m231pt3qdw4gr25jzwv8taev: { packageId: "growth", packageName: "Growth School", period: "session", learnerRange: [101, 200] },
  pri_01m231zmgwx166gnx1dtnnqxrs: { packageId: "complete", packageName: "Comprehensive School", period: "term", learnerRange: [201, 500] },
  pri_01m232j0rbgyfdvf4gvz1sheb8: { packageId: "complete", packageName: "Comprehensive School", period: "session", learnerRange: [201, 500] },
  pri_01m232tp79qtbh6w4p9y8v1d0h: { packageId: "enterprise", packageName: "Enterprise Network", period: "term" },
  pri_01m2335zfhpsxgame479sf0tz2: { packageId: "enterprise", packageName: "Enterprise Network", period: "session" },
});

const SCHOOL_PRICE_BY_SELECTION = Object.freeze(
  Object.fromEntries(Object.entries(SCHOOL_PRICE_CATALOGUE).map(([priceId, entry]) => [`${entry.packageId}:${entry.period}`, { ...entry, priceId }]))
);
const TERM_DURATION_MS = 120 * 24 * 60 * 60 * 1000;
const PENDING_PURCHASE_LIFETIME_MS = 24 * 60 * 60 * 1000;

function configuredSchoolPriceCatalogue() {
  const environment = String(process.env.QUIKS_SCHOOL_BILLING_ENVIRONMENT ?? "production").trim().toUpperCase();
  if (environment !== "SANDBOX") return SCHOOL_PRICE_CATALOGUE;
  let overrides;
  try {
    overrides = JSON.parse(String(process.env.QUIKS_SCHOOL_SANDBOX_PRICE_IDS_JSON ?? "{}"));
  } catch {
    throw new Error("QUIKS_SCHOOL_SANDBOX_PRICE_IDS_JSON must be valid JSON.");
  }
  const catalogue = {};
  for (const [selection, productionEntry] of Object.entries(SCHOOL_PRICE_BY_SELECTION)) {
    const priceId = String(overrides?.[selection] ?? "").trim();
    if (/^pri_[a-z0-9]+$/i.test(priceId)) catalogue[priceId] = { ...productionEntry, priceId: undefined };
  }
  return catalogue;
}

function configuredSchoolPriceBySelection() {
  return Object.fromEntries(
    Object.entries(configuredSchoolPriceCatalogue()).map(([priceId, entry]) => [`${entry.packageId}:${entry.period}`, { ...entry, priceId }])
  );
}

let storeCache = null;
let writeQueue = Promise.resolve();

function persistentMountDetected() {
  if (process.platform !== "linux" || !storePath.startsWith("/var/data/")) return null;
  try {
    return readFileSync("/proc/self/mountinfo", "utf8")
      .split("\n")
      .some((line) => line.split(" ")[4] === "/var/data");
  } catch {
    return null;
  }
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeStore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The school store does not contain a valid data object.");
  }
  return {
    schools: value.schools && typeof value.schools === "object" ? value.schools : {},
    individualLicences: value.individualLicences && typeof value.individualLicences === "object" ? value.individualLicences : {},
    memberships: value.memberships && typeof value.memberships === "object" ? value.memberships : {},
    invitations: value.invitations && typeof value.invitations === "object" ? value.invitations : {},
    auditEvents: value.auditEvents && typeof value.auditEvents === "object" ? value.auditEvents : {},
    pendingSchoolPurchases:
      value.pendingSchoolPurchases && typeof value.pendingSchoolPurchases === "object" ? value.pendingSchoolPurchases : {},
    schoolBillingPurchases:
      value.schoolBillingPurchases && typeof value.schoolBillingPurchases === "object" ? value.schoolBillingPurchases : {},
    schoolBillingWebhookEvents:
      value.schoolBillingWebhookEvents && typeof value.schoolBillingWebhookEvents === "object" ? value.schoolBillingWebhookEvents : {},
  };
}

async function readStoreSnapshot(path) {
  return normalizeStore(JSON.parse(await readFile(path, "utf8")));
}

async function writeStoreSnapshot(store) {
  const serialized = JSON.stringify(store, null, 2);
  await writeFile(temporaryStorePath, serialized, "utf8");
  await rename(temporaryStorePath, storePath);
  await writeFile(temporaryBackupStorePath, serialized, "utf8");
  await rename(temporaryBackupStorePath, backupStorePath);
}

async function ensureStore() {
  await mkdir(dataDirectory, { recursive: true });
  if (storeCache) return storeCache;

  try {
    storeCache = await readStoreSnapshot(storePath);
    return storeCache;
  } catch (primaryError) {
    try {
      storeCache = await readStoreSnapshot(backupStorePath);
      await writeStoreSnapshot(storeCache);
      return storeCache;
    } catch (backupError) {
      const primaryMissing = primaryError?.code === "ENOENT";
      const backupMissing = backupError?.code === "ENOENT";
      if (!primaryMissing || !backupMissing) {
        throw new Error("The school database could not be read safely. The existing files were preserved for recovery.");
      }
    }
  }

  storeCache = cloneValue(defaultStore);
  await writeStoreSnapshot(storeCache);
  return storeCache;
}

async function persistStore(store) {
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    await writeStoreSnapshot(store);
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
      .map((value) => {
        const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
        const friendlyAddress = trimmed.match(/<([^>]+)>/);
        return (friendlyAddress?.[1] ?? trimmed).trim().toLowerCase();
      })
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
    (principal.emailVerified && principal.email && ownerEmails.has(principal.email.toLowerCase()))
  );
}

function requireOwner(principal) {
  if (!isOwner(principal)) {
    throw new Error(
      `Only a configured Quiks owner can perform this action. Signed in as ${principal.email || principal.uid}.`
    );
  }
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

function hashPurchaseStatusToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

function addOneUtcCalendarYear(timestamp) {
  const source = new Date(timestamp);
  const targetYear = source.getUTCFullYear() + 1;
  const month = source.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
  return Date.UTC(
    targetYear,
    month,
    Math.min(source.getUTCDate(), lastDay),
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds()
  );
}

function addSchoolLicencePeriod(timestamp, period) {
  return period === "session" ? addOneUtcCalendarYear(timestamp) : timestamp + TERM_DURATION_MS;
}

function validateSchoolPurchaseInput(payload) {
  const schoolName = String(payload.schoolName ?? "").trim().slice(0, 120);
  const administratorName = String(payload.administratorName ?? "").trim().slice(0, 100);
  const administratorEmail = String(payload.administratorEmail ?? "").trim().toLowerCase().slice(0, 160);
  const enrolmentMode = payload.enrolmentMode === "individual_codes" ? "individual_codes" : "shared_code";
  const packageId = String(payload.packageId ?? "").trim();
  const period = payload.period === "session" ? "session" : "term";
  const learnerCount = Number(payload.learnerCount);
  const catalogueEntry = configuredSchoolPriceBySelection()[`${packageId}:${period}`];
  if (!schoolName || !administratorName || !administratorEmail.includes("@") || !catalogueEntry) {
    throw Object.assign(new Error("Provide valid school, administrator and package details."), { statusCode: 400 });
  }
  if (!Number.isInteger(learnerCount) || learnerCount < 1 || learnerCount > 100000) {
    throw Object.assign(new Error("Enter a valid whole-number learner allocation."), { statusCode: 400 });
  }
  if (catalogueEntry.learnerRange) {
    const [minimum, maximum] = catalogueEntry.learnerRange;
    if (learnerCount < minimum || learnerCount > maximum) {
      throw Object.assign(new Error(`${catalogueEntry.packageName} covers ${minimum}–${maximum} learners.`), { statusCode: 400 });
    }
  }
  return { schoolName, administratorName, administratorEmail, enrolmentMode, packageId, period, learnerCount, catalogueEntry };
}

function findRenewalSchool(store, pending) {
  const normalizedName = pending.schoolName.toLowerCase();
  return Object.values(store.schools).find(
    (school) =>
      school.name.toLowerCase() === normalizedName &&
      school.administratorSetup?.email === pending.administratorEmail
  );
}

function buildIndividualLicence(licence) {
  return { ...licence, status: getEffectiveLicenceStatus(licence) };
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
  const administratorSetup = school.administratorSetup;
  const administratorInvitation = administratorSetup?.invitationCode
    ? store.invitations[administratorSetup.invitationCode]
    : null;
  const administratorActive = administratorSetup?.email
    ? active.some(
        (membership) =>
          membership.role === "school_admin" && membership.email === administratorSetup.email
      )
    : false;
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
    enrolmentMode: school.enrolmentMode ?? (school.enrolmentOpen ? "shared_code" : "individual_codes"),
    ...(administratorSetup
      ? {
          administratorSetup: {
            email: administratorSetup.email,
            status: administratorActive
              ? "active"
              : administratorInvitation && administratorInvitation.expiresAt > Date.now()
                ? "invited"
                : "expired",
            ...(administratorInvitation
              ? {
                  invitationCode: administratorInvitation.invitationCode,
                  expiresAt: administratorInvitation.expiresAt,
                }
              : {}),
          },
        }
      : {}),
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
  const billingEnvironment = String(process.env.QUIKS_SCHOOL_BILLING_ENVIRONMENT ?? "production").trim().toUpperCase();
  return {
    configured: Boolean(configuredStorePath),
    persistentPathExpected: storePath.startsWith("/var/data/"),
    persistentMountDetected: persistentMountDetected(),
    backupEnabled: true,
    atomicWrites: true,
    ownerConfigured:
      ownerValues("QUIKS_OWNER_PRINCIPAL_IDS").size > 0 ||
      ownerValues("QUIKS_OWNER_UIDS").size > 0 ||
      ownerValues("QUIKS_OWNER_EMAILS").size > 0,
    billing: {
      environment: billingEnvironment,
      fixedTermDays: 120,
      sessionCalendarYears: 1,
      paddleVerificationConfigured: Boolean(
        billingEnvironment === "SANDBOX" ? process.env.PADDLE_SANDBOX_API_KEY : process.env.PADDLE_API_KEY
      ),
      revenueCatWebhookAuthorizationConfigured: Boolean(String(process.env.REVENUECAT_SCHOOL_WEBHOOK_AUTH ?? "").trim()),
      revenueCatWebhookSigningConfigured: Boolean(String(process.env.REVENUECAT_SCHOOL_WEBHOOK_SIGNING_SECRET ?? "").trim()),
    },
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
    enrolmentMode: school.enrolmentMode ?? (school.enrolmentOpen ? "shared_code" : "individual_codes"),
    ...(invitation ? { invitationCode: invitation.invitationCode, invitationRole: invitation.role } : {}),
  };
}

export async function createPendingSchoolPurchase(payload) {
  const details = validateSchoolPurchaseInput(payload);
  return mutateStore(async (store) => {
    const now = Date.now();
    for (const [reference, purchase] of Object.entries(store.pendingSchoolPurchases)) {
      if (purchase.status === "pending_payment" && purchase.createdAt <= now - 90 * 24 * 60 * 60 * 1000) {
        delete store.pendingSchoolPurchases[reference];
      }
    }
    const purchaseReference = `school_${randomUUID()}`;
    const statusToken = `${randomUUID()}${randomUUID()}`.replaceAll("-", "");
    store.pendingSchoolPurchases[purchaseReference] = {
      purchaseReference,
      statusTokenHash: hashPurchaseStatusToken(statusToken),
      status: "pending_payment",
      schoolName: details.schoolName,
      administratorName: details.administratorName,
      administratorEmail: details.administratorEmail,
      enrolmentMode: details.enrolmentMode,
      packageId: details.packageId,
      packageName: details.catalogueEntry.packageName,
      period: details.period,
      learnerCount: details.learnerCount,
      expectedPriceId: details.catalogueEntry.priceId,
      createdAt: now,
      expiresAt: now + PENDING_PURCHASE_LIFETIME_MS,
    };
    return {
      purchaseReference,
      statusToken,
      priceId: details.catalogueEntry.priceId,
      expiresAt: now + PENDING_PURCHASE_LIFETIME_MS,
    };
  });
}

export async function getSchoolPurchaseStatus(purchaseReference, statusToken) {
  const store = await ensureStore();
  const pending = store.pendingSchoolPurchases[String(purchaseReference ?? "").trim()];
  if (!pending || pending.statusTokenHash !== hashPurchaseStatusToken(statusToken)) {
    throw Object.assign(new Error("Purchase status was not found."), { statusCode: 404 });
  }
  const status = pending.status === "pending_payment" && pending.expiresAt <= Date.now() ? "expired" : pending.status;
  return {
    purchaseReference: pending.purchaseReference,
    status,
    packageName: pending.packageName,
    period: pending.period,
    ...(pending.schoolId ? { schoolId: pending.schoolId } : {}),
    ...(pending.licenceStartAt ? { licenceStartAt: pending.licenceStartAt, licenceEndAt: pending.licenceEndAt } : {}),
    ...(pending.failureReason ? { failureReason: pending.failureReason } : {}),
  };
}

function createBillingSchool(store, pending, purchasedAt) {
  const schoolId = randomUUID();
  const schoolCode = generateCode(new Set(Object.values(store.schools).map((school) => school.schoolCode)), 7);
  const invitationCode = generateCode(new Set(Object.keys(store.invitations)), 10);
  const invitationExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const school = {
    id: schoolId,
    schoolCode,
    name: pending.schoolName,
    enrolmentOpen: pending.enrolmentMode === "shared_code",
    enrolmentMode: pending.enrolmentMode,
    profileFields: cloneValue(defaultProfileFields),
    licence: {
      plan: pending.period,
      packageId: pending.packageId,
      packageName: pending.packageName,
      status: "active",
      startAt: purchasedAt,
      endAt: purchasedAt,
      studentSeatLimit: pending.learnerCount,
      teacherSeatLimit: pending.learnerCount,
      allowedVariants: ["children", "teens", "uni"],
      gracePeriodDays: 0,
      features: { ...defaultFeatures },
      billingSource: "revenuecat_paddle",
    },
    billingBaselineAt: purchasedAt,
    createdAt: Date.now(),
    createdByPrincipalId: "billing:revenuecat",
    administratorSetup: {
      name: pending.administratorName,
      email: pending.administratorEmail,
      invitationCode,
    },
  };
  store.schools[schoolId] = school;
  store.invitations[invitationCode] = {
    invitationCode,
    schoolId,
    email: pending.administratorEmail,
    role: "school_admin",
    createdAt: Date.now(),
    expiresAt: invitationExpiresAt,
    createdByPrincipalId: "billing:revenuecat",
  };
  return {
    school,
    administratorInvitation: {
      email: pending.administratorEmail,
      invitationCode,
      expiresAt: invitationExpiresAt,
    },
  };
}

function recalculateSchoolBillingLicence(store, school) {
  const purchases = Object.values(store.schoolBillingPurchases)
    .filter((purchase) => purchase.schoolId === school.id && purchase.status === "active")
    .sort((left, right) => left.purchasedAt - right.purchasedAt || left.createdAt - right.createdAt);
  let cursor = Number(school.billingBaselineAt);
  if (!Number.isFinite(cursor)) cursor = purchases[0]?.purchasedAt ?? Date.now();
  for (const purchase of purchases) {
    purchase.licenceStartAt = Math.max(cursor, purchase.purchasedAt);
    purchase.licenceEndAt = addSchoolLicencePeriod(purchase.licenceStartAt, purchase.period);
    cursor = purchase.licenceEndAt;
  }
  const latest = purchases.at(-1);
  school.licence.endAt = cursor;
  if (latest) {
    school.licence.plan = latest.period;
    school.licence.packageId = latest.packageId;
    school.licence.packageName = latest.packageName;
    school.licence.studentSeatLimit = latest.learnerCount;
    school.licence.teacherSeatLimit = Math.max(school.licence.teacherSeatLimit || 1, latest.learnerCount);
    school.licence.billingSource = "revenuecat_paddle";
  }
  if (school.licence.status !== "suspended") school.licence.status = cursor > Date.now() ? "active" : "expired";
  return latest;
}

export async function activateSchoolPurchase(payload) {
  const eventId = String(payload.eventId ?? "").trim();
  const transactionId = String(payload.transactionId ?? "").trim();
  const purchaseReference = String(payload.purchaseReference ?? "").trim();
  const priceId = String(payload.priceId ?? "").trim();
  const purchasedAt = Number(payload.purchasedAt);
  const quantity = Number(payload.quantity);
  if (!eventId || !transactionId || !purchaseReference || !configuredSchoolPriceCatalogue()[priceId] || !Number.isFinite(purchasedAt)) {
    throw Object.assign(new Error("The verified school purchase is incomplete."), { statusCode: 400 });
  }
  return mutateStore(async (store) => {
    const processed = store.schoolBillingWebhookEvents[eventId];
    if (processed) return { ...processed.result, idempotent: true };
    const pending = store.pendingSchoolPurchases[purchaseReference];
    if (!pending) throw Object.assign(new Error("The pending school purchase was not found."), { statusCode: 404 });
    if ((purchasedAt < pending.createdAt - 5 * 60 * 1000 || purchasedAt > pending.expiresAt) && pending.status === "pending_payment") {
      throw Object.assign(new Error("The pending school purchase has expired."), { statusCode: 409 });
    }
    if (pending.expectedPriceId !== priceId) throw Object.assign(new Error("The purchased price does not match the pending school package."), { statusCode: 409 });
    const expectedQuantity = pending.packageId === "per-learner" ? pending.learnerCount : 1;
    if (!Number.isInteger(quantity) || quantity !== expectedQuantity) {
      throw Object.assign(new Error("The verified purchase quantity does not match the learner allocation."), { statusCode: 409 });
    }
    const duplicateTransaction = Object.values(store.schoolBillingPurchases).find((purchase) => purchase.transactionId === transactionId);
    if (duplicateTransaction) {
      if (duplicateTransaction.purchaseReference !== purchaseReference) throw Object.assign(new Error("This payment is already linked to another school purchase."), { statusCode: 409 });
      const duplicateResult = { school: buildSchoolSummary(store, store.schools[duplicateTransaction.schoolId]), administratorInvitation: null, purchase: duplicateTransaction };
      store.schoolBillingWebhookEvents[eventId] = { eventId, type: "NON_RENEWING_PURCHASE", processedAt: Date.now(), result: duplicateResult };
      return { ...duplicateResult, idempotent: true };
    }

    let school = findRenewalSchool(store, pending);
    let administratorInvitation = null;
    if (!school) {
      const created = createBillingSchool(store, pending, purchasedAt);
      school = created.school;
      administratorInvitation = created.administratorInvitation;
    } else if (!Number.isFinite(Number(school.billingBaselineAt))) {
      school.billingBaselineAt = Math.max(Number(school.licence.endAt) || purchasedAt, purchasedAt);
    }

    const purchaseId = randomUUID();
    const purchase = {
      purchaseId,
      eventId,
      transactionId,
      purchaseReference,
      schoolId: school.id,
      priceId,
      packageId: pending.packageId,
      packageName: pending.packageName,
      period: pending.period,
      learnerCount: pending.learnerCount,
      quantity,
      environment: String(payload.environment ?? "").toUpperCase(),
      purchasedAt,
      status: "active",
      createdAt: Date.now(),
    };
    store.schoolBillingPurchases[purchaseId] = purchase;
    recalculateSchoolBillingLicence(store, school);
    pending.status = "active";
    pending.schoolId = school.id;
    pending.transactionId = transactionId;
    pending.activatedAt = Date.now();
    pending.licenceStartAt = purchase.licenceStartAt;
    pending.licenceEndAt = purchase.licenceEndAt;
    recordAudit(store, { principalId: "billing:revenuecat", email: pending.administratorEmail }, "school.licence.purchased", school.id, {
      purchaseId,
      transactionId,
      packageId: purchase.packageId,
      period: purchase.period,
      learnerCount: purchase.learnerCount,
      licenceEndAt: purchase.licenceEndAt,
    });
    const result = { school: buildSchoolSummary(store, school), administratorInvitation, purchase: { ...purchase } };
    store.schoolBillingWebhookEvents[eventId] = { eventId, type: "NON_RENEWING_PURCHASE", processedAt: Date.now(), result };
    return result;
  });
}

export async function refundSchoolPurchase(payload) {
  const eventId = String(payload.eventId ?? "").trim();
  const transactionId = String(payload.transactionId ?? "").trim();
  if (!eventId || !transactionId) throw Object.assign(new Error("The school refund event is incomplete."), { statusCode: 400 });
  return mutateStore(async (store) => {
    const processed = store.schoolBillingWebhookEvents[eventId];
    if (processed) return { ...processed.result, idempotent: true };
    const purchase = Object.values(store.schoolBillingPurchases).find((entry) => entry.transactionId === transactionId);
    if (!purchase) {
      const result = { ignored: true, reason: "purchase_not_managed_by_quiks_school" };
      store.schoolBillingWebhookEvents[eventId] = { eventId, type: "CANCELLATION", processedAt: Date.now(), result };
      return result;
    }
    purchase.status = "refunded";
    purchase.refundedAt = Number(payload.eventTimestamp) || Date.now();
    purchase.refundReason = String(payload.reason ?? "refund").slice(0, 120);
    const school = store.schools[purchase.schoolId];
    if (school) recalculateSchoolBillingLicence(store, school);
    const pending = store.pendingSchoolPurchases[purchase.purchaseReference];
    if (pending) pending.status = "refunded";
    recordAudit(store, { principalId: "billing:revenuecat", email: "" }, "school.licence.refunded", purchase.schoolId, {
      purchaseId: purchase.purchaseId,
      transactionId,
      licenceEndAt: school?.licence.endAt,
    });
    const result = { refunded: true, school: school ? buildSchoolSummary(store, school) : null, purchase: { ...purchase } };
    store.schoolBillingWebhookEvents[eventId] = { eventId, type: "CANCELLATION", processedAt: Date.now(), result };
    return result;
  });
}

export async function recordIgnoredSchoolBillingWebhook(eventId, type, reason) {
  return mutateStore(async (store) => {
    if (store.schoolBillingWebhookEvents[eventId]) return { ...store.schoolBillingWebhookEvents[eventId].result, idempotent: true };
    const result = { ignored: true, reason };
    store.schoolBillingWebhookEvents[eventId] = { eventId, type, processedAt: Date.now(), result };
    return result;
  });
}

export async function createSchool(principal, payload) {
  requireOwner(principal);
  return mutateStore(async (store) => {
    const name = String(payload.name ?? "").trim().slice(0, 120);
    const administratorEmail = String(payload.administratorEmail ?? "").trim().toLowerCase();
    const enrolmentMode = payload.enrolmentMode === "individual_codes" ? "individual_codes" : "shared_code";
    const startAt = Number(payload.startAt);
    const endAt = Number(payload.endAt);
    if (!name || !administratorEmail.includes("@") || !Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
      throw new Error("School name, administrator email, and a valid licence period are required.");
    }
    const schoolId = randomUUID();
    const schoolCode = generateCode(new Set(Object.values(store.schools).map((school) => school.schoolCode)), 7);
    const createdAt = Date.now();
    const invitationCode = generateCode(new Set(Object.keys(store.invitations)), 10);
    const invitationExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const school = {
      id: schoolId,
      schoolCode,
      name,
      enrolmentOpen: enrolmentMode === "shared_code",
      enrolmentMode,
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
      administratorSetup: {
        email: administratorEmail,
        invitationCode,
      },
    };
    store.schools[schoolId] = school;
    store.invitations[invitationCode] = {
      invitationCode,
      schoolId,
      email: administratorEmail,
      role: "school_admin",
      createdAt,
      expiresAt: invitationExpiresAt,
      createdByPrincipalId: principal.principalId,
    };
    recordAudit(store, principal, "school.created", schoolId, { name, schoolCode, administratorEmail });
    return {
      school: buildSchoolSummary(store, school),
      administratorInvitation: {
        email: administratorEmail,
        invitationCode,
        expiresAt: invitationExpiresAt,
      },
    };
  });
}

export async function createIndividualLicence(principal, payload) {
  requireOwner(principal);
  return mutateStore(async (store) => {
    const email = String(payload.email ?? "").trim().toLowerCase();
    const startAt = Number(payload.startAt);
    const endAt = Number(payload.endAt);
    if (!email.includes("@") || !Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
      throw new Error("A valid email and licence period are required.");
    }
    const existing = Object.values(store.individualLicences).find((entry) => entry.email === email);
    const licence = existing ?? {
      licenceId: randomUUID(),
      email,
      createdAt: Date.now(),
      createdByPrincipalId: principal.principalId,
    };
    Object.assign(licence, { email, startAt, endAt, status: "active" });
    store.individualLicences[licence.licenceId] = licence;
    recordAudit(store, principal, existing ? "individual_licence.updated" : "individual_licence.created", null, {
      licenceId: licence.licenceId,
      email,
      startAt,
      endAt,
    });
    return buildIndividualLicence(licence);
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
  const individualLicences = Object.values(store.individualLicences).map(buildIndividualLicence);
  const billingPurchases = Object.values(store.schoolBillingPurchases).sort((left, right) => right.purchasedAt - left.purchasedAt);
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
      individualLicences: individualLicences.length,
      activeIndividualLicences: individualLicences.filter((licence) => licence.status === "active").length,
      schoolBillingPurchases: billingPurchases.length,
    },
    schools: schools.sort((left, right) => left.name.localeCompare(right.name)),
    individualLicences: individualLicences.sort((left, right) => left.email.localeCompare(right.email)),
    billingPurchases: billingPurchases.map((purchase) => ({ ...purchase })),
  };
}

export async function listPrincipalMemberships(principal) {
  const store = await ensureStore();
  return Object.values(store.memberships)
    .filter((membership) => membershipMatchesPrincipal(membership, principal))
    .map((membership) => buildMembership(store, membership))
    .sort((left, right) => left.schoolName.localeCompare(right.schoolName));
}

export async function getPrincipalSchoolIdentity(principal) {
  const store = await ensureStore();
  const administratorMemberships = Object.values(store.memberships)
    .filter(
      (membership) =>
        membershipMatchesPrincipal(membership, principal) &&
        membership.role === "school_admin" &&
        membership.status === "active"
    )
    .map((membership) => buildMembership(store, membership));

  return {
    viewer: {
      displayName: principal.name || principal.email || "Quiks user",
      email: principal.email,
    },
    isAppOwner: isOwner(principal),
    administratorMemberships,
    memberships: Object.values(store.memberships)
      .filter((membership) => membershipMatchesPrincipal(membership, principal))
      .map((membership) => buildMembership(store, membership)),
  };
}

export async function getSchoolDetails(principal, schoolId) {
  const store = await ensureStore();
  requireSchoolAdmin(store, schoolId, principal);
  const school = store.schools[schoolId];
  if (!school) throw new Error("School not found.");
  return {
    viewer: {
      displayName: principal.name || principal.email || "Quiks user",
      email: principal.email,
      role: isOwner(principal) ? "app_owner" : "school_admin",
    },
    school: buildSchoolSummary(store, school),
    profileFields: cloneValue(school.profileFields),
    memberships: membershipsForSchool(store, schoolId)
      .map((membership) => buildMembership(store, membership))
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    billingHistory: Object.values(store.schoolBillingPurchases)
      .filter((purchase) => purchase.schoolId === schoolId)
      .sort((left, right) => right.purchasedAt - left.purchasedAt)
      .map((purchase) => ({ ...purchase })),
  };
}

export async function getSchoolReportingContext(principal, schoolId) {
  const store = await ensureStore();
  requireSchoolAdmin(store, schoolId, principal);
  const school = store.schools[schoolId];
  if (!school) throw Object.assign(new Error("School not found."), { statusCode: 404 });
  if (getEffectiveLicenceStatus(school.licence) !== "active" || !school.licence.features?.reports) {
    throw Object.assign(new Error("An active school licence with Reports enabled is required."), { statusCode: 403 });
  }
  return { principal, school: cloneValue(school), memberships: cloneValue(membershipsForSchool(store, schoolId)) };
}

export async function getSchoolClassroomContext(principal, schoolId) {
  const store = await ensureStore();
  requireSchoolAdmin(store, schoolId, principal);
  const school = store.schools[schoolId];
  if (!school || getEffectiveLicenceStatus(school.licence) !== "active" || !school.licence.features?.classroom) {
    throw Object.assign(new Error("An active school licence with Classroom enabled is required."), { statusCode: 403 });
  }
  return { principal, school: cloneValue(school), memberships: cloneValue(membershipsForSchool(store, schoolId)) };
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
    return { invitationCode, expiresAt, email: normalizedEmail, role, schoolName: school.name };
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
    } else if (!school.enrolmentOpen || school.enrolmentMode === "individual_codes") {
      throw new Error("This school requires a unique individual invitation code.");
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

export async function getOwnerIssuedIndividualEntitlement(principal) {
  const store = await ensureStore();
  const email = String(principal.email ?? "").trim().toLowerCase();
  if (!email) return null;
  const matches = Object.values(store.individualLicences)
    .filter((licence) => licence.email === email)
    .map(buildIndividualLicence)
    .sort((left, right) => right.endAt - left.endAt);
  const licence = matches.find((entry) => entry.status === "active") ?? matches[0];
  if (!licence) return null;
  return {
    licenceId: licence.licenceId,
    active: licence.status === "active",
    expiresAt: new Date(licence.endAt).toISOString(),
    status: licence.status,
  };
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

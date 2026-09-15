import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "quiks-school-owner-management-"));
process.env.SCHOOL_STORE_PATH = join(directory, "school.json");
process.env.QUIKS_OWNER_PRINCIPAL_IDS = "test:owner";
process.env.QUIKS_OWNER_EMAILS = "";
process.env.QUIKS_OWNER_UIDS = "";

const now = Date.now();
const school = {
  id: "school-1", schoolCode: "SCHOOL1", name: "Original School", enrolmentOpen: true, enrolmentMode: "shared_code",
  profileFields: [], createdAt: now - 1000,
  licence: { plan: "term", status: "active", startAt: now - 1000, endAt: now + 10000, studentSeatLimit: 10, teacherSeatLimit: 2, allowedVariants: ["children"], gracePeriodDays: 0, features: { ai: true, classroom: true, cbt: true, lessonNotes: true, reports: true, integrations: false } },
};
const adminMembership = { membershipId: "admin", schoolId: school.id, principalId: "test:admin", email: "admin@example.com", displayName: "Admin", role: "school_admin", status: "active", profileData: {}, createdAt: now };
await writeFile(process.env.SCHOOL_STORE_PATH, JSON.stringify({ schools: { [school.id]: school }, memberships: { admin: adminMembership }, invitations: {} }));

const store = await import("./school-store.mjs");
const owner = { principalId: "test:owner", uid: "owner", email: "owner@example.com", emailVerified: true };
const admin = { principalId: "test:admin", uid: "admin", email: "admin@example.com", emailVerified: true };
const individual = { principalId: "test:individual", uid: "individual", projectId: "test", email: "person@example.com", emailVerified: true, name: "Person" };
const licensedIndividual = { principalId: "test:licensed", uid: "licensed", projectId: "test", email: "licensed@example.com", emailVerified: true, name: "Licensed" };

test("owner edits the school identity and renews its dates", async () => {
  const endAt = now + 30 * 86400000;
  const updated = await store.updateSchoolRecord(owner, school.id, { name: "Renewed School", licence: { startAt: now, endAt, status: "suspended" } });
  assert.equal(updated.name, "Renewed School");
  assert.equal(updated.licence.endAt, endAt);
  assert.equal(updated.status, "active", "untrusted patch cannot change licence status");
});

test("school administrator configures a preset class naming system", async () => {
  const updated = await store.updateSchoolClassNaming(admin, school.id, { mode: "primary_secondary" });
  assert.equal(updated.classNaming.mode, "primary_secondary");
  assert.ok(updated.classNaming.names.includes("Primary 1"));
  assert.ok(updated.classNaming.names.includes("SS 3"));
  const [membership] = await store.listPrincipalMemberships(admin);
  assert.deepEqual(membership.schoolClassNaming, updated.classNaming);
});

test("school curriculum is stored centrally and propagated through verified membership", async () => {
  const updated = await store.updateSchoolCurriculum(admin, school.id, ["Nigerian National Curriculum", "British National Curriculum"]);
  assert.deepEqual(updated.curricula, ["Nigerian National Curriculum", "British National Curriculum"]);
  assert.equal(updated.curriculum, "Nigerian National Curriculum + British National Curriculum");
  const [membership] = await store.listPrincipalMemberships(admin);
  assert.equal(membership.schoolCurriculum, "Nigerian National Curriculum + British National Curriculum");
});

test("delete is a verified archive: access is revoked while records remain restorable", async () => {
  await assert.rejects(store.archiveSchool(owner, school.id, "Wrong School"), /exactly/);
  const archived = await store.archiveSchool(owner, school.id, "Renewed School");
  assert.equal(archived.recordsPreserved, true);
  await assert.rejects(store.getSchoolDetails(admin, school.id), /suspended/);
  let dashboard = await store.getOwnerDashboard(owner);
  assert.equal(dashboard.schools.length, 0);
  assert.equal(dashboard.archivedSchools[0].name, "Renewed School");
  const restored = await store.restoreSchool(owner, school.id);
  assert.equal(restored.name, "Renewed School");
  dashboard = await store.getOwnerDashboard(owner);
  assert.equal(dashboard.schools.length, 1);
});

test("owner dashboard lists only independent sign-ups and merges their app variants", async () => {
  await store.getPrincipalSchoolIdentity(individual, "children");
  await store.getPrincipalSchoolIdentity(individual, "teens");
  await store.getPrincipalSchoolIdentity(admin, "children");
  await store.getPrincipalSchoolIdentity(owner, "children");
  await store.getPrincipalSchoolIdentity(licensedIndividual, "uni");
  await store.createIndividualLicence(owner, { email: licensedIndividual.email, startAt: now, endAt: now + 86400000 });
  const dashboard = await store.getOwnerDashboard(owner);
  assert.deepEqual(dashboard.individualSignups.map((account) => account.email), ["person@example.com"]);
  assert.deepEqual(dashboard.individualSignups[0].appVariants, ["children", "teens"]);
});

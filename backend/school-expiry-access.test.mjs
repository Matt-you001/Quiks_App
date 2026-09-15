import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "quiks-school-expiry-"));
process.env.SCHOOL_STORE_PATH = join(directory, "school.json");
process.env.QUIKS_OWNER_PRINCIPAL_IDS = "test:owner";
process.env.QUIKS_OWNER_EMAILS = "";
process.env.QUIKS_OWNER_UIDS = "";

const now = Date.now();
const licence = {
  plan: "term",
  status: "active",
  startAt: now - 10_000,
  endAt: now - 1,
  studentSeatLimit: 20,
  teacherSeatLimit: 5,
  allowedVariants: ["children", "teens", "uni"],
  gracePeriodDays: 0,
  features: { ai: true, classroom: true, cbt: true, lessonNotes: true, reports: true, integrations: false },
};
const school = {
  id: "expired-school",
  schoolCode: "EXPIRED",
  name: "Expired School",
  enrolmentOpen: true,
  enrolmentMode: "shared_code",
  profileFields: [],
  licence,
  createdAt: now - 20_000,
};
const adminMembership = {
  membershipId: "admin-membership",
  schoolId: school.id,
  principalId: "test:admin",
  email: "admin@example.com",
  displayName: "School Admin",
  role: "school_admin",
  status: "active",
  profileData: {},
  createdAt: now - 10_000,
};
await writeFile(process.env.SCHOOL_STORE_PATH, JSON.stringify({
  schools: { [school.id]: school },
  memberships: { [adminMembership.membershipId]: adminMembership },
  invitations: {},
}));

const store = await import("./school-store.mjs");
const admin = { principalId: "test:admin", uid: "admin", email: "admin@example.com", emailVerified: true, name: "School Admin" };
const owner = { principalId: "test:owner", uid: "owner", email: "owner@example.com", emailVerified: true, name: "Owner" };
const learner = { principalId: "test:learner", uid: "learner", email: "learner@example.com", emailVerified: true, name: "Learner" };

test("expired licence is exposed on membership lists and closes public enrolment", async () => {
  const [membership] = await store.listPrincipalMemberships(admin);
  assert.equal(membership.schoolLicenceStatus, "expired");
  assert.equal(membership.schoolLicenceExpiresAt, licence.endAt);
  const publicDetails = await store.getSchoolPublicDetails(school.schoolCode);
  assert.equal(publicDetails.status, "expired");
  assert.equal(publicDetails.enrolmentOpen, false);
});

test("school administrator cannot enter an expired school portal", async () => {
  await assert.rejects(store.getSchoolDetails(admin, school.id), /licence expired/i);
});

test("app owner keeps inspection access but cannot operate an expired school", async () => {
  const details = await store.getSchoolDetails(owner, school.id);
  assert.equal(details.viewer.role, "app_owner");
  assert.equal(details.school.status, "expired");
  await assert.rejects(store.inviteSchoolMember(owner, school.id, "new@example.com", "student"), /licence expired/i);
  await assert.rejects(store.updateSchoolProfileFields(owner, school.id, []), /licence expired/i);
});

test("expired school cannot generate codes, approve members or accept enrolment", async () => {
  await assert.rejects(store.inviteSchoolMember(admin, school.id, "new@example.com", "student"), /licence expired/i);
  await assert.rejects(store.updateMembershipStatus(admin, school.id, adminMembership.membershipId, "suspended"), /licence expired/i);
  await assert.rejects(store.enrolInSchool(learner, { schoolCode: school.schoolCode, role: "student", appVariant: "children", profileData: {} }), /licence expired/i);
});

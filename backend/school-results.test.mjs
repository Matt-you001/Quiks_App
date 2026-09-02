import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "quiks-results-test-"));
process.env.CLASSROOM_STORE_PATH = join(directory, "classroom.json");
process.env.SCHOOL_STORE_PATH = join(directory, "school.json");
process.env.QUIKS_OWNER_EMAILS = ""; process.env.QUIKS_OWNER_UIDS = ""; process.env.QUIKS_OWNER_PRINCIPAL_IDS = "owner:1";
const admin = { principalId: "project:admin", uid: "admin", name: "Administrator", email: "", emailVerified: true };
const teacher = { id: "school-teens-teacher", name: "Teacher", role: "teacher", quiksId: "QX-TEACHER", schoolId: "s1", schoolMembershipId: "teacher" };
const student = { id: "school-teens-student", name: "Student", role: "student", quiksId: "QX-STUDENT", schoolId: "s1", schoolMembershipId: "student" };
const licence = { status: "active", startAt: Date.now() - 10000, endAt: Date.now() + 86400000, features: { reports: true } };
await writeFile(process.env.SCHOOL_STORE_PATH, JSON.stringify({ schools: { s1: { id: "s1", name: "Test School", licence }, s2: { id: "s2", name: "Other School", licence } }, memberships: {
  admin: { membershipId: "admin", schoolId: "s1", principalId: admin.principalId, role: "school_admin", status: "active" },
  student: { membershipId: "student", schoolId: "s1", principalId: "project:student", role: "student", status: "active", email: "student@example.com", displayName: "=Student" },
  otherAdmin: { membershipId: "otherAdmin", schoolId: "s2", principalId: "project:otherAdmin", role: "school_admin", status: "active" },
} }));
const store = await import("./classroom-store.mjs");
const { getSchoolReportingContext } = await import("./school-store.mjs");
const { schoolResultsRequest } = await import("./school-results-api.mjs");
const { captureSchoolResult } = await import("./school-results.mjs");
const request = (action, payload = {}, dependencies) => schoolResultsRequest(admin, action, { schoolId: "s1", ...payload }, dependencies);
let classroom, activity, report;

test("classroom submissions populate the central register automatically and once", async () => {
  classroom = await store.createClassroom(teacher, "Year 8", "teens");
  await store.acceptClassInviteLink(student, classroom.classCode, "teens");
  activity = await store.createClassroomActivity({ teacherProfile: teacher, classId: classroom.classId, type: "assignment", title: "Fractions", subject: { id: "math", name: "Mathematics" }, questions: [], questionCount: 10, attemptsAllowed: 2 }, "teens");
  await store.submitActivity(student, activity.activityId, { score: 60, correctAnswers: 6, totalQuestions: 10, timeTakenSeconds: 45 }, "teens");
  await store.submitActivity(student, activity.activityId, { score: 80, correctAnswers: 8, totalQuestions: 10, timeTakenSeconds: 30 }, "teens");
  const latest = await request("list"); assert.equal(latest.total, 1); assert.equal(latest.rows[0].score, 80);
  assert.equal((await request("list", { filters: { attempts: "all" } })).total, 2);
  assert.equal((await request("list", { filters: { subject: "English" } })).total, 0);
  const persisted = JSON.parse(await readFile(process.env.CLASSROOM_STORE_PATH, "utf8"));
  assert.equal(Object.keys(persisted.schoolResults).length, 2);
  assert.equal(latest.rows[0].scoreSource, "client_reported");
});

test("student, teacher and another school's admin cannot access the register", async () => {
  for (const principalId of ["project:student", "project:teacher", "project:otherAdmin"]) {
    await assert.rejects(schoolResultsRequest({ ...admin, principalId }, "list", { schoolId: "s1" }), /school administrator/);
  }
  const other = await schoolResultsRequest({ ...admin, principalId: "project:otherAdmin" }, "list", { schoolId: "s2" });
  assert.equal(other.total, 0);
});

test("report snapshot has latest attempts, immutable source marks, audited corrections", async () => {
  report = (await request("create", { studentMembershipId: "student", title: "First term", filters: { attempts: "all" } })).report;
  assert.equal(report.rows.length, 1); assert.equal(report.average, 80);
  await assert.rejects(request("update", { reportId: report.reportId, revision: report.revision, adjustments: [{ resultId: report.rows[0].resultId, score: 85, reason: "" }] }), /reason/);
  report = (await request("update", { reportId: report.reportId, revision: report.revision, comment: "Good progress", adjustments: [{ resultId: report.rows[0].resultId, score: 85, reason: "Teacher verified correction" }] })).report;
  assert.equal(report.average, 85); assert.equal(report.rows[0].score, 80);
  assert.equal((await request("list")).rows[0].score, 80);
  assert.equal(report.audit.at(-1).action, "edited");
  await assert.rejects(request("approve", { reportId: report.reportId, revision: 1, reviewed: true }), /changed/);
});

test("results survive deleting the source activity and its classroom", async () => {
  await store.deleteClassroomActivity(teacher, activity.activityId, "teens");
  await store.deleteClassroom(teacher, classroom.classId, "teens");
  assert.equal((await request("list", { filters: { attempts: "all" } })).total, 2);
  assert.equal((await request("reports")).reports[0].rows.length, 1);
});

test("approval and explicit confirmation precede email; duplicate send is blocked", async () => {
  let sendCount = 0;
  const dependencies = { send: async (sent) => { sendCount++; assert.equal(sent.email, "student@example.com"); assert.equal(sent.rows.length, 1); return { status: "sent", messageId: "mock-provider-id" }; } };
  await assert.rejects(request("send", { reportId: report.reportId, revision: report.revision, confirm: true }, dependencies), /Approve/);
  report = (await request("approve", { reportId: report.reportId, revision: report.revision, reviewed: true })).report;
  await assert.rejects(request("send", { reportId: report.reportId, revision: report.revision, confirm: false }, dependencies), /confirm/);
  const outcomes = await Promise.allSettled([1, 2].map(() => request("send", { reportId: report.reportId, revision: report.revision, confirm: true, email: "attacker@example.com" }, dependencies)));
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(sendCount, 1);
  report = (await request("reports")).reports[0]; assert.equal(report.status, "sent");
  await assert.rejects(request("update", { reportId: report.reportId, revision: report.revision, comment: "changed" }), /locked/);
});

test("CSV export protects spreadsheet formulas; other school cannot fetch report", async () => {
  const output = await request("export", { reportId: report.reportId });
  assert.ok(output.csv.includes("'=Student")); assert.ok(output.csv.includes("Teacher verified correction"));
  await assert.rejects(schoolResultsRequest({ ...admin, principalId: "project:otherAdmin" }, "export", { schoolId: "s2", reportId: report.reportId }), /not found/);
});

test("uncertain email result remains locked and persists without blind retry", async () => {
  let draft = (await request("create", { studentMembershipId: "student", title: "Second report" })).report;
  draft = (await request("approve", { reportId: draft.reportId, revision: draft.revision, reviewed: true })).report;
  draft = (await request("send", { reportId: draft.reportId, revision: draft.revision, confirm: true }, { send: async () => ({ status: "unknown" }) })).report;
  assert.equal(draft.status, "delivery_unknown");
  await assert.rejects(request("send", { reportId: draft.reportId, revision: draft.revision, confirm: true }), /Approve/);
  const disk = JSON.parse(await readFile(process.env.CLASSROOM_STORE_PATH, "utf8"));
  assert.equal(disk.schoolReports[draft.reportId].status, "delivery_unknown");
});

test("unlinked personal and cross-school profile data are not imported", () => {
  const raw = { profiles: { p: { schoolId: "wrong", schoolMembershipId: "member" } }, classrooms: { c: { schoolId: "s1" } }, activities: { a: { classId: "c" } } };
  captureSchoolResult(raw, { submissionId: "bad", activityId: "a", profileId: "p", score: 90 });
  assert.deepEqual(raw.schoolResults, {});
});

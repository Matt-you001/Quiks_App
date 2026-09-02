import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = await mkdtemp(join(tmpdir(), "quiks-school-classes-"));
process.env.CLASSROOM_STORE_PATH = join(dir, "classes.json");
process.env.SCHOOL_STORE_PATH = join(dir, "schools.json");
process.env.QUIKS_OWNER_EMAILS = ""; process.env.QUIKS_OWNER_UIDS = ""; process.env.QUIKS_OWNER_PRINCIPAL_IDS = "test:owner";
const variants = ["children", "teens", "uni"];
const licence = { status: "active", startAt: Date.now() - 10000, endAt: Date.now() + 86400000, allowedVariants: variants, features: { classroom: true, reports: true, lessonNotes: true, cbt: true } };
const members = {
  admin: { membershipId: "admin", schoolId: "s", principalId: "p:admin", role: "school_admin", status: "active", displayName: "Admin" },
  teacher: { membershipId: "teacher", schoolId: "s", principalId: "p:teacher", role: "teacher", status: "active", displayName: "Teacher" },
  second: { membershipId: "second", schoolId: "s", principalId: "p:second", role: "teacher", status: "active", displayName: "Second Teacher" },
  student: { membershipId: "student", schoolId: "s", principalId: "p:student", role: "student", status: "active", displayName: "Student" },
  outsider: { membershipId: "outsider", schoolId: "other", principalId: "p:outsider", role: "school_admin", status: "active", displayName: "Other admin" },
};
await writeFile(process.env.SCHOOL_STORE_PATH, JSON.stringify({ schools: { s: { id: "s", name: "School", licence }, other: { id: "other", name: "Other", licence }, expired: { id: "expired", licence: { ...licence, endAt: Date.now() - 1 } }, disabled: { id: "disabled", licence: { ...licence, features: { classroom: false } } } }, memberships: members }));
const { schoolClassroomsRequest } = await import("./school-classrooms-api.mjs");
const { authenticateClassroomRequest, schoolClassroomProfile } = await import("./classroom-auth.mjs");
const store = await import("./classroom-store.mjs");
const principal = m => ({ principalId: m.principalId, uid: m.membershipId, projectId: "p", emailVerified: true });
const adminCall = (action, payload = {}) => schoolClassroomsRequest(principal(members.admin), action, { schoolId: "s", ...payload });
async function auth(action, member, variant, payload = {}) {
  const key = action === "join" ? "studentProfile" : "teacherProfile";
  const body = { appVariant: variant, [key]: schoolClassroomProfile(member, variant), ...payload };
  return authenticateClassroomRequest({ headers: {} }, `/classroom/classes/${action}`, body, { verify: async () => principal(member), membershipsFor: async () => [member], feature: async () => ({}) });
}

for (const variant of variants) test(`${variant}: admin shared code is teacher-bound; roster, activities, notes, chat and results share one class`, async () => {
  const { classroom: c } = await adminCall("create", { className: `${variant} Class`, appVariant: variant, teacherMembershipId: "teacher", codePolicy: "shared" });
  assert.equal(c.classCode, c.teacherAccessCode);
  await assert.rejects(auth("claim", members.second, variant, { classCode: c.teacherAccessCode }), /another teacher/);
  await assert.rejects(auth("claim", members.student, variant, { classCode: c.teacherAccessCode }), /Only teachers/);
  await assert.rejects(auth("join", members.student, variant, { classCode: c.classCode }), /must open/);
  const body = await auth("claim", members.teacher, variant, { classCode: c.teacherAccessCode });
  await Promise.all([1, 2].map(() => store.manageTeacherSchoolClass("claim", body.teacherProfile, body)));
  assert.equal((await store.listClassroomsForProfile(body.teacherProfile, variant)).filter(x => x.classId === c.classId).length, 1);
  const joining = await auth("join", members.student, variant, { classCode: c.classCode });
  await store.requestJoinClass(joining.studentProfile, c.classCode, variant);
  let details = await adminCall("details", { classId: c.classId });
  const request = details.members.find(m => m.role === "student");
  assert.equal(request.status, "pending_teacher_approval");
  await store.respondToMembershipRequest(body.teacherProfile, c.classId, request.membershipId, "approve", variant);
  const activity = await store.createClassroomActivity({ teacherProfile: body.teacherProfile, classId: c.classId, title: "Quiz", type: "assignment", subject: { id: "math", name: "Math" }, questionCount: 1, questions: [{ id: "q", prompt: "1+1?", options: ["2"], answer: "2" }] }, variant);
  await store.createLessonNote({ teacherProfile: body.teacherProfile, classId: c.classId, title: "Numbers", content: "Addition lesson", topic: "Addition", subject: "Math", status: "published" }, variant);
  await store.sendClassChatMessage(joining.studentProfile, c.classId, "Hello class", variant);
  await store.submitActivity(joining.studentProfile, activity.activityId, { score: 100, totalQuestions: 1, correctAnswers: 1, timeTakenSeconds: 12 }, variant);
  details = await adminCall("details", { classId: c.classId });
  assert.equal(details.activities.length, 1); assert.equal(details.notes.length, 1); assert.equal(details.messages[0].text, "Hello class");
  assert.equal(details.submissions.length, 1); assert.equal(details.submissions[0].score, 100);
  assert.equal(details.members.filter(m => m.role === "teacher").length, 1);
  const disk = JSON.parse(await readFile(process.env.CLASSROOM_STORE_PATH, "utf8"));
  assert.ok(Object.values(disk.schoolResults).some(r => r.classId === c.classId));
});

test("separate codes: teacher creates one stable student code; teacher code cannot admit students", async () => {
  const { classroom: c } = await adminCall("create", { className: "Separate", appVariant: "teens", teacherMembershipId: "teacher", codePolicy: "teacher_generated" });
  assert.equal(c.classCode, null);
  const body = await auth("claim", members.teacher, "teens", { classCode: c.teacherAccessCode });
  await store.manageTeacherSchoolClass("claim", body.teacherProfile, body);
  await assert.rejects(auth("join", members.student, "teens", { classCode: c.teacherAccessCode }), /not found/);
  const gen = await auth("student-code", members.teacher, "teens", { classId: c.classId });
  const first = await store.manageTeacherSchoolClass("student-code", gen.teacherProfile, gen);
  const again = await store.manageTeacherSchoolClass("student-code", gen.teacherProfile, gen);
  assert.notEqual(first.classroom.classCode, c.teacherAccessCode); assert.equal(first.classroom.classCode, again.classroom.classCode);
  await auth("join", members.student, "teens", { classCode: first.classroom.classCode });
  await assert.rejects(auth("student-code", members.second, "teens", { classId: c.classId }), /class teacher/);
});

test("teacher-created school class registers idempotently; personal and other-school classes cannot be captured by code", async () => {
  const body = await auth("create", members.teacher, "teens");
  const c = await store.createClassroom(body.teacherProfile, "Teacher created", "teens");
  assert.ok((await adminCall("list")).classes.some(x => x.classId === c.classId));
  await adminCall("link", { classCode: c.classCode.toLowerCase() });
  await adminCall("link", { classCode: c.classCode });
  assert.equal((await adminCall("details", { classId: c.classId })).audit.length, 1);
  const personal = await store.createClassroom({ id: "personal", role: "teacher", name: "Private", quiksId: "PRIVATE" }, "Private", "teens");
  await assert.rejects(adminCall("link", { classCode: personal.classCode }), /school-linked profile/);
  await assert.rejects(schoolClassroomsRequest(principal(members.outsider), "link", { schoolId: "other", classCode: c.classCode }), /not found/);
  await assert.rejects(schoolClassroomsRequest(principal(members.outsider), "details", { schoolId: "other", classId: c.classId }), /not found/);
});

test("admin operations enforce roles, licence, variant and teacher membership", async () => {
  for (const m of [members.teacher, members.student, members.outsider]) await assert.rejects(schoolClassroomsRequest(principal(m), "list", { schoolId: "s" }), /school administrator/);
  for (const schoolId of ["expired", "disabled"]) await assert.rejects(schoolClassroomsRequest({ principalId: "test:owner" }, "list", { schoolId }), /active school licence/);
  for (const patch of [{ appVariant: "invalid" }, { teacherMembershipId: "student" }, { teacherMembershipId: "outsider" }, { className: "" }, { codePolicy: "other" }]) await assert.rejects(adminCall("create", { className: "Bad", appVariant: "teens", teacherMembershipId: "teacher", codePolicy: "shared", ...patch }));
  await assert.rejects(adminCall("delete", {}), /not found/);
});

test("school classes and codes survive store reload", async () => {
  const before = (await adminCall("list")).classes;
  const reloaded = await import(`./classroom-store.mjs?reload=${Date.now()}`);
  const after = await reloaded.schoolClassroomsOperation("list", { school: { id: "s" } }, {});
  assert.deepEqual(after.classes, before);
});

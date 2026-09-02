import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const directory = await mkdtemp(join(tmpdir(), "quiks-identity-test-"));
process.env.CLASSROOM_STORE_PATH = join(directory, "classroom.json");
const auth = await import("./classroom-auth.mjs");
const store = await import("./classroom-store.mjs");
const principal = { uid: "uid-1", projectId: "project-1", principalId: "project-1:uid-1" };
const teacherMembership = { membershipId: "t1", schoolId: "school-1", displayName: "Teacher", role: "teacher", status: "active" };
const studentMembership = { membershipId: "s1", schoolId: "school-1", displayName: "Student", role: "student", status: "active" };
const teacher = auth.schoolClassroomProfile(teacherMembership, "teens");
const student = auth.schoolClassroomProfile(studentMembership, "teens");
const dependencies = (membership = teacherMembership, extra = {}) => ({
  verify: async () => principal,
  membershipsFor: async () => [membership],
  feature: async () => ({}),
  ...extra,
});
const request = { headers: {} };
const call = (path, body, deps = dependencies()) => auth.authenticateClassroomRequest(request, `/classroom/${path}`, { appVariant: "teens", ...body }, deps);

test("missing and forged tokens are rejected before profile/store access", async () => {
  await assert.rejects(auth.authenticateClassroomRequest(request, "/classroom/classes/list", { profile: teacher }), /Sign in/);
  await assert.rejects(auth.authenticateClassroomRequest({ headers: { "x-firebase-id-token": "bad-token" } }, "/classroom/classes/list", { profile: teacher }), /malformed/);
});

test("authoritative school profile ignores forged name/role and other user's ID", async () => {
  const result = await call("profile/upsert", { profile: { ...student, name: "Forged", role: "teacher" } }, dependencies(studentMembership));
  assert.equal(result.profile.role, "student");
  assert.equal(result.profile.name, "Student");
  await assert.rejects(call("classes/create", { teacherProfile: student }, dependencies(studentMembership)), /Only teachers/);
  await assert.rejects(call("classes/list", { profile: teacher }, dependencies(studentMembership)), /active school membership/);
});

test("school membership suspension and licence expiry fail closed", async () => {
  await assert.rejects(call("classes/list", { profile: teacher }, dependencies({ ...teacherMembership, status: "suspended" })), /active school membership/);
  await assert.rejects(call("classes/list", { profile: teacher }, dependencies(teacherMembership, { feature: async () => { throw new Error("Expired licence"); } })), /Expired/);
});

let classroom;
test("create school class and join with verified identities", async () => {
  const body = await call("classes/create", { teacherProfile: teacher, className: "Year 8" });
  classroom = await store.createClassroom(body.teacherProfile, body.className, "teens");
  assert.equal(classroom.schoolId, teacher.schoolId);
  const joining = await call("classes/invite-link/accept", { studentProfile: student, classCode: classroom.classCode }, dependencies(studentMembership));
  await store.acceptClassInviteLink(joining.studentProfile, joining.classCode, "teens");
  const reading = await call("classes/details", { profile: student, classId: classroom.classId }, dependencies(studentMembership));
  assert.equal((await store.getClassroomDetails(reading.profile, classroom.classId, "teens")).classroom.className, "Year 8");
});

test("school and variant boundaries; student cannot generate or edit teacher content", async () => {
  const otherMembership = { ...studentMembership, membershipId: "other", schoolId: "school-2" };
  const otherStudent = auth.schoolClassroomProfile(otherMembership, "teens");
  await assert.rejects(call("classes/invite-link/accept", { studentProfile: otherStudent, classCode: classroom.classCode }, dependencies(otherMembership)), /outside your school/);
  await assert.rejects(call("assignments/candidates", { teacherProfile: student, classId: classroom.classId }, dependencies(studentMembership)), /Only teachers/);
  await assert.rejects(call("lesson-notes/refine", { teacherProfile: student, classId: classroom.classId }, dependencies(studentMembership)), /Only teachers/);
  const uniTeacher = auth.schoolClassroomProfile(teacherMembership, "uni");
  await assert.rejects(call("classes/details", { appVariant: "uni", profile: uniTeacher, classId: classroom.classId }), /outside your school/);
});

test("CBT uses same school membership and checks CBT feature on read and submit", async () => {
  const activity = await store.createClassroomActivity({ teacherProfile: teacher, classId: classroom.classId,
    type: "test", assessmentMode: "cbt", title: "Test", subject: { id: "math", name: "Math" },
    questions: [{ id: "q1", prompt: "1+1?", options: ["1", "2", "3", "4"], answer: "2", explanation: "Sum" }],
    durationMinutes: 30, questionCount: 1 }, "teens");
  const features = [];
  const deps = dependencies(studentMembership, { feature: async (_p, _s, f) => { features.push(f); } });
  await call("assignments/details", { profile: student, activityId: activity.activityId }, deps);
  await call("assignments/submit", { profile: student, activityId: activity.activityId }, deps);
  assert.deepEqual(features, ["classroom", "cbt", "classroom", "cbt"]);
  await assert.rejects(call("assignments/details", { profile: student, activityId: activity.activityId }, dependencies(studentMembership, { feature: async (_p, _s, f) => { if (f === "cbt") throw new Error("CBT disabled"); } })), /CBT disabled/);
});

test("personal profile ownership persists, cannot be stolen by a second account", async () => {
  const personal = { id: "personal-1", name: "Private Teacher", quiksId: "QX-P1", role: "teacher" };
  const deps = dependencies(teacherMembership, { loadProfiles: async () => [personal] });
  const body = await call("profile/upsert", { profile: { ...personal, schoolId: "forged-school" } }, deps);
  assert.equal(body.profile.schoolId, undefined);
  await store.upsertClassroomProfile(body.profile, "teens");
  await assert.rejects(call("profile/upsert", { profile: personal }, { ...deps, verify: async () => ({ ...principal, principalId: "project-2:uid-1" }) }), /different account/);
  await assert.rejects(call("classes/list", { profile: { ...personal, id: "missing-profile" } }, deps), /not saved/);
  const disk = JSON.parse(await readFile(process.env.CLASSROOM_STORE_PATH, "utf8"));
  assert.equal(disk.profileIdentities[personal.id].owner, principal.principalId);
  const impersonator = { ...personal, id: "different-id" };
  await assert.rejects(call("profile/upsert", { profile: impersonator }, { ...deps, loadProfiles: async () => [impersonator] }), /Quiks ID is already associated/);
});

test("unbound legacy profile cannot be claimed; approved mapping keeps ID and records", async () => {
  const legacy = { id: "legacy-1", name: "Legacy", role: "teacher", quiksId: "QX-L1" };
  await store.upsertClassroomProfile(legacy, "teens");
  const deps = dependencies(teacherMembership, { loadProfiles: async () => [legacy] });
  await assert.rejects(call("classes/list", { profile: legacy }, deps), /verified ownership migration/);
  process.env.QUIKS_CLASSROOM_IDENTITY_MAP_PATH = join(directory, "reviewed-map.json");
  await writeFile(process.env.QUIKS_CLASSROOM_IDENTITY_MAP_PATH, JSON.stringify({ [legacy.id]: { owner: principal.principalId, appVariant: "teens" } }));
  assert.equal((await call("classes/list", { profile: legacy }, deps)).profile.id, legacy.id);
});

test("Firestore lookup uses verified project/UID and caller token, fails on outage", async () => {
  const req = { headers: { "x-firebase-id-token": "test-token" } };
  const profiles = await auth.loadVerifiedAccountProfiles(req, principal, async (url, options) => {
    assert.match(url, /projects\/project-1.*users\/uid-1\?mask/);
    assert.equal(options.headers.Authorization, "Bearer test-token");
    return { ok: true, json: async () => ({ fields: { state: { mapValue: { fields: { profiles: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: "owned" } } } }] } } } } } } }) };
  });
  assert.equal(profiles[0].id, "owned");
  await assert.rejects(auth.loadVerifiedAccountProfiles(req, principal, async () => ({ ok: false, status: 503 })), /Unable to verify/);
});

test("every HTTP classroom route rejects anonymous requests before its handler", async () => {
  const source = await readFile(new URL("./openai-proxy.mjs", import.meta.url), "utf8");
  const routes = [...new Set([...source.matchAll(/url\.pathname === "(\/classroom\/[^\"]+)"/g)].map((match) => match[1]))];
  routes.push("/classroom/classes/claim", "/classroom/classes/student-code", ...["list", "create", "link", "details"].map(action => `/school/admin/classes/${action}`));
  assert.ok(routes.length >= 29);
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn(process.execPath, [fileURLToPath(new URL("./openai-proxy.mjs", import.meta.url))], {
    env: { ...process.env, PORT: String(port), SCHOOL_STORE_PATH: join(directory, "unused-school.json") },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  try {
    await Promise.race([once(child.stdout, "data"), once(child, "error").then(([error]) => { throw error; }), new Promise((_, reject) => { const t = setTimeout(() => reject(new Error("Server startup timeout")), 10000); t.unref(); })]);
    for (const route of routes) {
      const response = await fetch(`http://127.0.0.1:${port}${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: teacher }) });
      assert.equal(response.status, 401, route);
    }
  } finally {
    child.kill();
    await once(child, "exit");
  }
});

test("corrupt classroom data fails closed without replacing existing bytes", async () => {
  const corruptPath = join(directory, "corrupt.json");
  const original = '{"profiles": corrupted existing data';
  await writeFile(corruptPath, original);
  const previousPath = process.env.CLASSROOM_STORE_PATH;
  process.env.CLASSROOM_STORE_PATH = corruptPath;
  try {
    const isolatedStore = await import(`./classroom-store.mjs?corruption-test=${Date.now()}`);
    await assert.rejects(isolatedStore.upsertClassroomProfile({ id: "new" }, "teens"), SyntaxError);
    assert.equal(await readFile(corruptPath, "utf8"), original);
  } finally { process.env.CLASSROOM_STORE_PATH = previousPath; }
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile, link } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CLASSROOM_RESET_VERSION, migrateClassroomTestData } from "./classroom-migration.mjs";

const emptyStore = { profiles: {}, profileIdentities: {}, classrooms: {}, memberships: {}, activities: {}, submissions: {}, lessonNotes: {}, chatMessages: {} };
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "quiks-reset-test-"));
  const classroomPath = join(directory, "classroom-store.json");
  const schoolPath = join(directory, "school-store.json");
  const schoolBytes = JSON.stringify({ schools: { one: { licence: "preserve" } }, memberships: { enrolled: true } });
  await writeFile(schoolPath, schoolBytes);
  return { directory, classroomPath, schoolPath, schoolBytes, mode: CLASSROOM_RESET_VERSION, emptyStore };
}

test("explicit reset backs up classroom bytes and leaves school records untouched", async () => {
  const f = await fixture();
  const oldBytes = JSON.stringify({ profiles: { old: true }, classrooms: { test: true }, submissions: { old: true } }, null, 2);
  await writeFile(f.classroomPath, oldBytes);
  assert.deepEqual(await migrateClassroomTestData(f), { status: "completed", backupCreated: true });
  const fresh = JSON.parse(await readFile(f.classroomPath, "utf8"));
  for (const key of Object.keys(emptyStore)) assert.deepEqual(fresh[key], {});
  assert.equal(await readFile(join(f.directory, fresh.migrations[CLASSROOM_RESET_VERSION].backupFile), "utf8"), oldBytes);
  assert.equal(await readFile(f.schoolPath, "utf8"), f.schoolBytes);
});

test("repeat startup retains newly created classes even if the flag remains set", async () => {
  const f = await fixture();
  await migrateClassroomTestData(f);
  const fresh = JSON.parse(await readFile(f.classroomPath, "utf8"));
  fresh.classrooms.new = { className: "New class" };
  fresh.profileIdentities.verified = { owner: "school:membership" };
  const afterUse = JSON.stringify(fresh);
  await writeFile(f.classroomPath, afterUse);
  assert.equal((await migrateClassroomTestData(f)).status, "already_completed");
  assert.equal(await readFile(f.classroomPath, "utf8"), afterUse);
  assert.equal((await readdir(f.directory)).filter((name) => name.includes(".backup")).length, 0);
});

test("no flag means no reset; unsupported flag and relative paths fail closed", async () => {
  const f = await fixture();
  await writeFile(f.classroomPath, '{"classrooms":{"old":true}}');
  assert.equal((await migrateClassroomTestData({ ...f, mode: "" })).status, "not_requested");
  await assert.rejects(migrateClassroomTestData({ ...f, mode: "yes" }), /Unsupported/);
  await assert.rejects(migrateClassroomTestData({ ...f, classroomPath: "classroom.json" }), /absolute/);
  assert.equal(await readFile(f.classroomPath, "utf8"), '{"classrooms":{"old":true}}');
});

test("school path collisions and hard links are refused", async () => {
  const f = await fixture();
  await assert.rejects(migrateClassroomTestData({ ...f, classroomPath: f.schoolPath }), /must be different/);
  await link(f.schoolPath, f.classroomPath);
  await assert.rejects(migrateClassroomTestData(f), /aliases the school store/);
  assert.equal(await readFile(f.schoolPath, "utf8"), f.schoolBytes);
});

test("corrupt input and a migration lock never cause data replacement", async () => {
  const f = await fixture();
  await writeFile(f.classroomPath, "broken-json");
  await assert.rejects(migrateClassroomTestData(f), SyntaxError);
  assert.equal(await readFile(f.classroomPath, "utf8"), "broken-json");
  await writeFile(f.classroomPath, "{}");
  await writeFile(`${f.classroomPath}.identity-reset.lock`, "existing migration");
  await assert.rejects(migrateClassroomTestData(f), { code: "EEXIST" });
  assert.equal(await readFile(f.classroomPath, "utf8"), "{}");
});

test("startup integration exposes completion and preserves it after classroom writes", async () => {
  const f = await fixture();
  await writeFile(f.classroomPath, '{"classrooms":{"obsolete":true}}');
  const previous = { classroom: process.env.CLASSROOM_STORE_PATH, school: process.env.SCHOOL_STORE_PATH, mode: process.env.QUIKS_CLASSROOM_MIGRATION };
  Object.assign(process.env, { CLASSROOM_STORE_PATH: f.classroomPath, SCHOOL_STORE_PATH: f.schoolPath, QUIKS_CLASSROOM_MIGRATION: CLASSROOM_RESET_VERSION });
  try {
    const store = await import(`./classroom-store.mjs?startup-test=${Date.now()}`);
    assert.equal((await store.initializeClassroomStore()).status, "completed");
    assert.equal(store.getClassroomStoreDiagnostics().identityResetCompleted, true);
    await store.createClassroom({ id: "teacher", name: "Test", role: "teacher", quiksId: "TEST-ID", schoolId: "school-one" }, "New test class", "teens");
    const saved = JSON.parse(await readFile(f.classroomPath, "utf8"));
    assert.equal(Object.keys(saved.classrooms).length, 1);
    assert.ok(saved.migrations[CLASSROOM_RESET_VERSION].completedAt);
    assert.equal((await migrateClassroomTestData(f)).status, "already_completed");
  } finally {
    for (const [name, value] of [["CLASSROOM_STORE_PATH", previous.classroom], ["SCHOOL_STORE_PATH", previous.school], ["QUIKS_CLASSROOM_MIGRATION", previous.mode]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

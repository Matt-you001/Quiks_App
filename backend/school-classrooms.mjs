import { randomUUID, randomInt } from "node:crypto";
import { backfillSchoolResults } from "./school-results.mjs";

const fail = (message, statusCode = 403) => { throw Object.assign(new Error(message), { statusCode }); };
export function newClassCode(store) {
  const used = new Set(Object.values(store.classrooms).flatMap(c => [c.classCode, c.teacherAccessCode]));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do { code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join(""); } while (used.has(code));
  return code;
}
function recordAudit(c, action, principalId) {
  (c.schoolAudit ??= []).push({ action, principalId, at: Date.now() });
}
function summary(store, c) {
  return { classId: c.id, className: c.className, appVariant: c.appVariant, classCode: c.classCode,
    teacherAccessCode: c.teacherAccessCode ?? null, teacherName: c.teacherName,
    codePolicy: c.codePolicy ?? "shared", awaitingTeacher: !c.teacherProfileId,
    studentCount: Object.values(store.memberships).filter(m => m.classId === c.id && m.role === "student" && m.status === "active").length,
    activityCount: Object.values(store.activities).filter(a => a.classId === c.id).length,
    noteCount: Object.values(store.lessonNotes).filter(n => n.classId === c.id).length,
    registeredAt: c.schoolRegisteredAt ?? c.createdAt };
}

// scope comes exclusively from verified school administration authorization.
export function schoolClassroomOperation(store, action, scope, payload) {
  const schoolId = scope.school.id;
  if (action === "list") return { classes: Object.values(store.classrooms).filter(c => c.schoolId === schoolId).map(c => summary(store, c)) };
  if (action === "create") {
    const variant = payload.appVariant;
    if (!["children", "teens", "uni"].includes(variant) || !scope.school.licence.allowedVariants?.includes(variant)) fail("Choose an app variant included in the school licence.", 400);
    const name = String(payload.className ?? "").trim();
    if (!name || name.length > 100) fail("Enter a class name of 1–100 characters.", 400);
    if (!["shared", "teacher_generated"].includes(payload.codePolicy)) fail("Choose a class code policy.", 400);
    const teacher = scope.memberships.find(m => m.membershipId === payload.teacherMembershipId && m.schoolId === schoolId && m.role === "teacher" && m.status === "active");
    if (!teacher) fail("Select an active teacher enrolled in this school.", 400);
    const code = newClassCode(store);
    const c = { id: randomUUID(), className: name, schoolId, appVariant: variant,
      assignedTeacherMembershipId: teacher.membershipId, teacherProfileId: null, teacherName: teacher.displayName,
      teacherAccessCode: code, classCode: payload.codePolicy === "shared" ? code : null,
      codePolicy: payload.codePolicy, createdAt: Date.now(), schoolRegisteredAt: Date.now() };
    recordAudit(c, "admin_created", scope.principal.principalId);
    store.classrooms[c.id] = c;
    return { classroom: summary(store, c) };
  }
  const c = action === "link"
    ? Object.values(store.classrooms).find(c => c.classCode && c.classCode === String(payload.classCode ?? "").trim().toUpperCase() && c.schoolId === schoolId)
    : store.classrooms[payload.classId];
  if (!c || c.schoolId !== schoolId) fail("Class not found in this school. The teacher must create it using their school-linked profile.", 404);
  if (action === "link") {
    const teacher = store.profiles[c.teacherProfileId];
    if (!scope.memberships.some(m => m.membershipId === teacher?.schoolMembershipId && m.role === "teacher" && m.status === "active")) fail("The class teacher must be an active teacher in this school.");
    if (!c.schoolRegisteredAt) { c.schoolRegisteredAt = Date.now(); recordAudit(c, "teacher_class_registered", scope.principal.principalId); }
    backfillSchoolResults(store);
    return { classroom: summary(store, c) };
  }
  if (action === "details") {
    const activities = Object.values(store.activities).filter(a => a.classId === c.id);
    const ids = new Set(activities.map(a => a.id));
    return { classroom: summary(store, c), members: Object.values(store.memberships).filter(m => m.classId === c.id),
      activities: activities.map(({ accessCode, ...a }) => a),
      submissions: Object.values(store.submissions).filter(s => ids.has(s.activityId)),
      notes: Object.values(store.lessonNotes).filter(n => n.classId === c.id).map(({ attachmentDataBase64, ...n }) => n),
      messages: Object.values(store.chatMessages).filter(m => m.classId === c.id), audit: c.schoolAudit ?? [] };
  }
  fail("Classroom action not found.", 404);
}

export function teacherSchoolClassOperation(store, action, actor, payload) {
  if (!actor.schoolId || !actor.schoolMembershipId || actor.role !== "teacher") fail("Use your school-linked teacher profile.");
  const c = action === "claim" ? Object.values(store.classrooms).find(c => c.teacherAccessCode === String(payload.classCode ?? "").trim().toUpperCase()) : store.classrooms[payload.classId];
  if (!c || c.schoolId !== actor.schoolId || c.appVariant !== payload.appVariant) fail("School class not found.", 404);
  if (action === "claim") {
    if (c.assignedTeacherMembershipId !== actor.schoolMembershipId || (c.teacherProfileId && c.teacherProfileId !== actor.id)) fail("This class is assigned to another teacher.");
    if (!c.teacherProfileId) {
      c.teacherProfileId = actor.id; c.teacherName = actor.name;
      const id = randomUUID();
      store.memberships[id] = { membershipId: id, classId: c.id, profileId: actor.id, quiksId: actor.quiksId, name: actor.name, role: "teacher", status: "active", requestedBy: "school_admin", createdAt: Date.now(), joinedAt: Date.now() };
      recordAudit(c, "teacher_opened", actor.principalId);
    }
  } else if (action === "student-code") {
    if (c.teacherProfileId !== actor.id || c.codePolicy !== "teacher_generated") fail("Only the assigned teacher can generate a separate student code.");
    // Idempotent: retries never invalidate a code already shared with students.
    if (!c.classCode) { c.classCode = newClassCode(store); recordAudit(c, "student_code_created", actor.principalId); }
  } else fail("Classroom action not found.", 404);
  return c;
}

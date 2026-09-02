import { randomUUID } from "node:crypto";

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const clone = (value) => structuredClone(value);
const text = (value, max) => String(value ?? "").trim().slice(0, max);
function percentage(value) {
  const number = Number(value);
  if (value === "" || value == null || !Number.isFinite(number) || number < 0 || number > 100) fail("Marks must be percentages between 0 and 100.");
  return Math.round(number * 100) / 100;
}
function prepare(store) {
  store.schoolResults ??= {};
  store.schoolReports ??= {};
}

// Called in the same persisted transaction as the classroom submission.
// Immutable snapshots prevent class/activity deletion from erasing the register.
export function captureSchoolResult(store, submission) {
  prepare(store);
  if (store.schoolResults[submission.submissionId]) return;
  const activity = store.activities[submission.activityId];
  const classroom = store.classrooms[activity?.classId];
  const profile = store.profiles[submission.profileId];
  if (!classroom?.schoolId || !profile?.schoolMembershipId || profile.schoolId !== classroom.schoolId) return;
  const score = Number(submission.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) return;
  store.schoolResults[submission.submissionId] = {
    resultId: submission.submissionId, schoolId: classroom.schoolId,
    studentMembershipId: profile.schoolMembershipId, profileId: submission.profileId,
    studentName: submission.studentName, quiksId: submission.quiksId,
    classId: classroom.id, className: classroom.className, activityId: activity.id,
    title: activity.title, subject: activity.subjectName, type: activity.type,
    assessmentMode: activity.assessmentMode ?? "standard", appVariant: classroom.appVariant,
    teacherName: activity.teacherName, score, correctAnswers: submission.correctAnswers,
    totalQuestions: submission.totalQuestions, submittedAt: submission.submittedAt,
    attemptNumber: submission.attemptNumber ?? 1, scoreSource: "client_reported",
  };
}

export function backfillSchoolResults(store) {
  prepare(store);
  Object.values(store.submissions).forEach((submission) => captureSchoolResult(store, submission));
}

function selectedResults(store, schoolId, filters = {}) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) fail("Invalid result filters.");
  let rows = Object.values(store.schoolResults).filter((row) => row.schoolId === schoolId);
  for (const key of ["classId", "studentMembershipId", "subject", "type", "appVariant"]) {
    if (filters[key]) rows = rows.filter((row) => row[key] === filters[key]);
  }
  for (const key of ["from", "to"]) {
    if (filters[key] != null && filters[key] !== "") {
      if (!Number.isFinite(Number(filters[key]))) fail("Invalid result date filter.");
      rows = rows.filter((row) => key === "from" ? row.submittedAt >= Number(filters[key]) : row.submittedAt <= Number(filters[key]));
    }
  }
  rows.sort((a, b) => b.submittedAt - a.submittedAt || b.attemptNumber - a.attemptNumber || b.resultId.localeCompare(a.resultId));
  if (filters.attempts !== "all") {
    const seen = new Set();
    rows = rows.filter((row) => {
      const key = `${row.studentMembershipId}:${row.activityId}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  return rows;
}

function audit(report, scope, action) {
  report.audit.push({ action, at: Date.now(), principalId: scope.principal.principalId, name: scope.principal.name });
}
function reportFor(store, scope, id) {
  const report = store.schoolReports[id];
  if (!report || report.schoolId !== scope.school.id) fail("Report not found.", 404);
  return report;
}
function currentMember(scope, id) {
  const member = scope.memberships.find((entry) => entry.membershipId === id && entry.role === "student");
  if (!member) fail("Student membership not found in this school.", 404);
  return member;
}
function requireRevision(report, payload) {
  if (payload.revision !== report.revision) fail("This report changed. Reload it before continuing.", 409);
}
function average(rows) {
  return rows.length ? Math.round(rows.reduce((sum, row) => sum + (row.adjustedScore ?? row.score), 0) / rows.length * 100) / 100 : 0;
}
function csvCell(value) {
  let result = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(result) || /^[\t\r\n]/.test(result)) result = `'${result}`;
  return `"${result.replace(/"/g, '""')}"`;
}

export function processSchoolResults(store, operation, scope, payload = {}) {
  backfillSchoolResults(store);
  if (operation === "list") {
    const all = selectedResults(store, scope.school.id, { attempts: "all" });
    const rows = selectedResults(store, scope.school.id, payload.filters);
    const groups = new Map();
    for (const row of rows) {
      const group = groups.get(row.studentMembershipId) ?? { studentMembershipId: row.studentMembershipId, studentName: row.studentName, rows: [] };
      group.rows.push(row); groups.set(row.studentMembershipId, group);
    }
    const page = payload.page == null ? 1 : Number(payload.page);
    if (!Number.isSafeInteger(page) || page < 1) fail("Invalid results page.");
    return clone({ rows: rows.slice((page - 1) * 50, page * 50), total: rows.length, page,
      classes: [...new Map(all.map((row) => [row.classId, { id: row.classId, name: row.className }])).values()],
      subjects: [...new Set(all.map((row) => row.subject))].sort(),
      students: [...groups.values()].map((group) => ({ studentMembershipId: group.studentMembershipId, studentName: group.studentName, count: group.rows.length, average: average(group.rows) })),
    });
  }
  if (operation === "reports") return { reports: clone(Object.values(store.schoolReports).filter((report) => report.schoolId === scope.school.id).sort((a, b) => b.updatedAt - a.updatedAt)) };
  if (operation === "create") {
    const member = currentMember(scope, payload.studentMembershipId);
    const rows = selectedResults(store, scope.school.id, { ...payload.filters, studentMembershipId: member.membershipId, attempts: "latest" });
    if (!rows.length) fail("No results match this student's selected filters.");
    if (rows.length > 250) fail("Narrow the date or class filters to at most 250 activities per student report.");
    const title = text(payload.title, 160);
    if (!title) fail("Enter a report title, such as First Term 2026.");
    const now = Date.now();
    const report = { reportId: randomUUID(), schoolId: scope.school.id, schoolName: scope.school.name,
      studentMembershipId: member.membershipId, studentName: member.displayName, email: member.email,
      title, comment: "", rows: clone(rows), average: average(rows), status: "draft", revision: 1,
      calculation: "Unweighted mean of the latest submitted attempt for each included activity; not a weighted term grade.",
      createdAt: now, updatedAt: now, audit: [], delivery: null };
    audit(report, scope, "created"); store.schoolReports[report.reportId] = report;
    return { report: clone(report) };
  }
  const report = reportFor(store, scope, payload.reportId);
  if (operation === "export") {
    const cells = [["School", "Student", "Report", "Class", "Subject", "Activity", "Type", "Submitted", "Attempt", "Original %", "Report %", "Adjustment reason", "Score source", "Admin comment", "Status"]];
    for (const row of report.rows) cells.push([report.schoolName, report.studentName, report.title, row.className, row.subject, row.title, row.type,
      new Date(row.submittedAt).toISOString(), row.attemptNumber, row.score, row.adjustedScore ?? row.score, row.adjustmentReason ?? "", row.scoreSource, report.comment, report.status]);
    audit(report, scope, "exported");
    return { filename: `quiks-report-${report.reportId}.csv`, csv: cells.map((row) => row.map(csvCell).join(",")).join("\r\n") };
  }
  requireRevision(report, payload);
  if (operation === "update") {
    if (["sending", "sent", "delivery_unknown"].includes(report.status)) fail("This report is locked. Create a new report for corrections.", 409);
    report.comment = text(payload.comment, 2000);
    const adjustments = payload.adjustments ?? [];
    if (!Array.isArray(adjustments)) fail("Invalid mark adjustments.");
    if (new Set(adjustments.map((item) => item.resultId)).size !== adjustments.length) fail("Duplicate mark adjustment.");
    for (const item of adjustments) if (!report.rows.some((row) => row.resultId === item.resultId)) fail("Adjustment result does not belong to this report.");
    report.rows = report.rows.map((original) => {
      const { adjustedScore: _score, adjustmentReason: _reason, ...row } = original;
      const adjustment = adjustments.find((item) => item.resultId === row.resultId);
      if (!adjustment || adjustment.score === "" || adjustment.score == null) return row;
      const reason = text(adjustment.reason, 500);
      if (!reason) fail("Give a reason for every mark adjustment.");
      return { ...row, adjustedScore: percentage(adjustment.score), adjustmentReason: reason };
    });
    report.average = average(report.rows); report.status = "draft"; report.revision += 1;
    report.updatedAt = Date.now(); report.delivery = null; audit(report, scope, "edited");
  } else if (operation === "approve") {
    if (report.status !== "draft" || payload.reviewed !== true) fail("Review and save this draft before approving it.");
    report.status = "approved"; report.revision += 1; report.updatedAt = Date.now(); audit(report, scope, "approved");
  } else if (operation === "begin-send") {
    if (report.status !== "approved" || payload.confirm !== true) fail("Approve the report and confirm the recipient before sending.");
    const member = currentMember(scope, report.studentMembershipId);
    if (member.status !== "active" || member.email !== report.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(report.email)) fail("The enrolled recipient has changed or is inactive. Create a new report after checking enrolment.");
    report.status = "sending";
    report.delivery = { status: "sending", key: `quiks-result-${report.reportId}-v${report.revision}`, startedAt: Date.now() };
    audit(report, scope, "send_requested");
  } else if (operation === "finish-send") {
    if (report.status !== "sending" || payload.key !== report.delivery?.key) fail("Email delivery state changed.", 409);
    const allowed = ["sent", "failed", "not_configured", "unknown"];
    if (!allowed.includes(payload.delivery?.status)) fail("Invalid delivery result.");
    report.delivery = { ...report.delivery, ...payload.delivery, finishedAt: Date.now() };
    report.status = payload.delivery.status === "sent" ? "sent" : payload.delivery.status === "unknown" ? "delivery_unknown" : "approved";
    report.updatedAt = Date.now(); audit(report, scope, `email_${payload.delivery.status}`);
  } else fail("Unknown results action.", 404);
  return { report: clone(report) };
}

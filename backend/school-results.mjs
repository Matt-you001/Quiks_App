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
  store.schoolReportTemplates ??= {};
}

export const DEFAULT_SCHOOL_REPORT_TEMPLATES = Object.freeze([
  { templateId: "classic", name: "Classic", heading: "Student Academic Report", accentColor: "#0E5C63", footerNote: "Please contact the school if you have questions about this report.", showClass: true, showStudentClass: true, showAdmissionNumber: true, showActivityType: false, showSubmittedDate: false, showCalculation: true, showTeacherComment: true, showSignatures: true, showAverage: true, orientation: "portrait", customFields: [], ratingSections: [] },
  { templateId: "modern", name: "Modern", heading: "Learning Progress Report", accentColor: "#7C2BD1", footerNote: "Learning today, leading tomorrow.", showClass: true, showStudentClass: true, showAdmissionNumber: true, showActivityType: true, showSubmittedDate: true, showCalculation: false, showTeacherComment: true, showSignatures: true, showAverage: true, orientation: "landscape", customFields: [], ratingSections: [{ sectionId: "learner-habits", title: "Learner habits", items: [{ itemId: "attendance", label: "Attendance" }, { itemId: "punctuality", label: "Punctuality" }, { itemId: "character", label: "Character" }], scale: ["Excellent", "Very Good", "Good", "Fair", "Needs Improvement"] }] },
  { templateId: "compact", name: "Compact", heading: "Academic Results Summary", accentColor: "#12324A", footerNote: "", showClass: false, showStudentClass: true, showAdmissionNumber: false, showActivityType: false, showSubmittedDate: false, showCalculation: false, showTeacherComment: true, showSignatures: true, showAverage: true, orientation: "portrait", customFields: [], ratingSections: [] },
]);
export const DEFAULT_SCHOOL_REPORT_TEMPLATE = DEFAULT_SCHOOL_REPORT_TEMPLATES[0];

function normalizeReportTemplate(value = {}) {
  value = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const color = text(value.accentColor, 7);
  return {
    templateId: text(value.templateId, 60) || DEFAULT_SCHOOL_REPORT_TEMPLATE.templateId,
    name: text(value.name, 80) || DEFAULT_SCHOOL_REPORT_TEMPLATE.name,
    heading: text(value.heading, 120) || DEFAULT_SCHOOL_REPORT_TEMPLATE.heading,
    accentColor: /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : DEFAULT_SCHOOL_REPORT_TEMPLATE.accentColor,
    footerNote: text(value.footerNote, 500),
    showClass: value.showClass !== false,
    showStudentClass: value.showStudentClass !== false,
    showAdmissionNumber: value.showAdmissionNumber !== false,
    showActivityType: value.showActivityType === true,
    showSubmittedDate: value.showSubmittedDate === true,
    showCalculation: value.showCalculation !== false,
    showTeacherComment: value.showTeacherComment !== false,
    showSignatures: value.showSignatures !== false,
    showAverage: value.showAverage !== false,
    orientation: value.orientation === "landscape" ? "landscape" : "portrait",
    customFields: (Array.isArray(value.customFields) ? value.customFields : []).slice(0, 12).map((field, index) => ({
      fieldId: text(field?.fieldId, 80) || `field-${index + 1}`,
      label: text(field?.label, 100) || `Field ${index + 1}`,
      source: ["average", "studentName", "class", "admissionNumber", "reportTitle", "custom"].includes(field?.source) ? field.source : "custom",
      defaultValue: text(field?.defaultValue, 300),
    })),
    ratingSections: (Array.isArray(value.ratingSections) ? value.ratingSections : []).slice(0, 6).map((section, sectionIndex) => ({
      sectionId: text(section?.sectionId, 80) || `section-${sectionIndex + 1}`,
      title: text(section?.title, 120) || `Rating section ${sectionIndex + 1}`,
      items: (Array.isArray(section?.items) ? section.items : []).slice(0, 20).map((item, itemIndex) => ({
        itemId: text(item?.itemId, 80) || `item-${itemIndex + 1}`,
        label: text(item?.label, 100) || `Rating ${itemIndex + 1}`,
      })),
      scale: (Array.isArray(section?.scale) ? section.scale : []).slice(0, 10).map((entry) => text(entry, 60)).filter(Boolean),
    })).filter((section) => section.items.length && section.scale.length),
  };
}

function reportTemplateConfiguration(store, schoolId) {
  const stored = store.schoolReportTemplates[schoolId];
  if (stored?.templates && Array.isArray(stored.templates)) {
    const templates = stored.templates.slice(0, 12).map(normalizeReportTemplate);
    const activeTemplateId = templates.some((template) => template.templateId === stored.activeTemplateId)
      ? stored.activeTemplateId
      : templates[0]?.templateId;
    if (templates.length) return { templates, activeTemplateId };
  }
  const templates = DEFAULT_SCHOOL_REPORT_TEMPLATES.map((template) => normalizeReportTemplate(template));
  if (stored && !stored.templates) templates[0] = normalizeReportTemplate({ ...templates[0], ...stored, templateId: "classic", name: "Classic" });
  return { templates, activeTemplateId: templates[0].templateId };
}

// Called only from the teacher-controlled school publication transaction.
// Immutable snapshots prevent later class/activity deletion from erasing the register.
export function captureSchoolResult(store, submission) {
  prepare(store);
  const activity = store.activities[submission.activityId];
  const classroom = store.classrooms[activity?.classId];
  const profile = store.profiles[submission.profileId];
  const teacherSubmittedAt = Number(submission.schoolPublishedAt);
  // Classroom results remain private to the teacher until the teacher
  // explicitly submits this activity's finalized marks to the school.
  if (!Number.isFinite(teacherSubmittedAt) || teacherSubmittedAt <= 0) return;
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
    teacherSubmittedAt, teacherSubmittedBy: submission.schoolPublishedBy,
    attemptNumber: submission.attemptNumber ?? 1,
    scoreSource: submission.scoreSource ?? "legacy_client_reported",
    gradingStatus: submission.gradingStatus ?? "finalized",
    provisionalScore: submission.provisionalScore,
    pointsAwarded: submission.pointsAwarded,
    totalPoints: submission.totalPoints,
    autoSubmitted: Boolean(submission.autoSubmitted),
  };
}

export function backfillSchoolResults(store) {
  prepare(store);
  Object.values(store.submissions).forEach((submission) => captureSchoolResult(store, submission));
}

function selectedResults(store, schoolId, filters = {}) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) fail("Invalid result filters.");
  let rows = Object.values(store.schoolResults).filter((row) => row.schoolId === schoolId && Number.isFinite(Number(row.teacherSubmittedAt)));
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

function email(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : "";
}

export function processSchoolResults(store, operation, scope, payload = {}) {
  backfillSchoolResults(store);
  if (operation === "template") {
    return clone(reportTemplateConfiguration(store, scope.school.id));
  }
  if (operation === "template-update") {
    const configuration = reportTemplateConfiguration(store, scope.school.id);
    const template = normalizeReportTemplate(payload.template);
    const existingIndex = configuration.templates.findIndex((entry) => entry.templateId === template.templateId);
    if (existingIndex < 0) fail("Report template not found.", 404);
    configuration.templates[existingIndex] = template;
    configuration.activeTemplateId = template.templateId;
    store.schoolReportTemplates[scope.school.id] = configuration;
    return clone(configuration);
  }
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
    const seenActivities = new Set();
    const rows = selectedResults(store, scope.school.id, { ...payload.filters, studentMembershipId: member.membershipId, attempts: "all" })
      .filter((row) => row.gradingStatus !== "awaiting_marking")
      .filter((row) => {
        if (seenActivities.has(row.activityId)) return false;
        seenActivities.add(row.activityId);
        return true;
      });
    if (!rows.length) fail("No results match this student's selected filters.");
    if (rows.length > 250) fail("Narrow the date or class filters to at most 250 activities per student report.");
    const title = text(payload.title, 160);
    if (!title) fail("Enter a report title, such as First Term 2026.");
    const now = Date.now();
    const studentEmail = email(member.email);
    const guardianEmail = email(member.profileData?.parentEmail);
    const configuration = reportTemplateConfiguration(store, scope.school.id);
    const reportTemplate = configuration.templates.find((entry) => entry.templateId === configuration.activeTemplateId) ?? configuration.templates[0];
    const report = { reportId: randomUUID(), schoolId: scope.school.id, schoolName: scope.school.name,
      studentMembershipId: member.membershipId, studentName: member.displayName,
      studentAdmissionNumber: text(member.profileData?.admissionNumber, 120),
      studentClassName: [...new Set(rows.map((row) => row.className))].join(", "),
      studentEmail, guardianEmail, recipientType: "student", email: studentEmail,
      title, comment: "", teacherName: "", principalName: "", rows: clone(rows),
      template: clone(reportTemplate),
      customFieldValues: Object.fromEntries(reportTemplate.customFields.map((field) => [field.fieldId, field.defaultValue])),
      ratingValues: {},
      average: average(rows), status: "draft", revision: 1,
      calculation: "Unweighted mean of the latest submitted attempt for each included activity; not a weighted term grade.",
      createdAt: now, updatedAt: now, audit: [], delivery: null };
    audit(report, scope, "created"); store.schoolReports[report.reportId] = report;
    return { report: clone(report) };
  }
  const report = reportFor(store, scope, payload.reportId);
  if (operation === "comment-context") {
    return {
      report: clone({
        reportId: report.reportId,
        title: report.title,
        average: report.average,
        rows: report.rows.map((row) => ({
          subject: row.subject,
          activity: row.title,
          type: row.type,
          score: row.adjustedScore ?? row.score,
        })),
      }),
    };
  }
  if (operation === "set-generated-comment") {
    if (report.status !== "draft") fail("AI comments can be added only to a draft report.", 409);
    report.comment = text(payload.comment, 2000);
    report.revision += 1;
    report.updatedAt = Date.now();
    audit(report, scope, payload.generatedBy === "ai" ? "teacher_comment_ai_drafted" : "teacher_comment_fallback_drafted");
    return { report: clone(report) };
  }
  if (operation === "export") {
    const customFields = (report.template?.customFields ?? []).map((field) => `${field.label}: ${report.customFieldValues?.[field.fieldId] ?? field.defaultValue ?? ""}`).join(" | ");
    const ratings = (report.template?.ratingSections ?? []).flatMap((section) => section.items.map((item) => `${section.title} — ${item.label}: ${report.ratingValues?.[`${section.sectionId}:${item.itemId}`] ?? ""}`)).join(" | ");
    const cells = [["School", "Student", "Report", "Class", "Subject", "Activity", "Type", "Submitted", "Attempt", "Original %", "Report %", "Adjustment reason", "Score source", "Teacher's comment", "Additional fields", "Ratings", "Class teacher", "Head Teacher / Principal", "Recipient", "Status"]];
    for (const row of report.rows) cells.push([report.schoolName, report.studentName, report.title, row.className, row.subject, row.title, row.type,
      new Date(row.submittedAt).toISOString(), row.attemptNumber, row.score, row.adjustedScore ?? row.score, row.adjustmentReason ?? "", row.scoreSource,
      report.comment, customFields, ratings, report.teacherName ?? "", report.principalName ?? "", report.recipientType ?? "student", report.status]);
    audit(report, scope, "exported");
    return { filename: `quiks-report-${report.reportId}.csv`, csv: cells.map((row) => row.map(csvCell).join(",")).join("\r\n") };
  }
  requireRevision(report, payload);
  if (operation === "update") {
    if (["sending", "sent", "delivery_unknown"].includes(report.status)) fail("This report is locked. Create a new report for corrections.", 409);
    report.comment = text(payload.comment, 2000);
    report.teacherName = text(payload.teacherName, 160);
    report.principalName = text(payload.principalName, 160);
    const templateFields = new Set((report.template?.customFields ?? []).map((field) => field.fieldId));
    const nextCustomValues = payload.customFieldValues && typeof payload.customFieldValues === "object" && !Array.isArray(payload.customFieldValues) ? payload.customFieldValues : {};
    if (Object.keys(nextCustomValues).some((fieldId) => !templateFields.has(fieldId))) fail("A custom report field does not belong to this report.");
    report.customFieldValues = Object.fromEntries((report.template?.customFields ?? []).map((field) => [field.fieldId, text(nextCustomValues[field.fieldId] ?? report.customFieldValues?.[field.fieldId] ?? field.defaultValue, 500)]));
    const ratingOptions = new Map((report.template?.ratingSections ?? []).flatMap((section) => section.items.map((item) => [`${section.sectionId}:${item.itemId}`, new Set(section.scale)])));
    const nextRatings = payload.ratingValues && typeof payload.ratingValues === "object" && !Array.isArray(payload.ratingValues) ? payload.ratingValues : {};
    if (Object.keys(nextRatings).some((ratingId) => !ratingOptions.has(ratingId))) fail("A rating does not belong to this report.");
    report.ratingValues = Object.fromEntries([...ratingOptions].map(([ratingId, allowed]) => {
      const value = text(nextRatings[ratingId] ?? report.ratingValues?.[ratingId], 60);
      if (value && !allowed.has(value)) fail("Choose a rating from the school's configured scale.");
      return [ratingId, value];
    }));
    const recipientType = payload.recipientType === "guardian" ? "guardian" : "student";
    const member = currentMember(scope, report.studentMembershipId);
    const studentEmail = email(member.email);
    const guardianEmail = email(member.profileData?.parentEmail);
    if (recipientType === "guardian" && !guardianEmail) fail("This student does not have a valid parent or guardian email in the school enrolment record.");
    if (recipientType === "student" && !studentEmail) fail("This student does not have a valid enrolled email address.");
    report.studentEmail = studentEmail;
    report.guardianEmail = guardianEmail;
    report.recipientType = recipientType;
    report.email = recipientType === "guardian" ? guardianEmail : studentEmail;
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
    const recipientType = report.recipientType === "guardian" ? "guardian" : "student";
    const expectedEmail = recipientType === "guardian" ? email(member.profileData?.parentEmail) : email(member.email);
    if (member.status !== "active" || !expectedEmail || expectedEmail !== report.email) fail("The enrolled recipient has changed or is inactive. Update and approve a new report revision after checking enrolment.");
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

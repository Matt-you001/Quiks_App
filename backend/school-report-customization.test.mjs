import test from "node:test";
import assert from "node:assert/strict";
import { processSchoolResults } from "./school-results.mjs";
import { draftSchoolReportComment } from "./school-report-comment.mjs";
import { schoolResultsRequest } from "./school-results-api.mjs";

function fixture() {
  const now = Date.now();
  return {
    store: {
      submissions: {},
      schoolResults: {
        result: {
          resultId: "result", schoolId: "school", studentMembershipId: "student", studentName: "Student",
          classId: "class", className: "Year 8", activityId: "activity", title: "Fractions Test",
          subject: "Mathematics", type: "test", appVariant: "teens", assessmentMode: "standard",
          score: 78, submittedAt: now, teacherSubmittedAt: now, attemptNumber: 1,
          scoreSource: "server_calculated", gradingStatus: "finalized",
        },
      },
    },
    scope: {
      school: { id: "school", name: "Example School" },
      principal: { principalId: "admin", name: "Administrator" },
      memberships: [{ membershipId: "student", role: "student", status: "active", displayName: "Student", email: "student@example.com", profileData: {} }],
    },
  };
}

test("schools can select and edit a report template that is snapshotted into new reports", () => {
  const { store, scope } = fixture();
  const initial = processSchoolResults(store, "template", scope);
  assert.deepEqual(initial.templates.map((template) => template.templateId), ["classic", "modern", "compact"]);
  const modern = { ...initial.templates[1], heading: "Our Progress Report", accentColor: "#336699", showSubmittedDate: false, orientation: "landscape", customFields: [{ fieldId: "position", label: "Class position", source: "custom", defaultValue: "" }] };
  const saved = processSchoolResults(store, "template-update", scope, { template: modern });
  assert.equal(saved.activeTemplateId, "modern");
  assert.equal(saved.templates[1].heading, "Our Progress Report");
  let report = processSchoolResults(store, "create", scope, { studentMembershipId: "student", title: "First Term", filters: {} }).report;
  assert.equal(report.template.templateId, "modern");
  assert.equal(report.template.heading, "Our Progress Report");
  assert.equal(report.template.orientation, "landscape");
  report = processSchoolResults(store, "update", scope, { reportId: report.reportId, revision: report.revision, customFieldValues: { position: "3rd" }, ratingValues: { "learner-habits:attendance": "Excellent" }, adjustments: [] }).report;
  assert.equal(report.customFieldValues.position, "3rd");
  assert.equal(report.ratingValues["learner-habits:attendance"], "Excellent");
});

test("generated report comments can be stored and remain editable", () => {
  const { store, scope } = fixture();
  let report = processSchoolResults(store, "create", scope, { studentMembershipId: "student", title: "First Term", filters: {} }).report;
  report = processSchoolResults(store, "set-generated-comment", scope, { reportId: report.reportId, comment: "A constructive draft.", generatedBy: "ai" }).report;
  assert.equal(report.comment, "A constructive draft.");
  report = processSchoolResults(store, "update", scope, { reportId: report.reportId, revision: report.revision, comment: "Teacher edited this comment.", adjustments: [] }).report;
  assert.equal(report.comment, "Teacher edited this comment.");
});

test("creating a report automatically persists the generated teacher comment", async () => {
  const { store, scope } = fixture();
  const result = await schoolResultsRequest(scope.principal, "create", {
    schoolId: scope.school.id, studentMembershipId: "student", title: "First Term", filters: {},
  }, {
    context: async () => scope,
    operation: async (operation, currentScope, payload) => processSchoolResults(store, operation, currentScope, payload),
    generateComment: async () => ({ comment: "The student has shown steady progress.", generatedBy: "ai" }),
  });
  assert.equal(result.report.comment, "The student has shown steady progress.");
  assert.equal(result.report.audit.at(-1).action, "teacher_comment_ai_drafted");
});

test("AI comment drafting sends only score analysis and returns provider text", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  const fetcher = async (_url, request) => {
    const body = JSON.parse(request.body);
    assert.equal(body.store, false);
    assert.ok(!body.input.includes("student@example.com"));
    return { ok: true, json: async () => ({ output_text: "The student has made good progress and should continue practising fractions." }) };
  };
  const result = await draftSchoolReportComment({ average: 78, rows: [{ subject: "Mathematics", title: "Fractions", type: "test", adjustedScore: 78 }], email: "student@example.com" }, fetcher);
  assert.equal(result.generatedBy, "ai");
  assert.match(result.comment, /good progress/);
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
});

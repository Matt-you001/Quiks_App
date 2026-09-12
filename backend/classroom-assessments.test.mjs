import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "quiks-assessment-test-"));
process.env.CLASSROOM_STORE_PATH = join(directory, "classroom.json");
process.env.SCHOOL_STORE_PATH = join(directory, "school.json");
const store = await import("./classroom-store.mjs");

const teacher = { id: "teacher-1", name: "Teacher", role: "teacher", quiksId: "QX-T1" };
const student = { id: "student-1", name: "Student", role: "student", quiksId: "QX-S1" };

test("mixed assessment protects answers, marks objectives on the server and finalizes written marks", async () => {
  const classroom = await store.createClassroom(teacher, "Secure CBT", "teens");
  await store.acceptClassInviteLink(student, classroom.classCode, "teens");
  const activity = await store.createClassroomActivity({
    teacherProfile: teacher,
    classId: classroom.classId,
    type: "test",
    title: "Mixed test",
    subject: { id: "biology", name: "Biology" },
    assessmentFormat: "mixed",
    exitPolicy: "strict_submit",
    questions: [
      { id: "objective-1", type: "objective", prompt: "Which is a mammal?", options: ["Whale", "Shark"], answer: "Whale", explanation: "Whales breathe air.", points: 2 },
      { id: "written-1", type: "written", prompt: "Explain mammalian respiration.", options: [], answer: "", markingGuide: "Mentions lungs and gas exchange.", points: 3, maxWords: 120 },
    ],
    questionCount: 2,
  }, "teens");

  const studentView = await store.getActivityDetails(student, activity.activityId, "teens");
  assert.equal(studentView.questions[0].answer, "");
  assert.equal(studentView.questions[0].explanation, "");
  assert.equal(studentView.questions[1].markingGuide, undefined);

  await store.recordActivitySecurityEvent(student, activity.activityId, { eventType: "tab_hidden", occurredAt: Date.now() }, "teens");
  const submitted = await store.submitActivity(student, activity.activityId, {
    answers: [
      { questionId: "objective-1", answer: "Whale" },
      { questionId: "written-1", answer: "Mammals inhale air into lungs where gases are exchanged." },
    ],
    score: 100,
    timeTakenSeconds: 90,
  }, "teens");
  assert.equal(submitted.submission.gradingStatus, "awaiting_marking");
  assert.equal(submitted.submission.pointsAwarded, 2);
  assert.equal(submitted.submission.totalPoints, 5);
  assert.equal(submitted.submission.provisionalScore, 40);
  assert.equal(submitted.submission.securityEventCount, 1);

  const teacherView = await store.getActivityDetails(teacher, activity.activityId, "teens");
  assert.equal(teacherView.questions[0].answer, "Whale");
  assert.equal(teacherView.submissionDetails[0].responses[1].markingGuide, "Mentions lungs and gas exchange.");
  const graded = await store.gradeActivitySubmission(teacher, activity.activityId, submitted.submission.submissionId, {
    grades: [{ questionId: "written-1", awardedPoints: 2, feedback: "Good explanation." }],
    teacherFeedback: "Review the role of alveoli.",
  }, "teens");
  assert.equal(graded.submission.gradingStatus, "finalized");
  assert.equal(graded.submission.score, 80);
  assert.equal(graded.submission.teacherFeedback, "Review the role of alveoli.");
});


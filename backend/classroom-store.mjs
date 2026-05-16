import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = join(currentDirectory, "data");
const storePath = join(dataDirectory, "classroom-store.json");

const defaultStore = {
  profiles: {},
  classrooms: {},
  memberships: {},
  activities: {},
  submissions: {},
};

let storeCache = null;
let writeQueue = Promise.resolve();

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

async function ensureStore() {
  await mkdir(dataDirectory, { recursive: true });

  if (storeCache) {
    return storeCache;
  }

  try {
    const raw = await readFile(storePath, "utf8");
    storeCache = {
      ...defaultStore,
      ...JSON.parse(raw),
    };
  } catch {
    storeCache = cloneValue(defaultStore);
    await writeFile(storePath, JSON.stringify(storeCache, null, 2), "utf8");
  }

  return storeCache;
}

async function persistStore(store) {
  writeQueue = writeQueue.then(() => writeFile(storePath, JSON.stringify(store, null, 2), "utf8"));
  await writeQueue;
}

async function mutateStore(mutator) {
  const store = await ensureStore();
  const result = await mutator(store);
  await persistStore(store);
  return result;
}

function normalizeRole(role) {
  return role === "teacher" ? "teacher" : "student";
}

function normalizeProfileRecord(profile, appVariant) {
  return {
    profileId: profile.id,
    quiksId: String(profile.quiksId ?? "").trim().toUpperCase(),
    name: profile.name,
    role: normalizeRole(profile.role),
    appVariant,
    updatedAt: Date.now(),
  };
}

function generateClassCode(existingCodes) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let nextCode = "";

  do {
    nextCode = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (existingCodes.has(nextCode));

  return nextCode;
}

function getClassStatus(activity) {
  const now = Date.now();
  if (now < activity.startAt) {
    return "scheduled";
  }

  if (now > activity.endAt) {
    return "closed";
  }

  return "open";
}

function getMembershipsForClass(store, classId) {
  return Object.values(store.memberships).filter((membership) => membership.classId === classId);
}

function getActiveMembership(store, classId, profileId) {
  return Object.values(store.memberships).find(
    (membership) => membership.classId === classId && membership.profileId === profileId && membership.status === "active"
  );
}

function findMembershipByQuiksId(store, classId, quiksId) {
  return Object.values(store.memberships).find(
    (membership) => membership.classId === classId && membership.quiksId === quiksId
  );
}

function buildClassroomSummary(store, classroom) {
  const memberships = getMembershipsForClass(store, classroom.id);
  return {
    classId: classroom.id,
    classCode: classroom.classCode,
    className: classroom.className,
    teacherProfileId: classroom.teacherProfileId,
    teacherName: classroom.teacherName,
    createdAt: classroom.createdAt,
    memberCount: memberships.filter((membership) => membership.status === "active").length,
    pendingTeacherApprovals: memberships.filter((membership) => membership.status === "pending_teacher_approval"),
    pendingStudentApprovals: memberships.filter((membership) => membership.status === "pending_student_approval"),
  };
}

function ensureTeacherOwnsClass(classroom, teacherProfileId) {
  if (!classroom || classroom.teacherProfileId !== teacherProfileId) {
    throw new Error("Teacher is not allowed to manage this class.");
  }
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function getOrderedQuestionsForStudent(activity, profileId) {
  if (activity.questionOrderMode !== "shuffled") {
    return activity.questions;
  }

  return [...activity.questions]
    .map((question, index) => ({
      question,
      weight: hashString(`${activity.id}:${profileId}:${question.id}:${index}`),
    }))
    .sort((left, right) => left.weight - right.weight)
    .map((entry) => entry.question);
}

function getActivitySubmissions(store, activityId) {
  return Object.values(store.submissions).filter((submission) => submission.activityId === activityId);
}

function buildSubmissionSummary(submission) {
  return {
    profileId: submission.profileId,
    studentName: submission.studentName,
    quiksId: submission.quiksId,
    submittedAt: submission.submittedAt,
    score: submission.score,
    correctAnswers: submission.correctAnswers,
    totalQuestions: submission.totalQuestions,
    timeTakenSeconds: submission.timeTakenSeconds,
    status: "submitted",
  };
}

function buildAbsentSummaries(store, activity) {
  if (getClassStatus(activity) !== "closed") {
    return [];
  }

  const activeMembers = getMembershipsForClass(store, activity.classId).filter(
    (membership) => membership.status === "active" && membership.role === "student"
  );
  const submittedProfileIds = new Set(
    getActivitySubmissions(store, activity.id).map((submission) => submission.profileId)
  );

  return activeMembers
    .filter((member) => !submittedProfileIds.has(member.profileId))
    .map((member) => ({
      profileId: member.profileId,
      studentName: member.name,
      quiksId: member.quiksId,
      score: 0,
      correctAnswers: 0,
      totalQuestions: activity.questionCount,
      timeTakenSeconds: 0,
      status: "absent",
    }));
}

function buildActivitySummary(store, activity, profileId) {
  const submissions = getActivitySubmissions(store, activity.id);
  const ownSubmission = submissions.find((submission) => submission.profileId === profileId);

  return {
    activityId: activity.id,
    classId: activity.classId,
    className: store.classrooms[activity.classId]?.className ?? "Class",
    type: activity.type,
    title: activity.title,
    subjectId: activity.subjectId,
    subjectName: activity.subjectName,
    grade: activity.grade,
    level: activity.level,
    difficulty: activity.difficulty,
    focusMode: activity.focusMode,
    topicId: activity.topicId,
    topicLabel: activity.topicLabel,
    questionCount: activity.questionCount,
    durationMinutes: activity.durationMinutes,
    startAt: activity.startAt,
    endAt: activity.endAt,
    resultVisibility: activity.resultVisibility,
    questionOrderMode: activity.questionOrderMode,
    status: getClassStatus(activity),
    teacherProfileId: activity.teacherProfileId,
    teacherName: activity.teacherName,
    submissionCount: submissions.length,
    createdAt: activity.createdAt,
    submitted: Boolean(ownSubmission),
    score: ownSubmission?.score,
  };
}

export async function upsertClassroomProfile(profile, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[profile.id] = normalizeProfileRecord(profile, appVariant);
    return cloneValue(store.profiles[profile.id]);
  });
}

export async function createClassroom(teacherProfile, className, appVariant) {
  return mutateStore(async (store) => {
    if (normalizeRole(teacherProfile.role) !== "teacher") {
      throw new Error("Only teachers can create classes.");
    }

    store.profiles[teacherProfile.id] = normalizeProfileRecord(teacherProfile, appVariant);

    const classroomId = randomUUID();
    const existingCodes = new Set(Object.values(store.classrooms).map((classroom) => classroom.classCode));
    const classCode = generateClassCode(existingCodes);
    const createdAt = Date.now();

    store.classrooms[classroomId] = {
      id: classroomId,
      classCode,
      className: className.trim(),
      teacherProfileId: teacherProfile.id,
      teacherName: teacherProfile.name,
      appVariant,
      createdAt,
    };

    const membershipId = randomUUID();
    store.memberships[membershipId] = {
      membershipId,
      classId: classroomId,
      profileId: teacherProfile.id,
      quiksId: teacherProfile.quiksId,
      name: teacherProfile.name,
      role: "teacher",
      status: "active",
      requestedBy: "teacher",
      createdAt,
      joinedAt: createdAt,
    };

    return buildClassroomSummary(store, store.classrooms[classroomId]);
  });
}

export async function listClassroomsForProfile(profile, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[profile.id] = normalizeProfileRecord(profile, appVariant);

    const classes = Object.values(store.classrooms)
      .filter((classroom) => classroom.appVariant === appVariant)
      .filter((classroom) =>
        Object.values(store.memberships).some(
          (membership) => membership.classId === classroom.id && membership.profileId === profile.id
        )
      )
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((classroom) => buildClassroomSummary(store, classroom));

    return classes;
  });
}

export async function requestJoinClass(studentProfile, classCode, appVariant) {
  return mutateStore(async (store) => {
    if (normalizeRole(studentProfile.role) !== "student") {
      throw new Error("Only students can request to join a class.");
    }

    store.profiles[studentProfile.id] = normalizeProfileRecord(studentProfile, appVariant);
    const classroom = Object.values(store.classrooms).find(
      (entry) => entry.classCode === classCode.trim().toUpperCase() && entry.appVariant === appVariant
    );
    if (!classroom) {
      throw new Error("Class code not found.");
    }

    const existing = findMembershipByQuiksId(store, classroom.id, studentProfile.quiksId);
    if (existing) {
      throw new Error("This student already has a join request or membership in the class.");
    }

    const membershipId = randomUUID();
    store.memberships[membershipId] = {
      membershipId,
      classId: classroom.id,
      profileId: studentProfile.id,
      quiksId: studentProfile.quiksId,
      name: studentProfile.name,
      role: "student",
      status: "pending_teacher_approval",
      requestedBy: "student",
      createdAt: Date.now(),
    };

    return {
      classroom: buildClassroomSummary(store, classroom),
      message: `${studentProfile.name} requested to join ${classroom.className}.`,
    };
  });
}

export async function inviteStudentToClass(teacherProfile, classId, studentQuiksId, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[teacherProfile.id] = normalizeProfileRecord(teacherProfile, appVariant);
    const classroom = store.classrooms[classId];
    ensureTeacherOwnsClass(classroom, teacherProfile.id);

    const normalizedQuiksId = studentQuiksId.trim().toUpperCase();
    const student = Object.values(store.profiles).find(
      (profile) =>
        profile.quiksId === normalizedQuiksId &&
        profile.role === "student" &&
        profile.appVariant === classroom.appVariant
    );
    if (!student) {
      throw new Error("Student ID was not found in this app variant.");
    }

    const existing = findMembershipByQuiksId(store, classroom.id, normalizedQuiksId);
    if (existing) {
      throw new Error("This student already has an invite or membership in the class.");
    }

    const membershipId = randomUUID();
    store.memberships[membershipId] = {
      membershipId,
      classId,
      profileId: student.profileId,
      quiksId: normalizedQuiksId,
      name: student.name,
      role: "student",
      status: "pending_student_approval",
      requestedBy: "teacher",
      createdAt: Date.now(),
    };

    return {
      classroom: buildClassroomSummary(store, classroom),
      message: `Invite sent to ${student.name}.`,
    };
  });
}

export async function respondToMembershipRequest(actorProfile, classId, membershipId, decision, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[actorProfile.id] = normalizeProfileRecord(actorProfile, appVariant);
    const classroom = store.classrooms[classId];
    const membership = store.memberships[membershipId];

    if (!classroom || !membership || membership.classId !== classId) {
      throw new Error("Membership request not found.");
    }

    const isTeacherApproval =
      membership.status === "pending_teacher_approval" && classroom.teacherProfileId === actorProfile.id;
    const isStudentApproval =
      membership.status === "pending_student_approval" && membership.profileId === actorProfile.id;

    if (!isTeacherApproval && !isStudentApproval) {
      throw new Error("This profile cannot respond to that request.");
    }

    if (decision === "approve") {
      membership.status = "active";
      membership.joinedAt = Date.now();
      membership.updatedAt = Date.now();
      membership.name = store.profiles[membership.profileId]?.name ?? membership.name;
    } else {
      delete store.memberships[membershipId];
    }

    return {
      classroom: buildClassroomSummary(store, classroom),
      message:
        decision === "approve"
          ? `${membership.name} is now part of ${classroom.className}.`
          : `${membership.name}'s class request was declined.`,
    };
  });
}

export async function createClassroomActivity(payload, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[payload.teacherProfile.id] = normalizeProfileRecord(payload.teacherProfile, appVariant);
    const classroom = store.classrooms[payload.classId];
    ensureTeacherOwnsClass(classroom, payload.teacherProfile.id);

    const questionCount = Math.max(1, payload.questions.length);
    const durationMinutes = Math.max(5, Number(payload.durationMinutes ?? 30));
    const now = Date.now();
    const isTest = payload.type === "test";
    const startAt = isTest
      ? now + Math.max(0, Number(payload.startInMinutes ?? 0)) * 60 * 1000
      : now;
    const endAt = isTest
      ? startAt + durationMinutes * 60 * 1000
      : startAt + Math.max(1, Number(payload.availabilityHours ?? 24)) * 60 * 60 * 1000;
    const activityId = randomUUID();

    store.activities[activityId] = {
      id: activityId,
      classId: payload.classId,
      type: isTest ? "test" : "assignment",
      title: payload.title.trim(),
      subjectId: payload.subject.id,
      subjectName: payload.subject.name,
      grade: payload.grade,
      level: payload.level,
      difficulty: payload.difficulty,
      focusMode: payload.focusMode ?? "general",
      topicId: payload.topicId,
      topicLabel: payload.topicLabel,
      durationMinutes,
      startAt,
      endAt,
      resultVisibility: payload.resultVisibility ?? "private",
      questionOrderMode: payload.questionOrderMode ?? "same",
      questions: payload.questions,
      questionCount,
      teacherProfileId: payload.teacherProfile.id,
      teacherName: payload.teacherProfile.name,
      createdAt: Date.now(),
    };

    return buildActivitySummary(store, store.activities[activityId], payload.teacherProfile.id);
  });
}

export async function listActivitiesForProfile(profile, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[profile.id] = normalizeProfileRecord(profile, appVariant);

    const classIds = new Set(
      Object.values(store.memberships)
        .filter((membership) => membership.profileId === profile.id && membership.status === "active")
        .map((membership) => membership.classId)
    );

    return Object.values(store.activities)
      .filter((activity) => classIds.has(activity.classId))
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((activity) => buildActivitySummary(store, activity, profile.id));
  });
}

export async function getActivityDetails(profile, activityId, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[profile.id] = normalizeProfileRecord(profile, appVariant);
    const activity = store.activities[activityId];
    if (!activity) {
      throw new Error("Activity not found.");
    }

    const classroom = store.classrooms[activity.classId];
    if (!classroom) {
      throw new Error("Class not found for this activity.");
    }

    const membership = getActiveMembership(store, activity.classId, profile.id);
    const isTeacher = classroom.teacherProfileId === profile.id;
    if (!membership && !isTeacher) {
      throw new Error("This profile is not part of the class.");
    }

    const questions = isTeacher ? activity.questions : getOrderedQuestionsForStudent(activity, profile.id);
    const submissions = getActivitySubmissions(store, activity.id).map(buildSubmissionSummary);
    const visibleSubmissions = isTeacher
      ? [...submissions, ...buildAbsentSummaries(store, activity)]
      : activity.resultVisibility === "public"
        ? [...submissions, ...buildAbsentSummaries(store, activity)]
        : submissions.filter((submission) => submission.profileId === profile.id);

    return {
      activity: buildActivitySummary(store, activity, profile.id),
      questions,
      className: classroom.className,
      teacherName: classroom.teacherName,
      submissions: visibleSubmissions,
    };
  });
}

export async function submitActivity(profile, activityId, submissionPayload, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[profile.id] = normalizeProfileRecord(profile, appVariant);
    const activity = store.activities[activityId];
    if (!activity) {
      throw new Error("Activity not found.");
    }

    if (getClassStatus(activity) === "closed") {
      throw new Error(`This ${activity.type} is already closed.`);
    }

    if (getClassStatus(activity) === "scheduled") {
      throw new Error(`This ${activity.type} has not started yet.`);
    }

    const membership = getActiveMembership(store, activity.classId, profile.id);
    if (!membership || membership.role !== "student") {
      throw new Error(`Only active students can submit this ${activity.type}.`);
    }

    const existing = getActivitySubmissions(store, activityId).find((submission) => submission.profileId === profile.id);
    if (existing) {
      throw new Error(`This ${activity.type} has already been submitted.`);
    }

    const submissionId = randomUUID();
    store.submissions[submissionId] = {
      submissionId,
      activityId,
      profileId: profile.id,
      studentName: profile.name,
      quiksId: profile.quiksId,
      score: submissionPayload.score,
      correctAnswers: submissionPayload.correctAnswers,
      totalQuestions: submissionPayload.totalQuestions,
      timeTakenSeconds: submissionPayload.timeTakenSeconds,
      submittedAt: Date.now(),
    };

    return {
      activity: buildActivitySummary(store, activity, profile.id),
      submission: buildSubmissionSummary(store.submissions[submissionId]),
    };
  });
}

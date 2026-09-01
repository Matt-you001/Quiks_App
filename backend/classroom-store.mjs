import { readFileSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const configuredStorePath = String(process.env.CLASSROOM_STORE_PATH ?? "").trim();
const storePath = configuredStorePath
  ? isAbsolute(configuredStorePath)
    ? configuredStorePath
    : resolve(currentDirectory, configuredStorePath)
  : join(currentDirectory, "data", "classroom-store.json");
const dataDirectory = dirname(storePath);
const temporaryStorePath = `${storePath}.tmp`;

const defaultStore = {
  profiles: {},
  classrooms: {},
  memberships: {},
  activities: {},
  submissions: {},
  lessonNotes: {},
  chatMessages: {},
};

let storeCache = null;
let writeQueue = Promise.resolve();

function persistentMountDetected() {
  if (process.platform !== "linux" || !storePath.startsWith("/var/data/")) return null;
  try {
    return readFileSync("/proc/self/mountinfo", "utf8")
      .split("\n")
      .some((line) => line.split(" ")[4] === "/var/data");
  } catch {
    return null;
  }
}

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
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    await writeFile(temporaryStorePath, JSON.stringify(store, null, 2), "utf8");
    await rename(temporaryStorePath, storePath);
  });
  await writeQueue;
}

export function getClassroomStoreDiagnostics() {
  return {
    configured: Boolean(configuredStorePath),
    persistentPathExpected: storePath.startsWith("/var/data/"),
    persistentMountDetected: persistentMountDetected(),
  };
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

function getSortedMembershipsForClass(store, classId) {
  return getMembershipsForClass(store, classId).sort((left, right) => {
    const statusWeight = {
      active: 0,
      pending_teacher_approval: 1,
      pending_student_approval: 2,
    };
    const leftWeight = statusWeight[left.status] ?? 99;
    const rightWeight = statusWeight[right.status] ?? 99;
    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }
    return left.name.localeCompare(right.name);
  });
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

function buildClassroomDetails(store, classroom) {
  return {
    classroom: buildClassroomSummary(store, classroom),
    members: getSortedMembershipsForClass(store, classroom.id),
  };
}

function ensureTeacherOwnsClass(classroom, teacherProfileId) {
  if (!classroom || classroom.teacherProfileId !== teacherProfileId) {
    throw new Error("Teacher is not allowed to manage this class.");
  }
}

function ensureProfileCanAccessClass(store, classroom, profileId) {
  if (!classroom) throw new Error("Class not found.");
  if (classroom.teacherProfileId === profileId || getActiveMembership(store, classroom.id, profileId)) return;
  throw new Error("This profile is not an active member of the class.");
}

function buildLessonNoteSummary(note) {
  const { attachmentDataBase64: _attachmentDataBase64, ...summary } = note;
  return summary;
}

function getSortedLessonNotes(store, classId) {
  return Object.values(store.lessonNotes)
    .filter((note) => note.classId === classId)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map(buildLessonNoteSummary);
}

function getSortedChatMessages(store, classId) {
  return Object.values(store.chatMessages)
    .filter((message) => message.classId === classId)
    .sort((left, right) => left.createdAt - right.createdAt)
    .slice(-300);
}

function validateLessonNoteAttachment(attachment) {
  if (!attachment?.dataBase64) return;
  const allowedTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ]);
  if (!allowedTypes.has(String(attachment.mimeType ?? ""))) throw new Error("Upload a PDF, Word, or text lesson-note file.");
  if (attachment.dataBase64.length > 7_500_000) throw new Error("The lesson-note attachment must be 5 MB or smaller.");
}

function cleanStoredLessonNoteText(value) {
  return String(value ?? "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function getOrderedQuestionsForStudent(activity, profileId) {
  const questions = activity.questionOrderMode !== "shuffled" ? [...activity.questions] : [...activity.questions]
    .map((question, index) => ({
      question,
      weight: hashString(`${activity.id}:${profileId}:${question.id}:${index}`),
    }))
    .sort((left, right) => left.weight - right.weight)
    .map((entry) => entry.question);
  if (!activity.randomizeOptions) return questions;
  return questions.map((question) => {
    const entries = question.options.map((option, index) => ({ option, index, weight: hashString(`${activity.id}:${profileId}:${question.id}:option:${index}`) }))
      .sort((left, right) => left.weight - right.weight);
    return { ...question, options: entries.map((entry) => entry.option), answerIndex: entries.findIndex((entry) => entry.index === question.answerIndex) };
  });
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

function buildAbsentSummaryForProfile(store, activity, profileId) {
  return buildAbsentSummaries(store, activity).find((entry) => entry.profileId === profileId) ?? null;
}

function buildActivitySummary(store, activity, profileId) {
  const submissions = getActivitySubmissions(store, activity.id);
  const ownSubmissions = submissions.filter((submission) => submission.profileId === profileId);
  const ownSubmission = [...ownSubmissions].sort((left, right) => right.submittedAt - left.submittedAt)[0];
  const attemptsAllowed = Math.max(1, Number(activity.attemptsAllowed ?? 1));

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
    topicIds: Array.isArray(activity.topicIds)
      ? activity.topicIds
      : activity.topicId
        ? [activity.topicId]
        : [],
    topicLabels: Array.isArray(activity.topicLabels)
      ? activity.topicLabels
      : activity.topicLabel
        ? [activity.topicLabel]
        : [],
    customTopicLabel: activity.customTopicLabel,
    customTopicLabels: Array.isArray(activity.customTopicLabels)
      ? activity.customTopicLabels
      : activity.customTopicLabel
        ? [activity.customTopicLabel]
        : [],
    usesCustomSubject: Boolean(activity.usesCustomSubject),
    usesCustomTopic: Boolean(activity.usesCustomTopic),
    questionCount: activity.questionCount,
    durationMinutes: activity.durationMinutes,
    startAt: activity.startAt,
    endAt: activity.endAt,
    resultVisibility: activity.resultVisibility,
    questionOrderMode: activity.questionOrderMode,
    assessmentMode: activity.assessmentMode ?? "standard",
    attemptsAllowed,
    navigationMode: activity.navigationMode ?? "free",
    randomizeOptions: Boolean(activity.randomizeOptions),
    autoSubmit: activity.autoSubmit !== false,
    passMark: activity.passMark ?? 50,
    instructions: activity.instructions,
    accessCodeRequired: Boolean(activity.accessCode),
    status: getClassStatus(activity),
    teacherProfileId: activity.teacherProfileId,
    teacherName: activity.teacherName,
    submissionCount: submissions.length,
    createdAt: activity.createdAt,
    submitted: ownSubmissions.length >= attemptsAllowed,
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

export async function getClassroomDetails(profile, classId, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[profile.id] = normalizeProfileRecord(profile, appVariant);
    const classroom = store.classrooms[classId];
    if (!classroom) {
      throw new Error("Class not found.");
    }

    const membership = getMembershipsForClass(store, classId).find((entry) => entry.profileId === profile.id);
    const isTeacher = classroom.teacherProfileId === profile.id;
    if (!membership && !isTeacher) {
      throw new Error("This profile is not part of the class.");
    }

    return buildClassroomDetails(store, classroom);
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

export async function acceptClassInviteLink(studentProfile, classCode, appVariant) {
  return mutateStore(async (store) => {
    if (normalizeRole(studentProfile.role) !== "student") {
      throw new Error("Only student profiles can accept a class invitation.");
    }

    store.profiles[studentProfile.id] = normalizeProfileRecord(studentProfile, appVariant);
    const classroom = Object.values(store.classrooms).find(
      (entry) => entry.classCode === classCode.trim().toUpperCase() && entry.appVariant === appVariant
    );
    if (!classroom) {
      throw new Error("This class invitation is no longer valid.");
    }

    const existing = findMembershipByQuiksId(store, classroom.id, studentProfile.quiksId);
    if (existing?.status === "active") {
      return {
        classroom: buildClassroomSummary(store, classroom),
        message: `${studentProfile.name} is already part of ${classroom.className}.`,
      };
    }

    const now = Date.now();
    const membershipId = existing?.membershipId ?? randomUUID();
    store.memberships[membershipId] = {
      ...(existing ?? {}),
      membershipId,
      classId: classroom.id,
      profileId: studentProfile.id,
      quiksId: studentProfile.quiksId,
      name: studentProfile.name,
      role: "student",
      status: "active",
      requestedBy: "teacher_invite_link",
      createdAt: existing?.createdAt ?? now,
      joinedAt: now,
      updatedAt: now,
    };

    return {
      classroom: buildClassroomSummary(store, classroom),
      message: `${studentProfile.name} is now part of ${classroom.className}.`,
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

export async function updateClassroomName(teacherProfile, classId, className, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[teacherProfile.id] = normalizeProfileRecord(teacherProfile, appVariant);
    const classroom = store.classrooms[classId];
    ensureTeacherOwnsClass(classroom, teacherProfile.id);

    classroom.className = className.trim();

    return {
      classroom: buildClassroomSummary(store, classroom),
      message: "Class name updated.",
    };
  });
}

export async function deleteClassroom(teacherProfile, classId, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[teacherProfile.id] = normalizeProfileRecord(teacherProfile, appVariant);
    const classroom = store.classrooms[classId];
    ensureTeacherOwnsClass(classroom, teacherProfile.id);
    const activityIds = new Set(Object.values(store.activities).filter((item) => item.classId === classId).map((item) => item.id));
    Object.keys(store.memberships).forEach((id) => { if (store.memberships[id].classId === classId) delete store.memberships[id]; });
    Object.keys(store.activities).forEach((id) => { if (activityIds.has(id)) delete store.activities[id]; });
    Object.keys(store.submissions).forEach((id) => { if (activityIds.has(store.submissions[id].activityId)) delete store.submissions[id]; });
    Object.keys(store.lessonNotes).forEach((id) => { if (store.lessonNotes[id].classId === classId) delete store.lessonNotes[id]; });
    Object.keys(store.chatMessages).forEach((id) => { if (store.chatMessages[id].classId === classId) delete store.chatMessages[id]; });
    delete store.classrooms[classId];
    return { message: `${classroom.className} was deleted.` };
  });
}

export async function removeClassroomMember(teacherProfile, classId, membershipId, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[teacherProfile.id] = normalizeProfileRecord(teacherProfile, appVariant);
    const classroom = store.classrooms[classId];
    ensureTeacherOwnsClass(classroom, teacherProfile.id);
    const membership = store.memberships[membershipId];

    if (!membership || membership.classId !== classId) {
      throw new Error("Member record not found.");
    }

    if (membership.profileId === teacherProfile.id || membership.role === "teacher") {
      throw new Error("The class teacher cannot be removed from the class.");
    }

    delete store.memberships[membershipId];

    return {
      classroom: buildClassroomSummary(store, classroom),
      message: `${membership.name} was removed from the class.`,
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

    const questionCount = Math.max(1, Number(payload.questionCount ?? payload.questions.length));
    const durationMinutes = Math.max(5, Number(payload.durationMinutes ?? 30));
    const now = Date.now();
    const isTest = payload.type === "test";
    const explicitStartAt = Number(payload.startAt ?? 0);
    const explicitEndAt = Number(payload.endAt ?? 0);
    const startAt = Number.isFinite(explicitStartAt) && explicitStartAt > now
      ? explicitStartAt
      : isTest
        ? now + Math.max(0, Number(payload.startInMinutes ?? 0)) * 60 * 1000
        : now;
    const endAt = Number.isFinite(explicitEndAt) && explicitEndAt > startAt
      ? explicitEndAt
      : isTest
        ? startAt + durationMinutes * 60 * 1000
        : startAt + Math.max(1, Number(payload.availabilityHours ?? 24)) * 60 * 60 * 1000;
    const activityId = randomUUID();

    const topicIds = Array.isArray(payload.topicIds)
      ? payload.topicIds.filter((topicId) => typeof topicId === "string" && topicId.trim())
      : payload.topicId
        ? [payload.topicId]
        : [];
    const topicLabels = Array.isArray(payload.topicLabels)
      ? payload.topicLabels.filter((topicLabel) => typeof topicLabel === "string" && topicLabel.trim())
      : payload.topicLabel
        ? [payload.topicLabel]
        : [];

    store.activities[activityId] = {
      id: activityId,
      classId: payload.classId,
      type: isTest ? "test" : "assignment",
      title: payload.title.trim(),
      subjectId: payload.subject.id,
      subjectName: payload.subject.name,
      usesCustomSubject: Boolean(payload.usesCustomSubject),
      grade: payload.grade,
      level: payload.level,
      difficulty: payload.difficulty,
      focusMode: payload.focusMode ?? "general",
      topicId: topicIds[0],
      topicLabel: topicLabels.join(", ") || undefined,
      topicIds,
      topicLabels,
      customTopicLabel: typeof payload.customTopicLabel === "string" ? payload.customTopicLabel.trim() : undefined,
      customTopicLabels: Array.isArray(payload.customTopicLabels)
        ? payload.customTopicLabels.filter((topicLabel) => typeof topicLabel === "string" && topicLabel.trim())
        : typeof payload.customTopicLabel === "string" && payload.customTopicLabel.trim()
          ? [payload.customTopicLabel.trim()]
          : [],
      usesCustomTopic: Boolean(payload.usesCustomTopic),
      durationMinutes,
      startAt,
      endAt,
      resultVisibility: payload.resultVisibility ?? "private",
      questionOrderMode: payload.questionOrderMode ?? "same",
      assessmentMode: isTest && payload.assessmentMode === "cbt" ? "cbt" : "standard",
      attemptsAllowed: Math.max(1, Math.min(10, Math.floor(Number(payload.attemptsAllowed ?? 1)))),
      navigationMode: payload.navigationMode === "linear" ? "linear" : "free",
      randomizeOptions: Boolean(payload.randomizeOptions),
      autoSubmit: payload.autoSubmit !== false,
      passMark: Math.max(0, Math.min(100, Number(payload.passMark ?? 50))),
      instructions: String(payload.instructions ?? "").trim().slice(0, 2000) || undefined,
      accessCode: isTest ? String(payload.accessCode ?? "").trim().slice(0, 32) || undefined : undefined,
      questions: payload.questions,
      questionCount,
      teacherProfileId: payload.teacherProfile.id,
      teacherName: payload.teacherProfile.name,
      createdAt: Date.now(),
    };

    return buildActivitySummary(store, store.activities[activityId], payload.teacherProfile.id);
  });
}

export async function deleteClassroomActivity(teacherProfile, activityId, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[teacherProfile.id] = normalizeProfileRecord(teacherProfile, appVariant);
    const activity = store.activities[activityId];
    if (!activity) throw new Error("Activity not found.");
    ensureTeacherOwnsClass(store.classrooms[activity.classId], teacherProfile.id);
    Object.keys(store.submissions).forEach((id) => { if (store.submissions[id].activityId === activityId) delete store.submissions[id]; });
    delete store.activities[activityId];
    return { message: `${activity.title} was deleted.` };
  });
}

export async function createLessonNote(payload, appVariant) {
  return mutateStore(async (store) => {
    const { teacherProfile } = payload;
    store.profiles[teacherProfile.id] = normalizeProfileRecord(teacherProfile, appVariant);
    const classroom = store.classrooms[payload.classId];
    ensureTeacherOwnsClass(classroom, teacherProfile.id);
    const title = String(payload.title || [payload.subject, payload.topic].filter(Boolean).join(": ") || "Lesson Note").trim();
    const content = cleanStoredLessonNoteText(payload.content);
    if (!title || !content) throw new Error("Lesson-note title and content are required.");
    if (content.length > 50000) throw new Error("Lesson-note content can contain up to 50,000 characters.");
    const attachment = payload.attachment;
    validateLessonNoteAttachment(attachment);
    const noteId = randomUUID();
    const now = Date.now();
    store.lessonNotes[noteId] = {
      noteId,
      classId: payload.classId,
      title,
      subject: String(payload.subject ?? "").trim(),
      topic: String(payload.topic ?? "").trim(),
      originalContent: content,
      content,
      illustrations: Array.isArray(payload.illustrations) ? payload.illustrations : [],
      refinementLevel: payload.refinementLevel ?? "none",
      status: payload.status === "published" ? "published" : "draft",
      studentAccess: payload.studentAccess === "read_only" ? "read_only" : "allow_download",
      teacherProfileId: teacherProfile.id,
      teacherName: teacherProfile.name,
      attachmentName: attachment?.name ? String(attachment.name) : undefined,
      attachmentMimeType: attachment?.mimeType ? String(attachment.mimeType) : undefined,
      attachmentSize: Number(attachment?.size ?? 0) || undefined,
      attachmentDataBase64: attachment?.dataBase64 ? String(attachment.dataBase64) : undefined,
      createdAt: now,
      updatedAt: now,
      publishedAt: payload.status === "published" ? now : undefined,
    };
    return buildLessonNoteSummary(store.lessonNotes[noteId]);
  });
}

export async function updateLessonNote(payload, appVariant) {
  return mutateStore(async (store) => {
    const { teacherProfile } = payload;
    store.profiles[teacherProfile.id] = normalizeProfileRecord(teacherProfile, appVariant);
    const note = store.lessonNotes[payload.noteId];
    if (!note) throw new Error("Lesson note not found.");
    ensureTeacherOwnsClass(store.classrooms[note.classId], teacherProfile.id);
    if (typeof payload.title === "string") note.title = payload.title.trim();
    if (typeof payload.subject === "string") note.subject = payload.subject.trim();
    if (typeof payload.topic === "string") note.topic = payload.topic.trim();
    if (typeof payload.content === "string") note.content = cleanStoredLessonNoteText(payload.content);
    if (Array.isArray(payload.illustrations)) note.illustrations = payload.illustrations;
    if (payload.attachment?.dataBase64) {
      validateLessonNoteAttachment(payload.attachment);
      note.attachmentName = String(payload.attachment.name ?? "lesson-note");
      note.attachmentMimeType = String(payload.attachment.mimeType ?? "application/octet-stream");
      note.attachmentSize = Number(payload.attachment.size ?? 0) || undefined;
      note.attachmentDataBase64 = String(payload.attachment.dataBase64);
    }
    if (["none", "minimal", "rich", "deep"].includes(payload.refinementLevel)) note.refinementLevel = payload.refinementLevel;
    if (payload.status === "draft" || payload.status === "published") {
      note.status = payload.status;
      if (payload.status === "published" && !note.publishedAt) note.publishedAt = Date.now();
    }
    if (payload.studentAccess === "read_only" || payload.studentAccess === "allow_download") note.studentAccess = payload.studentAccess;
    note.updatedAt = Date.now();
    if (!note.title || !note.content) throw new Error("Lesson-note title and content are required.");
    if (note.content.length > 50000) throw new Error("Lesson-note content can contain up to 50,000 characters.");
    return buildLessonNoteSummary(note);
  });
}

export async function listLessonNotes(profile, classId, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[profile.id] = normalizeProfileRecord(profile, appVariant);
    const classroom = store.classrooms[classId];
    ensureProfileCanAccessClass(store, classroom, profile.id);
    const isTeacher = classroom.teacherProfileId === profile.id;
    return getSortedLessonNotes(store, classId).filter((note) => isTeacher || note.status === "published");
  });
}

export async function getLessonNoteForTeacher(teacherProfile, noteId, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[teacherProfile.id] = normalizeProfileRecord(teacherProfile, appVariant);
    const note = store.lessonNotes[noteId];
    if (!note) throw new Error("Lesson note not found.");
    ensureTeacherOwnsClass(store.classrooms[note.classId], teacherProfile.id);
    return buildLessonNoteSummary(note);
  });
}

export async function getLessonNoteAttachment(profile, noteId, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[profile.id] = normalizeProfileRecord(profile, appVariant);
    const note = store.lessonNotes[noteId];
    if (!note) throw new Error("Lesson note not found.");
    const classroom = store.classrooms[note.classId];
    ensureProfileCanAccessClass(store, classroom, profile.id);
    if (classroom.teacherProfileId !== profile.id && note.status !== "published") throw new Error("This lesson note is not available yet.");
    if (classroom.teacherProfileId !== profile.id && note.studentAccess === "read_only") throw new Error("The teacher made this lesson note read-only.");
    if (!note.attachmentDataBase64) throw new Error("This lesson note has no attachment.");
    return { name: note.attachmentName ?? "lesson-note", mimeType: note.attachmentMimeType ?? "application/octet-stream", dataBase64: note.attachmentDataBase64 };
  });
}

export async function deleteLessonNote(teacherProfile, noteId, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[teacherProfile.id] = normalizeProfileRecord(teacherProfile, appVariant);
    const note = store.lessonNotes[noteId];
    if (!note) throw new Error("Lesson note not found.");
    ensureTeacherOwnsClass(store.classrooms[note.classId], teacherProfile.id);
    delete store.lessonNotes[noteId];
    return { message: `${note.title} was deleted.` };
  });
}

export async function listClassChatMessages(profile, classId, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[profile.id] = normalizeProfileRecord(profile, appVariant);
    ensureProfileCanAccessClass(store, store.classrooms[classId], profile.id);
    return getSortedChatMessages(store, classId);
  });
}

export async function sendClassChatMessage(profile, classId, text, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[profile.id] = normalizeProfileRecord(profile, appVariant);
    ensureProfileCanAccessClass(store, store.classrooms[classId], profile.id);
    const messageText = String(text ?? "").trim();
    if (!messageText) throw new Error("Type a message before sending.");
    if (messageText.length > 2000) throw new Error("Messages can contain up to 2,000 characters.");
    const messageId = randomUUID();
    store.chatMessages[messageId] = { messageId, classId, senderProfileId: profile.id, senderName: profile.name, senderRole: normalizeRole(profile.role), text: messageText, createdAt: Date.now() };
    const excessMessages = Object.values(store.chatMessages)
      .filter((message) => message.classId === classId)
      .sort((left, right) => left.createdAt - right.createdAt)
      .slice(0, -500);
    excessMessages.forEach((message) => delete store.chatMessages[message.messageId]);
    return cloneValue(store.chatMessages[messageId]);
  });
}

export async function duplicateActivity(teacherProfile, activityId, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[teacherProfile.id] = normalizeProfileRecord(teacherProfile, appVariant);
    const sourceActivity = store.activities[activityId];
    if (!sourceActivity) {
      throw new Error("Activity not found.");
    }

    const classroom = store.classrooms[sourceActivity.classId];
    ensureTeacherOwnsClass(classroom, teacherProfile.id);

    const nextActivityId = randomUUID();
    const now = Date.now();
    const startAt = sourceActivity.type === "test" ? now + 5 * 60 * 1000 : now;
    const endAt =
      sourceActivity.type === "test"
        ? startAt + sourceActivity.durationMinutes * 60 * 1000
        : startAt + 24 * 60 * 60 * 1000;

    store.activities[nextActivityId] = {
      ...cloneValue(sourceActivity),
      id: nextActivityId,
      title: `${sourceActivity.title} Copy`,
      startAt,
      endAt,
      createdAt: now,
    };

    return buildActivitySummary(store, store.activities[nextActivityId], teacherProfile.id);
  });
}

export async function updateClassroomActivity(payload, appVariant) {
  return mutateStore(async (store) => {
    store.profiles[payload.teacherProfile.id] = normalizeProfileRecord(payload.teacherProfile, appVariant);
    const classroom = store.classrooms[payload.classId];
    ensureTeacherOwnsClass(classroom, payload.teacherProfile.id);

    const activity = store.activities[payload.activityId];
    if (!activity || activity.classId !== payload.classId) {
      throw new Error("Activity not found.");
    }

    if (activity.type === "test" && activity.startAt - Date.now() <= 5 * 60 * 1000) {
      throw new Error("Tests can no longer be edited within 5 minutes of the start time.");
    }

    const questionCount = Math.max(1, Number(payload.questionCount ?? payload.questions.length));
    const durationMinutes = Math.max(1, Number(payload.durationMinutes ?? 1));
    const explicitStartAt = Number(payload.startAt ?? 0);
    const explicitEndAt = Number(payload.endAt ?? 0);
    const startAt = Number.isFinite(explicitStartAt) && explicitStartAt > 0 ? explicitStartAt : activity.startAt;
    const endAt = Number.isFinite(explicitEndAt) && explicitEndAt > startAt ? explicitEndAt : activity.endAt;

    activity.type = payload.type === "test" ? "test" : "assignment";
    activity.title = payload.title.trim();
    activity.subjectId = payload.subject.id;
    activity.subjectName = payload.subject.name;
    activity.usesCustomSubject = Boolean(payload.usesCustomSubject);
    activity.grade = payload.grade;
    activity.level = payload.level;
    activity.difficulty = payload.difficulty;
    activity.focusMode = payload.focusMode ?? "general";
    const topicIds = Array.isArray(payload.topicIds)
      ? payload.topicIds.filter((topicId) => typeof topicId === "string" && topicId.trim())
      : payload.topicId
        ? [payload.topicId]
        : [];
    const topicLabels = Array.isArray(payload.topicLabels)
      ? payload.topicLabels.filter((topicLabel) => typeof topicLabel === "string" && topicLabel.trim())
      : payload.topicLabel
        ? [payload.topicLabel]
        : [];
    activity.topicId = topicIds[0];
    activity.topicLabel = topicLabels.join(", ") || undefined;
    activity.topicIds = topicIds;
    activity.topicLabels = topicLabels;
    activity.customTopicLabel = typeof payload.customTopicLabel === "string" ? payload.customTopicLabel.trim() : undefined;
    activity.customTopicLabels = Array.isArray(payload.customTopicLabels)
      ? payload.customTopicLabels.filter((topicLabel) => typeof topicLabel === "string" && topicLabel.trim())
      : typeof payload.customTopicLabel === "string" && payload.customTopicLabel.trim()
        ? [payload.customTopicLabel.trim()]
        : [];
    activity.usesCustomTopic = Boolean(payload.usesCustomTopic);
    activity.durationMinutes = durationMinutes;
    activity.startAt = startAt;
    activity.endAt = endAt;
    activity.resultVisibility = payload.resultVisibility ?? "private";
    activity.questionOrderMode = payload.questionOrderMode ?? "same";
    activity.assessmentMode = activity.type === "test" && payload.assessmentMode === "cbt" ? "cbt" : "standard";
    activity.attemptsAllowed = Math.max(1, Math.min(10, Math.floor(Number(payload.attemptsAllowed ?? 1))));
    activity.navigationMode = payload.navigationMode === "linear" ? "linear" : "free";
    activity.randomizeOptions = Boolean(payload.randomizeOptions);
    activity.autoSubmit = payload.autoSubmit !== false;
    activity.passMark = Math.max(0, Math.min(100, Number(payload.passMark ?? 50)));
    activity.instructions = String(payload.instructions ?? "").trim().slice(0, 2000) || undefined;
    activity.accessCode = activity.type === "test" ? String(payload.accessCode ?? "").trim().slice(0, 32) || undefined : undefined;
    activity.questions = payload.questions;
    activity.questionCount = questionCount;

    Object.keys(store.submissions).forEach((submissionId) => {
      if (store.submissions[submissionId].activityId === activity.id) {
        delete store.submissions[submissionId];
      }
    });

    return buildActivitySummary(store, activity, payload.teacherProfile.id);
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

export async function getActivityDetails(profile, activityId, appVariant, accessCode) {
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
    if (!isTeacher && activity.accessCode && String(accessCode ?? "").trim() !== activity.accessCode) {
      throw new Error("Enter the correct CBT access code to open this test.");
    }

    const questions = isTeacher ? activity.questions : getOrderedQuestionsForStudent(activity, profile.id);
    const submissions = getActivitySubmissions(store, activity.id).map(buildSubmissionSummary);
    const absentSummaries = buildAbsentSummaries(store, activity);
    const ownAbsentSummary = buildAbsentSummaryForProfile(store, activity, profile.id);
    const visibleSubmissions = isTeacher
      ? [...submissions, ...absentSummaries]
      : activity.resultVisibility === "public"
        ? [...submissions, ...absentSummaries]
        : ownAbsentSummary
          ? [...submissions.filter((submission) => submission.profileId === profile.id), ownAbsentSummary]
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

    const attempts = getActivitySubmissions(store, activityId).filter((submission) => submission.profileId === profile.id);
    const attemptsAllowed = Math.max(1, Number(activity.attemptsAllowed ?? 1));
    if (attempts.length >= attemptsAllowed) {
      throw new Error(`All ${attemptsAllowed} permitted attempt${attemptsAllowed === 1 ? "" : "s"} have been used.`);
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
      attemptNumber: attempts.length + 1,
    };

    return {
      activity: buildActivitySummary(store, activity, profile.id),
      submission: buildSubmissionSummary(store.submissions[submissionId]),
    };
  });
}

import http from "node:http";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import {
  createClassroomActivity,
  createClassroom,
  duplicateActivity,
  getActivityDetails,
  getClassroomDetails,
  inviteStudentToClass,
  listActivitiesForProfile,
  listClassroomsForProfile,
  removeClassroomMember,
  requestJoinClass,
  respondToMembershipRequest,
  submitActivity,
  updateClassroomActivity,
  updateClassroomName,
  upsertClassroomProfile,
} from "./classroom-store.mjs";

const port = Number(process.env.PORT || 8787);
const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const competitionWaiters = new Map();
const competitionWaitersById = new Map();
const competitionWaiterByPlayer = new Map();
const competitionMatches = new Map();
const competitionMatchByPlayer = new Map();
const competitionChallenges = new Map();
const competitionRematches = new Map();

function isSameUtcDay(leftTimestamp, rightTimestamp) {
  const left = new Date(leftTimestamp);
  const right = new Date(rightTimestamp);
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

function describeDifficultyRigour(body) {
  if (body.difficulty === "Beginner") {
    return [
      "Beginner does not mean childish or below the learner's academic band.",
      "It means accessible entry-level questions for this exact variant, grade, and level.",
      "Use foundational concepts, but keep the content firmly inside the correct school or university stage.",
    ].join(" ");
  }

  if (body.difficulty === "Intermediate") {
    return [
      "Intermediate should require solid understanding, correct terminology, and multi-step reasoning typical of this class band.",
      "Questions should feel like normal assessments for this learner stage, not revision for younger students.",
    ].join(" ");
  }

  if (body.difficulty === "Advanced") {
    return [
      "Advanced should be demanding for this exact learner stage.",
      "Use deeper application, interpretation, and less obvious answer choices.",
      "The questions should feel like stronger school or university assessments, not introductory drills.",
    ].join(" ");
  }

  return [
    "Expert should represent the highest challenge inside this learner band.",
    "Use rigorous reasoning, strong distractors, and higher-order application while staying inside the official subject or course scope for this variant, grade, and level.",
    "Do not simplify the content into lower-stage material.",
  ].join(" ");
}

function describeAcademicStage(body) {
  const focusLabel =
    body.focusMode === "topic"
      ? body.topicLabel ?? body.topicId ?? "selected topic"
      : `general ${body.subject?.name ?? "course"} coverage`;

  if (body.appVariant === "children") {
    return [
      `Treat ${body.grade ?? "the learner's grade"} as a real primary-school class level for ages roughly 5 to 12.`,
      `Level ${body.level ?? 1} means progression depth within that class, not a random difficulty spike.`,
      "Use short, clear wording, concrete school examples, and mostly single-skill or simple two-step reasoning.",
      "Do not produce secondary-school or tertiary-style abstraction unless the stated class level supports it.",
      `The questions should feel like authentic primary-school ${String(body.subject?.name ?? "subject").toLowerCase()} practice focused on ${String(focusLabel).toLowerCase()}.`,
    ].join(" ");
  }

  if (body.appVariant === "teens") {
    return [
      `Treat ${body.grade ?? "the learner's grade"} as a real secondary-school or college class level for ages roughly 11 to 20.`,
      `Level ${body.level ?? 1} means progression depth inside that class and should support stronger WAEC/NECO/JAMB-style reasoning where relevant.`,
      "Use authentic secondary-school language, interpretation, worked logic, and multi-step reasoning appropriate to the class.",
      "Do not reduce the questions to primary-school simplicity, and do not jump to specialized university framing unless the subject naturally requires it.",
      `The questions should feel like credible secondary-school ${String(body.subject?.name ?? "subject").toLowerCase()} work focused on ${String(focusLabel).toLowerCase()}.`,
    ].join(" ");
  }

  return [
    "Treat this learner as a university student receiving true tertiary-level course content.",
    `For Quiks Uni, treat ${body.subject?.name ?? "the subject"} as a university course, not a school subject.`,
    `Level ${body.level ?? 1} means course progression depth: Level 1 should feel like first-year undergraduate foundations, while higher levels should show more abstraction, formalism, application, and analysis.`,
    "Use correct academic terminology, concept-based reasoning, and realistic undergraduate question styles.",
    "Do not downgrade Mathematics, Law, Engineering, Medicine, Management Studies, or any other course to school-level filler.",
    `The questions should feel like authentic introductory or intermediate university ${String(body.subject?.name ?? "course").toLowerCase()} work focused on ${String(focusLabel).toLowerCase()}.`,
  ].join(" ");
}

function buildQuestionPromptLines(body) {
  return [
    `Subject/Course: ${body.subject?.name ?? "Unknown"}`,
    `Grade/Band: ${body.grade ?? "Unknown"}`,
    `Difficulty: ${body.difficulty ?? "Beginner"}`,
    `Mode: ${body.mode ?? "quiz"}`,
    `Level: ${body.level ?? 1}`,
    `Question focus: ${body.focusMode === "topic" ? `Topic only (${body.topicLabel ?? body.topicId ?? "selected topic"})` : "General mixed practice"}`,
    `Question count: ${body.questionCount ?? 10}`,
    `App variant: ${body.appVariant ?? "children"}`,
    `Audience: ${body.appAudienceLabel ?? "General learners"}`,
    `Learner language: ${body.learnerLanguageLabel ?? "English"}`,
    `Learner age: ${body.profile?.age ?? "Unknown"}`,
    `Target exam: ${body.profile?.targetExam ?? "General study"}`,
    `Subject guidance: ${body.subject?.aiPromptHint ?? ""}`,
    `Variant guidance: ${body.appGuidance ?? ""}`,
    `Academic stage guidance: ${describeAcademicStage(body)}`,
    `Difficulty rigour guidance: ${describeDifficultyRigour(body)}`,
    body.focusMode === "topic"
      ? "Generate questions only from the selected topic. Do not mix in unrelated topics."
      : "Use a healthy spread of topics within the subject or course.",
    "Treat the provided grade/band and level as mandatory signals for academic standard.",
    "Treat the selected difficulty as a mandatory signal for reasoning depth inside that academic stage.",
    "The set must reflect the true reasoning level expected for the class, band, level, difficulty, and app variant.",
    "Avoid over-simplified filler questions that belong to a lower academic stage.",
    "Never answer a teens or university request with primary-school style content.",
    `Write all question prompts, answer options, and explanations in ${body.learnerLanguageLabel ?? "English"}.`,
  ];
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function extractOutputText(payload) {
  const outputs = Array.isArray(payload.output) ? payload.output : [];
  const texts = [];

  for (const item of outputs) {
    if (item.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (content.type === "output_text" && typeof content.text === "string") {
        texts.push(content.text);
      }

      if (content.type === "refusal" && typeof content.refusal === "string") {
        throw new Error(content.refusal);
      }
    }
  }

  if (texts.length === 0) {
    throw new Error("OpenAI returned no text output.");
  }

  return texts.join("\n");
}

async function createOpenAiResponse({ schemaName, schema, instructions, input }) {
  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the backend.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: openAiModel,
      instructions,
      input,
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed with status ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  return JSON.parse(extractOutputText(payload));
}

function buildQuestionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      questions: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            prompt: { type: "string" },
            options: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: { type: "string" },
            },
            answer: { type: "string" },
            explanation: { type: "string" },
          },
          required: ["id", "prompt", "options", "answer", "explanation"],
        },
      },
    },
    required: ["questions"],
  };
}

function buildFeedbackSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      feedback: { type: "string" },
    },
    required: ["feedback"],
  };
}

function buildPlanSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      plan: {
        type: "array",
        minItems: 2,
        maxItems: 3,
        items: { type: "string" },
      },
    },
    required: ["plan"],
  };
}

function buildCompetitionKey(body) {
  return [
    body.appVariant ?? "children",
    body.subject?.id ?? "subject",
    body.grade ?? "grade",
    body.level ?? 1,
    body.difficulty ?? "Beginner",
    body.focusMode ?? "general",
    body.topicId ?? "",
  ].join("::");
}

function buildCompetitionPayload(match, playerId) {
  const opponent = match.players.find((player) => player.playerId !== playerId) ?? match.players[1] ?? match.players[0];
  return {
    competitionId: match.id,
    opponentName: opponent?.name ?? "Opponent",
    opponentId: opponent?.playerId,
    questions: match.questions,
    chats: match.chats ?? [],
    startAt: match.startAt,
    endAt: match.endAt,
    liveProgress: Object.values(match.liveProgress ?? {}),
  };
}

function buildChallengeSummary(challenge) {
  return {
    challengeId: challenge.id,
    subjectId: challenge.subjectId,
    subjectName: challenge.subjectName,
    grade: challenge.grade,
    level: challenge.level,
    difficulty: challenge.difficulty,
    focusMode: challenge.focusMode ?? "general",
    topicId: challenge.topicId,
    topicLabel: challenge.topicLabel,
    creatorId: challenge.creatorId,
    creatorName: challenge.creatorName,
    createdAt: challenge.createdAt,
  };
}

function resolveSubmissionFromSnapshot(match, playerId) {
  const snapshot = match.liveProgress?.[playerId];
  return {
    score: snapshot?.score ?? 0,
    correctAnswers: snapshot?.correctAnswers ?? 0,
    totalQuestions: match.questions.length,
    timeTakenSeconds: Math.max(0, Math.floor((match.endAt - match.startAt) / 1000)),
    submittedAt: Date.now(),
  };
}

function ensureCompetitionResolved(match) {
  if (Date.now() < match.endAt) {
    return;
  }

  for (const player of match.players) {
    if (!match.submissions[player.playerId]) {
      match.submissions[player.playerId] = resolveSubmissionFromSnapshot(match, player.playerId);
    }
  }
}

function getCompetitionOutcome(match, playerId) {
  ensureCompetitionResolved(match);
  const own = match.submissions[playerId];
  const opponent = match.players.find((player) => player.playerId !== playerId);
  const rival = opponent ? match.submissions[opponent.playerId] : undefined;

  if (!own || !opponent || !rival) {
    return {
      status: "submitted",
      outcome: "pending",
      opponentName: opponent?.name ?? "Opponent",
      opponentId: opponent?.playerId,
      playerScore: own?.score ?? 0,
      playerTimeTakenSeconds: own?.timeTakenSeconds,
    };
  }

  if (own.score > rival.score) {
    return {
      status: "completed",
      outcome: "won",
      opponentName: opponent.name,
      opponentId: opponent.playerId,
      playerScore: own.score,
      opponentScore: rival.score,
      playerTimeTakenSeconds: own.timeTakenSeconds,
      opponentTimeTakenSeconds: rival.timeTakenSeconds,
    };
  }

  if (own.score < rival.score) {
    return {
      status: "completed",
      outcome: "lost",
      opponentName: opponent.name,
      opponentId: opponent.playerId,
      playerScore: own.score,
      opponentScore: rival.score,
      playerTimeTakenSeconds: own.timeTakenSeconds,
      opponentTimeTakenSeconds: rival.timeTakenSeconds,
    };
  }

  if (own.timeTakenSeconds < rival.timeTakenSeconds) {
    return {
      status: "completed",
      outcome: "won",
      opponentName: opponent.name,
      opponentId: opponent.playerId,
      playerScore: own.score,
      opponentScore: rival.score,
      playerTimeTakenSeconds: own.timeTakenSeconds,
      opponentTimeTakenSeconds: rival.timeTakenSeconds,
    };
  }

  if (own.timeTakenSeconds > rival.timeTakenSeconds) {
    return {
      status: "completed",
      outcome: "lost",
      opponentName: opponent.name,
      opponentId: opponent.playerId,
      playerScore: own.score,
      opponentScore: rival.score,
      playerTimeTakenSeconds: own.timeTakenSeconds,
      opponentTimeTakenSeconds: rival.timeTakenSeconds,
    };
  }

  return {
    status: "completed",
    outcome: "draw",
    opponentName: opponent.name,
    opponentId: opponent.playerId,
    playerScore: own.score,
    opponentScore: rival.score,
    playerTimeTakenSeconds: own.timeTakenSeconds,
    opponentTimeTakenSeconds: rival.timeTakenSeconds,
  };
}

function buildRematchResponse(rematch, playerId) {
  if (!rematch) {
    return { status: "none" };
  }

  if (rematch.status === "accepted" && rematch.competitionId) {
    const match = competitionMatches.get(rematch.competitionId);
    return {
      status: "accepted",
      requesterId: rematch.requesterId,
      requesterName: rematch.requesterName,
      targetId: rematch.targetId,
      targetName: rematch.targetName,
      nextLevel: rematch.level,
      competition: match ? buildCompetitionPayload(match, playerId) : undefined,
    };
  }

  return {
    status: rematch.targetId === playerId ? "incoming" : "requested",
    requesterId: rematch.requesterId,
    requesterName: rematch.requesterName,
    targetId: rematch.targetId,
    targetName: rematch.targetName,
    nextLevel: rematch.level,
  };
}

function buildCompetitionLeaderboard() {
  const today = Date.now();
  const winMap = new Map();

  for (const match of competitionMatches.values()) {
    if (!isSameUtcDay(match.createdAt ?? today, today)) {
      continue;
    }

    ensureCompetitionResolved(match);
    if (Object.keys(match.submissions ?? {}).length < 2) {
      continue;
    }

    for (const player of match.players) {
      const outcome = getCompetitionOutcome(match, player.playerId);
      if (outcome.outcome !== "won") {
        continue;
      }

      const existing = winMap.get(player.playerId);
      if (existing) {
        existing.wins += 1;
        continue;
      }

      winMap.set(player.playerId, {
        playerId: player.playerId,
        playerName: player.name,
        wins: 1,
      });
    }
  }

  return Array.from(winMap.values())
    .sort((left, right) => {
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }
      return left.playerName.localeCompare(right.playerName);
    })
    .slice(0, 5);
}

async function generateQuestionSet(body) {
  const data = await createOpenAiResponse({
    schemaName: "competition_questions",
    schema: buildQuestionSchema(),
    instructions: [
      "You generate multiple-choice educational quiz questions for a mobile learning app competition.",
      "Return only factual, age-appropriate questions.",
      "Each question must have exactly 4 options, one correct answer, and a short explanation.",
      "Do not include unsafe content or trick questions.",
      "Take grade/band, level, and app variant seriously so the academic standard matches the true learner stage.",
      "Take the selected difficulty seriously as a real rigor band inside that stage.",
      "If the course is university-level, produce genuine undergraduate-style questions rather than simplified school questions.",
      "If the request is for Quiks Teens, do not generate primary-school style questions.",
      "Return learner-facing content in the learner's selected language.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              ...buildQuestionPromptLines({
                ...body,
                mode: "quiz",
                questionCount: body.questionCount ?? 10,
              }),
            ].join("\n"),
          },
        ],
      },
    ],
  });

  return data.questions;
}

async function createCompetitionMatch(waiter, challenger) {
  const body = {
    ...challenger.body,
    profile: challenger.body.profile ?? waiter.body.profile,
  };
  const questions = await generateQuestionSet(body);
  const match = {
    id: randomUUID(),
    subjectId: challenger.body.subject?.id ?? waiter.body.subject?.id ?? "subject",
    grade: challenger.body.grade,
    level: challenger.body.level,
    difficulty: challenger.body.difficulty,
    focusMode: challenger.body.focusMode ?? "general",
    topicId: challenger.body.topicId,
    topicLabel: challenger.body.topicLabel,
    questions,
    players: [
      { playerId: waiter.playerId, name: waiter.name },
      { playerId: challenger.playerId, name: challenger.name },
    ],
    chats: [],
    liveProgress: {
      [waiter.playerId]: {
        playerId: waiter.playerId,
        playerName: waiter.name,
        answeredCount: 0,
        correctAnswers: 0,
        score: 0,
        finished: false,
      },
      [challenger.playerId]: {
        playerId: challenger.playerId,
        playerName: challenger.name,
        answeredCount: 0,
        correctAnswers: 0,
        score: 0,
        finished: false,
      },
    },
    submissions: {},
    createdAt: Date.now(),
    startAt: Date.now() + 10000,
    endAt: Date.now() + 10000 + ((challenger.body.durationSeconds ?? body.durationSeconds ?? 120) * 1000),
  };

  competitionMatches.set(match.id, match);
  competitionMatchByPlayer.set(waiter.playerId, match.id);
  competitionMatchByPlayer.set(challenger.playerId, match.id);
  competitionWaiters.delete(waiter.key);
  competitionWaitersById.delete(waiter.queueId);
  competitionWaiterByPlayer.delete(waiter.playerId);

  return match;
}

async function createChallengeCompetition(challenge, accepterProfile) {
  const body = {
    ...challenge.body,
    profile: challenge.body.profile ?? accepterProfile,
  };
  const questions = await generateQuestionSet(body);
  const startAt = Date.now() + 10000;
  const endAt = startAt + (challenge.durationSeconds * 1000);
  const match = {
    id: randomUUID(),
    challengeId: challenge.id,
    subjectId: challenge.subjectId,
    grade: challenge.grade,
    level: challenge.level,
    difficulty: challenge.difficulty,
    focusMode: challenge.focusMode ?? "general",
    topicId: challenge.topicId,
    topicLabel: challenge.topicLabel,
    questions,
    players: [
      { playerId: challenge.creatorId, name: challenge.creatorName },
      { playerId: accepterProfile.id, name: accepterProfile.name ?? "Learner" },
    ],
    chats: [],
    liveProgress: {
      [challenge.creatorId]: {
        playerId: challenge.creatorId,
        playerName: challenge.creatorName,
        answeredCount: 0,
        correctAnswers: 0,
        score: 0,
        finished: false,
      },
      [accepterProfile.id]: {
        playerId: accepterProfile.id,
        playerName: accepterProfile.name ?? "Learner",
        answeredCount: 0,
        correctAnswers: 0,
        score: 0,
        finished: false,
      },
    },
    submissions: {},
    createdAt: Date.now(),
    startAt,
    endAt,
  };

  competitionMatches.set(match.id, match);
  competitionMatchByPlayer.set(challenge.creatorId, match.id);
  competitionMatchByPlayer.set(accepterProfile.id, match.id);
  challenge.status = "accepted";
  challenge.acceptedAt = Date.now();
  challenge.acceptedById = accepterProfile.id;
  challenge.acceptedByName = accepterProfile.name ?? "Learner";
  challenge.competitionId = match.id;
  return match;
}

async function createRematchCompetition(rematch) {
  const questions = await generateQuestionSet(rematch.body);
  const startAt = Date.now() + 10000;
  const endAt = startAt + (rematch.durationSeconds * 1000);
  const match = {
    id: randomUUID(),
    rematchSourceCompetitionId: rematch.sourceCompetitionId,
    subjectId: rematch.subjectId,
    grade: rematch.grade,
    level: rematch.level,
    difficulty: rematch.difficulty,
    focusMode: rematch.focusMode ?? "general",
    topicId: rematch.topicId,
    topicLabel: rematch.topicLabel,
    questions,
    players: [
      { playerId: rematch.requesterId, name: rematch.requesterName },
      { playerId: rematch.targetId, name: rematch.targetName },
    ],
    chats: [],
    liveProgress: {
      [rematch.requesterId]: {
        playerId: rematch.requesterId,
        playerName: rematch.requesterName,
        answeredCount: 0,
        correctAnswers: 0,
        score: 0,
        finished: false,
      },
      [rematch.targetId]: {
        playerId: rematch.targetId,
        playerName: rematch.targetName,
        answeredCount: 0,
        correctAnswers: 0,
        score: 0,
        finished: false,
      },
    },
    submissions: {},
    createdAt: Date.now(),
    startAt,
    endAt,
  };

  competitionMatches.set(match.id, match);
  competitionMatchByPlayer.set(rematch.requesterId, match.id);
  competitionMatchByPlayer.set(rematch.targetId, match.id);
  rematch.status = "accepted";
  rematch.acceptedAt = Date.now();
  rematch.competitionId = match.id;
  return match;
}

function buildBreatherSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      breather: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          intro: { type: "string" },
          formatLabel: { type: "string" },
          story: { type: "string" },
          teachingPoint: { type: "string" },
          teachingTitle: { type: "string" },
          reflection: { type: "string" },
          facts: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: { type: "string" },
          },
          continueLabel: { type: "string" },
        },
        required: [
          "id",
          "title",
          "intro",
          "formatLabel",
          "story",
          "teachingPoint",
          "teachingTitle",
          "reflection",
          "facts",
          "continueLabel",
        ],
      },
    },
    required: ["breather"],
  };
}

async function handleQuestions(body, response) {
  const data = await createOpenAiResponse({
    schemaName: "quiz_questions",
    schema: buildQuestionSchema(),
    instructions: [
      "You generate multiple-choice educational quiz questions for a mobile learning app.",
      "Return only factual, age-appropriate questions.",
      "Each question must have exactly 4 options, one correct answer, and a short explanation.",
      "Do not include unsafe content or trick questions.",
      "Use Nigerian/West African-friendly school context when appropriate, but keep questions globally understandable.",
      "Take grade/band, level, and app variant seriously so the academic standard matches the true learner stage.",
      "Take the selected difficulty seriously as a real rigor band inside that stage.",
      "If the course is university-level, produce genuine undergraduate-style questions rather than simplified school questions.",
      "If the request is for Quiks Teens, do not generate primary-school style questions.",
      "Return learner-facing content in the learner's selected language.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              ...buildQuestionPromptLines(body),
            ].join("\n"),
          },
        ],
      },
    ],
  });

  sendJson(response, 200, { questions: data.questions, source: "remote" });
}

async function handleFeedback(body, response) {
  const data = await createOpenAiResponse({
    schemaName: "quiz_feedback",
    schema: buildFeedbackSchema(),
    instructions: [
      "You are a kind educational coach for children and teens.",
      "Write short, supportive, motivating feedback in 1 to 2 sentences.",
      "Keep the tone positive and age-appropriate.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Score: ${body.score ?? 0}%`,
              `Subject: ${body.subject?.name ?? "Unknown"}`,
              `Grade: ${body.grade ?? "Unknown"}`,
              `Question focus: ${body.focusMode === "topic" ? body.topicLabel ?? body.topicId ?? "selected topic" : "General mixed practice"}`,
              `App variant: ${body.appVariant ?? "children"}`,
              `Audience: ${body.appAudienceLabel ?? "General learners"}`,
              `Learner language: ${body.learnerLanguageLabel ?? "English"}`,
              `Variant guidance: ${body.appGuidance ?? ""}`,
              `Learner age: ${body.profile?.age ?? "Unknown"}`,
              `Write the feedback in ${body.learnerLanguageLabel ?? "English"}.`,
            ].join("\n"),
          },
        ],
      },
    ],
  });

  sendJson(response, 200, { feedback: data.feedback });
}

async function handlePlan(body, response) {
  const data = await createOpenAiResponse({
    schemaName: "study_plan",
    schema: buildPlanSchema(),
    instructions: [
      "Create a short practical study plan for a learner after a quiz session.",
      "Return only 2 to 3 action steps.",
      "Keep each action concise, concrete, and under about 12 words.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Score: ${body.resultScore ?? 0}%`,
              `Subject: ${body.subject?.name ?? "Unknown"}`,
              `Grade: ${body.grade ?? "Unknown"}`,
              `Level: ${body.level ?? 1}`,
              `Question focus: ${body.focusMode === "topic" ? body.topicLabel ?? body.topicId ?? "selected topic" : "General mixed practice"}`,
              `App variant: ${body.appVariant ?? "children"}`,
              `Audience: ${body.appAudienceLabel ?? "General learners"}`,
              `Learner language: ${body.learnerLanguageLabel ?? "English"}`,
              `Variant guidance: ${body.appGuidance ?? ""}`,
              `Learner age: ${body.profile?.age ?? "Unknown"}`,
              `Target exam: ${body.profile?.targetExam ?? "General study"}`,
              `Write the study plan in ${body.learnerLanguageLabel ?? "English"}.`,
            ].join("\n"),
          },
        ],
      },
    ],
  });

  sendJson(response, 200, { plan: data.plan });
}

async function handleBreather(body, response) {
  const focusLabel =
    body.focusMode === "topic"
      ? body.topicLabel ?? body.topicId ?? "selected topic"
      : `general ${body.subject?.name ?? "subject"} coverage`;

  const data = await createOpenAiResponse({
    schemaName: "learning_breather",
    schema: buildBreatherSchema(),
    instructions: [
      "You create short educational breather content for a mobile learning app.",
      "The content should feel like a rewarding mini-lesson, not a quiz.",
      "Keep it engaging, age-appropriate, academically accurate, and encouraging.",
      "For children use simple, vivid wording and short reading pieces.",
      "For teens use revision-friendly school-level mini lessons or reading passages.",
      "For university learners use concise concept reflections, course-linked notes, or brief applied academic readings.",
      "Return all learner-facing content in the learner's selected language.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Subject/Course: ${body.subject?.name ?? "Unknown"}`,
              `Grade/Band: ${body.grade ?? "Unknown"}`,
              `Level: ${body.level ?? 1}`,
              `Pass streak: ${body.streak ?? 0}`,
              `Mode: ${body.mode ?? "quiz"}`,
              `Difficulty: ${body.difficulty ?? "Beginner"}`,
              `Question focus: ${body.focusMode === "topic" ? `Topic only (${body.topicLabel ?? body.topicId ?? "selected topic"})` : "General mixed practice"}`,
              `Selected focus label: ${focusLabel}`,
              `App variant: ${body.appVariant ?? "children"}`,
              `Audience: ${body.appAudienceLabel ?? "General learners"}`,
              `Learner language: ${body.learnerLanguageLabel ?? "English"}`,
              `Learner age: ${body.profile?.age ?? "Unknown"}`,
              `Target exam: ${body.profile?.targetExam ?? "General study"}`,
              `Subject guidance: ${body.subject?.aiPromptHint ?? ""}`,
              `Variant guidance: ${body.appGuidance ?? ""}`,
              `Academic stage guidance: ${describeAcademicStage(body)}`,
              "Create a short breather that teaches something real inside this subject or course.",
              "The content may be a poem, reading passage, concept note, applied reflection, or mini lesson depending on the learner stage.",
              "Do not return quiz questions, multiple-choice options, or assessment instructions.",
              "The story field should be a readable educational passage of moderate length.",
              "The facts array should contain 2 to 4 concise takeaways.",
              `Write the entire breather in ${body.learnerLanguageLabel ?? "English"}.`,
            ].join("\n"),
          },
        ],
      },
    ],
  });

  sendJson(response, 200, { breather: data.breather });
}

async function handleCompetitionJoin(body, response) {
  const playerId = body.profile?.id;
  const playerName = body.profile?.name ?? "Learner";
  if (!playerId || !body.subject?.id || !body.grade || !body.level) {
    sendJson(response, 400, { error: "Competition request is missing required fields." });
    return;
  }

  const existingMatchId = competitionMatchByPlayer.get(playerId);
  if (existingMatchId) {
    const existingMatch = competitionMatches.get(existingMatchId);
    if (existingMatch) {
      sendJson(response, 200, {
        status: "matched",
        competition: buildCompetitionPayload(existingMatch, playerId),
      });
      return;
    }
  }

  const existingQueueId = competitionWaiterByPlayer.get(playerId);
  if (existingQueueId) {
    const waiter = competitionWaitersById.get(existingQueueId);
    if (waiter) {
      sendJson(response, 200, { status: "waiting", queueId: waiter.queueId });
      return;
    }
  }

  const key = buildCompetitionKey(body);
  const waiter = competitionWaiters.get(key);
  if (waiter && waiter.playerId !== playerId) {
    const match = await createCompetitionMatch(waiter, {
      queueId: randomUUID(),
      key,
      playerId,
      name: playerName,
      body,
    });
    sendJson(response, 200, {
      status: "matched",
      competition: buildCompetitionPayload(match, playerId),
    });
    return;
  }

  const queueEntry = {
    queueId: randomUUID(),
    key,
    playerId,
    name: playerName,
    body,
    createdAt: Date.now(),
  };

  competitionWaiters.set(key, queueEntry);
  competitionWaitersById.set(queueEntry.queueId, queueEntry);
  competitionWaiterByPlayer.set(playerId, queueEntry.queueId);
  sendJson(response, 200, { status: "waiting", queueId: queueEntry.queueId });
}

async function handleCompetitionStatus(body, response) {
  const playerId = body.playerId;
  if (!playerId) {
    sendJson(response, 400, { error: "Missing playerId." });
    return;
  }

  const matchId = competitionMatchByPlayer.get(playerId);
  if (matchId) {
    const match = competitionMatches.get(matchId);
    if (match) {
      const outcome = getCompetitionOutcome(match, playerId);
      sendJson(response, 200, {
        status: outcome.status === "completed" ? "completed" : "matched",
        competition: buildCompetitionPayload(match, playerId),
        outcome: outcome.outcome,
        opponentName: outcome.opponentName,
        playerScore: outcome.playerScore,
        opponentScore: outcome.opponentScore,
      });
      return;
    }
  }

  const queueId = body.queueId ?? competitionWaiterByPlayer.get(playerId);
  if (queueId) {
    const waiter = competitionWaitersById.get(queueId);
    if (waiter) {
      sendJson(response, 200, { status: "waiting", queueId });
      return;
    }
  }

  sendJson(response, 200, { status: "not_found" });
}

async function handleCompetitionSubmit(body, response) {
  const match = competitionMatches.get(body.competitionId);
  if (!match) {
    sendJson(response, 404, { error: "Competition match not found." });
    return;
  }

  if (!body.playerId || !match.players.some((player) => player.playerId === body.playerId)) {
    sendJson(response, 400, { error: "Player is not part of this competition." });
    return;
  }

  if (!match.liveProgress) {
    match.liveProgress = {};
  }

  const existingSubmission = match.submissions[body.playerId];
  if (!existingSubmission) {
    const submittedAt = Date.now();
    match.liveProgress[body.playerId] = {
      playerId: body.playerId,
      playerName: match.players.find((player) => player.playerId === body.playerId)?.name ?? "Learner",
      answeredCount: body.totalQuestions ?? match.questions.length,
      correctAnswers: body.correctAnswers ?? 0,
      score: body.score ?? 0,
      finished: true,
      submittedAt,
    };
    match.submissions[body.playerId] = {
      score: body.score ?? 0,
      correctAnswers: body.correctAnswers ?? 0,
      totalQuestions: body.totalQuestions ?? 0,
      timeTakenSeconds: body.timeTakenSeconds ?? 0,
      submittedAt,
    };
  }

  const payload = getCompetitionOutcome(match, body.playerId);
  sendJson(response, 200, payload);
}

async function handleCompetitionProgress(body, response) {
  const match = competitionMatches.get(body.competitionId);
  if (!match) {
    sendJson(response, 404, { error: "Competition match not found." });
    return;
  }

  const player = match.players.find((item) => item.playerId === body.playerId);
  if (!player) {
    sendJson(response, 400, { error: "Player is not part of this competition." });
    return;
  }

  if (!match.liveProgress) {
    match.liveProgress = {};
  }

  match.liveProgress[body.playerId] = {
    playerId: body.playerId,
    playerName: player.name,
    answeredCount: body.answeredCount ?? 0,
    correctAnswers: body.correctAnswers ?? 0,
    score: body.score ?? 0,
    finished: Boolean(body.finished),
    submittedAt: body.finished ? Date.now() : undefined,
  };

  sendJson(response, 200, { ok: true, competition: buildCompetitionPayload(match, body.playerId) });
}

async function handleChallengeCreate(body, response) {
  const profile = body.profile;
  if (!profile?.id || !body.subject?.id || !body.grade || !body.level) {
    sendJson(response, 400, { error: "Challenge request is missing required fields." });
    return;
  }

  const challenge = {
    id: randomUUID(),
    status: "open",
    creatorId: profile.id,
    creatorName: profile.name ?? "Learner",
    subjectId: body.subject.id,
    subjectName: body.subject.name,
    grade: body.grade,
    level: body.level,
    difficulty: body.difficulty ?? "Beginner",
    focusMode: body.focusMode ?? "general",
    topicId: body.topicId,
    topicLabel: body.topicLabel,
    body,
    durationSeconds: Math.max(30, Number(body.durationSeconds ?? 120)),
    createdAt: Date.now(),
  };

  competitionChallenges.set(challenge.id, challenge);
  sendJson(response, 200, { status: "open", challenge: buildChallengeSummary(challenge) });
}

async function handleChallengeList(body, response) {
  const challenges = Array.from(competitionChallenges.values())
    .filter((challenge) => challenge.status === "open")
    .filter((challenge) => !body.subjectId || challenge.subjectId === body.subjectId)
    .filter((challenge) => challenge.creatorId !== body.playerId)
    .sort((left, right) => right.createdAt - left.createdAt)
    .map(buildChallengeSummary);

  sendJson(response, 200, { challenges });
}

async function handleChallengeAccept(body, response) {
  const challenge = competitionChallenges.get(body.challengeId);
  if (!challenge || challenge.status !== "open") {
    sendJson(response, 404, { error: "Challenge is no longer available." });
    return;
  }

  if (!body.playerId || !body.profile?.id || body.playerId !== body.profile.id) {
    sendJson(response, 400, { error: "Player identity mismatch." });
    return;
  }

  if (challenge.creatorId === body.playerId) {
    sendJson(response, 400, { error: "You cannot accept your own challenge." });
    return;
  }

  const match = await createChallengeCompetition(challenge, body.profile);
  sendJson(response, 200, { status: "accepted", competition: buildCompetitionPayload(match, body.playerId) });
}

async function handleChallengeStatus(body, response) {
  const challenge = competitionChallenges.get(body.challengeId);
  if (!challenge) {
    sendJson(response, 200, { status: "not_found" });
    return;
  }

  if (challenge.status === "accepted" && challenge.competitionId) {
    const match = competitionMatches.get(challenge.competitionId);
    sendJson(response, 200, {
      status: "accepted",
      challenge: buildChallengeSummary(challenge),
      competition: match ? buildCompetitionPayload(match, body.playerId) : undefined,
    });
    return;
  }

  sendJson(response, 200, { status: "open", challenge: buildChallengeSummary(challenge) });
}

async function handleCompetitionChat(body, response) {
  const match = competitionMatches.get(body.competitionId);
  if (!match) {
    sendJson(response, 404, { error: "Competition match not found." });
    return;
  }

  const sender = match.players.find((player) => player.playerId === body.playerId);
  if (!sender) {
    sendJson(response, 400, { error: "Player is not part of this competition." });
    return;
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    sendJson(response, 400, { error: "Message is required." });
    return;
  }

  const chatEntry = {
    id: randomUUID(),
    senderId: sender.playerId,
    senderName: sender.name,
    message,
    createdAt: Date.now(),
  };

  match.chats.push(chatEntry);
  match.chats = match.chats.slice(-20);
  sendJson(response, 200, { ok: true, chats: match.chats });
}

async function handleCompetitionLeaderboard(_body, response) {
  sendJson(response, 200, {
    performers: buildCompetitionLeaderboard(),
  });
}

async function handleCompetitionRematchRequest(body, response) {
  const sourceCompetitionId = body.sourceCompetitionId;
  const playerId = body.playerId;
  const profile = body.profile;
  const match = competitionMatches.get(sourceCompetitionId);

  if (!match || !playerId || !profile?.id || playerId !== profile.id) {
    sendJson(response, 400, { error: "Invalid rematch request." });
    return;
  }

  ensureCompetitionResolved(match);
  const requester = match.players.find((player) => player.playerId === playerId);
  const target = match.players.find((player) => player.playerId !== playerId);
  if (!requester || !target) {
    sendJson(response, 400, { error: "Competition players could not be resolved." });
    return;
  }

  const existing = competitionRematches.get(sourceCompetitionId);
  if (existing) {
    sendJson(response, 200, buildRematchResponse(existing, playerId));
    return;
  }

  const rematch = {
    id: randomUUID(),
    sourceCompetitionId,
    requesterId: requester.playerId,
    requesterName: requester.name,
    targetId: target.playerId,
    targetName: target.name,
    subjectId: body.subject?.id ?? match.subjectId,
    grade: body.grade ?? match.grade,
    level: body.level ?? ((match.level ?? 1) + 1),
    difficulty: body.difficulty ?? match.difficulty ?? "Beginner",
    focusMode: body.focusMode ?? match.focusMode ?? "general",
    topicId: body.topicId ?? match.topicId,
    topicLabel: body.topicLabel ?? match.topicLabel,
    durationSeconds: Math.max(30, Number(body.durationSeconds ?? 120)),
    body,
    status: "requested",
    createdAt: Date.now(),
  };

  competitionRematches.set(sourceCompetitionId, rematch);
  sendJson(response, 200, buildRematchResponse(rematch, playerId));
}

async function handleCompetitionRematchStatus(body, response) {
  const rematch = competitionRematches.get(body.sourceCompetitionId);
  sendJson(response, 200, buildRematchResponse(rematch, body.playerId));
}

async function handleCompetitionRematchAccept(body, response) {
  const rematch = competitionRematches.get(body.sourceCompetitionId);
  if (!rematch || rematch.status !== "requested") {
    sendJson(response, 404, { error: "Rematch is no longer available." });
    return;
  }

  if (!body.playerId || !body.profile?.id || body.playerId !== body.profile.id || rematch.targetId !== body.playerId) {
    sendJson(response, 400, { error: "Only the challenged opponent can accept this rematch." });
    return;
  }

  rematch.targetName = body.profile.name ?? rematch.targetName;
  rematch.body = {
    ...rematch.body,
    profile: rematch.body.profile ?? body.profile,
  };
  const match = await createRematchCompetition(rematch);
  sendJson(response, 200, buildRematchResponse(rematch, body.playerId));
}

async function handleClassroomProfileUpsert(body, response) {
  if (!body.profile?.id || !body.profile?.quiksId) {
    sendJson(response, 400, { error: "Profile identity is missing." });
    return;
  }

  const profile = await upsertClassroomProfile(body.profile, body.appVariant ?? "children");
  sendJson(response, 200, { profile });
}

async function handleClassroomCreate(body, response) {
  if (!body.teacherProfile?.id || !body.className?.trim()) {
    sendJson(response, 400, { error: "Teacher profile and class name are required." });
    return;
  }

  const classroom = await createClassroom(body.teacherProfile, body.className, body.appVariant ?? "children");
  sendJson(response, 200, { classroom });
}

async function handleClassroomList(body, response) {
  if (!body.profile?.id) {
    sendJson(response, 400, { error: "Profile is required." });
    return;
  }

  const classes = await listClassroomsForProfile(body.profile, body.appVariant ?? "children");
  sendJson(response, 200, { classes });
}

async function handleClassroomDetails(body, response) {
  if (!body.profile?.id || !body.classId) {
    sendJson(response, 400, { error: "Profile and class are required." });
    return;
  }

  const payload = await getClassroomDetails(body.profile, body.classId, body.appVariant ?? "children");
  sendJson(response, 200, payload);
}

async function handleClassroomUpdate(body, response) {
  if (!body.teacherProfile?.id || !body.classId || !body.className?.trim()) {
    sendJson(response, 400, { error: "Teacher profile, class, and class name are required." });
    return;
  }

  const payload = await updateClassroomName(
    body.teacherProfile,
    body.classId,
    body.className,
    body.appVariant ?? "children"
  );
  sendJson(response, 200, payload);
}

async function handleClassroomJoin(body, response) {
  if (!body.studentProfile?.id || !body.classCode?.trim()) {
    sendJson(response, 400, { error: "Student profile and class code are required." });
    return;
  }

  const payload = await requestJoinClass(body.studentProfile, body.classCode, body.appVariant ?? "children");
  sendJson(response, 200, payload);
}

async function handleClassroomInvite(body, response) {
  if (!body.teacherProfile?.id || !body.classId || !body.studentQuiksId?.trim()) {
    sendJson(response, 400, { error: "Teacher profile, class, and student ID are required." });
    return;
  }

  const payload = await inviteStudentToClass(
    body.teacherProfile,
    body.classId,
    body.studentQuiksId,
    body.appVariant ?? "children"
  );
  sendJson(response, 200, payload);
}

async function handleClassroomMembershipRespond(body, response) {
  if (!body.actorProfile?.id || !body.classId || !body.membershipId || !body.decision) {
    sendJson(response, 400, { error: "Membership response is incomplete." });
    return;
  }

  const payload = await respondToMembershipRequest(
    body.actorProfile,
    body.classId,
    body.membershipId,
    body.decision,
    body.appVariant ?? "children"
  );
  sendJson(response, 200, payload);
}

async function handleClassroomMemberRemove(body, response) {
  if (!body.teacherProfile?.id || !body.classId || !body.membershipId) {
    sendJson(response, 400, { error: "Teacher profile, class, and member are required." });
    return;
  }

  const payload = await removeClassroomMember(
    body.teacherProfile,
    body.classId,
    body.membershipId,
    body.appVariant ?? "children"
  );
  sendJson(response, 200, payload);
}

async function handleAssignmentCandidates(body, response) {
  if (!body.teacherProfile?.id || !body.classId || !body.subject?.id) {
    sendJson(response, 400, { error: "Assignment candidate request is incomplete." });
    return;
  }

  const batchCount = Math.max(1, Math.min(Number(body.batchCount ?? 3), Number(body.questionCount ?? 3), 6));
  const questions = await generateQuestionSet({
    ...body,
    questionCount: batchCount,
  });

  sendJson(response, 200, { questions });
}

async function handleAssignmentCreate(body, response) {
  if (!body.teacherProfile?.id || !body.classId || !body.subject?.id || !Array.isArray(body.questions)) {
    sendJson(response, 400, { error: "Assignment creation request is incomplete." });
    return;
  }

  const activity = await createClassroomActivity(body, body.appVariant ?? "children");
  sendJson(response, 200, { activity });
}

async function handleAssignmentDuplicate(body, response) {
  if (!body.teacherProfile?.id || !body.activityId) {
    sendJson(response, 400, { error: "Teacher profile and activity are required." });
    return;
  }

  const activity = await duplicateActivity(body.teacherProfile, body.activityId, body.appVariant ?? "children");
  sendJson(response, 200, { activity });
}

async function handleAssignmentUpdate(body, response) {
  if (!body.teacherProfile?.id || !body.activityId || !body.classId || !body.subject?.id || !Array.isArray(body.questions)) {
    sendJson(response, 400, { error: "Activity update request is incomplete." });
    return;
  }

  const activity = await updateClassroomActivity(body, body.appVariant ?? "children");
  sendJson(response, 200, { activity });
}

async function handleAssignmentList(body, response) {
  if (!body.profile?.id) {
    sendJson(response, 400, { error: "Profile is required." });
    return;
  }

  const activities = await listActivitiesForProfile(body.profile, body.appVariant ?? "children");
  sendJson(response, 200, { activities });
}

async function handleAssignmentDetails(body, response) {
  if (!body.profile?.id || !body.activityId) {
    sendJson(response, 400, { error: "Profile and assignment are required." });
    return;
  }

  const payload = await getActivityDetails(body.profile, body.activityId, body.appVariant ?? "children");
  sendJson(response, 200, payload);
}

async function handleAssignmentSubmit(body, response) {
  if (!body.profile?.id || !body.activityId) {
    sendJson(response, 400, { error: "Profile and assignment are required." });
    return;
  }

  const payload = await submitActivity(
    body.profile,
    body.activityId,
    {
      score: body.score ?? 0,
      correctAnswers: body.correctAnswers ?? 0,
      totalQuestions: body.totalQuestions ?? 0,
      timeTakenSeconds: body.timeTakenSeconds ?? 0,
    },
    body.appVariant ?? "children"
  );
  sendJson(response, 200, payload);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      provider: "openai",
      model: openAiModel,
      hasApiKey: Boolean(openAiApiKey),
    });
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  try {
    const body = await readJsonBody(request);

    if (url.pathname === "/questions") {
      await handleQuestions(body, response);
      return;
    }

    if (url.pathname === "/feedback") {
      await handleFeedback(body, response);
      return;
    }

    if (url.pathname === "/coach-plan") {
      await handlePlan(body, response);
      return;
    }

    if (url.pathname === "/breather") {
      await handleBreather(body, response);
      return;
    }

    if (url.pathname === "/competition/join") {
      await handleCompetitionJoin(body, response);
      return;
    }

    if (url.pathname === "/competition/challenge/create") {
      await handleChallengeCreate(body, response);
      return;
    }

    if (url.pathname === "/competition/challenge/list") {
      await handleChallengeList(body, response);
      return;
    }

    if (url.pathname === "/competition/challenge/accept") {
      await handleChallengeAccept(body, response);
      return;
    }

    if (url.pathname === "/competition/challenge/status") {
      await handleChallengeStatus(body, response);
      return;
    }

    if (url.pathname === "/competition/status") {
      await handleCompetitionStatus(body, response);
      return;
    }

    if (url.pathname === "/competition/progress") {
      await handleCompetitionProgress(body, response);
      return;
    }

    if (url.pathname === "/competition/submit") {
      await handleCompetitionSubmit(body, response);
      return;
    }

    if (url.pathname === "/competition/chat") {
      await handleCompetitionChat(body, response);
      return;
    }

    if (url.pathname === "/competition/leaderboard") {
      await handleCompetitionLeaderboard(body, response);
      return;
    }

    if (url.pathname === "/competition/rematch/request") {
      await handleCompetitionRematchRequest(body, response);
      return;
    }

    if (url.pathname === "/competition/rematch/status") {
      await handleCompetitionRematchStatus(body, response);
      return;
    }

    if (url.pathname === "/competition/rematch/accept") {
      await handleCompetitionRematchAccept(body, response);
      return;
    }

    if (url.pathname === "/classroom/profile/upsert") {
      await handleClassroomProfileUpsert(body, response);
      return;
    }

    if (url.pathname === "/classroom/classes/create") {
      await handleClassroomCreate(body, response);
      return;
    }

    if (url.pathname === "/classroom/classes/list") {
      await handleClassroomList(body, response);
      return;
    }

    if (url.pathname === "/classroom/classes/details") {
      await handleClassroomDetails(body, response);
      return;
    }

    if (url.pathname === "/classroom/classes/update") {
      await handleClassroomUpdate(body, response);
      return;
    }

    if (url.pathname === "/classroom/classes/join") {
      await handleClassroomJoin(body, response);
      return;
    }

    if (url.pathname === "/classroom/classes/invite") {
      await handleClassroomInvite(body, response);
      return;
    }

    if (url.pathname === "/classroom/classes/membership/respond") {
      await handleClassroomMembershipRespond(body, response);
      return;
    }

    if (url.pathname === "/classroom/classes/member/remove") {
      await handleClassroomMemberRemove(body, response);
      return;
    }

    if (url.pathname === "/classroom/assignments/candidates") {
      await handleAssignmentCandidates(body, response);
      return;
    }

    if (url.pathname === "/classroom/assignments/create") {
      await handleAssignmentCreate(body, response);
      return;
    }

    if (url.pathname === "/classroom/assignments/duplicate") {
      await handleAssignmentDuplicate(body, response);
      return;
    }

    if (url.pathname === "/classroom/assignments/update") {
      await handleAssignmentUpdate(body, response);
      return;
    }

    if (url.pathname === "/classroom/assignments/list") {
      await handleAssignmentList(body, response);
      return;
    }

    if (url.pathname === "/classroom/assignments/details") {
      await handleAssignmentDetails(body, response);
      return;
    }

    if (url.pathname === "/classroom/assignments/submit") {
      await handleAssignmentSubmit(body, response);
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
});

server.listen(port, () => {
  console.log(`OpenAI proxy listening on http://localhost:${port}`);
});

import http from "node:http";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import {
  acceptClassInviteLink,
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
const openAiModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const openAiVerifierModel = process.env.OPENAI_VERIFIER_MODEL || "gpt-5.6-terra";
const openAiVerifierReasoningEffort = process.env.OPENAI_VERIFIER_REASONING_EFFORT || "medium";
const questionCandidateMultiplier = readPositiveNumber(process.env.QUESTION_CANDIDATE_MULTIPLIER, 1.5, 1);
const maxQuestionCandidates = Math.round(readPositiveNumber(process.env.MAX_QUESTION_CANDIDATES, 20, 10));
const competitionWaiters = new Map();
const competitionWaitersById = new Map();
const competitionWaiterByPlayer = new Map();
const competitionMatches = new Map();
const competitionMatchByPlayer = new Map();
const competitionChallenges = new Map();
const competitionRematches = new Map();
const groupCompetitions = new Map();
const groupCompetitionByCode = new Map();
const pushTokensByPlayer = new Map();
const revenueCatPublicKeys = {
  children: {
    android: process.env.REVENUECAT_CHILDREN_ANDROID_PUBLIC_KEY || "goog_jPXDDFSylXKTcMvzPNPPhTHIyeA",
    paddle: process.env.REVENUECAT_CHILDREN_PADDLE_PUBLIC_KEY || "pdl_uDcNQNxHeNqGuOkDvOYPPlbVuAyp",
    entitlement: process.env.REVENUECAT_CHILDREN_ENTITLEMENT_ID || "entl5792d09222",
  },
  teens: {
    android: process.env.REVENUECAT_TEENS_ANDROID_PUBLIC_KEY || "goog_ciDxoaodJlvQwkRHzOEqvZFsktJ",
    paddle: process.env.REVENUECAT_TEENS_PADDLE_PUBLIC_KEY || "pdl_lIrTQkvVsEgMYEupTWtazdvnJIdY",
    entitlement: process.env.REVENUECAT_TEENS_ENTITLEMENT_ID || "entl799f03ddcc",
  },
  uni: {
    android: process.env.REVENUECAT_UNI_ANDROID_PUBLIC_KEY || "goog_jMWcZCwUSjbsYzrLdmREAjyMNYY",
    paddle: process.env.REVENUECAT_UNI_PADDLE_PUBLIC_KEY || "pdl_zMZDPBTDiEmPYiEvOBcZSQVGkgpY",
    entitlement: process.env.REVENUECAT_UNI_ENTITLEMENT_ID || "entl5ab41c922b",
  },
};

function readPositiveNumber(value, fallback, minimum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

function getRevenueCatConfig(appVariant = "children") {
  return revenueCatPublicKeys[appVariant] ?? revenueCatPublicKeys.children;
}

function getRevenueCatExpiration(record) {
  return record?.expires_date ?? record?.expires_at ?? null;
}

function isRevenueCatRecordActive(record) {
  if (!record) {
    return false;
  }

  const expiresAt = getRevenueCatExpiration(record);
  if (!expiresAt) {
    return true;
  }

  const expirationTime = new Date(expiresAt).getTime();
  return Number.isFinite(expirationTime) && expirationTime > Date.now();
}

function parseRevenueCatSubscriptionStatus(payload, appVariant) {
  const subscriber = payload?.subscriber ?? payload;
  const entitlements = subscriber?.entitlements ?? {};
  const subscriptions = subscriber?.subscriptions ?? {};
  const configuredEntitlement = entitlements[getRevenueCatConfig(appVariant).entitlement];
  const activeRecords = [
    ...(isRevenueCatRecordActive(configuredEntitlement) ? [configuredEntitlement] : []),
    ...Object.values(entitlements).filter(isRevenueCatRecordActive),
    ...Object.values(subscriptions).filter(isRevenueCatRecordActive),
  ];
  const activeRecord = activeRecords[0] ?? null;
  const datedExpirations = activeRecords
    .map(getRevenueCatExpiration)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());

  return {
    active: Boolean(activeRecord),
    expiresAt: activeRecord ? datedExpirations[0] ?? null : null,
  };
}

async function fetchRevenueCatSubscriber(accountUid, appVariant) {
  const config = getRevenueCatConfig(appVariant);
  const revenueCatResponse = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(accountUid)}`,
    {
      headers: {
        Authorization: `Bearer ${config.paddle}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!revenueCatResponse.ok) {
    throw new Error(`RevenueCat subscriber lookup failed (${revenueCatResponse.status}).`);
  }

  return revenueCatResponse.json();
}

async function handleSubscriptionStatus(body, response) {
  if (!body.accountUid?.trim()) {
    sendJson(response, 400, { error: "Account UID is required." });
    return;
  }

  const appVariant = body.appVariant ?? "children";
  const subscriber = await fetchRevenueCatSubscriber(body.accountUid.trim(), appVariant);
  sendJson(response, 200, parseRevenueCatSubscriptionStatus(subscriber, appVariant));
}

async function handlePaddleSubscriptionSync(body, response) {
  if (!body.accountUid?.trim() || !body.transactionId?.trim()) {
    sendJson(response, 400, { error: "Account UID and Paddle transaction ID are required." });
    return;
  }

  const appVariant = body.appVariant ?? "children";
  const config = getRevenueCatConfig(appVariant);
  const receiptResponse = await fetch("https://api.revenuecat.com/v1/receipts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.paddle}`,
      "Content-Type": "application/json",
      "X-Platform": "paddle",
    },
    body: JSON.stringify({
      app_user_id: body.accountUid.trim(),
      fetch_token: body.transactionId.trim(),
    }),
  });

  if (!receiptResponse.ok) {
    const receiptError = await receiptResponse.text();
    throw new Error(`RevenueCat Paddle sync failed (${receiptResponse.status}): ${receiptError}`);
  }

  const receiptPayload = await receiptResponse.json();
  sendJson(response, 200, parseRevenueCatSubscriptionStatus(receiptPayload, appVariant));
}

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

function getSelectedTopicLabels(body) {
  if (Array.isArray(body.topicLabels)) {
    const labels = body.topicLabels
      .filter((label) => typeof label === "string" && label.trim())
      .map((label) => label.trim());
    if (labels.length > 0) return labels;
  }
  return body.topicLabel ? [String(body.topicLabel)] : [];
}

function describeQuestionFocus(body) {
  if (body.focusMode !== "topic") return "General mixed practice";
  const labels = getSelectedTopicLabels(body);
  if (labels.length > 0) return `Selected topics only (${labels.join("; ")})`;
  return `Selected topic only (${body.topicId ?? "selected topic"})`;
}

function describeAcademicStage(body) {
  const selectedTopicLabels = getSelectedTopicLabels(body);
  const focusLabel =
    body.focusMode === "topic"
      ? selectedTopicLabels.join(", ") || body.topicId || "selected topic"
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

function describeLevelCurriculumFocus(body) {
  const topics = Array.isArray(body.subject?.topics) ? body.subject.topics : [];
  if (body.focusMode === "topic" || topics.length === 0) return null;
  const normalizedLevel = Math.min(Math.max(Number(body.level ?? 1), 1), 20);
  const topicIndex = Math.min(Math.floor(((normalizedLevel - 1) * topics.length) / 20), topics.length - 1);
  const topic = topics[topicIndex];
  return `Level curriculum focus: Give primary emphasis to ${topic.label ?? "the designated topic"} (${topic.description ?? "the expected curriculum content"}) while including useful review from earlier subject topics.`;
}

function buildQuestionPromptLines(body) {
  return [
    `Subject/Course: ${body.subject?.name ?? "Unknown"}`,
    `Grade/Band: ${body.grade ?? "Unknown"}`,
    `Difficulty: ${body.difficulty ?? "Beginner"}`,
    `Mode: ${body.mode ?? "quiz"}`,
    `Level: ${body.level ?? 1}`,
    `Question focus: ${describeQuestionFocus(body)}`,
    `Question count: ${body.questionCount ?? 10}`,
    `App variant: ${body.appVariant ?? "children"}`,
    `Audience: ${body.appAudienceLabel ?? "General learners"}`,
    `Learner language: ${body.learnerLanguageLabel ?? "English"}`,
    `Learner age: ${body.profile?.age ?? "Unknown"}`,
    `Target exam: ${body.profile?.targetExam ?? "General study"}`,
    `Preferred curriculum: ${body.profile?.preferredCurriculum || "Not specified"}`,
    "When a preferred curriculum is specified, align the questions with its terminology, scope, teaching sequence, and expected assessment style without overriding the selected grade or target exam.",
    `Subject guidance: ${body.subject?.aiPromptHint ?? ""}`,
    `Variant guidance: ${body.appGuidance ?? ""}`,
    `Academic stage guidance: ${describeAcademicStage(body)}`,
    `Difficulty rigour guidance: ${describeDifficultyRigour(body)}`,
    describeLevelCurriculumFocus(body) ?? "",
    body.focusMode === "topic"
      ? "Generate questions only from the selected topic or topics. Cover every selected topic as evenly as the requested question count permits. Do not mix in unrelated topics."
      : "Use a healthy spread of topics within the subject or course.",
    "Treat the provided grade/band and level as mandatory signals for academic standard.",
    "Treat the selected difficulty as a mandatory signal for reasoning depth inside that academic stage.",
    "The set must reflect the true reasoning level expected for the class, band, level, difficulty, and app variant.",
    "Avoid over-simplified filler questions that belong to a lower academic stage.",
    "Never answer a teens or university request with primary-school style content.",
    `Write all question prompts, answer options, and explanations in ${body.learnerLanguageLabel ?? "English"}.`,
  ].filter(Boolean);
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

function getClientErrorStatus(error) {
  const message = error instanceof Error ? error.message.trim().toLowerCase() : "";

  if (!message) {
    return null;
  }

  if (message.includes("not allowed") || message.includes("only students can request") || message.includes("only teachers can")) {
    return 403;
  }

  if (message.includes("not found")) {
    return 404;
  }

  if (
    message.includes("already has a join request") ||
    message.includes("already has an invite") ||
    message.includes("already belongs") ||
    message.includes("already in") ||
    message.includes("not part of the class") ||
    message.includes("teacher cannot be removed") ||
    message.includes("invalid class") ||
    message.includes("missing classroom") ||
    message.includes("membership request") ||
    message.includes("student id was not found")
  ) {
    return 400;
  }

  return null;
}

async function sendExpoPushNotification({ to, title, body, data }) {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      to,
      title,
      body,
      data,
      sound: "default",
      priority: "high",
      channelId: "competition-reminders",
      ttl: 120,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Expo push failed with status ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  const ticket = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;

  if (!ticket) {
    throw new Error("Expo push did not return a delivery ticket.");
  }

  if (ticket.status === "error") {
    const message = ticket.message || "Expo push rejected the notification.";
    const details =
      ticket.details && typeof ticket.details === "object" ? ` ${JSON.stringify(ticket.details)}` : "";
    throw new Error(`${message}${details}`);
  }

  if (ticket.status !== "ok") {
    throw new Error(`Unexpected Expo push ticket status: ${String(ticket.status ?? "unknown")}`);
  }

  return payload;
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

async function createOpenAiResponse({
  schemaName,
  schema,
  instructions,
  input,
  model = openAiModel,
  reasoningEffort,
}) {
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
      model,
      instructions,
      input,
      ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
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

function buildQuestionVerificationSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      results: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            candidateIndex: { type: "integer" },
            correctOptionIndex: { type: "integer", enum: [-1, 0, 1, 2, 3] },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            isUnambiguous: { type: "boolean" },
            explanationAccurate: { type: "boolean" },
            reason: { type: "string" },
          },
          required: [
            "candidateIndex",
            "correctOptionIndex",
            "confidence",
            "isUnambiguous",
            "explanationAccurate",
            "reason",
          ],
        },
      },
    },
    required: ["results"],
  };
}

function normalizeForValidation(value) {
  return String(value ?? "")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTopicLikeLabel(value) {
  return normalizeForValidation(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b(pencils|erasers|books|pens|items|equations)\b/g, (match) => match.replace(/s$/, ""));
}

function extractOptionNumber(option) {
  const match = String(option ?? "").replace(/,/g, "").match(/(?:₦|N)?\s*(-?\d+(?:\.\d+)?)/i);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildLinearEvaluator(expression, variableName) {
  const base = normalizeForValidation(expression).replace(/\s+/g, "");
  const canonical = base.replace(new RegExp(variableName, "gi"), "x");
  const withMultiplication = canonical
    .replace(/(\d)(x|\()/g, "$1*$2")
    .replace(/x\(/g, "x*(")
    .replace(/\)(\d|x)/g, ")*$1");

  if (!/^[0-9x+\-*/().]+$/.test(withMultiplication)) {
    return null;
  }

  const fn = new Function("x", `"use strict"; return (${withMultiplication});`);
  return (x) => {
    const result = fn(x);
    return Number.isFinite(result) ? result : null;
  };
}

function inferLinearEquationAnswer(prompt) {
  const normalized = normalizeForValidation(prompt);
  const equationMatch = normalized.match(/([0-9a-zA-Z+\-*/().\s]+)=([0-9a-zA-Z+\-*/().\s]+)/);
  if (!equationMatch) {
    return null;
  }

  const variableMatch = normalized.match(/\b([a-zA-Z])\b|(?<=[(*/+\-])([a-zA-Z])(?=[)*/+\-\s=])|(\d)([a-zA-Z])/);
  const variableName = variableMatch?.[1] ?? variableMatch?.[2] ?? variableMatch?.[4];
  if (!variableName) {
    return null;
  }

  const leftEvaluator = buildLinearEvaluator(equationMatch[1], variableName);
  const rightEvaluator = buildLinearEvaluator(equationMatch[2], variableName);
  if (!leftEvaluator || !rightEvaluator) {
    return null;
  }

  const left0 = leftEvaluator(0);
  const left1 = leftEvaluator(1);
  const left2 = leftEvaluator(2);
  const right0 = rightEvaluator(0);
  const right1 = rightEvaluator(1);
  const right2 = rightEvaluator(2);

  if ([left0, left1, left2, right0, right1, right2].some((value) => value === null)) {
    return null;
  }

  const leftSlope = left1 - left0;
  const rightSlope = right1 - right0;
  const leftSecondDiff = left2 - 2 * left1 + left0;
  const rightSecondDiff = right2 - 2 * right1 + right0;
  if (Math.abs(leftSecondDiff) > 0.0001 || Math.abs(rightSecondDiff) > 0.0001) {
    return null;
  }

  const coefficient = leftSlope - rightSlope;
  if (Math.abs(coefficient) < 0.0001) {
    return null;
  }

  const constant = right0 - left0;
  const answer = constant / coefficient;
  return Number.isFinite(answer) ? answer : null;
}

function inferMoneyWordProblemAnswer(prompt) {
  const normalized = normalizeForValidation(prompt);
  if (!/\b(how much|total cost|spend in total|altogether)\b/i.test(normalized)) {
    return null;
  }

  const priceEntries = Array.from(normalized.matchAll(/\b(?:an?|each)\s+([a-zA-Z][a-zA-Z\s-]*?)\s+for\s+(?:₦|N)\s?(\d+(?:\.\d+)?)/gi));
  const quantitySectionMatch = normalized.match(/\bbuys?\s+(.+?)(?:[.?!]|$)/i);
  if (priceEntries.length === 0 || !quantitySectionMatch) {
    return null;
  }

  const prices = new Map();
  for (const entry of priceEntries) {
    prices.set(normalizeTopicLikeLabel(entry[1]), Number(entry[2]));
  }

  const quantityEntries = Array.from(quantitySectionMatch[1].matchAll(/(\d+)\s+([a-zA-Z][a-zA-Z\s-]*)/g));
  if (quantityEntries.length === 0) {
    return null;
  }

  let total = 0;
  let matchedAny = false;
  for (const entry of quantityEntries) {
    const itemKey = normalizeTopicLikeLabel(entry[2]);
    const unitPrice = prices.get(itemKey);
    if (typeof unitPrice !== "number") {
      continue;
    }

    matchedAny = true;
    total += Number(entry[1]) * unitPrice;
  }

  return matchedAny ? total : null;
}

function greatestCommonDivisor(left, right) {
  let a = Math.abs(Math.trunc(left));
  let b = Math.abs(Math.trunc(right));
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function inferPercentOfAnswer(prompt) {
  const normalized = normalizeForValidation(prompt);
  const match = normalized.match(/(?:what is|calculate|find)\s+(-?\d+(?:\.\d+)?)\s*%\s+of\s+(-?\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const value = (Number(match[1]) / 100) * Number(match[2]);
  return Number.isFinite(value) ? value : null;
}

function inferPercentToFractionAnswer(prompt) {
  const normalized = normalizeForValidation(prompt);
  const match = normalized.match(/(?:convert|write|express)\s+(-?\d+(?:\.\d+)?)\s*%\s+(?:as|into)/i);
  if (!match || !/fraction/i.test(normalized)) return null;

  const percentText = match[1];
  const decimalPlaces = percentText.includes(".") ? percentText.split(".")[1].length : 0;
  const scale = 10 ** decimalPlaces;
  const numerator = Math.round(Number(percentText) * scale);
  const denominator = 100 * scale;
  const divisor = greatestCommonDivisor(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function inferArithmeticExpressionAnswer(prompt) {
  const normalized = normalizeForValidation(prompt);
  const match = normalized.match(/^(?:calculate|evaluate|simplify|what is|find the value of)\s*:?[ ]*([0-9+\-*/(). ×÷]+)\??$/i);
  if (!match) return null;
  const expression = match[1].replace(/[×x]/gi, "*").replace(/÷/g, "/").trim();
  if (!/[+\-*/]/.test(expression) || !/^[0-9+\-*/(). ]+$/.test(expression)) return null;

  try {
    const value = new Function(`"use strict"; return (${expression});`)();
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function inferAverageAnswer(prompt) {
  const normalized = normalizeForValidation(prompt);
  const match = normalized.match(/(?:average|arithmetic mean|mean)\s+of\s+([0-9.,\s-]+(?:and\s+-?\d+(?:\.\d+)?)?)/i);
  if (!match) return null;
  const values = Array.from(match[1].matchAll(/-?\d+(?:\.\d+)?/g)).map((entry) => Number(entry[0]));
  if (values.length < 2) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function extractOptionFraction(option) {
  const normalized = String(option ?? "")
    .replace(/\\\(/g, "")
    .replace(/\\\)/g, "")
    .trim();
  const latex = normalized.match(/\\frac\s*\{\s*(-?\d+)\s*\}\s*\{\s*(\d+)\s*\}/i);
  const plain = normalized.match(/(-?\d+)\s*\/\s*(\d+)/);
  const match = latex ?? plain;
  if (!match || Number(match[2]) === 0) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  const divisor = greatestCommonDivisor(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function inferExpectedAnswer(question) {
  const fraction = inferPercentToFractionAnswer(question.prompt);
  if (fraction) return { kind: "fraction", value: fraction };

  const number =
    inferLinearEquationAnswer(question.prompt) ??
    inferMoneyWordProblemAnswer(question.prompt) ??
    inferPercentOfAnswer(question.prompt) ??
    inferArithmeticExpressionAnswer(question.prompt) ??
    inferAverageAnswer(question.prompt);
  return number === null ? null : { kind: "number", value: number };
}

function questionHasConsistentAnswer(question) {
  const expectedAnswer = inferExpectedAnswer(question);
  if (expectedAnswer === null) {
    return true;
  }

  if (expectedAnswer.kind === "fraction") {
    const selectedFraction = extractOptionFraction(question.answer);
    return (
      selectedFraction !== null &&
      selectedFraction.numerator === expectedAnswer.value.numerator &&
      selectedFraction.denominator === expectedAnswer.value.denominator
    );
  }

  const selectedNumber = extractOptionNumber(question.answer);
  return selectedNumber !== null && Math.abs(selectedNumber - expectedAnswer.value) < 0.0001;
}

function validateGeneratedQuestions(questions, expectedCount) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("AI did not return any questions.");
  }

  const cleaned = questions
    .map((question, index) => ({
      id: String(question?.id || `ai-${index + 1}-${Date.now()}`).trim(),
      prompt: String(question?.prompt ?? "").trim(),
      options: Array.isArray(question?.options) ? question.options.map((option) => String(option).trim()) : [],
      answer: String(question?.answer ?? "").trim(),
      explanation: String(question?.explanation ?? "").trim(),
    }))
    .filter((question) => {
      const uniqueOptions = new Set(question.options.map((option) => normalizeForValidation(option).toLowerCase()));
      return (
        question.prompt.length > 0 &&
        question.options.length === 4 &&
        question.options.every((option) => option.length > 0) &&
        uniqueOptions.size === 4 &&
        question.answer.length > 0 &&
        question.options.includes(question.answer) &&
        question.explanation.length > 0 &&
        questionHasConsistentAnswer(question)
      );
    })
    .slice(0, expectedCount);

  if (cleaned.length === 0) {
    throw new Error("AI returned invalid or inconsistent question data.");
  }

  return cleaned;
}

async function verifyGeneratedQuestions(questions, body) {
  const candidates = questions.map((question, candidateIndex) => ({
    candidateIndex,
    prompt: question.prompt,
    options: question.options,
    proposedExplanation: question.explanation,
  }));
  const data = await createOpenAiResponse({
    schemaName: "quiz_question_verification",
    schema: buildQuestionVerificationSchema(),
    model: openAiVerifierModel,
    reasoningEffort: openAiVerifierReasoningEffort,
    instructions: [
      "You are an independent educational assessment verifier, not a quiz writer.",
      "Solve every candidate yourself from the prompt and options before judging the proposed explanation.",
      "Do not assume that the proposed explanation or any option is correct.",
      "Set correctOptionIndex to -1 if the question is unsound, outdated, underspecified, has no correct option, or has multiple defensible answers.",
      "Use high confidence only when the answer is clearly established and appropriate for the supplied learner stage and curriculum.",
      "Mark explanationAccurate false if the explanation contains a factual, mathematical, logical, or terminology error, even when its final option is correct.",
      "Return one result for every candidateIndex and do not omit difficult candidates.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              context: {
                subject: body.subject?.name ?? "Unknown",
                grade: body.grade ?? "Unknown",
                difficulty: body.difficulty ?? "Unknown",
                topicFocus: describeQuestionFocus(body),
                targetExam: body.profile?.targetExam ?? "General study",
                preferredCurriculum: body.profile?.preferredCurriculum ?? "Not specified",
                learnerLanguage: body.learnerLanguageLabel ?? "English",
              },
              candidates,
            }),
          },
        ],
      },
    ],
  });

  const results = Array.isArray(data.results) ? data.results : [];
  const resultByIndex = new Map(results.map((result) => [result.candidateIndex, result]));
  const accepted = questions.filter((question, candidateIndex) => {
    const result = resultByIndex.get(candidateIndex);
    const proposedAnswerIndex = question.options.indexOf(question.answer);
    return (
      result?.confidence === "high" &&
      result.isUnambiguous === true &&
      result.explanationAccurate === true &&
      result.correctOptionIndex === proposedAnswerIndex
    );
  });

  const rejectedCount = questions.length - accepted.length;
  if (rejectedCount > 0) {
    console.warn(`[questions] Rejected ${rejectedCount} of ${questions.length} generated candidates during independent verification.`);
  }
  return accepted;
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
    opponentName:
      match.mode === "group"
        ? `${Math.max(0, match.players.length - 1)} other participant${match.players.length === 2 ? "" : "s"}`
        : opponent?.name ?? "Opponent",
    opponentId: opponent?.playerId,
    mode: match.mode ?? "head_to_head",
    participantCount: match.players.length,
    questions: match.questions,
    chats: match.chats ?? [],
    startAt: match.startAt,
    endAt: match.endAt,
    liveProgress: Object.values(match.liveProgress ?? {}),
    standings: buildCompetitionStandings(match),
  };
}

function buildGroupCompetitionSummary(group) {
  return {
    groupCompetitionId: group.id,
    code: group.code,
    status: group.status,
    subjectId: group.subjectId,
    subjectName: group.subjectName,
    grade: group.grade,
    level: group.level,
    difficulty: group.difficulty,
    focusMode: group.focusMode,
    topicId: group.topicId,
    topicLabel: group.topicLabel,
    creatorId: group.creatorId,
    creatorName: group.creatorName,
    createdAt: group.createdAt,
    startAt: group.startAt,
    endAt: group.endAt,
    participantCount: group.participants.length,
    participants: group.participants.map((participant) => ({
      playerId: participant.playerId,
      playerName: participant.playerName,
      joinedAt: participant.joinedAt,
      creator: participant.playerId === group.creatorId,
    })),
  };
}

function createGroupCompetitionCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = "";
    const seed = randomUUID().replace(/-/g, "");
    for (let index = 0; index < 6; index += 1) {
      const hexPair = seed.slice(index * 2, index * 2 + 2);
      code += alphabet[Number.parseInt(hexPair, 16) % alphabet.length];
    }
    if (!groupCompetitionByCode.has(code)) {
      return code;
    }
  }
  return randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

function findGroupCompetition(body) {
  if (body.groupCompetitionId) {
    return groupCompetitions.get(body.groupCompetitionId);
  }
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const groupId = code ? groupCompetitionByCode.get(code) : undefined;
  return groupId ? groupCompetitions.get(groupId) : undefined;
}

function buildChallengeSummary(challenge) {
  return {
    challengeId: challenge.id,
    status: challenge.status ?? "open",
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
    acceptedById: challenge.acceptedById,
    acceptedByName: challenge.acceptedByName,
    creatorNotification: challenge.creatorNotification,
    accepterNotification: challenge.accepterNotification,
  };
}

function getPushRegistrationSnapshot(playerId) {
  const registration = pushTokensByPlayer.get(playerId);
  return {
    registration,
    registrationPresent: Boolean(registration?.token),
    tokenUpdatedAt: registration?.updatedAt,
  };
}

function trimPushError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown push error");
  return message.length > 220 ? `${message.slice(0, 217)}...` : message;
}

async function notifyChallengeCreatorAccepted(challenge, accepterProfile) {
  const { registration, registrationPresent, tokenUpdatedAt } = getPushRegistrationSnapshot(challenge.creatorId);
  challenge.creatorNotification = {
    registrationPresent,
    tokenUpdatedAt,
    lastAttemptAt: Date.now(),
    lastStatus: registration?.token ? "sending" : "not_registered",
  };

  if (!registration?.token) {
    return false;
  }

  try {
    await sendExpoPushNotification({
      to: registration.token,
      title: "Challenge accepted",
      body: `${accepterProfile?.name ?? "Another learner"} accepted your ${challenge.subjectName} challenge.`,
      data: {
        route: "/competition",
        challengeId: challenge.id,
        subjectId: challenge.subjectId,
        grade: String(challenge.grade),
        level: String(challenge.level),
        difficulty: String(challenge.difficulty ?? "Beginner"),
        focusMode: String(challenge.focusMode ?? "general"),
        topicId: challenge.topicId ?? "",
        opponentName: accepterProfile?.name ?? "Opponent",
        notificationType: "challenge_accepted_needs_creator_confirmation",
      },
    });
    challenge.creatorNotification = {
      ...challenge.creatorNotification,
      lastSuccessAt: Date.now(),
      lastStatus: "sent",
      lastError: undefined,
    };
  } catch (error) {
    challenge.creatorNotification = {
      ...challenge.creatorNotification,
      lastStatus: "failed",
      lastError: trimPushError(error),
    };
    throw error;
  }

  return true;
}

async function notifyChallengeAccepterConfirmed(challenge, match) {
  const { registration, registrationPresent, tokenUpdatedAt } = getPushRegistrationSnapshot(challenge.acceptedById);
  challenge.accepterNotification = {
    registrationPresent,
    tokenUpdatedAt,
    lastAttemptAt: Date.now(),
    lastStatus: registration?.token ? "sending" : "not_registered",
  };

  if (!registration?.token) {
    return false;
  }

  try {
    await sendExpoPushNotification({
      to: registration.token,
      title: "Competition ready",
      body: `${challenge.creatorName} accepted the challenge. Your ${challenge.subjectName} competition is starting soon.`,
      data: {
        route: "/session",
        subjectId: challenge.subjectId,
        grade: String(challenge.grade),
        level: String(challenge.level),
        difficulty: String(challenge.difficulty ?? "Beginner"),
        focusMode: String(challenge.focusMode ?? "general"),
        topicId: challenge.topicId ?? "",
        competitionId: match.id,
        competitionOpponentName: challenge.creatorName,
        autoStart: "1",
        mode: "quiz",
      },
    });
    challenge.accepterNotification = {
      ...challenge.accepterNotification,
      lastSuccessAt: Date.now(),
      lastStatus: "sent",
      lastError: undefined,
    };
  } catch (error) {
    challenge.accepterNotification = {
      ...challenge.accepterNotification,
      lastStatus: "failed",
      lastError: trimPushError(error),
    };
    throw error;
  }

  return true;
}

async function notifyChallengeAccepterDeclined(challenge) {
  const { registration, registrationPresent, tokenUpdatedAt } = getPushRegistrationSnapshot(challenge.acceptedById);
  challenge.accepterNotification = {
    registrationPresent,
    tokenUpdatedAt,
    lastAttemptAt: Date.now(),
    lastStatus: registration?.token ? "sending" : "not_registered",
  };

  if (!registration?.token) {
    return false;
  }

  try {
    await sendExpoPushNotification({
      to: registration.token,
      title: "Challenge declined",
      body: `${challenge.creatorName} declined the ${challenge.subjectName} challenge.`,
      data: {
        route: "/competition",
        challengeId: challenge.id,
        notificationType: "challenge_declined",
      },
    });
    challenge.accepterNotification = {
      ...challenge.accepterNotification,
      lastSuccessAt: Date.now(),
      lastStatus: "sent",
      lastError: undefined,
    };
  } catch (error) {
    challenge.accepterNotification = {
      ...challenge.accepterNotification,
      lastStatus: "failed",
      lastError: trimPushError(error),
    };
    throw error;
  }

  return true;
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

function buildCompetitionStandings(match) {
  const durationSeconds = Math.max(0, Math.floor((match.endAt - match.startAt) / 1000));
  const standings = match.players
    .map((player) => {
      const submission = match.submissions?.[player.playerId];
      const progress = match.liveProgress?.[player.playerId];
      return {
        playerId: player.playerId,
        playerName: player.name,
        score: submission?.score ?? progress?.score ?? 0,
        timeTakenSeconds: submission?.timeTakenSeconds ?? durationSeconds,
        finished: Boolean(submission),
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.finished !== right.finished) {
        return left.finished ? -1 : 1;
      }
      return left.timeTakenSeconds - right.timeTakenSeconds;
    });

  let previous = null;
  let previousPosition = 0;
  return standings.map((standing, index) => {
    const isTied =
      previous &&
      standing.score === previous.score &&
      standing.finished === previous.finished &&
      standing.timeTakenSeconds === previous.timeTakenSeconds;
    const position = isTied ? previousPosition : index + 1;
    previous = standing;
    previousPosition = position;
    return { ...standing, position };
  });
}

function getCompetitionOutcome(match, playerId) {
  ensureCompetitionResolved(match);
  const own = match.submissions[playerId];
  const opponent = match.players.find((player) => player.playerId !== playerId);
  const standings = buildCompetitionStandings(match);
  const ownStanding = standings.find((standing) => standing.playerId === playerId);
  const allSubmitted = Object.keys(match.submissions ?? {}).length >= match.players.length;
  const bestOther = standings.find((standing) => standing.playerId !== playerId);

  if (!own || !allSubmitted || !ownStanding) {
    return {
      status: "submitted",
      outcome: "pending",
      opponentName:
        match.mode === "group"
          ? `${Math.max(0, match.players.length - 1)} other participants`
          : opponent?.name ?? "Opponent",
      opponentId: opponent?.playerId,
      playerScore: own?.score ?? ownStanding?.score ?? 0,
      playerTimeTakenSeconds: own?.timeTakenSeconds,
      participantCount: match.players.length,
      mode: match.mode ?? "head_to_head",
      playerPosition: ownStanding?.position,
      standings,
    };
  }

  const winners = standings.filter((standing) => standing.position === 1);
  const outcome = ownStanding.position === 1 ? (winners.length > 1 ? "draw" : "won") : "lost";
  return {
    status: "completed",
    outcome,
    opponentName:
      match.mode === "group"
        ? `${Math.max(0, match.players.length - 1)} other participants`
        : opponent?.name ?? "Opponent",
    opponentId: opponent?.playerId,
    playerScore: own.score,
    opponentScore: bestOther?.score,
    playerTimeTakenSeconds: own.timeTakenSeconds,
    opponentTimeTakenSeconds: bestOther?.timeTakenSeconds,
    participantCount: match.players.length,
    mode: match.mode ?? "head_to_head",
    playerPosition: ownStanding.position,
    standings,
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
  const requestedCount = Math.max(1, Math.min(Number(body.questionCount ?? 10), 20));
  const candidateCount = Math.min(
    maxQuestionCandidates,
    Math.max(requestedCount + 4, Math.ceil(requestedCount * questionCandidateMultiplier))
  );
  const generationBody = { ...body, questionCount: candidateCount };
  const data = await createOpenAiResponse({
    schemaName: "competition_questions",
    schema: buildQuestionSchema(),
    instructions: [
      "You generate multiple-choice educational quiz questions for a mobile learning app competition.",
      "Return only factual, age-appropriate questions.",
      "Each question must have exactly 4 options, one correct answer, and a short explanation.",
      "Solve each question fully before writing the options.",
      "Check that the marked answer, the reasoning, and the explanation agree exactly before returning the question.",
      "If your explanation proves a different answer, rewrite the question and options so only one option remains correct.",
      "Never return a question with more than one defensible correct option.",
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
                ...generationBody,
                mode: "quiz",
              }),
              `Generate ${candidateCount} distinct candidates so uncertain or ambiguous items can be rejected before learners see them.`,
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const structurallyValid = validateGeneratedQuestions(data.questions, candidateCount);
  const verified = await verifyGeneratedQuestions(structurallyValid, body);
  if (verified.length === 0) {
    throw new Error("No generated questions passed independent verification.");
  }
  return verified.slice(0, requestedCount);
}

async function createCompetitionMatch(waiter, challenger) {
  const body = {
    ...challenger.body,
    profile: challenger.body.profile ?? waiter.body.profile,
  };
  const questions = await generateQuestionSet(body);
  const match = {
    id: randomUUID(),
    mode: "head_to_head",
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
    mode: "head_to_head",
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
    mode: "head_to_head",
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

function buildLearningLessonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      lesson: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          overview: { type: "string" },
          sections: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                heading: { type: "string" },
                content: { type: "string" },
              },
              required: ["heading", "content"],
            },
          },
          examples: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } },
          keyPoints: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
          practiceTip: { type: "string" },
        },
        required: ["title", "overview", "sections", "examples", "keyPoints", "practiceTip"],
      },
    },
    required: ["lesson"],
  };
}

function buildLearningHubAnswerSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      answer: { type: "string" },
    },
    required: ["answer"],
  };
}

async function handleQuestions(body, response) {
  const requestedCount = Math.max(1, Math.min(Number(body.questionCount ?? 10), 20));
  const candidateCount = Math.min(
    maxQuestionCandidates,
    Math.max(requestedCount + 4, Math.ceil(requestedCount * questionCandidateMultiplier))
  );
  const generationBody = { ...body, questionCount: candidateCount };
  const data = await createOpenAiResponse({
    schemaName: "quiz_questions",
    schema: buildQuestionSchema(),
    instructions: [
      "You generate multiple-choice educational quiz questions for a mobile learning app.",
      "Return only factual, age-appropriate questions.",
      "Each question must have exactly 4 options, one correct answer, and a short explanation.",
      "Solve each question fully before writing the options.",
      "Check that the marked answer, the reasoning, and the explanation agree exactly before returning the question.",
      "If your explanation proves a different answer, rewrite the question and options so only one option remains correct.",
      "Never return a question with more than one defensible correct option.",
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
              ...buildQuestionPromptLines(generationBody),
              `Generate ${candidateCount} distinct candidates so uncertain or ambiguous items can be rejected before learners see them.`,
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const structurallyValid = validateGeneratedQuestions(data.questions, candidateCount);
  const verified = await verifyGeneratedQuestions(structurallyValid, body);
  if (verified.length === 0) {
    throw new Error("No generated questions passed independent verification.");
  }

  sendJson(response, 200, {
    questions: verified.slice(0, requestedCount),
    source: "remote",
  });
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
              `Preferred curriculum: ${body.profile?.preferredCurriculum || "Not specified"}`,
              "When specified, tailor the study plan to the learner's preferred curriculum as well as the target exam.",
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
      "Keep it entertaining, engaging, informative, age-appropriate, academically accurate, and encouraging.",
      "Blend relief, curiosity, and enjoyment so the breather feels refreshing after tests, not dry or heavy.",
      "Where it fits naturally, include interesting history, background stories, discoveries, notable people, or memorable real-world context inside the subject or course.",
      "The content should still stay clearly connected to the learner's subject, topic focus, level, and academic stage.",
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
              `Successful sessions completed: ${body.successfulSessionCount ?? 0}`,
              `Mode: ${body.mode ?? "quiz"}`,
              `Difficulty: ${body.difficulty ?? "Beginner"}`,
              `Question focus: ${body.focusMode === "topic" ? `Topic only (${body.topicLabel ?? body.topicId ?? "selected topic"})` : "General mixed practice"}`,
              `Selected focus label: ${focusLabel}`,
              `App variant: ${body.appVariant ?? "children"}`,
              `Audience: ${body.appAudienceLabel ?? "General learners"}`,
              `Learner language: ${body.learnerLanguageLabel ?? "English"}`,
              `Learner age: ${body.profile?.age ?? "Unknown"}`,
              `Target exam: ${body.profile?.targetExam ?? "General study"}`,
              `Preferred curriculum: ${body.profile?.preferredCurriculum || "Not specified"}`,
              "When specified, keep the content consistent with the learner's preferred curriculum as well as the target exam.",
              `Subject guidance: ${body.subject?.aiPromptHint ?? ""}`,
              `Variant guidance: ${body.appGuidance ?? ""}`,
              `Academic stage guidance: ${describeAcademicStage(body)}`,
              "Create a short breather that teaches something real inside this subject or course while also being enjoyable and mentally refreshing.",
              "The content may be a poem, light story, reading passage, concept note, applied reflection, mini lesson, historical spotlight, or discovery-based subject nugget depending on the learner stage.",
              "Prefer memorable, entertaining, and informative subject-linked content over dry textbook explanation.",
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

async function handleLearningLesson(body, response) {
  const data = await createOpenAiResponse({
    schemaName: "learning_hub_lesson",
    schema: buildLearningLessonSchema(),
    instructions: [
      "You are an expert teacher creating a focused lesson for the Quiks Learning Hub.",
      "Teach the requested subject and topic at the specified grade and app-variant academic standard.",
      "Use clear explanations, a logical teaching sequence, worked or practical examples, key points, and a useful practice tip.",
      "If answer context is supplied, identify and teach the underlying concept rather than merely repeating the answer.",
      "Keep the lesson age-appropriate, academically accurate, and in the learner's selected language.",
      "Follow the learner's preferred curriculum and target exam when provided.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Subject/Course: ${body.subjectName ?? "Unknown"}`,
              `Topic: ${body.topicName ?? "General overview"}`,
              `Grade/Band: ${body.grade ?? "Unknown"}`,
              `Answer context: ${body.context || "None"}`,
              `App variant: ${body.appVariant ?? "children"}`,
              `Audience: ${body.appAudienceLabel ?? "General learners"}`,
              `Learner age: ${body.profile?.age ?? "Unknown"}`,
              `Target exam: ${body.profile?.targetExam ?? "General study"}`,
              `Preferred curriculum: ${body.profile?.preferredCurriculum || "Not specified"}`,
              `Variant guidance: ${body.appGuidance ?? ""}`,
              `Write the entire lesson in ${body.learnerLanguageLabel ?? "English"}.`,
            ].join("\n"),
          },
        ],
      },
    ],
  });

  sendJson(response, 200, { lesson: data.lesson });
}

async function handleLearningHubQuestion(body, response) {
  if (typeof body.question !== "string" || !body.question.trim()) {
    sendJson(response, 400, { error: "Enter a question to continue." });
    return;
  }

  const data = await createOpenAiResponse({
    schemaName: "learning_hub_answer",
    schema: buildLearningHubAnswerSchema(),
    instructions: [
      "Answer the user's direct question clearly, accurately, and as a self-contained response.",
      "Explain the reasoning or process instead of returning only a short final answer.",
      "Use a concise worked example when it improves understanding.",
      "Respond in the language used by the question and avoid unnecessary jargon.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: body.question.trim(),
          },
        ],
      },
    ],
  });

  sendJson(response, 200, { answer: data.answer });
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
        opponentId: outcome.opponentId,
        playerScore: outcome.playerScore,
        opponentScore: outcome.opponentScore,
        playerTimeTakenSeconds: outcome.playerTimeTakenSeconds,
        opponentTimeTakenSeconds: outcome.opponentTimeTakenSeconds,
        participantCount: outcome.participantCount,
        mode: outcome.mode,
        playerPosition: outcome.playerPosition,
        standings: outcome.standings,
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

function startGroupCompetition(group) {
  if (group.competitionId) {
    return competitionMatches.get(group.competitionId);
  }

  if (group.participants.length < 2) {
    group.status = "cancelled_insufficient_players";
    return null;
  }

  const players = group.participants.map((participant) => ({
    playerId: participant.playerId,
    name: participant.playerName,
  }));
  const liveProgress = Object.fromEntries(
    players.map((player) => [
      player.playerId,
      {
        playerId: player.playerId,
        playerName: player.name,
        answeredCount: 0,
        correctAnswers: 0,
        score: 0,
        finished: false,
      },
    ])
  );
  const match = {
    id: randomUUID(),
    mode: "group",
    groupCompetitionId: group.id,
    subjectId: group.subjectId,
    grade: group.grade,
    level: group.level,
    difficulty: group.difficulty,
    focusMode: group.focusMode,
    topicId: group.topicId,
    topicLabel: group.topicLabel,
    questions: group.questions,
    players,
    chats: [],
    liveProgress,
    submissions: {},
    createdAt: Date.now(),
    startAt: group.startAt,
    endAt: group.endAt,
  };

  competitionMatches.set(match.id, match);
  for (const player of players) {
    competitionMatchByPlayer.set(player.playerId, match.id);
  }
  group.status = "started";
  group.competitionId = match.id;
  return match;
}

function refreshGroupCompetitionState(group) {
  if (group.status === "started" || group.status === "cancelled_insufficient_players") {
    return group.competitionId ? competitionMatches.get(group.competitionId) : null;
  }
  if (Date.now() < group.startAt) {
    return null;
  }
  group.status = "starting";
  return startGroupCompetition(group);
}

async function handleGroupCompetitionCreate(body, response) {
  const profile = body.profile;
  const requestedStartAt = Number(body.startAt);
  if (!profile?.id || !body.subject?.id || !body.grade || !body.level || !Number.isFinite(requestedStartAt)) {
    sendJson(response, 400, { error: "Group competition request is missing required fields." });
    return;
  }

  const now = Date.now();
  if (requestedStartAt < now + 30000) {
    sendJson(response, 400, { error: "Group competition start time must be at least 30 seconds from now." });
    return;
  }
  if (requestedStartAt > now + 30 * 24 * 60 * 60 * 1000) {
    sendJson(response, 400, { error: "Group competition start time cannot be more than 30 days away." });
    return;
  }

  const durationSeconds = Math.max(30, Number(body.durationSeconds ?? 120));
  const questions = await generateQuestionSet(body);
  const group = {
    id: randomUUID(),
    code: createGroupCompetitionCode(),
    status: "scheduled",
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
    questions,
    body,
    durationSeconds,
    createdAt: now,
    startAt: requestedStartAt,
    endAt: requestedStartAt + durationSeconds * 1000,
    participants: [
      {
        playerId: profile.id,
        playerName: profile.name ?? "Learner",
        joinedAt: now,
      },
    ],
  };

  groupCompetitions.set(group.id, group);
  groupCompetitionByCode.set(group.code, group.id);
  sendJson(response, 200, {
    status: group.status,
    groupCompetition: buildGroupCompetitionSummary(group),
  });
}

async function handleGroupCompetitionJoin(body, response) {
  const profile = body.profile;
  const group = findGroupCompetition(body);
  if (!profile?.id || !group) {
    sendJson(response, 404, { error: "Group competition code was not found." });
    return;
  }

  refreshGroupCompetitionState(group);
  if (group.status !== "scheduled") {
    sendJson(response, 400, {
      error:
        group.status === "cancelled_insufficient_players"
          ? "This group competition was cancelled because too few people joined."
          : "This group competition has already started.",
      status: group.status,
      groupCompetition: buildGroupCompetitionSummary(group),
    });
    return;
  }

  const existingParticipant = group.participants.find((participant) => participant.playerId === profile.id);
  if (!existingParticipant) {
    group.participants.push({
      playerId: profile.id,
      playerName: profile.name ?? "Learner",
      joinedAt: Date.now(),
    });
  }

  sendJson(response, 200, {
    status: group.status,
    groupCompetition: buildGroupCompetitionSummary(group),
  });
}

async function handleGroupCompetitionStatus(body, response) {
  const group = findGroupCompetition(body);
  if (!group) {
    sendJson(response, 404, { error: "Group competition was not found." });
    return;
  }
  if (!body.playerId || !group.participants.some((participant) => participant.playerId === body.playerId)) {
    sendJson(response, 403, { error: "Join this group competition before viewing its lobby." });
    return;
  }

  const match = refreshGroupCompetitionState(group);
  sendJson(response, 200, {
    status: group.status,
    groupCompetition: buildGroupCompetitionSummary(group),
    competition: match ? buildCompetitionPayload(match, body.playerId) : undefined,
  });
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

  const creatorRegistration = getPushRegistrationSnapshot(profile.id);
  challenge.creatorNotification = {
    registrationPresent: creatorRegistration.registrationPresent,
    tokenUpdatedAt: creatorRegistration.tokenUpdatedAt,
    lastStatus: creatorRegistration.registrationPresent ? "pending" : "not_registered",
  };
  challenge.accepterNotification = {
    registrationPresent: false,
    lastStatus: "pending",
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

  challenge.status = "awaiting_creator_confirmation";
  challenge.acceptedAt = Date.now();
  challenge.acceptedById = body.profile.id;
  challenge.acceptedByName = body.profile.name ?? "Learner";
  challenge.competitionId = undefined;
  void notifyChallengeCreatorAccepted(challenge, body.profile).catch(() => undefined);
  sendJson(response, 200, {
    status: "awaiting_creator_confirmation",
    challenge: buildChallengeSummary(challenge),
  });
}

async function handlePushTokenRegister(body, response) {
  if (!body.playerId || !body.token) {
    sendJson(response, 400, { error: "Missing playerId or token." });
    return;
  }

  const registeredAt = Date.now();
  pushTokensByPlayer.set(body.playerId, {
    token: body.token,
    language: body.language ?? "en",
    profileName: body.profileName ?? "Learner",
    updatedAt: registeredAt,
  });

  sendJson(response, 200, { ok: true, registeredAt });
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

  sendJson(response, 200, { status: challenge.status ?? "open", challenge: buildChallengeSummary(challenge) });
}

async function handleChallengeCreatorDecision(body, response) {
  const challenge = competitionChallenges.get(body.challengeId);
  if (!challenge) {
    sendJson(response, 404, { error: "Challenge not found." });
    return;
  }

  if (challenge.creatorId !== body.playerId) {
    sendJson(response, 403, { error: "Only the challenge creator can make this decision." });
    return;
  }

  if (challenge.status !== "awaiting_creator_confirmation") {
    sendJson(response, 400, {
      error: "Challenge is no longer waiting for creator confirmation.",
      status: challenge.status ?? "open",
      challenge: buildChallengeSummary(challenge),
    });
    return;
  }

  if (body.decision === "decline") {
    challenge.status = "declined";
    challenge.declinedAt = Date.now();
    void notifyChallengeAccepterDeclined(challenge).catch(() => undefined);
    sendJson(response, 200, {
      status: "declined",
      challenge: buildChallengeSummary(challenge),
    });
    return;
  }

  const accepterProfile = {
    id: challenge.acceptedById,
    name: challenge.acceptedByName ?? "Learner",
  };
  const match = await createChallengeCompetition(challenge, accepterProfile);
  void notifyChallengeAccepterConfirmed(challenge, match).catch(() => undefined);
  sendJson(response, 200, {
    status: "accepted",
    challenge: buildChallengeSummary(challenge),
    competition: buildCompetitionPayload(match, body.playerId),
  });
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

async function handleClassroomInviteLinkAccept(body, response) {
  if (!body.studentProfile?.id || !body.classCode?.trim()) {
    sendJson(response, 400, { error: "Student profile and invitation class code are required." });
    return;
  }

  const payload = await acceptClassInviteLink(
    body.studentProfile,
    body.classCode,
    body.appVariant ?? "children"
  );
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
      verifierModel: openAiVerifierModel,
      verifierReasoningEffort: openAiVerifierReasoningEffort,
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

    if (url.pathname === "/learning-hub/lesson") {
      await handleLearningLesson(body, response);
      return;
    }

    if (url.pathname === "/learning-hub/ask") {
      await handleLearningHubQuestion(body, response);
      return;
    }

    if (url.pathname === "/competition/join") {
      await handleCompetitionJoin(body, response);
      return;
    }

    if (url.pathname === "/competition/group/create") {
      await handleGroupCompetitionCreate(body, response);
      return;
    }

    if (url.pathname === "/competition/group/join") {
      await handleGroupCompetitionJoin(body, response);
      return;
    }

    if (url.pathname === "/competition/group/status") {
      await handleGroupCompetitionStatus(body, response);
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

    if (url.pathname === "/competition/challenge/creator-decision") {
      await handleChallengeCreatorDecision(body, response);
      return;
    }

    if (url.pathname === "/competition/challenge/status") {
      await handleChallengeStatus(body, response);
      return;
    }

    if (url.pathname === "/notifications/register-push-token") {
      await handlePushTokenRegister(body, response);
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

    if (url.pathname === "/subscriptions/status") {
      await handleSubscriptionStatus(body, response);
      return;
    }

    if (url.pathname === "/subscriptions/paddle/sync") {
      await handlePaddleSubscriptionSync(body, response);
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

    if (url.pathname === "/classroom/classes/invite-link/accept") {
      await handleClassroomInviteLinkAccept(body, response);
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
    sendJson(response, getClientErrorStatus(error) ?? 500, {
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
});

server.listen(port, () => {
  console.log(`OpenAI proxy listening on http://localhost:${port}`);
});

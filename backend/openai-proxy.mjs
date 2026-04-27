import http from "node:http";
import { URL } from "node:url";

const port = Number(process.env.PORT || 8787);
const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

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
    `Learner age: ${body.profile?.age ?? "Unknown"}`,
    `Target exam: ${body.profile?.targetExam ?? "General study"}`,
    `Subject guidance: ${body.subject?.aiPromptHint ?? ""}`,
    `Variant guidance: ${body.appGuidance ?? ""}`,
    `Academic stage guidance: ${describeAcademicStage(body)}`,
    body.focusMode === "topic"
      ? "Generate questions only from the selected topic. Do not mix in unrelated topics."
      : "Use a healthy spread of topics within the subject or course.",
    "Treat the provided grade/band and level as mandatory signals for academic standard.",
    "The set must reflect the true reasoning level expected for the class, band, and app variant.",
    "Avoid over-simplified filler questions that belong to a lower academic stage.",
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
        minItems: 3,
        maxItems: 5,
        items: { type: "string" },
      },
    },
    required: ["plan"],
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
      "If the course is university-level, produce genuine undergraduate-style questions rather than simplified school questions.",
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
              `Variant guidance: ${body.appGuidance ?? ""}`,
              `Learner age: ${body.profile?.age ?? "Unknown"}`,
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
      "Return 3 to 5 action steps.",
      "Each action should be concrete, realistic, and written in simple language.",
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
              `Variant guidance: ${body.appGuidance ?? ""}`,
              `Learner age: ${body.profile?.age ?? "Unknown"}`,
              `Target exam: ${body.profile?.targetExam ?? "General study"}`,
            ].join("\n"),
          },
        ],
      },
    ],
  });

  sendJson(response, 200, { plan: data.plan });
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

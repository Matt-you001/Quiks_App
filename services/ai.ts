import Constants from "expo-constants";
import { appVariant } from "../lib/app-variant";
import { getLanguageLabel, normalizeLanguage } from "../lib/i18n";
import { getLocalQuestions } from "../lib/question-bank";
import type {
  BreatherContent,
  BreatherRequest,
  CompetitionJoinRequest,
  CompetitionJoinResponse,
  CompetitionChallengeAcceptRequest,
  CompetitionChallengeAcceptResponse,
  CompetitionChatSendRequest,
  CompetitionChatSendResponse,
  CompetitionChallengeCreateRequest,
  CompetitionChallengeCreateResponse,
  CompetitionChallengeListRequest,
  CompetitionChallengeListResponse,
  CompetitionLeaderboardRequest,
  CompetitionLeaderboardResponse,
  CompetitionRematchAcceptRequest,
  CompetitionRematchRequest,
  CompetitionRematchResponse,
  CompetitionRematchStatusRequest,
  CompetitionChallengeStatusRequest,
  CompetitionChallengeStatusResponse,
  CompetitionProgressUpdateRequest,
  CompetitionProgressUpdateResponse,
  CompetitionStatusRequest,
  CompetitionStatusResponse,
  CompetitionSubmitRequest,
  CompetitionSubmitResponse,
  CoachPlanRequest,
  FeedbackRequest,
  Question,
  QuestionRequest,
  QuestionResponse,
} from "../types/app";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const apiUrl = process.env.EXPO_PUBLIC_AI_API_URL ?? extra.EXPO_PUBLIC_AI_API_URL;
const apiKey = process.env.EXPO_PUBLIC_AI_API_KEY ?? extra.EXPO_PUBLIC_AI_API_KEY;
const aiMode = process.env.EXPO_PUBLIC_AI_MODE ?? extra.EXPO_PUBLIC_AI_MODE ?? "demo";
const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? extra.EXPO_PUBLIC_GEMINI_API_KEY;
const geminiModel = process.env.EXPO_PUBLIC_GEMINI_MODEL ?? extra.EXPO_PUBLIC_GEMINI_MODEL ?? "gemini-2.5-flash";

function describeDifficultyRigour(request: QuestionRequest) {
  if (request.difficulty === "Beginner") {
    return [
      "Beginner does not mean childish or below the learner's class band.",
      "It means accessible entry-level questions for this exact variant, grade, and level.",
      "Use foundational concepts, but keep the content firmly inside the correct academic stage.",
    ].join(" ");
  }

  if (request.difficulty === "Intermediate") {
    return [
      "Intermediate should require solid understanding, correct terminology, and multi-step reasoning typical of this class band.",
      "Questions should feel like normal in-class assessments for this learner stage, not revision for younger students.",
    ].join(" ");
  }

  if (request.difficulty === "Advanced") {
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

function describeAcademicStage(request: QuestionRequest) {
  const focusLabel =
    request.focusMode === "topic"
      ? request.topicLabel ?? request.topicId ?? "selected topic"
      : `general ${request.subject.name} coverage`;

  if (appVariant.id === "children") {
    return [
      `This learner is in ${request.grade}, which should be treated as a real primary-school class level for ages roughly 5 to 12.`,
      `Level ${request.level} means progression depth inside the class, not a random difficulty jump.`,
      "Use concrete, school-appropriate examples, short wording, and clear single-skill or two-step reasoning.",
      "Do not generate secondary-school or university-style abstraction unless the class level truly supports it.",
      `The set should feel like authentic primary-school ${request.subject.name.toLowerCase()} practice focused on ${focusLabel.toLowerCase()}.`,
    ].join(" ");
  }

  if (appVariant.id === "teens") {
    return [
      `This learner is in ${request.grade}, which should be treated as a real secondary-school or college class level for ages roughly 11 to 20.`,
      `Level ${request.level} means progression depth within that class and should reflect increasingly stronger WAEC/NECO/JAMB-style reasoning where appropriate.`,
      "Use authentic school-subject language, stronger interpretation, and multi-step problem solving suited to junior or senior secondary learners.",
      "Do not simplify the content down to primary-school level, and do not jump to specialized university framing unless the subject naturally demands it.",
      `The set should feel like credible secondary-school ${request.subject.name.toLowerCase()} work focused on ${focusLabel.toLowerCase()}.`,
    ].join(" ");
  }

  return [
    "This learner is in the University band and should receive true tertiary-level course content.",
    `For Quiks Uni, treat ${request.subject.name} as a university course, not a school subject.`,
    `Level ${request.level} means course progression depth: Level 1 should feel like first-year university foundations, while higher levels should show more abstraction, formalism, application, and analytical reasoning.`,
    "Use correct academic terminology, concept-based reasoning, and realistic undergraduate question styles.",
    "Do not downgrade Mathematics, Law, Engineering, Medicine, Management Studies, or any other course to primary- or secondary-school material.",
    `The set should feel like authentic introductory or intermediate university ${request.subject.name.toLowerCase()} work focused on ${focusLabel.toLowerCase()}.`,
  ].join(" ");
}

function buildPromptLines(request: QuestionRequest) {
  const language = normalizeLanguage(request.profile?.language);
  return [
    `Subject/Course: ${request.subject.name}`,
    `Grade/Band: ${request.grade}`,
    `Difficulty: ${request.difficulty}`,
    `Mode: ${request.mode}`,
    `Level: ${request.level}`,
    `Question focus: ${request.focusMode === "topic" ? `Topic only (${request.topicLabel ?? request.topicId ?? "selected topic"})` : "General mixed practice"}`,
    `Question count: ${request.questionCount}`,
    `App audience: ${appVariant.appName} (${appVariant.audienceLabel})`,
    `Learner language: ${getLanguageLabel(language)}`,
    `Learner target exam: ${request.profile?.targetExam ?? "General study"}`,
    `Subject guidance: ${request.subject.aiPromptHint}`,
    `Variant guidance: ${appVariant.aiGuidance}`,
    `Academic stage guidance: ${describeAcademicStage(request)}`,
    `Difficulty rigour guidance: ${describeDifficultyRigour(request)}`,
    request.focusMode === "topic"
      ? "Generate questions only from the selected topic. Do not mix unrelated topics into this set."
      : "Use a healthy mix of topics within the subject or course.",
    "Treat the provided grade/band and level as mandatory signals for academic standard.",
    "Treat the selected difficulty as a mandatory signal for reasoning depth inside that academic stage.",
    "The questions must match the real reasoning level expected for that class, band, level, difficulty, and app variant.",
    "Avoid generic filler, placeholders, or over-simplified questions that belong to a lower academic stage.",
    "Never answer a teens or university request with primary-school style content.",
    `Write all question prompts, answer options, and explanations in ${getLanguageLabel(language)}.`,
  ];
}

async function postJson<TRequest, TResponse>(path: string, body: TRequest): Promise<TResponse> {
  if (!apiUrl) {
    throw new Error("AI API URL is not configured.");
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`AI request failed with status ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

function withVariantMeta<T extends object>(body: T) {
  const profile = "profile" in body ? (body as { profile?: { language?: string } | null }).profile : null;
  const language = normalizeLanguage(profile?.language);
  return {
    ...body,
    appVariant: appVariant.id,
    appAudienceLabel: appVariant.audienceLabel,
    appGuidance: appVariant.aiGuidance,
    learnerLanguage: language,
    learnerLanguageLabel: getLanguageLabel(language),
  };
}

function buildDemoQuestions(request: QuestionRequest): Question[] {
  const focusLabel =
    request.focusMode === "topic" && request.topicLabel ? `${request.topicLabel} in ${request.subject.name}` : request.subject.name;
  const base = [
    {
      stem: `Which option best matches this ${focusLabel.toLowerCase()} concept?`,
      explanation: "The correct option is the one that directly matches the concept being practiced.",
    },
    {
      stem: `Choose the most accurate answer for this ${request.grade} ${focusLabel.toLowerCase()} problem.`,
      explanation: "A strong answer uses the key rule or idea for this topic.",
    },
    {
      stem: "Your AI coach wants to check your understanding. What is the best answer?",
      explanation: "Look for the option that follows the clearest logic, not just the one that looks familiar.",
    },
  ];

  return Array.from({ length: request.questionCount }, (_, index) => {
    const template = base[index % base.length];
    const label =
      request.focusMode === "topic" && request.topicLabel
        ? `${request.topicLabel} Level ${request.level}`
        : `${request.subject.name} Level ${request.level}`;
    const correct = `${label} answer ${index + 1}`;
    return {
      id: `${request.subject.id}-${request.level}-${index + 1}`,
      prompt: `${template.stem} (${request.difficulty}, question ${index + 1})`,
      options: [
        correct,
        `${label} distractor A`,
        `${label} distractor B`,
        `${label} distractor C`,
      ],
      answer: correct,
      explanation: `${template.explanation} ${request.subject.aiPromptHint}`,
    };
  });
}

function validateQuestions(questions: Question[], expectedCount: number) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("AI did not return any questions.");
  }

  const cleaned = questions
    .filter((question) => {
      return (
        typeof question.prompt === "string" &&
        Array.isArray(question.options) &&
        question.options.length === 4 &&
        typeof question.answer === "string" &&
        question.options.includes(question.answer) &&
        typeof question.explanation === "string"
      );
    })
    .slice(0, expectedCount)
    .map((question, index) => ({
      id: question.id || `ai-${index + 1}-${Date.now()}`,
      prompt: question.prompt.trim(),
      options: question.options.map((option) => option.trim()),
      answer: question.answer.trim(),
      explanation: question.explanation.trim(),
    }));

  if (cleaned.length === 0) {
    throw new Error("AI returned invalid question data.");
  }

  return cleaned;
}

async function generateWithGemini(request: QuestionRequest): Promise<QuestionResponse> {
  if (!geminiApiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const prompt = [
    "Generate a JSON object with a `questions` array for a mobile quiz app.",
    ...buildPromptLines(request),
    "Return only valid JSON.",
    "Each question must include: id, prompt, options, answer, explanation.",
    "Each question must have exactly 4 options and one correct answer that matches one option exactly.",
    "Keep the content age-appropriate and factually correct.",
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          response_mime_type: "application/json",
          response_schema: {
            type: "OBJECT",
            properties: {
              questions: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING" },
                    prompt: { type: "STRING" },
                    options: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                    },
                    answer: { type: "STRING" },
                    explanation: { type: "STRING" },
                  },
                  required: ["id", "prompt", "options", "answer", "explanation"],
                },
              },
            },
            required: ["questions"],
          },
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini did not return text content.");
  }

  const parsed = JSON.parse(text) as { questions: Question[] };
  return {
    questions: validateQuestions(parsed.questions, request.questionCount),
    source: "remote",
  };
}

export async function generateQuestions(request: QuestionRequest): Promise<QuestionResponse> {
  const localQuestions = getLocalQuestions(request);

  if (aiMode !== "demo") {
    try {
      if (apiUrl) {
        return postJson("/questions", withVariantMeta(request));
      }

      if (geminiApiKey) {
        return generateWithGemini(request);
      }
    } catch {
      if (localQuestions.length >= request.questionCount) {
        return {
          questions: localQuestions,
          source: "local",
        };
      }
    }
  }

  if (localQuestions.length >= request.questionCount) {
    return {
      questions: localQuestions,
      source: "local",
    };
  }

  return {
    questions: buildDemoQuestions(request),
    source: "demo",
  };
}

export async function generateFeedback(request: FeedbackRequest): Promise<string> {
  if (apiUrl && aiMode !== "demo") {
    try {
      const response = await postJson<Record<string, unknown>, { feedback: string }>(
        "/feedback",
        withVariantMeta(request) as unknown as Record<string, unknown>
      );
      return response.feedback;
    } catch {
      // Fall back to local feedback so session completion is never blocked.
    }
  }

  if (request.score >= 85) {
    return `Excellent work in ${request.topicLabel ?? request.subject.name}. Your accuracy shows real confidence at ${request.grade} level.`;
  }

  if (request.score >= 70) {
    return `Strong effort. You are building solid momentum in ${request.topicLabel ?? request.subject.name}, and a little review will push you even higher.`;
  }

  return `You are still learning, and that is progress. Focus on the fundamentals in ${request.topicLabel ?? request.subject.name} and try another round with your AI coach.`;
}

export async function generateCoachPlan(request: CoachPlanRequest): Promise<string[]> {
  if (apiUrl && aiMode !== "demo") {
    try {
      const response = await postJson<Record<string, unknown>, { plan: string[] }>(
        "/coach-plan",
        withVariantMeta(request) as unknown as Record<string, unknown>
      );
      return response.plan;
    } catch {
      // Fall back to a local study plan so results can still render.
    }
  }

  return [
    `Review ${(request.topicLabel ?? request.subject.name).toLowerCase()} for 10 minutes.`,
    `Redo level ${request.level} in training mode.`,
  ];
}

export async function generateBreather(request: BreatherRequest): Promise<BreatherContent> {
  if (apiUrl && aiMode !== "demo") {
    const response = await postJson<Record<string, unknown>, { breather: BreatherContent }>(
      "/breather",
      withVariantMeta(request) as unknown as Record<string, unknown>
    );
    return response.breather;
  }

  throw new Error("Live breather generation is unavailable.");
}

export async function joinCompetition(request: CompetitionJoinRequest): Promise<CompetitionJoinResponse> {
  return postJson("/competition/join", withVariantMeta(request));
}

export async function createCompetitionChallenge(
  request: CompetitionChallengeCreateRequest
): Promise<CompetitionChallengeCreateResponse> {
  return postJson("/competition/challenge/create", withVariantMeta(request));
}

export async function listCompetitionChallenges(
  request: CompetitionChallengeListRequest
): Promise<CompetitionChallengeListResponse> {
  return postJson("/competition/challenge/list", withVariantMeta(request));
}

export async function acceptCompetitionChallenge(
  request: CompetitionChallengeAcceptRequest
): Promise<CompetitionChallengeAcceptResponse> {
  return postJson("/competition/challenge/accept", withVariantMeta(request));
}

export async function getCompetitionLeaderboard(
  request: CompetitionLeaderboardRequest
): Promise<CompetitionLeaderboardResponse> {
  return postJson("/competition/leaderboard", withVariantMeta(request));
}

export async function requestCompetitionRematch(
  request: CompetitionRematchRequest
): Promise<CompetitionRematchResponse> {
  return postJson("/competition/rematch/request", withVariantMeta(request));
}

export async function getCompetitionRematchStatus(
  request: CompetitionRematchStatusRequest
): Promise<CompetitionRematchResponse> {
  return postJson("/competition/rematch/status", withVariantMeta(request));
}

export async function acceptCompetitionRematch(
  request: CompetitionRematchAcceptRequest
): Promise<CompetitionRematchResponse> {
  return postJson("/competition/rematch/accept", withVariantMeta(request));
}

export async function getCompetitionChallengeStatus(
  request: CompetitionChallengeStatusRequest
): Promise<CompetitionChallengeStatusResponse> {
  return postJson("/competition/challenge/status", withVariantMeta(request));
}

export async function getCompetitionStatus(request: CompetitionStatusRequest): Promise<CompetitionStatusResponse> {
  return postJson("/competition/status", withVariantMeta(request));
}

export async function updateCompetitionProgress(
  request: CompetitionProgressUpdateRequest
): Promise<CompetitionProgressUpdateResponse> {
  return postJson("/competition/progress", withVariantMeta(request));
}

export async function submitCompetitionResult(request: CompetitionSubmitRequest): Promise<CompetitionSubmitResponse> {
  return postJson("/competition/submit", withVariantMeta(request));
}

export async function sendCompetitionChat(request: CompetitionChatSendRequest): Promise<CompetitionChatSendResponse> {
  return postJson("/competition/chat", withVariantMeta(request));
}

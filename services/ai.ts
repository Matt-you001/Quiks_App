import Constants from "expo-constants";
import { getLocalQuestions } from "../lib/question-bank";
import type {
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
    `Subject: ${request.subject.name}`,
    `Grade: ${request.grade}`,
    `Difficulty: ${request.difficulty}`,
    `Mode: ${request.mode}`,
    `Level: ${request.level}`,
    `Question focus: ${request.focusMode === "topic" ? `Topic only (${request.topicLabel ?? request.topicId ?? "selected topic"})` : "General mixed practice"}`,
    `Question count: ${request.questionCount}`,
    `Learner target exam: ${request.profile?.targetExam ?? "General study"}`,
    `Guidance: ${request.subject.aiPromptHint}`,
    request.focusMode === "topic"
      ? "Generate questions only from the selected topic. Do not mix unrelated topics into this set."
      : "Use a healthy mix of topics within the subject.",
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
        return postJson<QuestionRequest, QuestionResponse>("/questions", request);
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
      const response = await postJson<FeedbackRequest, { feedback: string }>("/feedback", request);
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
      const response = await postJson<CoachPlanRequest, { plan: string[] }>("/coach-plan", request);
      return response.plan;
    } catch {
      // Fall back to a local study plan so results can still render.
    }
  }

  return [
    `Review ${(request.topicLabel ?? request.subject.name).toLowerCase()} foundations for 10 minutes before the next session.`,
    `Redo level ${request.level} in training mode and read each explanation out loud.`,
    `Ask the AI coach for one more practice set focused on ${request.grade} weak spots.`,
  ];
}

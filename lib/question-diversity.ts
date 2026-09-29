import type { Question } from "../types/app";

const genericWords = new Set([
  "a", "an", "and", "answer", "as", "best", "choose", "correct", "does", "for", "from",
  "has", "in", "is", "it", "means", "most", "of", "option", "question", "select", "the",
  "this", "to", "what", "which", "word",
]);

function normalizeQuestion(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\b(means? the same as|same meaning as|similar in meaning to|synonym(?:ous)?(?: of| for)?)\b/g, " synonym ")
    .replace(/\b(means? the opposite of|opposite in meaning to|antonym(?: of| for)?)\b/g, " antonym ")
    .replace(/\bopposite\b/g, " antonym ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string) {
  return normalizeQuestion(value).split(" ").filter((token) => token && !genericWords.has(token));
}

function tooSimilar(left: string, right: string) {
  const normalizedLeft = normalizeQuestion(left);
  const normalizedRight = normalizeQuestion(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  const leftTokens = new Set(tokens(left));
  const rightTokens = new Set(tokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return false;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const bothShort = leftTokens.size <= 4 && rightTokens.size <= 4;
  return intersection / union >= (bothShort ? 0.6 : 0.72);
}

export function filterDiverseQuestions(questions: Question[], recentPrompts: string[] = []) {
  const accepted: Question[] = [];
  const comparisons = recentPrompts.filter(Boolean);
  for (const question of questions) {
    if (comparisons.some((prompt) => tooSimilar(question.prompt, prompt))) continue;
    accepted.push(question);
    comparisons.push(question.prompt);
  }
  return accepted;
}

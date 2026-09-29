const GENERIC_WORDS = new Set([
  "a", "an", "and", "answer", "as", "best", "choose", "correct", "does", "for", "from",
  "has", "in", "is", "it", "means", "most", "of", "option", "question", "select", "the",
  "this", "to", "what", "which", "word",
]);

export function normalizeQuestionForDiversity(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\b(means? the same as|same meaning as|similar in meaning to|synonym(?:ous)?(?: of| for)?)\b/g, " synonym ")
    .replace(/\b(means? the opposite of|opposite in meaning to|antonym(?: of| for)?)\b/g, " antonym ")
    .replace(/\bopposite\b/g, " antonym ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function diversityTokens(value) {
  return normalizeQuestionForDiversity(value)
    .split(" ")
    .filter((token) => token && !GENERIC_WORDS.has(token));
}

export function questionSimilarity(left, right) {
  const normalizedLeft = normalizeQuestionForDiversity(left);
  const normalizedRight = normalizeQuestionForDiversity(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const leftTokens = new Set(diversityTokens(left));
  const rightTokens = new Set(diversityTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

export function questionsAreTooSimilar(left, right) {
  const leftTokens = diversityTokens(left);
  const rightTokens = diversityTokens(right);
  const bothShort = leftTokens.length <= 4 && rightTokens.length <= 4;
  return questionSimilarity(left, right) >= (bothShort ? 0.6 : 0.72);
}

export function filterDistinctQuestions(questions, recentPrompts = []) {
  const accepted = [];
  const comparisonPrompts = recentPrompts.map(String).filter(Boolean);
  for (const question of Array.isArray(questions) ? questions : []) {
    const prompt = String(question?.prompt ?? "").trim();
    if (!prompt) continue;
    if (comparisonPrompts.some((previous) => questionsAreTooSimilar(prompt, previous))) continue;
    accepted.push(question);
    comparisonPrompts.push(prompt);
  }
  return accepted;
}

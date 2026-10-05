import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const configuredStorePath = String(process.env.PAST_QUESTION_STORE_PATH ?? "").trim();
const configuredSchoolStorePath = String(process.env.SCHOOL_STORE_PATH ?? "").trim();
const storePath = configuredStorePath
  ? isAbsolute(configuredStorePath) ? configuredStorePath : resolve(currentDirectory, configuredStorePath)
  : configuredSchoolStorePath
    ? join(dirname(isAbsolute(configuredSchoolStorePath) ? configuredSchoolStorePath : resolve(currentDirectory, configuredSchoolStorePath)), "past-question-store.json")
  : join(currentDirectory, "data", "past-question-store.json");
const temporaryStorePath = `${storePath}.tmp`;
const backupStorePath = `${storePath}.backup`;
const defaultStore = { version: 1, questionSets: {} };

let storeCache = null;
let mutationQueue = Promise.resolve();

const clone = (value) => JSON.parse(JSON.stringify(value));
const normalize = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
const normalizeSearch = (value) => normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function ensureStore() {
  await mkdir(dirname(storePath), { recursive: true });
  if (storeCache) return storeCache;
  try {
    const parsed = JSON.parse(await readFile(storePath, "utf8"));
    storeCache = { ...clone(defaultStore), ...parsed, questionSets: parsed.questionSets ?? {} };
  } catch (error) {
    if (error.code !== "ENOENT") {
      try {
        const parsed = JSON.parse(await readFile(backupStorePath, "utf8"));
        storeCache = { ...clone(defaultStore), ...parsed, questionSets: parsed.questionSets ?? {} };
        return storeCache;
      } catch {
        throw error;
      }
    }
    storeCache = clone(defaultStore);
    await writeFile(storePath, JSON.stringify(storeCache, null, 2), "utf8");
  }
  return storeCache;
}

async function persist(store) {
  try {
    await writeFile(backupStorePath, await readFile(storePath, "utf8"), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await writeFile(temporaryStorePath, JSON.stringify(store, null, 2), "utf8");
  await rename(temporaryStorePath, storePath);
}

async function mutate(mutator) {
  const operation = mutationQueue.catch(() => undefined).then(async () => {
    const store = clone(await ensureStore());
    const result = await mutator(store);
    await persist(store);
    storeCache = store;
    return result;
  });
  mutationQueue = operation;
  return operation;
}

function publicSet(item) {
  const { submittedBy, fingerprint, ...safe } = item;
  return clone(safe);
}

function fingerprintFor(payload) {
  return createHash("sha256").update(JSON.stringify({
    examTitle: normalizeSearch(payload.examTitle),
    year: normalize(payload.year),
    subject: normalizeSearch(payload.subject),
    questions: payload.questions.map((question) => [normalizeSearch(question.prompt), normalizeSearch(question.answer)]),
  })).digest("hex");
}

function questionComparisonText(question) {
  return normalizeSearch([
    question.prompt,
    ...(Array.isArray(question.options) ? question.options : []),
  ].join(" "));
}

function questionTokens(question) {
  return new Set(questionComparisonText(question).split(" ").filter((token) => token.length > 1));
}

function questionSimilarity(left, right) {
  const leftText = questionComparisonText(left);
  const rightText = questionComparisonText(right);
  if (!leftText || !rightText) return 0;
  if (leftText === rightText) return 1;

  const leftTokens = questionTokens(left);
  const rightTokens = questionTokens(right);
  if (leftTokens.size < 4 || rightTokens.size < 4) return 0;
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

function questionsMatch(left, right) {
  const similarity = questionSimilarity(left, right);
  if (similarity === 1) return true;
  const sameNumber = normalizeSearch(left.number) && normalizeSearch(left.number) === normalizeSearch(right.number);
  return sameNumber ? similarity >= 0.78 : similarity >= 0.92;
}

function samePaperMetadata(entry, payload) {
  return normalizeSearch(entry.examTitle) === normalizeSearch(payload.examTitle)
    && normalize(entry.year) === normalize(payload.year)
    && normalizeSearch(entry.subject) === normalizeSearch(payload.subject);
}

function findQuestionMatchIndex(questions, candidate) {
  return questions.findIndex((question) => questionsMatch(question, candidate));
}

function ensureUniqueQuestionId(questions, requestedId, fallbackIndex) {
  const usedIds = new Set(questions.map((question) => question.id));
  const baseId = normalize(requestedId) || `question-${fallbackIndex + 1}`;
  if (!usedIds.has(baseId)) return baseId;
  let suffix = 2;
  while (usedIds.has(`${baseId}-${suffix}`)) suffix += 1;
  return `${baseId}-${suffix}`;
}

export async function savePastQuestionSet(principal, payload) {
  if (!payload.shareConfirmed) throw Object.assign(new Error("Confirm that you have permission to share this material."), { statusCode: 400 });
  const examTitle = normalize(payload.examTitle);
  const year = normalize(payload.year);
  const questions = Array.isArray(payload.questions) ? payload.questions.slice(0, 80).map((question, index) => ({
    id: normalize(question.id) || `question-${index + 1}`,
    number: normalize(question.number) || String(index + 1),
    prompt: normalize(question.prompt).slice(0, 5000),
    options: Array.isArray(question.options) ? question.options.map((option) => normalize(option).slice(0, 1000)).filter(Boolean).slice(0, 8) : [],
    answer: normalize(question.answer).slice(0, 5000),
    explanation: normalize(question.explanation).slice(0, 5000),
  })).filter((question) => question.prompt && question.answer) : [];
  if (!examTitle || !year || questions.length === 0) throw Object.assign(new Error("Exam title, year and at least one solved question are required."), { statusCode: 400 });
  const fingerprint = fingerprintFor({ examTitle, year, subject: payload.subject, questions });
  return mutate(async (store) => {
    const duplicate = Object.values(store.questionSets).find((entry) => entry.fingerprint === fingerprint);
    if (duplicate) return { item: publicSet(duplicate), duplicate: true, merged: false, addedQuestionCount: 0 };

    const paperCandidates = Object.values(store.questionSets)
      .filter((entry) => samePaperMetadata(entry, { examTitle, year, subject: payload.subject }))
      .map((entry) => ({
        entry,
        overlap: questions.filter((question) => findQuestionMatchIndex(entry.questions, question) >= 0).length,
      }))
      .filter((candidate) => candidate.overlap > 0)
      .sort((left, right) => right.overlap - left.overlap || right.entry.questionCount - left.entry.questionCount);

    const matchingPaper = paperCandidates[0]?.entry;
    if (matchingPaper) {
      const mergedQuestions = matchingPaper.questions.map((question) => ({ ...question }));
      let addedQuestionCount = 0;
      for (const question of questions) {
        if (findQuestionMatchIndex(mergedQuestions, question) >= 0) continue;
        if (mergedQuestions.length >= 160) break;
        mergedQuestions.push({
          ...question,
          id: ensureUniqueQuestionId(mergedQuestions, question.id, mergedQuestions.length),
        });
        addedQuestionCount += 1;
      }

      if (addedQuestionCount === 0) {
        return { item: publicSet(matchingPaper), duplicate: true, merged: false, addedQuestionCount: 0 };
      }

      matchingPaper.questions = mergedQuestions;
      matchingPaper.questionCount = matchingPaper.questions.length;
      matchingPaper.updatedAt = Date.now();
      matchingPaper.submissionCount = Math.max(1, Number(matchingPaper.submissionCount) || 1) + 1;
      matchingPaper.fingerprint = fingerprintFor({
        examTitle: matchingPaper.examTitle,
        year: matchingPaper.year,
        subject: matchingPaper.subject,
        questions: matchingPaper.questions,
      });
      return {
        item: publicSet(matchingPaper),
        duplicate: false,
        merged: true,
        addedQuestionCount,
      };
    }

    const item = {
      id: randomUUID(), examTitle, year, subject: normalize(payload.subject),
      appVariant: ["children", "teens", "uni"].includes(payload.appVariant) ? payload.appVariant : "children",
      questionCount: questions.length, questions, createdAt: Date.now(), updatedAt: Date.now(), submissionCount: 1,
      submittedBy: String(principal.principalId ?? principal.uid ?? ""), fingerprint,
    };
    store.questionSets[item.id] = item;
    return { item: publicSet(item), duplicate: false, merged: false, addedQuestionCount: questions.length };
  });
}

export async function searchPastQuestionLibrary(query) {
  const normalizedQuery = normalizeSearch(query);
  if (normalizedQuery.length < 2) return [];
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const store = await ensureStore();
  return Object.values(store.questionSets).map((item) => {
    const heading = normalizeSearch(`${item.examTitle} ${item.year} ${item.subject}`);
    const body = normalizeSearch(item.questions.map((question) => question.prompt).join(" "));
    const score = tokens.reduce((total, token) => total + (heading.includes(token) ? 5 : 0) + (body.includes(token) ? 1 : 0), 0);
    return { item, score };
  }).filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || right.item.createdAt - left.item.createdAt)
    .slice(0, 20).map((entry) => publicSet(entry.item));
}

export async function getPastQuestionGenerationContext({ targetExam, subject }) {
  const query = normalize(`${targetExam ?? ""} ${subject ?? ""}`);
  if (query.length < 2) return "";
  const matches = await searchPastQuestionLibrary(query);
  return matches.slice(0, 4).flatMap((set) => set.questions.slice(0, 5).map((question) =>
    `${set.examTitle} (${set.year})${set.subject ? ` ${set.subject}` : ""}: ${question.prompt}`
  )).join("\n").slice(0, 6000);
}

export function getPastQuestionStoreDiagnostics() {
  return { configured: Boolean(configuredStorePath || configuredSchoolStorePath), persistentPathExpected: storePath.startsWith("/var/data/") };
}

import assert from "node:assert/strict";
import test from "node:test";
import { filterDistinctQuestions, questionsAreTooSimilar } from "./question-diversity.mjs";

test("semantic duplicate detection catches reworded synonym and antonym questions", () => {
  assert.equal(questionsAreTooSimilar("Which word means the same as 'happy'?", "Choose a synonym for happy."), true);
  assert.equal(questionsAreTooSimilar("Which word is the opposite of empty?", "Select the antonym of 'empty'."), true);
  assert.equal(questionsAreTooSimilar("Choose a synonym for rapid.", "Choose a synonym for careful."), false);
});

test("question filtering rejects recent and in-set duplicates but keeps distinct targets", () => {
  const questions = [
    { prompt: "Choose a synonym for happy." },
    { prompt: "Which word means the same as 'happy'?" },
    { prompt: "Choose an antonym for narrow." },
  ];
  assert.deepEqual(
    filterDistinctQuestions(questions, ["Select the synonym of happy."]).map((question) => question.prompt),
    ["Choose an antonym for narrow."]
  );
});

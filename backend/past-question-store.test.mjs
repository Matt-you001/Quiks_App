import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("past-question library saves, deduplicates, searches and removes private identity", async () => {
  const directory = await mkdtemp(join(tmpdir(), "quiks-past-questions-"));
  const path = join(directory, "store.json");
  process.env.PAST_QUESTION_STORE_PATH = path;
  const store = await import(`./past-question-store.mjs?test=${Date.now()}`);
  const payload = {
    examTitle: "WAEC Biology",
    year: "2025",
    subject: "Biology",
    appVariant: "teens",
    shareConfirmed: true,
    questions: [{ id: "q1", number: "1", prompt: "Which organelle controls the cell?", options: ["Nucleus", "Ribosome"], answer: "Nucleus", explanation: "The nucleus contains genetic material." }],
  };
  const created = await store.savePastQuestionSet({ principalId: "private-user" }, payload);
  assert.equal(created.duplicate, false);
  assert.equal(created.item.submittedBy, undefined);
  const duplicate = await store.savePastQuestionSet({ principalId: "another-user" }, payload);
  assert.equal(duplicate.duplicate, true);
  const matches = await store.searchPastQuestionLibrary("WAEC cell");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].examTitle, "WAEC Biology");
  const raw = JSON.parse(await readFile(path, "utf8"));
  assert.equal(Object.values(raw.questionSets)[0].submittedBy, "private-user");
});

test("past-question library requires sharing permission", async () => {
  const store = await import(`./past-question-store.mjs?permission=${Date.now()}`);
  await assert.rejects(() => store.savePastQuestionSet({ principalId: "user" }, {
    examTitle: "Exam", year: "2024", shareConfirmed: false,
    questions: [{ prompt: "Question", answer: "Answer" }],
  }), /permission/);
});

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
  assert.equal(duplicate.addedQuestionCount, 0);
  const matches = await store.searchPastQuestionLibrary("WAEC cell");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].examTitle, "WAEC Biology");
  const raw = JSON.parse(await readFile(path, "utf8"));
  assert.equal(Object.values(raw.questionSets)[0].submittedBy, "private-user");
});

test("past-question library merges new questions into an incomplete matching paper", async () => {
  const directory = await mkdtemp(join(tmpdir(), "quiks-past-questions-merge-"));
  const path = join(directory, "store.json");
  process.env.PAST_QUESTION_STORE_PATH = path;
  const store = await import(`./past-question-store.mjs?merge=${Date.now()}`);
  const metadata = {
    examTitle: "Cambridge IGCSE",
    year: "2025",
    subject: "Biology",
    appVariant: "teens",
    shareConfirmed: true,
  };

  const firstPage = await store.savePastQuestionSet({ principalId: "first-user" }, {
    ...metadata,
    questions: [
      { id: "q1", number: "1", prompt: "Which structure controls movement of substances into a cell?", options: ["Cell membrane", "Nucleus"], answer: "Cell membrane", explanation: "It is selectively permeable." },
      { id: "q2", number: "2", prompt: "State one function of the nucleus.", options: [], answer: "It controls cell activities.", explanation: "The nucleus contains genetic material." },
    ],
  });
  assert.equal(firstPage.item.questionCount, 2);

  const fullerUpload = await store.savePastQuestionSet({ principalId: "second-user" }, {
    ...metadata,
    questions: [
      { id: "page2-q1", number: "1", prompt: "Which structure controls movement of substances into the cell?", options: ["Cell membrane", "Nucleus"], answer: "Cell membrane", explanation: "It is selectively permeable." },
      { id: "page2-q2", number: "2", prompt: "State one function of the nucleus.", options: [], answer: "It controls cell activities.", explanation: "The nucleus contains genetic material." },
      { id: "page2-q3", number: "3", prompt: "Name the process by which water crosses a partially permeable membrane.", options: [], answer: "Osmosis", explanation: "Water moves from higher to lower water potential." },
      { id: "page2-q4", number: "4", prompt: "Explain why enzymes are described as biological catalysts.", options: [], answer: "They speed up biological reactions without being used up.", explanation: "They lower activation energy and remain unchanged." },
    ],
  });

  assert.equal(fullerUpload.duplicate, false);
  assert.equal(fullerUpload.merged, true);
  assert.equal(fullerUpload.addedQuestionCount, 2);
  assert.equal(fullerUpload.item.id, firstPage.item.id);
  assert.equal(fullerUpload.item.questionCount, 4);

  const subset = await store.savePastQuestionSet({ principalId: "third-user" }, {
    ...metadata,
    questions: [
      { id: "q3", number: "3", prompt: "Name the process by which water crosses a partially permeable membrane.", options: [], answer: "Osmosis", explanation: "Water moves from higher to lower water potential." },
    ],
  });
  assert.equal(subset.duplicate, true);
  assert.equal(subset.addedQuestionCount, 0);
  assert.equal(subset.item.questionCount, 4);
});

test("same paper metadata does not reject unrelated question content", async () => {
  const directory = await mkdtemp(join(tmpdir(), "quiks-past-questions-distinct-"));
  process.env.PAST_QUESTION_STORE_PATH = join(directory, "store.json");
  const store = await import(`./past-question-store.mjs?distinct=${Date.now()}`);
  const metadata = { examTitle: "International School Exam", year: "2025", subject: "English", appVariant: "teens", shareConfirmed: true };
  const first = await store.savePastQuestionSet({ principalId: "user-a" }, {
    ...metadata,
    questions: [{ number: "1", prompt: "Identify the adjective in the sentence: The red ball bounced.", answer: "red", explanation: "Red describes the noun ball." }],
  });
  const second = await store.savePastQuestionSet({ principalId: "user-b" }, {
    ...metadata,
    questions: [{ number: "1", prompt: "Write a formal letter requesting permission to organise a debate.", answer: "A correctly formatted formal letter.", explanation: "The response should include addresses, salutation, body and closing." }],
  });
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, false);
  assert.equal(second.merged, false);
  assert.notEqual(second.item.id, first.item.id);
});

test("past-question library requires sharing permission", async () => {
  const store = await import(`./past-question-store.mjs?permission=${Date.now()}`);
  await assert.rejects(() => store.savePastQuestionSet({ principalId: "user" }, {
    examTitle: "Exam", year: "2024", shareConfirmed: false,
    questions: [{ prompt: "Question", answer: "Answer" }],
  }), /permission/);
});

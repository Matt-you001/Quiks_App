import http from "node:http";
import { createCipheriv, createDecipheriv, createHash, createPublicKey, randomBytes, randomUUID, verify } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataDirectory = resolve(process.env.QUIKS_EXAM_HUB_DATA_DIR || join(here, "data"));
const port = Math.max(1, Math.min(65535, Number(process.env.QUIKS_EXAM_HUB_PORT || 5050)));
const adminPin = String(process.env.QUIKS_EXAM_HUB_ADMIN_PIN || "").trim();
const trustedPublicKey = String(process.env.QUIKS_EXAM_SIGNING_PUBLIC_KEY || process.env.EXPO_PUBLIC_QUIKS_EXAM_SIGNING_PUBLIC_KEY || "").trim();
if (adminPin.length < 8) throw new Error("Set QUIKS_EXAM_HUB_ADMIN_PIN to at least 8 characters.");
if (!trustedPublicKey) throw new Error("Set QUIKS_EXAM_SIGNING_PUBLIC_KEY to the Quiks Ed25519 public key in base64.");
await mkdir(dataDirectory, { recursive: true });

let activeExam = null;
let joinCode = null;
const attempts = new Map();

function json(response, status, body) {
  const content = JSON.stringify(body); response.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(content), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); response.end(content);
}
async function body(request) {
  let raw = ""; for await (const chunk of request) { raw += chunk; if (raw.length > 25_000_000) throw new Error("Request is too large."); }
  return raw ? JSON.parse(raw) : {};
}
function requireAdmin(request) {
  if (request.headers["x-quiks-exam-hub-pin"] !== adminPin) throw Object.assign(new Error("Administrator PIN is incorrect."), { status: 403 });
}
function publicKeyObject() {
  const raw = Buffer.from(trustedPublicKey, "base64");
  if (raw.length !== 32) throw new Error("The Exam Hub public key must decode to 32 bytes.");
  return createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw]), format: "der", type: "spki" });
}
function derive(secret, salt) { return createHash("sha256").update("quiks-offline-exam-v1\0").update(salt).update("\0").update(secret).digest(); }
function shuffled(items, seed) {
  const output = [...items]; let counter = 0;
  function random() { const bytes = createHash("sha256").update(seed).update(String(counter++)).digest(); return bytes.readUInt32BE(0) / 0x1_0000_0000; }
  for (let index = output.length - 1; index > 0; index--) { const target = Math.floor(random() * (index + 1)); [output[index], output[target]] = [output[target], output[index]]; }
  return output;
}
function examForCandidate(exam, candidateNumber) {
  const questions = exam.questionOrderMode === "shuffled" ? shuffled(exam.questions, `${exam.packageId}:${candidateNumber}`) : [...exam.questions];
  return { ...exam, questions: questions.map((question) => exam.randomizeOptions && question.type === "objective" ? { ...question, options: shuffled(question.options, `${exam.packageId}:${candidateNumber}:${question.id}`) } : question) };
}
function openSignedPackage(serialized, activationCode) {
  const envelope = JSON.parse(serialized);
  const unsigned = { algorithm: envelope.algorithm, keyId: envelope.keyId, encryption: envelope.encryption, payload: envelope.payload };
  if (!verify(null, Buffer.from(JSON.stringify(unsigned)), publicKeyObject(), Buffer.from(envelope.signature, "base64"))) throw new Error("Package signature is invalid.");
  const salt = Buffer.from(envelope.encryption.salt, "base64"); const nonce = Buffer.from(envelope.encryption.nonce, "base64"); const sealed = Buffer.from(envelope.payload, "base64");
  const ciphertext = sealed.subarray(0, -16); const tag = sealed.subarray(-16); const decipher = createDecipheriv("aes-256-gcm", derive(activationCode.trim(), salt), nonce); decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"));
}
function openPackage(serialized, activationCode) {
  const payload = openSignedPackage(serialized, activationCode);
  if (payload.format !== "quiks-offline-exam" || payload.version !== 1 || payload.expiresAt <= Date.now()) throw new Error("Package is invalid or expired.");
  return payload;
}
async function persistAttempt(attempt) {
  const nonce = randomBytes(12); const key = createHash("sha256").update("quiks-exam-hub\0").update(adminPin).digest();
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(attempt), "utf8"), cipher.final()]);
  await writeFile(join(dataDirectory, `${attempt.attemptId}.qresponse.enc`), JSON.stringify({ nonce: nonce.toString("base64"), tag: cipher.getAuthTag().toString("base64"), payload: ciphertext.toString("base64") }), "utf8");
}
async function savedAttempts() {
  const files = (await readdir(dataDirectory)).filter((name) => name.endsWith(".qresponse.enc")); const output = [];
  const key = createHash("sha256").update("quiks-exam-hub\0").update(adminPin).digest();
  for (const file of files) { const sealed = JSON.parse(await readFile(join(dataDirectory, file), "utf8")); const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.nonce, "base64")); decipher.setAuthTag(Buffer.from(sealed.tag, "base64")); output.push(JSON.parse(Buffer.concat([decipher.update(Buffer.from(sealed.payload, "base64")), decipher.final()]).toString("utf8"))); }
  return output;
}
async function attemptsForActiveExam() {
  if (!activeExam) return [];
  return (await savedAttempts()).filter((entry) => entry.packageId === activeExam.packageId);
}
function csvCell(value) { let text = String(value ?? ""); if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; }
function responseCsv(entries) {
  const questionIds = activeExam?.questions.map((question) => question.id) ?? [...new Set(entries.flatMap((entry) => entry.answers.map((answer) => answer.questionId)))];
  const rows = [["Candidate", "Candidate number", "Started", "Submitted", "Security events", ...questionIds]];
  for (const entry of entries) rows.push([entry.candidateName, entry.candidateNumber, new Date(entry.startedAt).toISOString(), new Date(entry.submittedAt).toISOString(), (entry.securityEvents ?? []).length, ...questionIds.map((id) => entry.answers.find((answer) => answer.questionId === id)?.answer ?? "")]);
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (request.method === "GET" && url.pathname === "/") { const html = await readFile(join(here, "index.html")); response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'", "Cache-Control": "no-store" }); response.end(html); return; }
    if (request.method === "GET" && url.pathname === "/api/status") { const entries = await attemptsForActiveExam(); json(response, 200, { loaded: Boolean(activeExam), title: activeExam?.title, className: activeExam?.className, expiresAt: activeExam?.expiresAt, submissionCount: entries.filter((entry) => entry.status === "submitted").length }); return; }
    if (request.method === "POST" && url.pathname === "/api/admin/package") { requireAdmin(request); const input = await body(request); activeExam = openPackage(input.package, input.activationCode); if (activeExam.deploymentFormat !== "exam_hub" || activeExam.responseMode !== "exam_hub") throw new Error("This package was not configured for Exam Hub."); joinCode = String(input.joinCode || "").trim().toUpperCase(); if (joinCode.length < 4) throw new Error("Use a candidate join code containing at least 4 characters."); attempts.clear(); json(response, 200, { title: activeExam.title, className: activeExam.className, expiresAt: activeExam.expiresAt }); return; }
    if (request.method === "POST" && url.pathname === "/api/admin/marking-package") { requireAdmin(request); const input = await body(request); const marking = openSignedPackage(input.package, String(input.password || "")); if (marking.format !== "quiks-offline-marking-package" || marking.version !== 1) throw new Error("This is not a valid Quiks marking package."); json(response, 200, { title: marking.title, questions: marking.questions }); return; }
    if (request.method === "POST" && url.pathname === "/api/attempt/start") {
      if (!activeExam || activeExam.expiresAt <= Date.now()) throw Object.assign(new Error("No active examination is available."), { status: 409 });
      if (Number(activeExam.startsAt || 0) > Date.now()) throw Object.assign(new Error("This examination has not started yet."), { status: 409 });
      const input = await body(request);
      if (String(input.joinCode || "").trim().toUpperCase() !== joinCode) throw Object.assign(new Error("Join code is incorrect."), { status: 403 });
      const candidateName = String(input.candidateName || "").trim().slice(0, 160);
      const candidateNumber = String(input.candidateNumber || "").trim().slice(0, 100);
      if (!candidateName || !candidateNumber) throw new Error("Candidate name and candidate number are required.");
      const existing = await attemptsForActiveExam();
      const priorCandidate = existing.find((entry) => String(entry.candidateNumber).toLowerCase() === candidateNumber.toLowerCase());
      if (priorCandidate?.status === "in_progress") {
        attempts.set(priorCandidate.attemptId, priorCandidate);
        json(response, 200, { attemptId: priorCandidate.attemptId, startedAt: priorCandidate.startedAt, answers: priorCandidate.answers ?? [], securityEvents: priorCandidate.securityEvents ?? [], resumed: true, exam: examForCandidate(activeExam, candidateNumber) }); return;
      }
      if (priorCandidate) throw Object.assign(new Error("This candidate number already submitted this examination."), { status: 409 });
      const usedCandidates = new Set([...existing.map((entry) => String(entry.candidateNumber).toLowerCase()), ...[...attempts.values()].filter((entry) => entry.packageId === activeExam.packageId).map((entry) => String(entry.candidateNumber).toLowerCase())]);
      if (usedCandidates.has(candidateNumber.toLowerCase())) throw Object.assign(new Error("This candidate number already has an active attempt for this examination."), { status: 409 });
      if (usedCandidates.size >= activeExam.maxDevices) throw Object.assign(new Error("The maximum authorised candidate/device count has been reached."), { status: 409 });
      const attemptId = randomUUID();
      const started = { attemptId, packageId: activeExam.packageId, candidateName, candidateNumber, answers: [], securityEvents: [], startedAt: Date.now(), updatedAt: Date.now(), status: "in_progress" };
      attempts.set(attemptId, started); await persistAttempt(started);
      json(response, 200, { attemptId, startedAt: started.startedAt, answers: [], securityEvents: [], resumed: false, exam: examForCandidate(activeExam, candidateNumber) }); return;
    }
    if (request.method === "POST" && url.pathname === "/api/attempt/save") {
      const input = await body(request); const started = attempts.get(input.attemptId);
      if (!started) throw Object.assign(new Error("Attempt is not active on this Exam Hub."), { status: 404 });
      const draft = { ...started, answers: Array.isArray(input.answers) ? input.answers : [], securityEvents: Array.isArray(input.securityEvents) ? input.securityEvents : started.securityEvents, updatedAt: Date.now(), status: "in_progress" };
      attempts.set(input.attemptId, draft); await persistAttempt(draft); json(response, 200, { saved: true }); return;
    }
    if (request.method === "POST" && url.pathname === "/api/attempt/submit") { const input = await body(request); const started = attempts.get(input.attemptId); if (!started) throw Object.assign(new Error("Attempt is not active on this Exam Hub."), { status: 404 }); const completed = { ...started, answers: Array.isArray(input.answers) ? input.answers : [], securityEvents: Array.isArray(input.securityEvents) ? input.securityEvents : started.securityEvents, updatedAt: Date.now(), submittedAt: Date.now(), status: "submitted" }; await persistAttempt(completed); attempts.delete(input.attemptId); json(response, 200, { saved: true }); return; }
    if (request.method === "GET" && url.pathname === "/api/admin/export") { requireAdmin(request); const entries = (await attemptsForActiveExam()).filter((entry) => entry.status === "submitted"); const csv = responseCsv(entries); response.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="quiks-exam-hub-results.csv"`, "Cache-Control": "no-store" }); response.end(`\uFEFF${csv}`); return; }
    json(response, 404, { error: "Not found" });
  } catch (error) { json(response, Number(error?.status || 400), { error: error instanceof Error ? error.message : "Exam Hub operation failed." }); }
});
server.listen(port, "0.0.0.0", () => console.log(`Quiks Exam Hub is ready on http://0.0.0.0:${port}`));

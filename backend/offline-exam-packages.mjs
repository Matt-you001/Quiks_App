import { createHash, createPrivateKey, createPublicKey, randomBytes, randomUUID, sign } from "node:crypto";
import { gcm } from "@noble/ciphers/aes";

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

function readPrivateKey() {
  const configured = String(process.env.QUIKS_EXAM_PACKAGE_SIGNING_PRIVATE_KEY ?? "").trim();
  if (!configured) return null;
  const value = configured.startsWith("base64:")
    ? Buffer.from(configured.slice(7), "base64").toString("utf8")
    : configured.replace(/\\n/g, "\n");
  try {
    return createPrivateKey(value);
  } catch {
    fail("QUIKS_EXAM_PACKAGE_SIGNING_PRIVATE_KEY is not a valid Ed25519 private key.", 503);
  }
}

function signingContext() {
  const privateKey = readPrivateKey();
  if (!privateKey) fail("Offline exam package signing is not configured.", 503);
  if (privateKey.asymmetricKeyType !== "ed25519") fail("The offline exam signing key must be Ed25519.", 503);
  const publicDer = createPublicKey(privateKey).export({ format: "der", type: "spki" });
  const publicKey = Buffer.from(publicDer).subarray(-32);
  return {
    privateKey,
    publicKey: publicKey.toString("base64"),
    keyId: createHash("sha256").update(publicKey).digest("hex").slice(0, 16),
  };
}

export function getOfflineExamPackageDiagnostics() {
  try {
    const context = signingContext();
    return { configured: true, algorithm: "Ed25519", keyId: context.keyId, publicKey: context.publicKey };
  } catch (error) {
    return { configured: false, algorithm: "Ed25519", keyId: null, publicKey: null, error: error instanceof Error ? error.message : "Invalid signing configuration." };
  }
}

function deriveKey(secret, salt) {
  return createHash("sha256").update("quiks-offline-exam-v1\0").update(salt).update("\0").update(secret).digest();
}

function seal(plaintext, secret, context) {
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const key = deriveKey(secret, salt);
  const payload = Buffer.from(gcm(key, nonce).encrypt(Buffer.from(plaintext, "utf8"))).toString("base64");
  const unsigned = {
    algorithm: "Ed25519",
    keyId: context.keyId,
    encryption: { algorithm: "AES-256-GCM", salt: salt.toString("base64"), nonce: nonce.toString("base64") },
    payload,
  };
  const signature = sign(null, Buffer.from(JSON.stringify(unsigned)), context.privateKey).toString("base64");
  return JSON.stringify({ ...unsigned, signature });
}

function safeName(value) {
  return String(value || "exam").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "exam";
}

function studentQuestion(question) {
  return {
    id: question.id,
    prompt: question.prompt,
    options: Array.isArray(question.options) ? question.options : [],
    type: question.type === "written" ? "written" : "objective",
    points: Math.max(1, Number(question.points ?? 1)),
    ...(question.maxWords ? { maxWords: Number(question.maxWords) } : {}),
    ...(question.image ? { image: question.image } : {}),
  };
}

export function createOfflineExamPackages({ activity, classroom, activationCode, teacherPackagePassword }) {
  const context = signingContext();
  const code = String(activationCode ?? "").trim();
  if (code.length < 8) fail("Use an offline activation code containing at least 8 characters.");
  if (activity.deliveryMode !== "offline_sync" && activity.deliveryMode !== "offline_standalone") fail("Set this activity to an offline delivery mode before exporting it.");
  const configuration = activity.offlineConfiguration;
  if (!configuration) fail("Complete the offline deployment settings before exporting this activity.");
  const now = Date.now();
  if (Number(configuration.packageExpiresAt) <= now) fail("The offline package expiry must be in the future.");
  const packageId = randomUUID();
  const payload = {
    format: "quiks-offline-exam",
    version: 1,
    packageId,
    packageVersion: Math.max(1, Number(activity.offlinePackageVersion ?? 1)),
    activityId: activity.id,
    deliveryMode: activity.deliveryMode,
    responseMode: configuration.responseMode,
    deploymentFormat: configuration.deploymentFormat,
    ...(classroom.schoolId ? { schoolId: classroom.schoolId } : {}),
    className: classroom.name,
    title: activity.title,
    subjectName: activity.subjectName,
    grade: activity.grade,
    instructions: activity.instructions,
    durationMinutes: activity.durationMinutes,
    startsAt: activity.startAt,
    expiresAt: Number(configuration.packageExpiresAt),
    maxDevices: Number(configuration.maxDevices),
    allowLocalResponseExport: Boolean(configuration.allowLocalResponseExport),
    showQuestionPoints: Boolean(configuration.showQuestionPoints),
    questionOrderMode: activity.questionOrderMode ?? "same",
    randomizeOptions: Boolean(activity.randomizeOptions),
    navigationMode: activity.navigationMode ?? "free",
    exitPolicy: activity.exitPolicy ?? "warn_record",
    questions: activity.questions.map(studentQuestion),
    issuedAt: now,
  };
  const slug = safeName(activity.title);
  const result = {
    studentFilename: `${slug}-v${payload.packageVersion}.qexam`,
    studentPackage: seal(JSON.stringify(payload), code, context),
    keyId: context.keyId,
  };
  if (configuration.includeTeacherPackage) {
    const password = String(teacherPackagePassword ?? "");
    if (password.length < 10) fail("Use a teacher-package password containing at least 10 characters.");
    const markingPayload = {
      format: "quiks-offline-marking-package",
      version: 1,
      packageId,
      activityId: activity.id,
      title: activity.title,
      questions: activity.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        type: question.type === "written" ? "written" : "objective",
        points: Math.max(1, Number(question.points ?? 1)),
        answer: question.answer,
        explanation: question.explanation,
        markingGuide: question.markingGuide,
      })),
      issuedAt: now,
    };
    result.teacherFilename = `${slug}-marking-v${payload.packageVersion}.qmark`;
    result.teacherPackage = seal(JSON.stringify(markingPayload), password, context);
  }
  return result;
}

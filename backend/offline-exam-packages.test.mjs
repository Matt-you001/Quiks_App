import assert from "node:assert/strict";
import { createDecipheriv, createHash, createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";
import { createOfflineExamPackages, getOfflineExamPackageDiagnostics } from "./offline-exam-packages.mjs";

function configureSigningKey() {
  const { privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ format: "pem", type: "pkcs8" });
  process.env.QUIKS_EXAM_PACKAGE_SIGNING_PRIVATE_KEY = `base64:${Buffer.from(pem).toString("base64")}`;
}

function openEnvelope(serialized, secret) {
  const envelope = JSON.parse(serialized);
  const unsigned = { algorithm: envelope.algorithm, keyId: envelope.keyId, encryption: envelope.encryption, payload: envelope.payload };
  const diagnostics = getOfflineExamPackageDiagnostics();
  const rawPublicKey = Buffer.from(diagnostics.publicKey, "base64");
  const publicKey = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), rawPublicKey]), format: "der", type: "spki" });
  assert.equal(verify(null, Buffer.from(JSON.stringify(unsigned)), publicKey, Buffer.from(envelope.signature, "base64")), true);
  const salt = Buffer.from(envelope.encryption.salt, "base64");
  const nonce = Buffer.from(envelope.encryption.nonce, "base64");
  const sealed = Buffer.from(envelope.payload, "base64");
  const key = createHash("sha256").update("quiks-offline-exam-v1\0").update(salt).update("\0").update(secret).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(sealed.subarray(-16));
  return JSON.parse(Buffer.concat([decipher.update(sealed.subarray(0, -16)), decipher.final()]).toString("utf8"));
}

function fixture() {
  return {
    classroom: { className: "Year 10", name: "Year 10", schoolId: "school-1" },
    activity: {
      id: "activity-1",
      deliveryMode: "offline_standalone",
      offlinePackageVersion: 2,
      offlineConfiguration: { responseMode: "device_export", deploymentFormat: "android", packageExpiresAt: Date.now() + 86_400_000, maxDevices: 30, allowLocalResponseExport: true, includeTeacherPackage: true, showQuestionPoints: true },
      title: "Biology Mock Examination",
      subjectName: "Biology",
      grade: "Year 10",
      durationMinutes: 60,
      startAt: Date.now() - 1000,
      questionOrderMode: "shuffled",
      randomizeOptions: true,
      navigationMode: "free",
      exitPolicy: "strict_submit",
      questions: [
        { id: "q1", prompt: "Which organelle releases energy?", type: "objective", options: ["Mitochondrion", "Nucleus"], answer: "Mitochondrion", explanation: "It performs cellular respiration.", points: 1 },
        { id: "q2", prompt: "Explain osmosis.", type: "written", options: [], answer: "Water movement", markingGuide: "Mention a partially permeable membrane.", points: 5 },
      ],
    },
  };
}

test("student package is signed, encrypted, and excludes answers", () => {
  configureSigningKey();
  const exported = createOfflineExamPackages({ ...fixture(), activationCode: "STUDENT-2026", teacherPackagePassword: "TeacherOnly-2026" });
  const payload = openEnvelope(exported.studentPackage, "STUDENT-2026");
  assert.equal(payload.format, "quiks-offline-exam");
  assert.equal(payload.packageVersion, 2);
  assert.equal(payload.questions[0].answer, undefined);
  assert.equal(payload.questions[0].explanation, undefined);
  assert.equal(payload.questions[1].markingGuide, undefined);
  assert.equal(JSON.stringify(payload).includes("Mitochondrion\",\"explanation"), false);
});

test("teacher marking package is separate and password protected", () => {
  configureSigningKey();
  const exported = createOfflineExamPackages({ ...fixture(), activationCode: "STUDENT-2026", teacherPackagePassword: "TeacherOnly-2026" });
  const marking = openEnvelope(exported.teacherPackage, "TeacherOnly-2026");
  assert.equal(marking.format, "quiks-offline-marking-package");
  assert.equal(marking.questions[0].answer, "Mitochondrion");
  assert.equal(marking.questions[1].markingGuide, "Mention a partially permeable membrane.");
  assert.throws(() => openEnvelope(exported.teacherPackage, "wrong-password"));
});

test("offline export rejects unsafe or expired configuration", () => {
  configureSigningKey();
  const invalid = fixture();
  invalid.activity.offlineConfiguration.packageExpiresAt = Date.now() - 1;
  assert.throws(() => createOfflineExamPackages({ ...invalid, activationCode: "STUDENT-2026", teacherPackagePassword: "TeacherOnly-2026" }), /future/);
  const valid = fixture();
  assert.throws(() => createOfflineExamPackages({ ...valid, activationCode: "short", teacherPackagePassword: "TeacherOnly-2026" }), /8 characters/);
});

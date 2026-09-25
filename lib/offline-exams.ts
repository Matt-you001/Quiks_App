import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { gcm } from "@noble/ciphers/aes";
import { bytesToUtf8, concatBytes, utf8ToBytes } from "@noble/ciphers/utils";
import { etc as ed25519Etc, verifyAsync } from "@noble/ed25519";
import { fromByteArray, toByteArray } from "base64-js";
import type { ClassroomSecurityEvent, ClassroomStudentAnswer, OfflineExamEnvelope, OfflineExamPayload } from "../types/app";

const PACKAGE_KEY = "quiks.offline-exam.packages.v1";
const ATTEMPT_KEY = "quiks.offline-exam.attempts.v1";
const ATTEMPT_DEVICE_KEY = "quiks.offline-exam.device-key.v1";
const trustedPublicKey = String(process.env.EXPO_PUBLIC_QUIKS_EXAM_SIGNING_PUBLIC_KEY ?? "").trim();

function digestInput(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

ed25519Etc.sha512Async = async (...messages) => new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA512, digestInput(concatBytes(...messages))));

export interface OfflineExamAttempt {
  attemptId: string;
  packageId: string;
  activityId: string;
  candidateName: string;
  candidateNumber: string;
  answers: ClassroomStudentAnswer[];
  securityEvents?: ClassroomSecurityEvent[];
  startedAt: number;
  submittedAt?: number;
  timeTakenSeconds?: number;
  status: "in_progress" | "completed" | "pending_sync" | "synced";
}

export interface StoredOfflineExamPackage {
  packageId: string;
  packageVersion: number;
  title: string;
  className: string;
  subjectName: string;
  expiresAt: number;
  deliveryMode: OfflineExamPayload["deliveryMode"];
  envelope: string;
  importedAt: number;
}

function unsignedEnvelope(envelope: OfflineExamEnvelope) {
  return {
    algorithm: envelope.algorithm,
    keyId: envelope.keyId,
    encryption: envelope.encryption,
    payload: envelope.payload,
  };
}

async function deriveKey(secret: string, salt: Uint8Array) {
  return new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, digestInput(concatBytes(utf8ToBytes("quiks-offline-exam-v1\0"), salt, utf8ToBytes("\0"), utf8ToBytes(secret)))));
}

export async function openOfflineExamPackage(serialized: string, activationCode: string): Promise<OfflineExamPayload> {
  if (!trustedPublicKey) throw new Error("This Quiks build does not contain the offline examination verification key.");
  let envelope: OfflineExamEnvelope;
  try { envelope = JSON.parse(serialized); } catch { throw new Error("This is not a valid Quiks examination package."); }
  if (envelope.algorithm !== "Ed25519" || envelope.encryption?.algorithm !== "AES-256-GCM") throw new Error("This examination package uses an unsupported security format.");
  const valid = await verifyAsync(toByteArray(envelope.signature), utf8ToBytes(JSON.stringify(unsignedEnvelope(envelope))), toByteArray(trustedPublicKey));
  if (!valid) throw new Error("The examination package signature is invalid. Do not use this file.");
  try {
    const salt = toByteArray(envelope.encryption.salt);
    const nonce = toByteArray(envelope.encryption.nonce);
    const key = await deriveKey(activationCode.trim(), salt);
    const plaintext = gcm(key, nonce).decrypt(toByteArray(envelope.payload));
    const payload = JSON.parse(bytesToUtf8(plaintext)) as OfflineExamPayload;
    if (payload.format !== "quiks-offline-exam" || payload.version !== 1) throw new Error();
    if (payload.expiresAt <= Date.now()) throw new Error("This offline examination package has expired.");
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message.includes("expired")) throw error;
    throw new Error("The activation code is incorrect or the examination package is damaged.");
  }
}

async function readRecord<T>(key: string): Promise<Record<string, T>> {
  try { return JSON.parse(await AsyncStorage.getItem(key) || "{}"); } catch { return {}; }
}

async function deviceKey() {
  let encoded = Platform.OS === "web" ? await AsyncStorage.getItem(ATTEMPT_DEVICE_KEY) : await SecureStore.getItemAsync(ATTEMPT_DEVICE_KEY);
  if (!encoded) {
    encoded = fromByteArray(Crypto.getRandomBytes(32));
    if (Platform.OS === "web") await AsyncStorage.setItem(ATTEMPT_DEVICE_KEY, encoded);
    else await SecureStore.setItemAsync(ATTEMPT_DEVICE_KEY, encoded, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }
  return toByteArray(encoded);
}

async function readAttemptRecord() {
  const raw = await AsyncStorage.getItem(ATTEMPT_KEY);
  if (!raw) return {} as Record<string, OfflineExamAttempt>;
  try {
    const sealed = JSON.parse(raw) as { nonce: string; payload: string };
    return JSON.parse(bytesToUtf8(gcm(await deviceKey(), toByteArray(sealed.nonce)).decrypt(toByteArray(sealed.payload)))) as Record<string, OfflineExamAttempt>;
  } catch {
    throw new Error("Saved offline examination responses could not be decrypted on this device.");
  }
}

async function writeAttemptRecord(attempts: Record<string, OfflineExamAttempt>) {
  const nonce = Crypto.getRandomBytes(12);
  const payload = gcm(await deviceKey(), nonce).encrypt(utf8ToBytes(JSON.stringify(attempts)));
  await AsyncStorage.setItem(ATTEMPT_KEY, JSON.stringify({ nonce: fromByteArray(nonce), payload: fromByteArray(payload) }));
}

export async function saveOfflineExamPackage(payload: OfflineExamPayload, envelope: string) {
  const packages = await readRecord<StoredOfflineExamPackage>(PACKAGE_KEY);
  packages[payload.packageId] = {
    packageId: payload.packageId,
    packageVersion: payload.packageVersion,
    title: payload.title,
    className: payload.className,
    subjectName: payload.subjectName,
    expiresAt: payload.expiresAt,
    deliveryMode: payload.deliveryMode,
    envelope,
    importedAt: Date.now(),
  };
  await AsyncStorage.setItem(PACKAGE_KEY, JSON.stringify(packages));
}

export async function listOfflineExamPackages() {
  return Object.values(await readRecord<StoredOfflineExamPackage>(PACKAGE_KEY)).sort((left, right) => right.importedAt - left.importedAt);
}

export async function saveOfflineExamAttempt(attempt: OfflineExamAttempt) {
  const attempts = await readAttemptRecord();
  attempts[attempt.attemptId] = attempt;
  await writeAttemptRecord(attempts);
}

export async function listOfflineExamAttempts() {
  return Object.values(await readAttemptRecord()).sort((left, right) => right.startedAt - left.startedAt);
}

export function serializeOfflineResponse(payload: OfflineExamPayload, attempt: OfflineExamAttempt) {
  return JSON.stringify({
    format: "quiks-offline-response",
    version: 1,
    packageId: payload.packageId,
    packageVersion: payload.packageVersion,
    activityId: payload.activityId,
    examTitle: payload.title,
    className: payload.className,
    candidateName: attempt.candidateName,
    candidateNumber: attempt.candidateNumber,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    timeTakenSeconds: attempt.timeTakenSeconds,
    answers: attempt.answers,
    securityEvents: attempt.securityEvents ?? [],
  }, null, 2);
}

export function offlineResponseFilename(payload: OfflineExamPayload, attempt: OfflineExamAttempt) {
  const safe = `${payload.title}-${attempt.candidateNumber || attempt.candidateName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return `${safe || "offline-response"}.qresponse`;
}

export function encodeBase64(bytes: Uint8Array) { return fromByteArray(bytes); }

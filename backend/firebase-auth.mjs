import { createPublicKey, verify as verifySignature } from "node:crypto";

const certificateUrl =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const defaultProjectIds = ["synapse-trainer-y0kk3", "quiks-teens", "quiks-uni"];
const configuredProjectIds = String(process.env.QUIKS_FIREBASE_PROJECT_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const allowedProjectIds = new Set(configuredProjectIds.length > 0 ? configuredProjectIds : defaultProjectIds);

let certificateCache = null;
let certificateExpiresAt = 0;

function decodeBase64Url(value) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function parseJwtPart(value) {
  return JSON.parse(decodeBase64Url(value).toString("utf8"));
}

function readCacheDuration(headers) {
  const cacheControl = headers.get("cache-control") ?? "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  return Number.isFinite(maxAgeSeconds) ? Math.max(60, maxAgeSeconds) * 1000 : 3600_000;
}

async function getGoogleCertificates() {
  if (certificateCache && Date.now() < certificateExpiresAt) {
    return certificateCache;
  }

  const response = await fetch(certificateUrl);
  if (!response.ok) {
    throw new Error(`Firebase certificate lookup failed (${response.status}).`);
  }

  certificateCache = await response.json();
  certificateExpiresAt = Date.now() + readCacheDuration(response.headers);
  return certificateCache;
}

function getTokenFromRequest(request) {
  const token = request.headers["x-firebase-id-token"];
  return Array.isArray(token) ? token[0] : token;
}

export async function verifyFirebaseRequest(request) {
  const token = String(getTokenFromRequest(request) ?? "").trim();
  if (!token) {
    throw new Error("Sign in is required for Quiks School.");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("The Firebase identity token is malformed.");
  }

  const header = parseJwtPart(parts[0]);
  const payload = parseJwtPart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("The Firebase identity token uses an unsupported signature.");
  }

  const projectId = String(payload.aud ?? "");
  if (!allowedProjectIds.has(projectId)) {
    throw new Error("This Firebase project is not allowed to access Quiks School.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    payload.iss !== `https://securetoken.google.com/${projectId}` ||
    typeof payload.sub !== "string" ||
    payload.sub.length === 0 ||
    payload.sub.length > 128 ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= nowSeconds ||
    !Number.isFinite(payload.iat) ||
    payload.iat > nowSeconds + 300 ||
    payload.auth_time > nowSeconds + 300
  ) {
    throw new Error("The Firebase identity token is invalid or expired.");
  }

  const certificates = await getGoogleCertificates();
  const certificate = certificates[header.kid];
  if (!certificate) {
    certificateCache = null;
    certificateExpiresAt = 0;
    throw new Error("The Firebase signing certificate was not found. Please sign in again.");
  }

  const signedContent = Buffer.from(`${parts[0]}.${parts[1]}`);
  const signature = decodeBase64Url(parts[2]);
  const verified = verifySignature("RSA-SHA256", signedContent, createPublicKey(certificate), signature);
  if (!verified) {
    throw new Error("The Firebase identity token signature is invalid.");
  }

  return {
    uid: payload.sub,
    projectId,
    principalId: `${projectId}:${payload.sub}`,
    email: String(payload.email ?? "").trim().toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: String(payload.name ?? payload.email ?? "Quiks user").trim(),
  };
}

export function getFirebaseAuthDiagnostics() {
  return {
    allowedProjectIds: [...allowedProjectIds],
    certificateCacheReady: Boolean(certificateCache),
  };
}

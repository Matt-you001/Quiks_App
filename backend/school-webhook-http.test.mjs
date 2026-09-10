import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => probe.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function waitForHealth(url) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Test backend did not start.");
}

test("RevenueCat school webhook requires matching authorization and raw-body HMAC", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "quiks-school-webhook-test-"));
  const port = await availablePort();
  const authorization = "Bearer webhook-test-authorization";
  const signingSecret = "webhook-test-signing-secret";
  const child = spawn(process.execPath, [join(process.cwd(), "backend", "openai-proxy.mjs")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      CLASSROOM_STORE_PATH: join(directory, "classroom.json"),
      SCHOOL_STORE_PATH: join(directory, "school.json"),
      REVENUECAT_SCHOOL_WEBHOOK_AUTH: authorization,
      REVENUECAT_SCHOOL_WEBHOOK_SIGNING_SECRET: signingSecret,
    },
    stdio: "ignore",
  });
  context.after(() => child.kill());
  await waitForHealth(`http://127.0.0.1:${port}/health`);
  const rawBody = JSON.stringify({ api_version: "1.0", event: { id: "test-event", type: "TEST", event_timestamp_ms: Date.now() } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", signingSecret).update(`${timestamp}.${rawBody}`).digest("hex");
  const valid = await fetch(`http://127.0.0.1:${port}/webhooks/revenuecat/school`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
      "X-RevenueCat-Webhook-Signature": `t=${timestamp},v1=${signature}`,
    },
    body: rawBody,
  });
  assert.equal(valid.status, 200);
  assert.deepEqual(await valid.json(), { ok: true, test: true });

  const invalid = await fetch(`http://127.0.0.1:${port}/webhooks/revenuecat/school`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
      "X-RevenueCat-Webhook-Signature": `t=${timestamp},v1=${"0".repeat(64)}`,
    },
    body: rawBody,
  });
  assert.equal(invalid.status, 401);
});


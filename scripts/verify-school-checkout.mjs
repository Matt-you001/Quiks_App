import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const roots = [resolve("web-hosting", "parent"), resolve("web-hosting2")];
const packageMarkers = ["per-learner", "starter", "growth", "complete", "enterprise"];

for (const root of roots) {
  for (const file of ["pricing.html", "checkout.html", "styles.css", "subscription-options.js", "school-paddle-config.js", "school-checkout.js"]) {
    assert.ok(existsSync(join(root, file)), `${root}: missing ${file}`);
  }

  const pricing = readFileSync(join(root, "pricing.html"), "utf8");
  const checkout = readFileSync(join(root, "checkout.html"), "utf8");
  const config = readFileSync(join(root, "school-paddle-config.js"), "utf8");
  const checkoutScript = readFileSync(join(root, "school-checkout.js"), "utf8");
  for (const marker of packageMarkers) {
    assert.ok(pricing.includes(`plan=${marker}`), `${root}: pricing is missing ${marker}`);
    assert.ok(checkout.includes(`value="${marker}:term"`), `${root}: checkout is missing ${marker} term`);
    assert.ok(checkout.includes(`value="${marker}:session"`), `${root}: checkout is missing ${marker} session`);
  }
  assert.equal((pricing.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr(?:\s|>)/g) || []).length, 5, `${root}: pricing must contain five package rows`);
  assert.equal((checkout.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr(?:\s|>)/g) || []).length, 5, `${root}: checkout must contain five package rows`);
  assert.ok(pricing.includes('data-audience-tab="individual"'), `${root}: Individual is not the default option`);
  assert.ok(checkout.includes('data-audience-tab="schools"'), `${root}: Schools / Institutions option missing`);
  assert.ok(checkout.includes('name="learnerCount"'), `${root}: school learner count is missing`);
  const configuredPriceIds = config.match(/pri_[a-z0-9]+/g) || [];
  assert.equal(configuredPriceIds.length, 10, `${root}: all ten Paddle prices must be configured`);
  assert.equal(new Set(configuredPriceIds).size, 10, `${root}: Paddle price IDs must be unique`);
  assert.ok(config.includes('session: "pri_01m23awdptxksm2xxwkv1pcy6y"'), `${root}: Per Learner Session price is missing`);
  assert.ok(config.includes('environment: "production"'), `${root}: school Paddle environment must match the live catalogue`);
  assert.ok(config.includes('apiBaseUrl: "https://quiks-app.onrender.com"'), `${root}: school checkout must use the persistent Quiks backend`);
  assert.match(config, /clientToken:\s*"live_[a-zA-Z0-9]{27}"/, `${root}: valid live Paddle client-side token is missing`);
  assert.ok(config.includes("enabled: false"), `${root}: unverified school checkout must fail closed`);
  assert.ok(!config.match(/(?:apiKey|webhookSecret|serviceAccount)\s*:/i), `${root}: secret-like configuration must not be public`);
  assert.ok(checkoutScript.includes('/school/purchases/pending'), `${root}: checkout must create a server-side pending purchase before charging`);
  assert.ok(checkoutScript.includes('/school/purchases/status'), `${root}: checkout must report verified activation status`);
  assert.ok(!checkoutScript.includes('quiks_school_name:'), `${root}: untrusted school details must not be copied into Paddle custom data`);
}

console.log("School pricing, server-issued purchase references and fail-closed Paddle checkout verified in both hosting folders.");

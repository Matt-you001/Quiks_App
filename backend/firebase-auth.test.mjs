import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertFirebaseEmailVerified } from "./firebase-auth.mjs";

test("unverified Firebase principals are rejected with a protected-operation error", () => {
  for (const emailVerified of [undefined, false]) {
    assert.throws(
      () => assertFirebaseEmailVerified({ uid: "password-user", emailVerified }),
      (error) => {
        assert.equal(error.statusCode, 403);
        assert.match(error.message, /verify your email/i);
        return true;
      }
    );
  }
});

test("Firebase-verified password and Google principals proceed unchanged", () => {
  const passwordPrincipal = { uid: "password-user", emailVerified: true, provider: "password" };
  const googlePrincipal = { uid: "google-user", emailVerified: true, provider: "google.com" };
  assert.equal(assertFirebaseEmailVerified(passwordPrincipal), passwordPrincipal);
  assert.equal(assertFirebaseEmailVerified(googlePrincipal), googlePrincipal);
});

test("Firestore user records require Firebase's verified-email claim", async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /request\.auth\.uid\s*==\s*userId/);
  assert.match(rules, /request\.auth\.token\.email_verified\s*==\s*true/);
});
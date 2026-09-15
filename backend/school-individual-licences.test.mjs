import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "quiks-individual-licence-test-"));
process.env.SCHOOL_STORE_PATH = join(directory, "school.json");
process.env.QUIKS_OWNER_EMAILS = "owner@example.com";
const owner = { principalId: "test:owner", uid: "owner", name: "Owner", email: "owner@example.com", emailVerified: true };
const learner = { principalId: "test:learner", uid: "learner", name: "Learner", email: "learner@example.com", emailVerified: true };
const stranger = { ...learner, principalId: "test:stranger", uid: "stranger", email: "stranger@example.com" };
const store = await import("./school-store.mjs");

test("configured App Owner receives permanent premium access without payment", () => {
  assert.deepEqual(store.getAppOwnerEntitlement(owner), {
    active: true,
    expiresAt: null,
    managementUrl: null,
    source: "app_owner",
    profileLimit: 2,
  });
  assert.equal(store.getAppOwnerEntitlement(learner), null);
});

test("owner issues a persistent email-bound individual licence", async () => {
  const startAt = Date.now() - 60_000;
  const endAt = Date.now() + 86_400_000;
  const licence = await store.createIndividualLicence(owner, { email: " Learner@Example.com ", startAt, endAt });
  assert.equal(licence.email, "learner@example.com");
  assert.equal(licence.status, "active");
  const entitlement = await store.getOwnerIssuedIndividualEntitlement(learner);
  assert.equal(entitlement.active, true);
  assert.equal(await store.getOwnerIssuedIndividualEntitlement(stranger), null);
  const dashboard = await store.getOwnerDashboard(owner);
  assert.equal(dashboard.totals.individualLicences, 1);
  assert.equal(dashboard.totals.activeIndividualLicences, 1);
  assert.equal(dashboard.individualLicences[0].email, "learner@example.com");
  const persisted = JSON.parse(await readFile(process.env.SCHOOL_STORE_PATH, "utf8"));
  assert.equal(Object.values(persisted.individualLicences).length, 1);
});

test("reissuing to the same email updates rather than duplicates the licence", async () => {
  const endAt = Date.now() + 172_800_000;
  const updated = await store.createIndividualLicence(owner, { email: "learner@example.com", startAt: Date.now() - 1000, endAt });
  assert.equal(updated.endAt, endAt);
  assert.equal((await store.getOwnerDashboard(owner)).individualLicences.length, 1);
});

test("non-owners cannot issue individual licences", async () => {
  await assert.rejects(
    store.createIndividualLicence(learner, { email: "other@example.com", startAt: Date.now(), endAt: Date.now() + 10000 }),
    /Only a configured Quiks owner/
  );
});

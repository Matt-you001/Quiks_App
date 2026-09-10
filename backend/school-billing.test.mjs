import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "quiks-school-billing-test-"));
process.env.SCHOOL_STORE_PATH = join(directory, "school.json");
const store = await import("./school-store.mjs");

const essentialTermPrice = "pri_01m22zx25r919nw4xgcnshxpet";
const essentialSessionPrice = "pri_01m2309pdzp0kf8s4ccrcemt6d";

async function pending(period = "term", overrides = {}) {
  return store.createPendingSchoolPurchase({
    schoolName: "Verified Academy",
    administratorName: "Ada Admin",
    administratorEmail: "admin@verified.example",
    enrolmentMode: "individual_codes",
    packageId: "starter",
    period,
    learnerCount: 50,
    ...overrides,
  });
}

test("a verified term payment activates immediately for exactly 120 days", async () => {
  const prepared = await pending();
  assert.equal(prepared.priceId, essentialTermPrice);
  const purchasedAt = Date.now();
  const result = await store.activateSchoolPurchase({
    eventId: "event-term-1",
    transactionId: "txn_term_1",
    purchaseReference: prepared.purchaseReference,
    priceId: prepared.priceId,
    purchasedAt,
    environment: "PRODUCTION",
    quantity: 1,
  });
  assert.equal(result.school.status, "active");
  assert.equal(result.school.licence.endAt - result.school.licence.startAt, 120 * 24 * 60 * 60 * 1000);
  assert.equal(result.school.licence.studentSeatLimit, 50);
  assert.equal(result.administratorInvitation.email, "admin@verified.example");
  const status = await store.getSchoolPurchaseStatus(prepared.purchaseReference, prepared.statusToken);
  assert.equal(status.status, "active");
  assert.equal(status.licenceEndAt, result.school.licence.endAt);
});

test("an early Session renewal begins at the current expiry and adds one calendar year", async () => {
  const prepared = await pending("session");
  const dashboardBefore = JSON.parse(await readFile(process.env.SCHOOL_STORE_PATH, "utf8"));
  const schoolBefore = Object.values(dashboardBefore.schools)[0];
  const currentExpiry = schoolBefore.licence.endAt;
  const result = await store.activateSchoolPurchase({
    eventId: "event-session-2",
    transactionId: "txn_session_2",
    purchaseReference: prepared.purchaseReference,
    priceId: essentialSessionPrice,
    purchasedAt: Date.now() + 1000,
    environment: "PRODUCTION",
    quantity: 1,
  });
  assert.equal(result.purchase.licenceStartAt, currentExpiry);
  const expected = new Date(currentExpiry);
  expected.setUTCFullYear(expected.getUTCFullYear() + 1);
  assert.equal(result.purchase.licenceEndAt, expected.getTime());
  assert.equal(Object.values((JSON.parse(await readFile(process.env.SCHOOL_STORE_PATH, "utf8"))).schools).length, 1);
});

test("duplicate events are idempotent and refund removes only the refunded renewal period", async () => {
  const diskBefore = JSON.parse(await readFile(process.env.SCHOOL_STORE_PATH, "utf8"));
  const renewal = Object.values(diskBefore.schoolBillingPurchases).find((entry) => entry.transactionId === "txn_session_2");
  const duplicate = await store.activateSchoolPurchase({
    eventId: "event-session-2",
    transactionId: renewal.transactionId,
    purchaseReference: renewal.purchaseReference,
    priceId: renewal.priceId,
    purchasedAt: renewal.purchasedAt,
    environment: "PRODUCTION",
    quantity: renewal.quantity,
  });
  assert.equal(duplicate.idempotent, true);
  const refunded = await store.refundSchoolPurchase({ eventId: "event-refund-2", transactionId: "txn_session_2" });
  const originalTerm = Object.values(diskBefore.schoolBillingPurchases).find((entry) => entry.transactionId === "txn_term_1");
  assert.equal(refunded.school.licence.endAt, originalTerm.licenceEndAt);
  assert.equal((await store.refundSchoolPurchase({ eventId: "event-refund-2", transactionId: "txn_session_2" })).idempotent, true);
});

test("server-side catalogue rejects package learner counts outside their range", async () => {
  await assert.rejects(pending("term", { learnerCount: 9 }), /covers 10–100 learners/);
});


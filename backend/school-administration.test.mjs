import assert from "node:assert/strict";
import test from "node:test";
import { buildAcademicPackageEntitlements, buildAdministrationLicenceEntitlement, configuredAcademicPackageCodes, SCHOOL_ADMIN_MODULES, SCHOOL_ACADEMIC_PACKAGES } from "./school-admin-grants.mjs";
import { POSTGRES_MIGRATIONS } from "./postgres-migrations.mjs";

test("administration modules are separate, bounded licence features", () => {
  assert.deepEqual(SCHOOL_ADMIN_MODULES.map((module) => module.code), [
    "operations.foundation",
    "operations.attendance",
    "operations.planning",
    "operations.staff",
    "operations.transport",
  ]);
});

test("academic access is divided into independently selectable student and school packages", () => {
  assert.deepEqual(SCHOOL_ACADEMIC_PACKAGES.map((entry) => entry.code), [
    "academic.student",
    "academic.school",
  ]);
  assert.match(SCHOOL_ACADEMIC_PACKAGES[0].description, /Practice\/Quiz.*Competition Arena.*Learning Hub/);
  assert.match(SCHOOL_ACADEMIC_PACKAGES[1].description, /Classroom.*School Control/);
});

test("academic package reasons distinguish active, expired and not purchased", () => {
  const now = Date.parse("2026-09-29T12:00:00.000Z");
  const entitlements = buildAcademicPackageEntitlements([
    { featureCode: "academic.selection", status: "active", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2027-01-01T00:00:00.000Z" },
    { featureCode: "academic.student", status: "active", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-09-01T00:00:00.000Z" },
  ], now);
  assert.equal(entitlements["academic.student"].status, "expired");
  assert.equal(entitlements["academic.school"].status, "not_purchased");
  assert.equal(buildAcademicPackageEntitlements([], now)["academic.student"].status, "active");
});

test("school renewal preserves configured academic packages even after their former dates expire", () => {
  const grants = [
    { featureCode: "academic.selection", status: "expired", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-09-01T00:00:00.000Z", metadata: { packages: ["academic.school"] } },
    { featureCode: "academic.school", status: "expired", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-09-01T00:00:00.000Z", metadata: {} },
  ];
  assert.deepEqual(configuredAcademicPackageCodes(grants), ["academic.school"]);
  assert.deepEqual(configuredAcademicPackageCodes([]), ["academic.student", "academic.school"]);
  assert.deepEqual(configuredAcademicPackageCodes([
    { featureCode: "academic.selection", status: "active", metadata: {} },
    { featureCode: "academic.school", status: "expired", metadata: {} },
  ]), ["academic.school"]);
  assert.deepEqual(configuredAcademicPackageCodes([
    { featureCode: "academic.selection", status: "active", metadata: { packages: ["academic.school"] } },
    { featureCode: "academic.school", status: "expired", metadata: {} },
  ]), ["academic.school"]);
  assert.deepEqual(configuredAcademicPackageCodes([
    { featureCode: "academic.selection", status: "active", metadata: {} },
    { featureCode: "academic.school", status: "revoked", metadata: {} },
  ]), ["academic.school"]);
});

test("school-controlled sensitive collection options default off", () => {
  const sql = POSTGRES_MIGRATIONS.at(-1).sql;
  for (const setting of ["studentPhotograph", "staffPhotograph", "birthCertificate", "identityDocument", "medicalDocument"]) {
    assert.match(sql, new RegExp(`\\"${setting}\\": false`));
  }
});

test("administration licence status is independent of academic package status", () => {
  const now = Date.parse("2026-10-04T08:00:00.000Z");
  const active = buildAdministrationLicenceEntitlement([
    { featureCode: "operations.foundation", status: "active", startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z" },
    { featureCode: "operations.attendance", status: "active", startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z" },
  ], now);
  assert.equal(active.status, "active");
  assert.deepEqual(active.activeModules, ["operations.foundation", "operations.attendance"]);
  assert.equal(buildAdministrationLicenceEntitlement([], now).status, "not_purchased");
});

test("transport schema supports uniform and varying route prices", () => {
  const sql = POSTGRES_MIGRATIONS.at(-1).sql;
  assert.match(sql, /transport_pricing_mode IN \('uniform', 'varying'\)/);
  assert.match(sql, /uniform_route_price_minor/);
  assert.match(sql, /price_minor/);
  assert.match(sql, /price_minor IS NULL OR price_minor >= 0/);
});

test("sensitive administrative permissions are explicit", () => {
  const sql = POSTGRES_MIGRATIONS.at(-1).sql;
  for (const permission of ["administrators.manage", "attendance.amend", "sensitive_records.view", "school.export_all", "people.archive"]) {
    assert.match(sql, new RegExp(permission.replace(".", "\\.")));
  }
});

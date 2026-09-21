import assert from "node:assert/strict";
import test from "node:test";
import { SCHOOL_ADMIN_MODULES } from "./school-admin-grants.mjs";
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

test("school-controlled sensitive collection options default off", () => {
  const sql = POSTGRES_MIGRATIONS.at(-1).sql;
  for (const setting of ["studentPhotograph", "staffPhotograph", "birthCertificate", "identityDocument", "medicalDocument"]) {
    assert.match(sql, new RegExp(`\\"${setting}\\": false`));
  }
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

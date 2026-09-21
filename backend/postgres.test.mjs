import assert from "node:assert/strict";
import test from "node:test";
import { POSTGRES_MIGRATIONS } from "./postgres-migrations.mjs";
import { getPostgresDiagnostics, initializePostgres } from "./postgres.mjs";

test("PostgreSQL stays optional when DATABASE_URL is absent", async () => {
  const result = await initializePostgres();
  assert.equal(result.configured, false);
  assert.equal(result.connected, false);
  assert.equal(result.mode, "off");
});

test("administration schema is versioned and tenant scoped", () => {
  assert.ok(POSTGRES_MIGRATIONS.length > 0);
  const sql = POSTGRES_MIGRATIONS.map((migration) => migration.sql).join("\n");
  assert.match(sql, /quiks_school_feature_grants/);
  assert.match(sql, /quiks_school_people/);
  assert.match(sql, /quiks_attendance_records/);
  assert.match(sql, /quiks_lesson_plans/);
  assert.match(sql, /quiks_timetables/);
  assert.match(sql, /quiks_transport_assignments/);
  assert.match(sql, /quiks_audit_events/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /quiks\.owner_context/);
  assert.match(sql, /quiks_legacy_imports/);
  assert.match(sql, /quiks_school_admin_settings/);
  assert.match(sql, /transport_pricing_mode/);
  assert.match(sql, /uniform_route_price_minor/);
});

test("audit records are protected from updates and deletions", () => {
  const sql = POSTGRES_MIGRATIONS.map((migration) => migration.sql).join("\n");
  assert.match(sql, /BEFORE UPDATE OR DELETE ON quiks_audit_events/);
  assert.match(sql, /append-only/);
});

import { getPostgresDiagnostics, withOwnerTransaction, withSchoolTransaction } from "./postgres.mjs";

export const SCHOOL_ADMIN_MODULES = Object.freeze([
  { code: "operations.foundation", name: "Operations Foundation" },
  { code: "operations.attendance", name: "Attendance" },
  { code: "operations.planning", name: "Planning & Scheduling" },
  { code: "operations.staff", name: "Staff Management" },
  { code: "operations.transport", name: "Transport Management" },
]);

const moduleCodes = new Set(SCHOOL_ADMIN_MODULES.map((module) => module.code));

export async function hasActiveAdministrationGrant(schoolId, featureCode = "operations.foundation") {
  if (!getPostgresDiagnostics().connected) return false;
  return withSchoolTransaction(schoolId, async (client) => {
    const result = await client.query(
      `SELECT 1 FROM quiks_school_feature_grants
       WHERE school_id = $1 AND feature_code = $2 AND status = 'active'
         AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
       LIMIT 1`,
      [schoolId, featureCode]
    );
    return result.rowCount > 0;
  }).catch(() => false);
}

export async function listAdministrationGrants(schoolId) {
  if (!getPostgresDiagnostics().connected) {
    throw Object.assign(new Error("The school administration database is unavailable."), { statusCode: 503 });
  }
  return withSchoolTransaction(schoolId, async (client) => {
    const result = await client.query(
      `SELECT feature_code AS "featureCode", status, starts_at AS "startsAt", ends_at AS "endsAt"
       FROM quiks_school_feature_grants
       WHERE school_id = $1 AND feature_code LIKE 'operations.%'
       ORDER BY feature_code, starts_at DESC`,
      [schoolId]
    );
    return result.rows;
  });
}

export async function replaceAdministrationGrants({ school, principal, modules, startsAt, endsAt }) {
  const selected = [...new Set((Array.isArray(modules) ? modules : []).map(String))].filter((code) => moduleCodes.has(code));
  if (selected.some((code) => code !== "operations.foundation") && !selected.includes("operations.foundation")) {
    throw Object.assign(new Error("Operations Foundation is required for every administration add-on."), { statusCode: 400 });
  }
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw Object.assign(new Error("Choose valid administration licence dates."), { statusCode: 400 });
  }
  return withOwnerTransaction(async (client) => {
    await client.query(
      `INSERT INTO quiks_schools (id, name, status, metadata, created_at)
       VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::timestamptz, now()))
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, metadata = EXCLUDED.metadata, updated_at = now()`,
      [school.schoolId, school.name, school.archivedAt ? "archived" : "active", JSON.stringify({ schoolCode: school.schoolCode }), new Date(school.createdAt).toISOString()]
    );
    await client.query(
      `UPDATE quiks_school_feature_grants
       SET status = 'revoked', updated_at = now()
       WHERE school_id = $1 AND feature_code LIKE 'operations.%' AND status = 'active'`,
      [school.schoolId]
    );
    for (const featureCode of selected) {
      await client.query(
        `INSERT INTO quiks_school_feature_grants
           (school_id, feature_code, source, status, starts_at, ends_at, metadata)
         VALUES ($1, $2, 'app_owner', 'active', $3, $4, '{}'::jsonb)
         ON CONFLICT (school_id, feature_code, starts_at) DO UPDATE SET
           status = 'active', ends_at = EXCLUDED.ends_at, updated_at = now()`,
        [school.schoolId, featureCode, start.toISOString(), end.toISOString()]
      );
    }
    await client.query(
      `INSERT INTO quiks_audit_events
         (school_id, actor_principal_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'administration.modules.updated', 'school', $1, $3::jsonb)`,
      [school.schoolId, principal.principalId, JSON.stringify({ modules: selected, startsAt: start.toISOString(), endsAt: end.toISOString() })]
    );
    return listAdministrationGrantsWithinClient(client, school.schoolId);
  });
}

async function listAdministrationGrantsWithinClient(client, schoolId) {
  const result = await client.query(
    `SELECT feature_code AS "featureCode", status, starts_at AS "startsAt", ends_at AS "endsAt"
     FROM quiks_school_feature_grants
     WHERE school_id = $1 AND feature_code LIKE 'operations.%'
     ORDER BY feature_code, starts_at DESC`,
    [schoolId]
  );
  return result.rows;
}

import { Pool } from "pg";
import { POSTGRES_MIGRATIONS } from "./postgres-migrations.mjs";
import { importLegacySchoolStore } from "./postgres-legacy-import.mjs";

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const configuredMode = String(process.env.QUIKS_POSTGRES_MODE || (databaseUrl ? "shadow" : "off"))
  .trim()
  .toLowerCase();
const allowedModes = new Set(["off", "shadow", "primary"]);
const mode = allowedModes.has(configuredMode) ? configuredMode : "off";
const required = mode === "primary" || /^(1|true|yes)$/i.test(String(process.env.QUIKS_POSTGRES_REQUIRED || ""));

let pool;
let diagnostics = {
  configured: Boolean(databaseUrl),
  mode,
  required,
  connected: false,
  schemaVersion: 0,
  targetSchemaVersion: POSTGRES_MIGRATIONS.at(-1)?.version ?? 0,
  serverVersion: null,
  initializedAt: null,
  lastError: null,
  legacyImport: null,
};

function sslConfiguration() {
  const setting = String(process.env.QUIKS_DATABASE_SSL || "").trim().toLowerCase();
  if (setting === "require") {
    return { rejectUnauthorized: false };
  }
  if (setting === "disable") {
    return false;
  }
  return undefined;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.QUIKS_DATABASE_POOL_SIZE || 5),
      connectionTimeoutMillis: Number(process.env.QUIKS_DATABASE_CONNECT_TIMEOUT_MS || 10000),
      idleTimeoutMillis: 30000,
      ssl: sslConfiguration(),
      application_name: "quiks-app",
    });
    pool.on("error", (error) => {
      diagnostics = { ...diagnostics, connected: false, lastError: error.message };
      console.error("PostgreSQL idle client error:", error.message);
    });
  }
  return pool;
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS quiks_schema_migrations (
      version integer PRIMARY KEY,
      name text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function runPostgresMigrations(client) {
  await client.query("SELECT pg_advisory_lock($1)", [824751902]);
  try {
    await ensureMigrationTable(client);
    const appliedResult = await client.query("SELECT version FROM quiks_schema_migrations ORDER BY version");
    const applied = new Set(appliedResult.rows.map((row) => Number(row.version)));

    for (const migration of POSTGRES_MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO quiks_schema_migrations (version, name) VALUES ($1, $2)",
          [migration.version, migration.name]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    const versionResult = await client.query("SELECT COALESCE(MAX(version), 0) AS version FROM quiks_schema_migrations");
    return Number(versionResult.rows[0]?.version || 0);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [824751902]).catch(() => {});
  }
}

export async function initializePostgres() {
  if (!databaseUrl || mode === "off") {
    diagnostics = { ...diagnostics, connected: false, lastError: null };
    return getPostgresDiagnostics();
  }

  const client = await getPool().connect().catch((error) => {
    diagnostics = { ...diagnostics, connected: false, lastError: error.message };
    if (required) throw error;
    return null;
  });
  if (!client) return getPostgresDiagnostics();

  try {
    const versionResult = await client.query("SHOW server_version");
    const schemaVersion = await runPostgresMigrations(client);
    const importMode = String(process.env.QUIKS_POSTGRES_IMPORT_JSON || "").trim().toLowerCase();
    let legacyImport = null;
    if (importMode === "school-v1") {
      const sourcePath = String(process.env.SCHOOL_STORE_PATH || "").trim();
      if (!sourcePath) throw new Error("SCHOOL_STORE_PATH is required for the school-v1 PostgreSQL import.");
      legacyImport = await importLegacySchoolStore(client, sourcePath);
    }
    diagnostics = {
      ...diagnostics,
      connected: true,
      serverVersion: versionResult.rows[0]?.server_version ?? null,
      schemaVersion,
      initializedAt: new Date().toISOString(),
      lastError: null,
      legacyImport,
    };
  } catch (error) {
    diagnostics = { ...diagnostics, connected: false, lastError: error.message };
    if (required) throw error;
  } finally {
    client.release();
  }
  return getPostgresDiagnostics();
}

export function getPostgresDiagnostics() {
  return { ...diagnostics };
}

export async function withSchoolTransaction(schoolId, callback) {
  if (!databaseUrl || mode === "off") {
    throw new Error("PostgreSQL is not enabled.");
  }
  const normalizedSchoolId = String(schoolId || "").trim();
  if (!normalizedSchoolId) throw new Error("A school ID is required.");

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('quiks.school_id', $1, true)", [normalizedSchoolId]);
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function withOwnerTransaction(callback) {
  if (!databaseUrl || mode === "off") {
    throw new Error("PostgreSQL is not enabled.");
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('quiks.owner_context', 'true', true)");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePostgres() {
  if (pool) await pool.end();
  pool = undefined;
}

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

function asTimestamp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return new Date(numeric).toISOString();
}

function splitDisplayName(value, fallbackEmail) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) words.push(String(fallbackEmail || "Member").split("@")[0] || "Member");
  return {
    givenName: words[0],
    familyName: words.slice(1).join(" ") || "—",
  };
}

function recordValues(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.values(value) : [];
}

export async function importLegacySchoolStore(client, sourcePath) {
  const raw = await readFile(sourcePath, "utf8");
  const sourceHash = createHash("sha256").update(raw).digest("hex");
  const importKey = `school-json-v1:${sourceHash}`;
  const existing = await client.query("SELECT imported_counts FROM quiks_legacy_imports WHERE import_key = $1", [importKey]);
  if (existing.rowCount) {
    return { status: "already_imported", sourceHash, counts: existing.rows[0].imported_counts };
  }

  const store = JSON.parse(raw);
  const schools = recordValues(store.schools);
  const memberships = recordValues(store.memberships);
  const counts = { schools: 0, memberships: 0, people: 0, featureGrants: 0 };

  await client.query("BEGIN");
  try {
    await client.query("SELECT set_config('quiks.owner_context', 'true', true)");
    for (const school of schools) {
      if (!school?.id || !school?.name) continue;
      await client.query(
        `INSERT INTO quiks_schools (id, name, status, metadata, created_at, archived_at)
         VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::timestamptz, now()), $6::timestamptz)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           status = EXCLUDED.status,
           metadata = EXCLUDED.metadata,
           archived_at = EXCLUDED.archived_at,
           updated_at = now()`,
        [
          school.id,
          school.name,
          school.archivedAt ? "archived" : school.licence?.status === "suspended" ? "suspended" : "active",
          JSON.stringify({
            schoolCode: school.schoolCode ?? null,
            curriculum: school.curriculum ?? "",
            enrolmentMode: school.enrolmentMode ?? "shared_code",
            profileFields: school.profileFields ?? [],
            licence: school.licence ?? {},
            legacySource: "school-store.json",
          }),
          asTimestamp(school.createdAt),
          asTimestamp(school.archivedAt),
        ]
      );
      counts.schools += 1;

      const licence = school.licence;
      if (Number.isFinite(Number(licence?.startAt))) {
        await client.query(
          `INSERT INTO quiks_school_feature_grants
             (school_id, feature_code, source, status, starts_at, ends_at, metadata)
           VALUES ($1, 'academic.core', $2, $3, $4::timestamptz, $5::timestamptz, $6::jsonb)
           ON CONFLICT (school_id, feature_code, starts_at) DO UPDATE SET
             status = EXCLUDED.status,
             ends_at = EXCLUDED.ends_at,
             metadata = EXCLUDED.metadata,
             updated_at = now()`,
          [
            school.id,
            licence.billingSource ?? "owner",
            licence.status === "suspended" ? "revoked" : Number(licence.endAt) <= Date.now() ? "expired" : "active",
            asTimestamp(licence.startAt),
            asTimestamp(licence.endAt),
            JSON.stringify(licence),
          ]
        );
        counts.featureGrants += 1;
      }
    }

    const roleRows = await client.query("SELECT id, code FROM quiks_school_roles WHERE school_id IS NULL");
    const systemRoles = new Map(roleRows.rows.map((row) => [row.code, row.id]));
    for (const membership of memberships) {
      if (!membership?.membershipId || !membership?.schoolId || !membership?.email) continue;
      if (!schools.some((school) => school.id === membership.schoolId)) continue;
      await client.query(
        `INSERT INTO quiks_school_memberships
           (id, school_id, principal_id, email, display_name, membership_status, joined_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, COALESCE($8::timestamptz, now()))
         ON CONFLICT (id) DO UPDATE SET
           principal_id = EXCLUDED.principal_id,
           email = EXCLUDED.email,
           display_name = EXCLUDED.display_name,
           membership_status = EXCLUDED.membership_status,
           joined_at = EXCLUDED.joined_at,
           updated_at = now()`,
        [
          membership.membershipId,
          membership.schoolId,
          membership.principalId ?? null,
          String(membership.email).toLowerCase(),
          membership.displayName ?? null,
          ["pending", "active", "rejected", "suspended", "archived"].includes(membership.status)
            ? membership.status
            : "pending",
          asTimestamp(membership.joinedAt),
          asTimestamp(membership.createdAt),
        ]
      );
      counts.memberships += 1;

      const roleId = systemRoles.get(membership.role);
      if (roleId) {
        await client.query(
          "INSERT INTO quiks_membership_roles (membership_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [membership.membershipId, roleId]
        );
      }

      if (membership.status === "active" && ["student", "teacher"].includes(membership.role)) {
        const personId = `legacy:${membership.membershipId}`;
        const names = splitDisplayName(membership.displayName, membership.email);
        const personType = membership.role === "student" ? "student" : "staff";
        await client.query(
          `INSERT INTO quiks_school_people
             (id, school_id, membership_id, person_type, given_name, family_name, email, status, custom_fields, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8::jsonb, COALESCE($9::timestamptz, now()))
           ON CONFLICT (id) DO UPDATE SET
             membership_id = EXCLUDED.membership_id,
             given_name = EXCLUDED.given_name,
             family_name = EXCLUDED.family_name,
             email = EXCLUDED.email,
             custom_fields = EXCLUDED.custom_fields,
             updated_at = now()`,
          [
            personId,
            membership.schoolId,
            membership.membershipId,
            personType,
            names.givenName,
            names.familyName,
            String(membership.email).toLowerCase(),
            JSON.stringify(membership.profileData ?? {}),
            asTimestamp(membership.createdAt),
          ]
        );
        if (personType === "student") {
          await client.query(
            `INSERT INTO quiks_students (person_id, school_id, admission_number, metadata)
             VALUES ($1, $2, $3, $4::jsonb)
             ON CONFLICT (person_id) DO UPDATE SET admission_number = EXCLUDED.admission_number, metadata = EXCLUDED.metadata`,
            [personId, membership.schoolId, membership.profileData?.admissionNumber ?? null, JSON.stringify({ legacy: true })]
          );
        } else {
          await client.query(
            `INSERT INTO quiks_staff (person_id, school_id, employee_number, metadata)
             VALUES ($1, $2, $3, $4::jsonb)
             ON CONFLICT (person_id) DO UPDATE SET employee_number = EXCLUDED.employee_number, metadata = EXCLUDED.metadata`,
            [personId, membership.schoolId, membership.profileData?.admissionNumber ?? null, JSON.stringify({ legacy: true })]
          );
        }
        counts.people += 1;
      }
    }

    await client.query(
      `INSERT INTO quiks_legacy_imports (import_key, source_path, source_sha256, imported_counts)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [importKey, sourcePath, sourceHash, JSON.stringify(counts)]
    );
    await client.query("COMMIT");
    return { status: "imported", sourceHash, counts };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

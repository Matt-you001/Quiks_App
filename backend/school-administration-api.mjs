import { randomUUID } from "node:crypto";
import { getAppOwnerEntitlement, getSchoolAdministrationContext } from "./school-store.mjs";
import {
  SCHOOL_ADMIN_MODULES,
  listAdministrationGrants,
  replaceAdministrationGrants,
} from "./school-admin-grants.mjs";
import { withSchoolTransaction } from "./postgres.mjs";

const collectionKeys = [
  "studentPhotograph",
  "staffPhotograph",
  "birthCertificate",
  "identityDocument",
  "medicalDocument",
];

function badRequest(message) {
  throw Object.assign(new Error(message), { statusCode: 400 });
}

function forbidden(message) {
  throw Object.assign(new Error(message), { statusCode: 403 });
}

function requireOwner(principal) {
  if (!getAppOwnerEntitlement(principal)) forbidden("Only the configured Quiks App Owner can manage administration module licences.");
}

function requireSchoolOperator(context) {
  if (context.isAppOwner) forbidden("The App Owner may inspect school records but cannot operate a school's internal administration.");
}

function requireSchoolOwner(context) {
  requireSchoolOperator(context);
  if (!context.isSchoolOwner) forbidden("Only the School Owner can perform this action.");
}

function activeModuleCodes(grants) {
  const now = Date.now();
  return [...new Set(grants.filter((grant) =>
    grant.status === "active" &&
    new Date(grant.startsAt).getTime() <= now &&
    (!grant.endsAt || new Date(grant.endsAt).getTime() > now)
  ).map((grant) => grant.featureCode))];
}

function requireModule(activeModules, code) {
  if (!activeModules.includes("operations.foundation")) {
    forbidden("An active Quiks School Operations Foundation licence is required.");
  }
  if (code !== "operations.foundation" && !activeModules.includes(code)) {
    const name = SCHOOL_ADMIN_MODULES.find((module) => module.code === code)?.name ?? code;
    forbidden(`The school's administration licence does not include ${name}.`);
  }
}

async function contextAndModules(principal, schoolId) {
  const context = await getSchoolAdministrationContext(principal, schoolId);
  await withSchoolTransaction(schoolId, async (client) => {
    await client.query(
      `INSERT INTO quiks_schools (id, name, status, metadata, created_at)
       VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::timestamptz, now()))
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, metadata = EXCLUDED.metadata, updated_at = now()`,
      [context.school.schoolId, context.school.name, context.school.archivedAt ? "archived" : "active", JSON.stringify({ schoolCode: context.school.schoolCode }), new Date(context.school.createdAt).toISOString()]
    );
    for (const membership of context.memberships) {
      await client.query(
        `INSERT INTO quiks_school_memberships
           (id, school_id, principal_id, email, display_name, membership_status, joined_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, COALESCE($8::timestamptz, now()))
         ON CONFLICT (id) DO UPDATE SET
           principal_id = COALESCE(EXCLUDED.principal_id, quiks_school_memberships.principal_id), email = EXCLUDED.email, display_name = EXCLUDED.display_name,
           membership_status = EXCLUDED.membership_status, joined_at = EXCLUDED.joined_at, updated_at = now()`,
        [membership.membershipId, schoolId, null, membership.email, membership.displayName, membership.status === "invited" ? "pending" : membership.status, membership.joinedAt ? new Date(membership.joinedAt).toISOString() : null, new Date(membership.createdAt).toISOString()]
      );
    }
  });
  const grants = await listAdministrationGrants(schoolId);
  return { context, grants, activeModules: activeModuleCodes(grants) };
}

async function audit(client, context, action, entityType, entityId, details = {}) {
  await client.query(
    `INSERT INTO quiks_audit_events
       (school_id, actor_principal_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [context.school.schoolId, context.principal.principalId, action, entityType, entityId, JSON.stringify(details)]
  );
}

function normalizeSettings(row) {
  return {
    collectionSettings: Object.fromEntries(collectionKeys.map((key) => [key, row?.collection_settings?.[key] === true])),
    transportPricingMode: row?.transport_pricing_mode === "varying" ? "varying" : "uniform",
    uniformRoutePriceMinor: row?.uniform_route_price_minor === null || row?.uniform_route_price_minor === undefined
      ? null
      : Number(row.uniform_route_price_minor),
    currency: String(row?.currency || "NGN"),
  };
}

async function getSummary(principal, schoolId) {
  const { context, grants, activeModules } = await contextAndModules(principal, schoolId);
  return withSchoolTransaction(schoolId, async (client) => {
    const [settingsResult, peopleResult, routesResult, vehiclesResult, assignmentsResult, attendanceResult, plansResult, timetablesResult, timetableEntriesResult, reportsResult, auditResult] = await Promise.all([
      client.query("SELECT * FROM quiks_school_admin_settings WHERE school_id = $1", [schoolId]),
      client.query(
        `SELECT id, person_type AS "personType", given_name AS "givenName", family_name AS "familyName",
                email, phone, status, custom_fields AS "customFields", created_at AS "createdAt"
         FROM quiks_school_people WHERE school_id = $1 ORDER BY family_name, given_name`,
        [schoolId]
      ),
      client.query(
        `SELECT id, name, price_minor AS "priceMinor", currency, status, created_at AS "createdAt"
         FROM quiks_transport_routes WHERE school_id = $1 AND status <> 'archived' ORDER BY name`,
        [schoolId]
      ),
      client.query(
        `SELECT id, registration_number AS "registrationNumber", capacity, status
         FROM quiks_vehicles WHERE school_id = $1 AND status <> 'archived' ORDER BY registration_number`,
        [schoolId]
      ),
      client.query(
        `SELECT assignment.id, assignment.route_id AS "routeId", assignment.vehicle_id AS "vehicleId",
                assignment.person_id AS "personId", assignment.starts_on AS "startsOn", assignment.ends_on AS "endsOn",
                assignment.status, route.name AS "routeName", vehicle.registration_number AS "registrationNumber"
         FROM quiks_transport_assignments assignment
         JOIN quiks_transport_routes route ON route.id = assignment.route_id
         LEFT JOIN quiks_vehicles vehicle ON vehicle.id = assignment.vehicle_id
         WHERE assignment.school_id = $1 AND assignment.status <> 'archived' ORDER BY assignment.starts_on DESC`,
        [schoolId]
      ),
      client.query(
        `SELECT session.id, session.attendance_date AS "attendanceDate", session.session_label AS "sessionLabel",
                session.created_at AS "createdAt", count(record.person_id)::integer AS "recordCount"
         FROM quiks_attendance_sessions session
         LEFT JOIN quiks_attendance_records record ON record.attendance_session_id = session.id
         WHERE session.school_id = $1 GROUP BY session.id ORDER BY session.attendance_date DESC, session.created_at DESC LIMIT 60`,
        [schoolId]
      ),
      client.query(
        `SELECT id, subject, title, status, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM quiks_lesson_plans WHERE school_id = $1 AND status <> 'archived' ORDER BY updated_at DESC LIMIT 100`,
        [schoolId]
      ),
      client.query(
        `SELECT id, timetable_type AS "timetableType", name, status, created_at AS "createdAt"
         FROM quiks_timetables WHERE school_id = $1 AND status <> 'archived' ORDER BY created_at DESC`,
        [schoolId]
      ),
      client.query(
        `SELECT id, timetable_id AS "timetableId", subject, title, starts_at AS "startsAt", ends_at AS "endsAt", location
         FROM quiks_timetable_entries WHERE school_id = $1 ORDER BY starts_at`,
        [schoolId]
      ),
      client.query(
        `SELECT id, staff_person_id AS "staffPersonId", report_type AS "reportType", status,
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM quiks_staff_reports WHERE school_id = $1 AND status <> 'archived' ORDER BY updated_at DESC LIMIT 100`,
        [schoolId]
      ),
      client.query(
        `SELECT id, action, entity_type AS "entityType", entity_id AS "entityId", occurred_at AS "occurredAt"
         FROM quiks_audit_events WHERE school_id = $1 ORDER BY occurred_at DESC LIMIT 30`,
        [schoolId]
      ),
    ]);
    return {
      modules: SCHOOL_ADMIN_MODULES,
      grants,
      activeModules,
      settings: normalizeSettings(settingsResult.rows[0]),
      people: peopleResult.rows,
      routes: routesResult.rows,
      vehicles: vehiclesResult.rows,
      transportAssignments: assignmentsResult.rows,
      attendanceSessions: attendanceResult.rows,
      lessonPlans: plansResult.rows,
      timetables: timetablesResult.rows,
      timetableEntries: timetableEntriesResult.rows,
      staffReports: context.isAppOwner ? [] : reportsResult.rows,
      recentAudit: auditResult.rows,
      viewer: { role: context.isAppOwner ? "app_owner" : context.isSchoolOwner ? "school_owner" : "school_admin", displayName: context.principal.name || context.principal.email },
    };
  });
}

async function updateSettings(principal, payload) {
  const schoolId = String(payload.schoolId || "");
  const { context, activeModules } = await contextAndModules(principal, schoolId);
  requireSchoolOperator(context);
  requireModule(activeModules, "operations.foundation");
  const pricingMode = payload.transportPricingMode === "varying" ? "varying" : "uniform";
  const currency = String(payload.currency || "NGN").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) badRequest("Choose a valid three-letter currency code.");
  const uniformPrice = payload.uniformRoutePriceMinor === null || payload.uniformRoutePriceMinor === ""
    ? null
    : Number(payload.uniformRoutePriceMinor);
  if (pricingMode === "uniform" && (!Number.isInteger(uniformPrice) || uniformPrice < 0)) {
    badRequest("Enter the uniform transport price.");
  }
  const collectionSettings = Object.fromEntries(collectionKeys.map((key) => [key, payload.collectionSettings?.[key] === true]));
  return withSchoolTransaction(schoolId, async (client) => {
    const routes = await client.query("SELECT id, price_minor FROM quiks_transport_routes WHERE school_id = $1 AND status <> 'archived'", [schoolId]);
    const routePrices = payload.routePrices && typeof payload.routePrices === "object" ? payload.routePrices : {};
    if (pricingMode === "varying") {
      for (const route of routes.rows) {
        const supplied = routePrices[route.id];
        const price = supplied === undefined ? Number(route.price_minor) : Number(supplied);
        if (!Number.isInteger(price) || price < 0) badRequest("Assign a valid price to every transport route before selecting varying prices.");
      }
    }
    await client.query(
      `INSERT INTO quiks_school_admin_settings
         (school_id, collection_settings, transport_pricing_mode, uniform_route_price_minor, currency, updated_by_principal_id)
       VALUES ($1, $2::jsonb, $3, $4, $5, $6)
       ON CONFLICT (school_id) DO UPDATE SET
         collection_settings = EXCLUDED.collection_settings,
         transport_pricing_mode = EXCLUDED.transport_pricing_mode,
         uniform_route_price_minor = EXCLUDED.uniform_route_price_minor,
         currency = EXCLUDED.currency,
         updated_by_principal_id = EXCLUDED.updated_by_principal_id,
         updated_at = now()`,
      [schoolId, JSON.stringify(collectionSettings), pricingMode, pricingMode === "uniform" ? uniformPrice : null, currency, context.principal.principalId]
    );
    if (pricingMode === "uniform") {
      await client.query("UPDATE quiks_transport_routes SET price_minor = $2, currency = $3 WHERE school_id = $1 AND status <> 'archived'", [schoolId, uniformPrice, currency]);
    } else {
      for (const route of routes.rows) {
        const price = routePrices[route.id] === undefined ? Number(route.price_minor) : Number(routePrices[route.id]);
        await client.query("UPDATE quiks_transport_routes SET price_minor = $3, currency = $4 WHERE school_id = $1 AND id = $2", [schoolId, route.id, price, currency]);
      }
    }
    await audit(client, context, "administration.settings.updated", "school", schoolId, { collectionSettings, pricingMode, currency });
    return { settings: { collectionSettings, transportPricingMode: pricingMode, uniformRoutePriceMinor: pricingMode === "uniform" ? uniformPrice : null, currency } };
  });
}

async function createPerson(principal, payload) {
  const schoolId = String(payload.schoolId || "");
  const { context, activeModules } = await contextAndModules(principal, schoolId);
  requireSchoolOperator(context);
  requireModule(activeModules, "operations.foundation");
  const personType = ["student", "staff", "guardian"].includes(payload.personType) ? payload.personType : null;
  const givenName = String(payload.givenName || "").trim();
  const familyName = String(payload.familyName || "").trim();
  if (!personType || !givenName || !familyName) badRequest("Person type, given name and family name are required.");
  const id = randomUUID();
  return withSchoolTransaction(schoolId, async (client) => {
    await client.query(
      `INSERT INTO quiks_school_people
         (id, school_id, person_type, given_name, family_name, email, phone, custom_fields)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [id, schoolId, personType, givenName, familyName, String(payload.email || "").trim().toLowerCase() || null, String(payload.phone || "").trim() || null, JSON.stringify(payload.customFields || {})]
    );
    if (personType === "student") {
      await client.query("INSERT INTO quiks_students (person_id, school_id, admission_number) VALUES ($1, $2, $3)", [id, schoolId, String(payload.identifier || "").trim() || null]);
    } else if (personType === "staff") {
      await client.query("INSERT INTO quiks_staff (person_id, school_id, employee_number) VALUES ($1, $2, $3)", [id, schoolId, String(payload.identifier || "").trim() || null]);
    } else {
      await client.query("INSERT INTO quiks_guardians (person_id, school_id) VALUES ($1, $2)", [id, schoolId]);
    }
    await audit(client, context, "people.created", personType, id, { givenName, familyName });
    return { id };
  });
}

async function archivePerson(principal, payload) {
  const schoolId = String(payload.schoolId || "");
  const { context, activeModules } = await contextAndModules(principal, schoolId);
  requireSchoolOwner(context);
  requireModule(activeModules, "operations.foundation");
  const personId = String(payload.personId || "");
  if (!personId) badRequest("Choose the person to archive.");
  return withSchoolTransaction(schoolId, async (client) => {
    const result = await client.query(
      "UPDATE quiks_school_people SET status = 'archived', archived_at = now(), updated_at = now() WHERE school_id = $1 AND id = $2 RETURNING id",
      [schoolId, personId]
    );
    if (!result.rowCount) throw Object.assign(new Error("Student or staff record not found."), { statusCode: 404 });
    await audit(client, context, "people.archived", "person", personId);
    return { personId, archived: true };
  });
}

async function createRoute(principal, payload) {
  const schoolId = String(payload.schoolId || "");
  const { context, activeModules } = await contextAndModules(principal, schoolId);
  requireSchoolOperator(context);
  requireModule(activeModules, "operations.transport");
  const name = String(payload.name || "").trim();
  if (!name) badRequest("Enter the transport route name.");
  return withSchoolTransaction(schoolId, async (client) => {
    const settingsResult = await client.query("SELECT * FROM quiks_school_admin_settings WHERE school_id = $1", [schoolId]);
    const settings = normalizeSettings(settingsResult.rows[0]);
    const suppliedPrice = Number(payload.priceMinor);
    const price = settings.transportPricingMode === "uniform" ? settings.uniformRoutePriceMinor : suppliedPrice;
    if (!Number.isInteger(price) || price < 0) {
      badRequest(settings.transportPricingMode === "varying" ? "Assign a price to this route." : "Set the uniform transport price before creating routes.");
    }
    const id = randomUUID();
    await client.query(
      "INSERT INTO quiks_transport_routes (id, school_id, name, price_minor, currency) VALUES ($1, $2, $3, $4, $5)",
      [id, schoolId, name, price, settings.currency]
    );
    await audit(client, context, "transport.route.created", "transport_route", id, { name, priceMinor: price, currency: settings.currency });
    return { id, name, priceMinor: price, currency: settings.currency, status: "active" };
  });
}

async function submitAttendance(principal, payload) {
  const schoolId = String(payload.schoolId || "");
  const { context, activeModules } = await contextAndModules(principal, schoolId);
  requireSchoolOperator(context);
  requireModule(activeModules, "operations.attendance");
  const date = String(payload.date || "");
  const records = Array.isArray(payload.records) ? payload.records : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !records.length) badRequest("Attendance date and at least one record are required.");
  return withSchoolTransaction(schoolId, async (client) => {
    const sessionId = randomUUID();
    await client.query(
      `INSERT INTO quiks_attendance_sessions (id, school_id, attendance_date, session_label)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, schoolId, date, String(payload.sessionLabel || "day").slice(0, 60)]
    );
    for (const record of records) {
      const status = ["present", "absent", "late", "excused"].includes(record.status) ? record.status : null;
      if (!record.personId || !status) badRequest("Every attendance entry requires a person and valid status.");
      await client.query(
        `INSERT INTO quiks_attendance_records
           (school_id, attendance_session_id, person_id, attendance_status, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [schoolId, sessionId, record.personId, status, String(record.note || "").slice(0, 500) || null]
      );
    }
    await audit(client, context, "attendance.submitted", "attendance_session", sessionId, { date, recordCount: records.length });
    return { sessionId, recordCount: records.length };
  });
}

async function amendAttendance(principal, payload) {
  const schoolId = String(payload.schoolId || "");
  const { context, activeModules } = await contextAndModules(principal, schoolId);
  requireSchoolOperator(context); requireModule(activeModules, "operations.attendance");
  const sessionId = String(payload.sessionId || "");
  const personId = String(payload.personId || "");
  const status = ["present", "absent", "late", "excused"].includes(payload.status) ? payload.status : null;
  const reason = String(payload.reason || "").trim();
  if (!sessionId || !personId || !status || reason.length < 3) badRequest("Attendance record, new status and an amendment reason are required.");
  return withSchoolTransaction(schoolId, async (client) => {
    const previous = await client.query(
      `SELECT attendance_status AS status FROM quiks_attendance_records
       WHERE school_id = $1 AND attendance_session_id = $2 AND person_id = $3`,
      [schoolId, sessionId, personId]
    );
    if (!previous.rowCount) throw Object.assign(new Error("Attendance record not found."), { statusCode: 404 });
    await client.query(
      `UPDATE quiks_attendance_records SET attendance_status = $4, note = $5, recorded_at = now()
       WHERE school_id = $1 AND attendance_session_id = $2 AND person_id = $3`,
      [schoolId, sessionId, personId, status, reason]
    );
    await audit(client, context, "attendance.amended", "attendance_record", `${sessionId}:${personId}`, { previousStatus: previous.rows[0].status, status, reason });
    return { sessionId, personId, status };
  });
}

async function getAttendanceDetails(principal, payload) {
  const schoolId = String(payload.schoolId || "");
  const sessionId = String(payload.sessionId || "");
  const { context, activeModules } = await contextAndModules(principal, schoolId);
  requireSchoolOperator(context); requireModule(activeModules, "operations.attendance");
  if (!sessionId) badRequest("Choose an attendance session.");
  return withSchoolTransaction(schoolId, async (client) => {
    const session = await client.query(
      `SELECT id, attendance_date AS "attendanceDate", session_label AS "sessionLabel", created_at AS "createdAt"
       FROM quiks_attendance_sessions WHERE school_id = $1 AND id = $2`,
      [schoolId, sessionId]
    );
    if (!session.rowCount) throw Object.assign(new Error("Attendance session not found."), { statusCode: 404 });
    const records = await client.query(
      `SELECT record.person_id AS "personId", record.attendance_status AS status, record.note,
              person.given_name AS "givenName", person.family_name AS "familyName"
       FROM quiks_attendance_records record
       JOIN quiks_school_people person ON person.id = record.person_id AND person.school_id = record.school_id
       WHERE record.school_id = $1 AND record.attendance_session_id = $2
       ORDER BY person.family_name, person.given_name`,
      [schoolId, sessionId]
    );
    return { session: session.rows[0], records: records.rows };
  });
}

async function exportSchoolData(principal, payload) {
  const schoolId = String(payload.schoolId || "");
  const { context, activeModules } = await contextAndModules(principal, schoolId);
  requireSchoolOperator(context); requireModule(activeModules, "operations.foundation");
  if (context.isSchoolOwner) forbidden("Full-school data export is restricted to a School Administrator.");
  const tables = [
    "quiks_school_memberships", "quiks_school_people", "quiks_students", "quiks_staff", "quiks_guardians",
    "quiks_student_guardians", "quiks_school_classes", "quiks_class_enrolments", "quiks_attendance_sessions",
    "quiks_attendance_records", "quiks_lesson_plans", "quiks_timetables", "quiks_timetable_entries",
    "quiks_transport_routes", "quiks_vehicles", "quiks_transport_assignments", "quiks_staff_reports",
  ];
  return withSchoolTransaction(schoolId, async (client) => {
    const exported = {};
    for (const table of tables) {
      const result = await client.query(`SELECT * FROM ${table} WHERE school_id = $1`, [schoolId]);
      exported[table.replace("quiks_", "")] = result.rows;
    }
    await audit(client, context, "school.data.exported", "school", schoolId, { tables: tables.length });
    return { filename: `quiks-school-${schoolId}-export-${new Date().toISOString().slice(0, 10)}.json`, content: JSON.stringify(exported, null, 2) };
  });
}

async function createVehicle(principal, payload) {
  const schoolId = String(payload.schoolId || "");
  const { context, activeModules } = await contextAndModules(principal, schoolId);
  requireSchoolOperator(context); requireModule(activeModules, "operations.transport");
  const registrationNumber = String(payload.registrationNumber || "").trim().toUpperCase();
  const capacity = Number(payload.capacity);
  if (!registrationNumber || !Number.isInteger(capacity) || capacity < 1) badRequest("Vehicle registration and a valid passenger capacity are required.");
  return withSchoolTransaction(schoolId, async (client) => {
    const id = randomUUID();
    await client.query("INSERT INTO quiks_vehicles (id, school_id, registration_number, capacity) VALUES ($1, $2, $3, $4)", [id, schoolId, registrationNumber, capacity]);
    await audit(client, context, "transport.vehicle.created", "vehicle", id, { registrationNumber, capacity });
    return { id };
  });
}

async function createTransportAssignment(principal, payload) {
  const schoolId = String(payload.schoolId || "");
  const { context, activeModules } = await contextAndModules(principal, schoolId);
  requireSchoolOperator(context); requireModule(activeModules, "operations.transport");
  const routeId = String(payload.routeId || "");
  const personId = String(payload.personId || "");
  const startsOn = String(payload.startsOn || "");
  if (!routeId || !personId || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) badRequest("Route, passenger and start date are required.");
  return withSchoolTransaction(schoolId, async (client) => {
    const id = randomUUID();
    await client.query(
      `INSERT INTO quiks_transport_assignments (id, school_id, route_id, vehicle_id, person_id, starts_on)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, schoolId, routeId, String(payload.vehicleId || "") || null, personId, startsOn]
    );
    await audit(client, context, "transport.assignment.created", "transport_assignment", id, { routeId, personId, startsOn });
    return { id };
  });
}

async function createSimpleRecord(principal, payload, config) {
  const schoolId = String(payload.schoolId || "");
  const { context, activeModules } = await contextAndModules(principal, schoolId);
  requireSchoolOperator(context);
  requireModule(activeModules, config.module);
  const id = randomUUID();
  return withSchoolTransaction(schoolId, async (client) => {
    await config.insert(client, { id, schoolId, payload, context });
    await audit(client, context, config.action, config.entityType, id, { title: payload.title || payload.name || payload.reportType });
    return { id };
  });
}

export async function schoolAdministrationRequest(principal, action, payload) {
  const schoolId = String(payload.schoolId || "").trim();
  if (!schoolId) badRequest("A school is required.");
  if (action === "owner-modules-list") {
    requireOwner(principal);
    await getSchoolAdministrationContext(principal, schoolId);
    return { modules: SCHOOL_ADMIN_MODULES, grants: await listAdministrationGrants(schoolId) };
  }
  if (action === "owner-modules-update") {
    requireOwner(principal);
    const context = await getSchoolAdministrationContext(principal, schoolId);
    return {
      modules: SCHOOL_ADMIN_MODULES,
      grants: await replaceAdministrationGrants({ school: context.school, principal, modules: payload.modules, startsAt: payload.startsAt, endsAt: payload.endsAt }),
    };
  }
  if (action === "summary") return getSummary(principal, schoolId);
  if (action === "settings-update") return updateSettings(principal, payload);
  if (action === "person-create") return createPerson(principal, payload);
  if (action === "person-archive") return archivePerson(principal, payload);
  if (action === "route-create") return createRoute(principal, payload);
  if (action === "vehicle-create") return createVehicle(principal, payload);
  if (action === "transport-assignment-create") return createTransportAssignment(principal, payload);
  if (action === "attendance-submit") return submitAttendance(principal, payload);
  if (action === "attendance-details") return getAttendanceDetails(principal, payload);
  if (action === "attendance-amend") return amendAttendance(principal, payload);
  if (action === "export") return exportSchoolData(principal, payload);
  if (action === "lesson-plan-create") return createSimpleRecord(principal, payload, {
    module: "operations.planning", action: "lesson_plan.created", entityType: "lesson_plan",
    insert: (client, { id, schoolId, payload }) => client.query(
      `INSERT INTO quiks_lesson_plans (id, school_id, teacher_membership_id, subject, title, content)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [id, schoolId, payload.teacherMembershipId, String(payload.subject || "").trim(), String(payload.title || "").trim(), JSON.stringify({ notes: String(payload.notes || "") })]
    ),
  });
  if (action === "staff-report-create") return createSimpleRecord(principal, payload, {
    module: "operations.staff", action: "staff_report.created", entityType: "staff_report",
    insert: (client, { id, schoolId, payload }) => client.query(
      `INSERT INTO quiks_staff_reports (id, school_id, staff_person_id, author_membership_id, report_type, content)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [id, schoolId, payload.staffPersonId, payload.authorMembershipId, String(payload.reportType || "General").trim(), JSON.stringify({ notes: String(payload.notes || "") })]
    ),
  });
  if (action === "timetable-create") return createSimpleRecord(principal, payload, {
    module: "operations.planning", action: "timetable.created", entityType: "timetable",
    insert: (client, { id, schoolId, payload }) => {
      const type = payload.timetableType === "exam" ? "exam" : "lesson";
      const name = String(payload.name || "").trim();
      if (!name) badRequest("Enter the timetable name.");
      return client.query("INSERT INTO quiks_timetables (id, school_id, timetable_type, name) VALUES ($1, $2, $3, $4)", [id, schoolId, type, name]);
    },
  });
  if (action === "timetable-entry-create") return createSimpleRecord(principal, payload, {
    module: "operations.planning", action: "timetable.entry.created", entityType: "timetable_entry",
    insert: (client, { id, schoolId, payload }) => {
      const startsAt = new Date(payload.startsAt);
      const endsAt = new Date(payload.endsAt);
      const title = String(payload.title || "").trim();
      if (!payload.timetableId || !title || !Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) badRequest("Timetable, title and valid start/end times are required.");
      return client.query(
        `INSERT INTO quiks_timetable_entries
           (id, school_id, timetable_id, subject, title, starts_at, ends_at, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, schoolId, payload.timetableId, String(payload.subject || "").trim() || null, title, startsAt.toISOString(), endsAt.toISOString(), String(payload.location || "").trim() || null]
      );
    },
  });
  throw Object.assign(new Error("School administration action not found."), { statusCode: 404 });
}

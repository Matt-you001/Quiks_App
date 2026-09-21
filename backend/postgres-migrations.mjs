export const POSTGRES_MIGRATIONS = [
  {
    version: 1,
    name: "school_administration_foundation",
    sql: String.raw`
      CREATE TABLE IF NOT EXISTS quiks_schools (
        id text PRIMARY KEY,
        name text NOT NULL,
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        archived_at timestamptz
      );

      CREATE TABLE IF NOT EXISTS quiks_school_feature_grants (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        feature_code text NOT NULL,
        source text NOT NULL DEFAULT 'owner',
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'expired', 'revoked')),
        starts_at timestamptz NOT NULL,
        ends_at timestamptz,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (school_id, feature_code, starts_at)
      );
      CREATE INDEX IF NOT EXISTS quiks_feature_grants_school_status_idx
        ON quiks_school_feature_grants (school_id, status, ends_at);

      CREATE TABLE IF NOT EXISTS quiks_school_memberships (
        id text PRIMARY KEY,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        principal_id text,
        email text NOT NULL,
        display_name text,
        membership_status text NOT NULL DEFAULT 'pending'
          CHECK (membership_status IN ('pending', 'active', 'rejected', 'suspended', 'archived')),
        joined_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (school_id, email)
      );
      CREATE INDEX IF NOT EXISTS quiks_memberships_principal_idx
        ON quiks_school_memberships (principal_id, membership_status);

      CREATE TABLE IF NOT EXISTS quiks_permissions (
        code text PRIMARY KEY,
        description text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS quiks_school_roles (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        school_id text REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        code text NOT NULL,
        name text NOT NULL,
        is_system boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE NULLS NOT DISTINCT (school_id, code)
      );

      CREATE TABLE IF NOT EXISTS quiks_role_permissions (
        role_id bigint NOT NULL REFERENCES quiks_school_roles(id) ON DELETE CASCADE,
        permission_code text NOT NULL REFERENCES quiks_permissions(code) ON DELETE RESTRICT,
        PRIMARY KEY (role_id, permission_code)
      );

      CREATE TABLE IF NOT EXISTS quiks_membership_roles (
        membership_id text NOT NULL REFERENCES quiks_school_memberships(id) ON DELETE CASCADE,
        role_id bigint NOT NULL REFERENCES quiks_school_roles(id) ON DELETE RESTRICT,
        assigned_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (membership_id, role_id)
      );

      CREATE TABLE IF NOT EXISTS quiks_academic_sessions (
        id text PRIMARY KEY,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        name text NOT NULL,
        starts_on date NOT NULL,
        ends_on date NOT NULL,
        status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'closed', 'archived')),
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (ends_on >= starts_on),
        UNIQUE (school_id, name)
      );

      CREATE TABLE IF NOT EXISTS quiks_academic_terms (
        id text PRIMARY KEY,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        session_id text NOT NULL REFERENCES quiks_academic_sessions(id) ON DELETE RESTRICT,
        name text NOT NULL,
        starts_on date NOT NULL,
        ends_on date NOT NULL,
        status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'closed', 'archived')),
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (ends_on >= starts_on),
        UNIQUE (school_id, session_id, name)
      );

      CREATE TABLE IF NOT EXISTS quiks_school_people (
        id text PRIMARY KEY,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        membership_id text REFERENCES quiks_school_memberships(id) ON DELETE SET NULL,
        person_type text NOT NULL CHECK (person_type IN ('student', 'staff', 'guardian')),
        given_name text NOT NULL,
        family_name text NOT NULL,
        email text,
        phone text,
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'inactive', 'archived')),
        custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        archived_at timestamptz,
        UNIQUE (school_id, id)
      );
      CREATE INDEX IF NOT EXISTS quiks_people_school_type_idx
        ON quiks_school_people (school_id, person_type, status);

      CREATE TABLE IF NOT EXISTS quiks_students (
        person_id text PRIMARY KEY REFERENCES quiks_school_people(id) ON DELETE RESTRICT,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        admission_number text,
        admission_date date,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        UNIQUE (school_id, admission_number)
      );

      CREATE TABLE IF NOT EXISTS quiks_staff (
        person_id text PRIMARY KEY REFERENCES quiks_school_people(id) ON DELETE RESTRICT,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        employee_number text,
        employment_title text,
        employment_date date,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        UNIQUE (school_id, employee_number)
      );

      CREATE TABLE IF NOT EXISTS quiks_guardians (
        person_id text PRIMARY KEY REFERENCES quiks_school_people(id) ON DELETE RESTRICT,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb
      );

      CREATE TABLE IF NOT EXISTS quiks_student_guardians (
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        student_id text NOT NULL REFERENCES quiks_students(person_id) ON DELETE RESTRICT,
        guardian_id text NOT NULL REFERENCES quiks_guardians(person_id) ON DELETE RESTRICT,
        relationship text NOT NULL,
        is_primary boolean NOT NULL DEFAULT false,
        PRIMARY KEY (student_id, guardian_id)
      );

      CREATE TABLE IF NOT EXISTS quiks_school_classes (
        id text PRIMARY KEY,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        academic_session_id text REFERENCES quiks_academic_sessions(id) ON DELETE RESTRICT,
        name text NOT NULL,
        grade_key text,
        classroom_record_id text,
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (school_id, id)
      );

      CREATE TABLE IF NOT EXISTS quiks_class_enrolments (
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        class_id text NOT NULL REFERENCES quiks_school_classes(id) ON DELETE RESTRICT,
        student_id text NOT NULL REFERENCES quiks_students(person_id) ON DELETE RESTRICT,
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'withdrawn', 'archived')),
        enrolled_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (class_id, student_id)
      );

      CREATE TABLE IF NOT EXISTS quiks_attendance_sessions (
        id text PRIMARY KEY,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        class_id text REFERENCES quiks_school_classes(id) ON DELETE RESTRICT,
        attendance_date date NOT NULL,
        session_label text NOT NULL DEFAULT 'day',
        taken_by_membership_id text REFERENCES quiks_school_memberships(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (school_id, class_id, attendance_date, session_label)
      );

      CREATE TABLE IF NOT EXISTS quiks_attendance_records (
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        attendance_session_id text NOT NULL REFERENCES quiks_attendance_sessions(id) ON DELETE RESTRICT,
        person_id text NOT NULL REFERENCES quiks_school_people(id) ON DELETE RESTRICT,
        attendance_status text NOT NULL CHECK (attendance_status IN ('present', 'absent', 'late', 'excused')),
        note text,
        recorded_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (attendance_session_id, person_id)
      );

      CREATE TABLE IF NOT EXISTS quiks_lesson_plans (
        id text PRIMARY KEY,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        teacher_membership_id text NOT NULL REFERENCES quiks_school_memberships(id) ON DELETE RESTRICT,
        class_id text REFERENCES quiks_school_classes(id) ON DELETE RESTRICT,
        term_id text REFERENCES quiks_academic_terms(id) ON DELETE RESTRICT,
        subject text NOT NULL,
        title text NOT NULL,
        content jsonb NOT NULL DEFAULT '{}'::jsonb,
        status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'returned', 'archived')),
        reviewed_by_membership_id text REFERENCES quiks_school_memberships(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS quiks_timetables (
        id text PRIMARY KEY,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        term_id text REFERENCES quiks_academic_terms(id) ON DELETE RESTRICT,
        timetable_type text NOT NULL CHECK (timetable_type IN ('lesson', 'exam')),
        name text NOT NULL,
        status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS quiks_timetable_entries (
        id text PRIMARY KEY,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        timetable_id text NOT NULL REFERENCES quiks_timetables(id) ON DELETE RESTRICT,
        class_id text REFERENCES quiks_school_classes(id) ON DELETE RESTRICT,
        subject text,
        title text NOT NULL,
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL,
        location text,
        teacher_membership_id text REFERENCES quiks_school_memberships(id) ON DELETE RESTRICT,
        CHECK (ends_at > starts_at)
      );

      CREATE TABLE IF NOT EXISTS quiks_transport_routes (
        id text PRIMARY KEY,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        name text NOT NULL,
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (school_id, name)
      );

      CREATE TABLE IF NOT EXISTS quiks_vehicles (
        id text PRIMARY KEY,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        registration_number text NOT NULL,
        capacity integer CHECK (capacity IS NULL OR capacity > 0),
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive', 'archived')),
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        UNIQUE (school_id, registration_number)
      );

      CREATE TABLE IF NOT EXISTS quiks_transport_assignments (
        id text PRIMARY KEY,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        route_id text NOT NULL REFERENCES quiks_transport_routes(id) ON DELETE RESTRICT,
        vehicle_id text REFERENCES quiks_vehicles(id) ON DELETE RESTRICT,
        person_id text NOT NULL REFERENCES quiks_school_people(id) ON DELETE RESTRICT,
        starts_on date NOT NULL,
        ends_on date,
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
        CHECK (ends_on IS NULL OR ends_on >= starts_on)
      );

      CREATE TABLE IF NOT EXISTS quiks_staff_reports (
        id text PRIMARY KEY,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        staff_person_id text NOT NULL REFERENCES quiks_staff(person_id) ON DELETE RESTRICT,
        author_membership_id text NOT NULL REFERENCES quiks_school_memberships(id) ON DELETE RESTRICT,
        report_type text NOT NULL,
        reporting_period_start date,
        reporting_period_end date,
        content jsonb NOT NULL DEFAULT '{}'::jsonb,
        status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'acknowledged', 'archived')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS quiks_school_documents (
        id text PRIMARY KEY,
        school_id text NOT NULL REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        owner_person_id text REFERENCES quiks_school_people(id) ON DELETE RESTRICT,
        storage_key text NOT NULL,
        original_name text NOT NULL,
        content_type text NOT NULL,
        byte_size bigint NOT NULL CHECK (byte_size >= 0),
        sha256 text,
        retention_until date,
        created_at timestamptz NOT NULL DEFAULT now(),
        archived_at timestamptz,
        UNIQUE (school_id, storage_key)
      );

      CREATE TABLE IF NOT EXISTS quiks_audit_events (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        school_id text REFERENCES quiks_schools(id) ON DELETE RESTRICT,
        actor_principal_id text,
        actor_membership_id text REFERENCES quiks_school_memberships(id) ON DELETE SET NULL,
        action text NOT NULL,
        entity_type text NOT NULL,
        entity_id text,
        occurred_at timestamptz NOT NULL DEFAULT now(),
        request_id text,
        ip_hash text,
        details jsonb NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE INDEX IF NOT EXISTS quiks_audit_school_time_idx
        ON quiks_audit_events (school_id, occurred_at DESC);

      CREATE OR REPLACE FUNCTION quiks_prevent_audit_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Quiks audit records are append-only';
      END;
      $$;
      DROP TRIGGER IF EXISTS quiks_audit_events_immutable ON quiks_audit_events;
      CREATE TRIGGER quiks_audit_events_immutable
        BEFORE UPDATE OR DELETE ON quiks_audit_events
        FOR EACH ROW EXECUTE FUNCTION quiks_prevent_audit_mutation();

      CREATE TABLE IF NOT EXISTS quiks_legacy_imports (
        import_key text PRIMARY KEY,
        source_path text,
        source_sha256 text NOT NULL,
        imported_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
        imported_at timestamptz NOT NULL DEFAULT now()
      );

      INSERT INTO quiks_permissions (code, description) VALUES
        ('school.manage', 'Manage school configuration and licences'),
        ('people.manage', 'Register and maintain student, staff and guardian records'),
        ('attendance.manage', 'Create and edit attendance records'),
        ('planning.manage', 'Manage lesson plans and timetables'),
        ('staff_reports.manage', 'Create and review staff reports'),
        ('transport.manage', 'Manage vehicles, routes and transport assignments'),
        ('audit.view', 'View school audit history')
      ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

      INSERT INTO quiks_school_roles (school_id, code, name, is_system) VALUES
        (NULL, 'school_admin', 'School administrator', true),
        (NULL, 'teacher', 'Teacher', true),
        (NULL, 'student', 'Student', true),
        (NULL, 'staff', 'Staff', true),
        (NULL, 'transport_manager', 'Transport manager', true)
      ON CONFLICT (school_id, code) DO UPDATE SET name = EXCLUDED.name;

      DO $$
      DECLARE table_name text;
      BEGIN
        FOREACH table_name IN ARRAY ARRAY[
          'quiks_school_feature_grants', 'quiks_school_memberships', 'quiks_academic_sessions',
          'quiks_academic_terms', 'quiks_school_people', 'quiks_students', 'quiks_staff',
          'quiks_guardians', 'quiks_student_guardians', 'quiks_school_classes',
          'quiks_class_enrolments', 'quiks_attendance_sessions', 'quiks_attendance_records',
          'quiks_lesson_plans', 'quiks_timetables', 'quiks_timetable_entries',
          'quiks_transport_routes', 'quiks_vehicles', 'quiks_transport_assignments',
          'quiks_staff_reports', 'quiks_school_documents', 'quiks_audit_events'
        ]
        LOOP
          EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
          EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
          EXECUTE format(
            'DROP POLICY IF EXISTS quiks_school_scope ON %I', table_name
          );
          EXECUTE format(
            'CREATE POLICY quiks_school_scope ON %I USING (current_setting(''quiks.owner_context'', true) = ''true'' OR school_id = nullif(current_setting(''quiks.school_id'', true), '''')) WITH CHECK (current_setting(''quiks.owner_context'', true) = ''true'' OR school_id = nullif(current_setting(''quiks.school_id'', true), ''''))',
            table_name
          );
        END LOOP;
      END;
      $$;
    `,
  },
];

# Quiks School Administration rollout

## Product boundaries

School Administration is licensed separately from the existing academic package. `Operations Foundation` provides the registry, collection settings, audit history and base administration controls. Attendance, Planning & Scheduling, Staff Management and Transport Management can then be enabled independently.

The Quiks App Owner issues dated module grants from **School Control → Schools and enrolment records → Administration modules**. Enabling an add-on automatically requires Operations Foundation.

## Permissions

- School Owner: create other administrators; assign or remove roles; edit submitted attendance; view staff reports; archive student or staff records.
- School Administrator: assign or remove roles; edit submitted attendance; view staff reports; export all school data.
- Quiks App Owner: issue module licences and inspect operational status, but cannot mutate a school's internal operational records or read restricted staff reports.

For existing schools, the School Owner is the original school-administrator email recorded when the school licence was created.

## Database deployment

The administration schema is PostgreSQL migration version 2. Deploy the backend first and confirm `/health` reports:

```json
{"postgres":{"connected":true,"schemaVersion":2,"targetSchemaVersion":2}}
```

Keep `QUIKS_POSTGRES_MODE=shadow` during testing. Administration modules use PostgreSQL directly; the older academic school records remain on the existing store until the separate primary-mode migration is approved.

## Operational alerts

Set this on the Render `quiks-app` service:

```text
QUIKS_OPERATIONS_ALERT_EMAIL=support@quiks.site
```

`support@quiks.site` is also the backend default because it is a public operational mailbox, not a secret. The environment variable is optional unless the recipient needs to be changed.

With the existing Resend variables configured, `/health.schoolEmail.operationalAlertsConfigured` should be `true`. The backend sends a best-effort alert when PostgreSQL is unavailable during startup or when the local school-store recovery copy cannot be written.

Also configure Render service, deploy and managed-database notifications to send to `support@quiks.site`. Application email cannot report a complete service outage or a managed PostgreSQL backup failure when the application itself is offline.

## Sensitive files

The school can enable or disable collection categories for student photographs, staff photographs, birth certificates, identity documents and medical documents. These switches only establish the school's collection policy. Actual uploads must remain disabled until private object storage, short-lived signed access, malware scanning, retention rules and audited deletion are configured. Do not store these files in PostgreSQL or on the Render application disk.

## Backup limits

The existing `.backup` file is a local recovery copy on the same Render disk; it is not an off-site backup. PostgreSQL recovery should use Render's database backups/PITR when available, plus a separately controlled encrypted export to off-site object storage. Test restoration before commercial onboarding.

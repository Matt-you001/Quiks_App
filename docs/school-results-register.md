# School results register and reports

## Current scope

The school administration page now has a collapsible menu: Overview, Members & invitations, Enrolment form, and Results & reports. The same screen is used on web and mobile, with a stacked menu on smaller screens.

This change has not been deployed remotely. Fresh Children, Teens and Uni web-hosting exports were generated on 2 September 2026, including the classroom/portal integration. See `hosting-test-guide.md` for testing instructions; the updated backend must also be deployed.

## Data flow and storage

- A successful classroom test/assignment submission made with an approved school-linked profile is copied into a school-scoped result register **within the same file transaction** as the classroom submission. Tests marked CBT follow the same path. Class teachers retain their existing activity result view.
- The register lives in `schoolResults` in the existing persistent `CLASSROOM_STORE_PATH` database file, alongside `schoolReports`. This is a central server-side JSON store, not a newly provisioned managed SQL database. It inherits the existing single-server/persistent-disk capacity and backup limitations.
- Each result is keyed by submission ID and includes school, school membership, class, subject, activity, variant, attempt, time and original mark. Existing linked submissions can be backfilled when the register is opened, provided their classroom/activity/profile records still exist.
- A student's personal-profile practice sessions or non-school classroom activity are not silently included. Select the school's labelled profile and use a school-linked class.
- Deleting an activity or class does not erase its captured school-result snapshots or saved reports. School record retention/deletion must be handled explicitly; deleting the source activity is not a data-erasure mechanism.
- Draft/approved reports contain frozen result snapshots, comments, optional reasoned adjustments, revision numbers, action history and email state. Adjustments change the report only, not the original classroom mark. Concurrent stale edits are rejected.

## Administrator workflow

1. Open School Control, manage the school, then select Results & reports.
2. Filter by student, class, subject, test/assignment, variant and optional dates. Choose latest attempts or every attempt. Apply filters to refresh. The register shows 50 result rows per page.
3. Choose a student and apply the filters, enter a report title (for example First Term 2026), and create a draft. Each report uses the latest submitted attempt for each included activity within those filters, regardless of the register's all-attempts view.
4. Review every included mark. Add comments and, where needed, a corrected percentage with a mandatory reason. Save changes. The average is an explicitly labelled **unweighted mean**, not a configured continuous-assessment/examination weighting, class ranking or official term grade. Reports are limited to 250 activities; narrow the date/class range when necessary.
5. Confirm review and approve. Editing an approved but unsent report returns it to draft. Sent/in-flight/uncertain-delivery reports are locked; corrections require a new report.
6. Export CSV for further school processing, or select Send report by email and confirm the displayed recipient. The recipient comes from that student's school enrolment, never an arbitrary address in a request. Current implementation sends one student's report to their enrolled email; guardian distribution, bulk dispatch and configurable term weighting are not implemented.

## Permissions and email

Every results endpoint verifies Firebase identity and school-administration access (including explicitly configured Quiks owners under the existing school-management policy). Teachers and students cannot use admin results endpoints. Class teachers still use Classroom. The school licence must be active with Reports enabled.

Email uses the existing backend `RESEND_API_KEY` and `QUIKS_SCHOOL_EMAIL_FROM`; no additional secret is embedded in the client. The sender domain must be configured in Resend. Review is followed by a separate recipient-confirmation step; exports do not send email.

The backend persists a send intent and idempotency key before calling the provider. Concurrent duplicate requests are rejected. A successful provider response means **accepted for sending**, not confirmed inbox delivery. A timeout/uncertain response or interrupted send stays locked: check the Resend dashboard and the report's ID/audit trail before deciding on any resend. No automated retry is performed for an uncertain outcome. Explicit provider failures or missing configuration leave the approved report available for retry after correction.

Reference: [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email).

## Deployment and limits

- Deploy the matching backend and frontend changes together when the remaining upgrade is ready. New register fields initialise automatically; **do not reset the classroom database to install this feature**. The previously authorised one-time test-data reset is a separate operation and would clear register data too if run for the first time.
- Keep `CLASSROOM_STORE_PATH` on the configured Render persistent disk. There is no off-site backup added by this feature. Include results and reports in the planned off-site backup and restore-drill work.
- Scores are still supplied by the classroom client. Basic mark/count/time validation is included, but server-side scoring, protected answer delivery and examination-session integrity remain outstanding before high-stakes CBT use. The UI warns administrators to review marks.
- Tests use synthetic local data and a mocked email provider. No real report email has been sent; live Firebase/Render/Resend integration and device/browser visual testing remain deployment checks.

## Verification

```text
node --test backend/classroom-auth.test.mjs backend/classroom-migration.test.mjs backend/school-results.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

Before release, test creation/submission with a school teacher and student, open the school register as its administrator, edit/approve/export a draft, and send only to a controlled test account. Repeat after refreshing/restarting. Check rejection as a student, teacher, suspended administrator and administrator of another school. Confirm the new menu fits both a narrow phone and desktop viewport.

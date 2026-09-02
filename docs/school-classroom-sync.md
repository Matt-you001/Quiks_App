# School classroom and portal integration

## Administrator creates the class

1. Enrol the teacher in the school and approve their membership.
2. Open **School Administration → Classes & records**.
3. Enter a class name, choose the licensed Quiks variant, select the assigned teacher, and choose the code policy.
4. Create the class. Its records window shows the teacher code; copy it and share it with that teacher.
5. The teacher signs in to that variant using their school-linked teacher profile, opens **Classroom**, and enters the code under **Open school class**.
6. With the shared policy, the student code is the same code. With the separate policy, the teacher selects the class and presses **Generate student join code**. The generated code also appears in the school portal.

Knowing the code never grants teaching rights: only the selected active school teacher can open the class. Students cannot join before the teacher opens it. The separate teacher code is not accepted as a student join code. Generating a student code is idempotent; retries return the same code rather than invalidate invitations already shared. New codes use cryptographic randomness; existing codes remain valid.

## Teacher creates the class

The teacher creates it normally while using their **school-linked profile**. The classroom already carries the verified school identity, so it appears automatically in the school's class list. The teacher may share its student/class code with the administrator, who enters it under **Register a teacher-created class**. Registration is idempotent and also backfills eligible pre-existing submissions into the central results register.

Personal-profile classes and classes belonging to another school cannot be transferred merely by entering their code. That would expose records without verified school/account mappings. This upgrade does not migrate such classes. Use the school-linked profile for new school classes.

## Shared records

Classroom and the portal use the same class ID and persistent classroom store, not copied client-side data. The administrator's record viewer groups members and admission status, Tests/Assignments and questions, lesson-note content and illustration data, class messages, and submissions. The **Results & reports** section handles school-wide collation, reviewed corrections and report sending.

Use **Refresh classes** (close the record viewer first), reopen a class, or return to the section to fetch current data. This is request-based synchronization, not a live websocket feed. Original attachment bytes remain in the store but are not sent through the portal's records-list response. Teachers retain their existing classroom editing/admission controls. Deleted source activities/classes follow the existing deletion behaviour; captured school results/reports remain available in the central register.

## Deployment and verification

Fresh Children, Teens and Uni web-hosting files were generated on 2 September 2026. Nothing has been deployed remotely. Deploy the backend to **quiks-app.onrender.com** and release updated clients/web exports together. See `hosting-test-guide.md` for local preview and upload instructions. No new environment variable, school re-enrolment, or destructive data reset is required. Keep the existing persistent `CLASSROOM_STORE_PATH` and `SCHOOL_STORE_PATH` settings. Do not rerun a test-data reset to install this feature.

Automated tests cover all three variants, teacher-bound shared codes, separate student codes, duplicate claims, student admission, shared records and automatic results, cross-school/role rejection, invalid configuration, licence expiry, disabled Classroom, idempotent registration and persisted reload. HTTP tests verify that the new endpoints reject anonymous requests. Device/browser interaction and production Firebase accounts still require staging verification.

High-stakes CBT server-side scoring/answer protection and independent off-site backups remain separate work. Existing marks are client-reported and should be reviewed before official use.

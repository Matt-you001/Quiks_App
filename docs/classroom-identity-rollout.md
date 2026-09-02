# Classroom and school identity: staging and rollout

Local changes only; no Render deployment, remote-data edits, off-site backup setup or hosting exports have been performed. The owner has confirmed that existing classroom records are disposable testing data and authorised a clean reset. Use the one-time reset below instead of attempting to guess legacy account mappings.

## What changed

Every `/classroom/*` endpoint verifies the same Firebase token used by Quiks School before resolving the acting profile. This includes lessons, downloads, chat, question generation and activity/CBT participation. The common client already sends this token on web and mobile.

Approved school members receive a stable per-variant profile (`school-<variant>-<membershipId>`). Names and roles come from the server's school membership, not user-editable profile fields. School membership, variant licensing and enabled features are checked again per request. The class must belong to the same school, and class-teacher/student membership checks still apply. App-owner access to school management does not automatically confer access to students' classroom work.

Non-school profiles must be present in the signed-in account's Firestore document. A persistent server-side ownership registry prevents another account from claiming the same classroom profile ID. Project ID is included in that account identity. Firebase REST reads use the user's ID token and existing Firestore security rules, not an administrator credential.

Local school profiles and administrative profiles are refreshed at the existing login/cold-start identity-sync points. Enrolment selects the new school profile when membership is active. Select the school's profile before using Classroom; personal profiles remain separate and are not erased.

## Authorised test-data migration: complete these steps on Render

The reset removes **only the classroom store's** profile directory/identity bindings, classes, classroom memberships, tests, assignments, lesson notes, chats and submissions. It preserves a byte-for-byte backup on the same disk before replacing that store. Schools, licences, school memberships/invitations, Firebase accounts, saved personal profiles and consumer learning/subscription data are not reset. Personal profiles may consequently still show historical local learning summaries, even though old classroom activities no longer exist.

1. Stop testing while deploying. Commit and push the current source changes (including the new `backend/classroom-auth.mjs` and `backend/classroom-migration.mjs`, the backend/store changes, and the identity/client updates) to the repository/branch used by **quiks-app**. Do not upload the internal school document pack or test database files as application assets. No Git commit/push has been performed for you.
2. In **quiks-app** on Render, confirm these existing variables point to different files on the persistent disk:

   ```text
   CLASSROOM_STORE_PATH=/var/data/classroom-store.json
   SCHOOL_STORE_PATH=/var/data/school-store.json
   ```

   Add this **temporary, explicitly destructive migration opt-in**:

   ```text
   QUIKS_CLASSROOM_MIGRATION=reset-test-data-v1
   ```

   Remove `QUIKS_CLASSROOM_IDENTITY_MAP_PATH` if you previously added it for legacy mapping; it is unnecessary after this clean reset. Keep all other backend keys and configuration unchanged. Never enable the reset flag on a different environment containing records you intend to retain.
3. Save and deploy the updated backend. Before listening for requests, startup makes a private sibling backup named `classroom-store.json.before-identity-reset-<timestamp>-<random-id>.backup`, installs a fresh classroom store, and writes a completion marker inside it. If there was no classroom file, startup creates a fresh marked store without a backup. It does not touch `school-store.json`.
4. Check the deployment log for `Classroom identity migration: completed`. Open [the intended backend health endpoint](https://quiks-app.onrender.com/health) and check:

   ```json
   "classroomStore": {
     "configured": true,
     "persistentPathExpected": true,
     "persistentMountDetected": true,
     "identityResetCompleted": true
   }
   ```

   These fields are a subsection of the larger response. If migration fails, the backend refuses to start instead of silently continuing with insecure or partially migrated data. Keep the error log and contact support; do not delete database files or migration locks blindly.
5. Remove `QUIKS_CLASSROOM_MIGRATION` and redeploy. The completion marker remains in the store. Even if you forget this removal, the same migration version returns `already_completed` on later starts and preserves newly created records. Confirm the health flag remains true after another restart. Do not remove the marker or reuse this reset process later as a routine restart action.
6. Build and upload updated web clients for **Children, Teens and Uni**, and install updated mobile preview builds before testing. A backend deployment alone does not update installed mobile apps or hosted JavaScript. Do not upload the existing old web-hosting files and assume they contain these changes.
7. Sign out and back in on each device. Approved school users receive a stable school-linked profile; choose the one labelled with the **school name and role**, not an old personal/administrative test profile. Existing school invitations/enrolment approvals remain valid. Recreate the test classrooms, join students, and create fresh lessons/activities. No old classroom invitation code or activity link should be reused.

The backup is local to the Render disk, not an independent off-site backup. Restoring it would also restore legacy unbound identities, so recovery requires planned migration—not copying it over the live file while the service is running.

### Web build commands (PowerShell, repository root)

These regenerate each existing `web-builds` variant and then replace the generated variant directories in `web-hosting`. Back up any hand-edited files in those three generated directories first. The backend migration flag belongs only on Render; do not add it to frontend `.env` files.

```powershell
$env:EXPO_PUBLIC_AI_API_URL = "https://quiks-app.onrender.com"
foreach ($quiksVariant in @("children", "teens", "uni")) {
    $env:APP_VARIANT = $quiksVariant
    node node_modules/expo/bin/cli export --platform web --output-dir "web-builds/$quiksVariant"
    if ($LASTEXITCODE -ne 0) { throw "Export failed for $quiksVariant" }
}
node scripts/prepare-hostable-web-builds.mjs
if ($LASTEXITCODE -ne 0) { throw "Hosting preparation failed" }
Remove-Item Env:APP_VARIANT
Remove-Item Env:EXPO_PUBLIC_AI_API_URL
```

Upload the corresponding new variant folder to each variant's existing hosting location. The neutral enrolment portal does not need to be deleted or reset. Use the project's existing mobile preview-build procedure; do not put backend secrets into a mobile build.

## Alternative only: future migrations where records must be retained

Old classroom records were stored without an account-owner identity. It is unsafe to assign ownership merely because a client supplies the same profile ID. Unbound records are therefore preserved but return a clear migration-required error (409).

1. Take a recoverable copy of the production classroom and school stores, and test on an isolated copy. Do not reset either store or overwrite it with local test data.
2. Establish each legacy profile's owner from trusted account records, school-admin confirmation and existing class records. Resolve conflicting claims manually. An editable profile in a single user's document is not sufficient proof on its own.
3. For **personal, non-school** legacy profiles, create a private operator-reviewed JSON file mapping each profile ID to `{ "owner": "<firebaseProjectId>:<uid>", "appVariant": "children|teens|uni" }`. Supply its absolute path through `QUIKS_CLASSROOM_IDENTITY_MAP_PATH`. This is a server-local configuration file, never a public upload or an app request. On successful verification the binding is saved to the classroom store. Remove the temporary mapping after verified migration. Never guess these values.
4. For **existing school classes that must be retained**, prepare an explicit reviewed mapping of old profile IDs to school membership IDs and class IDs to school IDs. Reassignment must consistently preserve teacher IDs, class memberships, lesson authors, chat authors, activities and submissions. This preservation route is not needed for the currently authorised disposable test-data reset. New school classes are linked automatically.
5. Email-based app-owner configuration now requires a verified email. Verify the owner's Firebase email or use a correctly configured project-qualified owner principal ID; do not bypass verification.

## Staging checks

Run `node --test backend/classroom-auth.test.mjs backend/classroom-migration.test.mjs`, and `node node_modules/typescript/bin/tsc --noEmit` from the repository root. Tests use temporary stores, injected principals for authorization tests, and a local HTTP server for anonymous-route checks; they do not verify live Firebase/Render configuration. Migration tests cover backup fidelity, preservation of school data, repeat-startup safety, path collisions, corrupt data, locking and completion-marker persistence.

Before production, test each variant with actual staging Firebase accounts: teacher enrolment, student approval, profile selection, create/join class, lesson publish/read/download permissions, group chat, generate/review/submit an assignment and CBT, refresh, logout/login and mobile/web switching. Then suspend the school member, expire the licence, remove CBT access, try another school and try another account's profile ID. Access must be rejected. Back up the reviewed source stores before deployment; never weaken authentication to keep an obsolete client working.

Build and upload matched web/mobile clients after the data migration is ready. Keep the backend target `https://quiks-app.onrender.com`. No changes target the old proxy service.

## Remaining production gates

- Independent off-site backups and a measured restore drill are still required; the existing same-disk backup is not independent disaster recovery.
- This change secures identity and scope; it is not a complete high-stakes CBT integrity audit. Current assessment code still sends answer material to clients and accepts client-reported scores. Server-side question delivery, scoring, attempt/session timing and audit controls need separate implementation before high-stakes examinations.
- No live security audit, capacity test, uptime evidence or unconditional NDPA compliance certification is implied.
- Classroom-store initialization now fails on unreadable/corrupt data instead of replacing it with an empty store. It initializes a new file only when genuinely absent. Mutations and identity bindings are serialized and committed only after persistence succeeds.

Provider reference: [Firestore REST authentication](https://firebase.google.com/docs/firestore/use-rest-api).

# Deploying the OpenAI Proxy to Render

This project includes a Render Blueprint in [render.yaml](/C:/Users/USER/Desktop/Quiks/render.yaml) for deploying the backend proxy as a public web service.

## What gets deployed

The service runs [backend/openai-proxy.mjs](/C:/Users/USER/Desktop/Quiks/backend/openai-proxy.mjs), which exposes:

- `GET /health`
- `POST /questions`
- `POST /feedback`
- `POST /coach-plan`

The mobile app calls this backend through `EXPO_PUBLIC_AI_API_URL`.

## Before you deploy

Make sure your OpenAI key is valid and active. For safety, if you pasted a key into local logs during testing, rotate it before production use.

## Deploy on Render

1. Push this repo to GitHub, GitLab, or Bitbucket.
2. In Render, choose `New` -> `Blueprint`.
3. Connect the repository.
4. Render will detect [render.yaml](/C:/Users/USER/Desktop/Quiks/render.yaml).
5. When prompted for environment variables, set:

```text
OPENAI_API_KEY=your_real_openai_key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_VERIFIER_MODEL=gpt-5.6-terra
OPENAI_VERIFIER_REASONING_EFFORT=medium
QUESTION_CANDIDATE_MULTIPLIER=1.5
MAX_QUESTION_CANDIDATES=20
CLASSROOM_STORE_PATH=/var/data/classroom-store.json
SCHOOL_STORE_PATH=/var/data/school-store.json
PAST_QUESTION_STORE_PATH=/var/data/past-question-store.json
DATABASE_URL=your_Render_internal_database_URL
QUIKS_POSTGRES_MODE=shadow
QUIKS_POSTGRES_REQUIRED=false
QUIKS_POSTGRES_IMPORT_JSON=
```

The verifier is intentionally stronger than the generator. A failed or uncertain verification is rejected and replaced in the app from the reviewed local question library.

## Persistent classroom records

Classrooms, memberships, activities, questions, submissions, and the Past Q&A library must not be stored on Render's default filesystem because it is erased during restarts and deployments. The Blueprint attaches a 1 GB persistent disk at `/var/data`; `CLASSROOM_STORE_PATH` and `PAST_QUESTION_STORE_PATH` write those databases onto that disk. When `PAST_QUESTION_STORE_PATH` is omitted, Quiks places the library beside `SCHOOL_STORE_PATH`, but the explicit variable is recommended for operational clarity.

When applying this update to an existing service, review and approve the new disk in the Render Blueprint change. If the service is not managed through the Blueprint, open the service's **Disks** page and add a disk with:

- Name: `quiks-classroom-data`
- Mount path: `/var/data`
- Size: `1 GB`

Then add `CLASSROOM_STORE_PATH=/var/data/classroom-store.json` to the service environment and redeploy. Do not deploy the storage-path variable without attaching the disk, because `/var/data` would remain temporary.

Render already provides `PORT`, and the blueprint pins it to `10000`.

## PostgreSQL rollout

`DATABASE_URL` must be the Render **internal** database URL and the database and `quiks-app` should remain in the same Render region. Do not put the URL in source control or send it in screenshots.

The initial mode is deliberately `shadow`:

- PostgreSQL connects and runs versioned, transactional schema migrations.
- The existing JSON files on `/var/data` remain the live source used by the current application.
- `GET /health` reports `postgres.connected`, `postgres.serverVersion`, and the applied/target schema versions.
- A database connection failure is reported as degraded but does not erase data or prevent the existing JSON-backed features from starting.

After the health endpoint shows `connected: true` and matching schema versions, perform the one-time school-store copy by setting:

```text
QUIKS_POSTGRES_IMPORT_JSON=school-v1
```

Redeploy and check `postgres.legacyImport` in `/health`. It should report `imported` (or `already_imported` on a repeat) with school, membership, person, and feature-grant counts. The import is transactional and content-hashed. It only inserts or updates PostgreSQL records; it never edits or deletes `school-store.json` or its backup.

After recording and comparing the counts, clear `QUIKS_POSTGRES_IMPORT_JSON` and redeploy. Leave `QUIKS_POSTGRES_MODE=shadow` until the application repositories have been changed to use PostgreSQL as their primary store and the full functional test checklist has passed. Do **not** set `primary` merely because the schema and import succeeded.

The administration schema enforces a `school_id` on tenant-owned records and enables PostgreSQL row-level security. Application operations must use the school-scoped transaction helper so the active school context is set for every transaction. Audit rows are append-only.

The Render free PostgreSQL tier is suitable for this test migration, not commercial school data: it expires after the provider's trial period and does not include the production backup and recovery guarantees required for launch. Upgrade before onboarding a live school, then configure encrypted off-site backups and periodically test restoration.

## After deploy

When the service is live, Render will give you a URL such as:

```text
https://quiks-app.onrender.com
```

Open the service health endpoint in a browser:

```text
https://quiks-app.onrender.com/health
```

You should see JSON with `ok: true`.

## Update the mobile app

In your local `.env`, set:

```env
EXPO_PUBLIC_AI_MODE=live
EXPO_PUBLIC_AI_API_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

Then restart Expo:

```powershell
npx expo start -c
```

## Render notes

- Render web services must listen on the service port, which defaults to `10000` unless overridden.
- Environment variables and secrets should be configured in Render, not committed to the repo.

References:

- [Render Web Services](https://render.com/docs/web-services)
- [Render Environment Variables and Secrets](https://render.com/docs/configure-environment-variables)
- [Render Blueprint YAML Reference](https://render.com/docs/blueprint-spec)

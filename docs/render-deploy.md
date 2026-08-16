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
OPENAI_VERIFIER_MODEL=gpt-5.6-terra
OPENAI_VERIFIER_REASONING_EFFORT=medium
QUESTION_CANDIDATE_MULTIPLIER=1.5
MAX_QUESTION_CANDIDATES=20
```

The verifier is intentionally stronger than the generator. A failed or uncertain verification is rejected and replaced in the app from the reviewed local question library.

Render already provides `PORT`, and the blueprint pins it to `10000`.

## After deploy

When the service is live, Render will give you a URL such as:

```text
https://quiks-openai-proxy.onrender.com
```

Open the service health endpoint in a browser:

```text
https://quiks-openai-proxy.onrender.com/health
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

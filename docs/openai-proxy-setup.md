# OpenAI Proxy Setup

This app can generate live questions through a local or deployed backend proxy so your OpenAI API key stays off the mobile device.

## Important

- An OpenAI API key cannot be used with Gemini APIs.
- Gemini and OpenAI are separate providers with separate authentication.
- For production mobile apps, keep the real API key only on the backend.

## Environment

Add these values to your local `.env`:

```env
OPENAI_API_KEY=your_openai_key_here
OPENAI_MODEL=gpt-4.1-mini
OPENAI_VERIFIER_MODEL=gpt-5.6-terra
OPENAI_VERIFIER_REASONING_EFFORT=medium
QUESTION_CANDIDATE_MULTIPLIER=1.5
MAX_QUESTION_CANDIDATES=20
CLASSROOM_STORE_PATH=./data/classroom-store.json
PORT=8787

EXPO_PUBLIC_AI_MODE=live
EXPO_PUBLIC_AI_API_URL=http://YOUR_COMPUTER_LAN_IP:8787
```

Replace `YOUR_COMPUTER_LAN_IP` with the IP address of the machine running the proxy, for example `192.168.1.127`.

The first model generates extra candidates. The verifier independently solves them and only high-confidence, unambiguous questions with an accurate explanation are returned. If verification fails, the app falls back to its reviewed local question bank. Do not expose `OPENAI_API_KEY` in Expo public environment variables.

`CLASSROOM_STORE_PATH` controls the durable classroom database file. The local value above resolves to `backend/data/classroom-store.json`. Classroom files are ignored by Git because they can contain private student and teacher records.

## Run the proxy

```powershell
npm run proxy
```

The proxy exposes:

- `GET /health`
- `POST /questions`
- `POST /feedback`
- `POST /coach-plan`

## Run the app

```powershell
npx expo start -c
```

Make sure your phone and computer are on the same network when using a local proxy.

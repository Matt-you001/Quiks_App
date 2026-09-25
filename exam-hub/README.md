# Quiks Exam Hub

Quiks Exam Hub runs entirely on a school's local network. It does not send candidate responses to Quiks.

## Start on the school computer

Set these environment variables before starting:

- `QUIKS_EXAM_HUB_ADMIN_PIN`: a private PIN of at least 8 characters.
- `QUIKS_EXAM_SIGNING_PUBLIC_KEY`: the same base64 Ed25519 public key compiled into the Quiks Exam Player.
- `QUIKS_EXAM_HUB_DATA_DIR`: optional absolute directory for encrypted response files.
- `QUIKS_EXAM_HUB_PORT`: optional; defaults to `5050`.

Then run from the Quiks project:

```powershell
npm run exam-hub
```

Allow the selected port through the private Windows firewall when prompted. Candidate devices must be on the same trusted school Wi-Fi or wired LAN and open `http://<school-computer-ip>:5050`.

The administrator imports the student `.qexam` file, enters its separate activation code and chooses a candidate join code. Responses are AES-256-GCM encrypted on the school computer. The administrator PIN is required to export the response CSV.

Do not expose Exam Hub directly to the public internet. Use a dedicated examination LAN and keep the administrator PIN, package activation code and teacher marking package separate.

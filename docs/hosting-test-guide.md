# Test the school upgrades in a fresh web export

The upload folders are `web-hosting/children`, `web-hosting/teens`, and `web-hosting/uni`. The `web-hosting/parent` website and neutral enrolment portal are separate and unchanged.

Exports generated 2 September 2026. Static checks passed for 33 key pages across the three variants, including compiled variant identity, bundle references, referenced HTML assets, backend address and classroom/results feature markers. Logged-out browser smoke tests reached the correct variant's account screen from Children home, Teens school administration and Uni classroom. Authenticated school operations were not exercised against the live backend.

## Backend first

Deploy the updated backend code to **quiks-app.onrender.com** before testing the new actions. The exports call that service, not quiks-openai-proxy. Web uploads alone do not install the new backend endpoints. Keep the configured persistent school and classroom storage paths; no data reset is needed for these upgrades.

## Local preview

Open PowerShell in the Quiks project folder and run one command:

```powershell
node scripts/preview-hosting.mjs teens 4173
```

Open **http://localhost:4173/**. Replace `teens` with `children` or `uni` to test another variant. Stop the server with Ctrl+C before reusing its port. You can alternatively run each variant in a separate terminal on ports 4173, 4174 and 4175.

The preview server serves one variant at its root, just like the live subdomain. Do not append `/children/`, `/teens/`, or `/uni/` to the local address. Do not open HTML through `file://`. Deep pages such as `/school-admin/` are supported. Firebase must allow `localhost` as an authentication domain if it has not already been configured.

## Test both classroom workflows

1. Sign in as the school administrator. Open **School Control → School Administration → Classes & records**.
2. Create a class with an assigned, active school teacher and the shared-code policy. Copy its teacher code.
3. In a separate browser/account, sign in as that teacher, select the school-linked teacher profile, open **Classroom**, and enter the code under **Open school class**.
4. As a school-enrolled student, request to join using the shared code. Have the teacher approve the request.
5. Repeat with the separate-code policy. After opening the class, the teacher must generate a student join code. Confirm that the teacher code cannot be used by a student.
6. Create another class directly as the school-linked teacher. Confirm it appears in the administrator's list, then register its class code in the portal.
7. Create a Test/Assignment, lesson note and chat message. Submit the activity as a student. Refresh the administrator's class list and reopen the record viewer; verify the roster, activities, notes, messages and submissions. Check **Results & reports** for the same submission.
8. Refresh/reopen both accounts and confirm classes and records remain. Verify that a different teacher cannot claim an assigned class and a different school's administrator cannot read its records.

Use testing accounts/data. Report email sends are real if you approve and confirm them against a backend with email configured. High-stakes CBT scoring remains a separate hardening task: marks are currently client-reported.

## Upload later

Upload each variant folder's **contents** to its matching subdomain's document root. Replace the generated HTML, `expo`, assets and route folders together, not just one JavaScript file. Preserve the backup until testing passes. The local backup of the previous hosting files is under `hosting-backups/` and is not for upload.

Run `node scripts/verify-hosting.mjs` to check the generated entry references, essential routes, assets and new feature markers. These static checks do not replace signing in and completing the workflows above.

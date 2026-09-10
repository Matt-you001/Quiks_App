# Quiks School Paddle rollout

## Current implementation state

The Quiks parent pricing and checkout pages now separate Individual subscriptions from Schools and Institutions. Individual remains the default and continues to the existing variant-specific checkout. The school form collects the institution name, first administrator, administrator email, learner count, enrolment-code mode, package and billing period.

School checkout currently fails closed. `web-hosting/parent/school-paddle-config.js` and its copy in `web-hosting2` contain the live public client-side token and all ten production price IDs, but retain `enabled: false`. The backend implementation now creates an expiring server-side pending purchase, verifies RevenueCat authorization and HMAC, fetches the completed transaction from Paddle, validates its price and quantity, activates the licence idempotently, preserves billing history and emails the first administrator invitation. Do not enable charging until the Render secrets and RevenueCat webhook below have been configured and an end-to-end sandbox purchase has passed.

## Paddle catalogue to create

Create the following Paddle products and prices in Sandbox first. Use fixed package IDs in Quiks; never calculate the licence from an amount supplied by the browser.

| Quiks package ID | Package | Term price | Session or annual price | Learner entitlement |
| --- | --- | ---: | ---: | --- |
| `per-learner` | Per Learner Access | $3.50 per learner | $10 per learner | Purchased learner quantity |
| `starter` | Essential School | $225 | $550 | 10–100 learners |
| `growth` | Growth School | $370 | $926 | 101–200 learners |
| `complete` | Comprehensive School | $593 | $1,445 | 201–500 learners |
| `enterprise` | Enterprise Network | $741 | $1,852 | Contracted group or multi-campus allocation |

Create the ₦50,000 onboarding fee as a separate one-time product. RevenueCat's Paddle integration currently supports one product in a purchase, so do not silently add the onboarding product to the same school-package transaction.

Use one RevenueCat offering (`quiks_school`) and add ten packages: one Term and one Session package for each of the five rows above. The products are deliberately **not attached to a RevenueCat entitlement** because these are non-renewing purchases and Quiks must not interpret them as lifetime access. RevenueCat supplies normalized payment events; the Quiks backend is the authority for fixed-term licence access.

Production Paddle price mapping:

| Quiks package ID | Term Paddle price ID | Session Paddle price ID |
| --- | --- | --- |
| `per-learner` | `pri_01m22sf7c2yapaxmrsqvcc4q26` | `pri_01m23awdptxksm2xxwkv1pcy6y` |
| `starter` | `pri_01m22zx25r919nw4xgcnshxpet` | `pri_01m2309pdzp0kf8s4ccrcemt6d` |
| `growth` | `pri_01m231caaj1z0fn97rppasvmfm` | `pri_01m231pt3qdw4gr25jzwv8taev` |
| `complete` | `pri_01m231zmgwx166gnx1dtnnqxrs` | `pri_01m232j0rbgyfdvf4gvz1sheb8` |
| `enterprise` | `pri_01m232tp79qtbh6w4p9y8v1d0h` | `pri_01m2335zfhpsxgame479sf0tz2` |

## Implemented fixed-term activation flow

1. The browser creates a pending purchase through `POST /school/purchases/pending` before Paddle opens.
2. The server returns an opaque purchase reference and a separate status token. Only the purchase reference is placed in Paddle `custom_data.app_user_id`.
3. RevenueCat sends `NON_RENEWING_PURCHASE` to `POST /webhooks/revenuecat/school`.
4. Quiks verifies the configured Authorization value and `X-RevenueCat-Webhook-Signature` against the exact raw request body.
5. Quiks fetches the transaction from Paddle and requires `completed` status, the same purchase reference, the exact server-selected price and the correct quantity.
6. A Term licence activates for exactly 120 days. A Session licence ends on the equivalent UTC date one calendar year later; 29 February maps to 28 February in a non-leap year.
7. An early renewal starts at the existing expiry; a renewal after expiry starts at its verified purchase time. Each payment remains in immutable billing history.
8. Duplicate webhook deliveries are idempotent. A verified cancellation/refund marks its purchase refunded and recalculates the remaining paid licence periods.
9. A first purchase creates the school and a single-use, email-locked administrator invitation. A matching later purchase renews the existing school.
10. The checkout polls `POST /school/purchases/status` with its private status token and reports the verified activation date without exposing the invitation code.

The browser must contain only the Paddle client token and price IDs. Paddle API keys, RevenueCat secrets, webhook authorization values and Firebase service credentials belong only in Render environment variables.

## Render variables still required

Add these to the `quiks-app` service, never to a hosting folder:

| Variable | Value/use |
| --- | --- |
| `QUIKS_SCHOOL_BILLING_ENVIRONMENT` | `sandbox` while testing; `production` only with the live catalogue |
| `PADDLE_SANDBOX_API_KEY` | Secret Paddle Sandbox API key used to fetch and verify transactions |
| `QUIKS_SCHOOL_SANDBOX_PRICE_IDS_JSON` | JSON object mapping each `package:period` selection to its Sandbox `pri_...` ID |
| `PADDLE_API_KEY` | Secret Paddle Production API key; not needed until production testing |
| `REVENUECAT_SCHOOL_WEBHOOK_AUTH` | A long random complete Authorization header value, exactly matching the RevenueCat webhook configuration |
| `REVENUECAT_SCHOOL_WEBHOOK_SIGNING_SECRET` | The HMAC signing secret shown once when RevenueCat signing is enabled |

The `/health` response reports only whether each billing secret is configured; it never returns secret values.

Example Sandbox mapping shape (replace every placeholder with its Sandbox price ID):

```json
{"per-learner:term":"pri_...","per-learner:session":"pri_...","starter:term":"pri_...","starter:session":"pri_...","growth:term":"pri_...","growth:session":"pri_...","complete:term":"pri_...","complete:session":"pri_...","enterprise:term":"pri_...","enterprise:session":"pri_..."}
```

## RevenueCat webhook still required

Create a webhook configuration scoped to the Quiks School Paddle app:

- URL: `https://quiks-app.onrender.com/webhooks/revenuecat/school`
- Environment: Sandbox during the first end-to-end tests
- Events: at minimum `NON_RENEWING_PURCHASE` and `CANCELLATION`
- Authorization: exactly the same full value stored in `REVENUECAT_SCHOOL_WEBHOOK_AUTH`
- HMAC signing: enabled; copy the generated signing secret immediately to `REVENUECAT_SCHOOL_WEBHOOK_SIGNING_SECRET`
- Paddle purchase tracking metadata field key: `app_user_id`

The RevenueCat dashboard TEST event validates transport, authorization and signing only. A real Paddle Sandbox checkout is still required to verify price, quantity, transaction lookup, licence creation and administrator email.

## Sandbox-to-production sequence

1. Create and verify the products and prices in Paddle Sandbox.
2. Connect the Sandbox Paddle account to the school RevenueCat web configuration.
3. Implement and test the licence-activation webhook with real sandbox checkouts; simulated webhooks are not sufficient for RevenueCat purchase-state testing.
4. Add the Sandbox client token and price IDs to the public config, then set `enabled: true` only in a test deployment.
5. Test successful purchase, duplicate webhook, declined payment, abandoned checkout, refund, cancellation and expiration.
6. Recreate or map the catalogue in Paddle Production, replace only the public client token and price IDs, and keep sandbox and production webhook records separate.

Official references: [RevenueCat Paddle integration](https://www.revenuecat.com/docs/web/integrations/paddle), [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks), and [Paddle custom data](https://developer.paddle.com/build/transactions/custom-data/).

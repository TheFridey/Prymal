# Prymal Pre-Launch QA Checklist

Run this before beta or investor demos. Authenticated paths require real Clerk test users and Stripe test-mode prices/webhooks.

## Account And Auth

- Clerk normal user signs up or signs in successfully.
- Clerk staff user signs in successfully and has the expected staff role.
- `GET /api/auth/me` returns `200` after login with a Clerk Bearer token.
- `GET /api/auth/me` returns `401` when unauthenticated.
- Onboarding completes and redirects to `/app/dashboard`.
- Team invite accept flow uses the invited email and cannot join the wrong org.

### Clerk `/api/auth/me` Proof Record

Complete this record before marking a staging or production build ready for controlled beta.

| Field | Required Evidence |
|---|---|
| Test date | Exact date and environment tested |
| Frontend origin | The browser origin used for the authenticated request |
| Backend route | `GET /api/auth/me` |
| Status | `200 OK` for authenticated user, `401` for signed-out request |
| Auth header | Browser request includes `Authorization: Bearer <Clerk JWT>` from `getToken()` |
| User context | Response includes the expected Clerk user identifier |
| Org context | Response includes the expected active organisation/workspace context |
| Clerk environment | Frontend publishable key and backend secret key belong to the same Clerk test/live environment |
| CORS notes | Frontend origin is allowed and `Authorization` header is accepted |
| Evidence link | Playwright trace, curl transcript, or staging QA note |

Do not bypass Clerk, mock production auth, or disable auth middleware for this proof.

## Billing And Entitlements

- Standard Stripe checkout works for Solo, Pro, Teams, and Agency.
- Founding Access checkout applies only inside the active founding window.
- Founding Access grants no extra video credits and renews/enforces standard price after the founding period.
- Stripe portal opens and returns to the app.
- Subscription webhook resets included execution/video credits for the new billing period.
- Duplicate/stale Stripe webhook events do not reset same-plan credits.
- Add-on purchase works for `exec_boost_1000`, `video_pack_small`, and `video_pack_pro`.
- Legacy Agency price IDs cannot start new checkout.
- Legacy Agency price IDs still resolve for grandfathered webhook sync.

### Stripe Test-Mode Lifecycle Record

Complete this record using Stripe test mode before controlled beta.

| Flow | Required Evidence |
|---|---|
| Solo checkout | Checkout session uses current Solo price ID and credits match catalog |
| Pro checkout | Checkout session uses current Pro price ID and credits match catalog |
| Teams checkout | Checkout session uses current Teams price ID and credits match catalog |
| Agency checkout | Checkout session uses current Agency `from £299` price ID and credits match catalog |
| Legacy Agency rejection | Direct legacy Agency price checkout returns blocked/rejected response |
| Founding checkout | Eligible workspace receives Founding price ID only during active founding window |
| Founder expiry | Subscription item transitions back to standard price after founding window |
| Execution add-on | `exec_boost_1000` purchase credits execution balance only |
| Video add-ons | `video_pack_small` and `video_pack_pro` credit video balance only |
| Duplicate webhook | Duplicate/stale Stripe event does not reset balances |
| Same-plan update | Same-plan webhook update does not reset credits incorrectly |
| Billing portal | Portal opens, returns to app, and does not expose legacy checkout |

Record Stripe event IDs and workspace IDs in the private launch log, not in public docs.

## Usage Controls

- Execution credit burn reserves/commits/releases correctly.
- Video credit reserve/commit/release works for success, provider failure, and user-facing retry.
- Usage pressure warning appears at the warning band.
- Usage pressure high state appears at the high band.
- Usage pressure critical/modal appears before exhaustion.
- Blocked state prevents new paid work when balances or fair-use gates require it.
- Usage pressure suggestions promote preferred pack IDs only.

## Product Workflows

- LORE pasted text upload, search, and delete work.
- LORE `.txt`, `.md`, `.csv`, `.pdf`, and `.docx` ingestion paths are checked if enabled in the test environment.
- Memory write, retrieve, edit, and forget/delete work.
- Workflow create, manual run, failure, and replay work.
- Scheduled workflow copy appears only when Trigger.dev or inline scheduling is actually configured.
- Integration secrets save encrypted and test actions do not expose raw tokens.

## Workflow Catalogue

- `WORKFLOW_CATALOGUE_ENABLED=true` in target environment.
- `WORKFLOW_CATALOGUE_PREMIUM_ENABLED=false` until marketplace payments are fully proven.
- Official seed script runs idempotently and creates the five curated starting workflows.
- Catalogue list shows only published items to normal users.
- User drafts/private submissions are visible only to the creator organisation.
- Installing a free catalogue workflow creates a normal workspace workflow and does not consume execution credits.
- Running an installed workflow uses the existing workflow execution path, credits, usage policy, burn caps, and org isolation.
- Premium purchase/install attempts are rejected while premium is disabled.

## Transactional Email

- Send a test welcome email with `npm run email:test -- --to <address> --type welcome`.
- Send a test billing email with `npm run email:test -- --to <address> --type subscription-started`.
- Send a test invite email through the team invite flow.
- Verify the Prymal logo renders from `EMAIL_LOGO_URL` or the inline CID `prymal-logo`.
- Verify Herald renders from `EMAIL_HERALD_AVATAR_URL` or the inline CID `herald-avatar`.

### WARDEN safety

- Upload a text file containing `ignore previous instructions` and verify it is stored only as untrusted evidence.
- Crawl a page with hidden prompt-injection text and verify LORE does not treat it as instructions.
- Attempt an unsafe image/video prompt and verify it is blocked before provider submission.
- Attempt a tool/billing instruction from retrieved content and verify WARDEN denies the tool action.
- Verify `warden_audit_event` records verdict, risk, categories, redaction count, and source metadata without storing raw unsafe content.
- Verify the Herald signature renders with avatar or monogram fallback.
- Verify Resend receives the delivery event.
- Verify a Resend failure records an `email_events` row and does not break onboarding, billing webhooks or workflow installs.
- Staff review queue requires staff permissions and shows validation warnings before approval.
- Published workflow definitions contain no secrets, private customer data, hidden webhook destinations, or unsafe prompt instructions.

## Media

- Cloudinary is configured before staging/production video rollout.
- Production/staging startup rejects local media storage unless the explicit break-glass override is set.
- Generated image URLs are Cloudinary-hosted in staging/production.
- Generated video URLs are Cloudinary-hosted in staging/production.
- Video reference image uploads are Cloudinary-hosted in staging/production.
- Failed provider behaviour releases reserved credits and shows safe user copy.

## Admin And Operations

- Admin economics page is visible to staff only.
- Admin economics shows current-cycle burn by plan and all-time burn separately.
- Admin economics shows current cycle gross contribution estimate and burn-to-MRR ratio.
- Admin economics shows top 10 orgs and top 10 users by cycle burn.
- Admin economics shows video vs execution split for the current cycle.
- Warning badges appear at >70%, >90%, and >100% of internal burn cap.
- Admin trace drilldown works and does not leak cross-org data to normal users.

## Responsive And Legal

- Dashboard, chat, LORE, Memory, Workflows, Integrations, Settings, and Admin pass mobile responsive checks.
- Top navigation and sidebar do not overlap content on desktop or mobile.
- Privacy, Terms, Cookies, Pricing, and Changelog pages render.
- Public pricing copy does not claim uncapped usage, rollover, or unsupported storage durability.

## Verification Commands

```bash
cd backend
npm run lint
npm test
npm run schema:check
npm run db:verify-local
npm run env:validate

cd ../frontend
npm run lint
npm test
npm run build
npm run verify-build -- --clean

npm run test:e2e -- tests/marketing-smoke.spec.js tests/onboarding-smoke.spec.js
```

Authenticated E2E, when staging credentials exist:

```bash
npm run test:e2e -- tests/authenticated-regression.spec.js tests/onboarding-regression.spec.js tests/invite-membership.spec.js tests/billing-portal.spec.js tests/admin-operator.spec.js tests/security-boundaries.spec.js
```

Document any environment-specific skips, such as Clerk CAPTCHA, new-device OTP, Stripe live keys, or unavailable provider quotas.

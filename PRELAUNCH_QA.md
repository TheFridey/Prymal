# Prymal Pre-Launch QA Checklist

Run this before beta or investor demos. Authenticated paths require real Clerk test users and Stripe test-mode prices/webhooks.

## Account And Auth

- Clerk normal user signs up or signs in successfully.
- Clerk staff user signs in successfully and has the expected staff role.
- `GET /api/auth/me` returns `200` after login with a Clerk Bearer token.
- `GET /api/auth/me` returns `401` when unauthenticated.
- Onboarding completes and redirects to `/app/dashboard`.
- Team invite accept flow uses the invited email and cannot join the wrong org.

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

# Prymal Deployment Guide

This guide is for the live Prymal stack as it exists today:

- `frontend/`: Vite React app
- `backend/`: Hono API on Railway
- `database/`: PostgreSQL + `pgvector`
- Auth: Clerk
- Billing: Stripe
- Email: Resend
- Scheduling: inline scheduler by default, Trigger.dev when configured

The safest release path is:

1. Provision staging first
2. Validate envs before deploy
3. Apply schema in a controlled order
4. Deploy backend
5. Deploy frontend
6. Run the post-deploy verification checklist

## Environment Model

Use two environments with separate credentials and domains:

- `staging`
  - safe for CI-authenticated Playwright
  - uses Clerk test or staging instance
  - uses Stripe test mode
  - may use lower-volume model keys
- `production`
  - customer-facing
  - uses Clerk production instance
  - uses Stripe live mode
  - should use dedicated support and monitoring credentials

Recommended domains:

- `staging`
  - frontend: `https://staging.prymal.io`
  - backend: `https://prymal-staging-api.up.railway.app`
- `production`
  - frontend: `https://app.prymal.io`
  - backend: `https://api.prymal.io` or the Railway production URL behind your custom domain

Keep these environments separate:

- Clerk applications
- Stripe accounts or modes
- Railway projects or services
- PostgreSQL databases
- Resend sender identities if needed
- Playwright test accounts

## Before You Touch Infra

Make sure the repo is deployable from the exact commit you are shipping:

1. Frontend build passes:

```bash
cd frontend
npm ci
npm run build
```

2. Backend tests pass:

```bash
cd backend
npm ci
NODE_ENV=test npm test
```

3. Production env contract validates:

```bash
cd backend
NODE_ENV=production npm run env:validate
node scripts/validate-env.mjs --scope frontend --mode production
```

4. Staging Playwright contract validates:

```bash
cd backend
PLAYWRIGHT_AUTH_REQUIRED=true node scripts/validate-env.mjs --scope playwright --mode staging
```

## Step 1: Provision PostgreSQL + pgvector

Prymal expects PostgreSQL with `pgvector` enabled.

### Railway database

1. Create a new PostgreSQL service in Railway.
2. Open a SQL shell for that database.
3. Enable the extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

4. Record the connection string as `DATABASE_URL`.

### Schema bootstrap and migration order

For a fresh environment:

1. Apply the bootstrap schema first:

```bash
psql "$DATABASE_URL" < database/schema.sql
```

2. Apply migrations in repository order:

```bash
psql "$DATABASE_URL" < database/migrations/2026-04-01-ingestion-and-run-logs.sql
psql "$DATABASE_URL" < database/migrations/2026-04-01-teams-memory-hardening.sql
psql "$DATABASE_URL" < database/migrations/2026-04-05-waitlist.sql
psql "$DATABASE_URL" < database/migrations/2026-04-06-add-pixel-agent.sql
psql "$DATABASE_URL" < database/migrations/2026-04-06-control-plane-runtime-hardening.sql
psql "$DATABASE_URL" < database/migrations/2026-04-06-memory-scope-expansion.sql
psql "$DATABASE_URL" < database/migrations/2026-04-07-workflow-webhooks.sql
psql "$DATABASE_URL" < database/migrations/2026-04-23-billing-credit-schema.sql
psql "$DATABASE_URL" < database/migrations/2026-04-25-moat-systems.sql
psql "$DATABASE_URL" < database/migrations/2026-04-26-founding-access.sql
psql "$DATABASE_URL" < database/migrations/2026-04-27-memory-architecture.sql
psql "$DATABASE_URL" < database/migrations/2026-04-27-memory-hardening.sql
psql "$DATABASE_URL" < database/migrations/2026-04-28-pricing-usage-controls.sql
psql "$DATABASE_URL" < database/migrations/2026-04-29-usage-estimate-events.sql
```

For local Docker, remember that compose init scripts only run on first volume creation. If your local database has missing table or column errors after pulling schema changes, reset the local volume from the repo root:

```bash
docker compose down -v
docker compose up -d prymal-db
cd backend
npm run db:migrate
npm run schema:check
npm run db:verify-local
```

### Migration safety rules

- Take a database snapshot before production migrations.
- Apply migrations with the backend scaled down to a single instance.
- Do not run ad hoc schema edits in Railway first and “backfill the repo later”.
- Keep `database/schema.sql` and `backend/src/db/schema.js` aligned if schema changes land.
- Keep `database/migrations/` and `backend/drizzle/` migration coverage aligned for local and deployed migration paths.
- If a migration touches tenant-owned tables, verify `org_id` filtering assumptions after deploy.

## Step 2: Configure Clerk

### Production Clerk checklist

1. Create or open the Prymal production Clerk application.
2. Add the production frontend URL to allowed origins.
3. Add the production frontend and backend callback URLs.
4. Copy:
   - `CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
5. Create the webhook endpoint:
   - `POST https://<backend-domain>/api/auth/webhook/clerk`
6. Copy `CLERK_WEBHOOK_SECRET`.

### Staging Clerk checklist

Use a separate Clerk test or staging application.

Configure:

- `VITE_CLERK_PUBLISHABLE_KEY` for staging frontend
- `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` for staging backend
- a staging webhook endpoint
- dedicated Playwright users:
  - owner user
  - staff user
  - invitee user
  - onboarding user
  - billing user

### Clerk operational notes

- Prymal backend auth depends on valid Clerk JWTs for `/api/*` routes.
- Playwright CI should point at staging, not local preview, for authenticated regression coverage.
- If sign-in from new devices requires email verification, either relax that staging policy or use resettable staging accounts that your CI can complete consistently.

## Step 3: Configure Stripe

Prymal uses Stripe Billing + Checkout Sessions:

- `POST /api/billing/checkout` creates subscription Checkout Sessions for Solo, Pro, Teams, and Agency.
- `POST /api/billing/packs/checkout` creates one-time Checkout Sessions for execution and AI video packs.
- `POST /api/billing/seat-addon` creates Teams seat add-on subscription Checkout Sessions.
- `POST /api/billing/portal` opens the Stripe Customer Portal.
- `POST /api/billing/webhook/stripe` syncs subscription state, founding discounts, pack purchases, seat add-ons, and failed-payment state.

Use [docs/billing-pricing-audit.md](./docs/billing-pricing-audit.md) as the internal checklist whenever pricing, entitlements, or Stripe Price IDs change.

### Production

1. Switch Stripe to live mode.
2. Create subscription products/prices using Stripe Prices, not deprecated Plans.
3. Create standard recurring prices for each plan and billing interval:

   | Plan | Monthly | Quarterly | Yearly |
   |---|---:|---:|---:|
   | Solo | £49.99 | £131.97 | £455.91 |
   | Pro | £99 | £261.36 | £902.88 |
   | Teams | £179 | £472.56 | £1,632.48 |
   | Agency | £299 | £789.36 | £2,726.88 |

4. Create Founding Access recurring prices for the founding window. These are temporary Stripe intro prices only; standard catalog pricing must remain the renewal target after the founding window:

   | Plan | Monthly | Quarterly | Yearly |
   |---|---:|---:|---:|
   | Solo Founding | Stripe-configured intro | Stripe-configured intro | Stripe-configured intro |
   | Pro Founding | Stripe-configured intro | Stripe-configured intro | Stripe-configured intro |
   | Teams Founding | Stripe-configured intro | Stripe-configured intro | Stripe-configured intro |
   | Agency Founding | Stripe-configured intro | Stripe-configured intro | Stripe-configured intro |

5. Create one-time credit pack prices. Preferred packs for new users are the Execution Boost and the two Video Pack entries; legacy pack IDs are retained only if you need webhook compatibility for historical purchases.

   | Pack | Price | Credits |
   |---|---:|---:|
   | Execution Boost | £15 | 1,000 execution |
   | Legacy execution 100 | £10 | 100 execution |
   | Legacy execution 300 | £25 | 300 execution |
   | Legacy execution 700 | £50 | 700 execution |
   | Video Pack Small | £20 | 10 AI video |
   | Video Pack Pro | £50 | 30 AI video |
   | Legacy video 15 | £5 | 15 AI video |
   | Legacy video 30 | £10 | 30 AI video |
   | Legacy video 100 | £25 | 100 AI video |

6. Create the recurring Teams seat add-on price:
   - `£25/mo` per extra seat.
   - Quantity is controlled by `additionalSeats`.
7. Copy:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_SOLO`
   - `STRIPE_PRICE_SOLO_QUARTERLY`
   - `STRIPE_PRICE_SOLO_YEARLY`
   - `STRIPE_PRICE_PRO`
   - `STRIPE_PRICE_PRO_QUARTERLY`
   - `STRIPE_PRICE_PRO_YEARLY`
   - `STRIPE_PRICE_TEAMS`
   - `STRIPE_PRICE_TEAMS_QUARTERLY`
   - `STRIPE_PRICE_TEAMS_YEARLY`
   - `STRIPE_PRICE_AGENCY`
   - `STRIPE_PRICE_AGENCY_QUARTERLY`
   - `STRIPE_PRICE_AGENCY_YEARLY`
   - `STRIPE_PRICE_AGENCY_LEGACY` / `_QUARTERLY` / `_YEARLY` only for grandfathered legacy Agency subscriptions; never point new checkout at these IDs
   - `STRIPE_PRICE_FOUNDING_SOLO`
   - `STRIPE_PRICE_FOUNDING_SOLO_QUARTERLY`
   - `STRIPE_PRICE_FOUNDING_SOLO_YEARLY`
   - `STRIPE_PRICE_FOUNDING_PRO`
   - `STRIPE_PRICE_FOUNDING_PRO_QUARTERLY`
   - `STRIPE_PRICE_FOUNDING_PRO_YEARLY`
   - `STRIPE_PRICE_FOUNDING_TEAMS`
   - `STRIPE_PRICE_FOUNDING_TEAMS_QUARTERLY`
   - `STRIPE_PRICE_FOUNDING_TEAMS_YEARLY`
   - `STRIPE_PRICE_FOUNDING_AGENCY`
   - `STRIPE_PRICE_FOUNDING_AGENCY_QUARTERLY`
   - `STRIPE_PRICE_FOUNDING_AGENCY_YEARLY`
   - `STRIPE_PRICE_EXEC_BOOST_1000`
   - `STRIPE_PRICE_VIDEO_PACK_SMALL`
   - `STRIPE_PRICE_VIDEO_PACK_PRO`
   - legacy-only if retained: `STRIPE_PRICE_EXEC_100`, `STRIPE_PRICE_EXEC_300`, `STRIPE_PRICE_EXEC_700`, `STRIPE_PRICE_VIDEO_15`, `STRIPE_PRICE_VIDEO_30`, `STRIPE_PRICE_VIDEO_100`
   - `STRIPE_PRICE_SEAT_ADDON`
8. Configure the webhook:
   - `POST https://<backend-domain>/api/billing/webhook/stripe`
9. Subscribe the webhook endpoint to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
10. Copy `STRIPE_WEBHOOK_SECRET`.
11. Confirm Founding Access behaviour:
   - eligible workspaces receive Founding Stripe price IDs at checkout
   - ineligible workspaces fall back to standard price IDs
   - after the founding window, webhook sync runs `enforceFounderStandardStripePricing` and moves subscriptions back to standard Stripe price IDs
12. Confirm legacy Agency protection:
   - new checkout blocks `STRIPE_PRICE_AGENCY_LEGACY*`
   - webhook mapping still resolves legacy IDs for grandfathered subscriptions

### Staging

Use Stripe test mode with a separate set of prices and webhook secret. Do not reuse live price IDs in staging.

## Step 4: Configure Model Providers and Email

Required for real product behaviour:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL_PREMIUM=claude-opus-4-7` or the current approved Opus model

Optional but supported:

- `GEMINI_API_KEY`
- `GEMINI_MODEL_VEO`
- `GEMINI_MODEL_VEO_STANDARD`
- `GEMINI_GROUNDING_ENABLED=false` for launch; live Gemini web grounding is intentionally deferred

Current media-generation constraints to keep honest in deploy/runbooks:

- Prymal currently supports Veo one-shot renders at `4`, `6`, or `8` seconds only.
- Guided reference images are supported on Veo 3.1 Standard for `8` second renders only.
- UI token and credit previews are advisory; billing enforcement stays server-side authoritative.

Email:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- optional `INVITE_EMAIL_REPLY_TO`

Operational mail:

- `WREN_ESCALATION_EMAIL`

Launch support:

- optional `EARLY_USER_IDS`
  - comma-separated Clerk user IDs for your first customer cohort
  - these users are tagged as `earlyUser: true` in `request_failed` backend logs so support can triage first-session friction faster

Security:

- `ENCRYPTION_KEY`
  - must be a 64-character hex string
- `INTEGRATION_STATE_SECRET`

Generate safe secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 5: Deploy Backend to Railway

1. Create a Railway service rooted at `backend/`.
2. Set the start command:

```bash
node src/index.js
```

3. Set environment variables:

- `NODE_ENV=production`
- `DATABASE_URL`
- `FRONTEND_URL`
- `API_URL`
- Clerk keys
- Stripe keys and prices
- model provider keys
- email keys
- security keys
- optional Upstash / Trigger.dev values

4. Run env validation in the Railway shell or locally against the deployment env set:

```bash
cd backend
NODE_ENV=production npm run env:validate
```

5. Confirm backend health:

```bash
curl https://<backend-domain>/health
```

### Railway notes

- Start with one backend instance for launch.
- If you scale horizontally, configure Upstash Redis so rate limiting is shared.
- If Trigger.dev is not configured, scheduled workflows are inline-only and should be communicated that way.
- Video generation currently stores reference uploads under `backend/storage/video-reference-images` and completed outputs under `backend/storage/generated-videos`.
- Because those assets are served from local disk, single-instance backend deploys are the honest default until shared object storage is added.

## Step 6: Deploy Frontend

Prymal’s frontend can be deployed to Cloudflare Pages or another static host.

### Cloudflare Pages

1. Create a Pages project rooted at `frontend/`.
2. Use:

- build command: `npm ci && npm run build`
- output directory: `dist`

3. Set:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_URL`
- optional `VITE_SENTRY_DSN`

4. Make sure SPA routing works with:

```txt
/*  /index.html  200
```

### Frontend validation

Before shipping production frontend envs:

```bash
cd backend
node scripts/validate-env.mjs --scope frontend --mode production
```

## Step 7: Configure CI Authenticated Playwright

Authenticated Playwright should run against staging only.

Required GitHub secrets:

- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_API_URL`
- `PLAYWRIGHT_TEST_USER_EMAIL`
- `PLAYWRIGHT_TEST_USER_PASSWORD`
- `PLAYWRIGHT_TEST_STAFF_EMAIL`
- `PLAYWRIGHT_TEST_STAFF_PASSWORD`
- `PLAYWRIGHT_TEST_INVITEE_EMAIL`
- `PLAYWRIGHT_TEST_INVITEE_PASSWORD`
- `PLAYWRIGHT_TEST_ONBOARDING_EMAIL`
- `PLAYWRIGHT_TEST_ONBOARDING_PASSWORD`
- `PLAYWRIGHT_TEST_BILLING_EMAIL`
- `PLAYWRIGHT_TEST_BILLING_PASSWORD`

Validate the CI contract with:

```bash
cd backend
PLAYWRIGHT_AUTH_REQUIRED=true node scripts/validate-env.mjs --scope playwright --mode staging
```

`PLAYWRIGHT_BASE_URL` should point at the deployed frontend. `PLAYWRIGHT_API_URL` should point at the matching backend API root, including `/api`, for example `https://prymal-staging-api.up.railway.app/api`. The validation step fails on partial credential pairs so skipped tests mean “role intentionally absent,” not “half-configured login.”

The authenticated suite covers:

- Clerk login
- onboarding completion
- team invite and membership
- workflow creation
- workflow replay
- LORE upload
- contradiction warning rendering
- admin trace drilldown
- SENTINEL held-output visibility
- billing upgrade and Stripe portal
- non-staff rejection from staff admin APIs

Optional DB-backed workflow race proof:

```bash
cd backend
PRYMAL_RUN_DB_WORKFLOW_CONCURRENCY_TESTS=true DATABASE_URL="$STAGING_TEST_DATABASE_URL" node --test src/services/workflow-engine.test.js
```

Run this only against a disposable or staging test database that has the current schema applied. The default unit suite keeps this proof skipped because local contributors may not have Postgres running.

## Staging vs Production Variables

Use the same variable names, but different values.

Staging should typically use:

- Clerk test or staging keys
- Stripe test keys and prices
- staging frontend and API URLs
- dedicated staging databases
- staging Playwright accounts

Production should use:

- Clerk production keys
- Stripe live keys and prices
- production domains
- production email sender identity
- production alerting addresses
- Cloudinary-backed media storage for generated images, generated videos, and video reference images

Never point staging frontend at production backend or vice versa.

## Cloudinary checklist

Configure Cloudinary before any staging or production rollout that enables video generation:

- [ ] Set `MEDIA_STORAGE_DRIVER=cloudinary`
- [ ] Set `CLOUDINARY_CLOUD_NAME`
- [ ] Set `CLOUDINARY_API_KEY`
- [ ] Set `CLOUDINARY_API_SECRET`
- [ ] Set `CLOUDINARY_FOLDER=prymal` or another environment-specific folder prefix
- [ ] Decide `VIDEO_REFERENCE_ASSET_RETENTION`
- [ ] Confirm `ALLOW_LOCAL_MEDIA_STORAGE_IN_PRODUCTION` remains `false`

Folder convention used by the backend:

- generated images: `<folder>/generated-images/<orgId>/...`
- generated videos: `<folder>/generated-videos/<orgId>/...`
- video reference images: `<folder>/video-reference-images/<orgId>/<videoJobId>/...`

## Post-Deploy Verification Checklist

Run these checks after every staging deploy and before every production go-live:

### Auth and onboarding

- [ ] Sign in with a normal user
- [ ] Complete onboarding with a resettable staging onboarding account
- [ ] Accept a team invite with the staging invitee account

### Core workspace

- [ ] Open `/app/dashboard`
- [ ] Open an agent workspace
- [ ] As a brand-new user, confirm the dashboard and first chat clearly explain what to ask Prymal to do
- [ ] Verify a normal response renders
- [ ] Verify the first-run hint and starter prompts appear on a fresh workspace
- [ ] Verify `/image` opens the guided image builder and shows token/credit guidance
- [ ] Verify `/video` opens the guided video builder and shows mode, duration, aspect, and credit guidance
- [ ] Verify a SENTINEL-held response is visible in admin traces if one exists in the staging window

### LORE

- [ ] Upload a supported file
- [ ] Confirm document inventory updates
- [ ] Run a search and inspect citation chips
- [ ] Confirm contradiction warnings render when conflicting content is ingested

### Workflows

- [ ] Create a workflow from a template
- [ ] Queue a run
- [ ] Replay a run
- [ ] Inspect run history

### Billing

- [ ] Start a Stripe checkout session
- [ ] Open the Stripe billing portal with the staging billing account
- [ ] Verify plan changes and top-up packs land through Stripe webhooks
- [ ] Verify execution/video credit balances update after a real run and a real video job
- [ ] Verify failed video jobs release reserved video credits correctly

### Media generation

- [ ] Generate a Lite video and confirm the final asset URL is Cloudinary-hosted
- [ ] Generate a Standard video and confirm the credit burn is higher than Lite for the same duration/resolution
- [ ] Generate a Standard 8-second reference-image render and confirm the references persist with the expected retention mode
- [ ] Confirm the chat message artifact plays the uploaded Cloudinary video successfully
- [ ] Confirm failed video jobs release reserved credits and record a visible failure code
- [ ] Confirm local asset URLs are only used when `MEDIA_STORAGE_DRIVER=local`

### Admin / operations

- [ ] Open `/app/admin`
- [ ] Drill into a trace
- [ ] Inspect retrieval diagnostics and memory visibility
- [ ] Inspect a workflow run
- [ ] Open an action receipt if one exists

### Infra and safety

- [ ] Railway backend health check returns 200
- [ ] Database accepts queries
- [ ] `pgvector` extension exists
- [ ] Clerk webhook deliveries are healthy
- [ ] Stripe webhook deliveries are healthy
- [ ] Error tracking is receiving events if Sentry is enabled

## Recovery Notes

If a deploy goes wrong:

1. Stop traffic changes first.
2. Revert frontend deploy if the issue is UI-only.
3. Roll back backend service version if the issue is server-side logic.
4. Restore the database from snapshot if a migration caused data or schema damage.
5. Re-run the post-deploy checklist after rollback.

Do not treat a green static build as production readiness. Prymal’s release confidence depends on:

- env validation
- authenticated staging Playwright
- webhook health
- live admin drilldown sanity

## Deferred Stripe checklist

Stripe remains intentionally deferred until the final pre-launch window. Before launch:

- [ ] Create subscription prices for Solo, Pro, Teams, and Agency across monthly, quarterly, and yearly intervals
- [ ] Create Founding Access prices for Solo, Pro, Teams, and Agency across monthly, quarterly, and yearly intervals
- [ ] Create Stripe prices for execution credit packs, including Execution Boost 1,000
- [ ] Create Stripe prices for AI video packs, including Video Pack Small and Video Pack Pro
- [ ] Create the Teams seat add-on recurring price
- [ ] Set every `STRIPE_PRICE_*` env var
- [ ] Configure the Stripe webhook endpoint and signing secret
- [ ] Run one real checkout flow
- [ ] Buy one credit pack
- [ ] Test one Founding Access checkout and one standard-price checkout
- [ ] Confirm legacy Agency price IDs are webhook-only and blocked from new checkout
- [ ] Replay one webhook event safely
- [ ] Verify entitlement sync and billing UI state after replay

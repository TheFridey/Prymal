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

## Staging Auto-Deploy (CI)

The CI pipeline automatically deploys to staging on every push to `master` that passes all tests. **Production deploys remain manual.**

### How to set up Railway staging

1. Create a Railway project for staging (separate from production)
2. Add two services: `prymal-backend-staging` and `prymal-frontend-staging`
3. Configure staging environment variables — mirror production with these differences:
   - `NODE_ENV=staging`
   - Use Stripe test mode keys (`sk_test_...`, `pk_test_...`)
   - Use a staging Clerk instance (`pk_test_...`)
   - Use a separate staging PostgreSQL database
   - `SENTRY_ENVIRONMENT=staging`
4. Create a Railway API token scoped to the staging project only
5. Add the token to GitHub repository secrets as `RAILWAY_STAGING_TOKEN`

### Staging environment variable differences from production

| Variable | Staging value | Production value |
|----------|--------------|-----------------|
| `NODE_ENV` | `staging` | `production` |
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | `pk_live_...` |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | `pk_live_...` |
| `CLERK_SECRET_KEY` | staging secret | production secret |
| `DATABASE_URL` | staging database | production database |
| `SENTRY_ENVIRONMENT` | `staging` | `production` |

The staging deployment is informational — it does not block the 7 required CI gates. The `deploy-staging` job depends on `backend-test`, `frontend-verify-build`, and `frontend-performance` passing.

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
   | Solo Founding | £39.99 | £119.97 | £479.88 |
   | Pro Founding | £79 | £237 | £948 |
   | Teams Founding | £143.20 | £429.60 | £1,718.40 |
   | Agency Founding | £239.20 | £717.60 | £2,870.40 |

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
- `OPENAI_MODEL_PREMIUM=gpt-5.5`
- `OPENAI_MODEL_ROUTER=gpt-5.4-mini`
- `OPENAI_MODEL_LIGHTWEIGHT=gpt-5.4-nano`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL_PREMIUM=claude-opus-4-7` or the current approved Opus model

Workflow Catalogue:

- `WORKFLOW_CATALOGUE_ENABLED=true`
- `WORKFLOW_CATALOGUE_USER_SUBMISSIONS_ENABLED=true` for beta submissions
- `WORKFLOW_CATALOGUE_PREMIUM_ENABLED=true` for premium catalogue installs; verify Free/Solo upgrade gates before deploy
- `WORKFLOW_CATALOGUE_PLATFORM_FEE_BPS=2500`
- run `npm run catalogue:seed` after migrations to install official curated workflows

Optional but supported:

- `GEMINI_API_KEY`
- `GEMINI_MODEL_FLASH`
- `GEMINI_MODEL_LITE`
- `GEMINI_MODEL_PRO`
- `GEMINI_MODEL_VEO`
- `GEMINI_MODEL_VEO_STANDARD`
- `GEMINI_GROUNDING_ENABLED=true` for live Gemini web grounding; confirm `GEMINI_API_KEY` is present in Railway before deploy

Current media-generation constraints to keep honest in deploy/runbooks:

- Prymal currently supports Veo one-shot renders at `4`, `6`, or `8` seconds only.
- Guided reference images are supported on Veo 3.1 Standard for `8` second renders only.
- UI token and credit previews are advisory; billing enforcement stays server-side authoritative.

Email:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` or legacy `EMAIL_FROM`
- `REPLY_TO_EMAIL` or legacy `INVITE_EMAIL_REPLY_TO`
- `APP_URL` or `FRONTEND_URL`
- optional `EMAIL_LOGO_URL`, defaults to the inline CID `prymal-logo`
- optional `EMAIL_HERALD_AVATAR_URL`, defaults to the inline CID `herald-avatar`
- optional `EMAIL_EMBED_INLINE_ASSETS`, defaults to enabled so the Prymal logo and Herald avatar are attached from repo assets

WARDEN safety firewall:

- `WARDEN_ENABLED=true`
- `WARDEN_STRICT_MODE=false`
- `WARDEN_MAX_CONTENT_CHARS=500000`
- `WARDEN_MAX_URL_TEXT_CHARS=240000`
- `WARDEN_AUDIT_EXCERPT_CHARS=500`
- `WARDEN_MEDIA_SAFETY_STRICTNESS=standard`
- `WARDEN_MODEL_CLASSIFIER_ENABLED=true`
- `WARDEN_MODEL_CLASSIFIER_MODE=auto`
- `WARDEN_MODEL_CLASSIFIER_MODEL=gpt-5-mini`
- `WARDEN_MODEL_CLASSIFIER_TIMEOUT_MS=3000`
- `WARDEN_MODEL_CLASSIFIER_MAX_CHARS=12000`
- `WARDEN_MODEL_CLASSIFIER_CACHE_TTL_SECONDS=900`
- `WARDEN_MODEL_CLASSIFIER_CACHE_MAX=1000`
- `WARDEN_MODEL_CLASSIFIER_DAILY_CALL_CAP=500`
- `WARDEN_MODEL_CLASSIFIER_DAILY_COST_CAP_USD=5`
- optional token pricing vars: `WARDEN_MODEL_CLASSIFIER_INPUT_TOKEN_PRICE_USD`, `WARDEN_MODEL_CLASSIFIER_OUTPUT_TOKEN_PRICE_USD`
- `WARDEN_OCR_ENABLED=false` by default; Teams, Agency, and staff upload paths enable OCR plan-aware at runtime
- `WARDEN_OCR_PROVIDER=none`
- `WARDEN_OCR_TIMEOUT_MS=3000`
- `WARDEN_OCR_MAX_IMAGES=4`
- `WARDEN_OCR_CACHE_TTL_SECONDS=900`
- `WARDEN_OCR_CACHE_MAX=500`
- OCR provider credentials are optional. If OCR is enabled, configure the selected provider only: Cloudinary, Google Vision, or local Tesseract.
- Workflow risk confirmations require migration `0011_workflow_risk_confirmation`.
- Admin security endpoints expose WARDEN events, classifier metrics, confirmation state and safety traces without raw unsafe content.
- WARDEN v2 falls back to deterministic checks if the model classifier, cache, or audit write fails.
- verify the Resend sender domain before production traffic

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

Before pushing CI secret changes, you can validate a local staging credential set from `.env.playwright`:

```bash
cd backend
node scripts/validate-playwright-secrets.mjs
```

The script checks every authenticated Playwright role pair plus `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_API_URL`, then exits non-zero if anything is missing or partial.

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
- [ ] Run `cd backend && npm run env:validate` and confirm production validation passes only with Cloudinary configured

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

## Post-deploy verification checklist

Run this after every production deploy.

### Environment variable verification

- [ ] `GEMINI_GROUNDING_ENABLED=true` — required to activate Gemini web grounding for SCOUT, ORACLE, and SAGE. Set in Railway production environment.
- [ ] `WORKFLOW_CATALOGUE_PREMIUM_ENABLED=true` — required to show premium workflow catalogue items to Pro/Teams/Agency users. Set in Railway production environment.
- [ ] `WARDEN_OCR_ENABLED=false` — global flag; plan-aware logic handles OCR access for Teams/Agency plans. Confirm value is set.
- [ ] `OPENAI_TTS_ENABLED=true` — enables voice output (TTS) for agents. Set when voice output feature is ready for production.
- [ ] `OPENAI_TTS_HD_PLANS=teams,agency` — HD TTS model for Teams and Agency plan users.

### Gemini grounding verification

After setting `GEMINI_GROUNDING_ENABLED=true`:

1. Open the SCOUT, ORACLE, or SAGE workspace
2. Run a request that requires the `grounded_research` policy class (e.g. "What are the latest UK AI regulation updates?")
3. Open the admin trace drilldown for this run (Admin → Traces)
4. Confirm the trace shows `provider: gemini` and includes grounding metadata (source URLs in the response)
5. If grounding metadata is absent: verify `GEMINI_API_KEY` is set and valid in the Railway environment

### Premium catalogue verification

After setting `WORKFLOW_CATALOGUE_PREMIUM_ENABLED=true`:

1. Log in as a Pro, Teams, or Agency user
2. Navigate to Workflows → Catalogue
3. Confirm premium workflow items are visible and accessible
4. Log in as a Free or Solo user
5. Confirm premium items show an upgrade gate rather than being fully accessible
6. If items are not showing: confirm `WORKFLOW_CATALOGUE_PREMIUM_ENABLED` is set (not empty/false)

### Post-deploy setup steps

```bash
# Generate agent avatars (one-time, run against staging first)
node frontend/scripts/generate-agent-avatars.mjs

# Verify all 15 agent avatars are accessible at their Cloudinary URLs
# Check the avatar output log for any failed uploads
# Confirm avatars render in the agent selection UI (Dashboard → agent cards)
```

---

## Staging environment

### Overview

The staging environment mirrors production with test-mode credentials. It is deployed automatically on every push to `master` that passes all required CI gates.

**Staging URL convention:** `https://staging.prymal.io` or `https://prymal-staging.up.railway.app`

### Creating a Railway staging project

1. Log in to [railway.app](https://railway.app)
2. Create a new project: **New Project → Empty Project**
3. Name it `prymal-staging`
4. Add two services: `prymal-backend-staging` and `prymal-frontend-staging`
5. Provision a PostgreSQL database service in the same project
6. Optional: provision Upstash Redis if you plan to run more than one backend process or instance

### Staging environment variables

Set these in each Railway staging service. Differences from production are noted.

```bash
# Core
NODE_ENV=staging
SENTRY_ENVIRONMENT=staging

# Auth — use a separate Clerk staging application
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Database — separate staging PostgreSQL
DATABASE_URL=postgresql://...  # staging DB, NOT production

# Redis — separate staging instance or prefixed keys
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Stripe — test mode keys only
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

# Feature flags — match production
GEMINI_GROUNDING_ENABLED=true
WORKFLOW_CATALOGUE_PREMIUM_ENABLED=true
OPENAI_TTS_ENABLED=true
OPENAI_TTS_HD_PLANS=teams,agency

# Cloudinary — can share production account, use separate folder prefix
CLOUDINARY_FOLDER=prymal-staging
```

**Never set in staging:**
- Production `DATABASE_URL`
- Production `STRIPE_SECRET_KEY` (live mode)
- Production Clerk `sk_live_...` keys

### GitHub secrets and variables

Add in GitHub repo Settings → Secrets / Variables → Actions:

| Type | Name | Value |
|------|------|-------|
| Secret | `RAILWAY_STAGING_TOKEN` | Railway API token scoped to staging project only (Railway Dashboard → Account Settings → Tokens) |
| Variable | `RAILWAY_STAGING_BACKEND_SERVICE` | Railway service name or ID for staging backend |
| Variable | `RAILWAY_STAGING_FRONTEND_SERVICE` | Railway service name or ID for staging frontend |

To find service names: Railway Dashboard → staging project → service → Settings → Service Name.

### Running Playwright against staging

```bash
PLAYWRIGHT_BASE_URL=https://staging.prymal.io npx playwright test
```

Do not add this as an automatic CI step — staging must be fully deployed before E2E tests can run against it.

---

## Post-deploy verification log

### Sprint 5 — 2026-05-05

**Environment variables set in Railway production:**

| Variable | Value |
|----------|-------|
| `GEMINI_GROUNDING_ENABLED` | `true` |
| `WORKFLOW_CATALOGUE_PREMIUM_ENABLED` | `true` |
| `OPENAI_TTS_ENABLED` | `true` |
| `OPENAI_TTS_HD_PLANS` | `teams,agency` |
| `WARDEN_OCR_ENABLED` | `false` |

**Verification checklist:**

- [ ] `GEMINI_GROUNDING_ENABLED=true` set in Railway production
- [ ] `WORKFLOW_CATALOGUE_PREMIUM_ENABLED=true` set in Railway production
- [ ] `OPENAI_TTS_ENABLED=true` confirmed set
- [ ] `OPENAI_TTS_HD_PLANS=teams,agency` confirmed set
- [ ] Gemini grounding verified: SCOUT/ORACLE/SAGE trace shows `provider: gemini` + grounding metadata
- [ ] Premium catalogue verified: Pro user can install, Free user sees upgrade gate
- [ ] WARDEN audit event confirmed on catalogue install
- [ ] Fallback chain verified: Gemini failure routes to next provider cleanly

**Verification steps:**

1. Trigger an agent run using SCOUT, ORACLE, or SAGE with a live-data query
2. Check staff admin execution trace: confirm `provider: gemini` and grounding source URLs
3. Log in as Pro/Teams/Agency user — confirm premium catalogue items are visible and installable
4. Log in as Free/Solo user — confirm premium items show upgrade gate (not 404)
5. Install a premium workflow as a Pro user — check `warden_audit_events` for install scan
6. Confirm community-submitted workflows still require staff review before appearing

---

## Stripe final proof checklist

Live Stripe Prices for standard plans, Founding Access, preferred usage packs, legacy-compatible packs, and the Teams seat add-on should exist before production checkout is enabled. Before controlled beta:

- [x] Create subscription prices for Solo, Pro, Teams, and Agency across monthly, quarterly, and yearly intervals
- [x] Create Founding Access prices for Solo, Pro, Teams, and Agency across monthly, quarterly, and yearly intervals
- [x] Create Stripe prices for execution credit packs, including Execution Boost 1,000
- [x] Create Stripe prices for AI video packs, including Video Pack Small and Video Pack Pro
- [x] Create the Teams seat add-on recurring price
- [x] Set every required `STRIPE_PRICE_*` env var for local production validation except optional legacy Agency grandfathering IDs
- [ ] Configure the Stripe webhook endpoint and signing secret in the target environment
- [ ] Run one real checkout flow
- [ ] Buy one credit pack
- [ ] Test one Founding Access checkout and one standard-price checkout
- [ ] Confirm legacy Agency price IDs are webhook-only and blocked from new checkout
- [ ] Replay one webhook event safely
- [ ] Verify entitlement sync and billing UI state after replay

---

## VPS Migration Checklist

Target: Ubuntu 24.04 LTS, nginx, PM2, SSH deploy via GitHub Actions.  
Migration date: ~10 days from 2026-05-06. No Railway. No PaaS.

### Before migration day

- [ ] `.env.production.example` reviewed — all keys from `validate-env.mjs` are present
- [ ] `backend/ecosystem.config.cjs` reviewed (single-instance default, 1G restart threshold, and no accidental scheduler fan-out)
- [ ] `scripts/deploy.sh` reviewed and path `/home/deploy/prymal/backend` matches VPS layout
- [ ] `docs/server/nginx-prymal.conf` reviewed — `proxy_buffering off` required for SSE
- [ ] GitHub secrets prepared to add on migration day: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`
- [ ] GitHub variable `VPS_DEPLOY_ENABLED=true` set only when VPS deployment should run from CI

### Migration day — VPS setup

- [ ] VPS provisioned (Ubuntu 24.04 LTS recommended — Hetzner CX22 ~£4/mo)
- [ ] System packages: `sudo apt install -y nginx postgresql-16 postgresql-16-pgvector nodejs npm git ufw`
- [ ] Optional for multi-process rate limiting: create an Upstash Redis database and keep the REST URL/token ready
- [ ] Node.js: install via NodeSource (LTS) if distro package is too old
- [ ] PM2: `sudo npm install -g pm2`
- [ ] UFW configured: `sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw deny 3000 && sudo ufw enable`
- [ ] Deploy user: `sudo adduser deploy`
- [ ] SSH key added for deploy user (`~/.ssh/authorized_keys`)
- [ ] Repo cloned: `git clone https://github.com/TheFridey/Prymal /home/deploy/prymal`
- [ ] `.env` created: `cp backend/.env.production.example backend/.env` then fill all values
- [ ] `npm ci --omit=dev` run in `/home/deploy/prymal/backend`
- [ ] Migrations: `cd /home/deploy/prymal/backend && npm run migrate` — all Sprint 4–5 migrations confirmed
- [ ] PM2 started: `pm2 start ecosystem.config.cjs` — process shows `online`
- [ ] Confirm PM2 is running one web process for launch unless Trigger.dev, Upstash-backed rate limiting, and explicit scheduler isolation are all in place
- [ ] PM2 persisted: `pm2 save && pm2 startup` (run the printed `sudo` command)
- [ ] nginx installed: `sudo cp docs/server/nginx-prymal.conf /etc/nginx/sites-available/prymal`
- [ ] nginx enabled: `sudo ln -s /etc/nginx/sites-available/prymal /etc/nginx/sites-enabled/`
- [ ] SSL cert: `sudo certbot --nginx -d api.prymal.io`
- [ ] nginx restarted: `sudo systemctl restart nginx`
- [ ] API health check: `curl https://api.prymal.io/health` → 200
- [ ] GitHub secrets added: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`
- [ ] CI deploy test: push a trivial commit, confirm `deploy-preflight` reports `run` and `deploy-vps` completes successfully

### Post-migration

- [ ] DNS updated: `api.prymal.io` A record → VPS IP
- [ ] Stripe webhook URL updated to `https://api.prymal.io/api/billing/webhook/stripe`
- [ ] Clerk webhook URL updated if applicable
- [ ] `SENTRY_ENVIRONMENT=production` confirmed in `.env`
- [ ] `pm2 logs prymal-backend` checked — no startup errors
- [ ] Docker local environment preserved as fallback for 48 hours post-migration

### Staging on VPS (after production is stable)

- Deploy path: `/home/deploy/prymal-staging/backend`
- PM2 app name: `prymal-backend-staging` (separate `ecosystem.config.cjs`)
- Separate `.env` with test Stripe/Clerk keys and staging DB schema
- nginx subdomain: `staging-api.prymal.io`

---

## SDK release checklist

### Before publishing `@prymal/sdk`

- [ ] Version bumped in `sdk/package.json` (`npm version patch|minor|major`)
- [ ] `npm run build` passes in `sdk/`
- [ ] `npm run lint` passes in `sdk/`
- [ ] `CHANGELOG` updated with new version entry
- [ ] `repository`, `homepage`, `bugs`, and `keywords` fields present in `sdk/package.json`

### Publish

```powershell
cd sdk
npm install
npm run build
npm login          # log in to npm as the prymal org account
npm publish --access public
```

### After publishing

- [ ] Package appears at `https://www.npmjs.com/package/@prymal/sdk`
- [ ] Install test: `npm install @prymal/sdk` in a fresh directory
- [ ] `docs/api/README.md` install command reflects the published version

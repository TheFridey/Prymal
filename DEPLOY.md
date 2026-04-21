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
psql "$DATABASE_URL" -c "ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;"
```

### Migration safety rules

- Take a database snapshot before production migrations.
- Apply migrations with the backend scaled down to a single instance.
- Do not run ad hoc schema edits in Railway first and “backfill the repo later”.
- Keep `database/schema.sql` and `backend/src/db/schema.js` aligned if schema changes land.
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

### Production

1. Switch Stripe to live mode.
2. Create recurring prices for:
   - `solo`
   - `pro`
   - `teams`
   - `agency`
3. Create monthly, quarterly, and yearly prices for each plan.
4. Create the recurring seat add-on price.
5. Copy:
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
   - `STRIPE_PRICE_SEAT_ADDON`
6. Configure the webhook:
   - `POST https://<backend-domain>/api/billing/webhook/stripe`
7. Copy `STRIPE_WEBHOOK_SECRET`.

### Staging

Use Stripe test mode with a separate set of prices and webhook secret. Do not reuse live price IDs in staging.

## Step 4: Configure Model Providers and Email

Required for real product behaviour:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

Optional but supported:

- `GEMINI_API_KEY`

Email:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- optional `INVITE_EMAIL_REPLY_TO`

Operational mail:

- `WREN_ESCALATION_EMAIL`

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

Never point staging frontend at production backend or vice versa.

## Post-Deploy Verification Checklist

Run these checks after every staging deploy and before every production go-live:

### Auth and onboarding

- [ ] Sign in with a normal user
- [ ] Complete onboarding with a resettable staging onboarding account
- [ ] Accept a team invite with the staging invitee account

### Core workspace

- [ ] Open `/app/dashboard`
- [ ] Open an agent workspace
- [ ] Verify a normal response renders
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
- [ ] Verify plan changes land through Stripe webhooks

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

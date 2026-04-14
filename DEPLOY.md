# Prymal — Production Deployment

## Architecture
- Backend: Railway (Node service + managed PostgreSQL with `pgvector`)
- Frontend: Cloudflare Pages (Vite static build)
- Auth: Clerk production instance
- Billing: Stripe live mode
- Email: Resend production API key
- Scheduling: `node-cron` inline scheduler, or Trigger.dev if configured

## Pre-flight checklist

### 1. Clerk
- [ ] Create a production Clerk application
- [ ] Copy `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the Clerk dashboard
- [ ] Add your production domain to Clerk's allowed origins
- [ ] Configure the Clerk webhook endpoint to `https://your-api.railway.app/api/auth/webhook`
- [ ] Copy `CLERK_WEBHOOK_SECRET` from the Clerk webhook dashboard

### 2. Database (Railway PostgreSQL)
- [ ] Provision a Railway PostgreSQL service
- [ ] Enable the `pgvector` extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Run the bootstrap schema: `psql $DATABASE_URL < database/schema.sql`
- [ ] Run migrations in order:

```bash
psql $DATABASE_URL < database/migrations/2026-04-01-ingestion-and-run-logs.sql
psql $DATABASE_URL < database/migrations/2026-04-01-teams-memory-hardening.sql
psql $DATABASE_URL < database/migrations/2026-04-05-waitlist.sql
psql $DATABASE_URL < database/migrations/2026-04-06-add-pixel-agent.sql
psql $DATABASE_URL < database/migrations/2026-04-06-control-plane-runtime-hardening.sql
psql $DATABASE_URL < database/migrations/2026-04-06-memory-scope-expansion.sql
psql $DATABASE_URL < database/migrations/2026-04-07-workflow-webhooks.sql
psql $DATABASE_URL -c "ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;"
```

### 3. Stripe
- [ ] Switch Stripe to live mode
- [ ] Copy `STRIPE_SECRET_KEY` (starts with `sk_live_`)
- [ ] Create products and prices for each plan: solo, pro, teams, agency
- [ ] Copy the live price IDs into `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAMS`, and `STRIPE_PRICE_AGENCY`
- [ ] Copy the quarterly/yearly variants into the matching `*_QUARTERLY` and `*_YEARLY` env vars
- [ ] Create a recurring seat add-on price and copy it into `STRIPE_PRICE_SEAT_ADDON`
- [ ] Configure the Stripe webhook endpoint to `https://your-api.railway.app/api/billing/webhook/stripe`
- [ ] Copy `STRIPE_WEBHOOK_SECRET` from the Stripe dashboard
- [ ] Test checkout, subscription update, and seat add-on purchase end to end before launch

### 4. LLM keys
- [ ] `ANTHROPIC_API_KEY` from console.anthropic.com
- [ ] `OPENAI_API_KEY` from platform.openai.com
- [ ] `GEMINI_API_KEY` is optional and remains deferred for live grounding work in the final sprint

### 5. Email (Resend)
- [ ] Create a Resend account and verify your sending domain
- [ ] Copy `RESEND_API_KEY`
- [ ] Set `EMAIL_FROM` to your verified sender address, for example `Prymal <noreply@prymal.io>`
- [ ] Optionally set `INVITE_EMAIL_REPLY_TO`

### 6. Encryption and security
- [ ] Generate `ENCRYPTION_KEY`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Generate `INTEGRATION_STATE_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Set `STAFF_SUPERADMIN_EMAILS` to your admin email addresses, comma-separated

### 7. WREN escalation
- [ ] Set `WREN_ESCALATION_EMAIL` to the support inbox that should receive escalation alerts
- [ ] Set `WREN_REFUND_THRESHOLD_GBP` if you want to override the default threshold of `50`

### 8. Rate limiting (optional Upstash Redis)
- [ ] For multi-instance deployments, provision an Upstash Redis database
- [ ] Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

**Single instance (Railway default):** Leave Upstash blank. The in-memory store is correct and sufficient.

**Multi-instance (scaled Railway service):** You must configure Upstash Redis or rate limits will be per-instance rather than per-user globally. This means a user could send up to `N × your_limit` requests per minute where `N` is your instance count.

**Recommendation for launch:** Start single-instance. Add Upstash when you scale beyond one instance or when per-user rate limit correctness becomes critical.

### 9. Frontend environment
- [ ] Set `VITE_CLERK_PUBLISHABLE_KEY` to the production Clerk publishable key
- [ ] Set `VITE_API_URL` to your Railway backend URL, for example `https://your-api.railway.app/api`

## Railway deployment

### Backend service

1. Connect your GitHub repo to Railway
2. Set the root directory to `backend`
3. Set the start command to `node src/index.js`
4. Set all backend environment variables from the checklist above
5. Set `NODE_ENV=production`
6. Set `FRONTEND_URL` to your Cloudflare Pages URL
7. Set `API_URL` to your Railway backend URL

### Health check

Railway can probe `GET /health` to confirm the service is running.

## Cloudflare Pages deployment

1. Connect your GitHub repo to Cloudflare Pages
2. Set the root directory to `frontend`
3. Set the build command to `npm ci && npm run build`
4. Set the output directory to `dist`
5. Set environment variables `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_API_URL`
6. Ensure `frontend/public/_redirects` is deployed with:

```txt
/*  /index.html  200
```

This keeps React Router routes working on direct URL access.

## Post-deployment verification

- [ ] Sign up for a new account end to end
- [ ] Complete onboarding
- [ ] Send a message to CIPHER
- [ ] Upload a document to LORE
- [ ] Create and run a simple workflow
- [ ] Add an outbound workflow webhook subscription and confirm a signed delivery is received
- [ ] Verify Stripe checkout completes and the plan updates
- [ ] Verify WREN escalation email arrives for a test trigger
- [ ] Check the admin control plane at `/app/admin`

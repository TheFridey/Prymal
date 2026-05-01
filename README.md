# Prymal

> A premium AI operating system for business execution: 14 user-facing specialist agents, an internal SENTINEL QA gate, grounded organisational memory, workflow orchestration, billing, teams, and operator controls in one SaaS platform.

Prymal is built for businesses that need AI to move beyond chat. It gives teams a coordinated set of specialist agents, a LORE knowledge layer, a NEXUS workflow engine, and a control plane that treats billing, access, usage, traces, and governance as first-class product surfaces.

| Signal | Current Product Reality |
|---|---|
| Product category | Multi-agent AI workspace and automation platform |
| Frontend | Vite, React, React Router, Clerk, TanStack Query, Zustand |
| Backend | Hono API, Drizzle, PostgreSQL, pgvector |
| AI lanes | Anthropic, OpenAI, Google Gemini, OpenAI Realtime, Google Veo |
| Revenue layer | Stripe plans, seats, execution credits, video credits, top-up packs |
| Governance | WARDEN input firewall, SENTINEL PASS / REPAIR / HOLD gate, traces, immutable admin logs |
| Deployment posture | Cloudinary-ready media storage; local storage only as development fallback |

## Why Prymal Exists

Most AI products still leave the operator with the hard parts: choosing the right model, grounding the output, chaining the next step, checking quality, tracking cost, and making the result operational.

Prymal packages those jobs into a business-ready system:

- **Specialist agents** for revenue, support, content, strategy, operations, research, finance, visual assets, and workflows.
- **LORE** for uploaded and crawled knowledge, retrieval diagnostics, contradiction signals, and source-aware answers.
- **NEXUS** for validated workflow graphs, manual/webhook/scheduled triggers, run history, replay, and webhook delivery.
- **WARDEN** for deterministic and model-assisted input-side scanning before external content can reach LORE, agents, workflows, media generation, or tools as trusted instructions.
- **SENTINEL** for QA enforcement before risky or low-confidence outputs reach the user.
- **Operator-grade SaaS controls** for plans, seats, credits, API keys, staff admin, traces, billing, and audit logs.

## Product Surface

### User Workspace

| Area | What It Does |
|---|---|
| Dashboard | Mission-control view of conversations, workflows, credits, recommended agents, and first-win actions |
| Agent chat | SSE streaming, LORE grounding, memory, media artifacts, voice input, and structured output rendering |
| LORE | Text, URL, file upload, search, inventory, contradiction warnings, and reindex/delete flows |
| Workflows | Template library, visual builder, run monitor, replay, webhook subscriptions, and execution logs |
| Workflow Catalogue | Curated workflow library for installing official workflows, drafting community submissions, and staff-reviewed publishing |
| WARDEN | Input-side safety firewall for prompt injection, unsafe media prompts, secret leakage, untrusted evidence, and tool-abuse attempts |
| Integrations | OAuth/manual account linking, encrypted secrets, health checks, outbound publish lanes where implemented |
| Settings | Billing, team seats, invitations, API keys, referrals, organisation routing controls |
| Admin | Staff-only operations console for growth, support, billing, traces, runtime, audit, and workflow health |
| Transactional Email | Resend-backed account, billing, usage, invite, Founder Access, and workflow-install emails signed by HERALD |

### Agent Roster

Prymal exposes 14 user-facing agents and runs SENTINEL internally as the QA gate.

| Agent | Role |
|---|---|
| CIPHER | Data intelligence and anomaly analysis |
| HERALD | Email and outreach |
| LORE | Knowledge base and retrieval |
| FORGE | Copy, content, and commercial narrative |
| ATLAS | Project and operations planning |
| ECHO | Social media and brand voice |
| ORACLE | SEO and search intelligence |
| VANCE | Sales and lead progression |
| WREN | Support and customer care |
| LEDGER | Finance, reports, and investor updates |
| NEXUS | Workflow orchestration |
| SCOUT | Market and competitor research |
| SAGE | Strategy and decision support |
| PIXEL | Image/video briefs and media generation |
| SENTINEL | Internal QA, repair, and hold enforcement |

## What Is Implemented

### Frontend

- Public landing, pricing, changelog, legal pages, and protected app shell.
- Clerk auth routes and onboarding redirect.
- Dashboard, agent chat, LORE, workflows, integrations, settings, and staff admin surfaces.
- Guided onboarding with workspace profiling and first-win recommendations.
- Guided `/image` and `/video` builders with structured controls and approximate credit/token estimates.
- Media artifact rendering for generated images/videos, Veo lane metadata, reference-image counts, and schema/SENTINEL badges.
- Voice input through realtime WebRTC when configured, with recording/transcription fallback paths.
- Workflow template cards, visual builder, monitor, replay, and webhook subscription UI.
- Workflow Catalogue browse, detail, install, submission, and staff review surfaces for curated free workflows.
- WARDEN-aware LORE and media flows with untrusted-evidence boundaries and clean refusal copy for blocked input.
- Integration account linking UI with sections for socials, messaging, email, files, knowledge, and custom endpoints.
- Settings surfaces for seats, invites, billing, API keys, referrals, and model-routing controls.
- Playwright smoke coverage and Vitest unit coverage for core frontend modules.

### Backend

- Clerk webhook sync, local onboarding bootstrap, and org-aware auth middleware.
- Tenant-scoped routes for agents, conversations, LORE, workflows, integrations, billing, settings, and admin.
- Agent chat with SSE streaming, provider routing, fallback metadata, memory, LORE, and SENTINEL review.
- Hybrid RAG search with semantic, lexical, freshness, authority, contradiction, and knowledge-gap signals.
- LORE ingest for pasted text, crawled URLs, `.txt`, `.md`, `.markdown`, `.csv`, `.pdf`, and `.docx`.
- Workflow create/update/toggle/run/replay/delete, idempotency, retry classification, timeout handling, and run history.
- Workflow Catalogue tables, validation, installs, user submissions, admin approval, and official seed workflows.
- WARDEN audit events, deterministic prompt-injection checks, model-assisted classification for ambiguous high-risk inputs, URL/upload/pasted-content sanitisation, media prompt blocking, and tool execution authorization.
- Manual, webhook, and scheduled workflow support. Trigger.dev is optional; inline scheduling is the local/default fallback.
- Outbound workflow webhook delivery with HMAC-SHA256 signing.
- OAuth account linking for Gmail, Google Drive, Notion, and Slack.
- Manual-token lanes for Outlook, OneDrive, Dropbox, Box, Discord, Telegram, X, Mastodon, LinkedIn, and custom webhooks.
- Live outbound publish routes where implemented, with delivery receipts stored back to the integration record.
- Stripe checkout, portal, subscription sync, usage stats, seats, execution credits, video credits, and top-up packs.
- Transactional email templates, Herald signature, Resend delivery, and email event tracking.
- Veo video queue with Lite and Standard lanes, 4/6/8 second renders, Standard reference images for 8 second jobs, and asset serving.
- Staff admin control plane with RBAC, audit logs, feature flags, credit adjustments, traces, scorecards, failed-run explorer, and waitlist/referral tooling.

## Product Honesty

Prymal deliberately separates real product surface from future ambition.

| Topic | Honest Current State |
|---|---|
| SENTINEL | Internal QA layer, not a normal user-facing chat agent |
| LORE ingest | Supports pasted text, crawled URLs, `.txt`, `.md`, `.markdown`, `.csv`, `.pdf`, `.docx` |
| Drive/Notion | Account linking exists; direct document sync/ingestion should not be marketed until implemented |
| Scheduled workflows | Supported through inline scheduler by default; Trigger.dev can be configured for external orchestration |
| API keys | Real feature, gated to Agency |
| Video duration | Veo one-shot renders are limited to 4, 6, or 8 seconds |
| Video reference images | Supported only on Veo 3.1 Standard for 8 second renders |
| Media storage | Cloudinary-ready; local backend storage is only a development/single-instance fallback |
| Billing estimates | Frontend estimates are guidance; backend billing and credit burn are authoritative |

## Architecture

```text
Prymal/
  frontend/     Vite React app, public pages, protected app, tests
  backend/      Hono API, routes, services, Drizzle schema, workers
  database/     PostgreSQL + pgvector bootstrap schema and migrations
  landing/      Standalone marketing experiment
```

### Runtime Flow

```text
User request
  -> Clerk-authenticated API route
  -> org/user resolution and entitlement checks
  -> model policy selection and provider fallback chain
  -> optional LORE retrieval and memory context
  -> specialist agent execution
  -> structured output validation
  -> SENTINEL PASS / REPAIR / HOLD
  -> persisted messages, traces, usage events, and audit/product events
```

### Workflow Flow

```text
Workflow trigger
  -> manual, webhook, schedule, or event
  -> idempotency and org isolation
  -> queued workflow run
  -> inline or Trigger.dev dispatch
  -> node execution with agent contracts
  -> persisted outputs, logs, credits, traces
  -> optional signed outbound webhook delivery
```

## Plans And Entitlements

Public pricing is defined in `frontend/src/lib/constants.js`; backend enforcement is defined in `backend/src/services/billing-catalog.js`. Keep those two files aligned whenever pricing changes.
The internal checklist for this alignment lives in [docs/billing-pricing-audit.md](./docs/billing-pricing-audit.md).

| Plan | List Price | Founding Access | Execution Credits / Month | AI Video Credits / Month | Seats | Concurrent AI Runs | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| Offer Access | £0 | n/a | 50 | 0 | 1 | 1 | Offer-gated fallback access, foundational agents only |
| Solo | £49.99/mo | Time-windowed Stripe intro only | 500 | 2 | 1 | 1 | Curated starter tier, shallow LORE, light video |
| Pro | £99/mo | Time-windowed Stripe intro only | 2,000 | 5 | 1 | 3 | Full user-facing roster, medium LORE, production-friendly concurrency |
| Teams | £179/mo | Time-windowed Stripe intro only | 6,000 | 15 | 5 | 5 | Shared workspace, pooled usage, £25/mo extra seat add-on |
| Agency | From £299/mo | Time-windowed Stripe intro only | 10,000 | 25 | 25 | 8 | API keys, client-scale orchestration, priority execution |

Quarterly plans are priced at 12% off the monthly list total. Yearly plans are priced at 24% off the monthly list total. Founding Access uses explicitly configured Stripe price IDs during the founding window and then renews at standard catalog pricing after that window.

Execution credits and AI video credits are enforced separately before expensive agent, workflow, and media paths. Included monthly credits reset each billing cycle and do not roll over. Top-up packs add short-burst capacity but do not remove plan caps, fair-use controls, or concurrency limits.

### Stripe Price Mapping

Stripe uses recurring Prices for plan subscriptions and one-time Prices for credit packs. Current public checkout requires:

- Standard subscription prices: `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAMS`, `STRIPE_PRICE_AGENCY`, plus `_QUARTERLY` and `_YEARLY` variants.
- Founding Access subscription prices: `STRIPE_PRICE_FOUNDING_SOLO`, `STRIPE_PRICE_FOUNDING_PRO`, `STRIPE_PRICE_FOUNDING_TEAMS`, `STRIPE_PRICE_FOUNDING_AGENCY`, plus `_QUARTERLY` and `_YEARLY` variants.
- Preferred credit packs for new checkout: `STRIPE_PRICE_EXEC_BOOST_1000`, `STRIPE_PRICE_VIDEO_PACK_SMALL`, and `STRIPE_PRICE_VIDEO_PACK_PRO`.
- Legacy credit-pack Price IDs (`STRIPE_PRICE_EXEC_100`, `STRIPE_PRICE_EXEC_300`, `STRIPE_PRICE_EXEC_700`, `STRIPE_PRICE_VIDEO_15`, `STRIPE_PRICE_VIDEO_30`, `STRIPE_PRICE_VIDEO_100`) may remain configured for historical webhook compatibility, but should not be promoted to new users.
- Seat add-on: `STRIPE_PRICE_SEAT_ADDON` for Teams extra seats.
- Legacy Agency prices may be mapped through `STRIPE_PRICE_AGENCY_LEGACY*` for webhook grandfathering only; they must not be used for new checkout.

Live Stripe Prices for Founding Access and preferred usage packs were provisioned during the launch-readiness pass. Keep actual Price IDs in environment variables only, not in public docs or customer-facing changelog copy.

## Local Development

### 1. Database

```bash
docker compose up -d prymal-db
```

The bundled pgvector database listens on `localhost:5433`.

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/prymal
```

Docker init scripts only run when the Postgres volume is first created. If a local database is stale and you see missing table or column errors, reset it from the repo root:

```bash
docker compose down -v
docker compose up -d prymal-db
```

Then apply/verify schema from the backend:

```bash
cd backend
npm run db:migrate
npm run schema:check
npm run db:verify-local
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Useful backend checks:

```bash
npm run lint
npm test
npm run schema:check
npm run env:validate
node --check src/index.js
node --check src/routes/auth.js
node --check src/routes/agents.js
node --check src/routes/lore.js
node --check src/routes/workflows.js
node --check src/routes/integrations.js
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Useful frontend checks:

```bash
npm run lint
npm test
npm run build
npm run verify-build -- --clean
```

## Environment Variables

### Backend Essentials

- `DATABASE_URL`
- `FRONTEND_URL`
- `API_URL`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `ENCRYPTION_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` or `EMAIL_FROM`
- `REPLY_TO_EMAIL`
- `APP_URL`
- `EMAIL_LOGO_URL`, defaults to the inline CID `prymal-logo`
- `EMAIL_HERALD_AVATAR_URL`, defaults to the inline CID `herald-avatar`
- `EMAIL_EMBED_INLINE_ASSETS`, defaults to enabled for repo-hosted Prymal and Herald assets
- WARDEN: `WARDEN_ENABLED`, `WARDEN_STRICT_MODE`, `WARDEN_MAX_CONTENT_CHARS`, `WARDEN_MAX_URL_TEXT_CHARS`, `WARDEN_AUDIT_EXCERPT_CHARS`, `WARDEN_MEDIA_SAFETY_STRICTNESS`, `WARDEN_MODEL_CLASSIFIER_ENABLED`, `WARDEN_MODEL_CLASSIFIER_MODE`, `WARDEN_MODEL_CLASSIFIER_MODEL`, `WARDEN_MODEL_CLASSIFIER_TIMEOUT_MS`, `WARDEN_MODEL_CLASSIFIER_MAX_CHARS`, `WARDEN_MODEL_CLASSIFIER_CACHE_TTL_SECONDS`, `WARDEN_MODEL_CLASSIFIER_CACHE_MAX`, classifier daily call/cost caps, and OCR adapter flags. See `docs/warden-safety.md`.
- Staff access lists for internal admin users

### Backend Optional Features

- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, standard plan price IDs, Founding Access price IDs, execution/video top-up price IDs, `STRIPE_PRICE_SEAT_ADDON`
- Trigger.dev: `TRIGGER_API_KEY`, optional `TRIGGER_API_URL`
- Integrations: Google, Notion, Slack OAuth credentials; manual-token providers use encrypted stored secrets
- OAuth state: `INTEGRATION_STATE_SECRET`
- Gemini/Veo: `GEMINI_API_KEY`, model override env vars, `GEMINI_GROUNDING_ENABLED=false` for launch
- Media storage: `MEDIA_STORAGE_DRIVER`, Cloudinary credentials, retention and timeout controls
- Rate limiting: optional Upstash Redis REST URL/token
- Workflow Catalogue: `WORKFLOW_CATALOGUE_ENABLED`, `WORKFLOW_CATALOGUE_USER_SUBMISSIONS_ENABLED`, `WORKFLOW_CATALOGUE_PREMIUM_ENABLED=false`, `WORKFLOW_CATALOGUE_PLATFORM_FEE_BPS`

### Frontend Essentials

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_URL`

`VITE_API_URL` can be the backend origin, such as `http://localhost:3001`, or the full API base ending in `/api`.

## Schema Discipline

The source-of-truth rule is simple: keep `database/schema.sql` and `backend/src/db/schema.js` aligned.

Run:

```bash
cd backend
npm run schema:check
```

The check compares SQL and Drizzle table/column names as a lightweight guardrail. Migrations still need normal human review for defaults, enums, foreign keys, indexes, and triggers.

## Verification Snapshot

Current verification commands used during the latest hardening pass:

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
npm run perf:budget
```

Full end-to-end authenticated testing still requires:

- PostgreSQL + pgvector
- Valid Clerk frontend/backend keys
- A real Clerk test account/session
- Provider keys for live model, voice, media, and integration paths
- Stripe keys for live billing flows
- Optional Trigger.dev credentials for external workflow orchestration

## Release Notes

Release hardening, CI gates, branch protection recommendations, and operational caveats live in [RELEASE.md](./RELEASE.md).

Deployment guidance lives in [DEPLOY.md](./DEPLOY.md).

## Next High-Leverage Sprint

1. Replace the placeholder Clerk webhook signing secret and Resend API key in the target environment.
2. Configure Stripe webhook endpoints and complete the real checkout/webhook lifecycle proof.
3. Run authenticated Playwright against staging with dedicated user and staff accounts.
4. Record Clerk `/api/auth/me` proof and Stripe lifecycle evidence in `PRELAUNCH_QA.md`.
5. Start the first 10-25 user controlled beta using `docs/controlled-beta-runbook.md`.
6. Evaluate Gemini live grounding separately and keep it disabled until cleared for production.

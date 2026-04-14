# Prymal

Prymal is a multi-agent AI platform that gives businesses an orchestrated team of 15 specialist AI agents — each with defined contracts, output schemas, and a SENTINEL QA layer — backed by a hybrid RAG knowledge base, automated workflow engine, and a full SaaS control plane.

- 15 named agents: CIPHER, HERALD, LORE, FORGE, ATLAS, ECHO, ORACLE, VANCE, WREN, LEDGER, NEXUS, SCOUT, SAGE, PIXEL, SENTINEL
- Hybrid RAG search with authority scoring, freshness decay, and contradiction detection
- SENTINEL output review: PASS / REPAIR / HOLD verdicts with hard enforcement
- Multi-provider LLM routing: Anthropic + OpenAI + Google Gemini with policy-based fallback chains
- Outbound webhook delivery for workflow events with HMAC-SHA256 signing
- Plan-aware rate limiting with Redis fallback for multi-instance deployments
- OpenAI Realtime API WebRTC voice transcription
- Full SaaS control plane: Stripe billing, Clerk auth, team management, API keys, admin ops

## Repo layout

```text
axiom/
  backend/      Hono API, Drizzle schema, services, routes
  frontend/     Vite React app
  database/     Raw PostgreSQL bootstrap schema
  landing/      Standalone marketing HTML experiment
```

## What is implemented

### Frontend

- Public landing page, Clerk auth routes, and protected `/app` shell with onboarding redirect
- Dashboard, agent chat, LORE, workflows, integrations, settings, and staff admin surfaces
- Guided onboarding with workspace profiling and first-win recommendations
- Team settings for seats, invites, roles, membership management, and Agency-only API key management
- Shared agent constants, reusable UI primitives, and the admin component library (`AdminHero`, `AdminCommandBar`, `admin/runtime/shared.jsx`)
- `MessageArtifacts.jsx` with schema validation badges (`pass` / `repaired` / `failed`), SENTINEL verdict chips, and PIXEL image artifact rendering
- Lore workspace decomposition into `LoreDocumentInventory`, `LoreIngestPanel`, `LoreSearchPanel`, and `loreHelpers`
- Inline RAG contradiction warnings in `LoreIngestPanel` and document conflict badges in `LoreDocumentInventory`
- `voiceRuntime.js` with WebRTC capability detection, MediaRecorder transcription fallback, and OpenAI Realtime WebRTC transcription path
- SENTINEL HOLD inline notice with "Request review" button and persistent hold messages
- `ActionReceiptDrawer` with immutable admin action receipts and before/after diff rendering
- Settings decomposition into `SettingsTabPanels.jsx`
- `verify-build.mjs` for clean install -> build -> test reproducibility validation
- Playwright E2E coverage for marketing smoke, workspace smoke, settings smoke, and onboarding smoke tests
- Waitlist tab with per-row checkboxes, batch selection, and batch invite action bar
- Referral analytics tab with stat tiles, top-referrers table, and recent activity feed

### Backend

- Clerk webhook sync, local onboarding bootstrap, and org-aware auth middleware
- Role-aware team invitations, seat enforcement, and audit/product events
- Agent chat with SSE streaming, policy-based routing, and three-provider lane support (Anthropic, OpenAI, Google Gemini)
- GPT-5.4 OpenAI lanes with env-driven routing defaults, policy abstraction, fallback metadata, and optional per-org policy overrides
- Persistent LLM execution tracing for chat, workflows, realtime session token requests, and fallback chains
- Hybrid RAG search: 58% semantic + 14% lexical + 14% freshness + 14% authority scoring, with `computeFreshnessScore`, `computeAuthorityScore`, `computeContradictionSignals`, `detectKnowledgeGap`, and `checkForContradictions`
- LORE ingest, search, reindex, delete, contradiction scanning, knowledge-gap detection, and retrieval diagnostics
- Runtime contract system in `agents/runtime.js` with `getRuntimeAgentContract`, `validateContractToolUsage`, `buildRuntimeContractSummary`, and `HIGH_VALUE_AGENT_IDS`
- Output schema enforcement for all 15 agents via `SCHEMA_ENFORCED_AGENTS` in `output-schemas.js`, plus validator repair prompts/defaults
- SENTINEL HOLD gate with PASS / REPAIR / HOLD verdicts, hard response suppression on HOLD, `hold` SSE events, and `outcomeStatus: 'held'` trace recording
- Workflow create, update, toggle, run, replay, retry classification, timeout handling, idempotency, and run history routes
- Outbound workflow webhook delivery for `workflow.completed`, `workflow.failed`, `workflow.node.completed`, and `workflow.node.failed` with HMAC-SHA256 signing
- Plan-aware rate limiting on agent chat, LORE ingest, and workflow run endpoints
- OAuth integrations for Gmail, Google Drive, Notion, and Slack
- Invitation email delivery and waitlist batch invite dispatch through `email_queue`
- Stripe checkout, portal, usage stats, and webhook sync
- API key issuance and revocation
- Staff admin control plane with tiered RBAC, immutable admin action logs, feature flags, credit adjustment history, trace drilldowns, failed-run explorer, scorecards, model spend, and org timelines
- Waitlist batch invite endpoint (`POST /admin/waitlist/batch-invite`) with `email_queue` dispatch, `invited_at` updates, and admin audit logging
- Referral analytics endpoint (`GET /admin/referrals`) with stat tiles, top-referrers, and recent activity feed
- Gemini token cost estimation in `llm-observability.js`
- SENTINEL excluded from user-facing `GET /agents` response (internal-only agent)

### LORE honesty

Supported ingest types today:

- pasted text
- crawled URLs
- `.txt`
- `.md` / `.markdown`
- `.csv`
- `.pdf`
- `.docx`

## Tech stack

| Layer | Current repo reality |
|---|---|
| Frontend | Vite, React, React Router, Clerk, TanStack Query, Zustand |
| Backend | Hono on Node-compatible entrypoint, Zod |
| Database | PostgreSQL + pgvector |
| ORM | Drizzle |
| LLM | Anthropic + OpenAI + Google Gemini with policy-based routing, tracing, and eval hooks |
| Billing | Stripe |
| Long-running workflows | Trigger.dev optional; inline fallback exists for local/manual execution |

## Quick start

### 1. Database

Recommended for local development: use the bundled Docker pgvector database so it does not collide with a local PostgreSQL install.

```bash
docker compose up -d axiom-db
```

The Docker database listens on `localhost:5433`, so the matching backend connection string is:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/axiom
```

If you prefer a native PostgreSQL install instead, you must install `pgvector` on that server before running Prymal.

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Optional Bun equivalents:

```bash
bun install
bun run dev:bun
```

Useful backend scripts:

```bash
npm run db:generate
npm run db:push
npm run db:migrate
npm run worker
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The frontend defaults to `http://localhost:5173`.

For a clean lockfile install and build check:

```bash
cd frontend
npm ci
npm run build
```

For a clean-checkout reproducibility pass suitable for CI:

```bash
cd frontend
npm run verify-build
```

## Environment variables

### Backend essentials

- `DATABASE_URL`
- `FRONTEND_URL`
- `API_URL`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `ENCRYPTION_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- explicit staff access lists for internal control-plane users if you plan to use `/app/admin`

Backend env loading is now split into:

- a parse/load layer that reads `backend/.env`
- a runtime validation layer that fails fast only in `development` and `production`
- a test-safe mode that allows placeholder values and skips strict validation during `NODE_ENV=test`

### Optional backend features

- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAMS`, `STRIPE_PRICE_AGENCY`
- Trigger.dev: `TRIGGER_API_KEY`, optional `TRIGGER_API_URL`
- Integrations: Google, Notion, and Slack OAuth credentials
- Secure OAuth callback state: `INTEGRATION_STATE_SECRET`
- Invitations: `RESEND_API_KEY`, `EMAIL_FROM`, optional `INVITE_EMAIL_REPLY_TO`
- Tiered internal staff access: `STAFF_SUPPORT_*`, `STAFF_OPS_*`, `STAFF_FINANCE_*`, `STAFF_SUPERADMIN_*`
- Model lanes and overrides: `ANTHROPIC_MODEL_PREMIUM`, `ANTHROPIC_MODEL_DEFAULT`, `ANTHROPIC_MODEL_FAST`, `OPENAI_MODEL_PREMIUM`, `OPENAI_MODEL_ROUTER`, `OPENAI_MODEL_LIGHTWEIGHT`, optional `ORG_MODEL_POLICY_OVERRIDES`
- Google Gemini (optional third lane): `GEMINI_API_KEY`, `GEMINI_MODEL_FLASH` (default `gemini-2.0-flash`), `GEMINI_MODEL_PRO` (default `gemini-2.5-pro`)
- Optional model cost overrides for LLM tracing: `MODEL_COST_OVERRIDES`
- Workflow runtime controls: `WORKFLOW_NODE_TIMEOUT_MS`, `WORKFLOW_RUN_TIMEOUT_MS`, `WORKFLOW_MAX_ATTEMPTS`
- Optional distributed rate limiting: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

### Frontend essentials

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_URL`

`VITE_API_URL` can be either the backend origin, such as `http://localhost:3001`, or the full API base ending in `/api`.

## Plans and entitlements

Current plan defaults in code:

| Plan | Monthly credits | Notes |
|---|---:|---|
| `free` | 50 | limited agent access; rate limits: chat 10/min, LORE ingest 5/min, workflow runs 3/min |
| `solo` | 500 | includes LORE; rate limits: chat 30/min, LORE ingest 20/min, workflow runs 10/min |
| `pro` | 2000 | full specialist roster plus SENTINEL review eligibility; rate limits: chat 60/min, LORE ingest 50/min, workflow runs 30/min |
| `teams` | 6000 | 5 included seats, seat add-ons available, SENTINEL review eligibility, rate limits: chat 100/min, LORE ingest 100/min, workflow runs 60/min |
| `agency` | 10000 | 25-seat workspace, API keys, SENTINEL review eligibility, and unlimited plan-aware rate limits |

Credits are now enforced before expensive agent and workflow execution paths.

## Security

- All routes require org-scoped authentication via Clerk JWT
- Sensitive OAuth credentials encrypted at rest using `ENCRYPTION_KEY`
- Webhook payloads signed with HMAC-SHA256 using per-subscription secrets
- SENTINEL agent gates high-risk agent outputs before delivery
- Rate limiting on all high-traffic endpoints with plan-tiered limits
- Admin control plane requires staff role with granular permission checks
- Immutable admin action logs for all staff mutations
- `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` headers on all responses
- `X-Request-Id` propagated through all requests for tracing

## Runtime governance

- LLM execution traces are persisted for both chat and workflow runs, including provider, model, policy key, fallback usage, token estimates, latency, cost estimate, tools used, retrieval usage, memory touches, and outcome status.
- Trace metadata now captures the selected policy class, concrete model, and fallback model/provider when a lane downgrade happens.
- The policy router accepts explicit task-type hints, supports per-org override scaffolding, and keeps provider/model mapping out of feature callers so future providers can slot in with less churn.
- Staff admin actions are stored in immutable `admin_action_logs` with permission name, staff role, reason code, reason text, and target metadata.
- Workflow creation and webhook/manual triggers support idempotency via the `Idempotency-Key` header. Replay scaffolding is available for failed runs.
- Agent-output eval helpers now score groundedness, citation usage, structured output adherence, tool-policy compliance, and hallucination-risk signals. These eval summaries are attached to LLM traces for later admin analysis.
- Staff control-plane endpoints now support bounded windows and pagination for large `workflow_runs`, `product_events`, and `llm_execution_traces` datasets.
- Memory now supports richer runtime scopes: `org`, `user`, `agent_private`, `restricted`, `workflow_run`, and `temporary_session`, with provenance and expiry metadata preserved per record.
- The current model policy layer supports these policy classes:
  - `fast_chat` - Anthropic fast -> OpenAI router (`gpt-5.4-mini`) -> Gemini Flash
  - `premium_reasoning` - Anthropic premium or OpenAI premium (`gpt-5.4`)
  - `grounded_research` - OpenAI premium (`gpt-5.4`) -> Anthropic -> Gemini Pro
  - `structured_extraction` - OpenAI router (`gpt-5.4-mini`) -> Gemini Flash -> Anthropic
  - `workflow_automation` - OpenAI router (`gpt-5.4-mini`) or Anthropic specialist
  - `vision_file` - Anthropic (PDF) or OpenAI premium/image
  - `low_cost_bulk` - Gemini Flash -> OpenAI lightweight (`gpt-5.4-nano`) -> Anthropic fast

## Migrations

- `database/migrations/2026-04-05-waitlist.sql`
- `database/migrations/2026-04-06-control-plane-runtime-hardening.sql`
- `database/migrations/2026-04-06-memory-scope-expansion.sql`
- `database/migrations/2026-04-07-workflow-webhooks.sql`
- `backend/drizzle/0001_waitlist_invited_at.sql` - adds `invited_at` to `waitlist_entries`

Keep `backend/src/db/schema.js` and `database/schema.sql` in sync whenever you add future migrations.

## Verification used during this refactor

The frontend was verified with:

```bash
cd frontend
npm ci
npm run build
npm run verify-build
```

Backend source files were verified with `node --check` against the main routes, middleware, queue, and service modules.

Backend tests were verified with `npm test`.

Backend tests no longer require real provider credentials. In `NODE_ENV=test`, Prymal skips strict runtime env validation so placeholder keys can be used safely in local test runs.

Full runtime smoke testing still depends on a complete local install for:

- PostgreSQL
- Clerk session/webhook flows
- Anthropic/OpenAI live calls
- Stripe for billing flows
- optional Trigger.dev for scheduled workflows

## Current caveats

- Trigger.dev scheduling is intentionally optional; the inline scheduler is the fallback for local/manual execution.
- Gemini live grounding via `google_search_retrieval` is intentionally deferred to the final sprint.
- Avatar assets require running `frontend/scripts/generate-agent-avatars.mjs` against a live Prymal instance, or manually supplying final assets.

## Next high-leverage sprint

1. Run `generate-agent-avatars.mjs` against a live instance to produce real agent avatar assets.
2. Provision a Clerk production instance and complete the deployment checklist in `DEPLOY.md`.
3. Onboard the first 10 paying beta customers and instrument feedback via `productEvents`.
4. Gemini live grounding: add `google_search_retrieval` tool calls to the `grounded_research` policy lane for SCOUT, ORACLE, and SAGE — this is the final platform capability deferred from the main build.
5. Add Playwright authenticated CI tests once the staging environment is provisioned.

# Prymal

Prymal is a multi-agent AI platform that gives businesses an orchestrated team of 14 user-facing specialist AI agents plus the internal SENTINEL QA layer — each with defined contracts and output schemas — backed by a hybrid RAG knowledge base, automated workflow engine, and a full SaaS control plane.

- 14 user-facing agents: CIPHER, HERALD, LORE, FORGE, ATLAS, ECHO, ORACLE, VANCE, WREN, LEDGER, NEXUS, SCOUT, SAGE, PIXEL; SENTINEL runs internally as the QA gate
- Hybrid RAG search with authority scoring, freshness decay, and contradiction detection
- SENTINEL output review: PASS / REPAIR / HOLD verdicts with hard enforcement
- Multi-provider LLM routing: Anthropic + OpenAI + Google Gemini with policy-based fallback chains
- Outbound webhook delivery for workflow events with HMAC-SHA256 signing
- Plan-aware rate limiting with Redis fallback for multi-instance deployments
- OpenAI Realtime API WebRTC voice transcription
- Full SaaS control plane: Stripe billing, Clerk auth, team management, API keys, admin ops

## Repo layout

```text
Prymal/
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
- Guided `/image` and `/video` builders with modal controls for prompt, size/quality, Veo lane, duration, aspect ratio, reference images, and approximate prompt-token / credit estimates before submit
- `MessageArtifacts.jsx` with schema validation badges (`pass` / `repaired` / `failed`), SENTINEL verdict chips, and PIXEL image/video artifact rendering with Veo lane metadata
- Lore workspace decomposition into `LoreDocumentInventory`, `LoreIngestPanel`, `LoreSearchPanel`, and `loreHelpers`
- Inline RAG contradiction warnings in `LoreIngestPanel` and document conflict badges in `LoreDocumentInventory`
- `voiceRuntime.js` with WebRTC capability detection, MediaRecorder transcription fallback, and OpenAI Realtime WebRTC transcription path
- SENTINEL HOLD inline notice with "Request review" button and persistent hold messages
- `ActionReceiptDrawer` with immutable admin action receipts and before/after diff rendering
- Settings decomposition into `SettingsTabPanels.jsx`
- `verify-build.mjs` for lint -> build -> test validation, with `--clean` for clean-install reproducibility
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
- Output schema enforcement for runtime agents, including SENTINEL, via `SCHEMA_ENFORCED_AGENTS` in `output-schemas.js`, plus validator repair prompts/defaults
- SENTINEL HOLD gate with PASS / REPAIR / HOLD verdicts, hard response suppression on HOLD, `hold` SSE events, and `outcomeStatus: 'held'` trace recording
- Workflow create, update, toggle, run, replay, retry classification, timeout handling, idempotency, and run history routes
- Outbound workflow webhook delivery for `workflow.completed`, `workflow.failed`, `workflow.node.completed`, and `workflow.node.failed` with HMAC-SHA256 signing
- Plan-aware rate limiting on agent chat, LORE ingest, and workflow run endpoints
- OAuth account linking for Gmail, Google Drive, Notion, and Slack, plus manual-token lanes for Outlook, OneDrive, Dropbox, Box, Discord, Telegram, X, Mastodon, LinkedIn, and custom webhooks
- Invitation email delivery and waitlist batch invite dispatch through `email_queue`
- Stripe checkout, portal, usage stats, and webhook sync
- Deterministic execution/video credit burn with append-only ledgers, threshold tracking, top-up packs, and server-authoritative entitlement enforcement
- Veo video queue with `lite` and `standard` lanes, Standard-mode reference images for 8 second renders, and generated asset serving through the backend
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
docker compose up -d prymal-db
```

The Docker database listens on `localhost:5433`, so the matching backend connection string is:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/prymal
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
npm run lint
npm run typecheck
npm test
npm run verify
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

For the normal frontend health path:

```bash
cd frontend
npm run lint
npm test
npm run build
```

For a clean-checkout reproducibility pass suitable for CI:

```bash
cd frontend
npm run verify-build -- --clean
```

Release gating and branch protection recommendations are documented in [RELEASE.md](./RELEASE.md).

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

- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, plan price IDs, execution/video top-up price IDs, and `STRIPE_PRICE_SEAT_ADDON`
- Trigger.dev: `TRIGGER_API_KEY`, optional `TRIGGER_API_URL`
- Integrations: Google, Notion, and Slack OAuth credentials, plus manual-token linking for the expanded integrations catalog
- Secure OAuth callback state: `INTEGRATION_STATE_SECRET`
- Invitations: `RESEND_API_KEY`, `EMAIL_FROM`, optional `INVITE_EMAIL_REPLY_TO`
- Tiered internal staff access: `STAFF_SUPPORT_*`, `STAFF_OPS_*`, `STAFF_FINANCE_*`, `STAFF_SUPERADMIN_*`
- Model lanes and overrides: `ANTHROPIC_MODEL_PREMIUM`, `ANTHROPIC_MODEL_DEFAULT`, `ANTHROPIC_MODEL_FAST`, `OPENAI_MODEL_PREMIUM`, `OPENAI_MODEL_ROUTER`, `OPENAI_MODEL_LIGHTWEIGHT`, optional `ORG_MODEL_POLICY_OVERRIDES`
- Google Gemini (optional third lane): `GEMINI_API_KEY`, `GEMINI_MODEL_FLASH` (default `gemini-2.5-flash`), `GEMINI_MODEL_PRO` (default `gemini-2.5-pro`), `GEMINI_MODEL_VEO` (default `veo-3.1-lite-generate-preview`), `GEMINI_MODEL_VEO_STANDARD` (default `veo-3.1-generate-preview`), `GEMINI_GROUNDING_ENABLED=false` for launch
- Media storage: `MEDIA_STORAGE_DRIVER`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`, `VIDEO_REFERENCE_ASSET_RETENTION`, `MEDIA_ASSET_RETENTION_DAYS`, `FAILED_MEDIA_ASSET_RETENTION_DAYS`, `VIDEO_JOB_TIMEOUT_MS`, `VIDEO_JOB_POLL_INTERVAL_MS`
- Optional model cost overrides for LLM tracing: `MODEL_COST_OVERRIDES`
- Workflow runtime controls: `WORKFLOW_NODE_TIMEOUT_MS`, `WORKFLOW_RUN_TIMEOUT_MS`, `WORKFLOW_MAX_ATTEMPTS`
- Optional distributed rate limiting: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

### Frontend essentials

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_URL`

`VITE_API_URL` can be either the backend origin, such as `http://localhost:3001`, or the full API base ending in `/api`.

## Plans and entitlements

Current plan defaults in code:

| Plan | Execution credits / month | Video credits / month | Notes |
|---|---:|---:|---|
| `free` | 50 | 0 | limited agent access; rate limits: chat 10/min, LORE ingest 5/min, workflow runs 3/min |
| `solo` | 500 | 0 | includes LORE; rate limits: chat 30/min, LORE ingest 20/min, workflow runs 10/min |
| `pro` | 2000 | 10 | full specialist roster plus SENTINEL review eligibility; rate limits: chat 60/min, LORE ingest 50/min, workflow runs 30/min |
| `teams` | 6000 | 30 | 5 included seats, seat add-ons available, SENTINEL review eligibility, rate limits: chat 100/min, LORE ingest 100/min, workflow runs 60/min |
| `agency` | 10000 | 60 | 25-seat workspace, API keys, SENTINEL review eligibility, and unlimited plan-aware rate limits |

Execution credits and AI video credits are enforced separately before expensive agent, workflow, and media-generation paths.

Video-generation rules currently implemented in code:

- `/video` supports two server-authoritative lanes: `lite` (Veo 3.1 Lite) and `standard` (Veo 3.1 Standard)
- current Veo durations are limited to `4`, `6`, or `8` seconds
- Standard-mode reference images are supported for `8` second renders only
- Lite is the lower-credit draft lane; Standard is the higher-credit, higher-quality lane
- generated images, generated videos, and video reference images use Cloudinary in beta/production and local storage only as a development fallback
- if video generation is enabled in a live-like environment, Cloudinary must be configured unless `ALLOW_LOCAL_MEDIA_STORAGE_IN_PRODUCTION=true` is explicitly set
- UI token and credit previews are approximate guidance only; final billing stays server-side authoritative

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
  - `premium_reasoning` - Anthropic premium (`claude-opus-4-7`) or OpenAI premium (`gpt-5.4`)
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
- `database/migrations/2026-04-23-billing-credit-schema.sql`
- `backend/drizzle/0001_waitlist_invited_at.sql` - adds `invited_at` to `waitlist_entries`
- `backend/drizzle/0002_billing_credit_schema.sql` - adds subscriptions, ledgers, usage events, and threshold state tables

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
- Gemini live grounding via Google Search remains intentionally deferred and disabled by default; do not enable `GEMINI_GROUNDING_ENABLED` until the provider/tooling path is explicitly cleared for production.
- Final WebP avatar assets for all 15 agents are committed under `frontend/src/assets/agents/`.
- Generated video outputs and uploaded video reference images currently live on backend-local storage under `backend/storage/`. Single-instance deploys are the honest default until shared object storage is added.

## Next high-leverage sprint

1. Provision Clerk production and staging applications, then complete the deployment checklist in `DEPLOY.md`.
2. Configure Stripe live prices/webhooks when billing is ready to accept production payments.
3. Run authenticated Playwright against staging with the dedicated role accounts.
4. Onboard the first 10 paying beta customers and instrument feedback via `productEvents`.
5. Evaluate Gemini live grounding separately after launch; keep it disabled by default until then.

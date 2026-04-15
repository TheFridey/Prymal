# AGENTS.md

Guidance for future coding agents working inside this AXIOM repository.

## Core rules

1. Keep `database/schema.sql` and `backend/src/db/schema.js` aligned.
2. Clerk-linked user identifiers are text values, not UUIDs.
3. Preserve tenant isolation on every route, query, workflow run, memory write, and integration.
4. Do not claim a feature in the UI or docs unless the backend actually implements it.
5. Verify frontend imports and route wiring before finalising any UI change.

## Repo map

- `frontend/`: Vite React app
- `backend/`: Hono API, routes, services, Drizzle schema
- `database/`: raw SQL bootstrap schema
- `landing/`: standalone static marketing experiment

## Local run commands

### Frontend

```bash
cd frontend
npm install
npm run dev
npm exec vite build
```

### Backend

```bash
cd backend
npm install
npm run dev
```

Useful backend validation:

```bash
node --check src/index.js
node --check src/routes/auth.js
node --check src/routes/agents.js
node --check src/routes/lore.js
node --check src/routes/workflows.js
```

## Schema discipline

- Any change to organisations, users, integrations, workflows, memory, API keys, or LORE tables must be reflected in both SQL and Drizzle.
- Re-check defaults, enum values, foreign keys, and update triggers whenever schema changes.
- If you add a new user-linked column, keep it text-compatible when it stores Clerk IDs.

## Tenant isolation expectations

- Every org-owned read must filter by `orgId`.
- Every conversation, workflow, integration, document, and memory write must remain org-scoped.
- Never trust a client-provided org identifier without server-side user/org resolution.

## Product honesty

- LORE currently supports pasted text, crawled URLs, `.txt`, `.md`, `.markdown`, and `.csv`.
- Trigger.dev is optional. Scheduled workflows must not be presented as active unless Trigger.dev is configured.
- API keys are real and Agency-only.
- Do not reintroduce fictional integrations or unsupported ingestion types in the UI.

## Frontend conventions

- Shared agent metadata lives in `frontend/src/lib/constants.js`.
- Reuse shared primitives from `frontend/src/components/ui.jsx` before adding more page-local UI wrappers.
- Prefer route-safe flows:
  - `/`
  - `/login`
  - `/signup`
  - `/app/onboarding`
  - `/app/*`

## Backend conventions

- Prefer parameterised Drizzle queries over raw SQL.
- Keep route payloads validated with Zod where practical.
- If a dependency is only needed for an optional feature, avoid eager startup imports when possible.

## Docs and env files

- Keep `README.md` honest.
- Keep `frontend/.env.example` and `backend/.env.example` current when adding or removing env vars.
- If a feature is partial, either finish it or narrow the docs and UI language immediately.

## Cursor Cloud specific instructions

### Services overview

| Service | Port | Start command |
|---------|------|---------------|
| PostgreSQL + pgvector | 5433 | `docker compose up -d axiom-db` (from repo root) |
| Backend (Hono API) | 3001 | `cd backend && npm run dev` |
| Frontend (Vite React) | 5173 | `cd frontend && npm run dev` |

### Startup sequence

1. Start Docker and the database: `docker compose up -d axiom-db` (waits ~5s for healthcheck).
2. Backend: `cd backend && npm run dev` — requires non-placeholder values for `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `ANTHROPIC_API_KEY`, and `OPENAI_API_KEY` in `backend/.env`. Copy from `.env.example` and replace placeholders. Without real keys, the server starts but auth and LLM calls will fail.
3. Frontend: `cd frontend && npm run dev` — uses `.env` copied from `.env.example`.

### Testing

- **Backend unit tests:** `cd backend && NODE_ENV=test node --test src/**/*.test.js` (130 tests; `NODE_ENV=test` skips strict env validation so placeholder keys work). Note: `npm test` runs `node --test src` which tries to load all `.js` files including non-test source; prefer the glob pattern above.
- **Backend syntax check:** `cd backend && node --check src/index.js` (and other route files per "Local run commands" above).
- **Frontend unit tests:** `cd frontend && npx vitest run` (6 tests).
- **Frontend build:** `cd frontend && npx vite build`.
- **Frontend E2E:** `cd frontend && npx playwright test` (requires Playwright browsers installed; run `npx playwright install --with-deps chromium` first).
- No dedicated lint script exists in either `package.json`.

### Gotchas

- The `frontend/node_modules` directory sometimes gets a broken rollup native binary on first `npm install`. If `vite build` fails with "Cannot find module @rollup/rollup-linux-x64-gnu", delete `node_modules` and `package-lock.json`, then re-run `npm install`.
- The database schema is auto-seeded from `database/schema.sql` on first `docker compose up`. Subsequent migrations in `database/migrations/` may need manual application.
- The backend validates certain env vars at startup and will crash if they contain placeholder patterns (`xxxx`, `your_`, `placeholder`). Set them to any non-placeholder string for local dev without real provider access.

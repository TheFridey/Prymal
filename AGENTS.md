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
|---|---|---|
| PostgreSQL + pgvector | 5433 | `sudo dockerd` then `docker compose up -d axiom-db` (from repo root) |
| Backend (Hono) | 3001 | `cd backend && npm run dev` |
| Frontend (Vite) | 5173 | `cd frontend && npm run dev` |

### Gotchas

- **Docker-in-Docker**: The cloud VM is a container inside Firecracker. Docker requires `fuse-overlayfs` as storage driver and `iptables-legacy`. These are pre-configured in the snapshot; just run `sudo dockerd &` before `docker compose up`.
- **Frontend platform deps**: `package.json` lists Windows-only optional rollup/esbuild binaries. Use `npm install --force` to skip platform checks, then ensure `@rollup/rollup-linux-x64-gnu` is present (the update script handles this).
- **ENCRYPTION_KEY**: The backend validates this is a 64-character hex string. If a system-level env var overrides the `.env` file value (dotenv doesn't override existing vars), the backend logs a warning but still starts. Generate a fresh key with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and set it in `backend/.env`.
- **Clerk auth**: All `/api/*` routes (except Clerk webhooks) require a valid Clerk JWT. Without real Clerk keys, authenticated flows cannot be tested end-to-end; the landing page and login page still render.
- **Backend tests**: Run with `NODE_ENV=test npm test` — this skips strict env validation and allows placeholder API keys.
- **Frontend tests**: `npm test` (Vitest unit tests) and `npm run test:e2e` (Playwright). E2E tests build the app first.
- **Database migrations**: The Docker init script loads `database/schema.sql` on first container start. Additional migrations in `database/migrations/` should be applied manually with `docker exec -i axiom-db psql -U postgres -d axiom < database/migrations/<file>.sql`.
- **Env var precedence**: System-level env vars (injected secrets) take precedence over `backend/.env` because dotenv does not override existing vars. Use `sed` to update `.env` files, but be aware that secrets injected into the VM environment will always win. The backend startup warnings about placeholder keys reflect the `.env` file values, not necessarily the runtime values.
- **Clerk signup flow**: Clerk enforces email verification and CAPTCHA. To do a full end-to-end authenticated test, you need either a real email or a pre-existing test account. Google OAuth is also available on the sign-in page.

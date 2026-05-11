# Dev Certification

Prymal supports a development-only certification pass without switching localhost URLs, Clerk test mode, or other dev runtime assumptions.

## Commands

From the repo root:

```bash
npm run certify:dev
```

Frontend only:

```bash
cd frontend
npm run test:e2e:public
npm run test:e2e:dev
npm run test:e2e:auth:check
npm run test:e2e:auth
```

Backend only:

```bash
cd backend
npm run dev:evidence
npm run dev:fixtures
npm run test:workflow:db
npm run beta:evidence
```

## Playwright Modes

- `test:e2e:public`: local public smoke only.
- `test:e2e:dev`: local preview + localhost API, auth suites skip when credentials are absent.
- `test:e2e:auth:check`: validates that localhost QA auth is configured without printing passwords.
- `test:e2e:auth`: strict authenticated run. Missing required auth roles fail fast.

`test:e2e:dev` is the default safe local certification path.

## Local QA Auth

Authenticated browser proof stays optional for normal dev certification until you fill the local-only `.env.playwright` file with Clerk test users.

1. Copy the role layout from [.env.playwright.example](/abs/path/C:/Users/rhysl/OneDrive/Documents/GitHub/Prymal/.env.playwright.example:1) into your ignored `.env.playwright`.
2. Use Clerk test users only. Do not place production credentials here.
3. Run `cd backend && npm run dev:fixtures` to provision the local QA users, orgs, workflow/action/billing evidence, and admin-visible trace data.
4. Run `cd frontend && npm run test:e2e:auth:check`.
5. Run `cd frontend && npm run test:e2e:auth`.

The expected local QA roles are:

- `PLAYWRIGHT_TEST_USER_*`: owner of the main localhost QA workspace.
- `PLAYWRIGHT_TEST_STAFF_*`: staff user already recognised by `STAFF_EMAILS` or the staff allowlists.
- `PLAYWRIGHT_TEST_INVITEE_*`: user with no org membership before the invite flow.
- `PLAYWRIGHT_TEST_ONBOARDING_*`: user with no org membership before first-run onboarding.
- `PLAYWRIGHT_TEST_BILLING_*`: owner of a paid local QA workspace used for safe billing/settings proof.

## Evidence

`backend/scripts/dev-evidence.mjs` creates tagged dev-safe evidence rows using:

- billing reservation / commit / release flows
- WARDEN audit writes
- action approval lifecycle writes
- seeded workflow run and replay visibility rows
- mocked-local video success / failure paths through the real billing and job code

Seeded rows are tagged with:

- `metadata.devCertification=true`
- `metadata.scriptRunId=<timestamped run id>`

Use `npm run beta:evidence` afterwards to inspect what was created.

`backend/scripts/dev-fixtures.mjs` seeds the localhost QA identities and authenticated browser fixtures using:

- Clerk test users from your local `.env.playwright`
- a primary QA workspace for owner + staff flows
- a separate paid QA billing workspace
- seeded conversation + LORE document rows
- seeded workflow runs, WARDEN audit rows, traces, billing lifecycle events, and action approvals

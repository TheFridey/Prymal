# Prymal pre-launch QA checklist

Run this before the first production launch (e.g. beta on 8 May). Auth flows need real Clerk keys unless noted.

## Account and onboarding

- Sign up with a fresh email; complete email verification if required.
- Sign in from a “new device” if applicable; complete Clerk OTP if enforced.
- Complete `/app/onboarding`; confirm recommended agents look sensible for the answers you picked.
- Confirm redirect lands on dashboard with no console errors.

## Billing (Stripe test mode locally; live mode in staging)

- Start checkout from Settings → Billing; complete with a test card (`4242`… where supported).
- Confirm plan and credits update in the UI after webhook sync (may take a refresh).
- Open the customer portal (manage subscription / payment method) and return to the app without broken state.
- Optional: purchase or verify a credit pack if that path is enabled for the org.

## First agent response

- Open a recommended agent from the dashboard “Get your first win” or agent strip.
- Send a short request; confirm streaming, then a completed assistant message.
- Trigger an error (e.g. disconnect network mid-stream); confirm the inline error is readable and “Retry” behaves.
- Optional: trigger a SENTINEL hold (sensitive or underspecified request); confirm hold copy and “Request review” path.

## LORE

- Upload or paste a small text note; confirm “queued / indexing” status and eventual “Ready”.
- Open the LORE agent; ask a question that should cite uploaded content; confirm sources appear when indexed.
- Delete a document; confirm it disappears from inventory and search.

## Memory Centre

- Confirm at least one memory row appears after enough agent use (or save flow if exposed).
- Edit a field; confirm success toast and persistence after refresh.
- Use forget/delete on a non-critical memory; confirm it is removed.

## Workflows (NEXUS)

- Open the workflow builder from a featured template.
- Save a workflow; toggle active if you use schedules — note Trigger.dev is optional per `AGENTS.md`.
- Queue a manual run; confirm run completes or fails with a clear message and credits behaviour.

## Media (plan-limited)

- **Image:** complete one guided image generation from the workspace (if your plan includes it).
- **Video:** enqueue a short Veo job (4/6/8s as supported); poll until complete or failure; confirm messaging and credit release on failure.

## Mobile / responsive (Chrome devtools or real device)

- Dashboard, agent chat, Memory, LORE, workflows, settings: no clipped primary CTAs; chat composer usable.

## Failure and credit edge cases

- Force insufficient credits (or use a capped test org); confirm upgrade / top-up messaging without raw API errors.
- Simulate or wait for provider outage; confirm user-facing message does not expose stack traces.

## Product events (optional operator check)

- In admin or DB, confirm milestones such as `first_agent_message_sent`, `first_win.completed`, `workflow.run_completed` appear for test users (no PII in notes).

## Playwright (CI / local)

- `cd frontend && npm exec playwright test` (requires built preview; see `playwright.config.js`). Unauthenticated marketing tests should pass without Clerk; authenticated tests need `PLAYWRIGHT_*` env from `tests/helpers/auth`.

Document any environment-specific skips (e.g. Clerk CAPTCHA, Stripe live keys) in your deploy notes.

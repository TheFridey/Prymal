# Controlled Beta Runbook

Use this for the first 10-25 Prymal beta users. The goal is to prove onboarding, value delivery, usage economics, and support response before widening access.

## Entry Criteria

- `backend npm run env:validate` passes for the target environment.
- Clerk `/api/auth/me` proof is recorded in `PRELAUNCH_QA.md`.
- Stripe test-mode lifecycle proof is recorded in `PRELAUNCH_QA.md`.
- Cloudinary is configured for generated media in staging/production, with local fallback disabled unless a named break-glass override is active.
- Public pricing and docs match `backend/src/services/billing-catalog.js`.

## Onboarding Process

1. Invite users manually in batches of 3-5.
2. Confirm their intended use case before account creation: content, website audit, lead generation, reporting, or support prep.
3. Have the user complete signup, onboarding, and first workspace setup on a call.
4. Confirm `/api/auth/me` returns user and org context for the account.
5. Start with Simple Mode unless the user already has a repeatable workflow mapped.

## First Task Recommendation

Default first win:

- “Build me a 30-day content strategy”

Alternatives:

- “Audit my website”
- “Create a lead generation workflow for agencies”
- “Summarise this knowledge base and suggest next actions”

Success means the user leaves the first session with a useful output, not just a tour.

## Call Checklist

- Confirm the user understands execution credits and AI video credits.
- Show where usage and billing live in Settings.
- Run one guided task live.
- Ask the user to rate output usefulness from 1-5.
- Ask what they would normally have done manually.
- Capture whether the output was ready-to-use, needed light edits, or missed the mark.
- Note any trust concerns around memory, validation, billing, or workflow control.

## Daily Metrics

Track every beta day:

- New activated users and workspaces.
- First task completion rate.
- Time from signup to first useful output.
- Execution credits consumed per workspace.
- AI video credits consumed per workspace.
- Provider-cost estimate by workspace.
- Usage pressure level distribution.
- Failed runs, held SENTINEL outputs, and repaired outputs.
- Support tickets or call follow-ups.

## Usage Economics Monitoring

- Review admin economics daily during the beta.
- Compare current-cycle estimated burn against internal cap by plan.
- Watch top users and workspaces for unexpected loops or runaway workflows.
- Verify execution and video usage are separated.
- Confirm add-on purchases increase the correct balance.
- Pause expansion if a plan consistently approaches internal burn cap before value is proven.

## Cap Handling

- Do not loosen caps during beta without a written decision.
- If a user hits a soft pressure warning, explain usage and suggest a smaller workflow or add-on.
- If a user hits a hard block, verify ledger state before support intervention.
- Do not grant hidden unlimited access. Use explicit credits, plan changes, or documented beta concessions.

## Feedback Collection

Use one shared feedback log with:

- User, company, plan, and workspace ID.
- First task chosen.
- Outcome quality score.
- Manual time saved estimate.
- Missing context or memory issue.
- Validation or trust issue.
- Billing/usage confusion.
- Requested workflow or integration.
- Follow-up owner and date.

## Expansion Criteria

Move from 10-25 users to the next beta cohort only when:

- At least 70% complete a first useful output.
- No unresolved auth or billing blocker remains.
- No public copy implies unlimited usage.
- Usage economics stay within expected burn bands.
- Media assets persist in the target storage provider.
- Support load is manageable within the current team process.

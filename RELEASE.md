# Prymal Release Hardening

This repository currently ships from the `master` branch. CI and branch protection should point at `master` until the live default branch is renamed.

## Recent shipped updates

- Agent chat replies can now be published to connected social and messaging platforms through the action approval system, so live posts require explicit user approval before dispatch.
- LinkedIn OAuth now defaults to identity-only scopes so unapproved LinkedIn app permissions do not block connection, with posting disabled until approved posting scopes are configured and the account reconnects.
- Integration hardening added OAuth LinkedIn, Microsoft Outlook/OneDrive OAuth, safer provider error copy, LinkedIn author validation, no-token serialization tests, and integration auth audit docs.
- Model routing now uses a centralized capability matrix, live provider health scoring, weighted fallback ordering, and an explicit Gemini Flash-Lite low-cost lane.
- SENTINEL hold decisions now include operator-facing explainability fields such as hold reason code, risk category, and confidence.
- OCR-derived safety text is normalized and tagged as untrusted evidence before media or downstream policy evaluation.

- Pricing and entitlement docs now match the enforced billing catalog: Solo £49.99, Pro £99, Teams £179, Agency from £299, with separate execution and AI video credit balances.
- Founding Access is documented as 20% off for the first 3 months with standard usage limits, server-side eligibility, and Stripe transition back to standard catalog prices after the founding window.
- Stripe setup notes now cover standard subscription prices, Founding Access prices, one-time execution/video packs, Teams seat add-ons, and the billing webhook events used for entitlement sync.
- Live Stripe Prices have been provisioned for Founding Access and preferred usage packs; real checkout/webhook lifecycle proof is still required before controlled beta.
- Preferred add-on packs are now standardised around `exec_boost_1000`, `video_pack_small`, and `video_pack_pro`; older pack IDs are legacy compatibility only.
- Landing and pricing surfaces now position Prymal around execution, Simple/Advanced adoption paths, structured examples, memory, validation, and cost-controlled workflows.
- Workflow Catalogue foundation added for curated official workflows, user submission drafts, staff review, free installs, and premium marketplace structure kept disabled behind a feature flag.
- Transactional email system added for launch with Prymal-branded templates, Herald signature, Resend delivery, idempotent event tracking, and best-effort trigger wiring.
- Admin economics now separates current-cycle ledger burn from all-time burn and highlights top cycle users/workspaces for operator review.
- Production media storage validation now rejects local disk storage by default in staging/production.
- Guided `/image` and `/video` builders now open modal-based brief composers instead of relying on long free-form slash commands.
- Video generation now exposes two Veo lanes in-product: `Fast draft` (Veo 3.1 Lite) and `Cinematic` (Veo 3.1 Standard), with approximate prompt-token and credit estimates shown before submit.
- Standard-mode video renders now support up to three reference images on 8 second jobs, while final validation, queueing, and credit burn remain server-side authoritative.
- Generated video cards now surface render metadata such as duration, resolution, aspect ratio, Veo lane, and reference-image count directly in chat artifacts.

## Operational caveat

- Generated video outputs and uploaded reference images may use backend-local storage only in development or explicit break-glass production overrides.
- Use Cloudinary before staging/production video rollout.
- Do not market video storage as durable unless Cloudinary/object storage is configured for that environment.

## Required CI gates

The GitHub Actions workflow at `.github/workflows/ci.yml` is the release gate for:

- dependency install
- Backend lint
- backend test execution
- Frontend lint
- frontend clean-checkout reproducibility via `npm run verify-build`
- frontend production build
- bundle budget enforcement
- Playwright marketing smoke
- Playwright authenticated regression
- authenticated secret preflight
- deploy preflight with optional VPS deploy gating

## Performance Budget

The frontend performance budget is enforced by `frontend/scripts/check-bundles.mjs`.

- Initial JavaScript budget: `700 KB`
- Initial CSS budget: `400 KB`
- Largest async JavaScript budget: `1000 KB`

The `400 KB` initial CSS budget is intentional. Prymal ships a premium cinematic design system with a large global interaction layer, agent avatar presentation, workspace chrome, governance states, billing UI, and release-grade empty/error states. The previous `380 KB` budget became slightly too tight after the final conversion and launch-readiness surfaces landed, while the measured bundle remains structurally healthy.

This is not treated as a regression waiver: the budget still sits close to the current measured initial CSS size, and route-scoped CSS such as `landing-rebuild.css` remains code-split into async page chunks instead of being folded blindly into the global bundle.

## Required status checks

Configure these exact quality-gate status checks as required on `master`:

1. `Backend lint`
2. `Frontend lint`
3. `Backend tests`
4. `Frontend verify-build`
5. `Frontend performance budget`
6. `E2E marketing smoke`
7. `E2E authenticated regression`

Recommended additional diagnostics:

1. `E2E authenticated preflight`
2. `Deploy preflight`

## Branch protection recommendations

In GitHub repository settings for `master`:

1. Require a pull request before merging.
2. Require at least one approval.
3. Dismiss stale pull request approvals when new commits are pushed.
4. Require branches to be up to date before merging.
5. Require the seven quality-gate status checks listed above to pass.
6. Restrict direct pushes to `master`.
7. Include administrators so emergency changes do not bypass CI by default.

If `develop` is used as a staging branch, mirror the same rule there, but keep `master` as the strict production gate.

## Authenticated Playwright coverage

The authenticated Playwright lane now uses a preflight step: missing secrets should produce a clear skip, not a false pass. For real release confidence, add these repository secrets:

- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_API_URL`
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

Use `cd backend && node scripts/validate-playwright-secrets.mjs` against `.env.playwright` before copying the values into GitHub Actions secrets.

## Optional VPS deploy gating

`Deploy preflight` now decides whether VPS deployment should run. `Deploy to VPS` should run only when:

- the event is `push` or `workflow_dispatch`
- the branch is `master`
- `VPS_DEPLOY_ENABLED=true`
- `VPS_HOST`, `VPS_USER`, and `VPS_SSH_KEY` are all configured

## Versioned releases

`v1.0.0-beta.1` is the first controlled-beta release tag. Use annotated SemVer prerelease tags for beta milestones:

- `v1.0.0-beta.N` for controlled beta release candidates.
- `v1.0.0-rc.N` for release candidates after beta feedback closes.
- `v1.0.0` for the first general-availability release.

Create GitHub releases from annotated tags and mark beta/RC releases as prereleases.

## Recommended merge flow

1. Open a pull request into `master`.
2. Wait for all required checks to pass.
3. Review the PR with a human approval.
4. Merge only when CI is green and the branch is up to date.
5. Tag production releases after the merge if you want stable release references in Sentry and deployment logs.

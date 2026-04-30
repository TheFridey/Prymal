# Prymal Release Hardening

This repository currently ships from the `master` branch. CI and branch protection should point at `master` until the live default branch is renamed.

## Recent shipped updates

- Pricing and entitlement docs now match the enforced billing catalog: Solo £49.99, Pro £99, Teams £179, Agency from £299, with separate execution and AI video credit balances.
- Founding Access is documented as 20% off for the first 3 months with standard usage limits, server-side eligibility, and Stripe transition back to standard catalog prices after the founding window.
- Stripe setup notes now cover standard subscription prices, Founding Access prices, one-time execution/video packs, Teams seat add-ons, and the billing webhook events used for entitlement sync.
- Live Stripe Prices have been provisioned for Founding Access and preferred usage packs; real checkout/webhook lifecycle proof is still required before controlled beta.
- Preferred add-on packs are now standardised around `exec_boost_1000`, `video_pack_small`, and `video_pack_pro`; older pack IDs are legacy compatibility only.
- Landing and pricing surfaces now position Prymal around execution, Simple/Advanced adoption paths, structured examples, memory, validation, and cost-controlled workflows.
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
- backend lint
- backend test execution
- frontend lint
- frontend clean-checkout reproducibility via `npm run verify-build`
- frontend production build
- bundle budget enforcement
- Playwright marketing smoke
- Playwright authenticated regression

## Performance Budget

The frontend performance budget is enforced by `frontend/scripts/check-bundles.mjs`.

- Initial JavaScript budget: `700 KB`
- Initial CSS budget: `400 KB`
- Largest async JavaScript budget: `1000 KB`

The `400 KB` initial CSS budget is intentional. Prymal ships a premium cinematic design system with a large global interaction layer, agent avatar presentation, workspace chrome, governance states, billing UI, and release-grade empty/error states. The previous `380 KB` budget became slightly too tight after the final conversion and launch-readiness surfaces landed, while the measured bundle remains structurally healthy.

This is not treated as a regression waiver: the budget still sits close to the current measured initial CSS size, and route-scoped CSS such as `landing-rebuild.css` remains code-split into async page chunks instead of being folded blindly into the global bundle.

## Required status checks

Configure these exact GitHub status checks as required on `master`:

1. `Backend tests`
2. `Frontend verify-build`
3. `Frontend performance budget`
4. `E2E marketing smoke`
5. `E2E authenticated regression`

## Branch protection recommendations

In GitHub repository settings for `master`:

1. Require a pull request before merging.
2. Require at least one approval.
3. Dismiss stale pull request approvals when new commits are pushed.
4. Require branches to be up to date before merging.
5. Require the five status checks listed above to pass.
6. Restrict direct pushes to `master`.
7. Include administrators so emergency changes do not bypass CI by default.

If `develop` is used as a staging branch, mirror the same rule there, but keep `master` as the strict production gate.

## Authenticated Playwright coverage

The authenticated Playwright job is safe to run without secrets because the tests skip gracefully when credentials are missing. For real release confidence, add these repository secrets:

- `PLAYWRIGHT_TEST_USER_EMAIL`
- `PLAYWRIGHT_TEST_USER_PASSWORD`
- `PLAYWRIGHT_TEST_STAFF_EMAIL`
- `PLAYWRIGHT_TEST_STAFF_PASSWORD`

Until those secrets are configured, `E2E authenticated regression` will stay green but only prove that the authenticated suites bootstrap and skip correctly. Staff-only admin/operator flows skip independently when staff credentials are not present.

## Recommended merge flow

1. Open a pull request into `master`.
2. Wait for all required checks to pass.
3. Review the PR with a human approval.
4. Merge only when CI is green and the branch is up to date.
5. Tag production releases after the merge if you want stable release references in Sentry and deployment logs.

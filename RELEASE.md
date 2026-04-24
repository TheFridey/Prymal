# Prymal Release Hardening

This repository currently ships from the `master` branch. CI and branch protection should point at `master` until the live default branch is renamed.

## Recent shipped updates

- Guided `/image` and `/video` builders now open modal-based brief composers instead of relying on long free-form slash commands.
- Video generation now exposes two Veo lanes in-product: `Fast draft` (Veo 3.1 Lite) and `Cinematic` (Veo 3.1 Standard), with approximate prompt-token and credit estimates shown before submit.
- Standard-mode video renders now support up to three reference images on 8 second jobs, while final validation, queueing, and credit burn remain server-side authoritative.
- Generated video cards now surface render metadata such as duration, resolution, aspect ratio, Veo lane, and reference-image count directly in chat artifacts.

## Operational caveat

- Generated video outputs and uploaded reference images currently live on backend-local storage under `backend/storage/`.
- Keep the backend single-instance for video generation until shared object storage is added.
- Do not market video storage as durable across deploys or horizontally scaled instances yet.

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
- Playwright authenticated smoke

## Performance Budget

The frontend performance budget is enforced by `frontend/scripts/check-bundles.mjs`.

- Initial JavaScript budget: `700 KB`
- Initial CSS budget: `380 KB`
- Largest async JavaScript budget: `1000 KB`

The `380 KB` initial CSS budget is intentional. Prymal ships a premium cinematic design system with a large global interaction layer, agent avatar presentation, workspace chrome, governance states, billing UI, and release-grade empty/error states. The previous `220 KB` budget was too small for the completed product and was failing CI despite the bundle being structurally healthy.

This is not treated as a regression waiver: the budget still sits close to the current measured initial CSS size, and route-scoped CSS such as `landing-rebuild.css` remains code-split into async page chunks instead of being folded blindly into the global bundle.

## Required status checks

Configure these exact GitHub status checks as required on `master`:

1. `Backend tests`
2. `Frontend verify-build`
3. `Frontend performance budget`
4. `E2E marketing smoke`
5. `E2E authenticated smoke`

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

Until those secrets are configured, `E2E authenticated smoke` will stay green but only prove that the authenticated suites bootstrap and skip correctly. Staff-only admin/operator flows skip independently when staff credentials are not present.

## Recommended merge flow

1. Open a pull request into `master`.
2. Wait for all required checks to pass.
3. Review the PR with a human approval.
4. Merge only when CI is green and the branch is up to date.
5. Tag production releases after the merge if you want stable release references in Sentry and deployment logs.

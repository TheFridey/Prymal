# Prymal Release Hardening

This repository currently ships from the `master` branch. CI and branch protection should point at `master` until the live default branch is renamed.

## Required CI gates

The GitHub Actions workflow at `.github/workflows/ci.yml` is the release gate for:

- dependency install
- backend test execution
- frontend clean-checkout reproducibility via `npm run verify-build`
- frontend production build
- bundle budget enforcement
- Playwright marketing smoke
- Playwright authenticated smoke

`lint` is intentionally not a required check yet because the repo does not currently expose a stable `npm run lint` script in either workspace. Add lint as a required gate only after a real lint command exists and passes locally.

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

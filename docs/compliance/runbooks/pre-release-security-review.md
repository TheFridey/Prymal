# Pre-Release Security Review

## Objective

Ensure a release candidate meets Prymal's minimum production security bar before deployment.

## When To Run

Before every production release.

## Commands / Evidence To Collect

```bash
cd backend
npm run lint
npm test
npm run schema:check
NODE_ENV=production npm run env:validate
npm run security:preflight

cd ../frontend
npm run build
npm audit --omit=dev
```

- record release commit hash
- note any accepted exceptions or manual follow-up tasks

## Pass / Fail Criteria

- Pass: required checks pass or expected local-only failures are understood and documented
- Fail: failing security checks, unknown audit findings, or missing rollback plan

## Output Evidence File Naming

`YYYY-MM-pre-release-security-review.evidence.local.md`

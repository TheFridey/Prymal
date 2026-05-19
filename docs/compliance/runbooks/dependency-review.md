# Dependency Review

## Objective

Review backend and frontend production dependencies for security issues and update decisions.

## When To Run

Monthly and before any public release.

## Commands / Evidence To Collect

```bash
cd backend
npm audit --omit=dev

cd ../frontend
npm audit --omit=dev
```

- update `docs/compliance/registers/vulnerability-register.md`
- capture notes on any accepted residual risks

## Pass / Fail Criteria

- Pass: no untracked high/critical findings, or explicit documented risk acceptance exists
- Fail: unresolved high/critical findings with no documented treatment

## Output Evidence File Naming

`YYYY-MM-dependency-review.audit.local.md`

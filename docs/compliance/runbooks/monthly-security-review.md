# Monthly Security Review

## Objective

Review Prymal's current production security posture, open vulnerabilities, and recent operational changes.

## When To Run

Monthly, and after any significant production incident.

## Commands / Evidence To Collect

```bash
cd backend
npm audit --omit=dev
npm run compliance:evidence
```

- latest vulnerability register entries
- latest deploy/change records
- screenshots of webhook health if issues occurred

## Pass / Fail Criteria

- Pass: no untracked high/critical findings, review completed, actions assigned
- Fail: unresolved high/critical issues without owner or timeline

## Output Evidence File Naming

`YYYY-MM-monthly-security-review.evidence.local.md`

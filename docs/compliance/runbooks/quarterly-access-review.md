# Quarterly Access Review

## Objective

Confirm that only the right people retain access to Prymal systems and admin consoles.

## When To Run

Quarterly and after any staff or contractor change.

## Commands / Evidence To Collect

- review GitHub admins and collaborators
- review VPS SSH users and `authorized_keys`
- review Clerk, Stripe, Cloudflare, Cloudinary, Resend, OpenAI, Anthropic, VPS provider, and registrar access
- collect or refresh MFA screenshots

## Pass / Fail Criteria

- Pass: all access is justified, MFA enabled, stale access removed
- Fail: orphaned access, missing MFA, or unclear ownership remains

## Output Evidence File Naming

`YYYY-MM-quarterly-access-review.evidence.local.md`

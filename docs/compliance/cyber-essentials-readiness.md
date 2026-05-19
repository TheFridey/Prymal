# Cyber Essentials Readiness

This document maps Prymal's current repo controls and required operator controls against the five Cyber Essentials themes. It is a readiness starter, not a final certification claim.

## 1. Firewalls

What Prymal/repo covers:

- backend is designed to sit behind nginx on localhost
- CORS allowlists are explicit in live environments
- production docs assume Cloudflare in front of nginx

Operator must evidence:

- UFW default deny incoming
- only `22`, `80`, and `443` open
- PostgreSQL and any Redis service not publicly exposed
- Cloudflare orange-cloud proxy and Full (strict) mode

Pass/fail checklist:

- [ ] UFW enabled
- [ ] inbound default deny confirmed
- [ ] public listening ports limited to 22/80/443
- [ ] backend reachable only through nginx
- [ ] database not internet-facing

Screenshot/evidence list:

- `sudo ufw status verbose`
- `ss -tulpn`
- Cloudflare SSL/TLS mode screenshot
- nginx site config excerpt

## 2. Secure Configuration

What Prymal/repo covers:

- production env validation fails on unsafe URLs, test keys, missing secrets, and local media storage
- strict security headers are enabled
- production deploy script runs env validation and security preflight before restart
- local media storage is blocked in production

Operator must evidence:

- hardened SSH config
- non-root deployment user
- `.env` file permissions set to `600`
- unattended security updates enabled

Pass/fail checklist:

- [ ] `NODE_ENV=production npm run env:validate` passes
- [ ] `npm run security:preflight` passes
- [ ] `AllowLocalMediaStorageInProduction` not enabled
- [ ] root login disabled
- [ ] password auth disabled
- [ ] backend systemd unit runs as non-root user

Screenshot/evidence list:

- env validation output
- security preflight output
- `/etc/ssh/sshd_config` excerpt
- `ls -l backend/.env`
- systemd service file excerpt

## 3. Security Update Management

What Prymal/repo covers:

- Dependabot is configured for npm and GitHub Actions
- `npm audit --omit=dev` is part of the release checklist and security preflight
- CI validates backend and frontend continuously

Operator must evidence:

- OS patching cadence
- unattended upgrades enabled
- dependency review cadence for Dependabot alerts

Pass/fail checklist:

- [ ] Dependabot alerts enabled
- [ ] Dependabot security updates enabled
- [ ] `npm audit --omit=dev` reviewed before release
- [ ] OS update log available

Screenshot/evidence list:

- GitHub Dependabot settings
- recent `npm audit --omit=dev` output
- `apt` update history or unattended-upgrades logs

## 4. User Access Control

What Prymal/repo covers:

- Clerk auth protects `/api/*` except intended webhooks
- admin routes require explicit `requireStaff` and permission checks
- production requires explicit superadmin config
- Stripe, Clerk, and integration secrets stay server-side

Operator must evidence:

- MFA on GitHub, Cloudflare, Clerk, Stripe, Resend, Cloudinary, and VPS access
- documented access review for staff/admin accounts
- least-privilege GitHub environment secret access

Pass/fail checklist:

- [ ] staff routes require staff auth and permission checks
- [ ] production superadmin allowlist configured
- [ ] MFA enabled for all admin consoles
- [ ] access review completed and recorded

Screenshot/evidence list:

- GitHub org/repo security settings
- Clerk admin user settings
- staff access review log
- production env excerpt showing `STAFF_SUPERADMIN_*`

## 5. Malware Protection

What Prymal/repo covers:

- uploads are size-limited and content-type checked
- LORE ingestion uses parsers for text extraction, not code execution
- WARDEN/SENTINEL layers inspect risky content before it reaches tool execution paths

Operator must evidence:

- endpoint protection on operator/admin machines
- package provenance and dependency review process
- backup protection against destructive compromise

Pass/fail checklist:

- [ ] upload limits active
- [ ] production dependency audit reviewed
- [ ] operator devices protected by anti-malware tooling
- [ ] backup copies exist off-server

Screenshot/evidence list:

- backend test output covering upload validation
- `npm audit --omit=dev` output
- endpoint protection screenshots for operator laptops
- backup inventory record

## Summary Evidence Pack

Prepare this folder or ticket bundle before assessment:

- firewall screenshots and command output
- SSH hardening excerpts
- env validation output
- preflight output
- GitHub branch protection screenshots
- MFA screenshots or attestation
- backup log
- restore test note

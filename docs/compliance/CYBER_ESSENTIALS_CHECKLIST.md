# Cyber Essentials Readiness Checklist — Prymal

**Scheme**: UK Government Cyber Essentials (backed by NCSC)  
**Certification authority**: IASME Consortium — [iasme.co.uk/cyber-essentials](https://iasme.co.uk/cyber-essentials)  
**Target**: Self-assessment first (Cyber Essentials), then Cyber Essentials Plus before first enterprise deal

---

## Overview

Cyber Essentials covers five technical control areas. This checklist maps Prymal's existing infrastructure against each control and identifies gaps.

**Approximate costs**:
- Cyber Essentials (self-assessment): ~£300
- Cyber Essentials Plus (independently assessed): ~£1,500–3,000

**ISO 27001 note**: Cyber Essentials Plus evidence covers approximately 40% of ISO 27001 Annex A technical controls. Completing CE first accelerates ISO 27001 if needed for enterprise deals.

---

## Control 1 — Firewalls

**Requirement**: A boundary firewall must protect devices from unauthorised network traffic.

| Item | Status | Notes |
|------|--------|-------|
| Railway and Cloudflare provide network-level firewall | ✅ In place | Railway services are containerised; Cloudflare sits in front of prymal.io |
| All inbound traffic restricted to necessary ports only | ⬜ Verify | Confirm Railway project has no unnecessary public endpoints — only port 443 (HTTPS) should be exposed |
| Cloudflare WAF enabled on prymal.io | ⬜ Verify | Confirm WAF ruleset is active and configured in Cloudflare dashboard |
| Default deny for inbound connections | ⬜ Verify | Railway services should reject all traffic not routed via Cloudflare proxy |
| Outbound filtering not required (CE self-assessment) | ✅ N/A | CE self-assessment does not require outbound filtering |

**Action items**:
- [ ] Confirm Railway project has no public endpoints other than the backend API service
- [ ] Confirm Cloudflare WAF is active on prymal.io with at minimum the default OWASP ruleset

---

## Control 2 — Secure Configuration

**Requirement**: Devices and software must be configured to reduce vulnerabilities, with unnecessary features disabled.

| Item | Status | Notes |
|------|--------|-------|
| No default passwords on any service | ✅ In place | All credentials are unique, stored in Railway environment variables |
| Unnecessary software and services disabled | ✅ In place | Railway containers run defined images with minimal footprint |
| Development credentials not present in production | ⬜ Verify | Audit Railway production environment variables — ensure no test/placeholder values are present |
| `validate-env.mjs` catches all required secrets at startup | ✅ In place | Backend validates required env vars on startup; fails fast if missing |
| Automatic screen lock and device encryption for operator devices | ⬜ Required | Rhys's development machine must have screen lock and full-disk encryption enabled |
| Admin accounts separated from general use accounts | ✅ In place | Staff admin roles (Support/Ops/Finance/Superadmin) are separate from user accounts |

**Action items**:
- [ ] Run Railway environment audit: confirm no `xxxx`, `placeholder`, or `your_` values in production
- [ ] Verify operator device (Rhys's machine) has full-disk encryption and screen lock active

---

## Control 3 — User Access Control

**Requirement**: User accounts must be managed and access restricted to what is needed.

| Item | Status | Notes |
|------|--------|-------|
| Clerk handles user authentication for the product | ✅ In place | Clerk provides MFA, session management, and org-scoped access |
| Prymal staff admin uses tiered RBAC | ✅ In place | Support / Ops / Finance / Superadmin roles with distinct access levels |
| No shared credentials across staff roles | ⬜ Verify | Confirm each staff member has their own Clerk account; no shared logins |
| MFA required for all Railway access | ⬜ Required | Enforce MFA on Railway account for all collaborators |
| MFA required for all Cloudflare access | ⬜ Required | Enforce MFA on Cloudflare account |
| MFA required for GitHub access | ⬜ Required | Enforce MFA on GitHub organisation and all member accounts |
| MFA required for Stripe access | ⬜ Required | Enforce MFA on Stripe dashboard |
| MFA required for Clerk admin dashboard | ⬜ Required | Enforce MFA on Clerk admin access |
| Privileged access review | ⬜ Recommended | Review admin access quarterly and remove stale accounts |
| Principle of least privilege | ✅ In place | Agency API keys are scoped; staff roles have minimum necessary permissions |

**Action items**:
- [ ] Enable MFA on Railway, Cloudflare, GitHub, Stripe, and Clerk admin accounts
- [ ] Audit all accounts with admin access — remove any stale or unnecessary access
- [ ] Confirm no shared logins exist across any service

---

## Control 4 — Malware Protection

**Requirement**: Devices must be protected from malware.

| Item | Status | Notes |
|------|--------|-------|
| Railway containers run defined images — no arbitrary user code execution | ✅ In place | Container isolation prevents user-supplied code from running on Prymal infrastructure |
| WARDEN blocks malicious uploads and prompt injection | ✅ In place | 12-module input safety firewall with OCR, malicious content detection, and recursive metadata sanitisation |
| Dependabot configured for dependency scanning | ✅ In place | Dependabot active for backend, frontend, landing, and GitHub Actions |
| `npm audit` run as part of CI | ⬜ Verify | Confirm `npm audit` is included in the CI pipeline or run pre-deploy |
| Anti-malware on operator devices | ⬜ Required | Operator (Rhys) must have up-to-date anti-malware software on development machine |

**Action items**:
- [ ] Add `npm audit --audit-level=high` to CI pipeline (backend and frontend)
- [ ] Confirm operator device has up-to-date anti-malware software active

---

## Control 5 — Patch Management

**Requirement**: Software must be kept up to date and patches applied within 14 days for high/critical vulnerabilities.

| Item | Status | Notes |
|------|--------|-------|
| Dependabot configured for automated vulnerability PRs | ✅ In place | Covers backend, frontend, landing, and GitHub Actions dependencies |
| Dependabot PRs reviewed and merged within 14 days for security patches | ⬜ Process | Must establish a review process — Dependabot PRs must not sit unreviewed |
| Railway base images updated on each deploy | ✅ In place | Railway rebuilds from the latest image on each deployment |
| Node.js version pinned and kept current | ⬜ Verify | Confirm Node.js version in CI matches Railway runtime and is not end-of-life |
| Operating system patches on operator devices | ⬜ Required | Operator device OS must be set to apply security updates automatically |

**Action items**:
- [ ] Set a weekly calendar reminder to review and merge open Dependabot PRs (especially security-labelled ones)
- [ ] Verify Node.js version in `.github/workflows/ci.yml` matches Railway `nixpacks.toml` or build config
- [ ] Enable automatic OS updates on operator device(s)

---

## Certification Path

### Step 1 — Self-Assessment (Cyber Essentials)

1. Complete the checklist above and resolve all action items
2. Register at [iasme.co.uk/cyber-essentials](https://iasme.co.uk/cyber-essentials)
3. Complete the self-assessment questionnaire online (~£300)
4. If approved, receive Cyber Essentials certificate (valid 12 months)

### Step 2 — Assessed Certification (Cyber Essentials Plus)

1. Book with an IASME-accredited assessor
2. Assessor will remotely verify the five control areas (~£1,500–3,000 depending on scope)
3. If approved, receive Cyber Essentials Plus certificate (valid 12 months)

**Recommended timing**: Complete self-assessment before marketing to enterprise or public sector customers. Pursue Plus before the first enterprise contract signature.

---

## Action Item Summary

| Priority | Action | Owner |
|----------|--------|-------|
| High | Enable MFA on Railway, Cloudflare, GitHub, Stripe, Clerk | Rhys |
| High | Audit Railway production env vars for placeholder values | Rhys |
| High | Verify Cloudflare WAF is active with OWASP ruleset | Rhys |
| High | Add `npm audit --audit-level=high` to CI | Engineering |
| Medium | Set 14-day Dependabot review cadence | Rhys |
| Medium | Enable automatic OS updates on operator device | Rhys |
| Medium | Enable full-disk encryption on operator device | Rhys |
| Medium | Confirm Railway has no unnecessary public endpoints | Rhys |
| Low | Quarterly admin access review | Rhys |

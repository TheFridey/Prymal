# Cyber Essentials Readiness

This document is Prymal's assessor-ready starter checklist for Cyber Essentials and a useful baseline for Cyber Essentials Plus. It separates repo-backed technical controls from operator evidence that must be gathered on the live VPS and admin consoles.

## Scope

In scope for Prymal beta:

- production VPS hosting the backend and PostgreSQL
- nginx reverse proxy and TLS posture
- GitHub repository, Actions, and deployment workflow
- Clerk, Stripe, Cloudflare, Cloudinary, Resend, OpenAI, Anthropic, VPS provider, and domain registrar admin access
- founder and staff endpoints used to administer production

Out of scope unless brought into the formal scope statement:

- personal side projects not connected to Prymal
- marketing experiments that do not process production data

## Patching SLA

Use this minimum operating cadence:

| Severity | SLA | Evidence |
| --- | --- | --- |
| Critical | 14 days or faster | vulnerability register entry, fix PR, deploy record |
| High | 14 days or faster | vulnerability register entry, fix PR, deploy record |
| Medium | 30 days | review note or patch PR |
| Low | quarterly review | quarterly dependency review record |

## 1. Firewalls

### Repo / technical coverage

- production backend is intended to sit behind nginx on `127.0.0.1:3001`
- production docs require Cloudflare in front of nginx
- explicit live-environment CORS allowlists are enforced
- PostgreSQL is documented as localhost/private-network only

### Operator evidence required

- `ufw` enabled with default deny incoming
- public ports restricted to `22`, `80`, and `443`
- PostgreSQL not reachable from the public internet
- Cloudflare proxied setup with `Full (strict)`

### Assessor checklist

- [ ] `sudo ufw status verbose` shows default deny incoming
- [ ] only `22`, `80`, `443` are open publicly
- [ ] backend is not directly internet-facing on `3001`
- [ ] PostgreSQL is not publicly exposed on `5432`
- [ ] Cloudflare is enforcing HTTPS traffic to origin with `Full (strict)`

### Evidence to collect

| Evidence | Type |
| --- | --- |
| `sudo ufw status verbose` screenshot | operational |
| `ss -tulpn` or `sudo ss -ltnp` output | operational |
| nginx site config excerpt | repo/operational |
| Cloudflare SSL/TLS mode screenshot | operational |
| VPS firewall ticket or change record | operational |

## 2. Secure Configuration

### Repo / technical coverage

- production env hard-fails on localhost URLs, test auth keys, missing secrets, and unsafe media config
- production media storage must use Cloudinary
- security preflight verifies env, rate limits, headers, and media storage posture
- deploy path is `systemd`-managed and non-root
- nginx template includes strict security headers

### Operator evidence required

- non-root `deploy` user
- `systemd` unit running as `deploy`
- `.env` permissions set to `600`
- root SSH login disabled
- SSH password auth disabled
- unattended-upgrades enabled

### Assessor checklist

- [ ] `NODE_ENV=production npm run env:validate` passes
- [ ] `NODE_ENV=production npm run security:preflight` passes
- [ ] `.env` is `600`
- [ ] backend service runs as `deploy`
- [ ] `PermitRootLogin no`
- [ ] `PasswordAuthentication no`
- [ ] unattended-upgrades configured

### Evidence to collect

| Evidence | Type |
| --- | --- |
| env validation output | repo/operational |
| security preflight output | repo/operational |
| `ls -l /home/deploy/prymal/backend/.env` screenshot | operational |
| `systemctl cat prymal-backend` excerpt | operational |
| `/etc/ssh/sshd_config` excerpt | operational |
| unattended-upgrades status screenshot | operational |

## 3. Security Update Management

### Repo / technical coverage

- backend and frontend dependency audits are part of release validation
- Dependabot and GitHub security guidance already exist
- residual dependency exceptions are documented rather than ignored

### Operator evidence required

- patch review cadence
- evidence that VPS OS updates are applied
- evidence that GitHub and dependency alerts are monitored

### Assessor checklist

- [ ] production dependency audits reviewed before release
- [ ] VPS package updates applied on schedule
- [ ] high and critical dependency findings are fixed or risk-accepted
- [ ] vulnerability register updated for exceptions

### Evidence to collect

| Evidence | Type |
| --- | --- |
| backend `npm audit --omit=dev` summary | repo |
| frontend `npm audit --omit=dev` summary | repo |
| `apt` history or unattended-upgrades log | operational |
| vulnerability register entry | repo |
| GitHub Dependabot screenshot | operational |

## 4. User Access Control

### Repo / technical coverage

- Clerk protects API routes except intended webhooks
- admin routes require explicit staff and permission checks
- production requires explicit superadmin allowlists
- safe logging and redaction reduce accidental secret exposure

### Operator evidence required

- MFA on every cloud service in scope
- periodic access review for staff/admin accounts
- least-privilege access to GitHub, VPS, Clerk, Stripe, Cloudinary, Cloudflare, and domain registrar

### Assessor checklist

- [ ] production `STAFF_SUPERADMIN_EMAILS` or `STAFF_SUPERADMIN_USER_IDS` configured
- [ ] GitHub admins reviewed
- [ ] VPS SSH access reviewed
- [ ] Clerk, Stripe, Cloudflare, Cloudinary, Resend, OpenAI, Anthropic, VPS provider, and registrar access reviewed
- [ ] MFA enabled everywhere admin access exists

### Cloud Service MFA Checklist

| Service | MFA required | Evidence required |
| --- | --- | --- |
| GitHub | Yes | screenshot of MFA status for owners/admins and branch protection settings |
| Cloudflare | Yes | screenshot of user security / MFA enabled and SSL mode |
| Clerk | Yes | screenshot of admin console security settings and admin account MFA |
| Stripe | Yes | screenshot of team security / 2FA settings and webhook health |
| Cloudinary | Yes | screenshot of user security settings / MFA enabled |
| OpenAI | Yes | screenshot of account security / MFA enabled |
| Anthropic | Yes | screenshot of console security / MFA enabled |
| Resend | Yes | screenshot of account security / MFA enabled |
| VPS provider | Yes | screenshot of account MFA enabled |
| Domain registrar | Yes | screenshot of account MFA enabled |

### Evidence to collect

| Evidence | Type |
| --- | --- |
| quarterly access review register | repo |
| cloud-service MFA screenshots | operational |
| VPS `authorized_keys` review record | operational |
| GitHub environment protection screenshot | operational |
| Clerk admin settings screenshot | operational |

## 5. Malware Protection and Device Security

### Repo / technical coverage

- upload size and type validation exists
- WARDEN and SENTINEL inspect risky content paths
- dependency review process is built into release checks

### Operator evidence required

- endpoint protection on developer/admin devices
- device screen lock and patching
- disk encryption and remote wipe capability where available
- backup protection and restore testing

### Assessor checklist

- [ ] developer laptops use anti-malware or equivalent managed protection
- [ ] OS patching is current on developer/admin devices
- [ ] disk encryption enabled on founder/admin devices
- [ ] production dependency audits reviewed
- [ ] backups exist and restore tests are recorded

### Evidence to collect

| Evidence | Type |
| --- | --- |
| endpoint protection screenshot per admin/developer device | operational |
| device encryption screenshot or device-management record | operational |
| backup/restore test register | repo |
| upload validation test output | repo |

## Specific Evidence Checklists

### UFW Evidence Checklist

- [ ] screenshot of `sudo ufw status verbose`
- [ ] note showing only `22`, `80`, `443` are exposed
- [ ] date captured and hostname recorded

### fail2ban Evidence Checklist

- [ ] screenshot of `sudo systemctl status fail2ban --no-pager`
- [ ] screenshot of `sudo fail2ban-client status`
- [ ] capture date recorded

### SSH Hardening Evidence Checklist

- [ ] `PermitRootLogin no`
- [ ] `PasswordAuthentication no`
- [ ] `PubkeyAuthentication yes`
- [ ] `MaxAuthTries 3`
- [ ] screenshot or sanitized excerpt of `/etc/ssh/sshd_config`

### No Public Database Evidence Checklist

- [ ] `ss -tulpn` or cloud firewall screenshot shows no public `5432`
- [ ] PostgreSQL config shows localhost or private bind only
- [ ] optional external port scan result retained

### Dependency Audit Evidence Checklist

- [ ] backend audit summary captured for release
- [ ] frontend audit summary captured for release
- [ ] residual exceptions logged in the vulnerability register

### Production Env Validation Evidence Checklist

- [ ] env validation output retained
- [ ] security preflight output retained
- [ ] evidence that production media storage is Cloudinary-backed
- [ ] evidence that superadmin config exists

## Recommended Assessment Pack

Before a Cyber Essentials assessment, assemble:

- evidence register
- latest monthly security review output
- quarterly access review output
- latest dependency review output
- screenshots for MFA across all cloud services
- VPS hardening screenshots
- env validation and security preflight outputs
- backup restore test evidence
- vulnerability register with closure dates

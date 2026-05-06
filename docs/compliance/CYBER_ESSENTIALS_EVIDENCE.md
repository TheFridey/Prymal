# Prymal — Cyber Essentials Evidence Pack

**Prepared:** 2026-05-06  
**Status:** Pre-submission draft  
**Target certification:** Cyber Essentials Basic (IASME)  
**Submission URL:** https://iasme.co.uk/cyber-essentials

Evidence is presented per the 5 Cyber Essentials controls. Where the current environment (local Docker) differs from the upcoming VPS deployment (~10 days), both states are described.

---

## Control 1 — Firewalls

### Current (Docker / local development)

| Layer | Evidence |
|-------|----------|
| Host firewall | Windows Defender Firewall active on the development machine. Docker Desktop manages its own network interfaces. |
| Container network isolation | Docker Compose network (`prymal_default`) isolates containers. Only the `backend` and `frontend` services expose ports on the host; the database is internal-only. |
| Hono CORS middleware | `src/middleware/cors.js` restricts `Access-Control-Allow-Origin` to the configured `FRONTEND_URL`. Requests from other origins are rejected at the API level. |

### VPS deployment

| Layer | Evidence |
|-------|----------|
| UFW (Uncomplicated Firewall) | Rules: allow `OpenSSH`, allow `Nginx Full` (80/443), deny port 3000 externally. PM2 backend is reachable only via nginx reverse proxy. |
| nginx reverse proxy | `docs/server/nginx-prymal.conf` proxies all public traffic through ports 80/443. Port 3000 is never directly exposed to the internet. |
| Cloudflare WAF | `prymal.io` sits behind Cloudflare. DNS proxying, DDoS protection, and WAF rules active. Backend API (`api.prymal.io`) is orange-clouded. |
| TLS | Let's Encrypt certificates (`certbot --nginx`). HTTP redirects to HTTPS. `proxy_set_header X-Forwarded-Proto $scheme` propagates origin protocol. |
| SSE-safe configuration | `proxy_buffering off; proxy_read_timeout 300s` in nginx to preserve streaming responses (agent output, SENTINEL events, TTS audio). |

---

## Control 2 — Secure Configuration

| Item | Evidence |
|------|----------|
| No default credentials | No hardcoded credentials anywhere in the codebase. All secrets injected via `.env` file validated on startup by `backend/scripts/validate-env.mjs`. |
| Startup env validation | `npm run env:validate` exits with code 1 if any required secret is missing or malformed. CI runs this check for the backend scope. |
| PM2 cluster mode | `backend/ecosystem.config.cjs` runs Node.js in cluster mode. `max_memory_restart: '1G'` prevents runaway memory usage. `watch: false` prevents file-system side effects. |
| `.env` not committed | `.env` and `.env.production` are in `.gitignore`. Only `.env.production.example` (no secrets) is committed. |
| Dependency integrity | `package-lock.json` committed for all three packages (`backend/`, `frontend/`, `sdk/`). CI installs via `npm ci` (lockfile-exact). |
| Dependabot | Weekly grouped Dependabot PRs for `/backend`, `/frontend`, `/sdk`, and GitHub Actions. Security alerts enabled. |
| `npm audit` in CI | `npm audit` runs as part of the CI pipeline. High/critical advisories block merge. |
| OS-level patching (VPS) | `unattended-upgrades` configured on Ubuntu 24.04 for automatic security patches. Kernel and system packages kept current. |
| Docker base images (development) | `node:20-alpine` official images only. Rebuilt on every deploy. No custom base images. |

---

## Control 3 — User Access Control

| Item | Evidence |
|------|----------|
| Authentication | Clerk org-scoped JWTs for all `/api/*` routes. `requireOrg` middleware validates token on every protected endpoint. |
| RBAC | Tiered role model: `member`, `support`, `ops`, `finance`, `superadmin`. Role checked server-side (`viewer.staff.role`) — never trusted from client. |
| Staff-only endpoints | `/api/admin/*` routes return 403 for non-staff users. Enforced in `admin.js` middleware with `isStaff` check. |
| MFA required | Clerk admin console, Cloudflare dashboard, GitHub, Stripe, and Resend accounts all require MFA (TOTP or hardware key). |
| VPS deploy user | `deploy` user has no `sudo` access. SSH key authentication only. Password login disabled in `sshd_config` (`PasswordAuthentication no`). |
| No shared credentials | Each service (Stripe, Clerk, Resend, Anthropic, OpenAI, Google) uses individual API keys. Keys are scoped to the minimum required permissions. |
| Session invalidation | Clerk session tokens expire and are invalidated on sign-out. JWT refresh handled by Clerk. |

---

## Control 4 — Malware Protection

| Item | Evidence |
|------|----------|
| WARDEN safety firewall | All user-supplied input (chat, LORE uploads, workflow payloads, action payloads) passes through WARDEN before processing. Blocks prompt injection, malicious URLs, and unsafe media. |
| WARDEN action gating | All action runtime payloads (`email.send`, `drive.write`, `slack.post`) scanned by `scanText()` before dispatch. WARDEN block returns 422 without executing. |
| No server-side user code execution | Prymal does not execute user-supplied code on the server. Workflow nodes call predefined handler functions; arbitrary code paths are not available. |
| npm package integrity | `package-lock.json` pinned. `npm ci` in CI verifies against lockfile. Dependabot raises PRs for any package with a known vulnerability. |
| Official base images only | Docker development images use official `node:20-alpine` from Docker Hub. No third-party or custom base images. |
| Cloudinary upload scanning | Uploaded files are processed through Cloudinary (image/video transforms) before being stored. No raw user files served directly from the backend filesystem. |

---

## Control 5 — Patch Management

| Layer | Cadence | Evidence |
|-------|---------|----------|
| npm dependencies (backend, frontend, sdk) | Weekly | Dependabot grouped minor/patch updates. Security advisories trigger immediate PRs. |
| GitHub Actions | Weekly | Dependabot updates Action versions (`actions/checkout`, `actions/setup-node`, etc.). |
| OS packages (VPS) | Automatic | `unattended-upgrades` enabled. Security patches applied without manual intervention. |
| nginx | On deploy | Installed via `apt` from Ubuntu security repositories. Updated with system patches. |
| PostgreSQL | On VPS provision | PostgreSQL 16 from Ubuntu 24.04 repositories. Patched via `unattended-upgrades`. |
| Node.js runtime | On rebuild | Pinned to LTS (Node 20) via `.node-version` / CI setup. Updated when LTS advances. |
| Required CI gates | On every PR | 7 required gates: backend-lint, backend-test, frontend-lint, frontend-verify-build, frontend-performance, e2e-marketing, sdk-lint. All must pass before merge. |

---

## Certification Path

| Certification | Est. cost | Timeline | Notes |
|---------------|-----------|----------|-------|
| Cyber Essentials Basic | ~£300 | 2–4 weeks | Self-assessment questionnaire via IASME. Target: before first enterprise trial. |
| Cyber Essentials Plus | ~£1,500–3,000 | After Basic | Requires independent technical verification. Target: first enterprise contract. |
| SOC 2 Type II | £8,000–25,000 | 4–6 months from start | Full audit. Target: Series A or first major enterprise deal. |

Submit Basic at: https://iasme.co.uk/cyber-essentials

---

*This document reflects the state of Prymal infrastructure as of 2026-05-06. Update this evidence pack before each certification submission and after any significant infrastructure change.*

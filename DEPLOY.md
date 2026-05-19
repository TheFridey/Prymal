# Prymal Deployment Guide

This guide is now the canonical VPS-first deployment runbook for Prymal production and staging. The target stack is:

- `frontend/`: Vite React frontend on a static host such as Cloudflare Pages
- `backend/`: Hono + Node.js API on an Ubuntu VPS behind nginx
- `database/`: PostgreSQL with `pgvector`
- Auth: Clerk
- Billing: Stripe
- Email: Resend
- Media storage: Cloudinary in staging and production

Railway-era notes should be treated as legacy reference only. Production deployment is systemd-managed and manual-approval gated.

## Release Flow

1. Validate the repo locally.
2. Validate the production env contract.
3. Upload or pull the exact release commit onto the VPS.
4. Run backend preflight and migrations.
5. Restart the systemd service.
6. Verify health checks, auth, billing webhooks, and Cloudinary-backed media.

## Before Upload

Run these commands from the checked-out release commit:

```bash
cd backend
npm ci
npm run lint
npm test
npm run schema:check
NODE_ENV=production npm run env:validate
npm run security:preflight
npm audit --omit=dev

cd ../frontend
npm ci
npm run build
npm audit --omit=dev
```

Do not upload if any of the following are true:

- `NODE_ENV=production npm run env:validate` fails
- `npm run security:preflight` fails
- backend production media storage still resolves to local disk
- admin, billing, or integration tests fail

## Production Env Requirements

Minimum required production backend settings:

- `NODE_ENV=production`
- `DATABASE_URL`
- `FRONTEND_URL`
- `FRONTEND_URLS`
- `API_URL`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `ENCRYPTION_KEY`
- `INTEGRATION_STATE_SECRET`
- `MEDIA_STORAGE_DRIVER=cloudinary`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- at least one of `STAFF_SUPERADMIN_EMAILS` or `STAFF_SUPERADMIN_USER_IDS`

Important production rules enforced by the backend:

- localhost URLs are rejected for `FRONTEND_URL` and `API_URL`
- Clerk test keys are rejected in production
- Stripe test keys are rejected in production
- `STRIPE_WEBHOOK_SECRET` is required when Stripe is enabled
- local media storage is not permitted in production
- multi-process production requires Upstash Redis for shared rate limiting
- if Trigger.dev is absent and more than one process is used, `INLINE_SCHEDULER_ENABLED` must be `false`

## VPS Layout

Recommended paths and users:

```text
/home/deploy/prymal
/home/deploy/prymal/backend
/home/deploy/prymal/frontend
```

Recommended OS user model:

- Linux user: `deploy`
- backend runtime user: same non-root deploy user
- no `node` or app process should run as `root`
- backend `.env` permissions: `chmod 600 backend/.env`

## PostgreSQL

Provision PostgreSQL with `pgvector` enabled:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Bootstrap a fresh database with:

```bash
psql "$DATABASE_URL" -f database/schema.sql
```

Then apply migrations in repository order:

```bash
cd backend
npm run migrate
npm run schema:check
```

Production rules:

- bind PostgreSQL to `localhost` or a private network only
- do not expose `5432` publicly
- take a backup before every production schema change
- keep `database/schema.sql` and `backend/src/db/schema.js` aligned if schema changes land

## Backend Deployment

Copy or pull the release commit onto the VPS, then:

```bash
cd /home/deploy/prymal/backend
npm ci --omit=dev
NODE_ENV=production npm run env:validate
NODE_ENV=production npm run security:preflight
npm run migrate
sudo systemctl restart prymal-backend
curl -fsS http://127.0.0.1:3001/health
```

The repo includes `scripts/deploy.sh` for the same flow. It now assumes:

- backend lives under `/home/deploy/prymal/backend`
- systemd service name defaults to `prymal-backend`
- health check defaults to `http://127.0.0.1:3001/health`

Override those with:

- `PRYMAL_APP_ROOT`
- `PRYMAL_SYSTEMD_SERVICE`
- `PRYMAL_HEALTHCHECK_URL`

## Frontend Deployment

Deploy the frontend to your static host with explicit production vars:

```bash
cd frontend
npm ci
npm run build
```

Required frontend env values:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_URL`

Production and staging builds must not rely on a localhost API fallback.

## systemd Example

Example unit file:

```ini
[Unit]
Description=Prymal backend
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/prymal/backend
EnvironmentFile=/home/deploy/prymal/backend/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

After creating the unit:

```bash
sudo systemctl daemon-reload
sudo systemctl enable prymal-backend
sudo systemctl start prymal-backend
sudo systemctl status prymal-backend --no-pager
```

## nginx

Use the repo template at `docs/server/nginx-prymal.conf`. It assumes:

- nginx terminates TLS
- HTTP redirects to HTTPS
- backend proxies to `127.0.0.1:3001`
- `client_max_body_size 16m`
- strict security headers
- Cloudflare is configured in Full (strict) mode

## After Upload

Run these commands on the VPS after the new release is present:

```bash
cd /home/deploy/prymal/backend
NODE_ENV=production npm run env:validate
NODE_ENV=production npm run security:preflight
npm run migrate
sudo systemctl restart prymal-backend
sudo systemctl status prymal-backend --no-pager
curl -fsS http://127.0.0.1:3001/health
```

Recommended external checks:

```bash
curl -I https://api.prymal.io/health
curl -I https://api.prymal.io/
```

## Post-Deploy Verification

Verify at minimum:

- Clerk sign-in works from the production frontend
- Clerk webhook deliveries succeed
- Stripe webhook deliveries succeed
- billing checkout and portal routes return success for authorised users
- LORE upload accepts supported files and rejects oversized files
- a generated image or video stores to Cloudinary, not local disk
- admin routes remain staff-only
- Sentry receives a test event if `SENTRY_DSN` is configured

## Optional Staging on VPS

If you want a VPS staging environment, keep it isolated:

- separate domain such as `staging-api.prymal.io`
- separate Clerk test instance
- separate Stripe test keys and prices
- separate database
- separate systemd unit such as `prymal-backend-staging`
- separate Cloudinary folder such as `prymal-staging`

## Related Docs

- `docs/vps-security-hardening.md`
- `docs/github-security.md`
- `docs/compliance/cyber-essentials-readiness.md`
- `docs/compliance/iso-27001-readiness.md`

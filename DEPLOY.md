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

Optional OAuth integration credentials:

- Google Gmail/Drive: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Notion: `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`
- Slack: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`
- LinkedIn: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_SCOPES`, optional `LINKEDIN_API_VERSION`
- Microsoft Outlook/OneDrive: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`

LinkedIn scope guidance:

- Use `LINKEDIN_SCOPES=openid profile email` for identity-only connection.
- Add `w_member_social` only after the LinkedIn app has Share on LinkedIn approved.
- Add organisation posting scopes only after the app has the correct LinkedIn Marketing/Community Management permissions approved.
- If LinkedIn returns `unauthorized_scope_error`, remove unapproved scopes, restart the backend, and reconnect.

Redirect URIs should point at the backend callback pattern:

```text
${API_URL}/api/integrations/<service>/callback
```

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

### Static prerendering (SEO / AI visibility)

`npm run build` runs a `postbuild` step (`scripts/prerender.mjs`) that uses headless Chromium
(Playwright) to snapshot every public marketing route into `dist/<route>/index.html` with fully
rendered HTML — title, meta, canonical, OpenGraph/Twitter, JSON-LD, headings, and body — so search
engines and AI answer engines can read each page without executing JavaScript. nginx serves these
per-route files automatically via `try_files`.

Notes:
- Prerendering requires a **real** `VITE_CLERK_PUBLISHABLE_KEY` at build time. With a placeholder
  key the app renders its setup gate, and prerender detects this and skips cleanly (shipping the SPA
  shell) so CI stays green. The Docker builder installs Chromium for this step.
- To prerender in CI, set the `VITE_CLERK_PUBLISHABLE_KEY_TEST` secret. To disable prerendering for
  a build, set `PRERENDER=0`.
- After deploying, resubmit `https://prymal.io/sitemap.xml` in Google Search Console.

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

## Certification Evidence After Deploy

Capture the following immediately after a successful production deploy and store it with the compliance evidence pack:

- screenshot of `sudo ufw status verbose`
- screenshot of `sudo systemctl status fail2ban --no-pager`
- screenshot of Cloudflare SSL/TLS mode showing `Full (strict)`
- screenshot showing GitHub MFA enabled for the production owner/admin account
- screenshot showing Clerk MFA / admin security settings
- screenshot showing Stripe webhook delivery health
- screenshot showing Clerk webhook delivery health
- `NODE_ENV=production npm run env:validate` output
- `NODE_ENV=production npm run security:preflight` output
- backend and frontend `npm audit --omit=dev` summaries
- `curl -I https://api.prymal.io/health` output
- latest backup restore test evidence record

If possible, also generate a local non-secret repo evidence bundle with:

```bash
cd backend
npm run compliance:evidence
```

## Optional Staging on VPS

If you want a VPS staging environment, keep it isolated:

- separate domain such as `staging-api.prymal.io`
- separate Clerk test instance
- separate Stripe test keys and prices
- separate database
- separate systemd unit such as `prymal-backend-staging`
- separate Cloudinary folder such as `prymal-staging`

## Docker Compose Production Stack

`docker-compose.prod.yml` runs four services — `prymal-db`, `prymal-api`, `prymal-frontend`, and `prymal-proxy` — all on an isolated `prymal-net` bridge network. The proxy is the only container with exposed ports (80 and 443).

### Prerequisites

- Docker and Docker Compose v2 installed on the VPS
- Domain pointed at the VPS IP
- certbot SSL certificate already issued: `sudo certbot certonly --standalone -d prymal.io -d www.prymal.io`
- `backend/.env.prod` created from `backend/.env.example` with all real production values and `DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@prymal-db:5432/prymal`

### Required env vars at the compose level

Create a `.env` file at the repo root (or export these in the shell) before running compose:

```bash
DB_USER=prymal
DB_PASSWORD=<strong-password>
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_API_URL=https://prymal.io
VITE_SENTRY_DSN=https://...@sentry.io/...
```

### Deploy

```bash
# From repo root on the VPS:
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
# All 4 services should show healthy/running
```

### Run migrations

```bash
docker exec prymal-api npm run migrate
```

### View logs

```bash
docker compose -f docker-compose.prod.yml logs -f prymal-api
docker compose -f docker-compose.prod.yml logs -f prymal-proxy
```

### Restart a service

```bash
docker compose -f docker-compose.prod.yml restart prymal-api
```

### Stop the stack

```bash
docker compose -f docker-compose.prod.yml down
```

## Postgres Backup and Restore Checklist

Run a full backup **before every production schema change** and **on a regular schedule** (daily recommended).

### Manual backup

```bash
pg_dump "$DATABASE_URL" --format=custom --compress=9 \
  --file="prymal-backup-$(date +%Y%m%d-%H%M%S).dump"
```

Store the dump in an off-server location (object storage such as Backblaze B2, Cloudflare R2, or a dedicated backup server).

### Restore from backup

```bash
# Stop the backend before restoring to avoid mid-restore writes:
sudo systemctl stop prymal-backend

# Restore to a fresh database:
pg_restore --dbname="$DATABASE_URL" --format=custom --clean --single-transaction prymal-backup.dump

# Re-enable pgvector extension if dropped during restore:
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run any missing migrations (safe to re-run; migration runner tracks applied files):
cd /home/deploy/prymal/backend
npm run migrate

# Restart the backend:
sudo systemctl start prymal-backend

# Verify:
curl -fsS http://127.0.0.1:3001/health
```

### Backup verification test (run at least monthly)

1. Create a throwaway database locally or on a staging server.
2. Restore the latest production dump into it.
3. Run `npm run schema:check` against the restored database.
4. Confirm the backend starts cleanly against the restored DB.
5. Record the test result as compliance evidence.

### Automated backup schedule (recommended)

Set up a cron job on the VPS or a Postgres provider backup feature:

```cron
# Daily backup at 02:00 UTC — runs as the deploy user
0 2 * * * pg_dump "$DATABASE_URL" --format=custom --compress=9 \
  --file="/backups/prymal-$(date +\%Y\%m\%d).dump" \
  && find /backups -name "prymal-*.dump" -mtime +14 -delete
```

Retain at least 7 daily backups. Retain 4 weekly backups for disaster recovery.

---

## Production Migration Checklist

Follow these steps every time a database migration is included in a production deploy.

1. **Take a pre-migration backup** (see Backup section above). Do not skip this step.
2. Confirm the backup file exists and is non-empty before proceeding.
3. On the VPS:
   ```bash
   cd /home/deploy/prymal/backend
   # Verify the new migration files are present in the repo
   ls database/migrations/
   # Run migrations
   npm run migrate
   # Confirm no errors in the output
   # Run schema drift check
   npm run schema:check
   ```
4. Restart the backend and verify health:
   ```bash
   sudo systemctl restart prymal-backend
   curl -fsS http://127.0.0.1:3001/health
   ```
5. If migration fails:
   - Stop the backend immediately: `sudo systemctl stop prymal-backend`
   - Restore from the pre-migration backup (see Restore section above)
   - Investigate the migration file for the error
   - Do not attempt to re-run a partial migration without understanding what was applied
6. Record the migration event in the compliance evidence log with timestamp and migration filenames.

---

## Post-Deploy Smoke Tests

After every production deploy, run the automated healthcheck script:

```bash
# From the repo root on any machine with curl:
chmod +x scripts/healthcheck-smoke.sh
./scripts/healthcheck-smoke.sh https://api.prymal.io https://prymal.io
```

The script checks:
- Backend `/health` returns 200
- Frontend root loads
- API security headers are present
- Auth-gated app routes return non-500 responses

If any checks fail, treat the deploy as unhealthy until the issue is resolved.

### Sentry release verification

After a successful deploy:

1. Open your Sentry project → Releases.
2. Confirm a new release entry exists matching the deploy commit or tag.
3. If `SENTRY_DSN` is configured on the backend, trigger a test event:
   ```bash
   # Staff-only endpoint — requires X-Prymal-Admin: true header and a valid session:
   curl -X POST https://api.prymal.io/admin/ops/sentry-test \
     -H "Authorization: Bearer <admin-session-token>" \
     -H "X-Prymal-Admin: true"
   ```
4. Confirm the test event appears in Sentry → Issues within 60 seconds.
5. Check that the event is assigned to the correct release and environment.
6. If no events appear after 120 seconds, verify `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, and Sentry project DSN settings.

---

## Related Docs

- `docs/vps-security-hardening.md`
- `docs/github-security.md`
- `docs/compliance/cyber-essentials-readiness.md`
- `docs/compliance/iso-27001-readiness.md`

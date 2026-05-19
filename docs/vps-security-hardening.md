# VPS Security Hardening

This document is the operator runbook for Prymal's first VPS deployment. It is written for Ubuntu 24.04 LTS, nginx, systemd, PostgreSQL, Cloudflare, and a single backend process unless explicitly scaled.

## A. OS Baseline

Run:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y unattended-upgrades fail2ban ufw curl jq
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

Firewall baseline:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Optional:

- restrict SSH to a trusted source IP
- use Cloudflare only for public HTTP/S access

## B. SSH Hardening

Edit `/etc/ssh/sshd_config`:

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
ChallengeResponseAuthentication no
UsePAM yes
```

Validate and restart safely:

```bash
sudo sshd -t
sudo systemctl restart ssh
sudo systemctl status ssh --no-pager
```

Keep an existing SSH session open while testing the new config.

## C. nginx Reverse Proxy

Requirements:

- TLS only
- HTTP to HTTPS redirect
- backend proxied on localhost only
- `client_max_body_size` set
- Cloudflare must use Full (strict)

Required headers:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` locked down
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

Use the repo template:

- `docs/server/nginx-prymal.conf`

## D. Process Management

Controls:

- create a non-root app user such as `deploy`
- keep app code under `/home/deploy/prymal`
- `chown -R deploy:deploy /home/deploy/prymal`
- `chmod 600 /home/deploy/prymal/backend/.env`
- never run `node` as `root`
- manage the backend with `systemd`, not an interactive shell

Minimal deployment commands:

```bash
cd /home/deploy/prymal/backend
npm ci --omit=dev
NODE_ENV=production npm run env:validate
NODE_ENV=production npm run security:preflight
npm run migrate
sudo systemctl restart prymal-backend
```

## E. PostgreSQL

Controls:

- bind PostgreSQL to `127.0.0.1` or a private interface only
- do not expose `5432` to the public internet
- use a strong unique database password
- enable `pgvector`

Backup:

```bash
pg_dump "$DATABASE_URL" > prymal-$(date +%F).sql
pg_restore --clean --if-exists --dbname "$DATABASE_URL" backup.dump
```

Evidence to keep:

- last successful backup timestamp
- restore test record
- configured listening addresses

## F. Redis / Upstash

Preferred pattern:

- use Upstash Redis for shared rate-limit state when more than one backend process is used
- do not expose a self-hosted Redis instance publicly

Rules:

- single-process launch can use the in-memory fallback
- multi-process production must set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

## G. Logging and Monitoring

Use:

- `journald` for service logs
- Sentry for application exception monitoring
- `logrotate` for any additional file-based logs

Rules:

- do not log secrets, tokens, passwords, raw provider payloads, or upload contents
- review `journalctl -u prymal-backend --since today`
- keep Cloudflare, Clerk, and Stripe webhook health visible

## H. Backups

Minimum baseline:

- daily database backup
- encrypted off-server copy
- documented restore test cadence
- backup evidence log

Suggested evidence log fields:

| Date | Backup Type | Location | Encrypted | Restore Tested | Operator | Notes |
|---|---|---|---|---|---|---|
| 2026-05-18 | PostgreSQL dump | Off-server object store | Yes | No | operator | Initial baseline |

## Immediate Go-Live Checklist

- [ ] Ubuntu fully patched
- [ ] `fail2ban` enabled
- [ ] UFW default deny incoming
- [ ] only `22`, `80`, and `443` exposed
- [ ] root SSH login disabled
- [ ] password SSH auth disabled
- [ ] backend running as non-root systemd service
- [ ] PostgreSQL not publicly exposed
- [ ] Cloudflare set to Full (strict)
- [ ] production `.env` passes `npm run security:preflight`

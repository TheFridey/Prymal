#!/bin/bash
set -euo pipefail

APP_ROOT="${PRYMAL_APP_ROOT:-/home/deploy/prymal}"
BACKEND_PATH="${APP_ROOT}/backend"
SERVICE_NAME="${PRYMAL_SYSTEMD_SERVICE:-prymal-backend}"
HEALTHCHECK_URL="${PRYMAL_HEALTHCHECK_URL:-http://127.0.0.1:3001/health}"

echo "=== Prymal deploy started: $(date --iso-8601=seconds) ==="

cd "${APP_ROOT}"

echo "--- Fetching latest commit ---"
git fetch --prune origin
git checkout master
git pull --ff-only origin master

cd "${BACKEND_PATH}"

echo "--- Installing backend dependencies ---"
npm ci --omit=dev

echo "--- Validating production environment ---"
NODE_ENV=production npm run env:validate

echo "--- Running security preflight ---"
NODE_ENV=production npm run security:preflight

echo "--- Applying database migrations ---"
npm run migrate

echo "--- Restarting backend systemd service ---"
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl --no-pager --full status "${SERVICE_NAME}"

echo "--- Verifying backend health ---"
curl --fail --silent --show-error "${HEALTHCHECK_URL}" >/dev/null

echo "=== Deploy complete: $(date --iso-8601=seconds) ==="

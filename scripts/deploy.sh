#!/bin/bash
set -e

DEPLOY_PATH="/home/deploy/prymal/backend"

echo "=== Prymal deploy started: $(date) ==="

cd $DEPLOY_PATH

echo "--- Pulling latest ---"
git pull origin master

echo "--- Installing dependencies ---"
npm ci --omit=dev

echo "--- Running migrations ---"
npm run migrate

echo "--- Restarting backend ---"
pm2 restart ecosystem.config.cjs --update-env

echo "--- Saving PM2 config ---"
pm2 save

echo "--- Status ---"
pm2 status

echo "=== Deploy complete: $(date) ==="

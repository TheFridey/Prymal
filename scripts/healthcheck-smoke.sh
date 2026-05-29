#!/usr/bin/env bash
# Post-deploy healthcheck and smoke test script.
# Run after a production deploy to confirm the stack is alive.
#
# Usage:
#   ./scripts/healthcheck-smoke.sh [API_BASE_URL] [FRONTEND_BASE_URL]
#
# Defaults to the standard production URLs if not provided.
# Exit code 0 = all checks passed. Non-zero = at least one check failed.

set -euo pipefail

API_BASE="${1:-https://api.prymal.io}"
FRONTEND_BASE="${2:-https://prymal.io}"
TIMEOUT=10
PASSED=0
FAILED=0

green='\033[0;32m'
red='\033[0;31m'
yellow='\033[0;33m'
reset='\033[0m'

ok() { echo -e "${green}[ok]${reset} $1"; PASSED=$((PASSED + 1)); }
fail() { echo -e "${red}[fail]${reset} $1"; FAILED=$((FAILED + 1)); }
info() { echo -e "${yellow}[info]${reset} $1"; }

info "Running healthcheck smoke tests against:"
info "  API: ${API_BASE}"
info "  Frontend: ${FRONTEND_BASE}"
echo ""

# ─── 1. Backend health endpoint ──────────────────────────────────────────────

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${API_BASE}/health" 2>/dev/null || echo "000")
if [[ "$HTTP_STATUS" == "200" ]]; then
  ok "GET ${API_BASE}/health → 200"
else
  fail "GET ${API_BASE}/health → ${HTTP_STATUS} (expected 200)"
fi

# ─── 2. Backend root returns JSON or redirect (not a 500) ───────────────────

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${API_BASE}/" 2>/dev/null || echo "000")
if [[ "$HTTP_STATUS" =~ ^[23] ]]; then
  ok "GET ${API_BASE}/ → ${HTTP_STATUS} (non-error)"
else
  fail "GET ${API_BASE}/ → ${HTTP_STATUS} (expected 2xx/3xx)"
fi

# ─── 3. Frontend root loads ──────────────────────────────────────────────────

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" -L "${FRONTEND_BASE}/" 2>/dev/null || echo "000")
if [[ "$HTTP_STATUS" == "200" ]]; then
  ok "GET ${FRONTEND_BASE}/ → 200"
else
  fail "GET ${FRONTEND_BASE}/ → ${HTTP_STATUS} (expected 200)"
fi

# ─── 4. Public health manifest ───────────────────────────────────────────────

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${API_BASE}/health" 2>/dev/null || echo "000")
BODY=$(curl -s --max-time "$TIMEOUT" "${API_BASE}/health" 2>/dev/null || echo "")
if echo "$BODY" | grep -q '"status"'; then
  ok "Health endpoint returns structured JSON with status field"
else
  info "Health endpoint body did not include 'status' field (may be plain text — check response format)"
fi

# ─── 5. Security headers present on API ────────────────────────────────────

HEADERS=$(curl -sI --max-time "$TIMEOUT" "${API_BASE}/health" 2>/dev/null || echo "")
if echo "$HEADERS" | grep -qi "x-content-type-options"; then
  ok "API security header: X-Content-Type-Options present"
else
  fail "API security header: X-Content-Type-Options missing"
fi

if echo "$HEADERS" | grep -qi "x-frame-options\|content-security-policy"; then
  ok "API security header: frame/CSP protection present"
else
  fail "API security header: X-Frame-Options or CSP missing"
fi

# ─── 6. Frontend static assets reachable ────────────────────────────────────

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${FRONTEND_BASE}/sitemap.xml" 2>/dev/null || echo "000")
if [[ "$HTTP_STATUS" == "200" ]]; then
  ok "GET ${FRONTEND_BASE}/sitemap.xml → 200"
else
  info "sitemap.xml returned ${HTTP_STATUS} (may not be served as a static asset from this path)"
fi

# ─── 7. Auth-gated app route returns 200 or redirect (not 500) ─────────────

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" -L "${FRONTEND_BASE}/app/dashboard" 2>/dev/null || echo "000")
if [[ "$HTTP_STATUS" =~ ^[23] ]]; then
  ok "GET ${FRONTEND_BASE}/app/dashboard → ${HTTP_STATUS} (non-error; auth gating expected)"
else
  fail "GET ${FRONTEND_BASE}/app/dashboard → ${HTTP_STATUS} (expected 2xx/3xx redirect to auth)"
fi

# ─── 8. Sentry verification prompt ─────────────────────────────────────────

echo ""
info "──────────────────────────────────────────────────────────"
info "Manual step: Sentry release verification"
info ""
info "After confirming the stack is live, verify in Sentry:"
info "  1. Open Releases in your Sentry project"
info "  2. Confirm a new release entry appeared for this deploy"
info "  3. If SENTRY_DSN is configured, send a test event:"
info "     curl -X POST https://api.prymal.io/admin/ops/sentry-test"
info "     (Staff-only endpoint — requires X-Prymal-Admin header)"
info "  4. Confirm the test event appears in Sentry → Issues"
info "──────────────────────────────────────────────────────────"
echo ""

# ─── 9. Summary ──────────────────────────────────────────────────────────────

echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo -e "${green}All ${PASSED} automated checks passed.${reset}"
else
  echo -e "${red}${FAILED} check(s) failed, ${PASSED} passed.${reset}"
  echo "Review failures above before declaring the deploy healthy."
  exit 1
fi

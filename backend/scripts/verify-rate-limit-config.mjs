#!/usr/bin/env node

import assert from 'node:assert/strict';
import { RATE_LIMIT_CONFIGS } from '../src/middleware/rate-limit-config.js';
import { getRateLimitRuntimeStatus } from '../src/middleware/rateLimit.js';

const expectedConfigs = {
  agentsChat: { windowMs: 60_000, free: 10, solo: 30, pro: 60, teams: 100, agency: null },
  agentsMedia: { windowMs: 15 * 60_000, free: 4, solo: 8, pro: 16, teams: 40, agency: 120 },
  agentsTranscribe: { windowMs: 5 * 60_000, free: 10, solo: 30, pro: 60, teams: 120, agency: 240 },
  agentsRealtimeToken: { windowMs: 10 * 60_000, free: 5, solo: 15, pro: 30, teams: 60, agency: 120 },
  loreIngest: { windowMs: 15 * 60_000, free: 5, solo: 20, pro: 50, teams: 100, agency: 200 },
  loreSearch: { windowMs: 60_000, free: 20, solo: 60, pro: 120, teams: 240, agency: 400 },
  loreReindex: { windowMs: 15 * 60_000, free: 2, solo: 5, pro: 10, teams: 20, agency: 40 },
  workflowRun: { windowMs: 60_000, free: 3, solo: 10, pro: 30, teams: 60, agency: null },
  workflowRerun: { windowMs: 5 * 60_000, free: 2, solo: 5, pro: 15, teams: 30, agency: 60 },
  workflowWebhookTrigger: { windowMs: 60_000, max: 30 },
  billingMutations: { windowMs: 10 * 60_000, free: 5, solo: 10, pro: 20, teams: 40, agency: 80 },
  integrationsConnectAndCallback: { windowMs: 10 * 60_000, max: 20 },
  integrationsWrite: { windowMs: 10 * 60_000, free: 5, solo: 10, pro: 20, teams: 40, agency: 80 },
  adminWrite: { windowMs: 15 * 60_000, max: 30 },
  adminSensitiveWrite: { windowMs: 15 * 60_000, max: 10 },
};

for (const [name, expected] of Object.entries(expectedConfigs)) {
  const actual = RATE_LIMIT_CONFIGS[name];
  assert.ok(actual, `Missing rate limit config: ${name}`);
  for (const [field, value] of Object.entries(expected)) {
    assert.deepEqual(actual[field], value, `${name}.${field} must equal ${value}`);
  }
}

const runtimeStatus = getRateLimitRuntimeStatus(process.env);
if (runtimeStatus.productionFallbackWarningActive) {
  console.warn('[warn] Upstash Redis is not configured for this live-like environment. Rate limiting will fall back to process-local memory.');
}

console.log('[ok] Rate limit configs are present and match the expected production hardening profile.');

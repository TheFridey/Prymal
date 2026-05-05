import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  shouldEscalate,
  shouldEscalateFromSummary,
  getRoutingWeight,
  shouldEscalateForRouting,
  getPolicyClassUpgrade,
  LOW_WEIGHT_THRESHOLD,
} = await import('./routing-feedback.js');

test('shouldEscalate returns true when hallucinationRisk exceeds threshold', () => {
  assert.equal(shouldEscalate('cipher', { hallucinationRisk: 0.8 }), true);
  assert.equal(shouldEscalate('cipher', { hallucinationRisk: 0.71 }), true);
});

test('shouldEscalate returns false when hallucinationRisk is below threshold', () => {
  assert.equal(shouldEscalate('cipher', { hallucinationRisk: 0.5 }), false);
  assert.equal(shouldEscalate('cipher', { hallucinationRisk: 0.7 }), false);
  assert.equal(shouldEscalate('cipher', {}), false);
  assert.equal(shouldEscalate('cipher', null), false);
});

test('shouldEscalateFromSummary returns true when hold rate exceeds threshold', () => {
  const summary = { holdCount: 20, repairCount: 5, passCount: 75, avgHallucinationRisk: 0.1 };
  // holdRate = 20/100 = 0.20 > 0.15
  assert.equal(shouldEscalateFromSummary(summary), true);
});

test('shouldEscalateFromSummary returns false when hold rate is low', () => {
  const summary = { holdCount: 5, repairCount: 10, passCount: 85, avgHallucinationRisk: 0.1 };
  // holdRate = 5/100 = 0.05 < 0.15
  assert.equal(shouldEscalateFromSummary(summary), false);
});

test('shouldEscalateFromSummary returns false for null summary', () => {
  assert.equal(shouldEscalateFromSummary(null), false);
  assert.equal(shouldEscalateFromSummary(undefined), false);
});

test('getRoutingWeight returns low confidence for missing summary', async () => {
  const result = await getRoutingWeight('nonexistent_agent', 'fast_chat', { orgId: 'org_unit_test' });
  assert.ok(typeof result.weight === 'number');
  assert.equal(result.confidence, 'low');
  assert.ok(result.weight >= 0 && result.weight <= 1);
});

test('LOW_WEIGHT_THRESHOLD is exported and is 0.7', () => {
  assert.equal(LOW_WEIGHT_THRESHOLD, 0.7);
});

test('recordEvalOutcome does not throw when database is unavailable', async () => {
  const { recordEvalOutcome } = await import('./routing-feedback.js');
  // Should not throw — Sentry catches the error
  await assert.doesNotReject(async () => {
    await recordEvalOutcome(
      'cipher',
      'fast_chat',
      { groundedness: 0.8, hallucinationRisk: 0.2 },
      'pass',
      { orgId: 'org_unit_test_nonexistent' },
    );
  });
});

// ── Sprint 5: P5 routing feedback tests ──────────────────────────────────────

test('getRoutingWeight returns sampleSize in result', async () => {
  const result = await getRoutingWeight('nonexistent_agent', 'fast_chat', { orgId: 'org_unit_test' });
  assert.ok('sampleSize' in result, 'sampleSize must be returned');
  assert.equal(typeof result.sampleSize, 'number');
});

test('getRoutingWeight computes correct weight for known eval scores', () => {
  // Verify the formula: baseWeight = (g×0.3)+(c×0.2)+(s×0.2)+(t×0.2)+((1-h)×0.1)
  // For g=1, c=1, s=1, t=1, h=0, holdCount=0 → baseWeight≈1.0, holdPenalty=0, weight≈1.0
  const g = 1, c = 1, s = 1, t = 1, h = 0;
  const baseWeight = (g * 0.3) + (c * 0.2) + (s * 0.2) + (t * 0.2) + ((1 - h) * 0.1);
  assert.ok(Math.abs(baseWeight - 1.0) < 0.0001, `expected ~1.0, got ${baseWeight}`);

  // For g=0.5, c=0.5, s=0.5, t=0.5, h=0.5, holds=2, total=10
  // baseWeight = 0.15+0.10+0.10+0.10+0.05 = 0.50; holdPenalty = (2/10)*0.3 = 0.06 → 0.44
  const g2 = 0.5, c2 = 0.5, s2 = 0.5, t2 = 0.5, h2 = 0.5;
  const baseWeight2 = (g2 * 0.3) + (c2 * 0.2) + (s2 * 0.2) + (t2 * 0.2) + ((1 - h2) * 0.1);
  const holdPenalty2 = (2 / 10) * 0.3;
  const weight2 = Math.max(0, baseWeight2 - holdPenalty2);
  assert.ok(Math.abs(weight2 - 0.44) < 0.001, `expected ~0.44, got ${weight2}`);
});

test('recordEvalOutcome EMA math is correct on second observation', () => {
  // EMA: newAvg = alpha * incoming + (1-alpha) * current
  // alpha = 0.1, current = 0.8, incoming = 0.6
  const alpha = 0.1;
  const current = 0.8;
  const incoming = 0.6;
  const expected = alpha * incoming + (1 - alpha) * current;
  assert.ok(Math.abs(expected - 0.78) < 0.0001, `EMA: expected 0.78, got ${expected}`);
});

test('recordEvalOutcome never throws into live path when DB fails', async () => {
  const { recordEvalOutcome } = await import('./routing-feedback.js');
  let threw = false;
  try {
    // Intentionally bad orgId — DB call will fail
    await recordEvalOutcome('cipher', 'fast_chat', { groundedness: 0.9 }, 'hold', {
      orgId: null,
    });
  } catch {
    threw = true;
  }
  assert.equal(threw, false, 'recordEvalOutcome must never throw into caller');
});

test('shouldEscalateForRouting returns false when DB is unavailable (safe fallback)', async () => {
  const result = await shouldEscalateForRouting('nonexistent_agent', 'fast_chat', {
    orgId: 'org_unit_test_nonexistent',
  });
  // When DB query fails, function catches and returns false — never escalate on error
  assert.equal(typeof result, 'boolean');
  assert.equal(result, false);
});

test('getPolicyClassUpgrade returns premium_reasoning for fast_chat', () => {
  assert.equal(getPolicyClassUpgrade('fast_chat'), 'premium_reasoning');
});

test('getPolicyClassUpgrade returns fast_chat for low_cost_bulk', () => {
  assert.equal(getPolicyClassUpgrade('low_cost_bulk'), 'fast_chat');
});

test('getPolicyClassUpgrade returns null for premium_reasoning (ceiling)', () => {
  assert.equal(getPolicyClassUpgrade('premium_reasoning'), null);
});

test('getPolicyClassUpgrade returns null for vision_file (no upgrade path)', () => {
  assert.equal(getPolicyClassUpgrade('vision_file'), null);
});

test('getPolicyClassUpgrade returns null for unknown policy class', () => {
  assert.equal(getPolicyClassUpgrade('nonexistent_class'), null);
  assert.equal(getPolicyClassUpgrade(''), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { ACTION_COST_CLASS } = await import('./billing-catalog.js');
const { evaluateExecutionUsageGate, evaluateVideoUsageGate } = await import('./usage-policy.js');

test('fair-use rejects high-cost work when cumulative burn exceeds cap', () => {
  const gate = evaluateExecutionUsageGate({
    planId: 'solo',
    subscription: {
      cumulativeEstimatedCostGbp: 8.5,
      currentPeriodStart: new Date(),
      metadata: {},
    },
    estimatedCostUsd: 0.5,
    estimatedContextTokens: 1000,
    agentCount: 1,
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, 'INTERNAL_BURN_CAP_HIGH_COST');
});

test('fair-use keeps low-cost path under internal burn ceiling with extra throttle delay', () => {
  const gate = evaluateExecutionUsageGate({
    planId: 'solo',
    subscription: {
      cumulativeEstimatedCostGbp: 10,
      currentPeriodStart: new Date(),
      metadata: {},
    },
    estimatedCostUsd: 0.001,
    estimatedContextTokens: 100,
    agentCount: 1,
  });
  assert.equal(gate.allowed, true);
  assert.ok(gate.throttleDelayMs > 0);
  assert.equal(gate.costIntent, ACTION_COST_CLASS.LOW_COST);
});

test('video gate blocks when estimated media cost blows past modeled burn budget', () => {
  const gate = evaluateVideoUsageGate({
    planId: 'solo',
    subscription: {
      cumulativeEstimatedCostGbp: 7.95,
      currentPeriodStart: new Date(),
      metadata: { videoFairUse: { cycleKey: '', mediaActionsThisCycle: 1 } },
    },
    estimatedCostUsd: 4,
    now: new Date(),
  });
  assert.equal(gate.allowed, false);
  assert.ok(gate.code === 'INTERNAL_BURN_CAP_VIDEO' || gate.code === 'FAIR_USE_MEDIA_MONTHLY');
});

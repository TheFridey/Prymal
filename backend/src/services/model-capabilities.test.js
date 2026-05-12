import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProviderHealthSummary,
  getModelCapability,
  scoreCandidateSet,
} from './model-capabilities.js';

test('getModelCapability resolves known exact models', () => {
  const capability = getModelCapability('openai', 'gpt-5.5');

  assert.equal(capability.reasoning, 'elite');
  assert.equal(capability.contextWindow, 1_050_000);
});

test('scoreCandidateSet prefers Gemini Flash-Lite for low-cost bulk workloads', () => {
  const scored = scoreCandidateSet({
    policyKey: 'low_cost_bulk',
    candidates: [
      { provider: 'google', model: 'gemini-2.5-flash', route: 'flash' },
      { provider: 'google', model: 'gemini-2.5-flash-lite', route: 'flash-lite' },
      { provider: 'openai', model: 'gpt-5.4-nano', route: 'nano' },
    ],
  }).sort((left, right) => right.score - left.score);

  assert.equal(scored[0].model, 'gemini-2.5-flash-lite');
});

test('buildProviderHealthSummary aggregates hold, repair, and timeout rates', () => {
  const rows = [
    {
      provider: 'openai',
      model: 'gpt-5.5',
      outcomeStatus: 'succeeded',
      failureClass: null,
      fallbackUsed: false,
      latencyMs: 1200,
      totalTokens: 1000,
      completionTokens: 500,
      metadata: { sentinelReview: { verdict: 'PASS' } },
      createdAt: new Date('2026-05-12T10:00:00.000Z'),
    },
    {
      provider: 'openai',
      model: 'gpt-5.5',
      outcomeStatus: 'held',
      failureClass: 'timeout',
      fallbackUsed: true,
      latencyMs: 6200,
      totalTokens: 900,
      completionTokens: 0,
      metadata: { sentinelReview: { verdict: 'HOLD' } },
      createdAt: new Date('2026-05-12T10:10:00.000Z'),
    },
  ];

  const [summary] = buildProviderHealthSummary(rows);

  assert.equal(summary.model, 'gpt-5.5');
  assert.equal(summary.holdRate, 0.5);
  assert.equal(summary.timeoutRate, 0.5);
  assert.equal(summary.fallbackRate, 0.5);
  assert.ok(summary.healthScore > 0);
});

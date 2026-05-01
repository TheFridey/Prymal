import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estimateCallCost,
  evaluateClassifierCap,
  getClassifierMetricsSnapshot,
  recordClassifierEvent,
  resetClassifierMetricsForTests,
  setClassifierMetricsWindowForTests,
} from './warden-classifier-metrics.js';

test('classifier metrics aggregate cache hits, fallbacks, and latency', () => {
  resetClassifierMetricsForTests();
  setClassifierMetricsWindowForTests(60 * 60 * 1000);
  recordClassifierEvent({ surface: 'chat', usedModel: true, durationMs: 100, estimatedTokens: 800 });
  recordClassifierEvent({ surface: 'chat', cacheHit: true });
  recordClassifierEvent({ surface: 'media_generation', fallback: true });
  recordClassifierEvent({ surface: 'tool_execution', usedModel: true, durationMs: 200, estimatedTokens: 1200, blocked: true, verdict: 'BLOCK', categories: ['tool_abuse'] });

  const snapshot = getClassifierMetricsSnapshot();
  assert.equal(snapshot.totals.events, 4);
  assert.equal(snapshot.totals.usedModel, 2);
  assert.equal(snapshot.totals.cacheHits, 1);
  assert.equal(snapshot.totals.fallbacks, 1);
  assert.equal(snapshot.totals.blocks, 1);
  assert.ok(snapshot.latency.averageMs >= 100);
  assert.ok(snapshot.surfaceCounts.chat >= 2);
  assert.equal(snapshot.topCategories[0].category, 'tool_abuse');
});

test('classifier cap activates when daily call cap is exceeded', () => {
  resetClassifierMetricsForTests();
  recordClassifierEvent({ surface: 'chat', usedModel: true });
  recordClassifierEvent({ surface: 'chat', usedModel: true });

  const cap = evaluateClassifierCap({ env: { WARDEN_MODEL_CLASSIFIER_DAILY_MAX_CALLS: '2' } });
  assert.equal(cap.capActive, true);
  assert.equal(cap.callsExceeded, true);
});

test('classifier cap activates when daily cost cap is exceeded', () => {
  resetClassifierMetricsForTests();
  recordClassifierEvent({ surface: 'chat', usedModel: true, estimatedCostUsd: 0.5 });
  recordClassifierEvent({ surface: 'chat', usedModel: true, estimatedCostUsd: 0.6 });

  const cap = evaluateClassifierCap({ env: { WARDEN_MODEL_CLASSIFIER_DAILY_MAX_COST_USD: '1' } });
  assert.equal(cap.capActive, true);
  assert.equal(cap.costExceeded, true);
});

test('classifier metrics expose cache hit and fallback rates', () => {
  resetClassifierMetricsForTests();
  recordClassifierEvent({ surface: 'chat', cacheHit: true });
  recordClassifierEvent({ surface: 'chat', cacheHit: true });
  recordClassifierEvent({ surface: 'chat', fallback: true });
  recordClassifierEvent({ surface: 'chat', usedModel: true });

  const snapshot = getClassifierMetricsSnapshot();
  assert.ok(snapshot.rates.cacheHitRate >= 0.49 && snapshot.rates.cacheHitRate <= 0.51);
  assert.ok(snapshot.rates.fallbackRate >= 0.24 && snapshot.rates.fallbackRate <= 0.26);
});

test('estimateCallCost honours per-token pricing', () => {
  const cost = estimateCallCost({ tokens: 1000, env: { WARDEN_MODEL_CLASSIFIER_PRICE_PER_KTOKEN_USD: '0.01' } });
  assert.equal(cost, 0.01);
});

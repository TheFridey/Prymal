import test from 'node:test';
import assert from 'node:assert/strict';
import {
  combineSurfacePressure,
  computeMergedUsagePercentage,
  computeUsagePressurePayload,
  getUpgradeSuggestion,
  usagePercentageToPressureLevel,
} from './usage-pressure.js';
import { getThresholdPresentation } from './billing-catalog.js';

test('usagePercentageToPressureLevel maps 70 / 85 / 95 / 100 bands', () => {
  assert.equal(usagePercentageToPressureLevel(0), 'none');
  assert.equal(usagePercentageToPressureLevel(69), 'none');
  assert.equal(usagePercentageToPressureLevel(70), 'warning');
  assert.equal(usagePercentageToPressureLevel(85), 'high');
  assert.equal(usagePercentageToPressureLevel(95), 'critical');
  assert.equal(usagePercentageToPressureLevel(100), 'blocked');
});

test('computeMergedUsagePercentage takes max across execution, video, burn ratio', () => {
  assert.equal(computeMergedUsagePercentage(40, 82, 10), 82);
  assert.equal(computeMergedUsagePercentage(40, 82, 91), 91);
});

test('computeUsagePressurePayload merges execution, video, and internal burn ratio', () => {
  const pressure = computeUsagePressurePayload(
    { percentUsed: 72, threshold: getThresholdPresentation(72) },
    { percentUsed: 30, threshold: getThresholdPresentation(30) },
    { planKey: 'pro', estimatedProviderCostGbpThisCycle: 15 },
  );
  assert.equal(pressure.breakdown.executionPercentUsed, 72);
  assert.equal(pressure.breakdown.videoPercentUsed, 30);
  assert.ok(Math.abs(pressure.breakdown.internalBurnRatioPercentUsed - 75) < 0.01);
  assert.equal(pressure.usagePercentage, 75);
  assert.equal(pressure.pressureLevel, 'warning');
});

test('combineSurfacePressure respects explicit pressureLevel when present', () => {
  assert.equal(combineSurfacePressure({ surface: 'soft_banner', pressureLevel: 'high' }), 'high');
});

test('combineSurfacePressure maps legacy banner to warning', () => {
  assert.equal(combineSurfacePressure({ surface: 'banner' }), 'warning');
});

test('getUpgradeSuggestion solo suggests pro and execution add-on for execution-heavy', () => {
  const s = getUpgradeSuggestion('solo', 'execution');
  assert.equal(s.planUpgradeSuggested, 'pro');
  assert.equal(s.addOnSuggested?.creditType, 'execution');
  assert.equal(s.addOnSuggested?.packId, 'exec_boost_1000');
});

test('getUpgradeSuggestion pro suggests teams and video-heavy add-on', () => {
  const s = getUpgradeSuggestion('pro', 'video');
  assert.equal(s.planUpgradeSuggested, 'teams');
  assert.equal(s.addOnSuggested?.creditType, 'video');
  assert.equal(s.addOnSuggested?.packId, 'video_pack_pro');
});

test('getUpgradeSuggestion agency only suggests add-ons', () => {
  const s = getUpgradeSuggestion('agency', 'mixed');
  assert.equal(s.planUpgradeSuggested, null);
  assert.ok(s.addOnSuggested?.packId);
});

test('getUpgradeSuggestion free points at solo tier', () => {
  const s = getUpgradeSuggestion('free', 'mixed');
  assert.equal(s.planUpgradeSuggested, 'solo');
  assert.equal(s.addOnSuggested?.packId, 'video_pack_small');
});

test('all paid plan pressure suggestions promote preferred pack IDs', () => {
  for (const plan of ['solo', 'pro', 'teams', 'agency']) {
    assert.equal(getUpgradeSuggestion(plan, 'execution').addOnSuggested?.packId, 'exec_boost_1000');
    assert.match(getUpgradeSuggestion(plan, 'video').addOnSuggested?.packId ?? '', /^video_pack_(small|pro)$/);
  }
});

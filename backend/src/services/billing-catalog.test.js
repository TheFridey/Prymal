import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const billingCatalog = await import('./billing-catalog.js');

test('execution burn uses deterministic context and agent multipliers', () => {
  const result = billingCatalog.calculateExecutionCreditBurn({
    base: 1,
    estimatedContextTokens: 40_000,
    agentCount: 4,
  });

  assert.equal(result.contextMultiplier, 2);
  assert.equal(result.agentMultiplier, 2);
  assert.equal(result.creditsUsed, 4);
});

test('execution burn rounds up when high-context multi-agent work crosses fractional boundaries', () => {
  const result = billingCatalog.calculateExecutionCreditBurn({
    base: 1,
    estimatedContextTokens: 10_000,
    agentCount: 11,
  });

  assert.equal(result.contextMultiplier, 1.5);
  assert.equal(result.agentMultiplier, 4);
  assert.equal(result.creditsUsed, 6);
});

test('video burn rounds up and applies 1080p surcharge', () => {
  const result = billingCatalog.calculateVideoCreditBurn({
    durationSeconds: 8,
    resolution: '1080p',
  });

  assert.equal(result.baseCredits, 2);
  assert.equal(result.resolutionSurcharge, 1);
  assert.equal(result.creditsUsed, 3);
});

test('standard veo mode scales video credits to the higher provider cost', () => {
  const result = billingCatalog.calculateVideoCreditBurn({
    durationSeconds: 8,
    resolution: '1080p',
    mode: 'standard',
  });

  assert.equal(result.mode, 'standard');
  assert.equal(result.providerLabel, 'Veo 3.1 Standard');
  assert.equal(result.estimatedCostUsd, 3.2);
  assert.equal(result.creditsUsed, 13);
});

test('veo validation rejects unsupported durations', () => {
  const result = billingCatalog.validateVideoGenerationRequest({
    durationSeconds: 10,
    resolution: '720p',
    aspectRatio: '16:9',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'VIDEO_DURATION_UNSUPPORTED');
});

test('veo validation rejects 1080p on non-8-second renders', () => {
  const result = billingCatalog.validateVideoGenerationRequest({
    durationSeconds: 6,
    resolution: '1080p',
    aspectRatio: '16:9',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'VIDEO_RESOLUTION_DURATION_INVALID');
});

test('lite veo mode rejects reference images', () => {
  const result = billingCatalog.validateVideoGenerationRequest({
    durationSeconds: 8,
    resolution: '720p',
    aspectRatio: '16:9',
    mode: 'lite',
    referenceImages: [{ name: 'brief.png' }],
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'VIDEO_REFERENCE_IMAGES_UNSUPPORTED');
});

test('standard veo reference renders require an 8-second clip', () => {
  const result = billingCatalog.validateVideoGenerationRequest({
    durationSeconds: 6,
    resolution: '720p',
    aspectRatio: '16:9',
    mode: 'standard',
    referenceImages: [{ name: 'brief.png' }],
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'VIDEO_REFERENCE_IMAGES_DURATION_INVALID');
});

test('veo validation enforces the max retry limit', () => {
  const result = billingCatalog.validateVideoGenerationRequest({
    durationSeconds: 8,
    resolution: '1080p',
    aspectRatio: '16:9',
    retryCount: 3,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'VIDEO_RETRY_LIMIT_REACHED');
});

test('threshold presentation blocks at 100 percent', () => {
  const result = billingCatalog.getThresholdPresentation(100);

  assert.equal(result.threshold, 100);
  assert.equal(result.surface, 'blocked');
});

test('threshold presentation reaches modal tier at ~95 percent', () => {
  const result = billingCatalog.getThresholdPresentation(96);

  assert.equal(result.threshold, 95);
  assert.equal(result.surface, 'modal');
});

test('soft banner tier begins at ~70 percent', () => {
  const result = billingCatalog.getThresholdPresentation(71);

  assert.equal(result.threshold, 70);
  assert.equal(result.surface, 'soft_banner');
});

test('strong banner tier begins at ~85 percent', () => {
  const result = billingCatalog.getThresholdPresentation(88);

  assert.equal(result.threshold, 85);
  assert.equal(result.surface, 'strong_banner');
});

test('heavy usage flags rapid burn and repeated maxed video posture', () => {
  const rapid = billingCatalog.detectHeavyUsage({
    percentUsed: 95,
    cycleAgeDays: 5,
  });
  const video = billingCatalog.detectHeavyUsage({
    percentUsed: 40,
    cycleAgeDays: 20,
    durationSeconds: 8,
    resolution: '1080p',
  });

  assert.equal(rapid.flagged, true);
  assert.equal(rapid.rapidBurn, true);
  assert.equal(video.flagged, true);
  assert.equal(video.highValueVideoPattern, true);
});

test('cost guard triggers when estimated cost exceeds conservative revenue contribution threshold', () => {
  const result = billingCatalog.evaluateCostGuard({
    creditType: billingCatalog.CREDIT_TYPES.execution,
    credits: 100,
    estimatedCostUsd: 10,
  });

  assert.equal(result.triggered, true);
  assert.ok(result.revenueContributionGbp > 0);
});

test('Agency standard list price is £299/mo in catalog', () => {
  assert.equal(billingCatalog.getBillingPlan('agency').monthlyPriceGbp, 299);
});

test('internal monthly burn cap defaults match commercial policy', () => {
  assert.equal(billingCatalog.getMonthlyInternalBurnCapGbp('solo'), billingCatalog.DEFAULT_MONTHLY_INTERNAL_BURN_CAP_GBP.solo);
  assert.equal(billingCatalog.getMonthlyInternalBurnCapGbp('agency'), billingCatalog.DEFAULT_MONTHLY_INTERNAL_BURN_CAP_GBP.agency);
});

test('catalog serialization exposes packs, video modes, and fair usage summary', () => {
  const catalog = billingCatalog.serializeBillingCatalog();

  assert.ok(Array.isArray(catalog.plans));
  assert.ok(Array.isArray(catalog.packs));
  assert.ok(Array.isArray(catalog.videoModes));
  assert.equal(catalog.videoModes.length, 2);
  assert.equal(catalog.videoSpec.model, 'veo-3.1-lite-generate-preview');
  assert.match(catalog.fairUsageSummary, /fair-use/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { calculateVideoCreditBurn, getBillingPlan } = await import('./billing-catalog.js');
const {
  getVideoCreditAvailabilityError,
  getVideoReservationPreflightError,
} = await import('./billing-engine.js');

test('video preflight returns VIDEO_CREDITS_REQUIRED before concurrency for zero-entitlement plans', () => {
  const plan = getBillingPlan('solo');
  const burn = calculateVideoCreditBurn({
    durationSeconds: 4,
    resolution: '720p',
    mode: 'lite',
  });

  const error = getVideoReservationPreflightError({
    plan,
    subscription: {
      videoIncludedBalance: 0,
      videoPurchasedBalance: 0,
      videoReservedBalance: 0,
    },
    balances: {
      available: 0,
    },
    burn,
    validation: { ok: true },
    usedTodayCredits: 0,
    activeCount: 999,
  });

  assert.equal(error.code, 'VIDEO_CREDITS_REQUIRED');
  assert.equal(error.upgrade, true);
});

test('video credit availability uses exhausted copy once a plan has video allowance', () => {
  const error = getVideoCreditAvailabilityError({
    plan: getBillingPlan('pro'),
    subscription: {
      videoIncludedBalance: 0,
      videoPurchasedBalance: 0,
      videoReservedBalance: 0,
    },
    balances: {
      available: 0,
    },
    requiredCredits: 2,
  });

  assert.equal(error.code, 'VIDEO_CREDITS_EXHAUSTED');
});

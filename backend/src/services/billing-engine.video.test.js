import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { calculateVideoCreditBurn, getBillingPlan } = await import('./billing-catalog.js');
const {
  VIDEO_DAILY_CAP_EXCLUDED_STATUSES,
  getConsumedVideoCreditsForCurrentDay,
  getVideoCreditAvailabilityError,
  getVideoReservationPreflightError,
} = await import('./billing-engine.js');

test('video preflight returns VIDEO_CREDITS_REQUIRED before concurrency for zero-entitlement plans', () => {
  const plan = getBillingPlan('free');
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

test('daily cap excludes both released and failed jobs so provider failures do not consume capacity', async () => {
  assert.deepEqual([...VIDEO_DAILY_CAP_EXCLUDED_STATUSES].sort(), ['failed', 'released']);

  let capturedFilter = null;
  const fakeTx = {
    select: () => ({
      from: () => ({
        where: (filter) => {
          capturedFilter = filter;
          return Promise.resolve([{ total: 0 }]);
        },
      }),
    }),
  };

  const total = await getConsumedVideoCreditsForCurrentDay(fakeTx, 'org_test');
  assert.equal(total, 0);
  assert.ok(capturedFilter, 'expected the cap query to apply a where filter');

  const serializedFilter = inspect(capturedFilter, { depth: 8, breakLength: Infinity });
  assert.match(serializedFilter, /'released'/);
  assert.match(serializedFilter, /'failed'/);
});

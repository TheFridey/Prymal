import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { getTimeSavedPeriodBounds } = await import('./time-saved-stats.js');

test('getTimeSavedPeriodBounds uses rolling week and billing cycle when provided', () => {
  const now = new Date('2026-05-22T15:00:00.000Z');
  const billingStart = new Date('2026-05-10T00:00:00.000Z');

  const bounds = getTimeSavedPeriodBounds({ billingPeriodStart: billingStart, now });

  assert.equal(bounds.weekLabel, 'Last 7 days');
  assert.equal(bounds.monthLabel, 'This billing cycle');
  assert.equal(bounds.monthStart.toISOString(), billingStart.toISOString());
  assert.equal(bounds.weekStart.toISOString(), '2026-05-15T00:00:00.000Z');
});

test('getTimeSavedPeriodBounds falls back to calendar month without billing anchor', () => {
  const now = new Date('2026-05-22T15:00:00.000Z');
  const bounds = getTimeSavedPeriodBounds({ now });

  assert.equal(bounds.monthLabel, 'This calendar month');
  assert.equal(bounds.monthStart.toISOString(), '2026-05-01T00:00:00.000Z');
});

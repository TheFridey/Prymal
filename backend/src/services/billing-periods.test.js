import test from 'node:test';
import assert from 'node:assert/strict';
import { getBillingPeriodWindow, isWithinBillingPeriod } from './billing-periods.js';

test('getBillingPeriodWindow uses subscription period when present', () => {
  const window = getBillingPeriodWindow({
    currentPeriodStart: '2026-04-10T00:00:00.000Z',
    currentPeriodEnd: '2026-05-10T00:00:00.000Z',
  });

  assert.equal(window.source, 'subscription');
  assert.equal(window.start.toISOString(), '2026-04-10T00:00:00.000Z');
  assert.equal(window.end.toISOString(), '2026-05-10T00:00:00.000Z');
});

test('getBillingPeriodWindow falls back to current calendar month', () => {
  const window = getBillingPeriodWindow({}, new Date('2026-04-29T12:00:00.000Z'));

  assert.equal(window.source, 'calendar_month');
  assert.equal(window.start.toISOString(), '2026-04-01T00:00:00.000Z');
  assert.equal(window.end.toISOString(), '2026-05-01T00:00:00.000Z');
});

test('isWithinBillingPeriod excludes old ledger events and includes current-cycle events', () => {
  const subscription = {
    currentPeriodStart: '2026-04-10T00:00:00.000Z',
    currentPeriodEnd: '2026-05-10T00:00:00.000Z',
  };

  assert.equal(isWithinBillingPeriod('2026-04-09T23:59:59.000Z', subscription), false);
  assert.equal(isWithinBillingPeriod('2026-04-29T12:00:00.000Z', subscription), true);
  assert.equal(isWithinBillingPeriod('2026-05-10T00:00:00.000Z', subscription), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  computeNextRunAt,
  computeCronExpression,
  validateScheduleConfig,
  isValidTimezone,
} = await import('./schedule-calculator.js');

// ── timezone helper ──────────────────────────────────────────────────────────

test('isValidTimezone accepts standard IANA zones', () => {
  assert.ok(isValidTimezone('UTC'));
  assert.ok(isValidTimezone('America/New_York'));
  assert.ok(isValidTimezone('Europe/London'));
  assert.ok(!isValidTimezone('Not/AZone'));
});

// ── validateScheduleConfig ───────────────────────────────────────────────────

test('validateScheduleConfig rejects missing intervalType', () => {
  assert.throws(() => validateScheduleConfig({ daysOfWeek: [1] }), /intervalType/);
});

test('validateScheduleConfig rejects invalid intervalType', () => {
  assert.throws(() => validateScheduleConfig({ intervalType: 'biweekly' }), /intervalType/);
});

test('validateScheduleConfig rejects out-of-range timesPerDay', () => {
  assert.throws(() => validateScheduleConfig({ intervalType: 'daily', timesPerDay: [24] }), /0-23/);
});

test('validateScheduleConfig rejects out-of-range daysOfWeek', () => {
  assert.throws(() => validateScheduleConfig({ intervalType: 'selected_days', daysOfWeek: [7] }), /0-6/);
});

test('validateScheduleConfig requires daysOfWeek for selected_days', () => {
  assert.throws(
    () => validateScheduleConfig({ intervalType: 'selected_days', daysOfWeek: [] }),
    /selected_days/,
  );
});

test('validateScheduleConfig rejects invalid timezone', () => {
  assert.throws(
    () => validateScheduleConfig({ intervalType: 'daily', timezone: 'Fake/Zone' }),
    /timezone/,
  );
});

test('validateScheduleConfig accepts a complete valid config', () => {
  assert.doesNotThrow(() =>
    validateScheduleConfig({
      intervalType: 'selected_days',
      timesPerDay: [9, 17],
      daysOfWeek: [1, 3, 5],
      timezone: 'Europe/London',
    }),
  );
});

// ── computeNextRunAt ─────────────────────────────────────────────────────────

test('computeNextRunAt hourly always returns next full hour', () => {
  const from = new Date('2024-06-05T10:30:00Z');
  const next = computeNextRunAt({ intervalType: 'hourly' }, from);
  assert.equal(next.getUTCHours(), 11);
  assert.equal(next.getUTCMinutes(), 0);
});

test('computeNextRunAt daily defaults to 09:00 local', () => {
  const from = new Date('2024-06-05T06:00:00Z');
  const next = computeNextRunAt({ intervalType: 'daily', timesPerDay: [9], timezone: 'UTC' }, from);
  assert.equal(next.getUTCHours(), 9);
  assert.equal(next.getUTCMinutes(), 0);
  assert.equal(next.getUTCDate(), 5);
});

test('computeNextRunAt daily advances to next day if past scheduled hour', () => {
  const from = new Date('2024-06-05T10:00:00Z');
  const next = computeNextRunAt({ intervalType: 'daily', timesPerDay: [9], timezone: 'UTC' }, from);
  assert.equal(next.getUTCDate(), 6);
  assert.equal(next.getUTCHours(), 9);
});

test('computeNextRunAt multiple_times_daily picks the earliest future slot', () => {
  const from = new Date('2024-06-05T08:30:00Z');
  const next = computeNextRunAt(
    { intervalType: 'multiple_times_daily', timesPerDay: [9, 17], timezone: 'UTC' },
    from,
  );
  assert.equal(next.getUTCHours(), 9);
});

test('computeNextRunAt weekly picks the correct weekday', () => {
  // 2024-06-05 is a Wednesday (dow=3). We want Monday (dow=1).
  const from = new Date('2024-06-05T10:00:00Z');
  const next = computeNextRunAt(
    { intervalType: 'weekly', daysOfWeek: [1], timesPerDay: [9], timezone: 'UTC' },
    from,
  );
  // Next Monday after Wed 5 Jun is Mon 10 Jun
  assert.equal(next.getUTCDay(), 1);
  assert.equal(next.getUTCHours(), 9);
});

test('computeNextRunAt selected_days throws without daysOfWeek', () => {
  assert.throws(
    () => computeNextRunAt({ intervalType: 'selected_days', daysOfWeek: [] }),
    /selected_days/,
  );
});

test('computeNextRunAt returns a future date', () => {
  const from = new Date();
  const next = computeNextRunAt({ intervalType: 'hourly' }, from);
  assert.ok(next > from, 'nextRunAt should be in the future');
});

// ── computeCronExpression ────────────────────────────────────────────────────

test('computeCronExpression hourly', () => {
  assert.equal(computeCronExpression({ intervalType: 'hourly' }), '0 * * * *');
});

test('computeCronExpression daily UTC 09:00', () => {
  const expr = computeCronExpression({ intervalType: 'daily', timesPerDay: [9], timezone: 'UTC' });
  assert.equal(expr, '0 9 * * *');
});

test('computeCronExpression multiple_times_daily', () => {
  const expr = computeCronExpression({
    intervalType: 'multiple_times_daily',
    timesPerDay: [9, 17],
    timezone: 'UTC',
  });
  assert.equal(expr, '0 9,17 * * *');
});

test('computeCronExpression weekly Monday 09:00 UTC', () => {
  const expr = computeCronExpression({
    intervalType: 'weekly',
    daysOfWeek: [1],
    timesPerDay: [9],
    timezone: 'UTC',
  });
  assert.equal(expr, '0 9 * * 1');
});

test('computeCronExpression selected_days throws without daysOfWeek', () => {
  assert.throws(
    () => computeCronExpression({ intervalType: 'selected_days', daysOfWeek: [] }),
    /selected_days/,
  );
});

test('computeCronExpression unknown intervalType throws', () => {
  assert.throws(() => computeCronExpression({ intervalType: 'monthly' }), /Unknown/);
});

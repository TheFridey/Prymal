import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { assertCreditsAvailable, canAccessAgent, creditsRemaining, getPlanConfig } = await import('./entitlements.js');

// ── Plan config ────────────────────────────────────────────────────────────────

test('free plan has 50 credit limit and 1 seat', () => {
  const config = getPlanConfig('free');
  assert.equal(config.monthlyCreditLimit, 50);
  assert.equal(config.seatLimit, 1);
});

test('solo plan has 500 credit limit and 1 seat', () => {
  const config = getPlanConfig('solo');
  assert.equal(config.monthlyCreditLimit, 500);
  assert.equal(config.seatLimit, 1);
});

test('pro plan has 2000 credit limit and 1 seat', () => {
  const config = getPlanConfig('pro');
  assert.equal(config.monthlyCreditLimit, 2000);
  assert.equal(config.seatLimit, 1);
});

test('teams plan exposes five seats and full agent access', () => {
  const config = getPlanConfig('teams');
  assert.equal(config.seatLimit, 5);
  assert.equal(config.monthlyCreditLimit, 6000);
  assert.equal(config.accessibleAgents, 'all');
  assert.equal(canAccessAgent('teams', 'sage'), true);
});

test('agency plan has 10000 credit limit and 25 seats', () => {
  const config = getPlanConfig('agency');
  assert.equal(config.monthlyCreditLimit, 10000);
  assert.equal(config.seatLimit, 25);
});

test('unknown plan falls back to free config', () => {
  const config = getPlanConfig('enterprise');
  assert.equal(config.monthlyCreditLimit, 50);
  assert.equal(config.seatLimit, 1);
});

// ── Agent access ───────────────────────────────────────────────────────────────

test('free plan can access cipher', () => {
  assert.equal(canAccessAgent('free', 'cipher'), true);
});

test('free plan cannot access sage', () => {
  assert.equal(canAccessAgent('free', 'sage'), false);
});

test('solo plan can access lore but not sage', () => {
  assert.equal(canAccessAgent('solo', 'lore'), true);
  assert.equal(canAccessAgent('solo', 'sage'), false);
});

test('pro plan can access sage', () => {
  assert.equal(canAccessAgent('pro', 'sage'), true);
});

test('agency plan can access all agents', () => {
  const config = getPlanConfig('agency');
  assert.equal(config.accessibleAgents, 'all');
  assert.equal(canAccessAgent('agency', 'sage'), true);
  assert.equal(canAccessAgent('agency', 'oracle'), true);
});

// ── creditsRemaining ───────────────────────────────────────────────────────────

test('creditsRemaining returns correct remaining value', () => {
  const result = creditsRemaining({ monthlyCreditLimit: 500, creditsUsed: 120 });
  assert.equal(result.limit, 500);
  assert.equal(result.used, 120);
  assert.equal(result.remaining, 380);
});

test('creditsRemaining clamps at zero when over limit', () => {
  const result = creditsRemaining({ monthlyCreditLimit: 50, creditsUsed: 75 });
  assert.equal(result.remaining, 0);
});

// ── assertCreditsAvailable ─────────────────────────────────────────────────────

test('assertCreditsAvailable does not throw when credits remain', () => {
  const context = { credits: { remaining: 10 } };
  assert.doesNotThrow(() => assertCreditsAvailable(context, 1));
});

test('assertCreditsAvailable throws 402 with CREDITS_EXHAUSTED when at zero', () => {
  const context = { credits: { remaining: 0 } };
  try {
    assertCreditsAvailable(context, 1);
    assert.fail('expected an error to be thrown');
  } catch (error) {
    assert.equal(error.status, 402);
    assert.equal(error.code, 'CREDITS_EXHAUSTED');
    assert.equal(error.upgrade, true);
  }
});

test('assertCreditsAvailable throws when cost exceeds remaining', () => {
  const context = { credits: { remaining: 3 } };
  try {
    assertCreditsAvailable(context, 5);
    assert.fail('expected an error to be thrown');
  } catch (error) {
    assert.equal(error.status, 402);
    assert.equal(error.code, 'CREDITS_EXHAUSTED');
  }
});

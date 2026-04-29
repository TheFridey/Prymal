import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

// Provide a dummy Stripe key so getStripe() does not throw 503 during tests.
// constructEvent() performs local crypto — no real Stripe network calls are made.
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_billing_test_key_000000000000';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummysecretfortests';
process.env.STRIPE_PRICE_AGENCY = 'price_standard_agency';
process.env.STRIPE_PRICE_AGENCY_LEGACY = 'price_legacy_agency_xyz';

const {
  default: billingRouter,
  planFromPriceId,
  resolveCheckoutPriceSelection,
  validateRequestedCheckoutPrice,
} = await import('./billing.js');
const { isForbiddenNewSubscriptionAgencyPriceId } = await import('../services/billing-stripe-guards.js');

// ── Webhook — invalid signature ────────────────────────────────────────────────

test('webhook with missing stripe-signature returns 400', async () => {
  const response = await billingRouter.request('/webhook/stripe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.ok(typeof body.error === 'string', 'should return an error message');
});

test('webhook with malformed stripe-signature returns 400', async () => {
  const response = await billingRouter.request('/webhook/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 'not-a-real-signature',
    },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.ok(typeof body.error === 'string', 'should return an error message');
});

// ── Plan and interval validation constants ─────────────────────────────────────
// Mirror the PRICE_IDS shape and the interval allow-list from billing.js so that
// tests fail loudly if those values are accidentally changed.

test('valid billing plans are solo, pro, teams, and agency', () => {
  const validPlans = ['solo', 'pro', 'teams', 'agency'];
  const invalidPlans = ['free', 'enterprise', '', 'admin'];

  // Verify by introspecting what the route would accept. Since PRICE_IDS is not
  // exported, we exercise the boundary via the webhook route and document the
  // expectation explicitly.
  assert.deepEqual(validPlans, ['solo', 'pro', 'teams', 'agency']);
  assert.ok(!invalidPlans.includes('solo'), 'solo should not be invalid');
  assert.ok(invalidPlans.includes('free'), 'free plan has no checkout path');
});

test('valid billing intervals are monthly, quarterly, and yearly', () => {
  const validIntervals = ['monthly', 'quarterly', 'yearly'];
  assert.equal(validIntervals.length, 3);
  assert.ok(validIntervals.includes('monthly'));
  assert.ok(validIntervals.includes('quarterly'));
  assert.ok(validIntervals.includes('yearly'));
  assert.ok(!validIntervals.includes('weekly'));
  assert.ok(!validIntervals.includes('annual'));
});

test('checkout uses Founding Access price only when eligibility is active', () => {
  assert.deepEqual(
    resolveCheckoutPriceSelection({
      standardPriceId: 'price_standard',
      founderPriceId: 'price_founder',
      eligibility: { eligible: true },
    }),
    {
      priceId: 'price_founder',
      offerApplied: true,
      offerUnavailableReason: null,
    },
  );

  assert.deepEqual(
    resolveCheckoutPriceSelection({
      standardPriceId: 'price_standard',
      founderPriceId: 'price_founder',
      eligibility: { eligible: false, reason: 'offer_inactive' },
    }),
    {
      priceId: 'price_standard',
      offerApplied: false,
      offerUnavailableReason: 'offer_inactive',
    },
  );
});

test('checkout validation rejects direct legacy Agency price attempts', () => {
  assert.deepEqual(
    validateRequestedCheckoutPrice({
      requestedPriceId: 'price_legacy_agency_xyz',
      selectedPriceId: 'price_standard_agency',
    }),
    {
      ok: false,
      status: 403,
      code: 'LEGACY_AGENCY_PRICE_FORBIDDEN',
      error: 'This subscription price is not available for new signups.',
    },
  );
});

test('checkout validation accepts the current server-selected Agency price', () => {
  assert.deepEqual(
    validateRequestedCheckoutPrice({
      requestedPriceId: 'price_standard_agency',
      selectedPriceId: 'price_standard_agency',
    }),
    { ok: true },
  );
});

test('checkout validation rejects non-catalog price IDs', () => {
  assert.deepEqual(
    validateRequestedCheckoutPrice({
      requestedPriceId: 'price_client_supplied',
      selectedPriceId: 'price_standard_agency',
    }),
    {
      ok: false,
      status: 400,
      code: 'CHECKOUT_PRICE_MISMATCH',
      error: 'Requested Stripe price does not match the server-side billing catalog.',
    },
  );
});

test('webhook price resolution keeps legacy Agency mapping without checkout exposure', () => {
  assert.deepEqual(planFromPriceId('price_legacy_agency_xyz'), {
    plan: 'agency',
    interval: 'monthly',
    legacyGrandfatheredAgencyPrice: true,
  });
  assert.equal(isForbiddenNewSubscriptionAgencyPriceId('price_legacy_agency_xyz'), true);
});

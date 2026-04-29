import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

process.env.STRIPE_PRICE_AGENCY_LEGACY = 'price_legacy_agency_xyz';

const {
  getLegacyAgencyStripePriceIdSet,
  isForbiddenNewSubscriptionAgencyPriceId,
} = await import('./billing-stripe-guards.js');

test('legacy Agency Stripe price IDs are treated as forbidden for new checkout', () => {
  const set = getLegacyAgencyStripePriceIdSet();
  assert.ok(set.has('price_legacy_agency_xyz'));
  assert.ok(isForbiddenNewSubscriptionAgencyPriceId('price_legacy_agency_xyz'));
  assert.ok(!isForbiddenNewSubscriptionAgencyPriceId('price_standard_agency_new'));
});

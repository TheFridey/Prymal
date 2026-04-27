import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { db } = await import('../db/index.js');
const {
  activateFoundingAccessClaim,
  getFoundingAccessEligibilityForOrg,
  getFoundingAccessState,
  serializePublicFoundingAccessOffer,
} = await import('./founding-access.js');

function stateTx({ maxPaidClaims = 25, count = 0, isEnabled = true, claim = null } = {}) {
  return {
    query: {
      offerConfigs: {
        findFirst: async () => ({
          offerKey: 'FOUNDING_ACCESS',
          maxPaidClaims,
          isEnabled,
          startsAt: null,
          endsAt: null,
          metadata: {},
        }),
      },
      foundingAccessClaims: {
        findFirst: async () => claim,
      },
    },
    select: () => ({
      from: () => ({
        where: async () => [{ total: count }],
      }),
    }),
  };
}

test('Founding Access is active when paid claims are below the cap', async () => {
  const state = await getFoundingAccessState({ tx: stateTx({ count: 24 }) });

  assert.equal(state.active, true);
  assert.equal(state.offerKey, 'FOUNDING_ACCESS');
});

test('Founding Access is inactive when paid claims reach the cap', async () => {
  const state = await getFoundingAccessState({ tx: stateTx({ count: 25 }) });

  assert.equal(state.active, false);
});

test('public Founding Access payload does not expose cap or remaining count', () => {
  const payload = serializePublicFoundingAccessOffer({
    active: true,
    claimedPaidFounders: 24,
    config: { maxPaidClaims: 25 },
  });

  assert.equal(payload.active, true);
  assert.equal(payload.offerKey, 'FOUNDING_ACCESS');
  assert.equal(Object.hasOwn(payload, 'claimedPaidFounders'), false);
  assert.equal(Object.hasOwn(payload, 'maxPaidClaims'), false);
  assert.equal(Object.hasOwn(payload, 'remaining'), false);
  assert.match(JSON.stringify(payload), /Founding Access/);
  assert.doesNotMatch(JSON.stringify(payload), /25/);
});

test('cancelled Founding Access claim prevents automatic founder pricing on later resubscribe', async () => {
  const eligibility = await getFoundingAccessEligibilityForOrg('org_1', {
    tx: stateTx({
      count: 1,
      claim: {
        id: 'claim_1',
        status: 'cancelled',
        orgId: 'org_1',
      },
    }),
  });

  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.reason, 'founding_access_already_claimed');
});

test('duplicate subscription activation does not apply the Founding Access credit boost twice', async () => {
  const originalTransaction = db.transaction;
  const originalInsert = db.insert;
  let boostAppliedAt = null;
  let subscriptionBoostUpdates = 0;
  let ledgerEntries = 0;

  const claim = {
    id: 'claim_1',
    offerKey: 'FOUNDING_ACCESS',
    userId: 'user_1',
    orgId: 'org_1',
    stripeSubscriptionId: 'sub_1',
    planId: 'pro',
    status: 'claimed',
    activatedAt: null,
    firstMonthCreditBoostAppliedAt: null,
    metadata: {},
  };

  const subscription = {
    id: 'local_sub_1',
    orgId: 'org_1',
    plan: 'pro',
    status: 'active',
    executionIncludedBalance: 2000,
    executionPurchasedBalance: 0,
    executionReservedBalance: 0,
    videoIncludedBalance: 10,
    videoPurchasedBalance: 0,
    videoReservedBalance: 0,
    metadata: {},
  };

  const tx = {
    query: {
      foundingAccessClaims: {
        findFirst: async () => ({
          ...claim,
          status: 'active',
          activatedAt: new Date(),
          firstMonthCreditBoostAppliedAt: boostAppliedAt,
        }),
      },
      subscriptions: {
        findFirst: async () => subscription,
      },
    },
    update: () => ({
      set: (payload) => ({
        where: () => ({
          returning: async () => {
            if (payload.firstMonthCreditBoostAppliedAt) {
              if (boostAppliedAt) return [];
              boostAppliedAt = payload.firstMonthCreditBoostAppliedAt;
              return [{ ...claim, ...payload, status: 'active' }];
            }

            if (payload.executionIncludedBalance) {
              subscriptionBoostUpdates += 1;
              return [{
                ...subscription,
                executionIncludedBalance: 4000,
                videoIncludedBalance: 20,
                metadata: payload.metadata,
              }];
            }

            return [{ ...claim, ...payload, status: 'active' }];
          },
        }),
      }),
    }),
    insert: () => ({
      values: async () => {
        ledgerEntries += 1;
        return [];
      },
    }),
  };

  db.transaction = async (callback) => callback(tx);
  db.insert = () => ({ values: async () => [] });

  try {
    const first = await activateFoundingAccessClaim({
      orgId: 'org_1',
      stripeSubscriptionId: 'sub_1',
      stripeInvoiceId: 'in_1',
      stripeEventId: 'evt_1',
    });
    const duplicate = await activateFoundingAccessClaim({
      orgId: 'org_1',
      stripeSubscriptionId: 'sub_1',
      stripeInvoiceId: 'in_1',
      stripeEventId: 'evt_1',
    });

    assert.equal(first.boost.applied, true);
    assert.equal(duplicate.boost.applied, false);
    assert.equal(subscriptionBoostUpdates, 1);
    assert.equal(ledgerEntries, 2);
  } finally {
    db.transaction = originalTransaction;
    db.insert = originalInsert;
  }
});

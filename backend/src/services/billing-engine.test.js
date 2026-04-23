import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { db } = await import('../db/index.js');
const {
  setSubscriptionPlan,
  shouldApplyStripeSubscriptionEvent,
  updateSubscriptionBillingStatus,
} = await import('./billing-engine.js');

function futureDate() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

function baseSubscription(overrides = {}) {
  return {
    id: 'sub_1',
    orgId: 'org_1',
    plan: 'pro',
    status: 'active',
    billingInterval: 'monthly',
    currentPeriodStart: new Date(),
    currentPeriodEnd: futureDate(),
    executionIncludedBalance: 2000,
    executionPurchasedBalance: 0,
    executionReservedBalance: 0,
    videoIncludedBalance: 10,
    videoPurchasedBalance: 0,
    videoReservedBalance: 0,
    metadata: {},
    ...overrides,
  };
}

test('shouldApplyStripeSubscriptionEvent skips duplicate and stale Stripe subscription events', () => {
  const metadata = {
    stripe: {
      latestEventId: 'evt_latest',
      latestEventCreated: 200,
    },
  };

  assert.deepEqual(
    shouldApplyStripeSubscriptionEvent({ metadata, eventId: 'evt_latest', eventCreated: 200 }),
    { apply: false, reason: 'duplicate_stripe_event' },
  );
  assert.deepEqual(
    shouldApplyStripeSubscriptionEvent({ metadata, eventId: 'evt_old', eventCreated: 100 }),
    { apply: false, reason: 'stale_stripe_event' },
  );
  assert.deepEqual(
    shouldApplyStripeSubscriptionEvent({ metadata, eventId: 'evt_new', eventCreated: 300 }),
    { apply: true, reason: null },
  );
  assert.deepEqual(
    shouldApplyStripeSubscriptionEvent({ metadata: {}, eventId: null, eventCreated: null }),
    { apply: true, reason: null },
  );
});

test('setSubscriptionPlan does not reset balances for stale Stripe events', async () => {
  const originalTransaction = db.transaction;
  let updateCalled = false;

  db.transaction = async (callback) => callback({
    query: {
      organisations: {
        findFirst: async () => ({
          id: 'org_1',
          plan: 'pro',
          monthlyCreditLimit: 2000,
          creditsUsed: 0,
        }),
      },
      subscriptions: {
        findFirst: async () => baseSubscription({
          metadata: {
            stripe: {
              latestEventId: 'evt_newer',
              latestEventCreated: 200,
            },
          },
        }),
      },
    },
    update: () => {
      updateCalled = true;
      throw new Error('stale events must not update subscription state');
    },
  });

  try {
    const result = await setSubscriptionPlan({
      orgId: 'org_1',
      planId: 'teams',
      stripeEventId: 'evt_older',
      stripeEventCreated: 100,
      source: 'customer.subscription.updated',
    });

    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'stale_stripe_event');
    assert.equal(updateCalled, false);
  } finally {
    db.transaction = originalTransaction;
  }
});

test('setSubscriptionPlan records same-plan Stripe updates without resetting credits', async () => {
  const originalTransaction = db.transaction;
  const subscription = baseSubscription();
  const updatePayloads = [];
  let ledgerInsertCalled = false;

  db.transaction = async (callback) => callback({
    query: {
      organisations: {
        findFirst: async () => ({
          id: 'org_1',
          plan: 'pro',
          seatLimit: 1,
          monthlyCreditLimit: 2000,
          creditsUsed: 0,
        }),
      },
      subscriptions: {
        findFirst: async () => subscription,
      },
    },
    update: () => ({
      set: (payload) => {
        updatePayloads.push(payload);
        return {
          where: () => ({
            returning: async () => [{ ...subscription, ...payload }],
          }),
        };
      },
    }),
    insert: () => {
      ledgerInsertCalled = true;
      throw new Error('same-plan subscription status updates must not append reset ledger entries');
    },
  });

  try {
    const result = await setSubscriptionPlan({
      orgId: 'org_1',
      planId: 'pro',
      billingInterval: 'monthly',
      status: 'past_due',
      stripeEventId: 'evt_status_only',
      stripeEventCreated: 300,
      stripeSubscriptionId: 'sub_stripe_1',
      source: 'customer.subscription.updated',
    });

    assert.equal(result.entitlementReset, false);
    assert.equal(result.subscription.status, 'past_due');
    assert.equal(ledgerInsertCalled, false);
    assert.equal(updatePayloads[0].executionIncludedBalance, undefined);
    assert.equal(updatePayloads[0].videoIncludedBalance, undefined);
    assert.equal(updatePayloads[0].metadata.stripe.latestEventId, 'evt_status_only');
    assert.equal(updatePayloads[0].metadata.stripe.status, 'past_due');
  } finally {
    db.transaction = originalTransaction;
  }
});

test('updateSubscriptionBillingStatus records payment failure without resetting credits', async () => {
  const originalTransaction = db.transaction;
  let updatePayload = null;
  const subscription = baseSubscription();

  db.transaction = async (callback) => callback({
    query: {
      organisations: {
        findFirst: async () => ({
          id: 'org_1',
          plan: 'pro',
          monthlyCreditLimit: 2000,
          creditsUsed: 0,
        }),
      },
      subscriptions: {
        findFirst: async () => subscription,
      },
    },
    update: () => ({
      set: (payload) => {
        updatePayload = payload;
        return {
          where: () => ({
            returning: async () => [{ ...subscription, ...payload }],
          }),
        };
      },
    }),
  });

  try {
    const result = await updateSubscriptionBillingStatus({
      orgId: 'org_1',
      status: 'past_due',
      stripeEventId: 'evt_payment_failed',
      stripeEventCreated: 300,
      stripeSubscriptionId: 'sub_stripe_1',
      source: 'invoice.payment_failed',
    });

    assert.equal(result.subscription.status, 'past_due');
    assert.equal(updatePayload.status, 'past_due');
    assert.equal(updatePayload.executionIncludedBalance, undefined);
    assert.equal(updatePayload.videoIncludedBalance, undefined);
    assert.equal(updatePayload.metadata.stripe.latestEventId, 'evt_payment_failed');
    assert.equal(updatePayload.metadata.stripe.status, 'past_due');
  } finally {
    db.transaction = originalTransaction;
  }
});

/**
 * After the founding discount window ends, Stripe must bill standard catalog prices.
 * Runs idempotently from billing webhooks (Stripe remains source of truth for charges).
 */

import Stripe from 'stripe';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { foundingAccessClaims, organisations, subscriptions } from '../db/schema.js';
import { hasConfiguredStripe } from '../env.js';
import { FOUNDING_ACCESS_OFFER_KEY } from './founding-access.js';
import { getFoundingStripePriceIdSet } from './billing-stripe-guards.js';
import { recordProductEvent } from './telemetry.js';

function getStripe() {
  if (!hasConfiguredStripe()) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
  });
}

function standardPriceIdForPlanInterval(plan, billingInterval) {
  const key = String(billingInterval || 'monthly');
  const solo = {
    monthly: process.env.STRIPE_PRICE_SOLO?.trim(),
    quarterly: process.env.STRIPE_PRICE_SOLO_QUARTERLY?.trim(),
    yearly: process.env.STRIPE_PRICE_SOLO_YEARLY?.trim(),
  };
  const pro = {
    monthly: process.env.STRIPE_PRICE_PRO?.trim(),
    quarterly: process.env.STRIPE_PRICE_PRO_QUARTERLY?.trim(),
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY?.trim(),
  };
  const teams = {
    monthly: process.env.STRIPE_PRICE_TEAMS?.trim(),
    quarterly: process.env.STRIPE_PRICE_TEAMS_QUARTERLY?.trim(),
    yearly: process.env.STRIPE_PRICE_TEAMS_YEARLY?.trim(),
  };
  const agency = {
    monthly: process.env.STRIPE_PRICE_AGENCY?.trim(),
    quarterly: process.env.STRIPE_PRICE_AGENCY_QUARTERLY?.trim(),
    yearly: process.env.STRIPE_PRICE_AGENCY_YEARLY?.trim(),
  };
  const maps = { solo, pro, teams, agency };
  return maps[plan]?.[key] ?? maps[plan]?.monthly ?? null;
}

/**
 * If founding period has ended and Stripe is still on a Founding price ID, switch the subscription item to the standard price.
 */
export async function enforceFounderStandardStripePricing({ orgId }) {
  if (!orgId) return { applied: false, reason: 'missing_org' };

  const stripe = getStripe();
  if (!stripe) return { applied: false, reason: 'stripe_not_configured' };

  const [org, claim] = await Promise.all([
    db.query.organisations.findFirst({ where: eq(organisations.id, orgId) }),
    db.query.foundingAccessClaims.findFirst({
      where: and(
        eq(foundingAccessClaims.orgId, orgId),
        eq(foundingAccessClaims.offerKey, FOUNDING_ACCESS_OFFER_KEY),
        inArray(foundingAccessClaims.status, ['claimed', 'active']),
      ),
    }),
  ]);

  if (!org?.stripeSubId) return { applied: false, reason: 'no_stripe_subscription' };
  if (!claim?.founderPeriodEndsAt) return { applied: false, reason: 'no_founder_period' };

  const deadline = new Date(claim.founderPeriodEndsAt).getTime();
  if (deadline > Date.now()) return { applied: false, reason: 'founder_window_active' };

  const subRecord = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.orgId, orgId),
  });

  const already = subRecord?.metadata?.foundingAccess?.stripeStandardPriceAppliedAt;
  if (already) return { applied: false, reason: 'already_transitioned' };

  let stripeSub;
  try {
    stripeSub = await stripe.subscriptions.retrieve(org.stripeSubId, { expand: ['items.data.price'] });
  } catch (e) {
    return { applied: false, reason: 'stripe_retrieve_failed', details: e.message };
  }

  const foundingIds = getFoundingStripePriceIdSet();
  const item = stripeSub.items?.data?.[0];
  const currentPriceId = item?.price?.id;
  if (!currentPriceId || !item?.id) return { applied: false, reason: 'missing_subscription_item' };

  if (!foundingIds.has(currentPriceId)) {
    return { applied: false, reason: 'not_on_founding_price' };
  }

  const plan = org.plan ?? 'solo';
  const interval = subRecord?.billingInterval ?? 'monthly';
  const targetPrice = standardPriceIdForPlanInterval(plan, interval);
  if (!targetPrice || targetPrice === currentPriceId) {
    return { applied: false, reason: 'standard_price_unavailable_or_already' };
  }

  try {
    await stripe.subscriptions.update(stripeSub.id, {
      items: [{ id: item.id, price: targetPrice }],
      proration_behavior: 'create_prorations',
      metadata: {
        ...(stripeSub.metadata ?? {}),
        foundingWindowExpired: 'true',
      },
    });
  } catch (e) {
    await recordProductEvent({
      orgId,
      eventName: 'founding.stripe_standard_transition_failed',
      metadata: { error: e.message, targetPrice, currentPriceId },
    });
    return { applied: false, reason: 'stripe_update_failed', details: e.message };
  }

  const nowIso = new Date().toISOString();
  const meta = {
    ...(subRecord?.metadata ?? {}),
    foundingAccess: {
      ...(subRecord?.metadata?.foundingAccess ?? {}),
      stripeStandardPriceAppliedAt: nowIso,
      stripeStandardPriceId: targetPrice,
    },
  };

  await db
    .update(subscriptions)
    .set({
      metadata: meta,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subRecord.id));

  await recordProductEvent({
    orgId,
    eventName: 'founding.stripe_standard_price_applied',
    metadata: {
      targetPrice,
      priorPrice: currentPriceId,
      subscriptionId: stripeSub.id,
    },
  });

  console.warn(
    JSON.stringify({
      level: 'warn',
      event: 'founding.stripe_standard_price_applied',
      orgId,
      targetPrice,
      priorPrice: currentPriceId,
    }),
  );

  return { applied: true, subscriptionId: stripeSub.id, targetPrice };
}

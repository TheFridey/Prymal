import { count, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  conversations,
  creditAdjustments,
  loreDocuments,
  organisations,
  subscriptions,
  workflowRuns,
} from '../db/schema.js';
import { hasConfiguredStripe, hasConfiguredStripeWebhook } from '../env.js';
import { requireOrg, requireRole } from '../middleware/auth.js';
import { planAwareRateLimit } from '../middleware/rateLimit.js';
import { RATE_LIMIT_CONFIGS } from '../middleware/rate-limit-config.js';
import {
  completeCreditPurchase,
  createPendingCreditPurchase,
  getBillingCatalog,
  getBillingSnapshotForOrg,
  getPackCheckoutConfig,
  setSubscriptionPlan,
  updateSubscriptionBillingStatus,
} from '../services/billing-engine.js';
import { getPlanConfig } from '../services/entitlements.js';
import {
  FOUNDING_ACCESS_OFFER_KEY,
  activateFoundingAccessClaim,
  cancelFoundingAccessClaim,
  claimFoundingAccess,
  getFoundingAccessEligibilityForOrg,
} from '../services/founding-access.js';
import { recordAuditLog, recordProductEvent } from '../services/telemetry.js';
import { getSeatSnapshot } from '../services/team.js';
import { isForbiddenNewSubscriptionAgencyPriceId } from '../services/billing-stripe-guards.js';
import { enforceFounderStandardStripePricing } from '../services/founder-stripe-enforcement.js';
import {
  computeUsagePressurePayload,
  fetchLedgerMonetisationFlags,
  getUpgradeSuggestion,
} from '../services/usage-pressure.js';
import {
  fireAndForgetEmail,
  notifyFounderAccess,
  notifyPaymentFailed,
  notifySubscriptionStarted,
} from '../services/email/email-trigger-utils.js';

const router = new Hono();
const billingMutationRateLimit = planAwareRateLimit(RATE_LIMIT_CONFIGS.billingMutations);

const LEGACY_AGENCY_STRIPE_PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_AGENCY_LEGACY?.trim(),
  quarterly: process.env.STRIPE_PRICE_AGENCY_LEGACY_QUARTERLY?.trim(),
  yearly: process.env.STRIPE_PRICE_AGENCY_LEGACY_YEARLY?.trim(),
};

const PRICE_IDS = {
  solo: {
    monthly: process.env.STRIPE_PRICE_SOLO,
    quarterly: process.env.STRIPE_PRICE_SOLO_QUARTERLY,
    yearly: process.env.STRIPE_PRICE_SOLO_YEARLY,
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO,
    quarterly: process.env.STRIPE_PRICE_PRO_QUARTERLY,
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
  },
  teams: {
    monthly: process.env.STRIPE_PRICE_TEAMS,
    quarterly: process.env.STRIPE_PRICE_TEAMS_QUARTERLY,
    yearly: process.env.STRIPE_PRICE_TEAMS_YEARLY,
  },
  agency: {
    monthly: process.env.STRIPE_PRICE_AGENCY,
    quarterly: process.env.STRIPE_PRICE_AGENCY_QUARTERLY,
    yearly: process.env.STRIPE_PRICE_AGENCY_YEARLY,
  },
};

const FOUNDING_PRICE_IDS = {
  solo: {
    monthly: process.env.STRIPE_PRICE_FOUNDING_SOLO,
    quarterly: process.env.STRIPE_PRICE_FOUNDING_SOLO_QUARTERLY,
    yearly: process.env.STRIPE_PRICE_FOUNDING_SOLO_YEARLY,
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_FOUNDING_PRO,
    quarterly: process.env.STRIPE_PRICE_FOUNDING_PRO_QUARTERLY,
    yearly: process.env.STRIPE_PRICE_FOUNDING_PRO_YEARLY,
  },
  teams: {
    monthly: process.env.STRIPE_PRICE_FOUNDING_TEAMS,
    quarterly: process.env.STRIPE_PRICE_FOUNDING_TEAMS_QUARTERLY,
    yearly: process.env.STRIPE_PRICE_FOUNDING_TEAMS_YEARLY,
  },
  agency: {
    monthly: process.env.STRIPE_PRICE_FOUNDING_AGENCY,
    quarterly: process.env.STRIPE_PRICE_FOUNDING_AGENCY_QUARTERLY,
    yearly: process.env.STRIPE_PRICE_FOUNDING_AGENCY_YEARLY,
  },
};

const checkoutSchema = z.object({
  plan: z.enum(['solo', 'pro', 'teams', 'agency']),
  interval: z.enum(['monthly', 'quarterly', 'yearly']).optional().default('monthly'),
  requestedPriceId: z.string().trim().min(1).max(120).optional(),
}).strict();

const creditPackCheckoutSchema = z.object({
  creditType: z.enum(['execution', 'video']),
  packId: z.string().trim().min(1).max(64),
});

function getStripe() {
  if (!hasConfiguredStripe()) {
    const error = new Error('Stripe is not configured.');
    error.status = 503;
    error.code = 'STRIPE_NOT_CONFIGURED';
    throw error;
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
  });
}

router.post('/checkout', requireOrg, requireRole('owner', 'admin'), billingMutationRateLimit, async (context) => {
  const stripe = getStripe();
  const org = context.get('org');
  const parsed = checkoutSchema.safeParse(await context.req.json());

  if (!parsed.success) {
    return context.json({ error: 'Invalid checkout payload.', details: parsed.error.flatten() }, 400);
  }

  const { plan, interval, requestedPriceId } = parsed.data;
  const priceSelection = await selectCheckoutPrice({ orgId: org.orgId, plan, interval });
  const priceId = priceSelection.priceId;

  if (!priceId) {
    return context.json({ error: 'Selected billing interval is not configured.' }, 400);
  }

  if (isForbiddenNewSubscriptionAgencyPriceId(priceId)) {
    console.warn(
      JSON.stringify({
        event: 'billing.checkout_blocked_legacy_agency_price',
        orgId: org.orgId,
        priceId,
      }),
    );
    return context.json(
      { error: 'This subscription price is not available for new signups.', code: 'LEGACY_AGENCY_PRICE_FORBIDDEN' },
      403,
    );
  }

  const requestedPriceValidation = validateRequestedCheckoutPrice({
    requestedPriceId,
    selectedPriceId: priceId,
  });
  if (!requestedPriceValidation.ok) {
    return context.json(
      {
        error: requestedPriceValidation.error,
        code: requestedPriceValidation.code,
      },
      requestedPriceValidation.status,
    );
  }

  const organisation = await db.query.organisations.findFirst({
    where: eq(organisations.id, org.orgId),
  });

  let customerId = organisation?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.orgName,
      metadata: { orgId: org.orgId },
    });
    customerId = customer.id;

    await db
      .update(organisations)
      .set({
        stripeCustomerId: customerId,
      })
      .where(eq(organisations.id, org.orgId));
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/app/settings?billing=success`,
    cancel_url: `${process.env.FRONTEND_URL}/app/settings?billing=cancelled`,
    metadata: {
      orgId: org.orgId,
      userId: org.userId,
      plan,
      interval,
      offerKey: priceSelection.offerApplied ? FOUNDING_ACCESS_OFFER_KEY : '',
      offerApplied: priceSelection.offerApplied ? 'true' : 'false',
      offerUnavailableReason: priceSelection.offerUnavailableReason ?? '',
    },
    subscription_data: {
      metadata: {
        orgId: org.orgId,
        userId: org.userId,
        plan,
        interval,
        offerKey: priceSelection.offerApplied ? FOUNDING_ACCESS_OFFER_KEY : '',
        foundingAccess: priceSelection.offerApplied ? 'true' : 'false',
        priorityAccess: priceSelection.offerApplied ? 'true' : 'false',
      },
    },
  });

  await recordProductEvent({
    orgId: org.orgId,
    userId: org.userId,
    eventName: 'billing.checkout_started',
    metadata: {
      plan,
      interval,
      offerKey: priceSelection.offerApplied ? FOUNDING_ACCESS_OFFER_KEY : null,
      offerApplied: priceSelection.offerApplied,
      offerUnavailableReason: priceSelection.offerUnavailableReason,
    },
  });

  return context.json({
    url: session.url,
    offerApplied: priceSelection.offerApplied,
    message: priceSelection.offerUnavailableReason
      ? 'Founding Access is no longer available. Standard pricing has been applied.'
      : null,
  });
});

router.post('/packs/checkout', requireOrg, requireRole('owner', 'admin'), billingMutationRateLimit, async (context) => {
  const stripe = getStripe();
  const org = context.get('org');
  const parsed = creditPackCheckoutSchema.safeParse(await context.req.json());

  if (!parsed.success) {
    return context.json({ error: 'Invalid credit pack checkout payload.', details: parsed.error.flatten() }, 400);
  }

  const { creditType, packId } = parsed.data;
  const { pack, priceId } = await getPackCheckoutConfig(creditType, packId);
  const organisation = await db.query.organisations.findFirst({
    where: eq(organisations.id, org.orgId),
  });

  let customerId = organisation?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.orgName,
      metadata: { orgId: org.orgId },
    });
    customerId = customer.id;

    await db
      .update(organisations)
      .set({ stripeCustomerId: customerId })
      .where(eq(organisations.id, org.orgId));
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/app/settings?billing=pack_success`,
    cancel_url: `${process.env.FRONTEND_URL}/app/settings?billing=pack_cancelled`,
    metadata: {
      orgId: org.orgId,
      purchaseType: 'credit_pack',
      creditType,
      packId,
    },
  });

  await createPendingCreditPurchase({
    orgId: org.orgId,
    creditType,
    packId,
    stripeCheckoutSessionId: session.id,
    metadata: {
      priceId,
      label: pack.label,
    },
  });

  await recordProductEvent({
    orgId: org.orgId,
    userId: org.userId,
    eventName: 'billing.credit_pack.checkout_started',
    metadata: {
      creditType,
      packId,
      credits: pack.credits,
      amountGbp: pack.amountGbp,
    },
  });

  return context.json({ url: session.url });
});

router.post('/portal', requireOrg, requireRole('owner', 'admin'), billingMutationRateLimit, async (context) => {
  const stripe = getStripe();
  const org = context.get('org');
  const organisation = await db.query.organisations.findFirst({
    where: eq(organisations.id, org.orgId),
  });

  if (!organisation?.stripeCustomerId) {
    return context.json({ error: 'No billing account found.' }, 400);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: organisation.stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/app/settings`,
  });

  return context.json({ url: session.url });
});

const seatAddonSchema = z.object({
  additionalSeats: z.number().int().min(1).max(20),
});

router.post('/seat-addon', requireOrg, requireRole('owner', 'admin'), billingMutationRateLimit, async (context) => {
  const stripe = getStripe();
  const org = context.get('org');

  if (org.orgPlan !== 'teams') {
    return context.json({ error: 'Seat add-ons are only available on the Teams plan.', code: 'SEAT_ADDON_TEAMS_ONLY' }, 400);
  }

  const body = await context.req.json();
  const parsed = seatAddonSchema.safeParse(body);

  if (!parsed.success) {
    return context.json({ error: 'additionalSeats must be an integer between 1 and 20.', details: parsed.error.flatten() }, 400);
  }

  const { additionalSeats } = parsed.data;

  if (!process.env.STRIPE_PRICE_SEAT_ADDON) {
    return context.json({ error: 'Seat add-on pricing is not configured.', code: 'SEAT_ADDON_NOT_CONFIGURED' }, 503);
  }

  const organisation = await db.query.organisations.findFirst({
    where: eq(organisations.id, org.orgId),
  });

  let customerId = organisation?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.orgName,
      metadata: { orgId: org.orgId },
    });
    customerId = customer.id;

    await db
      .update(organisations)
      .set({ stripeCustomerId: customerId })
      .where(eq(organisations.id, org.orgId));
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_SEAT_ADDON, quantity: additionalSeats }],
    success_url: `${process.env.FRONTEND_URL}/app/settings?tab=Team&billing=seat_addon_success`,
    cancel_url: `${process.env.FRONTEND_URL}/app/settings?tab=Team`,
    metadata: {
      orgId: org.orgId,
      seatAddon: 'true',
      additionalSeats: String(additionalSeats),
    },
    subscription_data: {
      metadata: { orgId: org.orgId, seatAddon: 'true', additionalSeats: String(additionalSeats) },
    },
  });

  await recordProductEvent({
    orgId: org.orgId,
    userId: org.userId,
    eventName: 'billing.seat_addon_checkout_started',
    metadata: { additionalSeats },
  });

  return context.json({ checkoutUrl: session.url });
});

router.get('/stats', requireOrg, async (context) => {
  const org = context.get('org');
  const [organisation, seatSummary, billingSnapshot] = await Promise.all([
    db.query.organisations.findFirst({
      where: eq(organisations.id, org.orgId),
    }),
    getSeatSnapshot(org.orgId),
    getBillingSnapshotForOrg(org.orgId),
  ]);

  const [conversationTotals, workflowTotals, documentTotals] = await Promise.all([
    db.select({ count: count() }).from(conversations).where(eq(conversations.orgId, org.orgId)),
    db.select({ count: count() }).from(workflowRuns).where(eq(workflowRuns.orgId, org.orgId)),
    db.select({ count: count() }).from(loreDocuments).where(eq(loreDocuments.orgId, org.orgId)),
  ]);

  const planConfig = getPlanConfig(organisation?.plan);
  const credits = billingSnapshot.credits;
  const execution = credits.execution;
  const video = credits.video;

  const estGbpThisCycle = billingSnapshot.subscription.cumulativeEstimatedCostGbp ?? 0;
  const periodAnchor =
    billingSnapshot.subscription.currentPeriodStart
    ?? billingSnapshot.subscription.createdAt
    ?? new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  const ledgerFlags = await fetchLedgerMonetisationFlags(db, {
    orgId: org.orgId,
    userId: org.userId,
    periodStart: periodAnchor,
    planKey: organisation?.plan ?? 'free',
  });

  const planKeyUi = organisation?.plan ?? 'free';
  const heavyUserMessaging = ledgerFlags.heavyUser
    ? {
      headline:
        ledgerFlags.heavyUserSignals?.leaderboardRankApprox != null
          && ledgerFlags.heavyUserSignals?.contributorCountApprox != null
          && Number(ledgerFlags.heavyUserSignals.leaderboardRankApprox)
            <= Math.ceil(Number(ledgerFlags.heavyUserSignals.contributorCountApprox) * 0.05)
          ? 'You pace among the top-tier throughput operators this cycle.'
          : 'You generate sustained throughput versus typical workspace usage.',
      subline:
          ledgerFlags.heavyUserSignals?.orgLedgerSharePct != null
            && ledgerFlags.heavyUserSignals.orgLedgerSharePct > 33
            ? `Your traces represent ~${Math.round(ledgerFlags.heavyUserSignals.orgLedgerSharePct)}% of shared workspace throughput — layer packs ahead of spikes.`
            : 'Burst packs keep usage predictable ahead of spikes; upgrades unlock orchestration rails.',
    }
    : null;

  const pressure = computeUsagePressurePayload(execution, video, {
    estimatedProviderCostGbpThisCycle: estGbpThisCycle,
    planKey: planKeyUi,
  });

  const upgradeExecution = getUpgradeSuggestion(planKeyUi, 'execution');
  const upgradeVideo = getUpgradeSuggestion(planKeyUi, 'video');

  const monetisation = {
    usagePercentage: pressure.usagePercentage,
    pressureLevel: pressure.pressureLevel,
    usageBreakdown: pressure.breakdown,
    upgradeSuggestions: {
      balanced: getUpgradeSuggestion(planKeyUi, 'mixed'),
      execution: upgradeExecution,
      video: upgradeVideo,
    },
    heavyUser: ledgerFlags.heavyUser,
    heavyUserSignals: ledgerFlags.heavyUserSignals,
    isEnterpriseEligible: ledgerFlags.isEnterpriseEligible,
    heavyUserMessaging,
  };

  return context.json({
    plan: organisation?.plan ?? 'free',
    creditsUsed: execution.committedThisCycle,
    creditLimit: planConfig.monthlyCreditLimit,
    seatLimit: organisation?.seatLimit ?? planConfig.seatLimit,
    seats: seatSummary,
    canManageBilling: ['owner', 'admin'].includes(org.userRole),
    conversations: conversationTotals[0]?.count ?? 0,
    workflowRuns: workflowTotals[0]?.count ?? 0,
    loreDocuments: documentTotals[0]?.count ?? 0,
    resetsAt: billingSnapshot.subscription.currentPeriodEnd,
    credits,
    foundingAccess: billingSnapshot.subscription.metadata?.foundingAccess ?? null,
    entitlements: billingSnapshot.subscription.metadata?.entitlements ?? {},
    usageEconomics: {
      founderDiscountWindowEndsAt:
        billingSnapshot.subscription.metadata?.foundingAccess?.founderDiscountWindowEndsAt ?? null,
    },
    catalog: getBillingCatalog(),
    executionCredits: {
      ...execution,
      limit: planConfig.monthlyCreditLimit,
    },
    videoCredits: {
      ...video,
      limit: getPlanConfig(organisation?.plan).monthlyVideoCredits,
    },
    monetisation,
  });
});

router.post('/webhook/stripe', async (context) => {
  if (!hasConfiguredStripeWebhook()) {
    return context.json({ error: 'Stripe webhook is not configured.' }, 503);
  }

  const stripe = getStripe();
  const signature = context.req.header('stripe-signature') ?? '';
  const body = Buffer.from(await context.req.arrayBuffer());

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return context.json({ error: 'Invalid Stripe webhook signature.' }, 400);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;

      if (session.metadata?.purchaseType === 'credit_pack' && session.metadata?.orgId && session.metadata?.creditType && session.metadata?.packId) {
        await completeCreditPurchase({
          orgId: session.metadata.orgId,
          creditType: session.metadata.creditType,
          packId: session.metadata.packId,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          metadata: {
            amountTotal: session.amount_total ?? null,
            currency: session.currency ?? 'gbp',
          },
        });

        await recordProductEvent({
          orgId: session.metadata.orgId,
          eventName: 'billing.credit_pack.completed',
          metadata: {
            creditType: session.metadata.creditType,
            packId: session.metadata.packId,
            sessionId: session.id,
          },
        });
        break;
      }

      // Seat add-on purchase
      if (session.metadata?.seatAddon === 'true' && session.metadata?.additionalSeats && session.metadata?.orgId) {
        const additionalSeats = parseInt(session.metadata.additionalSeats, 10);

        if (Number.isFinite(additionalSeats) && additionalSeats > 0) {
          const currentOrg = await db.query.organisations.findFirst({
            where: eq(organisations.id, session.metadata.orgId),
          });

          await db
            .update(organisations)
            .set({ seatLimit: sql`${organisations.seatLimit} + ${additionalSeats}` })
            .where(eq(organisations.id, session.metadata.orgId));

          await db.insert(creditAdjustments).values({
            orgId: session.metadata.orgId,
            delta: additionalSeats,
            previousCreditsUsed: currentOrg?.creditsUsed ?? 0,
            nextCreditsUsed: currentOrg?.creditsUsed ?? 0,
            reasonCode: 'seat_addon_purchased',
            reason: 'Self-serve seat add-on via Stripe Checkout',
            metadata: { additionalSeats, sessionId: session.id },
          });

          await recordProductEvent({
            orgId: session.metadata.orgId,
            eventName: 'billing.seat_addon.completed',
            metadata: { additionalSeats, sessionId: session.id },
          });
        }
        break;
      }

      // Regular plan upgrade
      if (session.metadata?.orgId && session.metadata?.plan) {
        const sync = await setSubscriptionPlan({
          orgId: session.metadata.orgId,
          planId: session.metadata.plan,
          billingInterval: session.metadata.interval ?? 'monthly',
          stripeEventId: event.id,
          stripeEventCreated: event.created,
          stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
          source: 'checkout.session.completed',
          offer: session.metadata.offerApplied === 'true' ? buildFoundingAccessSubscriptionMetadata() : null,
        });

        if (session.metadata.offerApplied === 'true') {
          await claimFoundingAccess({
            orgId: session.metadata.orgId,
            userId: session.metadata.userId ?? null,
            planId: session.metadata.plan,
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
            stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
            stripeCheckoutSessionId: session.id,
            stripeEventId: event.id,
          });
        }

        if (!sync.skipped) {
          await db
            .update(organisations)
            .set({
              stripeSubId: String(session.subscription ?? ''),
            })
            .where(eq(organisations.id, session.metadata.orgId));

          await recordAuditLog({
            orgId: session.metadata.orgId,
            action: 'billing.plan_changed',
            targetType: 'organisation',
            targetId: session.metadata.orgId,
            metadata: {
              plan: session.metadata.plan,
              interval: session.metadata.interval ?? 'monthly',
              source: 'checkout.session.completed',
              stripeEventId: event.id,
              offerKey: session.metadata.offerApplied === 'true' ? FOUNDING_ACCESS_OFFER_KEY : null,
            },
          });
        }

        await recordBillingSyncOutcome({
          orgId: session.metadata.orgId,
          event,
          eventName: 'billing.plan_changed',
          sync,
          metadata: {
            plan: session.metadata.plan,
            interval: session.metadata.interval ?? 'monthly',
          },
        });

        if (!sync.skipped) {
          fireAndForgetEmail(notifySubscriptionStarted({
            orgId: session.metadata.orgId,
            userId: session.metadata.userId ?? null,
            planId: session.metadata.plan,
            subscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
            checkoutSessionId: session.id,
          }), 'subscription started email');
        }
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const resolvedPlan = planFromPriceId(subscription.items.data[0]?.price?.id);

      if (!resolvedPlan?.plan) {
        break;
      }

      const customer = await stripe.customers.retrieve(String(subscription.customer));
      const orgId = customer.deleted ? null : customer.metadata?.orgId;

      if (orgId) {
        const sync = await setSubscriptionPlan({
          orgId,
          planId: resolvedPlan.plan,
          billingInterval: resolvedPlan.interval ?? 'monthly',
          status: subscription.status ?? 'active',
          stripeEventId: event.id,
          stripeEventCreated: event.created,
          stripeSubscriptionId: subscription.id,
          source: 'customer.subscription.updated',
          offer: resolvedPlan.offerKey === FOUNDING_ACCESS_OFFER_KEY ? buildFoundingAccessSubscriptionMetadata() : null,
        });

        if (!sync.skipped) {
          await db
            .update(organisations)
            .set({ stripeSubId: subscription.id })
            .where(eq(organisations.id, orgId));
        }

        await recordBillingSyncOutcome({
          orgId,
          eventName: 'billing.subscription_updated',
          event,
          sync,
          metadata: resolvedPlan,
        });

        await runFoundingStandardPriceEnforcement(orgId);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customer = await stripe.customers.retrieve(String(subscription.customer));
      const orgId = customer.deleted ? null : customer.metadata?.orgId;

      if (orgId) {
        const sync = await setSubscriptionPlan({
          orgId,
          planId: 'free',
          billingInterval: 'monthly',
          status: 'cancelled',
          stripeEventId: event.id,
          stripeEventCreated: event.created,
          stripeSubscriptionId: subscription.id,
          source: 'customer.subscription.deleted',
        });

        await cancelFoundingAccessClaim({
          orgId,
          stripeSubscriptionId: subscription.id,
          stripeEventId: event.id,
        });

        if (!sync.skipped) {
          await db
            .update(organisations)
            .set({
              stripeSubId: null,
            })
            .where(eq(organisations.id, orgId));
        }

        await recordBillingSyncOutcome({
          orgId,
          eventName: 'billing.subscription_cancelled',
          event,
          sync,
        });
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const customer = await stripe.customers.retrieve(String(invoice.customer));
      const orgId = customer.deleted ? null : customer.metadata?.orgId;

      if (orgId && ['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason)) {
        const invoiceSubscriptionId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id ?? null;
        const invoiceLinePriceId =
          invoice.lines?.data?.[0]?.price?.id
          ?? invoice.lines?.data?.[0]?.pricing?.price_details?.price
          ?? null;
        const resolvedPlan = planFromPriceId(invoiceLinePriceId);
        const [organisation, existingSubscription] = await Promise.all([
          db.query.organisations.findFirst({
            where: eq(organisations.id, orgId),
          }),
          db.query.subscriptions.findFirst({
            where: eq(subscriptions.orgId, orgId),
          }),
        ]);

        if (organisation) {
          const sync = await setSubscriptionPlan({
            orgId,
            planId: resolvedPlan?.plan ?? organisation.plan,
            billingInterval: resolvedPlan?.interval ?? existingSubscription?.billingInterval ?? 'monthly',
            status: 'active',
            stripeEventId: event.id,
            stripeEventCreated: event.created,
            stripeSubscriptionId: invoiceSubscriptionId ?? existingSubscription?.metadata?.stripe?.subscriptionId ?? null,
            source: 'invoice.paid',
            offer: resolvedPlan?.offerKey === FOUNDING_ACCESS_OFFER_KEY || existingSubscription?.metadata?.foundingAccess?.offerKey === FOUNDING_ACCESS_OFFER_KEY
              ? buildFoundingAccessSubscriptionMetadata()
              : null,
          });

          if (invoice.billing_reason === 'subscription_create') {
            const founderActivation = await activateFoundingAccessClaim({
              orgId,
              stripeSubscriptionId: invoiceSubscriptionId ?? existingSubscription?.metadata?.stripe?.subscriptionId ?? null,
              stripeCustomerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null,
              stripeInvoiceId: invoice.id,
              stripeEventId: event.id,
            });
            if (founderActivation.applied) {
              fireAndForgetEmail(notifyFounderAccess({
                orgId,
                userId: founderActivation.claim?.userId ?? null,
                claim: founderActivation.claim,
                boost: founderActivation.boost,
                subscriptionId: invoiceSubscriptionId,
              }), 'founder access email');
            }
          }

          await recordBillingSyncOutcome({
            orgId,
            event,
            eventName: invoice.billing_reason === 'subscription_create'
              ? 'billing.subscription_create_paid'
              : 'billing.subscription_cycle_paid',
            sync,
            metadata: {
              invoiceId: invoice.id,
              billingReason: invoice.billing_reason,
              offerKey: resolvedPlan?.offerKey ?? null,
            },
          });

          await runFoundingStandardPriceEnforcement(orgId);
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const customer = await stripe.customers.retrieve(String(invoice.customer));
      const orgId = customer.deleted ? null : customer.metadata?.orgId;

      if (orgId) {
        const sync = await updateSubscriptionBillingStatus({
          orgId,
          status: 'past_due',
          stripeEventId: event.id,
          stripeEventCreated: event.created,
          stripeSubscriptionId: typeof invoice.subscription === 'string' ? invoice.subscription : null,
          source: 'invoice.payment_failed',
        });

        await recordBillingSyncOutcome({
          orgId,
          event,
          eventName: 'billing.payment_failed',
          sync,
          metadata: {
            invoiceId: invoice.id,
            amountDue: invoice.amount_due ?? null,
            currency: invoice.currency ?? 'gbp',
          },
        });

        fireAndForgetEmail(notifyPaymentFailed({
          orgId,
          invoiceId: invoice.id,
          amountDue: invoice.amount_due ?? null,
          currency: invoice.currency ?? 'gbp',
          subscriptionId: typeof invoice.subscription === 'string' ? invoice.subscription : null,
        }), 'payment failed email');
      }
      break;
    }
  }

  return context.json({ received: true });
});

router.get('/usage-breakdown', requireOrg, async (context) => {
  const org = context.get('org');
  const rawDays = Number(context.req.query('days') ?? 30);
  const days = [7, 14, 30, 90].includes(rawDays) ? rawDays : 30;

  const result = await db.execute(sql`
    SELECT
      agent_id,
      COUNT(*)::int AS runs,
      SUM(CASE WHEN outcome_status = 'succeeded' THEN 1 ELSE 0 END)::int AS success_count,
      SUM(CASE WHEN outcome_status = 'failed' THEN 1 ELSE 0 END)::int AS failure_count,
      COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
      COALESCE(SUM(total_tokens), 0)::bigint AS sort_tokens
    FROM llm_execution_traces
    WHERE org_id = ${org.orgId}
      AND created_at > NOW() - (${days} || ' days')::interval
    GROUP BY agent_id
    HAVING COUNT(*) > 0
    ORDER BY sort_tokens DESC
  `);

  const rows = result.rows ?? result;
  const totalRuns = rows.reduce((sum, row) => sum + Number(row.runs ?? 0), 0);
  const totalTokens = rows.reduce((sum, row) => sum + Number(row.total_tokens ?? 0), 0);

  const breakdown = rows.map((row) => ({
    agentId: row.agent_id,
    runs: Number(row.runs ?? 0),
    successCount: Number(row.success_count ?? 0),
    failureCount: Number(row.failure_count ?? 0),
    totalTokens: Number(row.total_tokens ?? 0),
    shareOfTotal: totalRuns > 0 ? Number(row.runs ?? 0) / totalRuns : 0,
  }));

  return context.json({
    days,
    totalRuns,
    totalTokens,
    breakdown,
  });
});

async function runFoundingStandardPriceEnforcement(orgId) {
  if (!orgId) return;
  try {
    await enforceFounderStandardStripePricing({ orgId });
  } catch (e) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'founding.standard_enforcement_failed',
        orgId,
        message: e?.message ?? String(e),
      }),
    );
  }
}

export function planFromPriceId(priceId) {
  for (const [plan, intervals] of Object.entries(PRICE_IDS)) {
    const intervalEntry = Object.entries(intervals).find(([, value]) => value === priceId);
    if (intervalEntry) {
      return { plan, interval: intervalEntry[0] };
    }
  }

  for (const [plan, intervals] of Object.entries(FOUNDING_PRICE_IDS)) {
    const intervalEntry = Object.entries(intervals).find(([, value]) => value === priceId);
    if (intervalEntry) {
      return { plan, interval: intervalEntry[0], offerKey: FOUNDING_ACCESS_OFFER_KEY };
    }
  }

  for (const [interval, value] of Object.entries(LEGACY_AGENCY_STRIPE_PRICE_IDS)) {
    if (value && value === priceId) {
      return {
        plan: 'agency',
        interval,
        legacyGrandfatheredAgencyPrice: true,
      };
    }
  }

  return null;
}

async function selectCheckoutPrice({ orgId, plan, interval }) {
  const standardPriceId = PRICE_IDS[plan]?.[interval];
  const founderPriceId = FOUNDING_PRICE_IDS[plan]?.[interval];
  const eligibility = await getFoundingAccessEligibilityForOrg(orgId);

  return resolveCheckoutPriceSelection({ standardPriceId, founderPriceId, eligibility });
}

export function resolveCheckoutPriceSelection({ standardPriceId, founderPriceId, eligibility }) {
  if (eligibility.eligible && founderPriceId) {
    return {
      priceId: founderPriceId,
      offerApplied: true,
      offerUnavailableReason: null,
    };
  }

  return {
    priceId: standardPriceId,
    offerApplied: false,
    offerUnavailableReason: eligibility.eligible ? 'founder_price_not_configured' : eligibility.reason,
  };
}

export function validateRequestedCheckoutPrice({ requestedPriceId, selectedPriceId }) {
  if (!requestedPriceId) {
    return { ok: true };
  }

  if (isForbiddenNewSubscriptionAgencyPriceId(requestedPriceId)) {
    return {
      ok: false,
      status: 403,
      code: 'LEGACY_AGENCY_PRICE_FORBIDDEN',
      error: 'This subscription price is not available for new signups.',
    };
  }

  if (requestedPriceId !== selectedPriceId) {
    return {
      ok: false,
      status: 400,
      code: 'CHECKOUT_PRICE_MISMATCH',
      error: 'Requested Stripe price does not match the server-side billing catalog.',
    };
  }

  return { ok: true };
}

function buildFoundingAccessSubscriptionMetadata() {
  return {
    offerKey: FOUNDING_ACCESS_OFFER_KEY,
    priorityAccess: true,
    priorityFeatureAccess: true,
    founderBadge: true,
  };
}

async function recordBillingSyncOutcome({
  orgId,
  event,
  eventName,
  sync,
  metadata = {},
}) {
  await recordProductEvent({
    orgId,
    eventName: sync?.skipped ? 'billing.subscription_sync_skipped' : eventName,
    metadata: {
      ...metadata,
      stripeEventId: event.id,
      stripeEventType: event.type,
      stripeEventCreated: event.created ?? null,
      skipped: Boolean(sync?.skipped),
      skipReason: sync?.reason ?? null,
    },
  });
}

export default router;

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
import {
  completeCreditPurchase,
  createPendingCreditPurchase,
  getBillingCatalog,
  getBillingSnapshotForOrg,
  getPackCheckoutConfig,
  setSubscriptionPlan,
} from '../services/billing-engine.js';
import { getPlanConfig } from '../services/entitlements.js';
import { recordAuditLog, recordProductEvent } from '../services/telemetry.js';
import { getSeatSnapshot } from '../services/team.js';

const router = new Hono();

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
    apiVersion: '2024-09-30.acacia',
  });
}

router.post('/checkout', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const stripe = getStripe();
  const org = context.get('org');
  const { plan, interval = 'monthly' } = await context.req.json();
  const priceId = PRICE_IDS[plan]?.[interval];

  if (!PRICE_IDS[plan]) {
    return context.json({ error: 'Invalid plan.' }, 400);
  }

  if (!['monthly', 'quarterly', 'yearly'].includes(interval)) {
    return context.json({ error: 'Invalid billing interval.' }, 400);
  }

  if (!priceId) {
    return context.json({ error: 'Selected billing interval is not configured.' }, 400);
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
    metadata: { orgId: org.orgId, plan, interval },
    subscription_data: {
      metadata: { orgId: org.orgId, plan, interval },
    },
  });

  await recordProductEvent({
    orgId: org.orgId,
    userId: org.userId,
    eventName: 'billing.checkout_started',
    metadata: { plan, interval },
  });

  return context.json({ url: session.url });
});

router.post('/packs/checkout', requireOrg, requireRole('owner', 'admin'), async (context) => {
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

router.post('/portal', requireOrg, requireRole('owner', 'admin'), async (context) => {
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

router.post('/seat-addon', requireOrg, requireRole('owner', 'admin'), async (context) => {
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
    catalog: getBillingCatalog(),
    executionCredits: {
      ...execution,
      limit: planConfig.monthlyCreditLimit,
    },
    videoCredits: {
      ...video,
      limit: getPlanConfig(organisation?.plan).monthlyVideoCredits,
    },
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
  } catch (error) {
    return context.json({ error: error.message }, 400);
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
        await setSubscriptionPlan({
          orgId: session.metadata.orgId,
          planId: session.metadata.plan,
          billingInterval: session.metadata.interval ?? 'monthly',
        });
        await db
          .update(organisations)
          .set({
            stripeSubId: String(session.subscription ?? ''),
          })
          .where(eq(organisations.id, session.metadata.orgId));

        await Promise.all([
          recordAuditLog({
            orgId: session.metadata.orgId,
            action: 'billing.plan_changed',
            targetType: 'organisation',
            targetId: session.metadata.orgId,
            metadata: {
              plan: session.metadata.plan,
              interval: session.metadata.interval ?? 'monthly',
              source: 'checkout.session.completed',
            },
          }),
          recordProductEvent({
            orgId: session.metadata.orgId,
            eventName: 'billing.plan_changed',
            metadata: {
              plan: session.metadata.plan,
              interval: session.metadata.interval ?? 'monthly',
            },
          }),
        ]);
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
        await setSubscriptionPlan({
          orgId,
          planId: resolvedPlan.plan,
          billingInterval: resolvedPlan.interval ?? 'monthly',
        });
        await recordProductEvent({
          orgId,
          eventName: 'billing.subscription_updated',
          metadata: resolvedPlan,
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customer = await stripe.customers.retrieve(String(subscription.customer));
      const orgId = customer.deleted ? null : customer.metadata?.orgId;

      if (orgId) {
        await setSubscriptionPlan({
          orgId,
          planId: 'free',
          billingInterval: 'monthly',
        });
        await db
          .update(organisations)
          .set({
            stripeSubId: null,
          })
          .where(eq(organisations.id, orgId));
        await recordProductEvent({
          orgId,
          eventName: 'billing.subscription_cancelled',
        });
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const customer = await stripe.customers.retrieve(String(invoice.customer));
      const orgId = customer.deleted ? null : customer.metadata?.orgId;

      if (orgId && invoice.billing_reason === 'subscription_cycle') {
        const [organisation, existingSubscription] = await Promise.all([
          db.query.organisations.findFirst({
            where: eq(organisations.id, orgId),
          }),
          db.query.subscriptions.findFirst({
            where: eq(subscriptions.orgId, orgId),
          }),
        ]);

        if (organisation) {
          await setSubscriptionPlan({
            orgId,
            planId: organisation.plan,
            billingInterval: existingSubscription?.billingInterval ?? 'monthly',
          });
        }
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
      COALESCE(SUM(estimated_cost_usd), 0)::double precision AS estimated_cost_usd
    FROM llm_execution_traces
    WHERE org_id = ${org.orgId}
      AND created_at > NOW() - (${days} || ' days')::interval
    GROUP BY agent_id
    HAVING COUNT(*) > 0
    ORDER BY estimated_cost_usd DESC
  `);

  const rows = result.rows ?? result;
  const totalRuns = rows.reduce((sum, row) => sum + Number(row.runs ?? 0), 0);
  const totalTokens = rows.reduce((sum, row) => sum + Number(row.total_tokens ?? 0), 0);
  const totalCostUsd = rows.reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0);

  const breakdown = rows.map((row) => ({
    agentId: row.agent_id,
    runs: Number(row.runs ?? 0),
    successCount: Number(row.success_count ?? 0),
    failureCount: Number(row.failure_count ?? 0),
    totalTokens: Number(row.total_tokens ?? 0),
    estimatedCostUsd: Number(row.estimated_cost_usd ?? 0).toFixed(6),
    shareOfTotal: totalCostUsd > 0 ? Number(row.estimated_cost_usd ?? 0) / totalCostUsd : 0,
  }));

  return context.json({
    days,
    totalRuns,
    totalTokens,
    totalCostUsd: totalCostUsd.toFixed(6),
    breakdown,
  });
});

function planFromPriceId(priceId) {
  for (const [plan, intervals] of Object.entries(PRICE_IDS)) {
    const intervalEntry = Object.entries(intervals).find(([, value]) => value === priceId);
    if (intervalEntry) {
      return { plan, interval: intervalEntry[0] };
    }
  }

  return null;
}

export default router;

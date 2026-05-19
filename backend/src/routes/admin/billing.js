// routes/admin/billing.js
import Stripe from 'stripe';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../../db/index.js';
import {
  creditAdjustments,
  organisations,
  videoGenerationEvents,
} from '../../db/schema.js';
import { hasConfiguredStripe } from '../../env.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';
import { RATE_LIMIT_CONFIGS } from '../../middleware/rate-limit-config.js';
import { findAdminMutationReplay, getAdminMutationMeta } from '../../services/admin-mutations.js';
import { applyCreditAdjustment, getBillingSnapshotForOrg } from '../../services/billing-engine.js';
import { enrichAdminEconomicsDashboard } from '../../services/billing-admin-economics.js';
import { getMonthlyInternalBurnCapGbp } from '../../services/billing-catalog.js';
import { recordAdminActionLog } from '../../services/telemetry.js';

const router = new Hono();
const adminSensitiveWriteRateLimit = createRateLimiter({
  ...RATE_LIMIT_CONFIGS.adminSensitiveWrite,
  identifier: (context) => context.get('staff')?.userId ?? 'unknown',
});

const PLAN_PRICES_GBP = { free: 0, solo: 49.99, pro: 99, teams: 179, agency: 299 };

const creditAdjustmentSchema = z.object({
  delta: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0, { message: 'Delta cannot be zero.' }),
  reasonCode: z.string().trim().min(2).max(80).optional().default('manual_credit_adjustment'),
  reason: z.string().trim().min(4).max(500).optional().default('Adjusted in staff console.'),
});

function getStripe() {
  if (!hasConfiguredStripe()) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' });
}

router.get('/revenue', requireStaff, requireStaffPermission('admin.billing.read'), async (context) => {
  const orgRows = await db.query.organisations.findMany({ orderBy: [desc(organisations.createdAt)] });
  const subscriptionRows = await db.query.subscriptions.findMany();
  const creditPurchaseRows = await db.query.creditPurchases.findMany();

  const planCounts = {};
  for (const org of orgRows) {
    planCounts[org.plan] = (planCounts[org.plan] ?? 0) + 1;
  }

  const planDistribution = Object.entries(PLAN_PRICES_GBP).map(([plan, price]) => ({
    plan,
    count: planCounts[plan] ?? 0,
    priceGbp: price,
    estimatedMrrGbp: (planCounts[plan] ?? 0) * price,
  }));

  const estimatedMrrTotalGbp = planDistribution.reduce((sum, row) => sum + row.estimatedMrrGbp, 0);
  const paidCustomers = planDistribution.filter((row) => row.priceGbp > 0).reduce((sum, row) => sum + row.count, 0);

  const burnByPlan = {};
  let rollUpEstimatedProviderCostGbp = 0;
  for (const sub of subscriptionRows) {
    const burn = Number(sub.cumulativeEstimatedCostGbp ?? 0) || 0;
    rollUpEstimatedProviderCostGbp += burn;
    burnByPlan[sub.plan] = (burnByPlan[sub.plan] ?? 0) + burn;
  }

  let approxHeadroomToInternalCapGbp = 0;
  for (const sub of subscriptionRows) {
    const cap = getMonthlyInternalBurnCapGbp(sub.plan);
    const burn = Number(sub.cumulativeEstimatedCostGbp ?? 0) || 0;
    approxHeadroomToInternalCapGbp += Math.max(0, cap - burn);
  }

  const economicsDashboard = await enrichAdminEconomicsDashboard(db, {
    planDistribution,
    rollUpEstimatedProviderCostGbp,
    approxHeadroomToInternalCapGbp,
    estimatedMrrTotalGbp,
  });
  const addOnRevenueGbp = creditPurchaseRows
    .filter((purchase) => purchase.status === 'completed')
    .reduce((sum, purchase) => sum + (Number(purchase.amountGbp ?? 0) || 0), 0);
  economicsDashboard.revenueMix = {
    planMrrGbp: estimatedMrrTotalGbp,
    addOnRevenueGbp,
    addOnToPlanRevenueRatio: estimatedMrrTotalGbp > 0 ? addOnRevenueGbp / estimatedMrrTotalGbp : null,
  };

  const stripe = getStripe();
  let stripeConfigured = false;
  let stripeMrr = 0;
  let recentInvoices = [];
  let monthlyRevenueSeries = [];

  if (stripe) {
    stripeConfigured = true;
    try {
      const [stripeSubscriptions, invoices] = await Promise.all([
        stripe.subscriptions.list({ limit: 100, status: 'active' }),
        stripe.invoices.list({ limit: 100, status: 'paid' }),
      ]);

      for (const sub of stripeSubscriptions.data) {
        for (const item of sub.items.data) {
          const amount = item.plan?.amount ?? 0;
          const interval = item.plan?.interval ?? 'month';
          const intervalCount = item.plan?.interval_count ?? 1;
          const monthlyAmount = interval === 'year'
            ? amount / (12 * intervalCount)
            : interval === 'week'
              ? (amount * 52) / 12
              : amount / intervalCount;
          stripeMrr += monthlyAmount;
        }
      }
      stripeMrr = Math.round(stripeMrr) / 100;

      recentInvoices = invoices.data.slice(0, 20).map((invoice) => ({
        id: invoice.id, number: invoice.number,
        amountPaid: invoice.amount_paid / 100,
        currency: invoice.currency?.toUpperCase() ?? 'USD',
        createdAt: invoice.created ? new Date(invoice.created * 1000).toISOString() : null,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
      }));

      const buckets = new Map();
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const key = d.toISOString().slice(0, 7);
        buckets.set(key, { month: key, revenue: 0, count: 0 });
      }
      for (const invoice of invoices.data) {
        if (!invoice.created) continue;
        const key = new Date(invoice.created * 1000).toISOString().slice(0, 7);
        if (buckets.has(key)) {
          const bucket = buckets.get(key);
          bucket.revenue += invoice.amount_paid / 100;
          bucket.count += 1;
        }
      }
      monthlyRevenueSeries = Array.from(buckets.values());
    } catch (error) {
      stripeConfigured = false;
      console.error('[ADMIN REVENUE] Stripe fetch failed:', error.message);
    }
  }

  return context.json({
    currency: 'GBP',
    estimatedMrrTotalGbp,
    paidCustomers,
    totalOrgs: orgRows.length,
    planDistribution,
    economicsDashboard,
    usageEconomics: {
      rollUpEstimatedProviderCostGbp,
      burnByPlan,
      approxHeadroomToInternalCapGbp,
    },
    stripeConfigured,
    stripeMrrGbp: stripeMrr,
    recentInvoices,
    monthlyRevenueSeries,
  });
});

router.post(
  '/organisations/:orgId/credits/adjust',
  requireStaff,
  requireStaffPermission('admin.credits.adjust'),
  adminSensitiveWriteRateLimit,
  zValidator('json', creditAdjustmentSchema),
  async (context) => {
    const staff = context.get('staff');
    const { orgId } = context.req.param();
    const payload = context.req.valid('json');
    const mutationMeta = getAdminMutationMeta(context);
    const replay = await findAdminMutationReplay({
      actorUserId: staff.userId,
      action: 'admin.credits.adjust',
      idempotencyKey: mutationMeta.idempotencyKey,
    });

    if (replay) {
      return context.json({
        organisation: replay.metadata?.organisation ?? null,
        adjustment: replay.metadata?.adjustment ?? null,
        receipt: replay,
        replayed: true,
      });
    }

    const existingSnapshot = await getBillingSnapshotForOrg(orgId).catch(() => null);
    if (!existingSnapshot?.organisation) {
      return context.json({ error: 'Organisation not found.' }, 404);
    }

    const previousCreditsUsed = existingSnapshot.credits.execution.committedThisCycle ?? 0;
    const updatedSnapshot = await applyCreditAdjustment({
      orgId,
      creditType: 'execution',
      delta: payload.delta,
      source: 'admin',
      entryType: 'adjustment',
      metadata: {
        reasonCode: payload.reasonCode,
        reason: payload.reason ?? null,
        actorUserId: staff.userId,
      },
    });
    const nextCreditsUsed = updatedSnapshot.credits.execution.committedThisCycle ?? 0;
    const updatedOrg = updatedSnapshot.organisation;

    const [adjustment] = await db.insert(creditAdjustments).values({
      orgId, actorUserId: staff.userId, delta: payload.delta,
      previousCreditsUsed, nextCreditsUsed,
      reasonCode: payload.reasonCode, reason: payload.reason ?? null,
    }).returning();

    const receipt = await recordAdminActionLog({
      orgId, actorUserId: staff.userId, actorStaffRole: staff.staffRole,
      action: 'admin.credits.adjust', permission: 'admin.credits.adjust',
      targetType: 'credit_adjustment', targetId: adjustment.id,
      requestId: mutationMeta.requestId,
      idempotencyKey: mutationMeta.idempotencyKey,
      reasonCode: payload.reasonCode, reason: payload.reason ?? null,
      metadata: {
        delta: payload.delta,
        previousCreditsUsed,
        nextCreditsUsed,
        organisation: updatedOrg,
        adjustment,
      },
    });

    return context.json({ organisation: updatedOrg, adjustment, receipt });
  },
);

router.get('/organisations/:orgId/credit-adjustments', requireStaff, requireStaffPermission('admin.credits.read'), async (context) => {
  const { orgId } = context.req.param();
  const rows = await db.query.creditAdjustments.findMany({
    where: eq(creditAdjustments.orgId, orgId),
    orderBy: [desc(creditAdjustments.createdAt)],
    limit: 100,
  });
  return context.json({ adjustments: rows, count: rows.length });
});

router.get('/credit-usage', requireStaff, requireStaffPermission('admin.credits.read'), async (context) => {
  const rows = await db.query.organisations.findMany({ orderBy: [desc(organisations.creditsUsed)] });
  const totalCreditsUsed = rows.reduce((sum, org) => sum + (org.creditsUsed ?? 0), 0);
  return context.json({
    totalCreditsUsed,
    organisations: rows.map((org) => ({
      id: org.id, name: org.name, slug: org.slug, plan: org.plan,
      creditsUsed: org.creditsUsed ?? 0, monthlyCreditLimit: org.monthlyCreditLimit,
      usagePercent: org.monthlyCreditLimit > 0 ? Math.round(((org.creditsUsed ?? 0) / org.monthlyCreditLimit) * 100) : 0,
    })),
  });
});

router.get('/video-jobs', requireStaff, requireStaffPermission('admin.billing.read'), async (context) => {
  const limit = Math.min(Math.max(Number(context.req.query('limit') ?? 40), 1), 100);
  const [jobs, orgRows, userRows] = await Promise.all([
    db.query.videoGenerationEvents.findMany({
      orderBy: [desc(videoGenerationEvents.createdAt)],
      limit,
    }),
    db.query.organisations.findMany(),
    db.query.users.findMany(),
  ]);

  const orgMap = new Map(orgRows.map((org) => [org.id, org]));
  const userMap = new Map(userRows.map((user) => [user.id, user]));

  return context.json({
    jobs: jobs.map((job) => {
      const org = orgMap.get(job.orgId);
      const user = job.userId ? userMap.get(job.userId) : null;
      const outputAsset = job.providerMetadata?.outputAsset ?? null;

      return {
        id: job.id,
        orgId: job.orgId,
        orgName: org?.name ?? null,
        userId: job.userId,
        userEmail: user?.email ?? null,
        mode: job.providerMetadata?.mode ?? 'lite',
        providerLabel: job.providerMetadata?.providerLabel ?? null,
        durationSeconds: job.durationSeconds,
        resolution: job.resolution,
        aspectRatio: job.aspectRatio,
        referenceImageCount: Number(job.providerMetadata?.referenceImageCount ?? 0),
        status: job.status,
        creditsRequested: job.creditsRequested,
        creditsReserved: job.creditsReserved,
        creditsCommitted: job.creditsCommitted,
        provider: job.provider,
        model: job.model,
        providerJobId: job.providerJobId,
        storageProvider: job.providerMetadata?.storageProvider ?? null,
        cloudinaryPublicId: outputAsset?.publicId ?? null,
        cloudinaryResourceType: outputAsset?.resourceType ?? null,
        secureUrl: outputAsset?.secureUrl ?? null,
        deliveryUrl: outputAsset?.deliveryUrl ?? job.outputUrl ?? null,
        bytes: outputAsset?.bytes ?? null,
        duration: outputAsset?.duration ?? null,
        format: outputAsset?.format ?? null,
        cleanupStatus: outputAsset?.cleanupStatus ?? null,
        failureCode: job.failureCode,
        failureMessage: job.failureMessage,
        providerErrorType: job.providerMetadata?.providerErrorType ?? null,
        providerErrorCategory: job.providerMetadata?.providerErrorCategory ?? null,
        retryCount: job.retryCount,
        maxRetries: job.maxRetries,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      };
    }),
  });
});

export default router;

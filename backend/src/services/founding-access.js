import { and, count, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  creditLedgerExecution,
  creditLedgerVideo,
  foundingAccessClaims,
  foundingAccessLeads,
  offerConfigs,
  subscriptions,
} from '../db/schema.js';
import { CREDIT_TYPES, getBillingPlan } from './billing-catalog.js';
import { recordProductEvent } from './telemetry.js';

export const FOUNDING_ACCESS_OFFER_KEY = 'FOUNDING_ACCESS';
/** Legacy telemetry id — kept so existing ledger rows remain explainable */
export const FOUNDING_ACCESS_LEGACY_FIRST_MONTH_2X = 'FOUNDING_ACCESS_FIRST_MONTH_2X';
export const FOUNDING_ACCESS_ONBOARDING_BONUS_REASON = 'FOUNDING_ACCESS_ONBOARDING_BONUS_EXECUTION';

export function getFoundingOnboardingBonusExecutionCredits() {
  const raw = Number(process.env.FOUNDING_ACCESS_ONBOARDING_EXECUTION_CREDITS ?? 250);
  if (!Number.isFinite(raw) || raw < 0) return 250;
  return Math.min(Math.floor(raw), 5_000);
}
export const FOUNDING_ACCESS_COUNTED_STATUSES = ['claimed', 'active'];
export const FOUNDING_ACCESS_LEAD_SOURCES = ['exit_intent', 'delayed_popup', 'pricing_banner'];

export const PUBLIC_FOUNDING_ACCESS_COPY = {
  headline: 'Founding Access: 20% off for your first 3 months',
  subtext:
    'Founders get reduced subscription pricing during the founding window, onboarding bonus credits, a founder badge, and priority onboarding. Standard monthly usage allowances apply.',
  benefits: [
    'Founding subscription discount for the founding window',
    'Bonus launch execution credits once per workspace',
    'Founder badge and early roadmap access',
    'Priority onboarding',
  ],
};

export async function getFoundingAccessState({ tx = db, now = new Date() } = {}) {
  const config = await ensureFoundingAccessConfig(tx);
  const claimedPaidFounders = await countFoundingAccessClaims(tx);
  const active = isFoundingAccessConfigActive(config, now)
    && claimedPaidFounders < Number(config.maxPaidClaims ?? 25);

  return {
    active,
    offerKey: FOUNDING_ACCESS_OFFER_KEY,
    claimedPaidFounders,
    config,
  };
}

export function serializePublicFoundingAccessOffer(state, viewer = null) {
  return {
    active: Boolean(state?.active),
    offerKey: FOUNDING_ACCESS_OFFER_KEY,
    headline: PUBLIC_FOUNDING_ACCESS_COPY.headline,
    subtext: PUBLIC_FOUNDING_ACCESS_COPY.subtext,
    benefits: PUBLIC_FOUNDING_ACCESS_COPY.benefits,
    viewer: viewer
      ? {
          isPayingSubscriber: Boolean(viewer.isPayingSubscriber),
          hasFoundingAccess: Boolean(viewer.hasFoundingAccess),
        }
      : undefined,
  };
}

export async function getFoundingAccessEligibilityForOrg(orgId, { tx = db, now = new Date() } = {}) {
  if (!orgId) {
    return { eligible: false, reason: 'missing_org' };
  }

  const state = await getFoundingAccessState({ tx, now });
  if (!state.active) {
    return { eligible: false, reason: 'offer_inactive', state };
  }

  const existing = await tx.query.foundingAccessClaims.findFirst({
    where: and(
      eq(foundingAccessClaims.offerKey, FOUNDING_ACCESS_OFFER_KEY),
      eq(foundingAccessClaims.orgId, orgId),
      ne(foundingAccessClaims.status, 'revoked'),
    ),
  });

  if (existing) {
    return { eligible: false, reason: 'founding_access_already_claimed', state, claim: existing };
  }

  return { eligible: true, reason: null, state };
}

export async function claimFoundingAccess({
  orgId,
  userId = null,
  planId,
  stripeCustomerId = null,
  stripeSubscriptionId = null,
  stripeCheckoutSessionId = null,
  stripeEventId = null,
  metadata = {},
}) {
  if (!orgId || !planId) {
    return { applied: false, reason: 'missing_claim_context', claim: null };
  }

  return db.transaction(async (tx) => {
    await ensureFoundingAccessConfig(tx);
    await tx.execute(sql`SELECT offer_key FROM offer_configs WHERE offer_key = ${FOUNDING_ACCESS_OFFER_KEY} FOR UPDATE`);

    if (stripeSubscriptionId) {
      const existingForSubscription = await tx.query.foundingAccessClaims.findFirst({
        where: eq(foundingAccessClaims.stripeSubscriptionId, stripeSubscriptionId),
      });

      if (existingForSubscription) {
        return { applied: true, reason: 'existing_subscription_claim', claim: existingForSubscription };
      }
    }

    const eligibility = await getFoundingAccessEligibilityForOrg(orgId, { tx });
    if (!eligibility.eligible) {
      return { applied: false, reason: eligibility.reason, claim: eligibility.claim ?? null };
    }

    const [claim] = await tx
      .insert(foundingAccessClaims)
      .values({
        offerKey: FOUNDING_ACCESS_OFFER_KEY,
        userId,
        orgId,
        stripeCustomerId,
        stripeSubscriptionId,
        planId,
        status: 'claimed',
        metadata: {
          ...metadata,
          stripeCheckoutSessionId,
          stripeEventId,
        },
      })
      .returning();

    await recordProductEvent({
      orgId,
      userId,
      eventName: 'founding_access_claim_created',
      metadata: {
        claimId: claim.id,
        planId,
        stripeSubscriptionId,
        stripeEventId,
      },
    });

    const state = await getFoundingAccessState({ tx });
    if (!state.active) {
      await recordProductEvent({
        orgId,
        userId,
        eventName: 'founding_access_deactivated_cap_reached',
        metadata: { offerKey: FOUNDING_ACCESS_OFFER_KEY },
      });
    }

    return { applied: true, reason: null, claim };
  });
}

export async function activateFoundingAccessClaim({
  orgId,
  stripeSubscriptionId = null,
  stripeCustomerId = null,
  stripeInvoiceId = null,
  stripeEventId = null,
}) {
  if (!orgId && !stripeSubscriptionId) {
    return { applied: false, reason: 'missing_activation_context', claim: null };
  }

  return db.transaction(async (tx) => {
    let claim = await findClaimForActivation(tx, { orgId, stripeSubscriptionId });

    if (!claim) {
      return { applied: false, reason: 'claim_not_found', claim: null };
    }

    if (['cancelled', 'revoked'].includes(claim.status)) {
      return { applied: false, reason: 'claim_not_active', claim };
    }

    const now = new Date();
    const [activatedClaim] = await tx
      .update(foundingAccessClaims)
      .set({
        status: 'active',
        stripeCustomerId: stripeCustomerId ?? claim.stripeCustomerId,
        stripeSubscriptionId: stripeSubscriptionId ?? claim.stripeSubscriptionId,
        activatedAt: claim.activatedAt ?? now,
        metadata: {
          ...(claim.metadata ?? {}),
          stripeInvoiceId,
          activationStripeEventId: stripeEventId,
        },
        updatedAt: now,
      })
      .where(eq(foundingAccessClaims.id, claim.id))
      .returning();

    const boost = await applyFoundingAccessCreditBoost(tx, {
      claim: activatedClaim,
      orgId: activatedClaim.orgId ?? orgId,
      stripeInvoiceId,
      stripeEventId,
    });

    await recordProductEvent({
      orgId: activatedClaim.orgId ?? orgId,
      userId: activatedClaim.userId,
      eventName: 'founding_access_activated',
      metadata: {
        claimId: activatedClaim.id,
        stripeSubscriptionId,
        stripeInvoiceId,
        creditBoostApplied: boost.applied,
      },
    });

    return { applied: true, reason: null, claim: activatedClaim, boost };
  });
}

export async function cancelFoundingAccessClaim({
  orgId,
  stripeSubscriptionId = null,
  stripeEventId = null,
}) {
  if (!orgId && !stripeSubscriptionId) {
    return { updated: false, reason: 'missing_cancel_context', claim: null };
  }

  const claim = await db.query.foundingAccessClaims.findFirst({
    where: stripeSubscriptionId
      ? eq(foundingAccessClaims.stripeSubscriptionId, stripeSubscriptionId)
      : and(
          eq(foundingAccessClaims.offerKey, FOUNDING_ACCESS_OFFER_KEY),
          eq(foundingAccessClaims.orgId, orgId),
          inArray(foundingAccessClaims.status, FOUNDING_ACCESS_COUNTED_STATUSES),
        ),
  });

  if (!claim || ['cancelled', 'revoked'].includes(claim.status)) {
    return { updated: false, reason: 'claim_not_found_or_closed', claim };
  }

  const [updated] = await db
    .update(foundingAccessClaims)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      metadata: {
        ...(claim.metadata ?? {}),
        cancellationStripeEventId: stripeEventId,
      },
      updatedAt: new Date(),
    })
    .where(eq(foundingAccessClaims.id, claim.id))
    .returning();

  return { updated: true, reason: null, claim: updated };
}

export async function createFoundingAccessLead({
  email,
  source = 'pricing_banner',
  convertedUserId = null,
  metadata = {},
}) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  const normalizedSource = FOUNDING_ACCESS_LEAD_SOURCES.includes(source) ? source : 'pricing_banner';

  const [lead] = await db
    .insert(foundingAccessLeads)
    .values({
      email: normalizedEmail,
      source: normalizedSource,
      convertedUserId,
      metadata,
    })
    .onConflictDoUpdate({
      target: foundingAccessLeads.email,
      set: {
        source: normalizedSource,
        convertedUserId,
        metadata: {
          ...metadata,
          lastSubmittedAt: new Date().toISOString(),
        },
      },
    })
    .returning();

  await recordProductEvent({
    userId: convertedUserId,
    eventName: 'founder_lead_created',
    metadata: {
      leadId: lead.id,
      source: normalizedSource,
    },
  });

  return lead;
}

export async function getFoundingAccessAdminSnapshot({ tx = db } = {}) {
  const state = await getFoundingAccessState({ tx });
  const [{ totalLeads = 0 } = {}] = await tx
    .select({ totalLeads: count() })
    .from(foundingAccessLeads);
  const recentClaims = await tx.query.foundingAccessClaims.findMany({
    orderBy: [desc(foundingAccessClaims.createdAt)],
    limit: 12,
  });

  return {
    active: state.active,
    offerKey: FOUNDING_ACCESS_OFFER_KEY,
    paidClaimsCount: state.claimedPaidFounders,
    leadCount: Number(totalLeads),
    recentClaims,
  };
}

export function isFoundingAccessConfigActive(config, now = new Date()) {
  if (!config?.isEnabled) {
    return false;
  }

  const startsAt = config.startsAt ? new Date(config.startsAt) : null;
  const endsAt = config.endsAt ? new Date(config.endsAt) : null;

  if (startsAt && startsAt.getTime() > now.getTime()) {
    return false;
  }

  if (endsAt && endsAt.getTime() <= now.getTime()) {
    return false;
  }

  return true;
}

async function ensureFoundingAccessConfig(tx) {
  const existing = await tx.query.offerConfigs.findFirst({
    where: eq(offerConfigs.offerKey, FOUNDING_ACCESS_OFFER_KEY),
  });

  if (existing) {
    return existing;
  }

  const [config] = await tx
    .insert(offerConfigs)
    .values({
      offerKey: FOUNDING_ACCESS_OFFER_KEY,
      maxPaidClaims: 25,
      isEnabled: true,
      metadata: { headline: PUBLIC_FOUNDING_ACCESS_COPY.headline },
    })
    .onConflictDoNothing()
    .returning();

  return config ?? await tx.query.offerConfigs.findFirst({
    where: eq(offerConfigs.offerKey, FOUNDING_ACCESS_OFFER_KEY),
  });
}

async function countFoundingAccessClaims(tx) {
  const [{ total = 0 } = {}] = await tx
    .select({ total: count() })
    .from(foundingAccessClaims)
    .where(and(
      eq(foundingAccessClaims.offerKey, FOUNDING_ACCESS_OFFER_KEY),
      inArray(foundingAccessClaims.status, FOUNDING_ACCESS_COUNTED_STATUSES),
    ));

  return Number(total);
}

async function findClaimForActivation(tx, { orgId, stripeSubscriptionId }) {
  if (stripeSubscriptionId) {
    const bySubscription = await tx.query.foundingAccessClaims.findFirst({
      where: eq(foundingAccessClaims.stripeSubscriptionId, stripeSubscriptionId),
    });

    if (bySubscription) {
      return bySubscription;
    }
  }

  if (!orgId) {
    return null;
  }

  return tx.query.foundingAccessClaims.findFirst({
    where: and(
      eq(foundingAccessClaims.offerKey, FOUNDING_ACCESS_OFFER_KEY),
      eq(foundingAccessClaims.orgId, orgId),
      inArray(foundingAccessClaims.status, FOUNDING_ACCESS_COUNTED_STATUSES),
    ),
  });
}

async function applyFoundingAccessCreditBoost(tx, {
  claim,
  orgId,
  stripeInvoiceId = null,
  stripeEventId = null,
}) {
  if (!claim || claim.firstMonthCreditBoostAppliedAt) {
    return { applied: false, reason: 'already_applied' };
  }

  const subscription = await tx.query.subscriptions.findFirst({
    where: eq(subscriptions.orgId, orgId),
  });

  if (!subscription) {
    return { applied: false, reason: 'subscription_not_found' };
  }

  const executionBoost = getFoundingOnboardingBonusExecutionCredits();
  const now = new Date();
  const founderPeriodEndsAt = new Date(now);
  founderPeriodEndsAt.setMonth(founderPeriodEndsAt.getMonth() + 3);

  const [updatedClaim] = await tx
    .update(foundingAccessClaims)
    .set({
      firstMonthCreditBoostAppliedAt: now,
      founderPeriodEndsAt,
      metadata: {
        ...(claim.metadata ?? {}),
        onboardingExecutionBonus: {
          reason: FOUNDING_ACCESS_ONBOARDING_BONUS_REASON,
          executionCredits: executionBoost,
          videoCredits: 0,
          stripeInvoiceId,
          stripeEventId,
        },
      },
      updatedAt: now,
    })
    .where(and(
      eq(foundingAccessClaims.id, claim.id),
      isNull(foundingAccessClaims.firstMonthCreditBoostAppliedAt),
    ))
    .returning();

  if (!updatedClaim) {
    return { applied: false, reason: 'already_applied' };
  }

  const [nextSubscription] = await tx
    .update(subscriptions)
    .set({
      executionIncludedBalance: sql`${subscriptions.executionIncludedBalance} + ${executionBoost}`,
      metadata: {
        ...(subscription.metadata ?? {}),
        foundingAccess: {
          offerKey: FOUNDING_ACCESS_OFFER_KEY,
          claimId: claim.id,
          priorityAccess: true,
          priorityFeatureAccess: true,
          founderBadge: true,
          founderDiscountWindowEndsAt: founderPeriodEndsAt.toISOString(),
          onboardingBonusExecutionCredits: executionBoost,
          onboardingBonusReason: FOUNDING_ACCESS_ONBOARDING_BONUS_REASON,
        },
      },
      updatedAt: now,
    })
    .where(eq(subscriptions.id, subscription.id))
    .returning();

  await appendFoundingLedgerEntry(tx, CREDIT_TYPES.execution, {
    orgId,
    subscriptionId: nextSubscription.id,
    delta: executionBoost,
    includedBalanceAfter: nextSubscription.executionIncludedBalance,
    purchasedBalanceAfter: nextSubscription.executionPurchasedBalance,
    reservedBalanceAfter: nextSubscription.executionReservedBalance,
    metadata: {
      reason: FOUNDING_ACCESS_ONBOARDING_BONUS_REASON,
      offerKey: FOUNDING_ACCESS_OFFER_KEY,
      claimId: claim.id,
      planId: claim.planId,
      stripeInvoiceId,
      stripeEventId,
    },
  });

  await recordProductEvent({
    orgId,
    userId: claim.userId,
    eventName: 'founding_access_credit_boost_applied',
    metadata: {
      claimId: claim.id,
      executionCredits: executionBoost,
      videoCredits: 0,
      stripeInvoiceId,
      stripeEventId,
    },
  });

  return {
    applied: true,
    reason: null,
    executionCredits: executionBoost,
    videoCredits: 0,
  };
}

async function appendFoundingLedgerEntry(tx, creditType, {
  orgId,
  subscriptionId,
  delta,
  includedBalanceAfter,
  purchasedBalanceAfter,
  reservedBalanceAfter,
  metadata = {},
}) {
  const ledgerTable = creditType === CREDIT_TYPES.video ? creditLedgerVideo : creditLedgerExecution;

  await tx.insert(ledgerTable).values({
    orgId,
    subscriptionId,
    source: 'founding_access',
    entryType: 'grant',
    delta,
    balanceAfter: (includedBalanceAfter ?? 0) + (purchasedBalanceAfter ?? 0),
    includedBalanceAfter,
    purchasedBalanceAfter,
    reservedBalanceAfter,
    metadata,
  });
}

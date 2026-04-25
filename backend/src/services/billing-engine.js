import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  creditLedgerExecution,
  creditLedgerVideo,
  creditPurchases,
  executionUsageEvents,
  organisations,
  subscriptions,
  thresholdState,
  videoGenerationEvents,
} from '../db/schema.js';
import {
  BILLING_INTERVALS,
  CREDIT_TYPES,
  calculateExecutionCreditBurn,
  calculateVideoCreditBurn,
  canAccessAgent,
  detectHeavyUsage,
  estimateVideoProviderCostUsd,
  evaluateCostGuard,
  getBillingPlan,
  getCreditPack,
  getVideoGenerationMode,
  getPackStripePriceId,
  getThresholdPresentation,
  getUsageThreshold,
  serializeBillingCatalog,
  validateVideoGenerationRequest,
} from './billing-catalog.js';
import { recordProductEvent } from './telemetry.js';

const CREDIT_FIELD_MAP = {
  [CREDIT_TYPES.execution]: {
    includedKey: 'executionIncludedBalance',
    purchasedKey: 'executionPurchasedBalance',
    reservedKey: 'executionReservedBalance',
    ledgerTable: creditLedgerExecution,
  },
  [CREDIT_TYPES.video]: {
    includedKey: 'videoIncludedBalance',
    purchasedKey: 'videoPurchasedBalance',
    reservedKey: 'videoReservedBalance',
    ledgerTable: creditLedgerVideo,
  },
};

export function getBillingCatalog() {
  return serializeBillingCatalog();
}

export async function getCreditsContextForAuth(orgId) {
  const snapshot = await getBillingSnapshotForOrg(orgId);
  return snapshot.credits;
}

export async function getBillingSnapshotForOrg(orgId, { tx = db } = {}) {
  const { organisation, subscription } = await ensureSubscriptionForOrg(orgId, { tx });
  const execution = await getCreditSummary(tx, organisation, subscription, CREDIT_TYPES.execution);
  const video = await getCreditSummary(tx, organisation, subscription, CREDIT_TYPES.video);

  return {
    organisation,
    subscription,
    plan: organisation.plan,
    resetsAt: subscription.currentPeriodEnd,
    credits: {
      execution,
      video,
      remaining: execution.available,
      limit: getBillingPlan(organisation.plan).includedExecutionCredits,
      used: execution.committedThisCycle + execution.reserved,
    },
  };
}

export async function ensureSubscriptionForOrg(orgId, { tx = db, organisation: existingOrganisation = null } = {}) {
  const organisation = existingOrganisation ?? await tx.query.organisations.findFirst({
    where: eq(organisations.id, orgId),
  });

  if (!organisation) {
    const error = new Error('Organisation not found.');
    error.status = 404;
    error.code = 'ORG_NOT_FOUND';
    throw error;
  }

  let subscription = await tx.query.subscriptions.findFirst({
    where: eq(subscriptions.orgId, organisation.id),
  });

  if (!subscription) {
    subscription = await createSubscriptionForOrganisation(tx, organisation);
  }

  if (!subscription.currentPeriodEnd) {
    const now = new Date();
    [subscription] = await tx
      .update(subscriptions)
      .set({
        currentPeriodStart: subscription.currentPeriodStart ?? now,
        currentPeriodEnd: addBillingInterval(subscription.currentPeriodStart ?? now, subscription.billingInterval),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();
  }

  if (new Date(subscription.currentPeriodEnd).getTime() <= Date.now()) {
    subscription = await resetSubscriptionForNewCycle({
      orgId: organisation.id,
      tx,
      organisation,
      subscription,
    });
  }

  return { organisation, subscription };
}

export async function reserveExecutionCredits({
  orgId,
  userId = null,
  conversationId = null,
  workflowRunId = null,
  agentId,
  requestId = null,
  baseCredits = 1,
  estimatedContextTokens = 0,
  agentCount = 1,
  estimatedCostUsd = 0,
  metadata = {},
}) {
  return db.transaction(async (tx) => {
    const { organisation, subscription } = await ensureSubscriptionForOrg(orgId, { tx });
    const plan = getBillingPlan(organisation.plan);
    const activeCount = await countActiveUsage(tx, CREDIT_TYPES.execution, orgId);

    if (activeCount >= plan.concurrency.execution) {
      throw buildBillingError(
        `Execution concurrency limit reached for the ${plan.label} plan.`,
        429,
        'EXECUTION_CONCURRENCY_LIMIT',
      );
    }

    if (!canAccessAgent(organisation.plan, agentId)) {
      throw buildBillingError('This agent is not available on your current plan.', 403, 'AGENT_PLAN_LOCKED', true);
    }

    const burn = calculateExecutionCreditBurn({
      base: baseCredits,
      estimatedContextTokens,
      agentCount,
    });
    const balances = getAvailableBalances(subscription, CREDIT_TYPES.execution);

    assertCreditAvailability(CREDIT_TYPES.execution, balances.available, burn.creditsUsed);

    const reserved = reserveFromBalances(balances, burn.creditsUsed);
    const cycleSummaryBefore = await getCreditSummary(tx, organisation, subscription, CREDIT_TYPES.execution);
    const heavyUsage = detectHeavyUsage({
      percentUsed: cycleSummaryBefore.percentUsed,
      cycleAgeDays: getCycleAgeDays(subscription.currentPeriodStart),
    });
    const costGuard = evaluateCostGuard({
      creditType: CREDIT_TYPES.execution,
      credits: burn.creditsUsed,
      estimatedCostUsd,
    });

    const [usageEvent] = await tx
      .insert(executionUsageEvents)
      .values({
        orgId,
        userId,
        conversationId,
        workflowRunId,
        agentId,
        status: 'reserved',
        requestId,
        baseCredits: burn.base,
        estimatedContextTokens: burn.estimatedContextTokens,
        contextMultiplier: burn.contextMultiplier,
        agentCount: burn.agentCount,
        agentMultiplier: burn.agentMultiplier,
        creditsReserved: burn.creditsUsed,
        creditsCommitted: 0,
        estimatedCostUsd,
        revenueContributionGbp: costGuard.revenueContributionGbp,
        costGuardTriggered: costGuard.triggered,
        heavyUsageFlagged: heavyUsage.flagged,
        metadata: {
          ...metadata,
          reservationSplit: reserved.split,
          softThrottleMs: Math.max(costGuard.throttleDelayMs, heavyUsage.flagged ? 2_500 : 0),
        },
      })
      .returning();

    const [nextSubscription] = await tx
      .update(subscriptions)
      .set({
        executionIncludedBalance: reserved.includedBalance,
        executionPurchasedBalance: reserved.purchasedBalance,
        executionReservedBalance: reserved.reservedBalance,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();

    await appendLedgerEntry(tx, CREDIT_TYPES.execution, {
      orgId,
      subscriptionId: nextSubscription.id,
      usageEventId: usageEvent.id,
      source: 'burn',
      entryType: 'reservation',
      delta: -burn.creditsUsed,
      includedBalanceAfter: reserved.includedBalance,
      purchasedBalanceAfter: reserved.purchasedBalance,
      reservedBalanceAfter: reserved.reservedBalance,
      metadata: {
        reservationSplit: reserved.split,
        breakdown: burn,
      },
    });

    await syncLegacyOrganisationCounters(tx, organisation, nextSubscription);
    const threshold = await refreshThresholdState(tx, {
      orgId,
      subscription: nextSubscription,
      creditType: CREDIT_TYPES.execution,
    });

    return {
      usageEvent,
      burn,
      costGuard,
      heavyUsage,
      threshold,
      subscription: nextSubscription,
    };
  });
}

export async function commitExecutionUsage({
  usageEventId,
  provider = null,
  model = null,
  promptTokens = null,
  completionTokens = null,
  totalTokens = null,
  estimatedCostUsd = null,
  metadata = {},
}) {
  return db.transaction(async (tx) => {
    const usageEvent = await tx.query.executionUsageEvents.findFirst({
      where: eq(executionUsageEvents.id, usageEventId),
    });

    if (!usageEvent) {
      throw buildBillingError('Execution usage event not found.', 404, 'EXECUTION_USAGE_NOT_FOUND');
    }

    if (usageEvent.status === 'completed') {
      return { usageEvent };
    }

    if (usageEvent.status === 'released') {
      throw buildBillingError('Released execution reservations cannot be committed.', 409, 'EXECUTION_USAGE_RELEASED');
    }

    const { organisation, subscription } = await ensureSubscriptionForOrg(usageEvent.orgId, { tx });
    const balances = getAvailableBalances(subscription, CREDIT_TYPES.execution);
    const reservedBalanceAfter = Math.max(balances.reserved - (usageEvent.creditsReserved ?? 0), 0);
    const finalEstimatedCostUsd = estimatedCostUsd ?? usageEvent.estimatedCostUsd ?? 0;
    const costGuardSnapshot = evaluateCostGuard({
      creditType: CREDIT_TYPES.execution,
      credits: usageEvent.creditsReserved ?? usageEvent.creditsCommitted ?? 0,
      estimatedCostUsd: finalEstimatedCostUsd,
    });

    const [updatedEvent] = await tx
      .update(executionUsageEvents)
      .set({
        status: 'completed',
        provider: provider ?? usageEvent.provider,
        model: model ?? usageEvent.model,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: finalEstimatedCostUsd,
        estimatedCostGbp: costGuardSnapshot.estimatedCostGbp,
        creditsCommitted: usageEvent.creditsReserved,
        completedAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          ...(usageEvent.metadata ?? {}),
          ...metadata,
        },
      })
      .where(eq(executionUsageEvents.id, usageEvent.id))
      .returning();

    const [nextSubscription] = await tx
      .update(subscriptions)
      .set({
        executionReservedBalance: reservedBalanceAfter,
        cumulativeEstimatedCostUsd: sql`${subscriptions.cumulativeEstimatedCostUsd} + ${finalEstimatedCostUsd}`,
        cumulativeEstimatedCostGbp: sql`${subscriptions.cumulativeEstimatedCostGbp} + ${costGuardSnapshot.estimatedCostGbp}`,
        costGuardState: updatedEvent.costGuardTriggered ? 'throttled' : subscription.costGuardState,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();

    await appendLedgerEntry(tx, CREDIT_TYPES.execution, {
      orgId: usageEvent.orgId,
      subscriptionId: nextSubscription.id,
      usageEventId: usageEvent.id,
      source: 'burn',
      entryType: 'commit',
      delta: 0,
      includedBalanceAfter: nextSubscription.executionIncludedBalance,
      purchasedBalanceAfter: nextSubscription.executionPurchasedBalance,
      reservedBalanceAfter,
      metadata: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: finalEstimatedCostUsd || null,
        estimatedCostGbp: costGuardSnapshot.estimatedCostGbp || null,
      },
    });

    await syncLegacyOrganisationCounters(tx, organisation, nextSubscription);
    const threshold = await refreshThresholdState(tx, {
      orgId: usageEvent.orgId,
      subscription: nextSubscription,
      creditType: CREDIT_TYPES.execution,
    });

    if (updatedEvent.costGuardTriggered || updatedEvent.heavyUsageFlagged) {
      await recordProductEvent({
        orgId: usageEvent.orgId,
        userId: usageEvent.userId,
        eventName: updatedEvent.costGuardTriggered ? 'cost_guard_triggered' : 'high_usage_warning',
        metadata: {
          usageEventId: usageEvent.id,
          agentId: usageEvent.agentId,
          estimatedCostUsd: finalEstimatedCostUsd,
          estimatedCostGbp: costGuardSnapshot.estimatedCostGbp,
          revenueContributionGbp: updatedEvent.revenueContributionGbp ?? null,
          heavyUsageFlagged: updatedEvent.heavyUsageFlagged,
        },
      });
    }

    return { usageEvent: updatedEvent, threshold, subscription: nextSubscription };
  });
}

export async function releaseExecutionUsage({ usageEventId, reason = 'Reservation released', metadata = {} }) {
  return db.transaction(async (tx) => {
    const usageEvent = await tx.query.executionUsageEvents.findFirst({
      where: eq(executionUsageEvents.id, usageEventId),
    });

    if (!usageEvent) {
      throw buildBillingError('Execution usage event not found.', 404, 'EXECUTION_USAGE_NOT_FOUND');
    }

    if (usageEvent.status === 'released') {
      return { usageEvent };
    }

    const { organisation, subscription } = await ensureSubscriptionForOrg(usageEvent.orgId, { tx });
    const balances = getAvailableBalances(subscription, CREDIT_TYPES.execution);
    const restored = restoreReservationToBalances(
      balances,
      usageEvent.creditsReserved ?? 0,
      usageEvent.metadata?.reservationSplit,
    );

    const [updatedEvent] = await tx
      .update(executionUsageEvents)
      .set({
        status: 'released',
        completedAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          ...(usageEvent.metadata ?? {}),
          ...metadata,
          releaseReason: reason,
        },
      })
      .where(eq(executionUsageEvents.id, usageEvent.id))
      .returning();

    const [nextSubscription] = await tx
      .update(subscriptions)
      .set({
        executionIncludedBalance: restored.includedBalance,
        executionPurchasedBalance: restored.purchasedBalance,
        executionReservedBalance: restored.reservedBalance,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();

    await appendLedgerEntry(tx, CREDIT_TYPES.execution, {
      orgId: usageEvent.orgId,
      subscriptionId: nextSubscription.id,
      usageEventId: usageEvent.id,
      source: 'burn',
      entryType: 'release',
      delta: usageEvent.creditsReserved ?? 0,
      includedBalanceAfter: restored.includedBalance,
      purchasedBalanceAfter: restored.purchasedBalance,
      reservedBalanceAfter: restored.reservedBalance,
      metadata: {
        reason,
      },
    });

    await syncLegacyOrganisationCounters(tx, organisation, nextSubscription);
    const threshold = await refreshThresholdState(tx, {
      orgId: usageEvent.orgId,
      subscription: nextSubscription,
      creditType: CREDIT_TYPES.execution,
    });

    return { usageEvent: updatedEvent, threshold, subscription: nextSubscription };
  });
}

export async function reserveVideoCredits({
  orgId,
  userId = null,
  conversationId = null,
  prompt,
  durationSeconds,
  resolution,
  aspectRatio,
  mode = 'lite',
  referenceImages = [],
  metadata = {},
}) {
  return db.transaction(async (tx) => {
    const { organisation, subscription } = await ensureSubscriptionForOrg(orgId, { tx });
    const plan = getBillingPlan(organisation.plan);
    const videoMode = getVideoGenerationMode(mode);
    const burn = calculateVideoCreditBurn({
      durationSeconds,
      resolution,
      mode,
      referenceImageCount: referenceImages.length,
    });
    const balances = getAvailableBalances(subscription, CREDIT_TYPES.video);
    const validation = validateVideoGenerationRequest({
      durationSeconds,
      resolution,
      aspectRatio,
      mode,
      referenceImages,
    });
    const usedTodayCredits = await getConsumedVideoCreditsForCurrentDay(tx, orgId);
    const activeCount = await countActiveUsage(tx, CREDIT_TYPES.video, orgId);
    const preflightError = getVideoReservationPreflightError({
      plan,
      subscription,
      balances,
      burn,
      validation,
      usedTodayCredits,
      activeCount,
    });

    if (preflightError) {
      throw preflightError;
    }

    const reserved = reserveFromBalances(balances, burn.creditsUsed);
    const cycleSummaryBefore = await getCreditSummary(tx, organisation, subscription, CREDIT_TYPES.video);
    const heavyUsage = detectHeavyUsage({
      percentUsed: cycleSummaryBefore.percentUsed,
      cycleAgeDays: getCycleAgeDays(subscription.currentPeriodStart),
      durationSeconds,
      resolution,
    });
    const estimatedCostUsd = estimateVideoProviderCostUsd({ durationSeconds, resolution, mode });
    const costGuard = evaluateCostGuard({
      creditType: CREDIT_TYPES.video,
      credits: burn.creditsUsed,
      estimatedCostUsd,
    });

    const [job] = await tx
      .insert(videoGenerationEvents)
      .values({
        orgId,
        userId,
        conversationId,
        status: 'queued',
        provider: videoMode.provider,
        model: videoMode.model,
        prompt,
        durationSeconds,
        resolution,
        aspectRatio,
        creditsRequested: burn.creditsUsed,
        creditsReserved: burn.creditsUsed,
        creditsCommitted: 0,
        maxRetries: videoMode.maxRetries ?? 2,
        heavyUsageFlagged: heavyUsage.flagged,
        providerMetadata: {
          ...metadata,
          mode: videoMode.id,
          providerLabel: videoMode.providerLabel,
          referenceImageCount: referenceImages.length,
          reservationSplit: reserved.split,
          estimatedCostUsd,
          estimatedCostGbp: costGuard.estimatedCostGbp,
          costGuard,
        },
      })
      .returning();

    const [nextSubscription] = await tx
      .update(subscriptions)
      .set({
        videoIncludedBalance: reserved.includedBalance,
        videoPurchasedBalance: reserved.purchasedBalance,
        videoReservedBalance: reserved.reservedBalance,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();

    await appendLedgerEntry(tx, CREDIT_TYPES.video, {
      orgId,
      subscriptionId: nextSubscription.id,
      usageEventId: job.id,
      source: 'burn',
      entryType: 'reservation',
      delta: -burn.creditsUsed,
      includedBalanceAfter: reserved.includedBalance,
      purchasedBalanceAfter: reserved.purchasedBalance,
      reservedBalanceAfter: reserved.reservedBalance,
      metadata: {
        reservationSplit: reserved.split,
        mode: videoMode.id,
        providerLabel: videoMode.providerLabel,
        durationSeconds,
        resolution,
        aspectRatio,
        referenceImageCount: referenceImages.length,
      },
    });

    await syncLegacyOrganisationCounters(tx, organisation, nextSubscription);
    const threshold = await refreshThresholdState(tx, {
      orgId,
      subscription: nextSubscription,
      creditType: CREDIT_TYPES.video,
    });

    if (costGuard.triggered || heavyUsage.flagged) {
      await recordProductEvent({
        orgId,
        userId,
        eventName: costGuard.triggered ? 'cost_guard_triggered' : 'high_usage_warning',
        metadata: {
          usageEventId: job.id,
          creditType: CREDIT_TYPES.video,
          estimatedCostUsd,
          estimatedCostGbp: costGuard.estimatedCostGbp,
          revenueContributionGbp: costGuard.revenueContributionGbp,
          heavyUsageFlagged: heavyUsage.flagged,
        },
      });
    }

    return {
      job,
      burn,
      costGuard,
      heavyUsage,
      threshold,
      subscription: nextSubscription,
    };
  });
}

export async function markVideoJobProcessing({ jobId, providerJobId = null, metadata = {} }) {
  const existing = await db.query.videoGenerationEvents.findFirst({
    where: eq(videoGenerationEvents.id, jobId),
  });

  if (!existing) {
    throw buildBillingError('Video job not found.', 404, 'VIDEO_JOB_NOT_FOUND');
  }

  const [job] = await db
    .update(videoGenerationEvents)
    .set({
      status: 'processing',
      providerJobId,
      startedAt: new Date(),
      updatedAt: new Date(),
      providerMetadata: {
        ...(existing.providerMetadata ?? {}),
        ...metadata,
      },
    })
    .where(eq(videoGenerationEvents.id, jobId))
    .returning();

  return job;
}

export async function commitVideoJob({
  jobId,
  outputUrl = null,
  outputFileName = null,
  providerJobId = null,
  providerMetadata = {},
}) {
  return db.transaction(async (tx) => {
    const job = await tx.query.videoGenerationEvents.findFirst({
      where: eq(videoGenerationEvents.id, jobId),
    });

    if (!job) {
      throw buildBillingError('Video job not found.', 404, 'VIDEO_JOB_NOT_FOUND');
    }

    if (['completed', 'failed', 'released'].includes(job.status)) {
      return { job };
    }

    const { organisation, subscription } = await ensureSubscriptionForOrg(job.orgId, { tx });
    const balances = getAvailableBalances(subscription, CREDIT_TYPES.video);
    const reservedBalanceAfter = Math.max(balances.reserved - (job.creditsReserved ?? 0), 0);

    const [updatedJob] = await tx
      .update(videoGenerationEvents)
      .set({
        status: 'completed',
        providerJobId: providerJobId ?? job.providerJobId,
        creditsCommitted: job.creditsReserved,
        outputUrl: outputUrl ?? job.outputUrl,
        outputFileName: outputFileName ?? job.outputFileName,
        providerMetadata: {
          ...(job.providerMetadata ?? {}),
          ...providerMetadata,
        },
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(videoGenerationEvents.id, job.id))
      .returning();

    const estimatedCostUsd = Number(job.providerMetadata?.estimatedCostUsd ?? estimateVideoProviderCostUsd({
      durationSeconds: job.durationSeconds,
      resolution: job.resolution,
      mode: job.providerMetadata?.mode,
    }));
    const estimatedCostGbp = Number(job.providerMetadata?.estimatedCostGbp ?? (estimatedCostUsd * 0.79).toFixed(4));

    const [nextSubscription] = await tx
      .update(subscriptions)
      .set({
        videoReservedBalance: reservedBalanceAfter,
        cumulativeEstimatedCostUsd: sql`${subscriptions.cumulativeEstimatedCostUsd} + ${estimatedCostUsd}`,
        cumulativeEstimatedCostGbp: sql`${subscriptions.cumulativeEstimatedCostGbp} + ${estimatedCostGbp}`,
        costGuardState: job.providerMetadata?.costGuard?.triggered ? 'throttled' : subscription.costGuardState,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();

    await appendLedgerEntry(tx, CREDIT_TYPES.video, {
      orgId: job.orgId,
      subscriptionId: nextSubscription.id,
      usageEventId: job.id,
      source: 'burn',
      entryType: 'commit',
      delta: 0,
      includedBalanceAfter: nextSubscription.videoIncludedBalance,
      purchasedBalanceAfter: nextSubscription.videoPurchasedBalance,
      reservedBalanceAfter,
      metadata: {
        mode: job.providerMetadata?.mode ?? 'lite',
        providerLabel: job.providerMetadata?.providerLabel ?? null,
        outputUrl,
        outputFileName,
        referenceImageCount: Number(job.providerMetadata?.referenceImageCount ?? 0),
        estimatedCostUsd,
        estimatedCostGbp,
      },
    });

    await syncLegacyOrganisationCounters(tx, organisation, nextSubscription);
    const threshold = await refreshThresholdState(tx, {
      orgId: job.orgId,
      subscription: nextSubscription,
      creditType: CREDIT_TYPES.video,
    });

    return { job: updatedJob, threshold, subscription: nextSubscription };
  });
}

export async function releaseVideoJob({
  jobId,
  status = 'released',
  failureCode = null,
  failureMessage = null,
  providerMetadata = {},
}) {
  return db.transaction(async (tx) => {
    const job = await tx.query.videoGenerationEvents.findFirst({
      where: eq(videoGenerationEvents.id, jobId),
    });

    if (!job) {
      throw buildBillingError('Video job not found.', 404, 'VIDEO_JOB_NOT_FOUND');
    }

    if (['released', 'failed', 'completed'].includes(job.status)) {
      return { job };
    }

    const { organisation, subscription } = await ensureSubscriptionForOrg(job.orgId, { tx });
    const balances = getAvailableBalances(subscription, CREDIT_TYPES.video);
    const restored = restoreReservationToBalances(
      balances,
      job.creditsReserved ?? 0,
      job.providerMetadata?.reservationSplit,
    );

    const [updatedJob] = await tx
      .update(videoGenerationEvents)
      .set({
        status,
        failureCode,
        failureMessage,
        providerMetadata: {
          ...(job.providerMetadata ?? {}),
          ...providerMetadata,
        },
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(videoGenerationEvents.id, job.id))
      .returning();

    const [nextSubscription] = await tx
      .update(subscriptions)
      .set({
        videoIncludedBalance: restored.includedBalance,
        videoPurchasedBalance: restored.purchasedBalance,
        videoReservedBalance: restored.reservedBalance,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();

    await appendLedgerEntry(tx, CREDIT_TYPES.video, {
      orgId: job.orgId,
      subscriptionId: nextSubscription.id,
      usageEventId: job.id,
      source: 'burn',
      entryType: 'release',
      delta: job.creditsReserved ?? 0,
      includedBalanceAfter: restored.includedBalance,
      purchasedBalanceAfter: restored.purchasedBalance,
      reservedBalanceAfter: restored.reservedBalance,
      metadata: {
        mode: job.providerMetadata?.mode ?? 'lite',
        providerLabel: job.providerMetadata?.providerLabel ?? null,
        failureCode,
        failureMessage,
        referenceImageCount: Number(job.providerMetadata?.referenceImageCount ?? 0),
      },
    });

    await syncLegacyOrganisationCounters(tx, organisation, nextSubscription);
    const threshold = await refreshThresholdState(tx, {
      orgId: job.orgId,
      subscription: nextSubscription,
      creditType: CREDIT_TYPES.video,
    });

    return { job: updatedJob, threshold, subscription: nextSubscription };
  });
}

export async function incrementVideoJobRetry(jobId) {
  const [job] = await db
    .update(videoGenerationEvents)
    .set({
      retryCount: sql`${videoGenerationEvents.retryCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationEvents.id, jobId))
    .returning();

  if (!job) {
    throw buildBillingError('Video job not found.', 404, 'VIDEO_JOB_NOT_FOUND');
  }

  if ((job.retryCount ?? 0) > (job.maxRetries ?? 2)) {
    throw buildBillingError('Video retry limit reached.', 409, 'VIDEO_RETRY_LIMIT_REACHED');
  }

  return job;
}

export async function listQueuedVideoJobs(limit = 10) {
  return db.query.videoGenerationEvents.findMany({
    where: eq(videoGenerationEvents.status, 'queued'),
    orderBy: (table, { asc }) => [asc(table.heavyUsageFlagged), asc(table.createdAt)],
    limit,
  });
}

export async function claimQueuedVideoJob(jobId) {
  const [claimed] = await db
    .update(videoGenerationEvents)
    .set({
      status: 'reserved',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(videoGenerationEvents.id, jobId),
        eq(videoGenerationEvents.status, 'queued'),
      ),
    )
    .returning();

  return claimed ?? null;
}

export async function listStuckProcessingVideoJobs({ timeoutMs, limit = 20 } = {}) {
  const cutoff = new Date(Date.now() - Math.max(Number(timeoutMs) || 0, 0));
  return db.query.videoGenerationEvents.findMany({
    where: and(
      eq(videoGenerationEvents.status, 'processing'),
      lt(videoGenerationEvents.startedAt, cutoff),
    ),
    limit,
  });
}

export async function createPendingCreditPurchase({
  orgId,
  creditType,
  packId,
  stripeCheckoutSessionId = null,
  metadata = {},
}) {
  return db.transaction(async (tx) => {
    const { subscription } = await ensureSubscriptionForOrg(orgId, { tx });
    const pack = getCreditPack(creditType, packId);

    if (!pack) {
      throw buildBillingError('Unknown credit pack.', 400, 'INVALID_CREDIT_PACK');
    }

    const [purchase] = await tx
      .insert(creditPurchases)
      .values({
        orgId,
        subscriptionId: subscription.id,
        creditType,
        packId,
        credits: pack.credits,
        amountGbp: pack.amountGbp,
        currency: 'gbp',
        status: 'pending',
        stripeCheckoutSessionId,
        metadata,
      })
      .returning();

    return purchase;
  });
}

export async function completeCreditPurchase({
  orgId,
  creditType,
  packId,
  stripeCheckoutSessionId,
  stripePaymentIntentId = null,
  stripeInvoiceId = null,
  metadata = {},
}) {
  return db.transaction(async (tx) => {
    const { organisation, subscription } = await ensureSubscriptionForOrg(orgId, { tx });
    const pack = getCreditPack(creditType, packId);

    if (!pack) {
      throw buildBillingError('Unknown credit pack.', 400, 'INVALID_CREDIT_PACK');
    }

    let purchase = stripeCheckoutSessionId
      ? await tx.query.creditPurchases.findFirst({
          where: eq(creditPurchases.stripeCheckoutSessionId, stripeCheckoutSessionId),
        })
      : null;

    if (purchase?.status === 'completed') {
      return purchase;
    }

    if (!purchase) {
      [purchase] = await tx
        .insert(creditPurchases)
        .values({
          orgId,
          subscriptionId: subscription.id,
          creditType,
          packId,
          credits: pack.credits,
          amountGbp: pack.amountGbp,
          currency: 'gbp',
          status: 'pending',
          stripeCheckoutSessionId,
        })
        .returning();
    }

    const fieldMap = CREDIT_FIELD_MAP[creditType];
    const nextPurchasedBalance = (subscription[fieldMap.purchasedKey] ?? 0) + pack.credits;

    const [nextSubscription] = await tx
      .update(subscriptions)
      .set({
        [fieldMap.purchasedKey]: nextPurchasedBalance,
        cumulativeRevenueGbp: sql`${subscriptions.cumulativeRevenueGbp} + ${pack.amountGbp}`,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();

    const [updatedPurchase] = await tx
      .update(creditPurchases)
      .set({
        status: 'completed',
        stripePaymentIntentId,
        stripeInvoiceId,
        completedAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          ...(purchase.metadata ?? {}),
          ...metadata,
        },
      })
      .where(eq(creditPurchases.id, purchase.id))
      .returning();

    await appendLedgerEntry(tx, creditType, {
      orgId,
      subscriptionId: nextSubscription.id,
      purchaseId: updatedPurchase.id,
      source: 'purchase',
      entryType: 'purchase',
      delta: pack.credits,
      includedBalanceAfter: nextSubscription[fieldMap.includedKey],
      purchasedBalanceAfter: nextSubscription[fieldMap.purchasedKey],
      reservedBalanceAfter: nextSubscription[fieldMap.reservedKey],
      metadata: {
        packId,
        amountGbp: pack.amountGbp,
      },
    });

    await syncLegacyOrganisationCounters(tx, organisation, nextSubscription);
    return updatedPurchase;
  });
}

export async function setSubscriptionPlan({
  orgId,
  planId,
  billingInterval = BILLING_INTERVALS.monthly,
  status = 'active',
  stripeEventId = null,
  stripeEventCreated = null,
  stripeSubscriptionId = null,
  source = 'manual',
}) {
  return db.transaction(async (tx) => {
    const organisation = await tx.query.organisations.findFirst({
      where: eq(organisations.id, orgId),
    });

    if (!organisation) {
      throw buildBillingError('Organisation not found.', 404, 'ORG_NOT_FOUND');
    }

    const plan = getBillingPlan(planId);
    let subscription = await tx.query.subscriptions.findFirst({
      where: eq(subscriptions.orgId, orgId),
    });

    if (!subscription) {
      subscription = await createSubscriptionForOrganisation(tx, organisation);
    }

    const syncDecision = shouldApplyStripeSubscriptionEvent({
      metadata: subscription.metadata,
      eventId: stripeEventId,
      eventCreated: stripeEventCreated,
    });

    if (!syncDecision.apply) {
      return {
        organisation,
        subscription,
        skipped: true,
        reason: syncDecision.reason,
      };
    }

    const now = new Date();
    const metadata = buildBillingSyncMetadata(subscription.metadata, {
      stripeEventId,
      stripeEventCreated,
      stripeSubscriptionId,
      stripeStatus: status,
      source,
      syncedAt: now,
    });

    if (!shouldResetSubscriptionEntitlements({
      organisation,
      subscription,
      plan,
      billingInterval,
      source,
    })) {
      const [nextSubscription] = await tx
        .update(subscriptions)
        .set({
          plan: plan.id,
          status,
          billingInterval,
          metadata,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, subscription.id))
        .returning();

      await syncLegacyOrganisationCounters(tx, organisation, nextSubscription);

      return {
        organisation,
        subscription: nextSubscription,
        entitlementReset: false,
      };
    }

    const [nextSubscription] = await tx
      .update(subscriptions)
      .set({
        plan: plan.id,
        status,
        billingInterval,
        currentPeriodStart: now,
        currentPeriodEnd: addBillingInterval(now, billingInterval),
        lastResetAt: now,
        executionIncludedBalance: plan.includedExecutionCredits,
        executionReservedBalance: 0,
        videoIncludedBalance: plan.includedVideoCredits,
        videoReservedBalance: 0,
        metadata,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();

    await appendLedgerEntry(tx, CREDIT_TYPES.execution, {
      orgId,
      subscriptionId: nextSubscription.id,
      source: 'plan',
      entryType: 'reset',
      delta: plan.includedExecutionCredits - (subscription.executionIncludedBalance ?? 0),
      includedBalanceAfter: nextSubscription.executionIncludedBalance,
      purchasedBalanceAfter: nextSubscription.executionPurchasedBalance,
      reservedBalanceAfter: nextSubscription.executionReservedBalance,
      metadata: {
        planId: plan.id,
        billingInterval,
      },
    });

    await appendLedgerEntry(tx, CREDIT_TYPES.video, {
      orgId,
      subscriptionId: nextSubscription.id,
      source: 'plan',
      entryType: 'reset',
      delta: plan.includedVideoCredits - (subscription.videoIncludedBalance ?? 0),
      includedBalanceAfter: nextSubscription.videoIncludedBalance,
      purchasedBalanceAfter: nextSubscription.videoPurchasedBalance,
      reservedBalanceAfter: nextSubscription.videoReservedBalance,
      metadata: {
        planId: plan.id,
        billingInterval,
      },
    });

    const [updatedOrg] = await tx
      .update(organisations)
      .set({
        plan: plan.id,
        seatLimit: plan.seatLimit,
        monthlyCreditLimit: plan.includedExecutionCredits,
        creditsUsed: 0,
        updatedAt: now,
      })
      .where(eq(organisations.id, orgId))
      .returning();

    return {
      organisation: updatedOrg,
      subscription: nextSubscription,
      entitlementReset: true,
    };
  });
}

export async function updateSubscriptionBillingStatus({
  orgId,
  status,
  stripeEventId = null,
  stripeEventCreated = null,
  stripeSubscriptionId = null,
  source = 'manual',
}) {
  return db.transaction(async (tx) => {
    const organisation = await tx.query.organisations.findFirst({
      where: eq(organisations.id, orgId),
    });

    if (!organisation) {
      throw buildBillingError('Organisation not found.', 404, 'ORG_NOT_FOUND');
    }

    let subscription = await tx.query.subscriptions.findFirst({
      where: eq(subscriptions.orgId, orgId),
    });

    if (!subscription) {
      subscription = await createSubscriptionForOrganisation(tx, organisation);
    }

    const syncDecision = shouldApplyStripeSubscriptionEvent({
      metadata: subscription.metadata,
      eventId: stripeEventId,
      eventCreated: stripeEventCreated,
    });

    if (!syncDecision.apply) {
      return {
        organisation,
        subscription,
        skipped: true,
        reason: syncDecision.reason,
      };
    }

    const now = new Date();
    const [nextSubscription] = await tx
      .update(subscriptions)
      .set({
        status,
        metadata: buildBillingSyncMetadata(subscription.metadata, {
          stripeEventId,
          stripeEventCreated,
          stripeSubscriptionId,
          stripeStatus: status,
          source,
          syncedAt: now,
        }),
        updatedAt: now,
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();

    return {
      organisation,
      subscription: nextSubscription,
    };
  });
}

export async function getPackCheckoutConfig(creditType, packId) {
  const pack = getCreditPack(creditType, packId);

  if (!pack) {
    throw buildBillingError('Unknown credit pack.', 400, 'INVALID_CREDIT_PACK');
  }

  const priceId = getPackStripePriceId(pack);

  if (!priceId) {
    throw buildBillingError('This credit pack is not configured in Stripe.', 503, 'CREDIT_PACK_NOT_CONFIGURED');
  }

  return { pack, priceId };
}

export async function applyCreditAdjustment({
  orgId,
  creditType = CREDIT_TYPES.execution,
  delta,
  source = 'admin',
  entryType = 'adjustment',
  metadata = {},
}) {
  if (!delta) {
    return getBillingSnapshotForOrg(orgId);
  }

  return db.transaction(async (tx) => {
    const { organisation, subscription } = await ensureSubscriptionForOrg(orgId, { tx });
    const fieldMap = CREDIT_FIELD_MAP[creditType];
    const balances = getAvailableBalances(subscription, creditType);
    let nextIncluded = balances.included;
    let nextPurchased = balances.purchased;

    if (delta > 0) {
      nextPurchased += delta;
    } else {
      const required = Math.abs(delta);
      assertCreditAvailability(creditType, balances.available, required);
      const reserved = reserveFromBalances(balances, required);
      nextIncluded = reserved.includedBalance;
      nextPurchased = reserved.purchasedBalance;
    }

    const [nextSubscription] = await tx
      .update(subscriptions)
      .set({
        [fieldMap.includedKey]: nextIncluded,
        [fieldMap.purchasedKey]: nextPurchased,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();

    await appendLedgerEntry(tx, creditType, {
      orgId,
      subscriptionId: nextSubscription.id,
      source,
      entryType,
      delta,
      includedBalanceAfter: nextIncluded,
      purchasedBalanceAfter: nextPurchased,
      reservedBalanceAfter: nextSubscription[fieldMap.reservedKey],
      metadata,
    });

    await syncLegacyOrganisationCounters(tx, organisation, nextSubscription);
    await refreshThresholdState(tx, {
      orgId,
      subscription: nextSubscription,
      creditType,
    });

    return getBillingSnapshotForOrg(orgId, { tx });
  });
}

async function createSubscriptionForOrganisation(tx, organisation) {
  const now = new Date();
  const plan = getBillingPlan(organisation.plan);
  const [subscription] = await tx
    .insert(subscriptions)
    .values({
      orgId: organisation.id,
      plan: plan.id,
      billingInterval: BILLING_INTERVALS.monthly,
      currentPeriodStart: now,
      currentPeriodEnd: addBillingInterval(now, BILLING_INTERVALS.monthly),
      lastResetAt: now,
      executionIncludedBalance: plan.includedExecutionCredits,
      videoIncludedBalance: plan.includedVideoCredits,
    })
    .returning();

  await appendLedgerEntry(tx, CREDIT_TYPES.execution, {
    orgId: organisation.id,
    subscriptionId: subscription.id,
    source: 'plan',
    entryType: 'grant',
    delta: plan.includedExecutionCredits,
    includedBalanceAfter: plan.includedExecutionCredits,
    purchasedBalanceAfter: 0,
    reservedBalanceAfter: 0,
    metadata: { planId: plan.id },
  });

  if (plan.includedVideoCredits > 0) {
    await appendLedgerEntry(tx, CREDIT_TYPES.video, {
      orgId: organisation.id,
      subscriptionId: subscription.id,
      source: 'plan',
      entryType: 'grant',
      delta: plan.includedVideoCredits,
      includedBalanceAfter: plan.includedVideoCredits,
      purchasedBalanceAfter: 0,
      reservedBalanceAfter: 0,
      metadata: { planId: plan.id },
    });
  }

  await syncLegacyOrganisationCounters(tx, organisation, subscription);
  return subscription;
}

async function resetSubscriptionForNewCycle({ orgId, tx, organisation, subscription }) {
  const plan = getBillingPlan(organisation.plan);
  const currentStart = new Date(subscription.currentPeriodEnd ?? new Date());
  const nextEnd = addBillingInterval(currentStart, subscription.billingInterval);

  const [nextSubscription] = await tx
    .update(subscriptions)
    .set({
      plan: plan.id,
      executionIncludedBalance: plan.includedExecutionCredits,
      executionReservedBalance: 0,
      videoIncludedBalance: plan.includedVideoCredits,
      videoReservedBalance: 0,
      currentPeriodStart: currentStart,
      currentPeriodEnd: nextEnd,
      lastResetAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscription.id))
    .returning();

  await appendLedgerEntry(tx, CREDIT_TYPES.execution, {
    orgId,
    subscriptionId: nextSubscription.id,
    source: 'plan',
    entryType: 'reset',
    delta: plan.includedExecutionCredits - (subscription.executionIncludedBalance ?? 0),
    includedBalanceAfter: nextSubscription.executionIncludedBalance,
    purchasedBalanceAfter: nextSubscription.executionPurchasedBalance,
    reservedBalanceAfter: nextSubscription.executionReservedBalance,
    metadata: { resetAt: new Date().toISOString() },
  });

  await appendLedgerEntry(tx, CREDIT_TYPES.video, {
    orgId,
    subscriptionId: nextSubscription.id,
    source: 'plan',
    entryType: 'reset',
    delta: plan.includedVideoCredits - (subscription.videoIncludedBalance ?? 0),
    includedBalanceAfter: nextSubscription.videoIncludedBalance,
    purchasedBalanceAfter: nextSubscription.videoPurchasedBalance,
    reservedBalanceAfter: nextSubscription.videoReservedBalance,
    metadata: { resetAt: new Date().toISOString() },
  });

  await syncLegacyOrganisationCounters(tx, organisation, nextSubscription);
  return nextSubscription;
}

async function syncLegacyOrganisationCounters(tx, organisation, subscription) {
  const plan = getBillingPlan(subscription.plan ?? organisation.plan);
  const creditsUsed = Math.max(plan.includedExecutionCredits - (subscription.executionIncludedBalance ?? 0), 0);

  await tx
    .update(organisations)
    .set({
      plan: plan.id,
      seatLimit: plan.seatLimit,
      monthlyCreditLimit: plan.includedExecutionCredits,
      creditsUsed,
      updatedAt: new Date(),
    })
    .where(eq(organisations.id, organisation.id));
}

async function appendLedgerEntry(tx, creditType, {
  orgId,
  subscriptionId,
  purchaseId = null,
  usageEventId = null,
  source,
  entryType,
  delta,
  includedBalanceAfter,
  purchasedBalanceAfter,
  reservedBalanceAfter,
  metadata = {},
}) {
  const fieldMap = CREDIT_FIELD_MAP[creditType];

  await tx.insert(fieldMap.ledgerTable).values({
    orgId,
    subscriptionId,
    purchaseId,
    usageEventId,
    source,
    entryType,
    delta,
    balanceAfter: (includedBalanceAfter ?? 0) + (purchasedBalanceAfter ?? 0),
    includedBalanceAfter,
    purchasedBalanceAfter,
    reservedBalanceAfter,
    metadata,
  });
}

async function getCreditSummary(tx, organisation, subscription, creditType) {
  const balances = getAvailableBalances(subscription, creditType);
  const committedThisCycle = await getCommittedCreditsForCycle(tx, orgIdForSummary(organisation), subscription, creditType);
  const used = committedThisCycle + balances.reserved;
  const total = balances.available + balances.reserved + committedThisCycle;
  const percentUsed = total > 0 ? (used / total) * 100 : 0;
  const threshold = getThresholdPresentation(percentUsed);

  return {
    type: creditType,
    includedAvailable: balances.included,
    purchasedAvailable: balances.purchased,
    available: balances.available,
    reserved: balances.reserved,
    committedThisCycle,
    percentUsed: Number(percentUsed.toFixed(2)),
    threshold,
    resetsAt: subscription.currentPeriodEnd,
  };
}

async function refreshThresholdState(tx, { orgId, subscription, creditType }) {
  const summary = await getCreditSummary(tx, { id: orgId, plan: subscription.plan }, subscription, creditType);
  const nextThreshold = getUsageThreshold(summary.percentUsed);
  const cycleKey = buildCycleKey(subscription.currentPeriodStart);
  const current = await tx.query.thresholdState.findFirst({
    where: and(
      eq(thresholdState.orgId, orgId),
      eq(thresholdState.creditType, creditType),
      eq(thresholdState.cycleKey, cycleKey),
    ),
  });

  if (nextThreshold > (current?.thresholdPercent ?? 0)) {
    await tx
      .insert(thresholdState)
      .values({
        orgId,
        creditType,
        cycleKey,
        thresholdPercent: nextThreshold,
        lastTriggeredAt: new Date(),
        metadata: summary,
      })
      .onConflictDoUpdate({
        target: [thresholdState.orgId, thresholdState.creditType, thresholdState.cycleKey],
        set: {
          thresholdPercent: nextThreshold,
          lastTriggeredAt: new Date(),
          metadata: summary,
          updatedAt: new Date(),
        },
      });
  }

  return summary.threshold;
}

export async function getConsumedVideoCreditsForCurrentDay(tx, orgId) {
  const start = startOfUtcDay(new Date());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const [{ total = 0 } = {}] = await tx
    .select({
      total: sql`COALESCE(SUM(${videoGenerationEvents.creditsRequested}), 0)`,
    })
    .from(videoGenerationEvents)
    .where(and(
      eq(videoGenerationEvents.orgId, orgId),
      gte(videoGenerationEvents.createdAt, start),
      lt(videoGenerationEvents.createdAt, end),
      sql`${videoGenerationEvents.status} <> 'released'`,
    ));

  return Number(total);
}

export function getVideoDailyCapError({
  plan,
  subscription,
  usedTodayCredits = 0,
  requestedCredits = 0,
}) {
  if (plan.dailyVideoCreditCap === 0) {
    if (plan.id === 'solo' && (subscription.videoPurchasedBalance ?? 0) > 0) {
      return null;
    }

    return buildBillingError('Your plan does not include daily video generation.', 402, 'VIDEO_DAILY_CAP_REACHED', true);
  }

  if (Number(usedTodayCredits) + Number(requestedCredits) > plan.dailyVideoCreditCap) {
    return buildBillingError(
      `Daily video cap reached for the ${plan.label} plan.`,
      402,
      'VIDEO_DAILY_CAP_REACHED',
      true,
    );
  }

  return null;
}

export function getVideoReservationPreflightError({
  plan,
  subscription,
  balances,
  burn,
  validation,
  usedTodayCredits = 0,
  activeCount = 0,
}) {
  const creditError = getVideoCreditAvailabilityError({
    plan,
    subscription,
    balances,
    requiredCredits: burn.creditsUsed,
  });

  if (creditError) {
    return creditError;
  }

  if (!validation.ok) {
    return buildBillingError(validation.message, 400, validation.code);
  }

  const dailyCapError = getVideoDailyCapError({
    plan,
    subscription,
    usedTodayCredits,
    requestedCredits: burn.creditsUsed,
  });

  if (dailyCapError) {
    return dailyCapError;
  }

  if (activeCount >= plan.concurrency.video) {
    return buildBillingError(
      `Video concurrency limit reached for the ${plan.label} plan.`,
      429,
      'VIDEO_CONCURRENCY_LIMIT',
    );
  }

  return null;
}

export function getVideoCreditAvailabilityError({
  plan,
  subscription,
  balances,
  requiredCredits,
}) {
  const available = Number(balances?.available ?? 0);

  if (available >= requiredCredits) {
    return null;
  }

  const hasAnyVideoEntitlement = Number(plan.includedVideoCredits ?? 0) > 0
    || Number(subscription?.videoIncludedBalance ?? 0) > 0
    || Number(subscription?.videoPurchasedBalance ?? 0) > 0
    || Number(subscription?.videoReservedBalance ?? 0) > 0;

  if (!hasAnyVideoEntitlement) {
    return buildBillingError(
      'Video generation requires video credits. Upgrade or add a video pack to continue.',
      402,
      'VIDEO_CREDITS_REQUIRED',
      true,
    );
  }

  return buildBillingError(
    'Video credits exhausted. Purchase a video pack or upgrade to continue.',
    402,
    'VIDEO_CREDITS_EXHAUSTED',
    true,
  );
}

export function shouldApplyStripeSubscriptionEvent({ metadata = {}, eventId = null, eventCreated = null } = {}) {
  if (!eventId && eventCreated == null) {
    return { apply: true, reason: null };
  }

  const stripeMetadata = metadata?.stripe ?? {};
  const latestEventId = stripeMetadata.latestEventId ?? null;
  const latestEventCreated = normalizeStripeEventCreated(stripeMetadata.latestEventCreated);
  const incomingEventCreated = normalizeStripeEventCreated(eventCreated);

  if (eventId && latestEventId === eventId) {
    return { apply: false, reason: 'duplicate_stripe_event' };
  }

  if (
    incomingEventCreated != null
    && latestEventCreated != null
    && incomingEventCreated < latestEventCreated
  ) {
    return { apply: false, reason: 'stale_stripe_event' };
  }

  return { apply: true, reason: null };
}

function buildBillingSyncMetadata(existingMetadata = {}, {
  stripeEventId = null,
  stripeEventCreated = null,
  stripeSubscriptionId = null,
  stripeStatus = null,
  source = 'manual',
  syncedAt = new Date(),
} = {}) {
  if (!stripeEventId && stripeEventCreated == null && !stripeSubscriptionId && !stripeStatus) {
    return existingMetadata ?? {};
  }

  const stripeMetadata = {
    ...(existingMetadata?.stripe ?? {}),
    lastSyncSource: source,
    lastSyncedAt: syncedAt.toISOString(),
  };

  if (stripeEventId) {
    stripeMetadata.latestEventId = stripeEventId;
  }

  const normalizedCreated = normalizeStripeEventCreated(stripeEventCreated);
  if (normalizedCreated != null) {
    stripeMetadata.latestEventCreated = normalizedCreated;
  }

  if (stripeSubscriptionId) {
    stripeMetadata.subscriptionId = stripeSubscriptionId;
  }

  if (stripeStatus) {
    stripeMetadata.status = stripeStatus;
  }

  return {
    ...(existingMetadata ?? {}),
    stripe: stripeMetadata,
  };
}

function shouldResetSubscriptionEntitlements({
  organisation,
  subscription,
  plan,
  billingInterval,
  source = 'manual',
}) {
  if ([
    'manual',
    'checkout.session.completed',
    'customer.subscription.deleted',
    'invoice.paid',
  ].includes(source)) {
    return true;
  }

  return (
    subscription.plan !== plan.id
    || subscription.billingInterval !== billingInterval
    || organisation.plan !== plan.id
    || organisation.seatLimit !== plan.seatLimit
    || organisation.monthlyCreditLimit !== plan.includedExecutionCredits
  );
}

function normalizeStripeEventCreated(value) {
  if (value == null || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

async function getCommittedCreditsForCycle(tx, orgId, subscription, creditType) {
  const start = new Date(subscription.currentPeriodStart ?? new Date());
  const end = new Date(subscription.currentPeriodEnd ?? addBillingInterval(start, subscription.billingInterval));

  if (creditType === CREDIT_TYPES.video) {
    const [{ total = 0 } = {}] = await tx
      .select({
        total: sql`COALESCE(SUM(${videoGenerationEvents.creditsCommitted}), 0)`,
      })
      .from(videoGenerationEvents)
      .where(and(
        eq(videoGenerationEvents.orgId, orgId),
        gte(videoGenerationEvents.createdAt, start),
        lt(videoGenerationEvents.createdAt, end),
      ));

    return Number(total);
  }

  const [{ total = 0 } = {}] = await tx
    .select({
      total: sql`COALESCE(SUM(${executionUsageEvents.creditsCommitted}), 0)`,
    })
    .from(executionUsageEvents)
    .where(and(
      eq(executionUsageEvents.orgId, orgId),
      gte(executionUsageEvents.createdAt, start),
      lt(executionUsageEvents.createdAt, end),
    ));

  const [{ legacyTotal = 0 } = {}] = await tx
    .select({
      legacyTotal: sql`COALESCE(SUM(ABS(${creditLedgerExecution.delta})), 0)`,
    })
    .from(creditLedgerExecution)
    .where(and(
      eq(creditLedgerExecution.orgId, orgId),
      eq(creditLedgerExecution.entryType, 'legacy_commit'),
      gte(creditLedgerExecution.createdAt, start),
      lt(creditLedgerExecution.createdAt, end),
    ));

  return Number(total) + Number(legacyTotal);
}

async function countActiveUsage(tx, creditType, orgId) {
  if (creditType === CREDIT_TYPES.video) {
    const [{ total = 0 } = {}] = await tx
      .select({
        total: sql`COUNT(*)`,
      })
      .from(videoGenerationEvents)
      .where(and(
        eq(videoGenerationEvents.orgId, orgId),
        sql`${videoGenerationEvents.status} IN ('queued', 'reserved', 'processing')`,
      ));

    return Number(total);
  }

  const [{ total = 0 } = {}] = await tx
    .select({
      total: sql`COUNT(*)`,
    })
    .from(executionUsageEvents)
    .where(and(
      eq(executionUsageEvents.orgId, orgId),
      sql`${executionUsageEvents.status} IN ('reserved', 'running')`,
    ));

  return Number(total);
}

function getAvailableBalances(subscription, creditType) {
  const fieldMap = CREDIT_FIELD_MAP[creditType];
  const included = Number(subscription[fieldMap.includedKey] ?? 0);
  const purchased = Number(subscription[fieldMap.purchasedKey] ?? 0);
  const reserved = Number(subscription[fieldMap.reservedKey] ?? 0);

  return {
    included,
    purchased,
    reserved,
    available: included + purchased,
  };
}

function reserveFromBalances(balances, credits) {
  const fromIncluded = Math.min(balances.included, credits);
  const fromPurchased = credits - fromIncluded;

  return {
    includedBalance: balances.included - fromIncluded,
    purchasedBalance: balances.purchased - fromPurchased,
    reservedBalance: balances.reserved + credits,
    split: {
      fromIncluded,
      fromPurchased,
    },
  };
}

function restoreReservationToBalances(balances, credits, split = null) {
  const fromIncluded = Number(split?.fromIncluded ?? 0);
  const fromPurchased = Number(split?.fromPurchased ?? (credits - fromIncluded));

  return {
    includedBalance: balances.included + fromIncluded,
    purchasedBalance: balances.purchased + fromPurchased,
    reservedBalance: Math.max(balances.reserved - credits, 0),
  };
}

function assertCreditAvailability(creditType, available, required) {
  if (available >= required) {
    return;
  }

  const error = buildBillingError(
    creditType === CREDIT_TYPES.video
      ? 'Video credits exhausted. Purchase a video pack or upgrade to continue.'
      : 'Execution credits exhausted. Purchase an execution pack or upgrade to continue.',
    402,
    creditType === CREDIT_TYPES.video ? 'VIDEO_CREDITS_EXHAUSTED' : 'EXECUTION_CREDITS_EXHAUSTED',
    true,
  );

  error.creditType = creditType;
  throw error;
}

function buildBillingError(message, status, code, upgrade = false) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.upgrade = upgrade;
  return error;
}

function addBillingInterval(date, interval = BILLING_INTERVALS.monthly) {
  const next = new Date(date);

  if (interval === BILLING_INTERVALS.yearly) {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
    return next;
  }

  if (interval === BILLING_INTERVALS.quarterly) {
    next.setUTCMonth(next.getUTCMonth() + 3);
    return next;
  }

  next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function buildCycleKey(value) {
  return new Date(value ?? new Date()).toISOString().slice(0, 10);
}

function getCycleAgeDays(currentPeriodStart) {
  const start = new Date(currentPeriodStart ?? new Date());
  return Math.max((Date.now() - start.getTime()) / (24 * 60 * 60 * 1000), 0);
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    0,
    0,
    0,
  ));
}

function orgIdForSummary(organisation) {
  return organisation?.id ?? organisation?.orgId;
}

/**
 * Central usage economics and fair-use guardrails (server-side).
 * Execution credits and video credits remain the user-facing meters; this layer
 * protects margin using internal burn estimates and rate-style caps.
 */

import {
  ACTION_COST_CLASS,
  COST_GUARD_DEFAULTS,
  classifyExecutionCostIntent,
  getBillingPlan,
  getMonthlyInternalBurnCapGbp,
} from './billing-catalog.js';

function cycleKeyFromPeriodStart(periodStart) {
  if (!periodStart) return null;
  const d = new Date(periodStart);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function utcDayKey(now = new Date()) {
  const d = typeof now === 'string' || typeof now === 'number' ? new Date(now) : now;
  return d.toISOString().slice(0, 10);
}

function utcMinuteKey(now = new Date()) {
  const d = typeof now === 'string' || typeof now === 'number' ? new Date(now) : now;
  return Math.floor(d.getTime() / 60_000);
}

/**
 * Decide whether to accept a new execution reservation under internal burn + fair-use limits.
 * Call inside a transaction immediately after acquiring `subscriptions.id FOR UPDATE`.
 *
 * @param {object} input
 * @param {string} input.planId
 * @param {object} input.subscription
 * @param {number} input.estimatedCostUsd
 * @param {number} input.estimatedContextTokens
 * @param {number} input.agentCount
 * @param {{ now?: Date }} [input.opts]
 */
export function evaluateExecutionUsageGate({
  planId,
  subscription,
  estimatedCostUsd = 0,
  estimatedContextTokens = 0,
  agentCount = 1,
  now = new Date(),
} = {}) {
  const plan = getBillingPlan(planId);
  const fair = plan.fairUse ?? {};
  const capGbp = getMonthlyInternalBurnCapGbp(planId);
  const cumulativeGbp = Number(subscription?.cumulativeEstimatedCostGbp ?? 0) || 0;
  const costIntent = classifyExecutionCostIntent({ estimatedCostUsd, estimatedContextTokens, agentCount });
  const estUsd = Number(estimatedCostUsd) || 0;
  const estGbp = estUsd * COST_GUARD_DEFAULTS.usdToGbp;

  const meta = subscription?.metadata ?? {};
  const counters = { ...(meta.usageFairUse ?? {}) };
  const ck = cycleKeyFromPeriodStart(subscription?.currentPeriodStart);
  if (counters.cycleKey !== ck) {
    counters.cycleKey = ck;
    counters.highCostThisCycle = 0;
  }
  const dk = utcDayKey(now);
  if (counters.dayKey !== dk) {
    counters.dayKey = dk;
    counters.highCostToday = 0;
    counters.requestsToday = 0;
  }
  const mk = utcMinuteKey(now);
  if (counters.minuteKey !== mk) {
    counters.minuteKey = mk;
    counters.requestsThisMinute = 0;
  }

  counters.requestsThisMinute = Number(counters.requestsThisMinute ?? 0) + 1;
  counters.requestsToday = Number(counters.requestsToday ?? 0) + 1;

  const isHighCostIntent = costIntent === ACTION_COST_CLASS.HIGH_COST || estGbp >= 0.12;
  if (isHighCostIntent) {
    counters.highCostToday = Number(counters.highCostToday ?? 0) + 1;
    counters.highCostThisCycle = Number(counters.highCostThisCycle ?? 0) + 1;
  }

  const nextMeta = {
    ...meta,
    usageFairUse: counters,
  };

  if (cumulativeGbp >= capGbp && costIntent !== ACTION_COST_CLASS.LOW_COST) {
    return {
      allowed: false,
      code: 'INTERNAL_BURN_CAP_HIGH_COST',
      message: 'This workspace has reached its internal fair-usage cost threshold for higher-cost model work this cycle. Retry with a lighter request, wait for the next billing cycle, or add a usage pack.',
      throttleDelayMs: 0,
      costIntent,
      subscriptionMetadataPatch: nextMeta,
    };
  }

  if (cumulativeGbp >= capGbp && costIntent === ACTION_COST_CLASS.LOW_COST) {
    return {
      allowed: true,
      code: null,
      throttleDelayMs: COST_GUARD_DEFAULTS.throttleDelayMs,
      costIntent,
      subscriptionMetadataPatch: nextMeta,
    };
  }

  const rpm = Math.max(Number(fair.requestsPerMinute ?? 120), 1);
  if (counters.requestsThisMinute > rpm) {
    return {
      allowed: false,
      code: 'FAIR_USE_RATE_LIMIT',
      message: 'Request rate limit reached for this workspace. Please retry in a moment.',
      throttleDelayMs: 1_000,
      costIntent,
      subscriptionMetadataPatch: nextMeta,
    };
  }

  const hcd = Math.max(Number(fair.highCostActionsPerDay ?? 9999), 1);
  if (isHighCostIntent && Number(counters.highCostToday) > hcd) {
    return {
      allowed: false,
      code: 'FAIR_USE_HIGH_COST_DAILY',
      message: 'Daily high-cost AI budget reached. Upgrade, add a usage pack, or continue tomorrow.',
      throttleDelayMs: 0,
      costIntent,
      subscriptionMetadataPatch: nextMeta,
    };
  }

  const hcm = Math.max(Number(fair.highCostActionsPerMonth ?? 99999), 1);
  if (isHighCostIntent && Number(counters.highCostThisCycle) > hcm) {
    return {
      allowed: false,
      code: 'FAIR_USE_HIGH_COST_MONTHLY',
      message: 'Monthly high-cost AI budget reached for this billing cycle. Upgrade or add a usage pack.',
      throttleDelayMs: 0,
      costIntent,
      subscriptionMetadataPatch: nextMeta,
    };
  }

  return {
    allowed: true,
    code: null,
    throttleDelayMs: 0,
    costIntent,
    subscriptionMetadataPatch: nextMeta,
  };
}

/**
 * Video generation: internal burn + monthly media fair-use (separate from explicit video credits).
 * Call after `subscriptions FOR UPDATE` alongside `reserveVideoCredits`.
 */
export function evaluateVideoUsageGate({
  planId,
  subscription,
  estimatedCostUsd = 0,
  now: _now = new Date(),
} = {}) {
  const plan = getBillingPlan(planId);
  const fair = plan.fairUse ?? {};
  const capGbp = getMonthlyInternalBurnCapGbp(planId);
  const cumulativeGbp = Number(subscription?.cumulativeEstimatedCostGbp ?? 0) || 0;
  const estUsd = Number(estimatedCostUsd) || 0;
  const estGbp = estUsd * COST_GUARD_DEFAULTS.usdToGbp;

  const meta = subscription?.metadata ?? {};
  const counters = { ...(meta.videoFairUse ?? {}) };
  const ck = cycleKeyFromPeriodStart(subscription?.currentPeriodStart);
  if (counters.cycleKey !== ck) {
    counters.cycleKey = ck;
    counters.mediaActionsThisCycle = 0;
  }
  counters.mediaActionsThisCycle = Number(counters.mediaActionsThisCycle ?? 0) + 1;

  const nextMeta = { ...meta, videoFairUse: counters };
  const mediaCap = Math.max(Number(fair.mediaGenerationPerMonth ?? 99999), 1);

  if (Number(counters.mediaActionsThisCycle) > mediaCap) {
    return {
      allowed: false,
      code: 'FAIR_USE_MEDIA_MONTHLY',
      message: 'Monthly media generation fair-use cap reached. Purchase a video pack or upgrade your plan.',
      subscriptionMetadataPatch: nextMeta,
    };
  }

  if (cumulativeGbp + estGbp > capGbp * 1.05 && estGbp > 0.5) {
    return {
      allowed: false,
      code: 'INTERNAL_BURN_CAP_VIDEO',
      message: 'Estimated media cost would exceed the workspace fair-use threshold this cycle. Reduce quality, duration, or add a usage pack.',
      subscriptionMetadataPatch: nextMeta,
    };
  }

  return { allowed: true, code: null, subscriptionMetadataPatch: nextMeta };
}

export function getPlanUsagePolicy(planKey) {
  const plan = getBillingPlan(planKey);
  return {
    planKey: plan.id,
    label: plan.label,
    monthlyStandardPriceGbp: plan.monthlyPriceGbp,
    monthlyInternalBurnCapGbp: getMonthlyInternalBurnCapGbp(plan.id),
    includedExecutionCredits: plan.includedExecutionCredits,
    includedVideoCredits: plan.includedVideoCredits,
    maxConcurrentExecutions: plan.concurrency?.execution ?? 1,
    maxConcurrentVideo: plan.concurrency?.video ?? 0,
    loreDepthLevel: plan.loreDepthLevel ?? 'shallow',
    fairUse: plan.fairUse ?? {},
  };
}

// routes/admin/operator.js
// Founder / operator dashboard: bounded-window health view of beta activity.
import { desc, gte } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/index.js';
import {
  creditPurchases,
  executionUsageEvents,
  llmExecutionTraces,
  organisations,
  productEvents,
  videoGenerationEvents,
} from '../../db/schema.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';
import {
  BILLING_PLANS,
  getBillingPlan,
} from '../../services/billing-catalog.js';
import { getWindowDays, getSinceDate } from './helpers.js';

const router = new Hono();

const PLAN_ORDER = ['free', 'solo', 'pro', 'teams', 'agency'];
const USD_TO_GBP = Number(process.env.BILLING_COST_GUARD_USD_TO_GBP ?? 0.79);

function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function safeDivide(numerator, denominator) {
  const n = Number(numerator) || 0;
  const d = Number(denominator) || 0;
  if (d === 0) return 0;
  return n / d;
}

function parseEarlyUserIds() {
  return String(process.env.EARLY_USER_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildPlanDistribution(orgRows) {
  const counts = new Map();
  for (const org of orgRows) {
    counts.set(org.plan, (counts.get(org.plan) ?? 0) + 1);
  }

  return PLAN_ORDER.map((plan) => {
    const planConfig = BILLING_PLANS[plan];
    const count = counts.get(plan) ?? 0;
    const priceGbp = planConfig?.monthlyPriceGbp ?? 0;
    return {
      plan,
      label: planConfig?.label ?? plan,
      count,
      priceGbp,
      estimatedMrrGbp: round(count * priceGbp),
    };
  });
}

function buildTopUsageOrgs({
  orgRows,
  executionByOrg,
  videoByOrg,
  subscriptionByOrg,
  limit = 10,
}) {
  return orgRows
    .map((org) => {
      const execution = executionByOrg.get(org.id) ?? 0;
      const video = videoByOrg.get(org.id) ?? 0;
      const sub = subscriptionByOrg.get(org.id) ?? null;
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        executionCredits: execution,
        videoCredits: video,
        totalCredits: execution + video,
        revenueContributionGbp: round(Number(sub?.cumulativeRevenueGbp ?? 0)),
        estimatedCostUsd: round(Number(sub?.cumulativeEstimatedCostUsd ?? 0), 4),
        costGuardState: sub?.costGuardState ?? 'normal',
      };
    })
    .sort((a, b) => b.totalCredits - a.totalCredits)
    .slice(0, limit);
}

function classifyRisk({ costUsd, revenueGbp }) {
  const costGbp = costUsd * USD_TO_GBP;
  const ratio = safeDivide(costGbp, revenueGbp);

  if (revenueGbp <= 0 && costUsd === 0) {
    return { status: 'healthy', ratio: 0 };
  }

  if (revenueGbp <= 0 && costUsd > 0) {
    return { status: 'high_risk', ratio: Infinity };
  }

  if (ratio >= 0.5) {
    return { status: 'high_risk', ratio };
  }

  if (ratio >= 0.3) {
    return { status: 'watch', ratio };
  }

  return { status: 'healthy', ratio };
}

export function buildOperatorDashboard({
  days,
  orgRows = [],
  subscriptionRows = [],
  creditPurchaseRows = [],
  videoJobRows = [],
  executionEventRows = [],
  productEventRows = [],
  traceRows = [],
  earlyUserIds = [],
  now = () => new Date(),
}) {
  const subscriptionByOrg = new Map(subscriptionRows.map((sub) => [sub.orgId, sub]));
  const orgMap = new Map(orgRows.map((org) => [org.id, org]));

  // 1. Revenue / billing
  const planDistribution = buildPlanDistribution(orgRows);
  const estimatedMrrGbp = round(planDistribution.reduce((sum, plan) => sum + plan.estimatedMrrGbp, 0));
  const paidOrgs = orgRows.filter((org) => getBillingPlan(org.plan).monthlyPriceGbp > 0).length;

  const completedPurchases = creditPurchaseRows.filter((purchase) => purchase.status === 'completed');
  const creditPackPurchases = {
    count: completedPurchases.length,
    totalRevenueGbp: round(
      completedPurchases.reduce((sum, purchase) => sum + Number(purchase.amountGbp ?? 0), 0),
    ),
    breakdown: (() => {
      const map = new Map();
      for (const purchase of completedPurchases) {
        const key = purchase.packId;
        const current = map.get(key) ?? {
          packId: key,
          creditType: purchase.creditType,
          count: 0,
          revenueGbp: 0,
          creditsDelivered: 0,
        };
        current.count += 1;
        current.revenueGbp += Number(purchase.amountGbp ?? 0);
        current.creditsDelivered += Number(purchase.credits ?? 0);
        map.set(key, current);
      }
      return [...map.values()]
        .map((row) => ({
          ...row,
          revenueGbp: round(row.revenueGbp),
        }))
        .sort((a, b) => b.revenueGbp - a.revenueGbp);
    })(),
  };

  // 2. Usage
  const executionByOrg = new Map();
  let executionCredits = 0;
  for (const event of executionEventRows) {
    const orgId = event.orgId;
    const credits = Number(event.creditsCommitted ?? event.creditsReserved ?? 0);
    if (orgId) {
      executionByOrg.set(orgId, (executionByOrg.get(orgId) ?? 0) + credits);
      executionCredits += credits;
    }
  }

  const videoByOrg = new Map();
  const videoEventsByMode = { lite: 0, standard: 0, other: 0 };
  const videoStatusCounts = { queued: 0, reserved: 0, processing: 0, completed: 0, failed: 0, released: 0 };
  let videoCreditsUsed = 0;
  let totalProcessingSeconds = 0;
  let completedVideoSample = 0;
  for (const job of videoJobRows) {
    const orgId = job.orgId;
    const creditsUsed = Number(job.creditsCommitted ?? job.creditsReserved ?? 0);
    if (orgId) {
      videoByOrg.set(orgId, (videoByOrg.get(orgId) ?? 0) + creditsUsed);
      videoCreditsUsed += creditsUsed;
    }

    const mode = job.providerMetadata?.mode ?? 'other';
    if (videoEventsByMode[mode] !== undefined) {
      videoEventsByMode[mode] += 1;
    } else {
      videoEventsByMode.other += 1;
    }

    const status = videoStatusCounts[job.status] !== undefined ? job.status : null;
    if (status) {
      videoStatusCounts[status] += 1;
    }

    if (job.status === 'completed' && job.startedAt && job.completedAt) {
      const seconds = (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000;
      if (Number.isFinite(seconds) && seconds > 0) {
        totalProcessingSeconds += seconds;
        completedVideoSample += 1;
      }
    }
  }

  const paidOrgIds = new Set(orgRows.filter((org) => getBillingPlan(org.plan).monthlyPriceGbp > 0).map((org) => org.id));
  const paidOrgCount = paidOrgIds.size;
  const executionPerOrgAvg = safeDivide(executionCredits, orgRows.length);
  const paidVideoCredits = [...videoByOrg.entries()]
    .filter(([orgId]) => paidOrgIds.has(orgId))
    .reduce((sum, [, credits]) => sum + credits, 0);
  const videoPerPaidOrgAvg = safeDivide(paidVideoCredits, paidOrgCount);

  const topUsageOrgs = buildTopUsageOrgs({
    orgRows,
    executionByOrg,
    videoByOrg,
    subscriptionByOrg,
  });

  // 3. Video health
  const totalVideoJobs = videoJobRows.length;
  const completedVideoJobs = videoStatusCounts.completed;
  const failedVideoJobs = videoStatusCounts.failed;
  const videoFailureRate = round(safeDivide(failedVideoJobs, totalVideoJobs), 4);
  const averageVideoProcessingSeconds = round(
    safeDivide(totalProcessingSeconds, completedVideoSample),
    1,
  );

  // 4. Cost / margin signals
  const estimatedCostUsdThisCycle = round(
    subscriptionRows.reduce((sum, sub) => sum + Number(sub.cumulativeEstimatedCostUsd ?? 0), 0),
    2,
  );
  const estimatedCostGbpThisCycle = round(estimatedCostUsdThisCycle * USD_TO_GBP, 2);
  const estimatedRevenueContributionGbp = round(
    subscriptionRows.reduce((sum, sub) => sum + Number(sub.cumulativeRevenueGbp ?? 0), 0),
    2,
  );
  const costGuardTriggeredCount = executionEventRows.filter((row) => row.costGuardTriggered).length;
  const heavyUsageFlags = {
    execution: executionEventRows.filter((row) => row.heavyUsageFlagged).length,
    video: videoJobRows.filter((row) => row.heavyUsageFlagged).length,
  };
  const highCostOrgs = orgRows
    .map((org) => {
      const sub = subscriptionByOrg.get(org.id);
      const costUsd = Number(sub?.cumulativeEstimatedCostUsd ?? 0);
      const revenueGbp = Number(sub?.cumulativeRevenueGbp ?? 0);
      const risk = classifyRisk({ costUsd, revenueGbp });
      return {
        id: org.id,
        name: org.name,
        plan: org.plan,
        costUsd: round(costUsd, 4),
        revenueGbp: round(revenueGbp, 2),
        costGbp: round(costUsd * USD_TO_GBP, 2),
        ratio: Number.isFinite(risk.ratio) ? round(risk.ratio, 3) : null,
        status: risk.status,
      };
    })
    .filter((row) => row.status !== 'healthy')
    .sort((a, b) => (b.ratio ?? Infinity) - (a.ratio ?? Infinity))
    .slice(0, 15);

  // 5. Reliability
  const failedLlmRuns = traceRows.filter((row) => row.outcomeStatus === 'failed').length;
  const failureCodeCounts = new Map();
  for (const job of videoJobRows) {
    if (job.status === 'failed' && job.failureCode) {
      failureCodeCounts.set(job.failureCode, (failureCodeCounts.get(job.failureCode) ?? 0) + 1);
    }
  }
  for (const trace of traceRows) {
    if (trace.outcomeStatus === 'failed' && trace.failureClass) {
      failureCodeCounts.set(trace.failureClass, (failureCodeCounts.get(trace.failureClass) ?? 0) + 1);
    }
  }
  const topFailureCodes = [...failureCodeCounts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 6. Beta support
  const earlyUserFailures = productEventRows.filter((event) => {
    const label = String(event.eventName ?? '');
    if (!label.toLowerCase().includes('fail') && !label.endsWith('_failed')) {
      return false;
    }
    return event.userId && earlyUserIds.includes(event.userId);
  }).length;

  const since = new Date(now().getTime() - days * 24 * 60 * 60 * 1000);
  const recentlyActivatedOrgs = orgRows.filter((org) => org.createdAt >= since)
    .slice(0, 20)
    .map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      createdAt: org.createdAt,
    }));

  const firstChatOrgIds = new Set(
    productEventRows
      .filter((event) => event.eventName === 'activation.useful_output' && event.orgId)
      .map((event) => event.orgId),
  );
  const firstVideoOrgIds = new Set(
    videoJobRows
      .filter((job) => job.status === 'completed' && job.orgId)
      .map((job) => job.orgId),
  );

  const orgActivation = orgRows.map((org) => ({
    id: org.id,
    name: org.name,
    plan: org.plan,
    firstChat: firstChatOrgIds.has(org.id),
    firstVideo: firstVideoOrgIds.has(org.id),
  }));
  const firstChatCount = orgActivation.filter((row) => row.firstChat).length;
  const firstVideoCount = orgActivation.filter((row) => row.firstVideo).length;

  const recentFailureEvents = productEventRows
    .filter((event) => String(event.eventName ?? '').toLowerCase().includes('fail'))
    .slice(0, 20)
    .map((event) => ({
      id: event.id,
      orgId: event.orgId,
      userId: event.userId,
      orgName: event.orgId ? orgMap.get(event.orgId)?.name ?? null : null,
      eventName: event.eventName,
      failureCode: event.metadata?.failureCode ?? event.metadata?.code ?? null,
      failureMessage: event.metadata?.failureMessage ?? event.metadata?.message ?? null,
      createdAt: event.createdAt,
    }));

  return {
    windowDays: days,
    generatedAt: now().toISOString(),
    revenue: {
      estimatedMrrGbp,
      paidOrgs,
      totalOrgs: orgRows.length,
      planDistribution,
      creditPackPurchases,
    },
    usage: {
      executionCreditsUsed: executionCredits,
      videoCreditsUsed,
      averageExecutionCreditsPerOrg: round(executionPerOrgAvg, 1),
      averageVideoCreditsPerPaidOrg: round(videoPerPaidOrgAvg, 1),
      topOrgs: topUsageOrgs,
    },
    video: {
      total: totalVideoJobs,
      queued: videoStatusCounts.queued + videoStatusCounts.reserved,
      processing: videoStatusCounts.processing,
      completed: completedVideoJobs,
      failed: failedVideoJobs,
      released: videoStatusCounts.released,
      failureRate: videoFailureRate,
      averageProcessingSeconds: averageVideoProcessingSeconds,
      byMode: videoEventsByMode,
    },
    costMargin: {
      estimatedProviderCostUsd: estimatedCostUsdThisCycle,
      estimatedProviderCostGbp: estimatedCostGbpThisCycle,
      estimatedRevenueContributionGbp,
      costGuardTriggeredCount,
      heavyUsageFlags,
      highCostOrgs,
    },
    reliability: {
      failedLlmRuns,
      failedVideoJobs,
      topFailureCodes,
      recentFailureEvents,
    },
    beta: {
      earlyUserFailures,
      recentlyActivatedOrgs,
      firstChatCount,
      firstVideoCount,
      orgActivation: orgActivation.slice(0, 30),
    },
  };
}

router.get('/operator-dashboard', requireStaff, requireStaffPermission('admin.billing.read'), async (context) => {
  const days = getWindowDays(context, 30);
  const since = getSinceDate(days);

  const earlyUserIds = parseEarlyUserIds();

  const [
    orgRows,
    subscriptionRows,
    creditPurchaseRows,
    videoJobRows,
    executionEventRows,
    productEventRows,
    traceRows,
  ] = await Promise.all([
    db.query.organisations.findMany({ orderBy: [desc(organisations.createdAt)] }),
    db.query.subscriptions.findMany(),
    db.query.creditPurchases.findMany({
      where: gte(creditPurchases.createdAt, since),
      orderBy: [desc(creditPurchases.createdAt)],
    }),
    db.query.videoGenerationEvents.findMany({
      where: gte(videoGenerationEvents.createdAt, since),
      orderBy: [desc(videoGenerationEvents.createdAt)],
    }),
    db.query.executionUsageEvents.findMany({
      where: gte(executionUsageEvents.createdAt, since),
    }),
    db.query.productEvents.findMany({
      where: gte(productEvents.createdAt, since),
      orderBy: [desc(productEvents.createdAt)],
    }),
    db.query.llmExecutionTraces.findMany({
      where: gte(llmExecutionTraces.createdAt, since),
    }),
  ]);

  const subscriptionByOrg = new Map(subscriptionRows.map((sub) => [sub.orgId, sub]));
  const orgMap = new Map(orgRows.map((org) => [org.id, org]));

  // 1. Revenue / billing
  const planDistribution = buildPlanDistribution(orgRows);
  const estimatedMrrGbp = round(planDistribution.reduce((sum, plan) => sum + plan.estimatedMrrGbp, 0));
  const paidOrgs = orgRows.filter((org) => getBillingPlan(org.plan).monthlyPriceGbp > 0).length;

  const completedPurchases = creditPurchaseRows.filter((purchase) => purchase.status === 'completed');
  const creditPackPurchases = {
    count: completedPurchases.length,
    totalRevenueGbp: round(
      completedPurchases.reduce((sum, purchase) => sum + Number(purchase.amountGbp ?? 0), 0),
    ),
    breakdown: (() => {
      const map = new Map();
      for (const purchase of completedPurchases) {
        const key = purchase.packId;
        const current = map.get(key) ?? {
          packId: key,
          creditType: purchase.creditType,
          count: 0,
          revenueGbp: 0,
          creditsDelivered: 0,
        };
        current.count += 1;
        current.revenueGbp += Number(purchase.amountGbp ?? 0);
        current.creditsDelivered += Number(purchase.credits ?? 0);
        map.set(key, current);
      }
      return [...map.values()]
        .map((row) => ({
          ...row,
          revenueGbp: round(row.revenueGbp),
        }))
        .sort((a, b) => b.revenueGbp - a.revenueGbp);
    })(),
  };

  // 2. Usage
  const executionByOrg = new Map();
  let executionCredits = 0;
  for (const event of executionEventRows) {
    const orgId = event.orgId;
    const credits = Number(event.creditsCommitted ?? event.creditsReserved ?? 0);
    if (orgId) {
      executionByOrg.set(orgId, (executionByOrg.get(orgId) ?? 0) + credits);
      executionCredits += credits;
    }
  }

  const videoByOrg = new Map();
  const videoEventsByMode = { lite: 0, standard: 0, other: 0 };
  const videoStatusCounts = { queued: 0, reserved: 0, processing: 0, completed: 0, failed: 0, released: 0 };
  let videoCreditsUsed = 0;
  let totalProcessingSeconds = 0;
  let completedVideoSample = 0;
  for (const job of videoJobRows) {
    const orgId = job.orgId;
    const creditsUsed = Number(job.creditsCommitted ?? job.creditsReserved ?? 0);
    if (orgId) {
      videoByOrg.set(orgId, (videoByOrg.get(orgId) ?? 0) + creditsUsed);
      videoCreditsUsed += creditsUsed;
    }

    const mode = job.providerMetadata?.mode ?? 'other';
    if (videoEventsByMode[mode] !== undefined) {
      videoEventsByMode[mode] += 1;
    } else {
      videoEventsByMode.other += 1;
    }

    const status = videoStatusCounts[job.status] !== undefined ? job.status : null;
    if (status) {
      videoStatusCounts[status] += 1;
    }

    if (job.status === 'completed' && job.startedAt && job.completedAt) {
      const seconds = (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000;
      if (Number.isFinite(seconds) && seconds > 0) {
        totalProcessingSeconds += seconds;
        completedVideoSample += 1;
      }
    }
  }

  const paidOrgIds = new Set(orgRows.filter((org) => getBillingPlan(org.plan).monthlyPriceGbp > 0).map((org) => org.id));
  const paidOrgCount = paidOrgIds.size;
  const executionPerOrgAvg = safeDivide(executionCredits, orgRows.length);
  const paidVideoCredits = [...videoByOrg.entries()]
    .filter(([orgId]) => paidOrgIds.has(orgId))
    .reduce((sum, [, credits]) => sum + credits, 0);
  const videoPerPaidOrgAvg = safeDivide(paidVideoCredits, paidOrgCount);

  const topUsageOrgs = buildTopUsageOrgs({
    orgRows,
    executionByOrg,
    videoByOrg,
    subscriptionByOrg,
  });

  // 3. Video health
  const totalVideoJobs = videoJobRows.length;
  const completedVideoJobs = videoStatusCounts.completed;
  const failedVideoJobs = videoStatusCounts.failed;
  const videoFailureRate = round(safeDivide(failedVideoJobs, totalVideoJobs), 4);
  const averageVideoProcessingSeconds = round(
    safeDivide(totalProcessingSeconds, completedVideoSample),
    1,
  );

  // 4. Cost / margin signals
  const estimatedCostUsdThisCycle = round(
    subscriptionRows.reduce((sum, sub) => sum + Number(sub.cumulativeEstimatedCostUsd ?? 0), 0),
    2,
  );
  const estimatedCostGbpThisCycle = round(estimatedCostUsdThisCycle * USD_TO_GBP, 2);
  const estimatedRevenueContributionGbp = round(
    subscriptionRows.reduce((sum, sub) => sum + Number(sub.cumulativeRevenueGbp ?? 0), 0),
    2,
  );
  const costGuardTriggeredCount = executionEventRows.filter((row) => row.costGuardTriggered).length;
  const heavyUsageFlags = {
    execution: executionEventRows.filter((row) => row.heavyUsageFlagged).length,
    video: videoJobRows.filter((row) => row.heavyUsageFlagged).length,
  };
  const highCostOrgs = orgRows
    .map((org) => {
      const sub = subscriptionByOrg.get(org.id);
      const costUsd = Number(sub?.cumulativeEstimatedCostUsd ?? 0);
      const revenueGbp = Number(sub?.cumulativeRevenueGbp ?? 0);
      const risk = classifyRisk({ costUsd, revenueGbp });
      return {
        id: org.id,
        name: org.name,
        plan: org.plan,
        costUsd: round(costUsd, 4),
        revenueGbp: round(revenueGbp, 2),
        costGbp: round(costUsd * USD_TO_GBP, 2),
        ratio: Number.isFinite(risk.ratio) ? round(risk.ratio, 3) : null,
        status: risk.status,
      };
    })
    .filter((row) => row.status !== 'healthy')
    .sort((a, b) => (b.ratio ?? Infinity) - (a.ratio ?? Infinity))
    .slice(0, 15);

  // 5. Reliability
  const failedLlmRuns = traceRows.filter((row) => row.outcomeStatus === 'failed').length;
  const failureCodeCounts = new Map();
  for (const job of videoJobRows) {
    if (job.status === 'failed' && job.failureCode) {
      failureCodeCounts.set(job.failureCode, (failureCodeCounts.get(job.failureCode) ?? 0) + 1);
    }
  }
  for (const trace of traceRows) {
    if (trace.outcomeStatus === 'failed' && trace.failureClass) {
      failureCodeCounts.set(trace.failureClass, (failureCodeCounts.get(trace.failureClass) ?? 0) + 1);
    }
  }
  const topFailureCodes = [...failureCodeCounts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 6. Beta support
  const earlyUserFailures = productEventRows.filter((event) => {
    const label = String(event.eventName ?? '');
    if (!label.toLowerCase().includes('fail') && !label.endsWith('_failed')) {
      return false;
    }
    return event.userId && earlyUserIds.includes(event.userId);
  }).length;

  const recentlyActivatedOrgs = orgRows.filter((org) => org.createdAt >= since)
    .slice(0, 20)
    .map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      createdAt: org.createdAt,
    }));

  const firstChatOrgIds = new Set(
    productEventRows
      .filter((event) => event.eventName === 'activation.useful_output' && event.orgId)
      .map((event) => event.orgId),
  );
  const firstVideoOrgIds = new Set(
    videoJobRows
      .filter((job) => job.status === 'completed' && job.orgId)
      .map((job) => job.orgId),
  );

  const orgActivation = orgRows.map((org) => ({
    id: org.id,
    name: org.name,
    plan: org.plan,
    firstChat: firstChatOrgIds.has(org.id),
    firstVideo: firstVideoOrgIds.has(org.id),
  }));
  const firstChatCount = orgActivation.filter((row) => row.firstChat).length;
  const firstVideoCount = orgActivation.filter((row) => row.firstVideo).length;

  // Recent request_failed logs — pull from admin action logs / product events as proxy
  const recentFailureEvents = productEventRows
    .filter((event) => String(event.eventName ?? '').toLowerCase().includes('fail'))
    .slice(0, 20)
    .map((event) => ({
      id: event.id,
      orgId: event.orgId,
      userId: event.userId,
      orgName: event.orgId ? orgMap.get(event.orgId)?.name ?? null : null,
      eventName: event.eventName,
      failureCode: event.metadata?.failureCode ?? event.metadata?.code ?? null,
      failureMessage: event.metadata?.failureMessage ?? event.metadata?.message ?? null,
      createdAt: event.createdAt,
    }));

  return context.json({
    windowDays: days,
    generatedAt: new Date().toISOString(),
    revenue: {
      estimatedMrrGbp,
      paidOrgs,
      totalOrgs: orgRows.length,
      planDistribution,
      creditPackPurchases,
    },
    usage: {
      executionCreditsUsed: executionCredits,
      videoCreditsUsed,
      averageExecutionCreditsPerOrg: round(executionPerOrgAvg, 1),
      averageVideoCreditsPerPaidOrg: round(videoPerPaidOrgAvg, 1),
      topOrgs: topUsageOrgs,
    },
    video: {
      total: totalVideoJobs,
      queued: videoStatusCounts.queued + videoStatusCounts.reserved,
      processing: videoStatusCounts.processing,
      completed: completedVideoJobs,
      failed: failedVideoJobs,
      released: videoStatusCounts.released,
      failureRate: videoFailureRate,
      averageProcessingSeconds: averageVideoProcessingSeconds,
      byMode: videoEventsByMode,
    },
    costMargin: {
      estimatedProviderCostUsd: estimatedCostUsdThisCycle,
      estimatedProviderCostGbp: estimatedCostGbpThisCycle,
      estimatedRevenueContributionGbp,
      costGuardTriggeredCount,
      heavyUsageFlags,
      highCostOrgs,
    },
    reliability: {
      failedLlmRuns,
      failedVideoJobs,
      topFailureCodes,
      recentFailureEvents,
    },
    beta: {
      earlyUserFailures,
      recentlyActivatedOrgs,
      firstChatCount,
      firstVideoCount,
      orgActivation: orgActivation.slice(0, 30),
    },
  });
});

export default router;

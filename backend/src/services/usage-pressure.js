/**
 * Usage pressure + plan-aware upsell payloads for billing stats and onboarding CTAs.
 */

import { sql } from 'drizzle-orm';
import { getMonthlyInternalBurnCapGbp } from './billing-catalog.js';

export function computeMergedUsagePercentage(
  executionPercent = 0,
  videoPercent = 0,
  internalBurnRatioPercent = 0,
) {
  const merged = Math.max(
    Number(executionPercent) || 0,
    Number(videoPercent) || 0,
    Number(internalBurnRatioPercent) || 0,
  );
  return Math.round(Math.min(100, merged) * 100) / 100;
}

/** @typedef {'none'|'warning'|'high'|'critical'|'blocked'} PressureLevel */

export function usagePercentageToPressureLevel(usagePercentage) {
  const p = Number(usagePercentage) || 0;
  if (p >= 100) return 'blocked';
  if (p >= 95) return 'critical';
  if (p >= 85) return 'high';
  if (p >= 70) return 'warning';
  return 'none';
}

export function computeInternalBurnRatioPercent(estimatedGbpThisCycle = 0, planKey) {
  const cap = getMonthlyInternalBurnCapGbp(planKey);
  const est = Number(estimatedGbpThisCycle) || 0;
  if (!cap || cap <= 0) return 0;
  return Math.min(100, (est / cap) * 100);
}

const LEVEL_ORDER =
  /** @type {const} */ ({
    none: 0,
    warning: 1,
    high: 2,
    critical: 3,
    blocked: 4,
  });

function maxPressureLevels(...levels) {
  let winner = /** @type {PressureLevel} */ ('none');
  for (const lvl of levels) {
    if (lvl != null && typeof lvl === 'string' && LEVEL_ORDER[lvl] > LEVEL_ORDER[winner]) winner = /** @type {PressureLevel} */ (lvl);
  }
  return winner;
}

const SURFACE_PRESSURE =
  /** @type {Record<string, PressureLevel>} */ ({
    none: 'none',
    soft_banner: 'warning',
    strong_banner: 'high',
    banner: 'warning',
    modal: 'critical',
    blocked: 'blocked',
  });

/** @returns {PressureLevel} */
export function combineSurfacePressure(thresholdObj = {}) {
  const pl = thresholdObj.pressureLevel;
  if (
    pl === 'warning'
    || pl === 'high'
    || pl === 'critical'
    || pl === 'blocked'
    || pl === 'none'
  ) {
    return pl;
  }
  return SURFACE_PRESSURE[thresholdObj.surface ?? 'none'] ?? 'none';
}

export function computeUsagePressurePayload(executionSummary, videoSummary, econ = {}) {
  const execPct = Number(executionSummary?.percentUsed ?? 0) || 0;
  const vidPct = Number(videoSummary?.percentUsed ?? 0) || 0;
  const internalPct =
    econ.planKey && typeof econ.estimatedProviderCostGbpThisCycle === 'number'
      ? computeInternalBurnRatioPercent(econ.estimatedProviderCostGbpThisCycle, econ.planKey)
      : 0;

  const usagePercentage = computeMergedUsagePercentage(execPct, vidPct, internalPct);
  const fromPct = usagePercentageToPressureLevel(usagePercentage);

  const execPv = combineSurfacePressure(executionSummary?.threshold ?? {});
  const vidPv = combineSurfacePressure(videoSummary?.threshold ?? {});
  let pressureLevel = maxPressureLevels(
    fromPct,
    execPv === 'none' ? null : execPv,
    vidPv === 'none' ? null : vidPv,
  );

  return {
    usagePercentage,
    pressureLevel,
    breakdown: {
      executionPercentUsed: execPct,
      videoPercentUsed: vidPct,
      internalBurnRatioPercentUsed: Math.round(internalPct * 100) / 100,
    },
  };
}

/** @param {'execution'|'video'|'mixed'} usageType */
export function getUpgradeSuggestion(planKey, usageType = 'mixed') {
  const plan = planKey ?? 'free';

  /** @type {null | 'solo'|'pro'|'teams'|'agency'} */
  let planUpgrade = null;

  switch (plan) {
    case 'free':
      planUpgrade = 'solo';
      break;
    case 'solo':
      planUpgrade = 'pro';
      break;
    case 'pro':
      planUpgrade = 'teams';
      break;
    case 'teams':
      planUpgrade = 'agency';
      break;
    default:
      planUpgrade = null;
  }

  if (plan === 'agency') {
    planUpgrade = null;
  }

  const wantsVideoHeavy = usageType === 'video' || usageType === 'mixed';

  /** @type {{ packId?: string; creditType?: 'execution'|'video'; label?: string } | null} */
  let addOnSuggestion = null;
  switch (plan) {
    case 'free':
    case 'solo':
      addOnSuggestion = wantsVideoHeavy
        ? {
            creditType: 'video',
            packId: 'video_pack_small',
            label: 'Video Pack — add AI video renders',
          }
        : {
            creditType: 'execution',
            packId: 'exec_boost_1000',
            label: 'Execution Boost — add ~300 runs',
          };
      break;
    case 'pro':
      addOnSuggestion = wantsVideoHeavy
        ? {
            creditType: 'video',
            packId: 'video_pack_pro',
            label: 'Video Pack — volume',
          }
        : {
            creditType: 'execution',
            packId: 'exec_boost_1000',
            label: 'Execution Boost (~700)',
          };
      break;
    case 'teams':
      addOnSuggestion = wantsVideoHeavy
        ? {
            creditType: 'video',
            packId: 'video_pack_pro',
            label: 'Video Pack for spikes',
          }
        : {
            creditType: 'execution',
            packId: 'exec_boost_1000',
            label: 'Execution Boost (~1000)',
          };
      break;
    case 'agency':
      addOnSuggestion = {
        creditType: wantsVideoHeavy ? 'video' : 'execution',
        packId: wantsVideoHeavy ? 'video_pack_pro' : 'exec_boost_1000',
        label: wantsVideoHeavy ? 'Video Pack add-on' : 'Execution pack add-on',
      };
      break;
    default:
      addOnSuggestion = null;
  }

  const planUpgradeLabel =
    planUpgrade === 'solo'
      ? 'Solo · starter runway'
      : planUpgrade === 'pro'
      ? 'Pro · serious operators'
      : planUpgrade === 'teams'
        ? 'Teams · collaboration'
        : planUpgrade === 'agency'
          ? 'Agency · client workflows at scale'
          : null;

  const headline =
    plan === 'free'
      ? 'Activate Solo for a predictable starter runway — then scale with packs as throughput proves out.'
      : plan === 'agency'
      ? 'Keep Agency predictable: extend with usage packs.'
      : plan === 'teams'
        ? 'Coordinate more client workstreams — upgrade to Agency or add packs for spikes.'
        : plan === 'pro'
          ? 'Pair Teams collaboration with bursts from packs when usage jumps.'
          : 'Move faster with Pro or bolt on packs while you ramp.';

  return {
    planKey: plan,
    usageType,
    planUpgradeSuggested: planUpgrade,
    planUpgradeLabel,
    addOnSuggested: addOnSuggestion,
    headline,
    messages:
      plan === 'agency'
        ? [
          'Higher throughput without expanding base compute: packs map spend to bursts.',
          'Video packs reinforce premium delivery lanes; execution packs unlock agents during crunch.',
        ]
        : [
          headline,
          'Usage packs refill capacity instantly; upgrading unlocks seats, concurrency, and client-scale orchestration.',
        ],
  };
}

/**
 * Ledger-backed heavy-use + enterprise-interest flags (additive; failures are soft).
 */
export async function fetchLedgerMonetisationFlags(db, {
  orgId,
  userId,
  periodStart,
  planKey = 'free',
}) {
  if (!orgId || !userId || !periodStart) {
    return {
      heavyUser: false,
      heavyUserSignals: { reason: userId ? 'missing_period_anchor' : 'missing_user_or_period' },
      isEnterpriseEligible: false,
    };
  }

  try {
    const topShare = await db.execute(sql`
      WITH contrib AS (
        SELECT
          user_id,
          SUM(estimated_gbp_cost)::float AS burn
        FROM usage_estimate_events
        WHERE organisation_id = ${orgId}::uuid
          AND created_at >= ${periodStart}
          AND user_id IS NOT NULL
        GROUP BY user_id
      ),
      totals AS (
        SELECT COALESCE(SUM(burn), 0)::float AS org_total FROM contrib
      )
      SELECT c.user_id, c.burn,
        CASE WHEN COALESCE((SELECT org_total FROM totals), 0) > 0.02
             THEN ROUND((100.0 * c.burn / (SELECT org_total FROM totals))::numeric, 4)
             ELSE 0 END AS pct_of_org
      FROM contrib c
      WHERE c.user_id = ${userId};
    ;`);

    const row = (topShare.rows ?? topShare)?.[0];
    const pctOfOrg = row?.pct_of_org != null ? Number(row.pct_of_org) : 0;

    const percentileRow = await db.execute(sql`
      WITH contrib AS (
        SELECT user_id, SUM(estimated_gbp_cost)::float AS burn
        FROM usage_estimate_events
        WHERE organisation_id = ${orgId}::uuid
          AND created_at >= ${periodStart}
          AND user_id IS NOT NULL
        GROUP BY user_id
      ),
      ordered AS (
        SELECT user_id, burn,
               ROW_NUMBER() OVER (ORDER BY burn DESC)::int AS rn,
               COUNT(*) OVER ()::int AS total
        FROM contrib
      )
      SELECT rn, total FROM ordered WHERE user_id = ${userId};
    ;`);

    const pRow = (percentileRow.rows ?? percentileRow)?.[0];
    const rn = pRow?.rn != null ? Number(pRow.rn) : null;
    const total = pRow?.total != null ? Number(pRow.total) : null;

    const topTier =
      rn != null && total != null && total > 0 ? rn <= Math.max(1, Math.ceil(total * 0.05)) : false;

    const heavyUser =
      topTier
      || (pctOfOrg >= 33 && pctOfOrg > 0)
      || (row?.burn != null && Number(row.burn) > 150);

    const isEnterpriseEligible = Boolean(
      heavyUser && (planKey === 'teams' || planKey === 'agency'),
    );

    return {
      heavyUser,
      heavyUserSignals: {
        orgLedgerSharePct: pctOfOrg,
        leaderboardRankApprox: rn,
        contributorCountApprox: total,
      },
      isEnterpriseEligible,
    };
  } catch (_e) {
    return {
      heavyUser: false,
      heavyUserSignals: { reason: 'ledger_query_failed' },
      isEnterpriseEligible: false,
    };
  }
}

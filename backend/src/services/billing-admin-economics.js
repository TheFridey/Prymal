/**
 * Aggregates economics for the staff Revenue tab (billing burn vs MRR, ledger splits, alerting).
 */

import { sql } from 'drizzle-orm';
import { getMonthlyInternalBurnCapGbp } from './billing-catalog.js';
import { logger } from '../lib/logger.js';

const log = logger.child({ component: 'billing-economics' });
import { getBillingPeriodWindow } from './billing-periods.js';

const PLAN_ORDER = ['free', 'solo', 'pro', 'teams', 'agency'];

const DEFAULT_BURN_MRR_ALERT = Number(process.env.ADMIN_BURN_TO_MRR_RATIO_ALERT ?? 1.2);

/** @param {{ planKey: string, count: number, priceGbp: number }[]} planDistribution */
export async function enrichAdminEconomicsDashboard(db, params) {
  const {
    planDistribution = [],
    rollUpEstimatedProviderCostGbp = 0,
    approxHeadroomToInternalCapGbp = 0,
    estimatedMrrTotalGbp = 0,
  } = params;

  const subscriptionRows = await db.query.subscriptions.findMany();
  const billingPeriodSources = subscriptionRows.reduce((acc, subscription) => {
    const window = getBillingPeriodWindow(subscription);
    acc[window.source] = (acc[window.source] ?? 0) + 1;
    return acc;
  }, {});

  /** @type {{ planKey: string, totalUsers: number, mrrGbp: number, totalBurnGbp: number; avgBurnPerUser: number|null; avgHeadroomToCapGbp: number|null; pctUsersOver70PctCap: number|null; pctUsersOver90PctCap: number|null; avgPctOfCap: number|null; }[]} */
  const perPlanEconomics = [];
  /** @type {Array<{level: string; code: string; message: string; detail?: object}>} */
  const alerts = [];

  for (const row of PLAN_ORDER.map(
    (planKey) =>
      planDistribution.find((p) => p.plan === planKey)
      ?? { plan: planKey, count: 0, priceGbp: 0, estimatedMrrGbp: 0 },
  ).filter(Boolean)) {
    const planKey = row.plan;
    const headCount = row.count ?? 0;
    const mrrGbp = Number(row.estimatedMrrGbp ?? 0) || 0;
    const subsForPlan = subscriptionRows.filter((s) => String(s.plan) === planKey);
    const cap = getMonthlyInternalBurnCapGbp(planKey);
    let totalBurnGbp = 0;
    let pctSum = 0;
    let nCap = 0;
    let over70 = 0;
    let over90 = 0;

    for (const sub of subsForPlan) {
      const burn = Number(sub.cumulativeEstimatedCostGbp ?? 0) || 0;
      totalBurnGbp += burn;
      const ratio = cap > 0 ? burn / cap : 0;
      if (cap > 0) {
        pctSum += ratio * 100;
        nCap += 1;
        if (ratio >= 0.7) over70 += 1;
        if (ratio >= 0.9) over90 += 1;
      }
    }

    const avgBurnPerUser = headCount > 0 ? totalBurnGbp / headCount : null;
    const avgHeadroomToCap =
      subsForPlan.length > 0 && cap > 0
        ? subsForPlan.reduce((sum, sub) => {
            const burn = Number(sub.cumulativeEstimatedCostGbp ?? 0) || 0;
            return sum + Math.max(0, cap - burn);
          }, 0) / subsForPlan.length
        : null;
    const avgPctOfCap = nCap > 0 ? pctSum / nCap : null;

    perPlanEconomics.push({
      planKey,
      totalUsers: headCount,
      mrrGbp,
      totalBurnGbp,
      avgBurnPerUser,
      avgHeadroomToCapGbp: avgHeadroomToCap,
      pctUsersOver70PctCap: subsForPlan.length > 0 ? (over70 / subsForPlan.length) * 100 : null,
      pctUsersOver90PctCap: subsForPlan.length > 0 ? (over90 / subsForPlan.length) * 100 : null,
      avgPctOfCap,
    });

    if (avgPctOfCap != null && avgPctOfCap > 80) {
      alerts.push({
        level: 'warning',
        code: 'PLAN_AVG_BURN_GT_80_CAP',
        message: `Plan ${planKey}: average estimated burn is above 80% of internal cap.`,
        detail: { planKey, avgPctOfCap },
      });
    }
  }

  const over95Subs = subscriptionRows.filter((sub) => {
    const cap = getMonthlyInternalBurnCapGbp(sub.plan);
    const burn = Number(sub.cumulativeEstimatedCostGbp ?? 0) || 0;
    return cap > 0 && burn / cap >= 0.95;
  });

  if (over95Subs.length > 0) {
    alerts.push({
      level: 'critical',
      code: 'WORKSPACES_GT_95_PCT_INTERNAL_CAP',
      message: `${over95Subs.length} workspace(s) are above 95% of internal burn cap this cycle.`,
      detail: {
        orgIds: over95Subs.slice(0, 30).map((s) => s.orgId),
        count: over95Subs.length,
      },
    });
  }

  let cycleExecutionGbp = 0;
  let cycleVideoGbp = 0;
  let cycleTotalGbp = 0;
  let allTimeExecutionGbp = 0;
  let allTimeVideoGbp = 0;
  let allTimeTotalGbp = 0;
  let cycleBurnByPlan = {};
  let allTimeBurnByPlan = {};
  /** @type {Array<{ organisationId: string; name: string; planKey?: string; estimatedBurnGbp: number; burnCapRatio?: number|null; burnCapStatus?: string }>} */
  let topWorkspaces = [];
  /** @type {Array<{ userId: string; email: string | null; estimatedBurnGbp: number }>} */
  let topUsers = [];

  try {
    const cycleAgg = await db.execute(sql`
      WITH scoped_events AS (
        SELECT e.*
        FROM usage_estimate_events e
        LEFT JOIN subscriptions s ON s.org_id = e.organisation_id
        WHERE e.created_at >= COALESCE(s.current_period_start, date_trunc('month', NOW()))
          AND e.created_at < COALESCE(s.current_period_end, date_trunc('month', NOW()) + interval '1 month')
      )
      SELECT
        COALESCE(SUM(estimated_gbp_cost) FILTER (WHERE action_type = 'execution'), 0)::float AS execution_gbp,
        COALESCE(SUM(estimated_gbp_cost) FILTER (WHERE action_type = 'video'), 0)::float AS video_gbp,
        COALESCE(SUM(estimated_gbp_cost), 0)::float AS total_gbp
      FROM scoped_events
    `);
    const c0 = (cycleAgg.rows ?? cycleAgg)?.[0];
    if (c0) {
      cycleExecutionGbp = Number(c0.execution_gbp ?? 0) || 0;
      cycleVideoGbp = Number(c0.video_gbp ?? 0) || 0;
      cycleTotalGbp = Number(c0.total_gbp ?? 0) || 0;
    }

    const allTimeAgg = await db.execute(sql`
      SELECT
        COALESCE(SUM(estimated_gbp_cost) FILTER (WHERE action_type = 'execution'), 0)::float AS execution_gbp,
        COALESCE(SUM(estimated_gbp_cost) FILTER (WHERE action_type = 'video'), 0)::float AS video_gbp,
        COALESCE(SUM(estimated_gbp_cost), 0)::float AS total_gbp
      FROM usage_estimate_events
    `);
    const a0 = (allTimeAgg.rows ?? allTimeAgg)?.[0];
    if (a0) {
      allTimeExecutionGbp = Number(a0.execution_gbp ?? 0) || 0;
      allTimeVideoGbp = Number(a0.video_gbp ?? 0) || 0;
      allTimeTotalGbp = Number(a0.total_gbp ?? 0) || 0;
    }

    const orgMap = new Map(
      (await db.query.organisations.findMany()).map((o) => [o.id, o.name ?? o.slug ?? o.id]),
    );

    const planCycle = await db.execute(sql`
      WITH scoped_events AS (
        SELECT e.*, COALESCE(s.plan, e.plan_key) AS resolved_plan
        FROM usage_estimate_events e
        LEFT JOIN subscriptions s ON s.org_id = e.organisation_id
        WHERE e.created_at >= COALESCE(s.current_period_start, date_trunc('month', NOW()))
          AND e.created_at < COALESCE(s.current_period_end, date_trunc('month', NOW()) + interval '1 month')
      )
      SELECT resolved_plan AS plan_key, SUM(estimated_gbp_cost)::float AS burn
      FROM scoped_events
      GROUP BY resolved_plan
    `);
    cycleBurnByPlan = Object.fromEntries(
      (planCycle.rows ?? planCycle).map((r) => [String(r.plan_key ?? 'free'), Number(r.burn ?? 0) || 0]),
    );

    const planAllTime = await db.execute(sql`
      SELECT plan_key, SUM(estimated_gbp_cost)::float AS burn
      FROM usage_estimate_events
      GROUP BY plan_key
    `);
    allTimeBurnByPlan = Object.fromEntries(
      (planAllTime.rows ?? planAllTime).map((r) => [String(r.plan_key ?? 'free'), Number(r.burn ?? 0) || 0]),
    );

    const ws = await db.execute(sql`
      SELECT
        e.organisation_id AS org_id,
        COALESCE(s.plan, MAX(e.plan_key)) AS plan_key,
        SUM(e.estimated_gbp_cost)::float AS burn
      FROM usage_estimate_events e
      LEFT JOIN subscriptions s ON s.org_id = e.organisation_id
      WHERE e.created_at >= COALESCE(s.current_period_start, date_trunc('month', NOW()))
        AND e.created_at < COALESCE(s.current_period_end, date_trunc('month', NOW()) + interval '1 month')
      GROUP BY e.organisation_id, s.plan
      ORDER BY burn DESC NULLS LAST
      LIMIT 10
    `);
    topWorkspaces = (ws.rows ?? ws).map((r) => ({
      organisationId: r.org_id,
      name: orgMap.get(r.org_id) ?? String(r.org_id),
      planKey: r.plan_key ?? null,
      estimatedBurnGbp: Number(r.burn ?? 0) || 0,
    })).map((row) => {
      const cap = getMonthlyInternalBurnCapGbp(row.planKey);
      const ratio = cap > 0 ? row.estimatedBurnGbp / cap : null;
      return {
        ...row,
        burnCapRatio: ratio,
        burnCapStatus: ratio == null
          ? 'unknown'
          : ratio >= 1
            ? 'critical'
            : ratio >= 0.9
              ? 'red'
              : ratio >= 0.7
                ? 'amber'
                : 'normal',
      };
    });

    const tu = await db.execute(sql`
      SELECT e.user_id AS user_id, u.email AS email, SUM(e.estimated_gbp_cost)::float AS burn
      FROM usage_estimate_events e
      LEFT JOIN subscriptions s ON s.org_id = e.organisation_id
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.user_id IS NOT NULL
        AND e.created_at >= COALESCE(s.current_period_start, date_trunc('month', NOW()))
        AND e.created_at < COALESCE(s.current_period_end, date_trunc('month', NOW()) + interval '1 month')
      GROUP BY e.user_id, u.email
      ORDER BY burn DESC NULLS LAST
      LIMIT 10
    `);
    topUsers = (tu.rows ?? tu).map((r) => ({
      userId: r.user_id,
      email: r.email ?? null,
      estimatedBurnGbp: Number(r.burn ?? 0) || 0,
    }));
  } catch (e) {
    log.warn({ err: e }, 'admin.economics.ledger_query_failed');
  }

  const grossContributionGbp = estimatedMrrTotalGbp - rollUpEstimatedProviderCostGbp;
  const burnToMrrRatio =
    estimatedMrrTotalGbp > 0 ? rollUpEstimatedProviderCostGbp / estimatedMrrTotalGbp : null;

  if (burnToMrrRatio != null && burnToMrrRatio > DEFAULT_BURN_MRR_ALERT) {
    alerts.push({
      level: 'warning',
      code: 'GLOBAL_BURN_MRR_RATIO',
      message: `Estimated total burn / MRR is above ${DEFAULT_BURN_MRR_ALERT}×.`,
      detail: { burnToMrrRatio, threshold: DEFAULT_BURN_MRR_ALERT },
    });
  }

  return {
    global: {
      totalEstimatedBurnGbp: rollUpEstimatedProviderCostGbp,
      totalMrrGbp: estimatedMrrTotalGbp,
      estimatedGrossContributionGbp: grossContributionGbp,
      approxHeadroomToInternalCapGbp,
      burnToMrrRatio,
      billingPeriodSources,
    },
    ledger: {
      scope: 'current_cycle',
      executionCostGbp: cycleExecutionGbp,
      videoCostGbp: cycleVideoGbp,
      totalLedgerGbp: cycleTotalGbp,
      burnByPlan: cycleBurnByPlan,
      allTime: {
        executionCostGbp: allTimeExecutionGbp,
        videoCostGbp: allTimeVideoGbp,
        totalLedgerGbp: allTimeTotalGbp,
        burnByPlan: allTimeBurnByPlan,
      },
    },
    perPlan: perPlanEconomics,
    topWorkspaces,
    topUsers,
    alerts,
  };
}

/**
 * Aggregates economics for the staff Revenue tab (billing burn vs MRR, ledger splits, alerting).
 */

import { sql } from 'drizzle-orm';
import { getMonthlyInternalBurnCapGbp } from './billing-catalog.js';

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

  let ledgerExecutionGbp = 0;
  let ledgerVideoGbp = 0;
  let ledgerTotalGbp = 0;
  /** @type {Array<{ organisationId: string; name: string; estimatedBurnGbp: number }>} */
  let topWorkspaces = [];
  /** @type {Array<{ userId: string; email: string | null; estimatedBurnGbp: number }>} */
  let topUsers = [];

  try {
    const agg = await db.execute(sql`
      SELECT
        COALESCE(SUM(estimated_gbp_cost) FILTER (WHERE action_type = 'execution'), 0)::float AS execution_gbp,
        COALESCE(SUM(estimated_gbp_cost) FILTER (WHERE action_type = 'video'), 0)::float AS video_gbp,
        COALESCE(SUM(estimated_gbp_cost), 0)::float AS total_gbp
      FROM usage_estimate_events
    `);
    const a0 = (agg.rows ?? agg)?.[0];
    if (a0) {
      ledgerExecutionGbp = Number(a0.execution_gbp ?? 0) || 0;
      ledgerVideoGbp = Number(a0.video_gbp ?? 0) || 0;
      ledgerTotalGbp = Number(a0.total_gbp ?? 0) || 0;
    }

    const orgMap = new Map(
      (await db.query.organisations.findMany()).map((o) => [o.id, o.name ?? o.slug ?? o.id]),
    );

    const ws = await db.execute(sql`
      SELECT organisation_id AS org_id, SUM(estimated_gbp_cost)::float AS burn
      FROM usage_estimate_events
      GROUP BY organisation_id
      ORDER BY burn DESC NULLS LAST
      LIMIT 10
    `);
    topWorkspaces = (ws.rows ?? ws).map((r) => ({
      organisationId: r.org_id,
      name: orgMap.get(r.org_id) ?? String(r.org_id),
      estimatedBurnGbp: Number(r.burn ?? 0) || 0,
    }));

    const tu = await db.execute(sql`
      SELECT e.user_id AS user_id, u.email AS email, SUM(e.estimated_gbp_cost)::float AS burn
      FROM usage_estimate_events e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.user_id IS NOT NULL
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
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'admin.economics.ledger_query_failed',
        message: e?.message ?? String(e),
      }),
    );
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
    },
    ledger: {
      executionCostGbp: ledgerExecutionGbp,
      videoCostGbp: ledgerVideoGbp,
      totalLedgerGbp: ledgerTotalGbp,
    },
    perPlan: perPlanEconomics,
    topWorkspaces,
    topUsers,
    alerts,
  };
}

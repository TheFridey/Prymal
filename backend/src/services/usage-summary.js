import { sql } from 'drizzle-orm';
import { AGENTS } from '../agents/config.js';
import { db } from '../db/index.js';
import { getBillingSnapshotForOrg } from './billing-engine.js';

const PERIODS = new Set(['week', 'month', 'all']);

export function normalizeUsagePeriod(input = 'month') {
  return PERIODS.has(input) ? input : 'month';
}

export function resolveUsagePeriodWindow(period, now = new Date()) {
  const normalized = normalizeUsagePeriod(period);
  const end = now;

  if (normalized === 'week') {
    return {
      period: normalized,
      start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      end,
    };
  }

  if (normalized === 'all') {
    return {
      period: normalized,
      start: null,
      end,
    };
  }

  return {
    period: normalized,
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)),
    end,
  };
}

export async function getUsageSummary({ orgId, now = new Date() }) {
  const billingSnapshot = await getBillingSnapshotForOrg(orgId);
  const execution = billingSnapshot.credits.execution;
  const periodStart =
    billingSnapshot.subscription.currentPeriodStart
    ?? billingSnapshot.subscription.createdAt
    ?? resolveUsagePeriodWindow('month', now).start;
  const periodEnd = billingSnapshot.subscription.currentPeriodEnd ?? now;

  return {
    creditsRemaining: execution.available,
    creditsUsedThisPeriod: execution.committedThisCycle,
    periodStart: periodStart?.toISOString?.() ?? new Date(periodStart).toISOString(),
    periodEnd: periodEnd?.toISOString?.() ?? new Date(periodEnd).toISOString(),
  };
}

export async function getUsageBreakdown({ orgId, period = 'month', now = new Date(), dbClient = db }) {
  const window = resolveUsagePeriodWindow(period, now);
  const periodFilter = window.start ? sql`AND e.created_at >= ${window.start}` : sql``;
  const agentRows = await dbClient.execute(sql`
    SELECT
      e.agent_id,
      COALESCE(SUM(e.credits_committed), 0)::int AS credits_used,
      COUNT(*)::int AS runs,
      MAX(e.completed_at)::timestamptz AS last_used_at
    FROM execution_usage_event e
    WHERE e.org_id = ${orgId}
      AND e.status = 'committed'
      ${periodFilter}
    GROUP BY e.agent_id
    ORDER BY credits_used DESC, last_used_at DESC
  `);
  const workflowRows = await dbClient.execute(sql`
    SELECT
      w.id AS workflow_id,
      w.name AS workflow_name,
      COALESCE(SUM(e.credits_committed), 0)::int AS credits_used,
      COUNT(DISTINCT wr.id)::int AS runs,
      MAX(wr.completed_at)::timestamptz AS last_run_at
    FROM execution_usage_event e
    INNER JOIN workflow_runs wr ON wr.id = e.workflow_run_id
    INNER JOIN workflows w ON w.id = wr.workflow_id
    WHERE e.org_id = ${orgId}
      AND e.status = 'committed'
      AND e.workflow_run_id IS NOT NULL
      ${periodFilter}
    GROUP BY w.id, w.name
    ORDER BY credits_used DESC, last_run_at DESC
  `);

  return {
    byAgent: normalizeAgentRows(agentRows.rows ?? agentRows),
    byWorkflow: normalizeWorkflowRows(workflowRows.rows ?? workflowRows),
    period: window.period,
  };
}

export function normalizeAgentRows(rows = []) {
  return rows.map((row) => ({
    agentId: row.agent_id,
    agentName: AGENTS[row.agent_id]?.name ?? String(row.agent_id ?? '').toUpperCase(),
    creditsUsed: Number(row.credits_used ?? 0),
    runs: Number(row.runs ?? 0),
    lastUsedAt: row.last_used_at ?? null,
  }));
}

export function normalizeWorkflowRows(rows = []) {
  return rows.map((row) => ({
    workflowId: row.workflow_id,
    workflowName: row.workflow_name ?? 'Workflow',
    creditsUsed: Number(row.credits_used ?? 0),
    runs: Number(row.runs ?? 0),
    lastRunAt: row.last_run_at ?? null,
  }));
}

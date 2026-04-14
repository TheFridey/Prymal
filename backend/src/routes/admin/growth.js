import { desc } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/index.js';
import {
  llmExecutionTraces,
  loreDocuments,
  organisations,
  productEvents,
  users,
  workflowRuns,
  workflows,
} from '../../db/schema.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';

const router = new Hono();

router.get('/growth', requireStaff, requireStaffPermission('admin.activity.read'), async (context) => {
  const [
    organisationRows,
    userRows,
    eventRows,
    traceRows,
    workflowRows,
    workflowRunRows,
    documentRows,
  ] = await Promise.all([
    db.query.organisations.findMany({ orderBy: [desc(organisations.createdAt)] }),
    db.query.users.findMany({ orderBy: [desc(users.createdAt)] }),
    db.query.productEvents.findMany({ orderBy: [desc(productEvents.createdAt)] }),
    db.query.llmExecutionTraces.findMany({ orderBy: [desc(llmExecutionTraces.createdAt)] }),
    db.query.workflows.findMany({ orderBy: [desc(workflows.createdAt)] }),
    db.query.workflowRuns.findMany({ orderBy: [desc(workflowRuns.createdAt)] }),
    db.query.loreDocuments.findMany({ orderBy: [desc(loreDocuments.createdAt)] }),
  ]);

  return context.json({
    growth: buildGrowthSnapshot({
      organisations: organisationRows,
      users: userRows,
      events: eventRows,
      traces: traceRows,
      workflows: workflowRows,
      workflowRuns: workflowRunRows,
      documents: documentRows,
    }),
  });
});

export function buildGrowthSnapshot({
  organisations = [],
  users = [],
  events = [],
  traces = [],
  workflows = [],
  workflowRuns = [],
  documents = [],
  now = new Date(),
}) {
  const since7 = daysAgo(now, 7);
  const since14 = daysAgo(now, 14);
  const since30 = daysAgo(now, 30);
  const since60 = daysAgo(now, 60);
  const since90 = daysAgo(now, 90);

  const recentOrgs = organisations.filter((row) => row.createdAt >= since30);
  const events30 = events.filter((row) => row.createdAt >= since30);
  const traces30 = traces.filter((row) => row.createdAt >= since30);
  const workflows30 = workflows.filter((row) => row.createdAt >= since30);
  const workflowRuns30 = workflowRuns.filter((row) => row.createdAt >= since30);
  const documents30 = documents.filter((row) => row.createdAt >= since30);

  const usersByOrg = countBy(users, (row) => row.orgId);
  const tracesByOrg30 = groupBy(traces30, (row) => row.orgId);
  const workflowRunsByOrg30 = groupBy(workflowRuns30, (row) => row.orgId);
  const workflowRunsByOrgPrev30 = groupBy(
    workflowRuns.filter((row) => row.createdAt >= since60 && row.createdAt < since30),
    (row) => row.orgId,
  );
  const eventsByOrg30 = groupBy(events30, (row) => row.orgId);
  const docsByOrg30 = groupBy(documents30, (row) => row.orgId);

  const onboardingCompletedOrgIds = new Set(
    events30
      .filter((row) => row.eventName === 'onboarding.completed' && row.orgId)
      .map((row) => row.orgId),
  );
  const firstRunOrgIds = new Set(
    [
      ...events30.filter((row) => row.eventName === 'chat.message_completed' && row.orgId).map((row) => row.orgId),
      ...traces30.filter((row) => row.orgId).map((row) => row.orgId),
    ],
  );
  const repeatEngagementOrgIds = new Set(
    recentOrgs
      .filter((org) => {
        const engagementCount = (eventsByOrg30.get(org.id)?.length ?? 0)
          + (tracesByOrg30.get(org.id)?.length ?? 0)
          + (workflowRunsByOrg30.get(org.id)?.length ?? 0);
        return engagementCount >= 3;
      })
      .map((org) => org.id),
  );
  const paidConversionOrgIds = new Set(
    events30
      .filter((row) => row.eventName === 'billing.plan_changed' && row.orgId && row.metadata?.plan && row.metadata.plan !== 'free')
      .map((row) => row.orgId),
  );

  const onboardingLeadTimes = recentOrgs
    .map((org) => {
      const firstActivityAt = findFirstActivityAt(org.id, { events, traces, workflowRuns });
      if (!firstActivityAt) {
        return null;
      }
      return Math.max(firstActivityAt.getTime() - new Date(org.createdAt).getTime(), 0);
    })
    .filter((value) => Number.isFinite(value));

  const workflowsActivated = new Set(
    workflowRuns30
      .filter((row) => row.status === 'completed' && row.workflowId)
      .map((row) => row.workflowId),
  );
  const providerEvents = events30.filter((row) => row.eventName === 'billing.subscription_cancelled');

  const activationFunnel = {
    signups: recentOrgs.length,
    onboardingStarted: recentOrgs.length,
    onboardingCompleted: onboardingCompletedOrgIds.size,
    firstAgentRun: firstRunOrgIds.size,
    repeatEngagement: repeatEngagementOrgIds.size,
    paidConversion: paidConversionOrgIds.size,
  };

  const onboardingMetrics = {
    avgCompletionPct: recentOrgs.length > 0 ? Number(((onboardingCompletedOrgIds.size / recentOrgs.length) * 100).toFixed(1)) : 0,
    medianTimeToFirstRunMs: median(onboardingLeadTimes),
    completedThisWeek: events.filter((row) => row.eventName === 'onboarding.completed' && row.createdAt >= since7).length,
  };

  const workflowConversion = {
    workflowsCreated: workflows30.length,
    workflowsActivated: workflowsActivated.size,
    workflowRunsLast30d: workflowRuns30.length,
    avgSuccessRate: workflowRuns30.length > 0
      ? Number((workflowRuns30.filter((row) => row.status === 'completed').length / workflowRuns30.length).toFixed(4))
      : 0,
  };

  const agentUsage = buildAgentUsage(traces30);
  const loreUsage = buildLoreUsage(documents, documents30, since90);
  const seatExpansion = buildSeatExpansionSignals(organisations, usersByOrg, tracesByOrg30, workflowRunsByOrg30);
  const churnSignals = buildChurnSignals({
    organisations,
    traces,
    workflowRuns,
    events,
    workflowRunsByOrg30,
    workflowRunsByOrgPrev30,
    providerEvents,
    since14,
  });
  const powerUserOrgs = buildPowerUserSignals({
    organisations,
    usersByOrg,
    tracesByOrg30,
    workflowRunsByOrg30,
    docsByOrg30,
  });
  const inactivityAlerts = buildInactivityAlerts({
    organisations,
    events,
    traces,
    workflowRuns,
    since14,
    now,
  });
  const cohortRetention = buildCohortRetention({
    organisations,
    events,
    traces,
    workflowRuns,
    now,
  });

  return {
    activationFunnel,
    onboardingMetrics,
    workflowConversion,
    agentUsage,
    loreUsage,
    seatExpansion,
    churnSignals,
    powerUserOrgs,
    inactivityAlerts,
    cohortRetention,
  };
}

function buildAgentUsage(traces) {
  const byAgent = new Map();

  for (const trace of traces) {
    const current = byAgent.get(trace.agentId) ?? {
      agentId: trace.agentId,
      displayName: trace.agentId.toUpperCase(),
      runs: 0,
      successCount: 0,
      totalLatencyMs: 0,
      providerMix: {},
    };

    current.runs += 1;
    current.successCount += trace.outcomeStatus === 'succeeded' ? 1 : 0;
    current.totalLatencyMs += trace.latencyMs ?? 0;
    current.providerMix[trace.provider] = (current.providerMix[trace.provider] ?? 0) + 1;
    byAgent.set(trace.agentId, current);
  }

  return [...byAgent.values()].map((entry) => ({
    agentId: entry.agentId,
    displayName: entry.displayName,
    runs: entry.runs,
    successRate: entry.runs > 0 ? Number((entry.successCount / entry.runs).toFixed(4)) : 0,
    avgLatencyMs: entry.runs > 0 ? Math.round(entry.totalLatencyMs / entry.runs) : 0,
    dominantProvider: Object.entries(entry.providerMix).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null,
  }));
}

function buildLoreUsage(allDocuments, recentDocuments, staleSince) {
  const bySourceType = countBy(allDocuments, (row) => row.sourceType);
  const topSourceTypes = [...bySourceType.entries()]
    .map(([sourceType, count]) => ({ sourceType, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);

  return {
    documentsUploaded30d: recentDocuments.length,
    indexedDocuments30d: recentDocuments.filter((row) => row.status === 'indexed').length,
    conflictedDocuments: allDocuments.filter((row) => Number(row.metadata?.contradictionCount ?? 0) > 0).length,
    staleDocuments: allDocuments.filter((row) => row.updatedAt < staleSince).length,
    topSourceTypes,
  };
}

function buildSeatExpansionSignals(organisations, usersByOrg, tracesByOrg30, workflowRunsByOrg30) {
  return organisations
    .map((org) => {
      const usedSeats = usersByOrg.get(org.id) ?? 0;
      const seatUtilization = org.seatLimit > 0 ? usedSeats / org.seatLimit : 0;
      const runRate30d = (tracesByOrg30.get(org.id)?.length ?? 0) + (workflowRunsByOrg30.get(org.id)?.length ?? 0);

      if (seatUtilization < 0.75 && runRate30d < 20) {
        return null;
      }

      return {
        orgId: org.id,
        orgName: org.name,
        currentPlan: org.plan,
        usedSeats,
        totalSeats: org.seatLimit,
        runRate30d,
        expansionSignal: seatUtilization >= 0.95
          ? 'At seat capacity'
          : runRate30d >= 80
            ? 'High workflow and agent activity'
            : 'Team approaching seat limit',
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.runRate30d - left.runRate30d)
    .slice(0, 8);
}

function buildChurnSignals({
  organisations,
  traces,
  workflowRuns,
  events,
  workflowRunsByOrg30,
  workflowRunsByOrgPrev30,
  providerEvents,
  since14,
}) {
  return organisations
    .filter((org) => org.plan !== 'free')
    .map((org) => {
      const signals = [];
      const lastActiveAt = findLastActivityAt(org.id, { events, traces, workflowRuns });
      const recentRuns = workflowRunsByOrg30.get(org.id)?.length ?? 0;
      const previousRuns = workflowRunsByOrgPrev30.get(org.id)?.length ?? 0;
      const cancelled = providerEvents.some((row) => row.orgId === org.id);

      if (!lastActiveAt || lastActiveAt < since14) {
        signals.push('No meaningful activity in the last 14 days');
      }

      if (previousRuns >= 10 && recentRuns <= Math.max(Math.floor(previousRuns * 0.4), 2)) {
        signals.push('Workflow execution dropped sharply versus the previous 30 days');
      }

      if (cancelled) {
        signals.push('Subscription cancellation signal recorded');
      }

      if (signals.length === 0) {
        return null;
      }

      return {
        orgId: org.id,
        orgName: org.name,
        plan: org.plan,
        riskLevel: cancelled || signals.length >= 2 ? 'high' : 'medium',
        signals,
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

function buildPowerUserSignals({ organisations, usersByOrg, tracesByOrg30, workflowRunsByOrg30, docsByOrg30 }) {
  return organisations
    .map((org) => {
      const traceCount = tracesByOrg30.get(org.id)?.length ?? 0;
      const workflowCount = workflowRunsByOrg30.get(org.id)?.length ?? 0;
      const docCount = docsByOrg30.get(org.id)?.length ?? 0;
      const activeSeats = usersByOrg.get(org.id) ?? 0;
      const score = traceCount + (workflowCount * 2) + (docCount * 4) + (activeSeats * 3);

      if (score < 40) {
        return null;
      }

      return {
        orgId: org.id,
        orgName: org.name,
        plan: org.plan,
        score,
        traceCount,
        workflowCount,
        docCount,
        activeSeats,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);
}

function buildInactivityAlerts({ organisations, events, traces, workflowRuns, since14, now }) {
  return organisations
    .map((org) => {
      const lastActiveAt = findLastActivityAt(org.id, { events, traces, workflowRuns });

      if (!lastActiveAt || lastActiveAt >= since14) {
        return null;
      }

      const daysInactive = Math.max(Math.round((now.getTime() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24)), 1);
      return {
        orgId: org.id,
        orgName: org.name,
        plan: org.plan,
        lastActiveAt: lastActiveAt.toISOString(),
        daysInactive,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.daysInactive - left.daysInactive)
    .slice(0, 8);
}

function buildCohortRetention({ organisations, events, traces, workflowRuns, now }) {
  const start = daysAgo(now, 56);
  const cohorts = groupBy(
    organisations.filter((org) => org.createdAt >= start),
    (org) => toWeekKey(org.createdAt),
  );

  return [...cohorts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([week, cohort]) => ({
      week,
      cohortSize: cohort.length,
      retentionByWeek: [1, 2, 3, 4].map((weekOffset) => {
        const retained = cohort.filter((org) =>
          hasActivityInWeek(org.id, org.createdAt, weekOffset, { events, traces, workflowRuns }),
        ).length;
        return cohort.length > 0 ? Number((retained / cohort.length).toFixed(4)) : 0;
      }),
    }))
    .slice(-8);
}

function hasActivityInWeek(orgId, createdAt, weekOffset, { events, traces, workflowRuns }) {
  const created = new Date(createdAt);
  const start = new Date(created.getTime() + (weekOffset - 1) * 7 * 24 * 60 * 60 * 1000);
  const end = new Date(created.getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000);
  return hasActivityBetween(orgId, start, end, { events, traces, workflowRuns });
}

function hasActivityBetween(orgId, start, end, { events, traces, workflowRuns }) {
  return events.some((row) => row.orgId === orgId && row.createdAt >= start && row.createdAt < end)
    || traces.some((row) => row.orgId === orgId && row.createdAt >= start && row.createdAt < end)
    || workflowRuns.some((row) => row.orgId === orgId && row.createdAt >= start && row.createdAt < end);
}

function findFirstActivityAt(orgId, { events, traces, workflowRuns }) {
  const timestamps = [
    ...events.filter((row) => row.orgId === orgId).map((row) => row.createdAt),
    ...traces.filter((row) => row.orgId === orgId).map((row) => row.createdAt),
    ...workflowRuns.filter((row) => row.orgId === orgId).map((row) => row.createdAt),
  ].sort((left, right) => left.getTime() - right.getTime());

  return timestamps[0] ?? null;
}

function findLastActivityAt(orgId, { events, traces, workflowRuns }) {
  const timestamps = [
    ...events.filter((row) => row.orgId === orgId).map((row) => row.createdAt),
    ...traces.filter((row) => row.orgId === orgId).map((row) => row.createdAt),
    ...workflowRuns.filter((row) => row.orgId === orgId).map((row) => row.createdAt),
  ].sort((left, right) => right.getTime() - left.getTime());

  return timestamps[0] ?? null;
}

function daysAgo(now, days) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function countBy(rows, getKey) {
  const grouped = new Map();

  for (const row of rows) {
    const key = getKey(row);
    if (!key) {
      continue;
    }
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }

  return grouped;
}

function groupBy(rows, getKey) {
  const grouped = new Map();

  for (const row of rows) {
    const key = getKey(row);
    if (!key) {
      continue;
    }
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(row);
  }

  return grouped;
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const ordered = [...values].sort((left, right) => left - right);
  const mid = Math.floor(ordered.length / 2);

  if (ordered.length % 2 === 0) {
    return Math.round((ordered[mid - 1] + ordered[mid]) / 2);
  }

  return Math.round(ordered[mid]);
}

function toWeekKey(value) {
  const date = new Date(value);
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diff = (day + 6) % 7;
  start.setDate(start.getDate() - diff);
  return start.toISOString().slice(0, 10);
}

export default router;

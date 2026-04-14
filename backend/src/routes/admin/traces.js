// routes/admin/traces.js
import { desc, eq, gte, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/index.js';
import {
  adminActionLogs,
  conversations,
  llmExecutionTraces,
  organisations,
  users,
  workflowRuns,
} from '../../db/schema.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';
import { buildAgentScorecards } from '../../services/agent-scorecards.js';
import { compareModelRuns } from '../../services/evals.js';
import {
  buildPolicyOutcomeSummary,
  getAnthropicModels,
  getGeminiModels,
  getOpenAIModels,
  buildModelOverridesFromAiControls,
  mergeOrgModelOverrides,
  normalizeOrgAiControls,
  hasUsableAnthropicKey,
  hasUsableGeminiKey,
  hasUsableOpenAIKey,
  MODEL_POLICIES,
} from '../../services/model-policy.js';
import { hasTriggerDevConfig } from '../../queue/trigger.js';
import { getRegisteredSchedules } from '../../services/inline-scheduler.js';
import {
  aggregateTraceRow,
  buildCountBreakdown,
  combineFilters,
  filterTraceRows,
  getPaginationQuery,
  getTraceFilterQuery,
  mapAggregate,
  mapTraceRow,
} from './helpers.js';

const router = new Hono();

router.get('/model-usage', requireStaff, requireStaffPermission('admin.activity.read'), async (context) => {
  const { limit, offset } = getPaginationQuery(context, { limit: 1000, maxLimit: 5000 });
  const traceQuery = getTraceFilterQuery(context);
  const since = new Date(Date.now() - Math.min(Math.max(Number(traceQuery.days ?? 30), 1), 365) * 24 * 60 * 60 * 1000);

  const rows = await db.query.llmExecutionTraces.findMany({
    where: combineFilters(
      gte(llmExecutionTraces.createdAt, since),
      traceQuery.orgId ? eq(llmExecutionTraces.orgId, traceQuery.orgId) : undefined,
      traceQuery.agentId ? eq(llmExecutionTraces.agentId, traceQuery.agentId) : undefined,
      traceQuery.provider ? eq(llmExecutionTraces.provider, traceQuery.provider) : undefined,
      traceQuery.model ? eq(llmExecutionTraces.model, traceQuery.model) : undefined,
      traceQuery.outcomeStatus ? eq(llmExecutionTraces.outcomeStatus, traceQuery.outcomeStatus) : undefined,
      traceQuery.policyKey ? eq(llmExecutionTraces.policyKey, traceQuery.policyKey) : undefined,
    ),
    orderBy: [desc(llmExecutionTraces.createdAt)],
    limit, offset,
  });
  const filteredRows = filterTraceRows(rows, traceQuery);

  const byModel = new Map();
  const byProvider = new Map();
  const byAgent = new Map();
  const byOrg = new Map();
  for (const row of filteredRows) {
    const modelKey = `${row.provider}:${row.model}`;
    byModel.set(modelKey, aggregateTraceRow(byModel.get(modelKey), row));
    byProvider.set(row.provider, aggregateTraceRow(byProvider.get(row.provider), row));
    byAgent.set(row.agentId, aggregateTraceRow(byAgent.get(row.agentId), row));
    if (row.orgId) byOrg.set(row.orgId, aggregateTraceRow(byOrg.get(row.orgId), row));
  }

  return context.json({
    count: filteredRows.length, limit, offset,
    days: Math.min(Math.max(Number(traceQuery.days ?? 30), 1), 365),
    modelUsage: mapAggregate(byModel, 'model'),
    providerUsage: mapAggregate(byProvider, 'provider'),
    agentUsage: mapAggregate(byAgent, 'agentId'),
    orgUsage: mapAggregate(byOrg, 'orgId'),
    modelComparisons: compareModelRuns(filteredRows),
    policySummary: buildPolicyOutcomeSummary(filteredRows),
  });
});

router.get('/agent-scorecards', requireStaff, requireStaffPermission('admin.activity.read'), async (context) => {
  const { limit, offset } = getPaginationQuery(context, { limit: 2000, maxLimit: 5000 });
  const traceQuery = getTraceFilterQuery(context);
  const since = new Date(Date.now() - Math.min(Math.max(Number(traceQuery.days ?? 30), 1), 365) * 24 * 60 * 60 * 1000);

  const rows = await db.query.llmExecutionTraces.findMany({
    where: combineFilters(
      gte(llmExecutionTraces.createdAt, since),
      traceQuery.orgId ? eq(llmExecutionTraces.orgId, traceQuery.orgId) : undefined,
      traceQuery.agentId ? eq(llmExecutionTraces.agentId, traceQuery.agentId) : undefined,
      traceQuery.provider ? eq(llmExecutionTraces.provider, traceQuery.provider) : undefined,
      traceQuery.model ? eq(llmExecutionTraces.model, traceQuery.model) : undefined,
      traceQuery.outcomeStatus ? eq(llmExecutionTraces.outcomeStatus, traceQuery.outcomeStatus) : undefined,
      traceQuery.policyKey ? eq(llmExecutionTraces.policyKey, traceQuery.policyKey) : undefined,
    ),
    orderBy: [desc(llmExecutionTraces.createdAt)],
    limit, offset,
  });
  const filteredRows = filterTraceRows(rows, traceQuery);

  return context.json({
    count: filteredRows.length, limit, offset,
    days: Math.min(Math.max(Number(traceQuery.days ?? 30), 1), 365),
    scorecards: buildAgentScorecards(filteredRows),
  });
});

router.get('/eval-summaries', requireStaff, requireStaffPermission('admin.activity.read'), async (context) => {
  const { limit, offset } = getPaginationQuery(context, { limit: 1000, maxLimit: 5000 });
  const traceQuery = getTraceFilterQuery(context);
  const since = new Date(Date.now() - Math.min(Math.max(Number(traceQuery.days ?? 30), 1), 365) * 24 * 60 * 60 * 1000);

  const rows = await db.query.llmExecutionTraces.findMany({
    where: combineFilters(
      gte(llmExecutionTraces.createdAt, since),
      traceQuery.orgId ? eq(llmExecutionTraces.orgId, traceQuery.orgId) : undefined,
      traceQuery.agentId ? eq(llmExecutionTraces.agentId, traceQuery.agentId) : undefined,
      traceQuery.provider ? eq(llmExecutionTraces.provider, traceQuery.provider) : undefined,
      traceQuery.model ? eq(llmExecutionTraces.model, traceQuery.model) : undefined,
      traceQuery.outcomeStatus ? eq(llmExecutionTraces.outcomeStatus, traceQuery.outcomeStatus) : undefined,
      traceQuery.policyKey ? eq(llmExecutionTraces.policyKey, traceQuery.policyKey) : undefined,
    ),
    orderBy: [desc(llmExecutionTraces.createdAt)],
    limit, offset,
  });
  const filteredRows = filterTraceRows(rows, traceQuery);
  const summary = filteredRows.reduce((accumulator, row) => {
    const evaluation = row.metadata?.evaluation ?? {};
    accumulator.grounded += evaluation.grounded?.passed ? 1 : 0;
    accumulator.citations += evaluation.grounded?.citationCount > 0 ? 1 : 0;
    accumulator.structured += evaluation.structuredOutput?.passed ? 1 : 0;
    accumulator.tooling += evaluation.toolUse?.passed ? 1 : 0;
    accumulator.instruction += evaluation.instructionAdherence?.passed ? 1 : 0;
    accumulator.hallucinationRisk += evaluation.hallucinationRisk?.level === 'high' ? 1 : 0;
    accumulator.total += 1;
    return accumulator;
  }, { grounded: 0, citations: 0, structured: 0, tooling: 0, instruction: 0, hallucinationRisk: 0, total: 0 });

  return context.json({ count: filteredRows.length, limit, offset, days: Math.min(Math.max(Number(traceQuery.days ?? 30), 1), 365), summary });
});

router.get('/traces', requireStaff, requireStaffPermission('admin.activity.read'), async (context) => {
  const { limit, offset } = getPaginationQuery(context, { limit: 100, maxLimit: 500 });
  const traceQuery = getTraceFilterQuery(context);
  const since = new Date(Date.now() - Math.min(Math.max(Number(traceQuery.days ?? 30), 1), 365) * 24 * 60 * 60 * 1000);

  const rows = await db.query.llmExecutionTraces.findMany({
    where: combineFilters(
      gte(llmExecutionTraces.createdAt, since),
      traceQuery.orgId ? eq(llmExecutionTraces.orgId, traceQuery.orgId) : undefined,
      traceQuery.agentId ? eq(llmExecutionTraces.agentId, traceQuery.agentId) : undefined,
      traceQuery.provider ? eq(llmExecutionTraces.provider, traceQuery.provider) : undefined,
      traceQuery.model ? eq(llmExecutionTraces.model, traceQuery.model) : undefined,
      traceQuery.outcomeStatus ? eq(llmExecutionTraces.outcomeStatus, traceQuery.outcomeStatus) : undefined,
      traceQuery.policyKey ? eq(llmExecutionTraces.policyKey, traceQuery.policyKey) : undefined,
      traceQuery.workflowRunId ? eq(llmExecutionTraces.workflowRunId, traceQuery.workflowRunId) : undefined,
      traceQuery.conversationId ? eq(llmExecutionTraces.conversationId, traceQuery.conversationId) : undefined,
      traceQuery.failureClass ? eq(llmExecutionTraces.failureClass, traceQuery.failureClass) : undefined,
    ),
    orderBy: [desc(llmExecutionTraces.createdAt)],
    limit, offset,
  });
  const filteredRows = filterTraceRows(rows, traceQuery);

  return context.json({
    count: filteredRows.length, limit, offset,
    days: Math.min(Math.max(Number(traceQuery.days ?? 30), 1), 365),
    traces: filteredRows.map((row) => mapTraceRow(row)),
    policySummary: buildPolicyOutcomeSummary(filteredRows),
    failureBreakdown: buildCountBreakdown(filteredRows, (row) => row.failureClass ?? 'none'),
  });
});

router.get('/traces/:traceId', requireStaff, requireStaffPermission('admin.activity.read'), async (context) => {
  const { traceId } = context.req.param();
  const trace = await db.query.llmExecutionTraces.findFirst({ where: eq(llmExecutionTraces.id, traceId) });
  if (!trace) return context.json({ error: 'Trace not found.' }, 404);

  const [conversation, workflowRun, organisation, user, relatedActionReceipts] = await Promise.all([
    trace.conversationId ? db.query.conversations.findFirst({ where: eq(conversations.id, trace.conversationId) }) : Promise.resolve(null),
    trace.workflowRunId ? db.query.workflowRuns.findFirst({ where: eq(workflowRuns.id, trace.workflowRunId) }) : Promise.resolve(null),
    trace.orgId ? db.query.organisations.findFirst({ where: eq(organisations.id, trace.orgId) }) : Promise.resolve(null),
    trace.userId ? db.query.users.findFirst({ where: eq(users.id, trace.userId) }) : Promise.resolve(null),
    db.query.adminActionLogs.findMany({
      where: combineFilters(
        trace.orgId ? eq(adminActionLogs.orgId, trace.orgId) : undefined,
        or(
          trace.workflowRunId ? eq(adminActionLogs.targetId, trace.workflowRunId) : undefined,
          trace.conversationId ? eq(adminActionLogs.targetId, trace.conversationId) : undefined,
        ),
      ),
      orderBy: [desc(adminActionLogs.createdAt)],
      limit: 12,
    }),
  ]);

  return context.json({ trace: mapTraceRow(trace), conversation, workflowRun, organisation, user, relatedActionReceipts });
});

router.get('/scheduler-status', requireStaff, requireStaffPermission('admin.activity.read'), async (context) => {
  const triggerConfigured = hasTriggerDevConfig();
  const mode = triggerConfigured ? 'trigger.dev' : 'inline';
  const registeredSchedules = triggerConfigured ? [] : getRegisteredSchedules();
  return context.json({ mode, registeredSchedules });
});

router.get('/model-policy', requireStaff, requireStaffPermission('admin.activity.read'), (context) => {
  const anthropicModels = getAnthropicModels();
  const openAIModels = getOpenAIModels();
  const geminiModels = getGeminiModels();
  const anthropicConfigured = hasUsableAnthropicKey();
  const openAIConfigured = hasUsableOpenAIKey();
  const geminiConfigured = hasUsableGeminiKey();

  // Parse org-level overrides (no orgId = returns raw map or null)
  let orgOverrides = {};
  try {
    const raw = process.env.ORG_MODEL_POLICY_OVERRIDES?.trim();
    if (raw) orgOverrides = JSON.parse(raw);
  } catch {}

  const policyLanes = Object.values(MODEL_POLICIES).map((policy) => ({
    key: policy.key,
    latencyTarget: policy.latencyTarget,
    reasoningDepth: policy.reasoningDepth,
    groundingRequired: policy.groundingRequired ?? false,
    structuredOutputRequired: policy.structuredOutputRequired ?? false,
    toolUsageRequired: policy.toolUsageRequired ?? false,
    multimodalRequired: policy.multimodalRequired ?? false,
  }));

  const orgBudgetCaps = Object.entries(orgOverrides).map(([orgId, overrides]) => ({
    orgId,
    allowedPolicies: overrides?.budgetCap?.allowedPolicies ?? null,
    maxCostUsdPerRun: overrides?.budgetCap?.maxCostUsdPerRun ?? null,
    maxOutputTokensPerRun: overrides?.budgetCap?.maxOutputTokensPerRun ?? null,
  }));

  const organisationRows = await db.query.organisations.findMany({
    orderBy: [desc(organisations.updatedAt)],
    limit: 120,
  });

  const orgControlOverrides = organisationRows
    .map((org) => {
      const controls = normalizeOrgAiControls(org.metadata ?? {});
      const merged = mergeOrgModelOverrides(
        orgOverrides[org.id] ?? null,
        buildModelOverridesFromAiControls(controls),
      );
      const hasControls = controls.providerPreference !== 'auto'
        || controls.reasoningTier !== 'auto'
        || controls.fastLane !== 'auto'
        || controls.experimentationEnabled
        || controls.failoverOrder.length > 0
        || controls.budgetCap.maxCostUsdPerRun != null
        || controls.budgetCap.maxOutputTokensPerRun != null;

      if (!hasControls && !merged?.budgetCap) {
        return null;
      }

      return {
        orgId: org.id,
        orgName: org.name,
        plan: org.plan,
        controls,
        effectiveBudgetCap: merged?.budgetCap ?? null,
      };
    })
    .filter(Boolean);

  return context.json({
    providers: {
      anthropic: { configured: anthropicConfigured, models: anthropicModels },
      openai: { configured: openAIConfigured, models: openAIModels },
      google: { configured: geminiConfigured, models: geminiModels },
    },
    policyLanes,
    orgBudgetCaps,
    orgControlOverrides,
  });
});

export default router;

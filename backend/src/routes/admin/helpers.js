import { and } from 'drizzle-orm';

// ─── Pagination / query helpers ───────────────────────────────────────────────

export function getPaginationQuery(context, { limit = 50, maxLimit = 200 } = {}) {
  return {
    limit: Math.min(Math.max(Number(context.req.query('limit') ?? limit), 1), maxLimit),
    offset: Math.max(Number(context.req.query('offset') ?? 0), 0),
  };
}

export function getWindowDays(context, fallbackDays = 30) {
  return Math.min(Math.max(Number(context.req.query('days') ?? fallbackDays), 1), 365);
}

export function getSinceDate(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function combineFilters(...filters) {
  const activeFilters = filters.filter(Boolean);
  if (activeFilters.length === 0) {
    return undefined;
  }
  if (activeFilters.length === 1) {
    return activeFilters[0];
  }
  return and(...activeFilters);
}

// ─── Count / aggregate helpers ────────────────────────────────────────────────

export function countBy(rows, getKey) {
  const map = new Map();

  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return map;
}

// ─── Trace helpers ────────────────────────────────────────────────────────────

export function getTraceFilterQuery(context) {
  return {
    days: context.req.query('days'),
    orgId: context.req.query('orgId'),
    agentId: context.req.query('agentId'),
    provider: context.req.query('provider'),
    model: context.req.query('model'),
    outcomeStatus: context.req.query('outcomeStatus'),
    policyKey: context.req.query('policyKey'),
    conversationId: context.req.query('conversationId'),
    workflowRunId: context.req.query('workflowRunId'),
    failureClass: context.req.query('failureClass'),
  };
}

export function filterTraceRows(rows, query) {
  const days = Math.min(Math.max(Number(query.days ?? 30), 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const orgId = query.orgId ?? null;
  const agentId = query.agentId ?? null;
  const provider = query.provider ?? null;
  const model = query.model ?? null;
  const outcomeStatus = query.outcomeStatus ?? null;
  const policyKey = query.policyKey ?? null;

  return rows.filter((row) => {
    if (row.createdAt < since) {
      return false;
    }
    if (orgId && row.orgId !== orgId) {
      return false;
    }
    if (agentId && row.agentId !== agentId) {
      return false;
    }
    if (provider && row.provider !== provider) {
      return false;
    }
    if (model && row.model !== model) {
      return false;
    }
    if (outcomeStatus && row.outcomeStatus !== outcomeStatus) {
      return false;
    }
    if (policyKey && row.policyKey !== policyKey) {
      return false;
    }
    if (query.conversationId && row.conversationId !== query.conversationId) {
      return false;
    }
    if (query.workflowRunId && row.workflowRunId !== query.workflowRunId) {
      return false;
    }
    if (query.failureClass && row.failureClass !== query.failureClass) {
      return false;
    }
    return true;
  });
}

export function aggregateTraceRow(existing, row) {
  const current = existing ?? {
    runs: 0,
    fallbackCount: 0,
    failureCount: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    totalLatencyMs: 0,
  };

  current.runs += 1;
  current.fallbackCount += row.fallbackUsed ? 1 : 0;
  current.failureCount += row.outcomeStatus === 'failed' ? 1 : 0;
  current.totalTokens += row.totalTokens ?? 0;
  current.totalCostUsd += row.estimatedCostUsd ?? 0;
  current.totalLatencyMs += row.latencyMs ?? 0;

  return current;
}

export function mapAggregate(map, keyName) {
  return [...map.entries()].map(([key, value]) => ({
    [keyName]: key,
    ...value,
    averageLatencyMs: value.runs > 0 ? Math.round(value.totalLatencyMs / value.runs) : 0,
    averageTokens: value.runs > 0 ? Math.round(value.totalTokens / value.runs) : 0,
  }));
}

export function mapTraceRow(row) {
  return {
    id: row.id,
    orgId: row.orgId,
    userId: row.userId,
    conversationId: row.conversationId,
    workflowRunId: row.workflowRunId,
    agentId: row.agentId,
    provider: row.provider,
    model: row.model,
    policyKey: row.policyKey,
    route: row.route,
    routeReason: row.routeReason,
    fallbackUsed: row.fallbackUsed,
    latencyMs: row.latencyMs,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    estimatedCostUsd: row.estimatedCostUsd,
    toolsUsed: row.toolsUsed ?? [],
    loreChunkIds: row.loreChunkIds ?? [],
    loreDocumentIds: row.loreDocumentIds ?? [],
    memoryReadIds: row.memoryReadIds ?? [],
    memoryWriteKeys: row.memoryWriteKeys ?? [],
    outcomeStatus: row.outcomeStatus,
    failureClass: row.failureClass,
    sources: row.metadata?.sources ?? [],
    evaluation: row.metadata?.evaluation ?? null,
    schemaValidation: row.metadata?.schemaValidation ?? null,
    sentinelReview: row.metadata?.sentinelReview ?? null,
    contract: row.metadata?.contract ?? null,
    policyClass: row.metadata?.policyClass ?? row.metadata?.routing?.policyClass ?? row.policyKey,
    fallbackModel: row.metadata?.fallbackModel ?? row.metadata?.routing?.fallbackModelUsed ?? null,
    fallbackChain: row.metadata?.routing?.fallbackChain ?? [],
    routing: row.metadata?.routing ?? null,
    createdAt: row.createdAt,
  };
}

export function buildCountBreakdown(rows, getKey) {
  const counts = new Map();

  for (const row of rows) {
    const key = getKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, countValue]) => ({ key, count: countValue }))
    .sort((left, right) => right.count - left.count);
}

export function buildActivitySeries({ auditRows, eventRows, days = 10 }) {
  const labels = [];
  const index = new Map();
  const today = new Date();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    index.set(key, {
      label: key.slice(5),
      audits: 0,
      events: 0,
    });
    labels.push(key);
  }

  for (const row of auditRows) {
    const key = new Date(row.createdAt).toISOString().slice(0, 10);
    if (index.has(key)) {
      index.get(key).audits += 1;
    }
  }

  for (const row of eventRows) {
    const key = new Date(row.createdAt).toISOString().slice(0, 10);
    if (index.has(key)) {
      index.get(key).events += 1;
    }
  }

  return labels.map((key) => ({
    date: key,
    ...index.get(key),
  }));
}

export function countEventName(rows, eventName, sinceDate) {
  return rows.filter((row) => row.eventName === eventName && row.createdAt >= sinceDate).length;
}

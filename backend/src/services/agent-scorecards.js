export function buildAgentScorecards(rows = []) {
  const aggregates = new Map();

  for (const row of rows) {
    const current = aggregates.get(row.agentId) ?? createAggregate(row.agentId);
    current.usageCount += 1;
    current.successCount += row.outcomeStatus === 'succeeded' ? 1 : 0;
    current.errorCount += row.outcomeStatus === 'failed' ? 1 : 0;
    current.fallbackCount += row.fallbackUsed ? 1 : 0;
    current.totalLatencyMs += row.latencyMs ?? 0;
    current.totalTokens += row.totalTokens ?? 0;
    current.totalCostUsd += row.estimatedCostUsd ?? 0;
    current.citationCount += row.metadata?.evaluation?.citationRate > 0 ? 1 : 0;
    current.groundedCount += ['well_grounded', 'partially_grounded'].includes(row.metadata?.evaluation?.groundedness)
      ? 1
      : 0;
    current.structuredPassCount += row.metadata?.evaluation?.structuredOutputPass === true ? 1 : 0;
    current.rewriteProxyCount += inferRewriteProxy(row) ? 1 : 0;
    current.highRiskCount += row.metadata?.evaluation?.hallucinationRisk === 'high' ? 1 : 0;
    current.providerSet.add(row.provider);
    current.modelSet.add(row.model);

    const failureClass = row.failureClass ?? (row.outcomeStatus === 'failed' ? 'runtime' : null);
    if (failureClass) {
      current.failureClasses.set(failureClass, (current.failureClasses.get(failureClass) ?? 0) + 1);
    }

    aggregates.set(row.agentId, current);
  }

  return [...aggregates.values()]
    .map((aggregate) => ({
      agentId: aggregate.agentId,
      usageCount: aggregate.usageCount,
      completionSuccessRate: safeRate(aggregate.successCount, aggregate.usageCount),
      fallbackRate: safeRate(aggregate.fallbackCount, aggregate.usageCount),
      averageLatencyMs: Math.round(aggregate.totalLatencyMs / Math.max(aggregate.usageCount, 1)),
      averageTokenUsage: Math.round(aggregate.totalTokens / Math.max(aggregate.usageCount, 1)),
      averageCostUsd: Number((aggregate.totalCostUsd / Math.max(aggregate.usageCount, 1)).toFixed(6)),
      approvalRewriteProxyRate: safeRate(aggregate.rewriteProxyCount, aggregate.usageCount),
      citationRate: safeRate(aggregate.citationCount, aggregate.usageCount),
      groundedRate: safeRate(aggregate.groundedCount, aggregate.usageCount),
      structuredOutputPassRate: safeRate(aggregate.structuredPassCount, aggregate.usageCount),
      errorRate: safeRate(aggregate.errorCount, aggregate.usageCount),
      hallucinationRiskRate: safeRate(aggregate.highRiskCount, aggregate.usageCount),
      providers: [...aggregate.providerSet],
      models: [...aggregate.modelSet],
      topFailureClasses: [...aggregate.failureClasses.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([failureClass, count]) => ({ failureClass, count })),
    }))
    .sort((left, right) => right.usageCount - left.usageCount);
}

function createAggregate(agentId) {
  return {
    agentId,
    usageCount: 0,
    successCount: 0,
    errorCount: 0,
    fallbackCount: 0,
    totalLatencyMs: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    citationCount: 0,
    groundedCount: 0,
    structuredPassCount: 0,
    rewriteProxyCount: 0,
    highRiskCount: 0,
    providerSet: new Set(),
    modelSet: new Set(),
    failureClasses: new Map(),
  };
}

function inferRewriteProxy(row) {
  if (row.outcomeStatus !== 'succeeded') {
    return false;
  }

  const evaluation = row.metadata?.evaluation;

  if (!evaluation) {
    return false;
  }

  return evaluation.instructionAdherence === 'pass'
    && evaluation.hallucinationRisk === 'low'
    && evaluation.toolUsePass !== false;
}

function safeRate(numerator, denominator) {
  if (!denominator) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(4));
}

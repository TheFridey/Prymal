export function buildAgentScorecards(rows = []) {
  const aggregates = new Map();

  for (const row of rows) {
    const current = aggregates.get(row.agentId) ?? createAggregate(row.agentId);
    const schemaVerdict = row.metadata?.schemaValidation?.verdict ?? null;
    const sentinelVerdict = row.metadata?.sentinelReview?.verdict ?? null;
    const repairLoopCount = inferRepairLoopCount(row);
    const policyClass = row.metadata?.policyClass
      ?? row.metadata?.routing?.policyClass
      ?? row.policyKey
      ?? null;

    current.usageCount += 1;
    current.successCount += row.outcomeStatus === 'succeeded' ? 1 : 0;
    current.errorCount += row.outcomeStatus === 'failed' ? 1 : 0;
    current.heldCount += row.outcomeStatus === 'held' ? 1 : 0;
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
    current.schemaRepairCount += schemaVerdict === 'repaired' ? 1 : 0;
    current.schemaFailureCount += schemaVerdict === 'failed' ? 1 : 0;
    current.sentinelRepairCount += sentinelVerdict === 'REPAIR' ? 1 : 0;
    current.sentinelHoldCount += sentinelVerdict === 'HOLD' ? 1 : 0;
    current.toolPolicyViolationCount += inferToolPolicyViolation(row) ? 1 : 0;
    current.blockedToolAttemptCount += inferBlockedToolAttempt(row) ? 1 : 0;
    current.memoryScopeViolationCount += row.metadata?.code === 'MEMORY_SCOPE_WRITE_FORBIDDEN' ? 1 : 0;
    current.repairLoopCount += repairLoopCount;
    current.repairLoopRunCount += repairLoopCount > 0 ? 1 : 0;
    current.providerSet.add(row.provider);
    current.modelSet.add(row.model);
    if (policyClass) {
      current.policyClasses.set(policyClass, (current.policyClasses.get(policyClass) ?? 0) + 1);
    }

    const failureClass = row.failureClass ?? (row.outcomeStatus === 'failed' ? 'runtime' : null);
    if (failureClass) {
      current.failureClasses.set(failureClass, (current.failureClasses.get(failureClass) ?? 0) + 1);
    }

    const holdReason = row.metadata?.sentinelReview?.hold_reason;
    if (holdReason) {
      current.holdReasons.set(holdReason, (current.holdReasons.get(holdReason) ?? 0) + 1);
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
      holdRate: safeRate(aggregate.heldCount, aggregate.usageCount),
      hallucinationRiskRate: safeRate(aggregate.highRiskCount, aggregate.usageCount),
      schemaRepairRate: safeRate(aggregate.schemaRepairCount, aggregate.usageCount),
      schemaFailureRate: safeRate(aggregate.schemaFailureCount, aggregate.usageCount),
      repairLoopRate: safeRate(aggregate.repairLoopRunCount, aggregate.usageCount),
      averageRepairLoops: Number((aggregate.repairLoopCount / Math.max(aggregate.usageCount, 1)).toFixed(2)),
      toolPolicyViolationRate: safeRate(aggregate.toolPolicyViolationCount, aggregate.usageCount),
      blockedToolAttemptRate: safeRate(aggregate.blockedToolAttemptCount, aggregate.usageCount),
      memoryScopeViolationRate: safeRate(aggregate.memoryScopeViolationCount, aggregate.usageCount),
      sentinelInterventionRate: safeRate(
        aggregate.sentinelRepairCount + aggregate.sentinelHoldCount,
        aggregate.usageCount,
      ),
      dominantPolicyClass: [...aggregate.policyClasses.entries()]
        .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null,
      providers: [...aggregate.providerSet],
      models: [...aggregate.modelSet],
      topFailureClasses: [...aggregate.failureClasses.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([failureClass, count]) => ({ failureClass, count })),
      topHoldReasons: [...aggregate.holdReasons.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([reason, count]) => ({ reason, count })),
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
    heldCount: 0,
    schemaRepairCount: 0,
    schemaFailureCount: 0,
    sentinelRepairCount: 0,
    sentinelHoldCount: 0,
    toolPolicyViolationCount: 0,
    blockedToolAttemptCount: 0,
    memoryScopeViolationCount: 0,
    repairLoopCount: 0,
    repairLoopRunCount: 0,
    providerSet: new Set(),
    modelSet: new Set(),
    policyClasses: new Map(),
    failureClasses: new Map(),
    holdReasons: new Map(),
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

function inferRepairLoopCount(row) {
  const routing = row.metadata?.routing ?? {};
  const schemaRepairAttempts = Number(routing.schemaRepair?.attempts ?? 0) || 0;
  const contractSummary = row.metadata?.contract ?? {};
  const usageField = contractSummary?.escalationRules?.repairLoopCountField ?? null;
  const contractRepairLoops = usageField
    ? Number(row.metadata?.evaluation?.usageMetrics?.[usageField] ?? 0) || 0
    : 0;

  return Math.max(schemaRepairAttempts, contractRepairLoops, 0);
}

function inferToolPolicyViolation(row) {
  if (row.metadata?.routing?.toolValidation?.valid === false) {
    return true;
  }

  return row.metadata?.evaluation?.toolUsePass === false;
}

function inferBlockedToolAttempt(row) {
  return row.metadata?.code === 'CONTRACT_TOOL_VIOLATION'
    || row.metadata?.routing?.toolValidation?.valid === false;
}

function safeRate(numerator, denominator) {
  if (!denominator) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(4));
}

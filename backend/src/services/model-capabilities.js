const CAPABILITY_LEVEL = {
  none: 0,
  low: 0.3,
  medium: 0.6,
  high: 0.82,
  elite: 0.96,
};

const LATENCY_LEVEL = {
  slow: 0.28,
  medium: 0.6,
  fast: 0.82,
  fastest: 0.96,
};

const COST_TIER_LEVEL = {
  premium: 0.24,
  standard: 0.56,
  low: 0.82,
  ultra_low: 0.96,
};

const DEFAULT_HEALTH_SCORE = 0.7;
const RUNTIME_HEALTH_REGISTRY = new Map();

export const MODEL_CAPABILITY_REGISTRY = {
  'openai:gpt-5.5': {
    reasoning: 'elite',
    coding: 'elite',
    vision: 'high',
    structuredOutput: 'high',
    grounding: 'medium',
    toolUse: 'elite',
    computerUse: 'high',
    latency: 'fast',
    costTier: 'premium',
    reliability: 'high',
    contextWindow: 1_050_000,
  },
  'openai:gpt-5.4': {
    reasoning: 'high',
    coding: 'high',
    vision: 'high',
    structuredOutput: 'high',
    grounding: 'medium',
    toolUse: 'high',
    computerUse: 'high',
    latency: 'fast',
    costTier: 'standard',
    reliability: 'high',
    contextWindow: 1_050_000,
  },
  'openai:gpt-5.4-mini': {
    reasoning: 'high',
    coding: 'high',
    vision: 'medium',
    structuredOutput: 'high',
    grounding: 'medium',
    toolUse: 'high',
    computerUse: 'high',
    latency: 'fastest',
    costTier: 'low',
    reliability: 'high',
    contextWindow: 400_000,
  },
  'openai:gpt-5.4-nano': {
    reasoning: 'medium',
    coding: 'medium',
    vision: 'medium',
    structuredOutput: 'high',
    grounding: 'low',
    toolUse: 'medium',
    computerUse: 'none',
    latency: 'fastest',
    costTier: 'ultra_low',
    reliability: 'medium',
    contextWindow: 400_000,
  },
  'anthropic:claude-opus-4-7': {
    reasoning: 'elite',
    coding: 'elite',
    vision: 'high',
    structuredOutput: 'medium',
    grounding: 'medium',
    toolUse: 'high',
    computerUse: 'none',
    latency: 'medium',
    costTier: 'premium',
    reliability: 'high',
    contextWindow: 1_000_000,
  },
  'anthropic:claude-sonnet-4-6': {
    reasoning: 'high',
    coding: 'high',
    vision: 'high',
    structuredOutput: 'medium',
    grounding: 'medium',
    toolUse: 'high',
    computerUse: 'none',
    latency: 'fast',
    costTier: 'standard',
    reliability: 'high',
    contextWindow: 1_000_000,
  },
  'anthropic:claude-haiku-4-5': {
    reasoning: 'medium',
    coding: 'medium',
    vision: 'medium',
    structuredOutput: 'medium',
    grounding: 'low',
    toolUse: 'medium',
    computerUse: 'none',
    latency: 'fast',
    costTier: 'low',
    reliability: 'medium',
    contextWindow: 200_000,
  },
  'google:gemini-2.5-pro': {
    reasoning: 'high',
    coding: 'high',
    vision: 'high',
    structuredOutput: 'high',
    grounding: 'elite',
    toolUse: 'high',
    computerUse: 'medium',
    latency: 'medium',
    costTier: 'standard',
    reliability: 'high',
    contextWindow: 1_048_576,
  },
  'google:gemini-2.5-flash': {
    reasoning: 'medium',
    coding: 'medium',
    vision: 'high',
    structuredOutput: 'medium',
    grounding: 'high',
    toolUse: 'medium',
    computerUse: 'medium',
    latency: 'fast',
    costTier: 'low',
    reliability: 'medium',
    contextWindow: 1_048_576,
  },
  'google:gemini-2.5-flash-lite': {
    reasoning: 'medium',
    coding: 'medium',
    vision: 'high',
    structuredOutput: 'high',
    grounding: 'high',
    toolUse: 'medium',
    computerUse: 'low',
    latency: 'fastest',
    costTier: 'ultra_low',
    reliability: 'medium',
    contextWindow: 1_048_576,
  },
};

export function getModelCapability(provider, model) {
  const exactKey = `${provider}:${model}`;
  if (MODEL_CAPABILITY_REGISTRY[exactKey]) {
    return MODEL_CAPABILITY_REGISTRY[exactKey];
  }

  const prefixMatch = Object.entries(MODEL_CAPABILITY_REGISTRY)
    .filter(([key]) => key.startsWith(`${provider}:`))
    .sort((left, right) => right[0].length - left[0].length)
    .find(([key]) => model.startsWith(key.slice(provider.length + 1)));

  return prefixMatch?.[1] ?? null;
}

export function listModelCapabilities() {
  return Object.entries(MODEL_CAPABILITY_REGISTRY).map(([key, capability]) => {
    const splitIndex = key.indexOf(':');
    return {
      provider: key.slice(0, splitIndex),
      model: key.slice(splitIndex + 1),
      ...capability,
    };
  });
}

export function recordProviderRoutingOutcome({
  provider,
  model,
  latencyMs = null,
  outcomeStatus = 'succeeded',
  fallbackUsed = false,
  failureClass = null,
  promptTokens = 0,
  completionTokens = 0,
  totalTokens = null,
  metadata = {},
}) {
  if (!provider || !model) {
    return;
  }

  const key = `${provider}:${model}`;
  const current = RUNTIME_HEALTH_REGISTRY.get(key) ?? createRuntimeHealthAggregate(provider, model);
  const sentinelReview = metadata?.sentinelReview ?? {};
  const warden = metadata?.warden ?? metadata?.routing?.warden ?? null;
  const tokenTotal = Math.max(totalTokens ?? (promptTokens ?? 0) + (completionTokens ?? 0), 0);
  const completionRatio = tokenTotal > 0 ? Math.min((completionTokens ?? 0) / tokenTotal, 1) : 0;

  current.runs += 1;
  current.successCount += outcomeStatus === 'succeeded' ? 1 : 0;
  current.failureCount += outcomeStatus === 'failed' ? 1 : 0;
  current.timeoutCount += failureClass === 'timeout' ? 1 : 0;
  current.fallbackCount += fallbackUsed ? 1 : 0;
  current.holdCount += outcomeStatus === 'held' || sentinelReview?.verdict === 'HOLD' ? 1 : 0;
  current.repairCount += sentinelReview?.verdict === 'REPAIR' ? 1 : 0;
  current.wardenBlockCount += isWardenBlocked(warden) ? 1 : 0;
  current.totalLatencyMs += Math.max(latencyMs ?? 0, 0);
  current.totalTokens += tokenTotal;
  current.totalCompletionRatio += completionRatio;
  current.lastUpdatedAt = new Date().toISOString();

  RUNTIME_HEALTH_REGISTRY.set(key, current);
}

export function getRuntimeProviderHealthSnapshot() {
  return Object.fromEntries(
    [...RUNTIME_HEALTH_REGISTRY.entries()].map(([key, aggregate]) => [
      key,
      mapHealthAggregate(aggregate),
    ]),
  );
}

export function resetRuntimeProviderHealthForTests() {
  RUNTIME_HEALTH_REGISTRY.clear();
}

export function buildProviderHealthSummary(rows = []) {
  const aggregate = new Map();

  for (const row of rows) {
    const provider = row.provider ?? 'unknown';
    const model = row.model ?? 'unknown';
    const key = `${provider}:${model}`;
    const current = aggregate.get(key) ?? createRuntimeHealthAggregate(provider, model);
    const sentinelReview = row.metadata?.sentinelReview ?? {};
    const warden = row.metadata?.warden ?? row.metadata?.routing?.warden ?? null;
    const tokenTotal = Math.max(row.totalTokens ?? 0, 0);
    const completionRatio = tokenTotal > 0
      ? Math.min(Math.max((row.completionTokens ?? 0) / tokenTotal, 0), 1)
      : 0;

    current.runs += 1;
    current.successCount += row.outcomeStatus === 'succeeded' ? 1 : 0;
    current.failureCount += row.outcomeStatus === 'failed' ? 1 : 0;
    current.timeoutCount += row.failureClass === 'timeout' ? 1 : 0;
    current.fallbackCount += row.fallbackUsed ? 1 : 0;
    current.holdCount += row.outcomeStatus === 'held' || sentinelReview?.verdict === 'HOLD' ? 1 : 0;
    current.repairCount += sentinelReview?.verdict === 'REPAIR' ? 1 : 0;
    current.wardenBlockCount += isWardenBlocked(warden) ? 1 : 0;
    current.totalLatencyMs += Math.max(row.latencyMs ?? 0, 0);
    current.totalTokens += tokenTotal;
    current.totalCompletionRatio += completionRatio;
    current.lastUpdatedAt = row.createdAt?.toISOString?.() ?? current.lastUpdatedAt;
    aggregate.set(key, current);
  }

  return [...aggregate.values()]
    .map((entry) => mapHealthAggregate(entry))
    .sort((left, right) => {
      if (right.healthScore !== left.healthScore) {
        return right.healthScore - left.healthScore;
      }
      return right.runs - left.runs;
    });
}

export function scoreRouteCandidate({
  policyKey,
  provider,
  model,
  route,
  routingHints = {},
  healthSnapshot = null,
}) {
  const capability = getModelCapability(provider, model);
  const capabilityScore = computePolicyCapabilityScore(policyKey, capability);
  const healthScore = getHealthScore(provider, model, healthSnapshot);
  const latencyScore = computeLatencyFit(policyKey, capability);
  const costScore = computeCostFit(policyKey, capability);
  const routingBias = computeRoutingBias({ provider, model, routingHints, route });
  const score = Number((
    (capabilityScore * 0.42)
    + (healthScore * 0.33)
    + (latencyScore * 0.13)
    + (costScore * 0.08)
    + routingBias
  ).toFixed(4));

  return {
    provider,
    model,
    route,
    score,
    healthScore,
    capabilityScore,
    latencyScore,
    costScore,
  };
}

export function scoreCandidateSet({ policyKey, candidates = [], routingHints = {}, healthSnapshot = null }) {
  return candidates.map((candidate) => ({
    ...candidate,
    ...scoreRouteCandidate({
      policyKey,
      provider: candidate.provider,
      model: candidate.model,
      route: candidate.route,
      routingHints,
      healthSnapshot,
    }),
  }));
}

function computePolicyCapabilityScore(policyKey, capability) {
  if (!capability) {
    return 0.55;
  }

  const weightsByPolicy = {
    premium_reasoning: { reasoning: 0.32, coding: 0.18, reliability: 0.18, toolUse: 0.12, vision: 0.05, structuredOutput: 0.05, grounding: 0.1 },
    fast_chat: { latency: 0.3, reliability: 0.2, reasoning: 0.15, costTier: 0.2, toolUse: 0.1, structuredOutput: 0.05 },
    grounded_research: { grounding: 0.3, reasoning: 0.18, reliability: 0.16, toolUse: 0.14, vision: 0.08, structuredOutput: 0.06, coding: 0.08 },
    structured_extraction: { structuredOutput: 0.35, reliability: 0.2, latency: 0.15, costTier: 0.12, reasoning: 0.1, toolUse: 0.08 },
    workflow_automation: { reliability: 0.26, toolUse: 0.18, reasoning: 0.16, latency: 0.14, costTier: 0.14, structuredOutput: 0.12 },
    vision_file: { vision: 0.32, reasoning: 0.18, reliability: 0.16, structuredOutput: 0.12, toolUse: 0.12, grounding: 0.1 },
    low_cost_bulk: { costTier: 0.36, latency: 0.26, structuredOutput: 0.12, reliability: 0.1, reasoning: 0.08, grounding: 0.08 },
  };

  const weights = weightsByPolicy[policyKey] ?? weightsByPolicy.fast_chat;
  return Number(
    Object.entries(weights)
      .reduce((sum, [dimension, weight]) => sum + capabilityValue(dimension, capability) * weight, 0)
      .toFixed(4),
  );
}

function capabilityValue(dimension, capability) {
  if (dimension === 'latency') {
    return LATENCY_LEVEL[capability.latency] ?? 0.6;
  }

  if (dimension === 'costTier') {
    return COST_TIER_LEVEL[capability.costTier] ?? 0.56;
  }

  return CAPABILITY_LEVEL[capability?.[dimension]] ?? 0.5;
}

function computeLatencyFit(policyKey, capability) {
  const targetByPolicy = {
    fast_chat: 'fastest',
    low_cost_bulk: 'fastest',
    structured_extraction: 'fast',
    workflow_automation: 'fast',
    premium_reasoning: 'medium',
    grounded_research: 'medium',
    vision_file: 'medium',
  };

  const target = targetByPolicy[policyKey] ?? 'fast';
  const actual = LATENCY_LEVEL[capability?.latency] ?? 0.6;
  const desired = LATENCY_LEVEL[target] ?? 0.6;
  return Number((1 - Math.abs(desired - actual)).toFixed(4));
}

function computeCostFit(policyKey, capability) {
  const targetByPolicy = {
    low_cost_bulk: 'ultra_low',
    fast_chat: 'low',
    structured_extraction: 'low',
    workflow_automation: 'standard',
    vision_file: 'standard',
    grounded_research: 'standard',
    premium_reasoning: 'premium',
  };

  const target = targetByPolicy[policyKey] ?? 'standard';
  const actual = COST_TIER_LEVEL[capability?.costTier] ?? 0.56;
  const desired = COST_TIER_LEVEL[target] ?? 0.56;
  return Number((1 - Math.abs(desired - actual)).toFixed(4));
}

function computeRoutingBias({ provider, model, routingHints, route }) {
  let bias = 0;

  if (routingHints?.preferredProvider && routingHints.preferredProvider !== 'auto') {
    bias += routingHints.preferredProvider === provider ? 0.05 : -0.015;
  }

  const failoverOrder = Array.isArray(routingHints?.failoverOrder)
    ? routingHints.failoverOrder
    : [];
  const failoverIndex = failoverOrder.indexOf(provider);
  if (failoverIndex >= 0) {
    bias += Math.max(0.04 - failoverIndex * 0.02, -0.02);
  }

  if (routingHints?.toolHeavy && /google/.test(provider) && /flash-lite/.test(model)) {
    bias -= 0.015;
  }

  if (routingHints?.multimodal && provider === 'openai') {
    bias += 0.02;
  }

  if (routingHints?.groundingRequired && provider === 'google') {
    bias += 0.035;
  }

  if (routingHints?.reasoningTier === 'high' && (provider === 'openai' || provider === 'anthropic')) {
    bias += 0.02;
  }

  if (route?.includes('fallback')) {
    bias -= 0.01;
  }

  return Number(bias.toFixed(4));
}

function getHealthScore(provider, model, healthSnapshot) {
  const snapshot = healthSnapshot ?? getRuntimeProviderHealthSnapshot();
  const exact = snapshot?.[`${provider}:${model}`];
  const providerEntry = snapshot?.[`${provider}:*`];
  return exact?.healthScore ?? providerEntry?.healthScore ?? DEFAULT_HEALTH_SCORE;
}

function createRuntimeHealthAggregate(provider, model) {
  return {
    provider,
    model,
    runs: 0,
    successCount: 0,
    failureCount: 0,
    timeoutCount: 0,
    fallbackCount: 0,
    holdCount: 0,
    repairCount: 0,
    wardenBlockCount: 0,
    totalLatencyMs: 0,
    totalTokens: 0,
    totalCompletionRatio: 0,
    lastUpdatedAt: null,
  };
}

function mapHealthAggregate(aggregate) {
  const runs = Math.max(aggregate.runs, 1);
  const successRate = aggregate.successCount / runs;
  const failureRate = aggregate.failureCount / runs;
  const timeoutRate = aggregate.timeoutCount / runs;
  const fallbackRate = aggregate.fallbackCount / runs;
  const holdRate = aggregate.holdCount / runs;
  const repairRate = aggregate.repairCount / runs;
  const wardenBlockRate = aggregate.wardenBlockCount / runs;
  const averageLatencyMs = Math.round(aggregate.totalLatencyMs / runs);
  const tokenEfficiency = Number((aggregate.totalCompletionRatio / runs).toFixed(4));
  const latencyPenalty = averageLatencyMs <= 0
    ? 0
    : Math.min(averageLatencyMs / 12_000, 0.35);
  const healthScore = Number(Math.max(0.05, Math.min(
    (successRate * 0.38)
      + ((1 - failureRate) * 0.17)
      + ((1 - timeoutRate) * 0.12)
      + ((1 - fallbackRate) * 0.08)
      + ((1 - holdRate) * 0.08)
      + ((1 - repairRate) * 0.05)
      + ((1 - wardenBlockRate) * 0.04)
      + (tokenEfficiency * 0.08)
      - latencyPenalty,
    0.99,
  )).toFixed(4));

  return {
    provider: aggregate.provider,
    model: aggregate.model,
    runs: aggregate.runs,
    successRate: Number(successRate.toFixed(4)),
    failureRate: Number(failureRate.toFixed(4)),
    timeoutRate: Number(timeoutRate.toFixed(4)),
    fallbackRate: Number(fallbackRate.toFixed(4)),
    holdRate: Number(holdRate.toFixed(4)),
    repairRate: Number(repairRate.toFixed(4)),
    wardenBlockRate: Number(wardenBlockRate.toFixed(4)),
    tokenEfficiency,
    averageLatencyMs,
    healthScore,
    recommendedWeight: Number((0.35 + (healthScore * 0.9)).toFixed(4)),
    degraded: healthScore < 0.55 || timeoutRate >= 0.12 || failureRate >= 0.18,
    lastUpdatedAt: aggregate.lastUpdatedAt,
  };
}

function isWardenBlocked(warden) {
  return typeof warden?.verdict === 'string' && ['BLOCK', 'REQUIRE_CONFIRMATION'].includes(warden.verdict);
}

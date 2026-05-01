// In-memory classifier observability + cost caps for WARDEN v2.
// Metrics are aggregated for the rolling window declared in env.

const DEFAULT_WINDOW_HOURS = 24;
const SURFACE_KEYS = new Set([
  'chat',
  'media_generation',
  'external_content',
  'pasted_content',
  'tool_execution',
  'workflow_execution',
  'upload',
  'url',
  'unknown',
]);

const state = {
  windowMs: DEFAULT_WINDOW_HOURS * 60 * 60 * 1000,
  events: [],
};

function ensureSurface(surface) {
  const normalized = String(surface ?? 'unknown');
  return SURFACE_KEYS.has(normalized) ? normalized : 'unknown';
}

function getCapsConfig(env = process.env) {
  const inputTokenPrice = Number(env.WARDEN_MODEL_CLASSIFIER_INPUT_TOKEN_PRICE_USD ?? 0) || 0;
  const outputTokenPrice = Number(env.WARDEN_MODEL_CLASSIFIER_OUTPUT_TOKEN_PRICE_USD ?? 0) || 0;
  return {
    dailyMaxCalls: Number(env.WARDEN_MODEL_CLASSIFIER_DAILY_CALL_CAP ?? env.WARDEN_MODEL_CLASSIFIER_DAILY_MAX_CALLS ?? 0) || 0,
    dailyMaxCostUsd: Number(env.WARDEN_MODEL_CLASSIFIER_DAILY_COST_CAP_USD ?? env.WARDEN_MODEL_CLASSIFIER_DAILY_MAX_COST_USD ?? 0) || 0,
    inputTokenPriceUsd: inputTokenPrice,
    outputTokenPriceUsd: outputTokenPrice,
    pricingPerKToken: Number(env.WARDEN_MODEL_CLASSIFIER_PRICE_PER_KTOKEN_USD ?? 0.0008) || 0.0008,
  };
}

export function pruneClassifierMetrics(now = Date.now()) {
  const cutoff = now - state.windowMs;
  state.events = state.events.filter((event) => event.timestamp >= cutoff);
}

export function recordClassifierEvent({
  surface,
  attempted = false,
  usedModel = false,
  fallback = false,
  timedOut = false,
  cacheHit = false,
  skippedDueToCap = false,
  durationMs = null,
  estimatedTokens = 0,
  estimatedCostUsd = 0,
  verdict = null,
  riskLevel = null,
  categories = [],
  blocked = false,
} = {}, now = Date.now()) {
  pruneClassifierMetrics(now);
  state.events.push({
    timestamp: now,
    surface: ensureSurface(surface),
    attempted: Boolean(attempted),
    usedModel: Boolean(usedModel),
    fallback: Boolean(fallback),
    timedOut: Boolean(timedOut),
    cacheHit: Boolean(cacheHit),
    skippedDueToCap: Boolean(skippedDueToCap),
    durationMs: Number.isFinite(durationMs) ? Number(durationMs) : null,
    estimatedTokens: Number(estimatedTokens) || 0,
    estimatedCostUsd: Number(estimatedCostUsd) || 0,
    verdict,
    riskLevel,
    categories: Array.isArray(categories) ? categories : [],
    blocked: Boolean(blocked),
  });
}

export function getClassifierMetricsSnapshot({ now = Date.now() } = {}) {
  pruneClassifierMetrics(now);
  const events = state.events;
  const total = events.length;
  const used = events.filter((event) => event.usedModel).length;
  const cacheHits = events.filter((event) => event.cacheHit).length;
  const fallbacks = events.filter((event) => event.fallback).length;
  const timeouts = events.filter((event) => event.timedOut).length;
  const skipped = events.filter((event) => event.skippedDueToCap).length;
  const blocks = events.filter((event) => event.blocked).length;
  const confirmations = events.filter((event) => event.verdict === 'REQUIRE_CONFIRMATION').length;

  const latencies = events
    .filter((event) => event.durationMs != null)
    .map((event) => Number(event.durationMs))
    .sort((left, right) => left - right);
  const averageLatency = latencies.length
    ? latencies.reduce((sum, ms) => sum + ms, 0) / latencies.length
    : null;
  const p95 = latencies.length
    ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))]
    : null;

  const costUsd = events.reduce((sum, event) => sum + Number(event.estimatedCostUsd ?? 0), 0);
  const tokens = events.reduce((sum, event) => sum + Number(event.estimatedTokens ?? 0), 0);

  const surfaceCounts = {};
  const blocksBySurface = {};
  const categoryCounts = {};
  for (const event of events) {
    surfaceCounts[event.surface] = (surfaceCounts[event.surface] ?? 0) + 1;
    if (event.blocked) {
      blocksBySurface[event.surface] = (blocksBySurface[event.surface] ?? 0) + 1;
    }
    for (const category of event.categories ?? []) {
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    }
  }

  return {
    windowMs: state.windowMs,
    totals: {
      events: total,
      attempted: events.filter((event) => event.attempted).length,
      usedModel: used,
      cacheHits,
      fallbacks,
      timeouts,
      skippedDueToCap: skipped,
      blocks,
      confirmations,
    },
    rates: {
      cacheHitRate: total ? cacheHits / total : 0,
      fallbackRate: total ? fallbacks / total : 0,
      timeoutRate: total ? timeouts / total : 0,
      skippedRate: total ? skipped / total : 0,
    },
    latency: {
      averageMs: averageLatency,
      p95Ms: p95,
      samples: latencies.length,
    },
    cost: {
      estimatedTokens: tokens,
      estimatedUsd: Number(costUsd.toFixed(6)),
    },
    surfaceCounts,
    blocksBySurface,
    topCategories: Object.entries(categoryCounts)
      .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
      .slice(0, 10)
      .map(([category, count]) => ({ category, count })),
  };
}

export function evaluateClassifierCap({ env = process.env, now = Date.now() } = {}) {
  const caps = getCapsConfig(env);
  const snapshot = getClassifierMetricsSnapshot({ now });

  const callsExceeded = caps.dailyMaxCalls > 0 && snapshot.totals.usedModel >= caps.dailyMaxCalls;
  const costExceeded = caps.dailyMaxCostUsd > 0 && snapshot.cost.estimatedUsd >= caps.dailyMaxCostUsd;

  return {
    capActive: callsExceeded || costExceeded,
    callsExceeded,
    costExceeded,
    caps,
    usage: {
      usedModel: snapshot.totals.usedModel,
      estimatedUsd: snapshot.cost.estimatedUsd,
    },
  };
}

export function estimateCallCost({ tokens = 0, inputTokens = 0, outputTokens = 0, env = process.env }) {
  const caps = getCapsConfig(env);
  if (caps.inputTokenPriceUsd > 0 || caps.outputTokenPriceUsd > 0) {
    return ((Number(inputTokens) || Number(tokens) || 0) / 1000) * caps.inputTokenPriceUsd
      + ((Number(outputTokens) || 0) / 1000) * caps.outputTokenPriceUsd;
  }
  return (Number(tokens) / 1000) * caps.pricingPerKToken;
}

export function setClassifierMetricsWindowForTests(windowMs) {
  state.windowMs = Number(windowMs) || DEFAULT_WINDOW_HOURS * 60 * 60 * 1000;
}

export function resetClassifierMetricsForTests() {
  state.events = [];
}

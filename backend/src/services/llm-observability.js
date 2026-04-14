import * as Sentry from '@sentry/node';
import { db } from '../db/index.js';
import { llmExecutionTraces } from '../db/schema.js';

const DEFAULT_MODEL_COSTS = {
  'anthropic:claude-opus-4-6': { inputPerMillion: 5, outputPerMillion: 25 },
  'anthropic:claude-sonnet-4-6': { inputPerMillion: 3, outputPerMillion: 15 },
  'anthropic:claude-haiku-4-5': { inputPerMillion: 1, outputPerMillion: 5 },
  // Baseline estimates for the configured OpenAI lanes. Override via MODEL_COST_OVERRIDES when needed.
  'openai:gpt-5.4': { inputPerMillion: 2, outputPerMillion: 8 },
  'openai:gpt-5.4-mini': { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  'openai:gpt-5.4-nano': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
};
// Gemini pricing (per 1M tokens, as of April 2026)
// Override via MODEL_COST_OVERRIDES if your billing assumptions differ.
const GEMINI_COSTS = {
  'gemini-2.0-flash': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  'gemini-2.0-flash-lite': { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  'gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 10 },
  'gemini-2.5-flash': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
};

export async function recordLLMExecutionTrace({
  orgId = null,
  userId = null,
  conversationId = null,
  workflowRunId = null,
  agentId,
  provider,
  model,
  policyKey,
  route,
  routeReason = null,
  fallbackUsed = false,
  latencyMs = null,
  promptTokens = null,
  completionTokens = null,
  totalTokens = null,
  toolsUsed = [],
  loreChunkIds = [],
  loreDocumentIds = [],
  memoryReadIds = [],
  memoryWriteKeys = [],
  outcomeStatus,
  failureClass = null,
  metadata = {},
}) {
  if (!agentId || !provider || !model || !policyKey || !route || !outcomeStatus) {
    return;
  }

  try {
    await db.insert(llmExecutionTraces).values({
      orgId,
      userId,
      conversationId,
      workflowRunId,
      agentId,
      provider,
      model,
      policyKey,
      route,
      routeReason,
      fallbackUsed,
      latencyMs,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: estimateModelCostUsd({
        provider,
        model,
        promptTokens,
        completionTokens,
      }),
      toolsUsed,
      loreChunkIds,
      loreDocumentIds,
      memoryReadIds,
      memoryWriteKeys,
      outcomeStatus,
      failureClass,
      metadata,
    });

    if (process.env.SENTRY_DSN && outcomeStatus === 'failed') {
      Sentry.captureMessage(`Agent run failed: ${agentId} via ${provider}/${model}`, {
        level: 'warning',
        tags: {
          agentId,
          provider,
          model,
          policyKey,
          failureClass: failureClass ?? 'unknown',
        },
      });
    }
  } catch (error) {
    console.error('[LLM TRACE] Failed to persist trace:', error.message);
  }
}

export function classifyLLMFailure(error) {
  const code = error?.code ?? '';

  if (/AUTH|UNAUTHORIZED/i.test(code)) {
    return 'auth';
  }

  if (/MODEL_INVALID|NOT_CONFIGURED/i.test(code)) {
    return 'configuration';
  }

  if (/RATE_LIMIT/i.test(code)) {
    return 'rate_limit';
  }

  if (/UNAVAILABLE/i.test(code)) {
    return 'provider_unavailable';
  }

  if (/TIMEOUT/i.test(code)) {
    return 'timeout';
  }

  if (/VALIDATION/i.test(code) || error?.status === 400) {
    return 'validation';
  }

  return 'runtime';
}

export function estimateModelCostUsd({ provider, model, promptTokens = 0, completionTokens = 0 }) {
  return estimateCostUsd(provider, model, promptTokens, completionTokens);
}

export function estimateCostUsd(provider, model, promptTokens = 0, completionTokens = 0) {
  const costModel = resolveCostModel(provider, model);

  if (!costModel) {
    return null;
  }

  const inputCost = (Math.max(promptTokens ?? 0, 0) / 1_000_000) * costModel.inputPerMillion;
  const outputCost = (Math.max(completionTokens ?? 0, 0) / 1_000_000) * costModel.outputPerMillion;

  return Number((inputCost + outputCost).toFixed(6));
}

function getOverrideCosts() {
  const raw = process.env.MODEL_COST_OVERRIDES?.trim();

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('[LLM TRACE] MODEL_COST_OVERRIDES is invalid JSON:', error.message);
    return {};
  }
}

function resolveCostModel(provider, model) {
  const providerKey = String(provider ?? '').trim();
  const modelKey = String(model ?? '').trim();

  if (!providerKey || !modelKey) {
    return null;
  }

  const overrideCosts = getOverrideCosts();
  const overrideMatch = findProviderModelCost(overrideCosts, providerKey, modelKey);
  if (overrideMatch) {
    return overrideMatch;
  }

  if (providerKey === 'google') {
    const geminiMatch = findGeminiCost(modelKey);
    if (geminiMatch) {
      return geminiMatch;
    }
  }

  return findProviderModelCost(DEFAULT_MODEL_COSTS, providerKey, modelKey);
}

function findProviderModelCost(costMap, provider, model) {
  const exactMatch = costMap[`${provider}:${model}`];
  if (exactMatch) {
    return exactMatch;
  }

  const prefixMatches = Object.entries(costMap)
    .filter(([key]) => key.startsWith(`${provider}:`))
    .map(([key, value]) => ({
      modelPrefix: key.slice(provider.length + 1),
      value,
    }))
    .filter(({ modelPrefix }) => model.startsWith(modelPrefix))
    .sort((left, right) => right.modelPrefix.length - left.modelPrefix.length);

  return prefixMatches[0]?.value ?? null;
}

function findGeminiCost(model) {
  if (GEMINI_COSTS[model]) {
    return GEMINI_COSTS[model];
  }

  const prefixMatch = Object.entries(GEMINI_COSTS)
    .sort((left, right) => right[0].length - left[0].length)
    .find(([prefix]) => model.startsWith(prefix));

  return prefixMatch?.[1] ?? null;
}

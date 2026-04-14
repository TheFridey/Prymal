const LEGACY_MODEL_REPLACEMENTS = {
  // Anthropic — map all pre-4.x Claude identifiers to current live models
  'claude-3-5-sonnet-latest': 'claude-sonnet-4-6',
  'claude-3-5-sonnet-20240620': 'claude-sonnet-4-6',
  'claude-3-5-sonnet-20241022': 'claude-sonnet-4-6',
  'claude-3-7-sonnet-latest': 'claude-sonnet-4-6',
  'claude-3-7-sonnet-20250219': 'claude-sonnet-4-6',
  'claude-3-5-haiku-latest': 'claude-haiku-4-5',
  'claude-3-5-haiku-20241022': 'claude-haiku-4-5',
  // OpenAI — keep legacy gpt-4o references routing to current models
  'gpt-4o': 'gpt-5.4',
  'gpt-4o-mini': 'gpt-5.4-mini',
  'gpt-4-turbo': 'gpt-5.4',
  // Gemini — point old flash/pro identifiers to current versions
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-1.5-pro': 'gemini-2.5-pro',
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-pro': 'gemini-2.5-pro',
};

export const EXTENDED_THINKING_PLANS = new Set(['pro', 'teams', 'agency']);
const EXPLICIT_POLICY_KEYS = new Set([
  'fast_chat',
  'premium_reasoning',
  'grounded_research',
  'structured_extraction',
  'workflow_automation',
  'vision_file',
  'low_cost_bulk',
  'explicit_model',
]);

const PROVIDER_PREFERENCES = new Set(['openai', 'anthropic', 'google']);
const REASONING_TIERS = new Set(['auto', 'balanced', 'high', 'cost_saver']);
const FAST_LANE_OPTIONS = new Set(['auto', 'anthropic_fast', 'openai_router', 'gemini_flash']);

export const MODEL_POLICIES = {
  fast_chat: {
    key: 'fast_chat',
    latencyTarget: 'interactive',
    reasoningDepth: 'balanced',
  },
  premium_reasoning: {
    key: 'premium_reasoning',
    latencyTarget: 'patient',
    reasoningDepth: 'high',
  },
  grounded_research: {
    key: 'grounded_research',
    latencyTarget: 'balanced',
    reasoningDepth: 'high',
    groundingRequired: true,
    toolUsageRequired: true,
  },
  structured_extraction: {
    key: 'structured_extraction',
    latencyTarget: 'fast',
    reasoningDepth: 'medium',
    structuredOutputRequired: true,
  },
  workflow_automation: {
    key: 'workflow_automation',
    latencyTarget: 'balanced',
    reasoningDepth: 'medium',
    toolUsageRequired: true,
  },
  vision_file: {
    key: 'vision_file',
    latencyTarget: 'balanced',
    reasoningDepth: 'medium',
    multimodalRequired: true,
  },
  low_cost_bulk: {
    key: 'low_cost_bulk',
    latencyTarget: 'fast',
    reasoningDepth: 'low',
    costCeiling: 'low',
  },
  explicit_model: {
    key: 'explicit_model',
    latencyTarget: 'as_requested',
    reasoningDepth: 'as_requested',
  },
};

export function resolveModelName(candidate, fallback) {
  const model = candidate?.trim() || fallback;
  return LEGACY_MODEL_REPLACEMENTS[model] ?? model;
}

export function detectProviderFromModel(model) {
  if (/^gemini/i.test(model)) return 'google';
  return /^gpt|^o\d|^chatgpt|^gpt-image/i.test(model) ? 'openai' : 'anthropic';
}

export function getAnthropicModels() {
  const premium = resolveModelName(
    process.env.ANTHROPIC_MODEL_PREMIUM ?? process.env.ANTHROPIC_MODEL_OPUS,
    'claude-opus-4-6',
  );
  const defaultModel = resolveModelName(
    process.env.ANTHROPIC_MODEL_DEFAULT ?? process.env.ANTHROPIC_MODEL_PRIMARY,
    'claude-sonnet-4-6',
  );
  const fast = resolveModelName(
    process.env.ANTHROPIC_MODEL_FAST ?? process.env.ANTHROPIC_MODEL_FALLBACK,
    'claude-haiku-4-5',
  );

  return {
    premium,
    default: defaultModel,
    fast,
    // Legacy aliases kept for compatibility with existing callers/docs.
    opus: premium,
    primary: defaultModel,
    fallback: fast,
  };
}

export function getOpenAIModels() {
  const premium = resolveModelName(
    process.env.OPENAI_MODEL_PREMIUM ?? process.env.OPENAI_MODEL_ANALYSIS,
    'gpt-5.4',
  );
  const router = resolveModelName(process.env.OPENAI_MODEL_ROUTER, 'gpt-5.4-mini');
  const lightweight = resolveModelName(process.env.OPENAI_MODEL_LIGHTWEIGHT, 'gpt-5.4-nano');

  return {
    premium,
    router,
    lightweight,
    // Legacy alias kept for compatibility.
    analysis: premium,
  };
}

export function hasUsableAnthropicKey() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  return Boolean(apiKey && apiKey.startsWith('sk-ant-') && !/xxxx|your_|placeholder/i.test(apiKey));
}

export function hasUsableOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return Boolean(apiKey && apiKey.startsWith('sk-') && !/xxxx|your_|placeholder/i.test(apiKey));
}

export function hasUsableGeminiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  return Boolean(apiKey && apiKey.startsWith('AI') && !/xxxx|your_|placeholder/i.test(apiKey));
}

export function getGeminiModels() {
  return {
    flash: process.env.GEMINI_MODEL_FLASH ?? 'gemini-2.5-flash',
    pro: process.env.GEMINI_MODEL_PRO ?? 'gemini-2.5-pro',
  };
}

export function normalizeOrgAiControls(orgMetadata = {}) {
  const raw = orgMetadata?.aiControls ?? {};
  const providerPreference = PROVIDER_PREFERENCES.has(raw.providerPreference)
    ? raw.providerPreference
    : 'auto';
  const reasoningTier = REASONING_TIERS.has(raw.reasoningTier)
    ? raw.reasoningTier
    : 'auto';
  const fastLane = FAST_LANE_OPTIONS.has(raw.fastLane)
    ? raw.fastLane
    : 'auto';
  const failoverOrder = Array.isArray(raw.failoverOrder)
    ? [...new Set(raw.failoverOrder.filter((provider) => PROVIDER_PREFERENCES.has(provider)))]
    : [];

  return {
    providerPreference,
    reasoningTier,
    fastLane,
    budgetCap: {
      maxCostUsdPerRun: normalizeNullablePositiveNumber(raw.budgetCap?.maxCostUsdPerRun),
      maxOutputTokensPerRun: normalizeNullablePositiveInteger(raw.budgetCap?.maxOutputTokensPerRun),
    },
    spendThresholds: {
      warnUsdMonthly: normalizeNullablePositiveNumber(raw.spendThresholds?.warnUsdMonthly),
      hardCapUsdMonthly: normalizeNullablePositiveNumber(raw.spendThresholds?.hardCapUsdMonthly),
    },
    failoverOrder,
    experimentationEnabled: Boolean(raw.experimentationEnabled),
  };
}

export function buildModelOverridesFromAiControls(aiControls = null) {
  if (!aiControls) {
    return null;
  }

  const normalized = normalizeOrgAiControls({ aiControls });
  const overrides = {};
  const policies = {};

  if (normalized.providerPreference !== 'auto') {
    overrides.default = { provider: normalized.providerPreference };
  }

  if (normalized.fastLane !== 'auto') {
    const anthropicModels = getAnthropicModels();
    const openAIModels = getOpenAIModels();
    const geminiModels = getGeminiModels();

    if (normalized.fastLane === 'anthropic_fast') {
      policies.fast_chat = { provider: 'anthropic', model: anthropicModels.fast };
    }

    if (normalized.fastLane === 'openai_router') {
      policies.fast_chat = { provider: 'openai', model: openAIModels.router };
    }

    if (normalized.fastLane === 'gemini_flash') {
      policies.fast_chat = { provider: 'google', model: geminiModels.flash };
    }
  }

  if (Object.keys(policies).length > 0) {
    overrides.policies = policies;
  }

  if (
    normalized.budgetCap.maxCostUsdPerRun != null
    || normalized.budgetCap.maxOutputTokensPerRun != null
  ) {
    overrides.budgetCap = {
      maxCostUsdPerRun: normalized.budgetCap.maxCostUsdPerRun,
      maxOutputTokensPerRun: normalized.budgetCap.maxOutputTokensPerRun,
      allowedPolicies: null,
    };
  }

  return Object.keys(overrides).length > 0 ? overrides : null;
}

export function mergeOrgModelOverrides(base = null, extra = null) {
  if (!base && !extra) {
    return null;
  }

  if (!base) {
    return extra;
  }

  if (!extra) {
    return base;
  }

  return {
    ...base,
    ...extra,
    default: {
      ...(base.default ?? {}),
      ...(extra.default ?? {}),
    },
    policies: {
      ...(base.policies ?? {}),
      ...(extra.policies ?? {}),
    },
    budgetCap: {
      ...(base.budgetCap ?? {}),
      ...(extra.budgetCap ?? {}),
    },
  };
}

export function getOrgModelPolicyOverrides(orgId = null) {
  const raw = process.env.ORG_MODEL_POLICY_OVERRIDES?.trim();

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!orgId || typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed[orgId] ?? null;
  } catch (error) {
    console.error('[MODEL POLICY] ORG_MODEL_POLICY_OVERRIDES is invalid JSON:', error.message);
    return null;
  }
}

/**
 * Resolve the per-org model budget cap for a given org.
 * Budget caps are configured via ORG_MODEL_POLICY_OVERRIDES under a `budgetCap` key:
 *   {
 *     "org-id-here": {
 *       "budgetCap": {
 *         "maxCostUsdPerRun": 0.10,
 *         "maxOutputTokensPerRun": 2000,
 *         "allowedPolicies": ["fast_chat", "structured_extraction"]
 *       }
 *     }
 *   }
 *
 * @param {string|null} orgId
 * @param {object|null} orgModelOverrides  Pre-resolved override object (avoids double JSON parse)
 * @returns {{ maxCostUsdPerRun: number|null, maxOutputTokensPerRun: number|null, allowedPolicies: string[]|null }|null}
 */
export function getOrgBudgetCap(orgId = null, orgModelOverrides = null) {
  const overrides = orgModelOverrides ?? getOrgModelPolicyOverrides(orgId);
  if (!overrides?.budgetCap || typeof overrides.budgetCap !== 'object') {
    return null;
  }

  return {
    maxCostUsdPerRun: overrides.budgetCap.maxCostUsdPerRun ?? null,
    maxOutputTokensPerRun: overrides.budgetCap.maxOutputTokensPerRun ?? null,
    allowedPolicies: Array.isArray(overrides.budgetCap.allowedPolicies)
      ? overrides.budgetCap.allowedPolicies
      : null,
  };
}

/**
 * Apply per-org budget constraints to an execution plan.
 * - If the plan's policy is not in the org's allowedPolicies list, downgrade to fast_chat.
 * - Cap max output tokens to the org budget cap if configured.
 *
 * Returns the (potentially modified) plan and an optional maxTokensCap.
 *
 * @param {{ policyKey: string, provider: string, model: string, route: string, reason: string, fallbackChain: any[], selectionDetails: object }} plan
 * @param {{ maxCostUsdPerRun: number|null, maxOutputTokensPerRun: number|null, allowedPolicies: string[]|null }|null} budgetCap
 * @param {{ premium: string, default: string, fast: string }} anthropicModels
 * @param {{ premium: string, router: string, lightweight: string }} openAIModels
 * @returns {{ plan: object, maxTokensCap: number|null }}
 */
export function applyOrgBudgetCap(plan, budgetCap, anthropicModels, openAIModels) {
  if (!budgetCap) {
    return { plan, maxTokensCap: null };
  }

  let effectivePlan = plan;

  // Policy allowlist enforcement — downgrade to fast_chat if policy not permitted
  if (budgetCap.allowedPolicies && !budgetCap.allowedPolicies.includes(plan.policyKey)) {
    console.info(
      `[MODEL POLICY] Org budget cap: policy "${plan.policyKey}" not in allowedPolicies — downgrading to fast_chat.`,
    );
    effectivePlan = {
      ...plan,
      policyKey: MODEL_POLICIES.fast_chat.key,
      model: anthropicModels.fast,
      provider: 'anthropic',
      route: 'budget-cap-downgrade',
      reason: `Org budget cap restricts to fast_chat. Original policy: ${plan.policyKey}.`,
      selectionDetails: {
        ...(plan.selectionDetails ?? {}),
        budgetCapApplied: true,
        originalPolicyKey: plan.policyKey,
      },
    };
  }

  const maxTokensCap = budgetCap.maxOutputTokensPerRun ?? null;
  return { plan: effectivePlan, maxTokensCap };
}

export function selectExecutionPlan({
  agent,
  agentContract = null,
  userMessage = '',
  mode = 'chat',
  preferredModel,
  orgId = null,
  orgPlan = 'free',
  attachments = [],
  taskType = null,
  policyOverride = null,
  providerOverride = null,
  modelOverride = null,
  routingHints = {},
  orgModelOverrides = null,
}) {
  const anthropicModels = getAnthropicModels();
  const openAIModels = getOpenAIModels();
  const geminiModels = getGeminiModels();
  const anthropicAvailable = hasUsableAnthropicKey();
  const openAIAvailable = hasUsableOpenAIKey();
  const geminiAvailable = hasUsableGeminiKey();

  if (preferredModel?.trim() || modelOverride?.trim()) {
    const explicitModel = resolveModelName(modelOverride ?? preferredModel, modelOverride ?? preferredModel);
    return buildExecutionPlan({
      policyKey: MODEL_POLICIES.explicit_model.key,
      provider: providerOverride ?? detectProviderFromModel(explicitModel),
      model: explicitModel,
      route: 'explicit-model',
      reason: `Using explicitly requested model ${explicitModel}.`,
      fallbackChain: [],
      selectionDetails: buildSelectionDetails({
        policyKey: MODEL_POLICIES.explicit_model.key,
        taskType,
        agentContract,
        policyOverrideSource: modelOverride ? 'runtime-model-override' : 'preferred-model',
        routingHints,
      }),
    });
  }

  const policyKey = determinePolicyKey({
    agent,
    agentContract,
    userMessage,
    mode,
    attachments,
    orgPlan,
    taskType,
    policyOverride,
  });

  const policyConfig = MODEL_POLICIES[policyKey] ?? MODEL_POLICIES.fast_chat;
  const effectiveOrgOverrides = orgModelOverrides ?? getOrgModelPolicyOverrides(orgId);
  const orgPolicyOverride = resolveOrgPolicyOverride(effectiveOrgOverrides, policyKey);
  const preferredLane = agentContract?.modelPolicy?.preferredLane ?? null;
  const selectionDetails = buildSelectionDetails({
    policyKey,
    taskType,
    agentContract,
    policyOverrideSource: policyOverride ? 'runtime-policy-override' : taskType ? 'explicit-task-type' : 'classifier',
    routingHints,
    orgOverrideApplied: Boolean(orgPolicyOverride),
  });

  if (orgPolicyOverride?.model) {
    return buildExecutionPlan({
      policyKey,
      provider: orgPolicyOverride.provider ?? detectProviderFromModel(orgPolicyOverride.model),
      model: resolveModelName(orgPolicyOverride.model, orgPolicyOverride.model),
      route: 'org-policy-override',
      reason: `Using org policy override for ${policyKey}.`,
      fallbackChain: buildOverrideFallbackChain({
        policyKey,
        preferredLane,
        anthropicModels,
        openAIModels,
      }),
      selectionDetails,
    });
  }

  if (orgPolicyOverride?.provider) {
    return buildExecutionPlan({
      policyKey,
      provider: orgPolicyOverride.provider,
      model: resolveDefaultProviderModel({
        provider: orgPolicyOverride.provider,
        policyKey,
        anthropicModels,
        openAIModels,
        geminiModels,
      }),
      route: 'org-policy-override',
      reason: `Using org policy provider preference ${orgPolicyOverride.provider} for ${policyKey}.`,
      fallbackChain: buildOverrideFallbackChain({
        policyKey,
        preferredLane,
        anthropicModels,
        openAIModels,
      }),
      selectionDetails,
    });
  }

  if (providerOverride?.trim()) {
    const provider = providerOverride.trim();
    const model = resolveDefaultProviderModel({
      provider,
      policyKey,
      anthropicModels,
      openAIModels,
      geminiModels,
    });

    return buildExecutionPlan({
      policyKey,
      provider,
      model,
      route: 'runtime-provider-override',
      reason: `Using provider override ${provider}.`,
      fallbackChain: buildOverrideFallbackChain({
        policyKey,
        preferredLane,
        anthropicModels,
        openAIModels,
      }),
      selectionDetails: {
        ...selectionDetails,
        policyOverrideSource: 'runtime-provider-override',
      },
    });
  }

  if (policyKey === MODEL_POLICIES.vision_file.key) {
    if (attachments.some((attachment) => attachment.mediaType === 'application/pdf') && anthropicAvailable) {
      return buildExecutionPlan({
        policyKey,
        provider: 'anthropic',
        model: anthropicModels.default,
        route: 'anthropic-vision-file',
        reason: `Using ${anthropicModels.default} for file-aware multimodal work.`,
        fallbackChain: [{ provider: 'anthropic', model: anthropicModels.fast, route: 'anthropic-file-fallback' }],
        selectionDetails,
      });
    }

    if (openAIAvailable) {
      return buildExecutionPlan({
        policyKey,
        provider: 'openai',
        model: openAIModels.premium,
        route: 'openai-vision-file',
        reason: `Using ${openAIModels.premium} for multimodal image-aware work.`,
        fallbackChain: [
          { provider: 'openai', model: openAIModels.router, route: 'openai-router-fallback' },
          { provider: 'anthropic', model: anthropicModels.default, route: 'anthropic-specialist-fallback' },
        ],
        selectionDetails,
      });
    }
  }

  if (policyKey === MODEL_POLICIES.structured_extraction.key && openAIAvailable) {
    return buildExecutionPlan({
      policyKey,
      provider: 'openai',
      model: openAIModels.router,
      route: 'openai-structured-extraction',
      reason: `Using ${openAIModels.router} for structured extraction and routing tasks.`,
      fallbackChain: [
        { provider: 'openai', model: openAIModels.lightweight, route: 'openai-lightweight-fallback' },
        ...(geminiAvailable ? [{ provider: 'google', model: geminiModels.flash, route: 'gemini-flash-fallback' }] : []),
        { provider: 'anthropic', model: anthropicModels.fast, route: 'anthropic-fast-fallback' },
      ],
      selectionDetails,
    });
  }

  if (policyKey === MODEL_POLICIES.low_cost_bulk.key) {
    if (geminiAvailable) {
      return buildExecutionPlan({
        policyKey,
        provider: 'google',
        model: geminiModels.flash,
        route: 'gemini-low-cost-bulk',
        reason: `Using ${geminiModels.flash} for a low-cost bulk task.`,
        fallbackChain: [
          { provider: 'openai', model: openAIModels.lightweight, route: 'openai-lightweight-fallback' },
          { provider: 'anthropic', model: anthropicModels.fast, route: 'anthropic-fast-fallback' },
        ],
        selectionDetails,
      });
    }

    if (openAIAvailable) {
      return buildExecutionPlan({
        policyKey,
        provider: 'openai',
        model: openAIModels.lightweight,
        route: 'openai-low-cost-bulk',
        reason: `Using ${openAIModels.lightweight} for a low-cost bulk task.`,
        fallbackChain: [{ provider: 'anthropic', model: anthropicModels.fast, route: 'anthropic-fast-fallback' }],
        selectionDetails,
      });
    }
  }

  if (policyKey === MODEL_POLICIES.workflow_automation.key) {
    const analysisHeavyAgent = ['cipher', 'ledger', 'nexus', 'oracle', 'scout'].includes(agent?.id);
    const prefersOpenAIRouter = preferredLane === 'openai_router' || (!preferredLane && analysisHeavyAgent);

    if (openAIAvailable && prefersOpenAIRouter) {
      const primaryModel = analysisHeavyAgent ? openAIModels.premium : openAIModels.router;
      return buildExecutionPlan({
        policyKey,
        provider: 'openai',
        model: primaryModel,
        route: analysisHeavyAgent ? 'openai-workflow-premium' : 'openai-workflow-router',
        reason: analysisHeavyAgent
          ? `Using ${primaryModel} for analytical workflow automation.`
          : `Using ${primaryModel} for lighter workflow automation.`,
        fallbackChain: [
          { provider: 'anthropic', model: anthropicModels.default, route: 'anthropic-workflow-fallback' },
          { provider: 'openai', model: openAIModels.lightweight, route: 'openai-lightweight-fallback' },
        ],
        selectionDetails,
      });
    }

    if (anthropicAvailable) {
      return buildExecutionPlan({
        policyKey,
        provider: 'anthropic',
        model: anthropicModels.default,
        route: 'anthropic-workflow-specialist',
        reason: `Using ${anthropicModels.default} for balanced workflow orchestration.`,
        fallbackChain: [
          { provider: 'anthropic', model: anthropicModels.fast, route: 'anthropic-fast-fallback' },
          { provider: 'openai', model: openAIModels.router, route: 'openai-router-fallback' },
        ],
        selectionDetails,
      });
    }
  }

  if (policyKey === MODEL_POLICIES.grounded_research.key) {
    const prefersAnthropicGrounding = preferredLane === 'anthropic_premium' || preferredLane === 'anthropic_balanced';

    if (prefersAnthropicGrounding && anthropicAvailable && !routingHints?.toolHeavy) {
      return buildExecutionPlan({
        policyKey,
        provider: 'anthropic',
        model: anthropicModels.default,
        route: 'anthropic-grounded-research',
        reason: `Using ${anthropicModels.default} for long-context grounded research.`,
        fallbackChain: [
          { provider: 'openai', model: openAIModels.premium, route: 'openai-grounded-research-fallback' },
          { provider: 'anthropic', model: anthropicModels.fast, route: 'anthropic-fast-fallback' },
        ],
        selectionDetails,
      });
    }

    if (openAIAvailable) {
      return buildExecutionPlan({
        policyKey,
        provider: 'openai',
        model: openAIModels.premium,
        route: 'openai-grounded-research',
        reason: `Using ${openAIModels.premium} for grounded research and heavier tool-assisted synthesis.`,
        fallbackChain: [
          { provider: 'anthropic', model: anthropicModels.default, route: 'anthropic-research-fallback' },
          ...(geminiAvailable ? [{ provider: 'google', model: geminiModels.pro, route: 'gemini-pro-fallback' }] : []),
          { provider: 'openai', model: openAIModels.router, route: 'openai-router-fallback' },
        ],
        selectionDetails,
      });
    }

    if (geminiAvailable) {
      return buildExecutionPlan({
        policyKey,
        provider: 'google',
        model: geminiModels.pro,
        route: 'gemini-grounded-research',
        reason: `Using ${geminiModels.pro} for grounded research.`,
        fallbackChain: [{ provider: 'google', model: geminiModels.flash, route: 'gemini-flash-fallback' }],
        selectionDetails,
      });
    }
  }

  if (policyKey === MODEL_POLICIES.premium_reasoning.key) {
    const wantsAnthropicPremium =
      preferredLane === 'anthropic_premium'
      || (agent?.useExtendedThinking === true && EXTENDED_THINKING_PLANS.has(orgPlan));

    if (wantsAnthropicPremium && anthropicAvailable) {
      return buildExecutionPlan({
        policyKey,
        provider: 'anthropic',
        model: anthropicModels.premium,
        route: 'anthropic-premium-reasoning',
        reason: `Using ${anthropicModels.premium} for deeper reasoning and long-context specialist work.`,
        fallbackChain: [
          { provider: 'anthropic', model: anthropicModels.default, route: 'anthropic-specialist-fallback' },
          { provider: 'openai', model: openAIModels.premium, route: 'openai-premium-fallback' },
        ],
        selectionDetails,
      });
    }

    if (openAIAvailable) {
      return buildExecutionPlan({
        policyKey,
        provider: 'openai',
        model: openAIModels.premium,
        route: 'openai-premium-reasoning',
        reason: `Using ${openAIModels.premium} for higher-depth reasoning and analysis.`,
        fallbackChain: [
          { provider: 'anthropic', model: anthropicModels.default, route: 'anthropic-specialist-fallback' },
          { provider: 'openai', model: openAIModels.router, route: 'openai-router-fallback' },
        ],
        selectionDetails,
      });
    }
  }

  if (anthropicAvailable && shouldPreferAnthropicLane(preferredLane)) {
    return buildExecutionPlan({
      policyKey: MODEL_POLICIES.fast_chat.key,
      provider: 'anthropic',
      model: preferredLane === 'anthropic_fast' ? anthropicModels.fast : anthropicModels.default,
      route: preferredLane === 'anthropic_fast' ? 'anthropic-fast-chat' : 'anthropic-specialist',
      reason:
        preferredLane === 'anthropic_fast'
          ? `Using ${anthropicModels.fast} for a fast Anthropic chat lane.`
          : `Using ${anthropicModels.default} as the default Anthropic specialist lane.`,
      fallbackChain: [
        { provider: 'anthropic', model: anthropicModels.fast, route: 'anthropic-fallback' },
        { provider: 'openai', model: openAIModels.router, route: 'openai-text-fallback' },
      ],
      selectionDetails,
    });
  }

  if (openAIAvailable) {
    return buildExecutionPlan({
      policyKey: MODEL_POLICIES.fast_chat.key,
      provider: 'openai',
      model: preferredLane === 'openai_lightweight' ? openAIModels.lightweight : openAIModels.router,
      route: preferredLane === 'openai_lightweight' ? 'openai-lightweight-chat' : 'openai-text-router',
      reason:
        preferredLane === 'openai_lightweight'
          ? `Using ${openAIModels.lightweight} for a lightweight OpenAI lane.`
          : `Using ${openAIModels.router} as the default OpenAI fast lane.`,
      fallbackChain: [
        { provider: 'anthropic', model: anthropicModels.default, route: 'anthropic-specialist-fallback' },
        { provider: 'openai', model: openAIModels.lightweight, route: 'openai-lightweight-fallback' },
      ],
      selectionDetails,
    });
  }

  if (geminiAvailable) {
    return buildExecutionPlan({
      policyKey: MODEL_POLICIES.fast_chat.key,
      provider: 'google',
      model: geminiModels.flash,
      route: 'gemini-fast-chat',
      reason: `Using ${geminiModels.flash} as Gemini emergency fast-chat lane.`,
      fallbackChain: [{ provider: 'google', model: geminiModels.pro, route: 'gemini-pro-fallback' }],
      selectionDetails,
    });
  }

  return buildExecutionPlan({
    policyKey: MODEL_POLICIES.fast_chat.key,
    provider: 'anthropic',
    model: anthropicModels.default,
    route: 'anthropic-specialist',
    reason: `Using ${anthropicModels.default} as the default specialist generation model.`,
    fallbackChain: [],
    selectionDetails,
  });
}

export function getFallbackPlan(currentPlan) {
  if (!currentPlan?.fallbackChain?.length) {
    return null;
  }

  const [nextFallback, ...remainingFallbacks] = currentPlan.fallbackChain;
  return {
    ...currentPlan,
    provider: nextFallback.provider,
    model: nextFallback.model,
    route: nextFallback.route,
    reason: `Fallback from ${currentPlan.model} to ${nextFallback.model}.`,
    fallbackChain: remainingFallbacks,
    fallbackUsed: true,
    selectionDetails: {
      ...(currentPlan.selectionDetails ?? {}),
      fallbackDepth: ((currentPlan.selectionDetails?.fallbackDepth ?? 0) + 1),
      selectedProvider: nextFallback.provider,
      selectedModel: nextFallback.model,
      fallbackModelUsed: nextFallback.model,
      fallbackProviderUsed: nextFallback.provider,
    },
  };
}

/**
 * Rough cost-per-1k-token reference table (USD).
 * These are approximate and should be updated as provider pricing changes.
 * Used for budget cap enforcement and spend analytics — not billing.
 */
export const APPROX_COST_PER_1K_TOKENS = {
  'claude-opus-4-6':    { input: 0.015,  output: 0.075  },
  'claude-sonnet-4-6':  { input: 0.003,  output: 0.015  },
  'claude-haiku-4-5':   { input: 0.0008, output: 0.004  },
  'gpt-5.4':            { input: 0.01,   output: 0.03   },
  'gpt-5.4-mini':       { input: 0.0015, output: 0.006  },
  'gpt-5.4-nano':       { input: 0.0004, output: 0.0016 },
  'gemini-2.5-pro':     { input: 0.00125,output: 0.005  },
  'gemini-2.5-flash':   { input: 0.00015,output: 0.0006 },
};

/**
 * Estimate cost for a given run given input/output token counts.
 * Returns null when the model is unknown.
 *
 * @param {string} model
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number|null}  Estimated cost in USD
 */
export function estimateRunCostUsd(model, inputTokens, outputTokens) {
  const pricing = APPROX_COST_PER_1K_TOKENS[model];
  if (!pricing) return null;
  return (
    (inputTokens / 1000) * pricing.input +
    (outputTokens / 1000) * pricing.output
  );
}

/**
 * Build a provider-level routing summary from a set of run rows.
 * Groups by provider + model, surfaces fallback rates and average cost.
 *
 * @param {Array<{provider: string, model: string, outcomeStatus: string, fallbackUsed: boolean, latencyMs: number, estimatedCostUsd: number}>} rows
 */
export function buildProviderRoutingSummary(rows = []) {
  const aggregate = new Map();

  for (const row of rows) {
    const key = `${row.provider}::${row.model}`;
    const current = aggregate.get(key) ?? {
      provider: row.provider,
      model: row.model,
      runs: 0,
      successCount: 0,
      fallbackCount: 0,
      totalLatencyMs: 0,
      totalCostUsd: 0,
    };

    current.runs += 1;
    current.successCount += row.outcomeStatus === 'succeeded' ? 1 : 0;
    current.fallbackCount += row.fallbackUsed ? 1 : 0;
    current.totalLatencyMs += row.latencyMs ?? 0;
    current.totalCostUsd += row.estimatedCostUsd ?? 0;
    aggregate.set(key, current);
  }

  return [...aggregate.values()]
    .map((entry) => ({
      provider: entry.provider,
      model: entry.model,
      runs: entry.runs,
      successRate: safeRate(entry.successCount, entry.runs),
      fallbackRate: safeRate(entry.fallbackCount, entry.runs),
      averageLatencyMs: Math.round(entry.totalLatencyMs / Math.max(entry.runs, 1)),
      totalCostUsd: Number(entry.totalCostUsd.toFixed(6)),
      averageCostUsd: Number((entry.totalCostUsd / Math.max(entry.runs, 1)).toFixed(6)),
    }))
    .sort((a, b) => b.runs - a.runs);
}

/**
 * Detect whether spending for a given org is anomalous relative to
 * historical daily average. Returns null when insufficient data.
 *
 * @param {number} todayCostUsd
 * @param {number[]} recentDailyCostsUsd  Last N days (excluding today)
 * @param {number} [thresholdMultiplier=2.5]
 * @returns {{ isAnomaly: boolean, todayCostUsd: number, averageDailyCostUsd: number, ratio: number }|null}
 */
export function detectSpendAnomaly(todayCostUsd, recentDailyCostsUsd, thresholdMultiplier = 2.5) {
  if (!recentDailyCostsUsd || recentDailyCostsUsd.length < 3) return null;
  const avg = recentDailyCostsUsd.reduce((sum, v) => sum + v, 0) / recentDailyCostsUsd.length;
  if (avg === 0) return null;
  const ratio = todayCostUsd / avg;
  return {
    isAnomaly: ratio >= thresholdMultiplier,
    todayCostUsd,
    averageDailyCostUsd: Number(avg.toFixed(6)),
    ratio: Number(ratio.toFixed(3)),
  };
}

export function buildPolicyOutcomeSummary(rows = []) {
  const aggregate = new Map();

  for (const row of rows) {
    const current = aggregate.get(row.policyKey) ?? {
      policyKey: row.policyKey,
      runs: 0,
      successCount: 0,
      failureCount: 0,
      fallbackCount: 0,
      averageLatencyMs: 0,
      totalLatencyMs: 0,
      totalCostUsd: 0,
    };

    current.runs += 1;
    current.successCount += row.outcomeStatus === 'succeeded' ? 1 : 0;
    current.failureCount += row.outcomeStatus === 'failed' ? 1 : 0;
    current.fallbackCount += row.fallbackUsed ? 1 : 0;
    current.totalLatencyMs += row.latencyMs ?? 0;
    current.totalCostUsd += row.estimatedCostUsd ?? 0;
    aggregate.set(row.policyKey, current);
  }

  return [...aggregate.values()]
    .map((entry) => ({
      policyKey: entry.policyKey,
      runs: entry.runs,
      successRate: safeRate(entry.successCount, entry.runs),
      failureRate: safeRate(entry.failureCount, entry.runs),
      fallbackRate: safeRate(entry.fallbackCount, entry.runs),
      averageLatencyMs: Math.round(entry.totalLatencyMs / Math.max(entry.runs, 1)),
      averageCostUsd: Number((entry.totalCostUsd / Math.max(entry.runs, 1)).toFixed(6)),
    }))
    .sort((left, right) => right.runs - left.runs);
}

function determinePolicyKey({
  agent,
  agentContract,
  userMessage,
  mode,
  attachments,
  orgPlan,
  taskType,
  policyOverride,
}) {
  const explicitOverride = normalizePolicyKey(policyOverride);
  if (explicitOverride) {
    return explicitOverride;
  }

  const explicitTaskType = normalizePolicyKey(taskType);
  if (explicitTaskType) {
    return explicitTaskType;
  }

  const contractDefault = normalizePolicyKey(agentContract?.modelPolicy?.defaultPolicy);
  if (contractDefault === MODEL_POLICIES.workflow_automation.key && mode === 'workflow') {
    return contractDefault;
  }

  return classifyPolicy({ agent, userMessage, mode, attachments, orgPlan, contractDefault });
}

function classifyPolicy({ agent, userMessage, mode, attachments, orgPlan, contractDefault }) {
  const text = userMessage.toLowerCase();
  const isShort = userMessage.trim().length < 180;
  const hasAttachments = attachments.length > 0;

  if (hasAttachments) {
    return MODEL_POLICIES.vision_file.key;
  }

  if (mode === 'workflow') {
    return MODEL_POLICIES.workflow_automation.key;
  }

  if (agent?.id === 'nexus' || /\bworkflow\b|\bautomate\b|\borchestrate\b|\btrigger\b/.test(text)) {
    return MODEL_POLICIES.workflow_automation.key;
  }

  if (
    /\bresearch\b|\bcrawl\b|\bscrape\b|\bwebsite\b|\bmarket\b|\bcompetitor\b|\blatest\b|\bsource\b|\bcite\b/.test(
      text,
    )
  ) {
    return MODEL_POLICIES.grounded_research.key;
  }

  if (
    /\bextract\b|\bclassify\b|\btag\b|\breformat\b|\bconvert\b|\bjson\b|\btable\b|\bparse\b|\broute\b/.test(text)
  ) {
    return MODEL_POLICIES.structured_extraction.key;
  }

  if (
    /\bcsv\b|\bspreadsheet\b|\bdataset\b|\bquickbooks\b|\bvariance\b|\bforecast\b|\baudit\b|\banaly[sz]e\b|\bcompare\b/.test(
      text,
    ) ||
    (['cipher', 'ledger', 'oracle', 'scout', 'sage'].includes(agent?.id) && userMessage.length > 220)
  ) {
    return MODEL_POLICIES.premium_reasoning.key;
  }

  if (
    /\bsubject line\b|\bone liner\b|\bone-liner\b|\bslug\b|\btagline\b|\bheadline options\b|\bkeywords\b/.test(text) ||
    (isShort && orgPlan === 'free')
  ) {
    return MODEL_POLICIES.low_cost_bulk.key;
  }

  return contractDefault ?? MODEL_POLICIES.fast_chat.key;
}

function resolveOrgPolicyOverride(orgModelOverrides, policyKey) {
  if (!orgModelOverrides || typeof orgModelOverrides !== 'object') {
    return null;
  }

  return orgModelOverrides?.policies?.[policyKey] ?? orgModelOverrides?.default ?? null;
}

function buildOverrideFallbackChain({ policyKey, preferredLane, anthropicModels, openAIModels }) {
  if (policyKey === MODEL_POLICIES.low_cost_bulk.key) {
    return [{ provider: 'anthropic', model: anthropicModels.fast, route: 'anthropic-fast-fallback' }];
  }

  if (shouldPreferAnthropicLane(preferredLane)) {
    return [
      { provider: 'anthropic', model: anthropicModels.fast, route: 'anthropic-fast-fallback' },
      { provider: 'openai', model: openAIModels.router, route: 'openai-router-fallback' },
    ];
  }

  return [
    { provider: 'openai', model: openAIModels.router, route: 'openai-router-fallback' },
    { provider: 'anthropic', model: anthropicModels.default, route: 'anthropic-specialist-fallback' },
  ];
}

function buildSelectionDetails({
  policyKey,
  taskType,
  agentContract,
  policyOverrideSource,
  routingHints,
  orgOverrideApplied = false,
}) {
  return {
    taskType: taskType ? normalizePolicyKey(taskType) : null,
    policyKey,
    policyClass: policyKey,
    policyOverrideSource,
    agentPreferredLane: agentContract?.modelPolicy?.preferredLane ?? null,
    preferredPolicyClass: agentContract?.modelPolicy?.defaultPolicy ?? null,
    routingHints: normalizeRoutingHints(routingHints),
    orgOverrideApplied,
  };
}

function resolveDefaultProviderModel({
  provider,
  policyKey,
  anthropicModels,
  openAIModels,
  geminiModels,
}) {
  if (provider === 'openai') {
    if (policyKey === MODEL_POLICIES.premium_reasoning.key || policyKey === MODEL_POLICIES.grounded_research.key || policyKey === MODEL_POLICIES.vision_file.key) {
      return openAIModels.premium;
    }

    if (policyKey === MODEL_POLICIES.low_cost_bulk.key) {
      return openAIModels.lightweight;
    }

    return openAIModels.router;
  }

  if (provider === 'google') {
    if (policyKey === MODEL_POLICIES.premium_reasoning.key || policyKey === MODEL_POLICIES.grounded_research.key) {
      return geminiModels.pro;
    }

    return geminiModels.flash;
  }

  if (policyKey === MODEL_POLICIES.premium_reasoning.key) {
    return anthropicModels.premium;
  }

  if (policyKey === MODEL_POLICIES.low_cost_bulk.key) {
    return anthropicModels.fast;
  }

  return anthropicModels.default;
}

function normalizeNullablePositiveNumber(value) {
  if (value == null || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeNullablePositiveInteger(value) {
  if (value == null || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function buildExecutionPlan({
  policyKey,
  provider,
  model,
  route,
  reason,
  fallbackChain,
  selectionDetails,
}) {
  return {
    policyKey,
    provider,
    model,
    route,
    reason,
    fallbackChain,
    selectionDetails: {
      ...(selectionDetails ?? {}),
      selectedProvider: provider,
      selectedModel: model,
      fallbackChain: (fallbackChain ?? []).map((entry) => ({
        provider: entry.provider,
        model: entry.model,
        route: entry.route,
      })),
      fallbackModelUsed: null,
      fallbackProviderUsed: null,
    },
  };
}

function normalizePolicyKey(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return EXPLICIT_POLICY_KEYS.has(normalized) ? normalized : null;
}

function normalizeRoutingHints(routingHints) {
  if (!routingHints || typeof routingHints !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(routingHints)
      .filter(([, value]) => value !== undefined && value !== null && value !== false)
      .slice(0, 8),
  );
}

function shouldPreferAnthropicLane(preferredLane) {
  return ['anthropic_balanced', 'anthropic_premium', 'anthropic_fast'].includes(preferredLane);
}

function safeRate(numerator, denominator) {
  if (!denominator) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(4));
}

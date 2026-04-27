import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getAgent } from '../agents/config.js';
import { getGeminiLlmProvider } from './providers/gemini-llm-provider.js';
import {
  agentRequiresSchemaValidation,
  buildSchemaRepairPrompt,
  createSchemaValidationError,
  formatStructuredOutput,
  validateAgentOutput,
} from './agent-output-validator.js';
import {
  buildRuntimeContractSummary,
  getRuntimeAgentContract,
  validateContractToolUsage,
} from '../agents/runtime.js';
import { retrieveRankedMemories, buildMemoryClientPreview } from './memory-retrieval.js';
import {
  applyOrgBudgetCap,
  buildModelOverridesFromAiControls,
  getFallbackPlan as getPolicyFallbackPlan,
  getAnthropicModels,
  getGeminiModels,
  getOpenAIModels,
  getOrgBudgetCap,
  mergeOrgModelOverrides,
  getOrgModelPolicyOverrides,
  hasUsableAnthropicKey,
  hasUsableGeminiKey,
  hasUsableOpenAIKey,
  normalizeOrgAiControls,
  selectExecutionPlan as selectExecutionPlanWithPolicy,
} from './model-policy.js';
import { ragSearch } from './rag.js';
import { fetchLiveWebContext } from './web-research.js';
import { buildSuccessfulPatternsPrompt, getSuccessfulPatterns } from './moat-feedback.js';

const ANTHROPIC_MODELS = getAnthropicModels();
const OPENAI_MODELS = getOpenAIModels();
const GEMINI_MODELS = getGeminiModels();

const MAX_CONTEXT_TOKENS = 160_000;
const MAX_RESPONSE_TOKENS = 8192;
const MAX_LORE_CHUNKS = 4;
const NO_EM_DASH_OUTPUT_RULE = [
  'PUNCTUATION RULE',
  'Never use Unicode U+2014 em dash in any agent output, generated copy, JSON string value, email, post, report, plan, or workflow result.',
  'Use commas, colons, parentheses, periods, or a standard hyphen instead.',
].join('\n');

// Adaptive retrieval — research agents (deep grounding) need a wider net.
// Map: contextBudget -> { baseLimit, hardCap }. Research agents add a bonus.
const RETRIEVAL_BUDGETS = {
  low: { baseLimit: 3, hardCap: 5 },
  medium: { baseLimit: 4, hardCap: 7 },
  high: { baseLimit: 5, hardCap: 9 },
};
const RESEARCH_AGENT_IDS = new Set(['lore', 'oracle', 'scout', 'sage']);
const RETRIEVAL_HIGH_CONFIDENCE_FLOOR = 0.62;
const RETRIEVAL_MIN_CONFIDENT_HITS = 2;

export function sanitizeAgentOutputText(value) {
  return typeof value === 'string' ? value.replace(/\u2014/g, '-') : value;
}

function sanitizeProviderResponse(response) {
  if (!response || typeof response.text !== 'string') return response;
  return {
    ...response,
    text: sanitizeAgentOutputText(response.text),
  };
}

/**
 * Decide how many LORE chunks to fetch for this agent on this query.
 * Research agents oversample so we can post-filter on confidence;
 * other agents stay near MAX_LORE_CHUNKS to keep prompts tight.
 */
function getRetrievalBudgetForAgent(agentId, contract) {
  const isResearch = RESEARCH_AGENT_IDS.has(agentId);
  const tier = contract?.contextBudget ?? 'medium';
  const base = RETRIEVAL_BUDGETS[tier] ?? RETRIEVAL_BUDGETS.medium;

  if (isResearch) {
    // Oversample for research agents so we can trim by confidence.
    return {
      baseLimit: base.baseLimit + 1,
      hardCap: base.hardCap + 2,
      research: true,
    };
  }

  return {
    baseLimit: Math.min(base.baseLimit, MAX_LORE_CHUNKS),
    hardCap: Math.min(base.hardCap, MAX_LORE_CHUNKS + 1),
    research: false,
  };
}

/**
 * Trim oversampled chunks down to the most useful subset.
 * Keeps every high-confidence hit, then fills toward baseLimit with the
 * next best results. Falls back to baseLimit if nothing meets the floor.
 */
function selectAdaptiveChunks(chunks, budget) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return { selected: [], confidentCount: 0, expanded: false };
  }

  if (!budget.research) {
    return {
      selected: chunks.slice(0, budget.baseLimit),
      confidentCount: chunks.filter((c) => (c.finalScore ?? 0) >= RETRIEVAL_HIGH_CONFIDENCE_FLOOR).length,
      expanded: false,
    };
  }

  const ranked = [...chunks].sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));
  const confident = ranked.filter((c) => (c.finalScore ?? 0) >= RETRIEVAL_HIGH_CONFIDENCE_FLOOR);

  // If we have enough confident hits, prefer those; otherwise expand to base.
  if (confident.length >= RETRIEVAL_MIN_CONFIDENT_HITS) {
    const selected = confident.slice(0, budget.hardCap);
    return { selected, confidentCount: confident.length, expanded: selected.length > budget.baseLimit };
  }

  const selected = ranked.slice(0, budget.baseLimit);
  return { selected, confidentCount: confident.length, expanded: false };
}

function formatMemoryEntryForPrompt(entry) {
  const row = entry?.memory ?? entry;
  const status = row?.status ?? 'fresh';
  const provenance = row?.provenanceLabel ?? row?.provenanceKind ?? 'inferred';
  const tags = [];
  if (status !== 'fresh') tags.push(status);
  if (provenance !== 'confirmed') tags.push(provenance);
  if (row?.scope === 'restricted' || row?.scope === 'agent_private') {
    tags.push(row.scope);
  }
  const tagSuffix = tags.length > 0 ? ` [${tags.join(' · ')}]` : '';
  const source = row?.displaySource ? ` (source: ${row.displaySource})` : '';
  const rid = row?.id ? ` id=${row.id}` : '';
  const score =
    entry?.retrievalScore != null && typeof entry.retrievalScore === 'number'
      ? ` score=${entry.retrievalScore}`
      : '';
  return `- ${row.key}: ${row.value}${tagSuffix}${source}${rid}${score}`;
}

function applyAnthropicMaxTokensHeadroom(maxTokens) {
  if (!Number.isFinite(maxTokens)) {
    return maxTokens;
  }

  if (maxTokens >= 64000) {
    return maxTokens;
  }

  return Math.ceil((maxTokens * 1.35) / 1000) * 1000;
}

function resolvePolicyOverrideFromAiControls({ policyOverride, taskType, mode, aiControls }) {
  if (policyOverride || taskType || mode !== 'chat') {
    return policyOverride;
  }

  if (aiControls.reasoningTier === 'high') {
    return 'premium_reasoning';
  }

  if (aiControls.reasoningTier === 'cost_saver') {
    return 'low_cost_bulk';
  }

  return policyOverride;
}

function applyPlanExperiencePreferences(plan, aiControls) {
  if (!plan) {
    return plan;
  }

  const fallbackChain = reorderFallbackChain(plan.fallbackChain ?? [], aiControls.failoverOrder ?? []);

  return {
    ...plan,
    fallbackChain,
    selectionDetails: {
      ...(plan.selectionDetails ?? {}),
      customerControls: {
        providerPreference: aiControls.providerPreference,
        reasoningTier: aiControls.reasoningTier,
        fastLane: aiControls.fastLane,
        failoverOrder: aiControls.failoverOrder,
        experimentationEnabled: aiControls.experimentationEnabled,
      },
    },
  };
}

function reorderFallbackChain(fallbackChain, failoverOrder) {
  if (!Array.isArray(fallbackChain) || fallbackChain.length <= 1 || !Array.isArray(failoverOrder) || failoverOrder.length === 0) {
    return fallbackChain;
  }

  const providerPriority = new Map(failoverOrder.map((provider, index) => [provider, index]));

  return [...fallbackChain].sort((left, right) => {
    const leftRank = providerPriority.has(left.provider) ? providerPriority.get(left.provider) : Number.MAX_SAFE_INTEGER;
    const rightRank = providerPriority.has(right.provider) ? providerPriority.get(right.provider) : Number.MAX_SAFE_INTEGER;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return 0;
  });
}

export async function* streamAgentResponse({
  agentId,
  orgId,
  orgPlan = 'free',
  orgMetadata = {},
  userId = null,
  conversationId = null,
  workflowRunId = null,
  taskType = null,
  policyOverride = null,
  providerOverride = null,
  messages = [],
  userMessage,
  useLore = true,
  useMemory = true,
  preferences = {},
  model,
  attachments = [],
  mode = 'chat',
}) {
  const agent = getAgent(agentId);

  if (!agent) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  const contract = getRuntimeAgentContract(agent.id);
  const systemPrompt = await buildSystemPrompt({
    agent,
    contract,
    orgId,
    userId,
    conversationId,
    workflowRunId,
    userMessage,
    useLore,
    useMemory,
    preferences,
  });
  const trimmedMessages = trimHistory(messages);
  const maxTokens = getResponseTokenLimit(preferences.responseLength, agent);
  const aiControls = normalizeOrgAiControls(orgMetadata);
  const effectivePolicyOverride = resolvePolicyOverrideFromAiControls({
    policyOverride,
    taskType,
    mode,
    aiControls,
  });
  const orgModelOverrides = mergeOrgModelOverrides(
    getOrgModelPolicyOverrides(orgId),
    buildModelOverridesFromAiControls(aiControls),
  );
  let plan = selectExecutionPlanWithPolicy({
    agent,
    agentContract: contract,
    userMessage,
    mode: 'chat',
    preferredModel: model,
    orgId,
    orgPlan,
    attachments,
    taskType,
    policyOverride: effectivePolicyOverride,
    providerOverride,
    orgModelOverrides,
    routingHints: {
      responseLength: preferences.responseLength ?? null,
      toolHeavy: useLore || useMemory,
      customInstructions: Boolean(preferences.customInstructions?.trim()),
      multimodal: attachments.length > 0,
      preferredProvider: aiControls.providerPreference,
      reasoningTier: aiControls.reasoningTier,
      experimentationEnabled: aiControls.experimentationEnabled,
    },
  });

  // Apply per-org budget cap (policy allowlist + token cap)
  const budgetCap = getOrgBudgetCap(orgId, orgModelOverrides);
  const { plan: cappedPlan, maxTokensCap } = applyOrgBudgetCap(
    plan,
    budgetCap,
    ANTHROPIC_MODELS,
    OPENAI_MODELS,
  );
  plan = applyPlanExperiencePreferences(cappedPlan, aiControls);
  const effectiveMaxTokens = maxTokensCap ? Math.min(maxTokens, maxTokensCap) : maxTokens;

  let fallbackUsed = false;

  while (plan) {
    try {
      const toolsUsed = collectToolsUsed(systemPrompt.toolsUsed, attachments);
      const toolValidation = validateContractToolUsage(agentId, toolsUsed);

      if (contract?.strictRuntime && !toolValidation.valid) {
        const error = new Error(toolValidation.violations.map((violation) => violation.message).join(' '));
        error.code = 'CONTRACT_TOOL_VIOLATION';
        error.status = 403;
        error.toolValidation = toolValidation;
        throw error;
      }

      const strictStructuredMode = Boolean(contract?.strictRuntime && agentRequiresSchemaValidation(agentId));

      if (strictStructuredMode) {
        const response = await runStructuredResponseWithRepair({
          agentId,
          agent,
          contract,
          plan,
          systemPrompt,
          messages: trimmedMessages,
          userMessage,
          maxTokens: effectiveMaxTokens,
          attachments,
        });

        yield { type: 'text', chunk: sanitizeAgentOutputText(response.text) };
        yield {
          type: 'done',
          totalTokens: response.totalTokens,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          loreChunkIds: systemPrompt.loreChunkIds,
          sources: response.sources ?? systemPrompt.sources,
          model: response.model,
          provider: response.provider,
          route: response.route,
          routeReason: response.routeReason,
          policyKey: plan.policyKey,
          toolsUsed,
          loreDocumentIds: systemPrompt.loreDocumentIds,
          memoryReadIds: systemPrompt.memoryReadIds,
          fallbackUsed,
          conversationId,
          selectionDetails: {
            ...(plan.selectionDetails ?? {}),
            contract: buildRuntimeContractSummary(agentId),
            schemaRepair: response.schemaRepair ?? null,
            retrievalDecision: systemPrompt.retrievalDecision ?? null,
            memorySummary: systemPrompt.memorySummary ?? null,
            usedMemories: systemPrompt.usedMemoriesClient ?? [],
          },
          usedMemories: systemPrompt.usedMemoriesClient ?? [],
          schemaValidation: response.schemaValidation,
          geminiGrounding: response.geminiGrounding ?? null,
        };
        return;
      }

      const generator = plan.provider === 'openai'
        ? streamOpenAIResponse({
            plan,
            systemPrompt,
            messages: trimmedMessages,
            userMessage,
            maxTokens: effectiveMaxTokens,
            attachments,
          })
        : plan.provider === 'google'
          ? streamGeminiResponse({
              plan,
              contract,
              systemPrompt,
              messages: trimmedMessages,
              userMessage,
              maxTokens: effectiveMaxTokens,
            })
          : streamAnthropicResponse({
              plan,
              agent,
              systemPrompt,
              messages: trimmedMessages,
              userMessage,
              maxTokens: effectiveMaxTokens,
              attachments,
            });

      const needsValidation = agentRequiresSchemaValidation(agentId);
      let accumulatedText = '';
      let emittedDone = false;

      for await (const event of generator) {
        if (event.type === 'text') {
          const sanitizedChunk = sanitizeAgentOutputText(event.chunk);
          if (needsValidation) {
            accumulatedText += sanitizedChunk;
          }
          yield { ...event, chunk: sanitizedChunk };
          continue;
        }

        if (event.type === 'done') {
          let schemaValidation = null;
          if (needsValidation && accumulatedText) {
            schemaValidation = validateAgentOutput(agentId, accumulatedText);
            if (schemaValidation.verdict === 'failed') {
              console.warn(
                `[LLM] Schema validation failed for agent ${agentId} (${contract?.outputSchemaId ?? contract?.outputSchema ?? 'unknown'}):`,
                schemaValidation.errors.slice(0, 3).join('; '),
              );
            } else if (schemaValidation.verdict === 'repaired') {
              console.info(`[LLM] Schema auto-repaired for agent ${agentId}: ${schemaValidation.repairNotes}`);
            }
          }

          yield {
            ...event,
            policyKey: plan.policyKey,
            toolsUsed,
            loreDocumentIds: systemPrompt.loreDocumentIds,
            memoryReadIds: systemPrompt.memoryReadIds,
            fallbackUsed,
            conversationId,
            selectionDetails: {
              ...(plan.selectionDetails ?? {}),
              contract: buildRuntimeContractSummary(agentId),
              toolValidation,
              retrievalDecision: systemPrompt.retrievalDecision ?? null,
              memorySummary: systemPrompt.memorySummary ?? null,
              usedMemories: systemPrompt.usedMemoriesClient ?? [],
            },
            usedMemories: systemPrompt.usedMemoriesClient ?? [],
            schemaValidation,
            repairedText:
              schemaValidation?.verdict === 'repaired'
                ? sanitizeAgentOutputText(formatStructuredOutput(schemaValidation.parsed))
                : null,
          };
          emittedDone = true;
          return;
        }
      }

      if (!emittedDone) {
        const streamError = new Error('The model stream ended before a completion event was received.');
        streamError.code = 'LLM_STREAM_INCOMPLETE';
        streamError.status = 502;
        throw streamError;
      }

      return;
    } catch (error) {
      const normalizedError = normalizeLLMError(error, plan.provider);
      const nextPlan = getPolicyFallbackPlan(plan);

      if (nextPlan && shouldFallbackToSecondaryModel(normalizedError) && isPlanUsable(nextPlan)) {
        fallbackUsed = true;
        plan = nextPlan;
        continue;
      }

      normalizedError.llmMeta = {
        orgId,
        userId,
        conversationId,
        agentId,
        provider: plan.provider,
        model: plan.model,
        policyKey: plan.policyKey,
        route: plan.route,
        routeReason: plan.reason,
        toolsUsed: collectToolsUsed(systemPrompt.toolsUsed, attachments),
        sources: systemPrompt.sources,
        loreChunkIds: systemPrompt.loreChunkIds,
        loreDocumentIds: systemPrompt.loreDocumentIds,
        memoryReadIds: systemPrompt.memoryReadIds,
        fallbackUsed,
        selectionDetails: {
          ...(plan.selectionDetails ?? {}),
          ...(error.toolValidation ? { toolValidation: error.toolValidation } : {}),
        },
      };
      throw normalizedError;
    }
  }
}

export async function runAgentNode({ agentId, orgId, orgPlan = 'free', prompt, context = {}, model }) {
  const agent = getAgent(agentId);

  if (!agent) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  const contract = getRuntimeAgentContract(agent.id);
  const userMessage = buildWorkflowPrompt(prompt, context);
  const systemPrompt = await buildSystemPrompt({
    agent,
    contract,
    orgId,
    userId: null,
    workflowRunId: context.__workflowRunId ?? null,
    userMessage,
    useLore: true,
    useMemory: false,
  });
  const aiControls = normalizeOrgAiControls(context.__orgMetadata ?? {});
  const effectivePolicyOverride = resolvePolicyOverrideFromAiControls({
    policyOverride: null,
    taskType: contract?.modelPolicy?.defaultPolicy ?? 'workflow_automation',
    mode: 'workflow',
    aiControls,
  });
  const orgModelOverrides = mergeOrgModelOverrides(
    getOrgModelPolicyOverrides(orgId),
    buildModelOverridesFromAiControls(aiControls),
  );
  let plan = selectExecutionPlanWithPolicy({
    agent,
    agentContract: contract,
    userMessage,
    mode: 'workflow',
    preferredModel: model,
    orgId,
    orgPlan,
    attachments: [],
    taskType: contract?.modelPolicy?.defaultPolicy ?? 'workflow_automation',
    policyOverride: effectivePolicyOverride,
    orgModelOverrides,
    routingHints: {
      workflowNodeCount: Number(context.__workflowNodeCount ?? 0) || null,
      contextKeys: Object.keys(context ?? {}).length,
      toolHeavy: true,
      preferredProvider: aiControls.providerPreference,
      reasoningTier: aiControls.reasoningTier,
      experimentationEnabled: aiControls.experimentationEnabled,
    },
  });
  const budgetCap = getOrgBudgetCap(orgId, orgModelOverrides);
  const capped = applyOrgBudgetCap(plan, budgetCap, ANTHROPIC_MODELS, OPENAI_MODELS);
  plan = applyPlanExperiencePreferences(capped.plan, aiControls);
  let fallbackUsed = false;

  while (plan) {
    try {
      const strictStructuredMode = Boolean(contract?.strictRuntime && agentRequiresSchemaValidation(agentId));
      const response = strictStructuredMode
        ? await runStructuredResponseWithRepair({
            agentId,
            agent,
            contract,
            plan,
            systemPrompt,
            messages: [],
            userMessage,
            maxTokens: MAX_RESPONSE_TOKENS,
            attachments: [],
          })
        : await runProviderResponse({
            plan,
            agent,
            contract,
            systemPrompt,
            messages: [],
            userMessage,
            maxTokens: MAX_RESPONSE_TOKENS,
            attachments: [],
          });

      const toolsUsed = collectToolsUsed(systemPrompt.toolsUsed, []);
      const toolValidation = validateContractToolUsage(agentId, toolsUsed);

      if (contract?.strictRuntime && !toolValidation.valid) {
        const error = new Error(toolValidation.violations.map((violation) => violation.message).join(' '));
        error.code = 'CONTRACT_TOOL_VIOLATION';
        error.status = 403;
        error.toolValidation = toolValidation;
        throw error;
      }

      return {
        ...response,
        text: sanitizeAgentOutputText(response.text),
        trace: {
          policyKey: plan.policyKey,
          toolsUsed,
          loreChunkIds: systemPrompt.loreChunkIds,
          loreDocumentIds: systemPrompt.loreDocumentIds,
          memoryReadIds: systemPrompt.memoryReadIds,
          fallbackUsed,
          selectionDetails: {
            ...(plan.selectionDetails ?? {}),
            contract: buildRuntimeContractSummary(agentId),
            toolValidation,
            schemaRepair: response.schemaRepair ?? null,
            retrievalDecision: systemPrompt.retrievalDecision ?? null,
            memorySummary: systemPrompt.memorySummary ?? null,
            usedMemories: systemPrompt.usedMemoriesClient ?? [],
          },
          schemaValidation: response.schemaValidation ?? null,
        },
      };
    } catch (error) {
      const normalizedError = normalizeLLMError(error, plan.provider);
      const nextPlan = getPolicyFallbackPlan(plan);

      if (nextPlan && shouldFallbackToSecondaryModel(normalizedError) && isPlanUsable(nextPlan)) {
        fallbackUsed = true;
        plan = nextPlan;
        continue;
      }

      normalizedError.llmMeta = {
        orgId,
        userId: null,
        conversationId: null,
        workflowRunId: null,
        agentId,
        provider: plan.provider,
        model: plan.model,
        policyKey: plan.policyKey,
        route: plan.route,
        routeReason: plan.reason,
        toolsUsed: collectToolsUsed(systemPrompt.toolsUsed, []),
        sources: systemPrompt.sources,
        loreChunkIds: systemPrompt.loreChunkIds,
        loreDocumentIds: systemPrompt.loreDocumentIds,
        memoryReadIds: systemPrompt.memoryReadIds,
        fallbackUsed,
        selectionDetails: {
          ...(plan.selectionDetails ?? {}),
          ...(error.toolValidation ? { toolValidation: error.toolValidation } : {}),
        },
      };
      throw normalizedError;
    }
  }
}

function buildAnthropicUserContent(userMessage, attachments = []) {
  const parts = [];
  for (const a of attachments) {
    if (a.mediaType.startsWith('image/')) {
      parts.push({ type: 'image', source: { type: 'base64', media_type: a.mediaType, data: a.base64 } });
    } else if (a.mediaType === 'application/pdf') {
      parts.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.base64 } });
    }
  }
  parts.push({ type: 'text', text: userMessage });
  return parts.length === 1 ? userMessage : parts;
}

async function runProviderResponse({
  plan,
  agent,
  contract,
  systemPrompt,
  messages,
  userMessage,
  maxTokens,
  attachments = [],
}) {
  if (plan.provider === 'openai') {
    return sanitizeProviderResponse(await runOpenAIResponse({
      plan,
      systemPrompt,
      messages,
      userMessage,
      maxTokens,
      attachments,
    }));
  }

  if (plan.provider === 'google') {
    return sanitizeProviderResponse(await runGeminiResponse({
      plan,
      contract,
      systemPrompt,
      messages,
      userMessage,
      maxTokens,
    }));
  }

  return sanitizeProviderResponse(await runAnthropicResponse({
    plan,
    agent,
    systemPrompt,
    messages,
    userMessage,
    maxTokens,
    attachments,
  }));
}

async function runStructuredResponseWithRepair({
  agentId,
  agent,
  contract,
  plan,
  systemPrompt,
  messages,
  userMessage,
  maxTokens,
  attachments = [],
}) {
  const attempts = [];
  const schemaLabel = contract?.outputSchemaId ?? contract?.outputSchema ?? 'structured output';

  const initialResponse = await runProviderResponse({
    plan,
    agent,
    contract,
    systemPrompt,
    messages,
    userMessage,
    maxTokens,
    attachments,
  });
  attempts.push({ stage: 'initial', text: initialResponse.text });

  let validation = validateAgentOutput(agentId, initialResponse.text ?? '');
  if (validation.verdict !== 'failed') {
    return {
      ...initialResponse,
      text: sanitizeAgentOutputText(validation.verdict === 'repaired' ? formatStructuredOutput(validation.parsed) : initialResponse.text),
      schemaValidation: validation,
      schemaRepair: {
        stage: 'initial',
        attempts: 1,
      },
    };
  }

  const retryResponse = await runProviderResponse({
    plan,
    agent,
    contract,
    systemPrompt: {
      ...systemPrompt,
      text: `${systemPrompt.text}\n\nReturn ONLY a valid JSON object that satisfies ${schemaLabel}. Do not add commentary outside the JSON.`,
    },
    messages,
    userMessage,
    maxTokens,
    attachments,
  });
  attempts.push({ stage: 'retry', text: retryResponse.text });

  validation = validateAgentOutput(agentId, retryResponse.text ?? '');
  if (validation.verdict !== 'failed') {
    return {
      ...retryResponse,
      text: sanitizeAgentOutputText(validation.verdict === 'repaired' ? formatStructuredOutput(validation.parsed) : retryResponse.text),
      schemaValidation: validation,
      schemaRepair: {
        stage: 'retry',
        attempts: 2,
      },
    };
  }

  const repairResponse = await runProviderResponse({
    plan,
    agent,
    contract,
    systemPrompt,
    messages: [],
    userMessage: buildSchemaRepairPrompt({
      agentId,
      responseText: retryResponse.text ?? initialResponse.text ?? '',
      validation,
    }),
    maxTokens,
    attachments: [],
  });
  attempts.push({ stage: 'repair', text: repairResponse.text });

  validation = validateAgentOutput(agentId, repairResponse.text ?? '');
  if (validation.verdict === 'failed') {
    const error = createSchemaValidationError(agentId, validation, 'repair');
    error.llmMeta = {
      provider: repairResponse.provider ?? plan.provider,
      model: repairResponse.model ?? plan.model,
      policyKey: plan.policyKey,
      route: plan.route,
      routeReason: plan.reason,
      selectionDetails: {
        ...(plan.selectionDetails ?? {}),
        contract: buildRuntimeContractSummary(agentId),
        schemaRepair: {
          stage: 'repair',
          attempts: attempts.length,
        },
      },
      schemaValidation: validation,
    };
    throw error;
  }

  return {
    ...repairResponse,
    text: sanitizeAgentOutputText(validation.verdict === 'repaired' ? formatStructuredOutput(validation.parsed) : repairResponse.text),
    schemaValidation: validation,
    schemaRepair: {
      stage: 'repair',
      attempts: attempts.length,
    },
  };
}

async function* streamAnthropicResponse({ plan, agent, systemPrompt, messages, userMessage, maxTokens, attachments = [] }) {
  const client = getAnthropicClient();

  const useThinking = agent?.useExtendedThinking === true && ANTHROPIC_MODELS.opus === plan.model;
  const thinkingBudget = agent?.thinkingBudgetTokens ?? 8000;
  const thinkingEffort = thinkingBudget < 4000 ? 'medium' : 'high';
  // max_tokens must exceed the thinking budget; bump if needed
  const effectiveMaxTokens = useThinking ? Math.max(maxTokens, thinkingBudget + 1000) : maxTokens;
  const anthropicMaxTokens = applyAnthropicMaxTokensHeadroom(effectiveMaxTokens);

  const streamParams = {
    model: plan.model,
    max_tokens: anthropicMaxTokens,
    system: systemPrompt.text,
    messages: [...messages, { role: 'user', content: buildAnthropicUserContent(userMessage, attachments) }],
  };

  if (useThinking) {
    streamParams.thinking = { type: 'adaptive' };
    streamParams.output_config = { effort: thinkingEffort };
  }

  const stream = client.messages.stream(streamParams);

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield { type: 'text', chunk: event.delta.text };
    }
    // Thinking deltas are intentionally not forwarded to the client
  }

  const finalMessage = await stream.finalMessage();

  yield {
    type: 'done',
    totalTokens: (finalMessage.usage?.input_tokens ?? 0) + (finalMessage.usage?.output_tokens ?? 0),
    inputTokens: finalMessage.usage?.input_tokens ?? 0,
    outputTokens: finalMessage.usage?.output_tokens ?? 0,
    loreChunkIds: systemPrompt.loreChunkIds,
    sources: systemPrompt.sources,
    model: finalMessage.model ?? plan.model,
    provider: 'anthropic',
    route: plan.route,
    routeReason: plan.reason,
  };
}

async function* streamOpenAIResponse({ plan, systemPrompt, messages, userMessage, maxTokens, attachments = [] }) {
  const client = getOpenAIClient();
  const imageAttachments = attachments.filter((a) => a.mediaType.startsWith('image/'));
  if (attachments.some((a) => a.mediaType === 'application/pdf')) {
    throw Object.assign(
      new Error('PDF attachments are not supported with the current model routing. Try uploading to LORE instead.'),
      { userFacing: true },
    );
  }
  const stream = client.responses.stream({
    model: plan.model,
    instructions: systemPrompt.text,
    input: buildOpenAIInput(messages, userMessage, imageAttachments),
    max_output_tokens: maxTokens,
  });

  for await (const event of stream) {
    if (event.type === 'response.output_text.delta') {
      yield { type: 'text', chunk: event.delta };
    }
  }

  const response = await stream.finalResponse();

  yield {
    type: 'done',
    totalTokens:
      response.usage?.total_tokens ??
      (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    loreChunkIds: systemPrompt.loreChunkIds,
    sources: systemPrompt.sources,
    model: response.model ?? plan.model,
    provider: 'openai',
    route: plan.route,
    routeReason: plan.reason,
  };
}

/**
 * Decide whether to attach Gemini's google_search_retrieval tool.
 * Enabled when the agent contract allows live_web_research or runs on the
 * grounded_research policy, AND the routed model supports search grounding.
 */
function shouldUseGeminiGrounding(plan, contract) {
  if (process.env.GEMINI_GROUNDING_ENABLED !== 'true') return false;
  if (!plan?.model || !plan.model.startsWith('gemini-')) return false;
  // Search-grounded responses are only supported on Gemini 2.x text models.
  // (Lite variants do not support grounding in current SDK.)
  if (plan.model.includes('-lite')) return false;
  if (!contract) return false;
  const policy = contract?.modelPolicy?.defaultPolicy ?? null;
  const allowsLiveWeb = Array.isArray(contract.allowedTools)
    && contract.allowedTools.includes('live_web_research');
  const isResearchPolicy = policy === 'grounded_research';
  return allowsLiveWeb || isResearchPolicy;
}

function buildGeminiGroundingTools(plan) {
  // Gemini 2.x exposes the tool under googleSearchRetrieval; older keys remain
  // accepted for backwards-compat. We pass both shapes guarded by version.
  if (plan.model.startsWith('gemini-2.5')) {
    return [{ googleSearch: {} }];
  }
  return [{ googleSearchRetrieval: {} }];
}

function extractGeminiGroundingMetadata(response) {
  const candidates = response?.candidates ?? [];
  const meta = candidates[0]?.groundingMetadata ?? candidates[0]?.grounding_metadata ?? null;
  if (!meta) return null;
  const chunks = meta.groundingChunks ?? meta.grounding_chunks ?? [];
  const supports = meta.groundingSupports ?? meta.grounding_supports ?? [];
  const queries = meta.webSearchQueries ?? meta.web_search_queries ?? [];
  const renderedContent = meta.searchEntryPoint?.renderedContent ?? meta.search_entry_point?.rendered_content ?? null;
  const webSources = chunks
    .map((chunk) => chunk?.web ?? null)
    .filter(Boolean)
    .map((web, index) => ({
      id: `gemini-grounding-${index + 1}`,
      documentId: null,
      documentTitle: web.title ?? web.uri ?? 'Web result',
      sourceType: 'web',
      sourceUrl: web.uri ?? web.url ?? null,
      similarity: null,
      mode: 'gemini_grounding',
      fetchedVia: 'gemini',
      summary: '',
      snippet: '',
    }));
  return {
    supportCount: Array.isArray(supports) ? supports.length : 0,
    queries,
    chunkCount: chunks.length,
    renderedContent,
    webSources,
  };
}

async function* streamGeminiResponse({ plan, contract, systemPrompt, messages, userMessage, maxTokens }) {
  const client = getGeminiClient();
  const useGrounding = shouldUseGeminiGrounding(plan, contract);
  let response = null;
  let streamedText = '';

  for await (const event of client.streamText({
    model: plan.model,
    systemInstruction: systemPrompt.text,
    messages,
    userMessage,
    maxOutputTokens: maxTokens,
    tools: useGrounding ? buildGeminiGroundingTools(plan) : [],
  })) {
    if (event.type === 'text') {
      streamedText += event.text;
      yield { type: 'text', chunk: event.text };
    }

    if (event.type === 'done') {
      response = event.response;
    }
  }

  if (!String(streamedText ?? '').trim()) {
    const error = new Error('Google AI returned an empty response. Please try again.');
    error.code = 'GEMINI_EMPTY_RESPONSE';
    error.status = 502;
    throw error;
  }

  const grounding = useGrounding ? extractGeminiGroundingMetadata(response) : null;
  const mergedSources = grounding?.webSources?.length
    ? [...systemPrompt.sources, ...grounding.webSources]
    : systemPrompt.sources;

  yield {
    type: 'done',
    totalTokens: (response?.usageMetadata?.promptTokenCount ?? 0) + (response?.usageMetadata?.candidatesTokenCount ?? 0),
    inputTokens: response?.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response?.usageMetadata?.candidatesTokenCount ?? 0,
    loreChunkIds: systemPrompt.loreChunkIds,
    sources: mergedSources,
    model: plan.model,
    provider: 'google',
    route: plan.route,
    routeReason: plan.reason,
    geminiGrounding: grounding
      ? {
          enabled: true,
          chunkCount: grounding.chunkCount,
          supportCount: grounding.supportCount,
          queries: grounding.queries,
          renderedContent: grounding.renderedContent,
        }
      : (useGrounding ? { enabled: true, chunkCount: 0, supportCount: 0, queries: [] } : null),
  };
}

async function runGeminiResponse({ plan, contract, systemPrompt, messages, userMessage, maxTokens }) {
  const client = getGeminiClient();
  const useGrounding = shouldUseGeminiGrounding(plan, contract);
  const result = await client.generateText({
    model: plan.model,
    systemInstruction: systemPrompt.text,
    messages,
    userMessage,
    maxOutputTokens: maxTokens,
    tools: useGrounding ? buildGeminiGroundingTools(plan) : [],
  });

  const text = result.text;

  if (!String(text ?? '').trim()) {
    const error = new Error('Google AI returned an empty response. Please try again.');
    error.code = 'GEMINI_EMPTY_RESPONSE';
    error.status = 502;
    throw error;
  }

  const grounding = useGrounding ? extractGeminiGroundingMetadata(result.response) : null;
  const mergedSources = grounding?.webSources?.length
    ? [...systemPrompt.sources, ...grounding.webSources]
    : systemPrompt.sources;

  return {
    text,
    model: plan.model,
    provider: 'google',
    route: plan.route,
    routeReason: plan.reason,
    totalTokens: (result.response?.usageMetadata?.promptTokenCount ?? 0) + (result.response?.usageMetadata?.candidatesTokenCount ?? 0),
    inputTokens: result.response?.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: result.response?.usageMetadata?.candidatesTokenCount ?? 0,
    sources: mergedSources,
    geminiGrounding: grounding
      ? {
          enabled: true,
          chunkCount: grounding.chunkCount,
          supportCount: grounding.supportCount,
          queries: grounding.queries,
        }
      : (useGrounding ? { enabled: true, chunkCount: 0, supportCount: 0, queries: [] } : null),
  };
}

async function runAnthropicResponse({ plan, agent, systemPrompt, messages, userMessage, maxTokens, attachments = [] }) {
  const client = getAnthropicClient();
  const useThinking = agent?.useExtendedThinking === true && ANTHROPIC_MODELS.opus === plan.model;
  const thinkingBudget = agent?.thinkingBudgetTokens ?? 8000;
  const thinkingEffort = thinkingBudget < 4000 ? 'medium' : 'high';
  const effectiveMaxTokens = useThinking ? Math.max(maxTokens, thinkingBudget + 1000) : maxTokens;
  const anthropicMaxTokens = applyAnthropicMaxTokensHeadroom(effectiveMaxTokens);
  const response = await client.messages.create({
    model: plan.model,
    max_tokens: anthropicMaxTokens,
    system: systemPrompt.text,
    messages: [...messages, { role: 'user', content: buildAnthropicUserContent(userMessage, attachments) }],
    ...(useThinking
      ? {
          thinking: { type: 'adaptive' },
          output_config: { effort: thinkingEffort },
        }
      : {}),
  });

  const text = response.content
    ?.filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!text) {
    const error = new Error('Anthropic returned an empty response. Please try again.');
    error.code = 'LLM_EMPTY_RESPONSE';
    error.status = 502;
    throw error;
  }

  return {
    text,
    model: response.model ?? plan.model,
    provider: 'anthropic',
    route: plan.route,
    routeReason: plan.reason,
    totalTokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    sources: systemPrompt.sources,
  };
}

async function runOpenAIResponse({ plan, systemPrompt, messages, userMessage, maxTokens, attachments = [] }) {
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: plan.model,
    instructions: systemPrompt.text,
    input: buildOpenAIInput(messages, userMessage, attachments.filter((attachment) => attachment.mediaType.startsWith('image/'))),
    max_output_tokens: maxTokens,
  });

  const text = extractOpenAIOutputText(response);

  if (!String(text ?? '').trim()) {
    const error = new Error('OpenAI returned an empty response. Please try again.');
    error.code = 'OPENAI_EMPTY_RESPONSE';
    error.status = 502;
    throw error;
  }

  return {
    text,
    model: response.model ?? plan.model,
    provider: 'openai',
    route: plan.route,
    routeReason: plan.reason,
    totalTokens:
      response.usage?.total_tokens ??
      (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    sources: systemPrompt.sources,
  };
}

async function buildSystemPrompt({
  agent,
  contract = getRuntimeAgentContract(agent.id),
  orgId,
  userId = null,
  conversationId = null,
  workflowRunId = null,
  userMessage,
  useLore,
  useMemory,
  preferences = {},
}) {
  const sections = [
    agent.systemPrompt,
    'You may receive LIVE WEB CONTEXT for public URLs or search results. When that context is present, use it confidently and cite the source title or URL. Never say you cannot browse the web if LIVE WEB CONTEXT is available. If live fetching fails, explain that failure plainly.',
    NO_EM_DASH_OUTPUT_RULE,
  ];
  const sources = [];
  const loreChunkIds = [];
  const loreDocumentIds = new Set();
  const memoryReadIds = [];
  let usedMemoriesClient = [];
  const toolsUsed = new Set();

  if (userMessage) {
    try {
      const canUseLiveWeb = contract?.allowedTools?.includes('live_web_research');
      const webSources = canUseLiveWeb ? await fetchLiveWebContext(userMessage) : [];

      if (webSources.length > 0) {
        toolsUsed.add('live_web_research');
        sources.push(
          ...webSources.map((source, index) => ({
            id: `web-${index + 1}`,
            documentId: null,
            documentTitle: source.title,
            sourceType: 'web',
            sourceUrl: source.url,
            similarity: null,
            error: source.error ?? null,
            mode: source.mode ?? 'direct',
            fetchedVia: source.fetchedVia ?? 'fetch',
            snippet: source.snippet ?? '',
            summary: source.summary ?? '',
            screenshotUrl: source.screenshotUrl ?? null,
            followedLinks: source.followedLinks ?? [],
          })),
        );

        sections.push(
          [
            'LIVE WEB CONTEXT',
            webSources
              .map((source, index) => {
                if (source.error) {
                  return `[WEB ${index + 1}] ${source.url}\nStatus: ${source.error}`;
                }

                const searchMeta =
                  source.mode === 'search'
                    ? `Search result: ${source.searchTitle ?? source.title}${source.searchSnippet ? `\nSnippet: ${source.searchSnippet}` : ''}\n`
                    : '';

                return `[WEB ${index + 1}] ${source.title}\n${searchMeta}URL: ${source.url}\n${source.summary}`;
              })
              .join('\n\n'),
            'Use live web context only when it directly helps answer the user request. Cite the source URL or title when relying on it. If a fetch failed, say that plainly instead of pretending you checked it. If search results are included, treat them as fresh web research.',
          ].join('\n\n'),
        );
      }
    } catch (error) {
      console.warn('[LLM] Skipping live web context:', error.message);
    }
  }

  let retrievalDecision = null;
  let memorySummary = null;
  if (useLore && orgId && userMessage && contract?.allowedTools?.includes('lore_search')) {
    try {
      const budget = getRetrievalBudgetForAgent(agent.id, contract);
      const fetchedChunks = await ragSearch({
        orgId,
        query: userMessage,
        limit: budget.hardCap,
        includeWeakMatches: true,
      });

      const { selected, confidentCount, expanded } = selectAdaptiveChunks(fetchedChunks, budget);
      const loreChunks = selected;

      retrievalDecision = {
        agentId: agent.id,
        baseLimit: budget.baseLimit,
        hardCap: budget.hardCap,
        research: budget.research,
        fetchedCount: fetchedChunks.length,
        selectedCount: loreChunks.length,
        confidentCount,
        expanded,
        confidenceFloor: RETRIEVAL_HIGH_CONFIDENCE_FLOOR,
      };

      if (loreChunks.length > 0) {
        toolsUsed.add('lore_search');
        sources.push(
          ...loreChunks.map((chunk) => ({
            id: chunk.id,
            documentId: chunk.documentId,
            documentTitle: chunk.documentTitle,
            sourceType: chunk.sourceType,
            sourceUrl: chunk.sourceUrl,
            similarity: chunk.similarity,
            finalScore: chunk.finalScore,
            freshnessScore: chunk.freshnessScore,
            authorityScore: chunk.authorityScore,
            confidenceLabel: chunk.confidenceLabel,
            staleWarning: chunk.staleWarning ?? null,
            contradictionSignals: chunk.contradictionSignals ?? [],
            versionLineage: chunk.versionLineage ?? null,
            citation: chunk.citation ?? null,
          })),
        );
        loreChunkIds.push(...loreChunks.map((chunk) => chunk.id));
        loreChunks.forEach((chunk) => {
          if (chunk.documentId) {
            loreDocumentIds.add(chunk.documentId);
          }
        });
        sections.push(
          [
            'LORE CONTEXT',
            loreChunks
              .map(
                (chunk, index) =>
                  `[${index + 1}] ${chunk.documentTitle} (${chunk.sourceType})\n${chunk.content}`,
              )
              .join('\n\n'),
            'Use this retrieved knowledge when it is relevant, and cite the source title when you rely on it.',
          ].join('\n\n'),
        );
      }
    } catch (error) {
      console.warn('[LLM] Skipping LORE context:', error.message);
    }
  }

  if (useMemory && orgId && (contract?.allowedTools?.includes('memory_read') || (contract?.memoryReadScopes?.length ?? 0) > 0)) {
    const envelopes = await retrieveRankedMemories({
      orgId,
      userId,
      agentId: agent.id,
      workflowRunId,
      sessionKey: conversationId ? `conversation:${conversationId}` : null,
      userMessage,
      conversationId,
      contract,
      traceRecord: true,
    });

    const memory = envelopes.map((e) => ({
      ...e.memory,
      retrievalScore: e.retrievalScore,
      selectedBecause: e.selectedBecause,
      matchedBy: e.matchedBy,
      tokenEstimate: e.tokenEstimate,
      decayFactor: e.decayFactor,
      decayReason: e.decayReason,
      effectiveScore: e.effectiveScore,
    }));

    usedMemoriesClient = buildMemoryClientPreview(envelopes, { agentId: agent.id });

    if (envelopes.length > 0) {
      toolsUsed.add('memory_read');
      memoryReadIds.push(...memory.map((entry) => entry.id));
      memorySummary = {
        totalEntries: memory.length,
        scopeBreakdown: memory.reduce((acc, entry) => {
          acc[entry.scope] = (acc[entry.scope] ?? 0) + 1;
          return acc;
        }, {}),
        statusBreakdown: memory.reduce((acc, entry) => {
          const status = entry.status ?? 'fresh';
          acc[status] = (acc[status] ?? 0) + 1;
          return acc;
        }, {}),
        provenanceBreakdown: memory.reduce((acc, entry) => {
          const kind = entry.provenanceLabel ?? entry.provenanceKind ?? 'inferred';
          acc[kind] = (acc[kind] ?? 0) + 1;
          return acc;
        }, {}),
        staleEntryKeys: memory
          .filter((entry) => entry.status === 'stale' || entry.status === 'aging')
          .map((entry) => entry.key)
          .slice(0, 10),
        restrictedEntryCount: memory.filter((entry) => entry.scope === 'restricted').length,
        injectionProvenance: envelopes.map((e) => ({
          memoryId: e.memory.id,
          retrievalScore: e.retrievalScore,
          matchedBy: e.matchedBy,
          selectedBecause: e.selectedBecause,
          tokenEstimate: e.tokenEstimate,
        })),
      };
      const memorySections = [
        {
          title: 'Organisation context:',
          rows: envelopes.filter((entry) => entry.memory.scope === 'org'),
        },
        {
          title: 'User preferences:',
          rows: envelopes.filter((entry) => entry.memory.scope === 'user'),
        },
        {
          title: 'Restricted context:',
          rows: envelopes.filter((entry) => entry.memory.scope === 'restricted'),
        },
        {
          title: 'Agent-private context:',
          rows: envelopes.filter((entry) => entry.memory.scope === 'agent_private'),
        },
        {
          title: 'Workflow-run context:',
          rows: envelopes.filter((entry) => entry.memory.scope === 'workflow_run'),
        },
        {
          title: 'Temporary session context:',
          rows: envelopes.filter((entry) => entry.memory.scope === 'temporary_session'),
        },
      ].filter((section) => section.rows.length > 0);

      sections.push(
        ['AGENT MEMORY']
          .concat(
            memorySections.map((section) =>
              [section.title, ...section.rows.map((entry) => formatMemoryEntryForPrompt(entry))].join('\n'),
            ),
          )
          .concat(
            'Treat memory marked [stale] or [aging] as possibly out-of-date and ask the user to confirm before acting on it. Treat [inferred] memory as a best guess; treat [confirmed] as user-validated. Never expose [restricted] or [agent_private] memory contents verbatim to the user — paraphrase or summarise.',
          )
          .join('\n\n'),
      );
    }
  }

  if (orgId) {
    try {
      const patterns = await getSuccessfulPatterns({ orgId, agentId: agent.id, limit: 3 });
      const successPrompt = buildSuccessfulPatternsPrompt(patterns);
      if (successPrompt) {
        toolsUsed.add('lore_feedback');
        sections.push(successPrompt);
      }
    } catch (error) {
      console.warn('[LLM] Skipping LORE feedback patterns:', error.message);
    }
  }

  const responseLength =
    preferences.responseLength === 'short'
      ? 'Keep responses concise and action-focused unless detail is explicitly requested.'
      : preferences.responseLength === 'long'
        ? 'Provide a fuller, more thorough response with structure when it adds clarity.'
        : 'Balance brevity with clarity and provide enough detail to be directly useful.';

  const tone =
    preferences.tone === 'official'
      ? 'Use a polished, executive-ready tone.'
      : preferences.tone === 'casual'
        ? 'Use a warm, conversational tone while staying competent and direct.'
        : 'Use a confident, balanced professional tone.';

  const customInstructions = preferences.customInstructions?.trim();

  if (contract) {
    sections.push(
      [
        'AGENT CONTRACT',
        `Purpose: ${contract.purpose}`,
        `Ideal tasks: ${contract.idealTasks.join(', ')}`,
        `Allowed tools: ${contract.allowedTools.join(', ') || 'none'}`,
        `Blocked tools: ${contract.blockedTools.join(', ') || 'none'}`,
        `Output style: ${contract.outputStyle}`,
        `Structured output expectation: ${contract.structuredOutput}`,
        `Confidence behaviour: ${contract.confidenceBehavior}`,
        `Escalation rules: ${contract.escalationRules.join(' | ') || 'none'}`,
        `Retrieval behaviour: ${contract.retrievalBehavior ?? 'Use grounded context when relevant.'}`,
        `Context budget: ${contract.contextBudget ?? 'medium'}`,
        `Memory reads allowed: ${contract.memoryReadScopes?.join(', ') || 'none'}`,
        `Memory writes allowed: ${contract.memoryWriteScopes?.join(', ') || 'none'}`,
        `Sensitive memory writes allowed: ${contract.memoryPolicy?.sensitiveWrites ? 'yes' : 'no'}`,
        `Preferred model lane: ${contract.modelPolicy?.preferredLane ?? 'default'}`,
        `Preferred policy class: ${contract.preferredPolicyClass ?? contract.modelPolicy?.defaultPolicy ?? 'fast_chat'}`,
        `Eval criteria: ${contract.evalCriteria.join(', ') || 'none'}`,
        'Do not use a tool outside the allowed list unless the user explicitly asks for a high-level explanation of what it would do.',
        'If a task requires a disallowed capability, say so plainly and escalate to a more appropriate agent or a human.',
      ].join('\n'),
    );
  }

  sections.push(
    [
      'CHAT PREFERENCES',
      responseLength,
      tone,
      customInstructions ? `Additional instructions: ${customInstructions}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  );

  sections.push(
    [
      'MODEL ROUTING',
      `Anthropic primary: ${ANTHROPIC_MODELS.primary}`,
      `Anthropic fallback: ${ANTHROPIC_MODELS.fallback}`,
      `OpenAI router: ${OPENAI_MODELS.router}`,
      `OpenAI premium: ${OPENAI_MODELS.premium}`,
      `OpenAI lightweight: ${OPENAI_MODELS.lightweight}`,
      'Choose the model family that best fits the task, but preserve the agent persona, source grounding, and commercial usefulness.',
    ].join('\n'),
  );

  sections.push(`Current date: ${new Date().toISOString().slice(0, 10)}`);

  return {
    text: sections.join('\n\n'),
    sources,
    loreChunkIds,
    loreDocumentIds: [...loreDocumentIds],
    memoryReadIds,
    toolsUsed: [...toolsUsed],
    retrievalDecision,
    memorySummary,
    usedMemoriesClient,
  };
}


function buildOpenAIInput(messages, userMessage, imageAttachments = []) {
  const history = messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join('\n\n');

  const text = history
    ? ['CHAT HISTORY', history, 'LATEST USER MESSAGE', userMessage].join('\n\n')
    : userMessage;

  const contentParts = [{ type: 'input_text', text }];

  for (const img of imageAttachments) {
    contentParts.push({
      type: 'input_image',
      image_url: `data:${img.mediaType};base64,${img.base64}`,
    });
  }

  return [{ role: 'user', content: contentParts }];
}

function extractOpenAIOutputText(response) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const text = (response.output ?? [])
    .flatMap((item) => {
      if (item.type !== 'message') {
        return [];
      }

      return (item.content ?? [])
        .filter((content) => content.type === 'output_text')
        .map((content) => content.text ?? '');
    })
    .join('\n')
    .trim();

  return text;
}

function getResponseTokenLimit(responseLength, agent = null) {
  const agentMax = agent?.maxResponseTokens ?? MAX_RESPONSE_TOKENS;

  if (responseLength === 'short') {
    return Math.min(900, agentMax);
  }

  if (responseLength === 'medium') {
    return Math.min(2200, agentMax);
  }

  return agentMax;
}

function trimHistory(messages) {
  const estimatedTokens = messages.reduce((total, message) => total + estimateTokens(message.content), 0);

  if (estimatedTokens < MAX_CONTEXT_TOKENS * 0.65) {
    return messages;
  }

  const trimmed = [];
  let budget = MAX_CONTEXT_TOKENS * 0.5;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const messageTokens = estimateTokens(message.content);

    if (budget - messageTokens < 0) {
      break;
    }

    budget -= messageTokens;
    trimmed.unshift(message);
  }

  return trimmed;
}

function buildWorkflowPrompt(prompt, context) {
  if (!context || Object.keys(context).length === 0) {
    return prompt;
  }

  const contextBlock = Object.entries(context)
    .map(([key, value]) => `[${key}]\n${value}`)
    .join('\n\n');

  return `${prompt}\n\nWORKFLOW CONTEXT\n\n${contextBlock}`;
}

export function estimateTokens(text) {
  return Math.ceil((text?.length ?? 0) / 4);
}

function collectToolsUsed(baseTools = [], attachments = []) {
  const tools = new Set(baseTools);

  if (attachments.some((attachment) => attachment.mediaType?.startsWith('image/'))) {
    tools.add('vision_input');
  }

  if (attachments.some((attachment) => attachment.mediaType === 'application/pdf')) {
    tools.add('file_input');
  }

  return [...tools];
}

function isPlanUsable(plan) {
  if (!plan) {
    return false;
  }

  if (plan.provider === 'openai') return hasUsableOpenAIKey();
  if (plan.provider === 'google') return hasUsableGeminiKey();
  return hasUsableAnthropicKey();
}

function shouldFallbackToSecondaryModel(error) {
  if (!error) {
    return true;
  }

  if (error.userFacing) {
    return false;
  }

  if (
    typeof error.status === 'number'
    && error.status >= 400
    && error.status < 500
    && ![
      'LLM_NOT_CONFIGURED',
      'LLM_AUTH_INVALID',
      'LLM_MODEL_INVALID',
      'LLM_RATE_LIMITED',
      'OPENAI_NOT_CONFIGURED',
      'OPENAI_AUTH_INVALID',
      'OPENAI_MODEL_INVALID',
      'OPENAI_RATE_LIMITED',
      'GEMINI_NOT_CONFIGURED',
      'GEMINI_AUTH_INVALID',
      'GEMINI_MODEL_NOT_FOUND',
      'GEMINI_RATE_LIMITED',
      'SCHEMA_VALIDATION_FAILED',
    ].includes(error.code)
  ) {
    return false;
  }

  return true;
}

function normalizeLLMError(error, provider = 'anthropic') {
  if (!error) {
    return new Error('Prymal could not generate a response.');
  }

  if (
    [
      'LLM_NOT_CONFIGURED',
      'LLM_AUTH_INVALID',
      'OPENAI_NOT_CONFIGURED',
      'OPENAI_AUTH_INVALID',
    ].includes(error.code)
  ) {
    return error;
  }

  const rawMessage = [error.message, error.error?.message, error.body?.error?.message]
    .filter(Boolean)
    .join(' ');

  const normalized = new Error('Prymal could not generate a response.');
  normalized.status = error.status ?? error.statusCode ?? null;
  normalized.code = error.code ?? 'LLM_REQUEST_FAILED';
  normalized.userFacing = Boolean(error.userFacing);

  if (provider === 'openai') {
    if (/invalid api key|authentication|unauthorized|401/i.test(rawMessage)) {
      normalized.message =
        'OPENAI_API_KEY was rejected by OpenAI. Update backend/.env with a valid key and restart the backend.';
      normalized.code = 'OPENAI_AUTH_INVALID';
      normalized.status = 503;
      return normalized;
    }

    if (/not_found|model .* not found|invalid model/i.test(rawMessage)) {
      normalized.message =
        `The configured OpenAI model is unavailable. Update backend/.env to use a current model such as ${OPENAI_MODELS.analysis}, ${OPENAI_MODELS.router}, or ${OPENAI_MODELS.lightweight}, then restart the backend.`;
      normalized.code = 'OPENAI_MODEL_INVALID';
      normalized.status = 503;
      return normalized;
    }

    if (/rate.?limit|too many requests|429/i.test(rawMessage)) {
      normalized.message = 'OpenAI rate limited the request. Please try again in a moment.';
      normalized.code = 'OPENAI_RATE_LIMITED';
      normalized.status = 429;
      return normalized;
    }

    if (/overloaded|timeout|timed out|temporarily unavailable|5\d\d/i.test(rawMessage)) {
      normalized.message = 'OpenAI is temporarily unavailable. Please try again shortly.';
      normalized.code = 'OPENAI_UNAVAILABLE';
      normalized.status = 503;
      return normalized;
    }
  } else if (provider === 'google') {
    if (/api.?key|invalid.?key|authentication|unauthorized|401/i.test(rawMessage)) {
      normalized.message =
        'GEMINI_API_KEY was rejected by Google. Update backend/.env with a valid key and restart the backend.';
      normalized.code = 'GEMINI_AUTH_INVALID';
      normalized.status = 503;
      return normalized;
    }

    if (/not.?found|model.* not found|invalid model/i.test(rawMessage)) {
      normalized.message =
        `The configured Gemini model is unavailable. Update backend/.env to use a current model such as ${GEMINI_MODELS.flash} or ${GEMINI_MODELS.pro}, then restart the backend.`;
      normalized.code = 'GEMINI_MODEL_NOT_FOUND';
      normalized.status = 503;
      return normalized;
    }

    if (/rate.?limit|quota|too many requests|429/i.test(rawMessage)) {
      normalized.message = 'Google AI rate limited the request. Please try again in a moment.';
      normalized.code = 'GEMINI_RATE_LIMITED';
      normalized.status = 429;
      return normalized;
    }

    if (/safety|blocked|content.?filter/i.test(rawMessage)) {
      normalized.message = 'Google AI blocked this request due to safety policies.';
      normalized.code = 'GEMINI_CONTENT_FILTERED';
      normalized.status = 400;
      return normalized;
    }

    if (/overloaded|timeout|timed out|temporarily unavailable|5\d\d/i.test(rawMessage)) {
      normalized.message = 'Google AI is temporarily unavailable. Please try again shortly.';
      normalized.code = 'GEMINI_UNAVAILABLE';
      normalized.status = 503;
      return normalized;
    }
  } else {
    if (/invalid x-api-key|authentication_error|unauthorized|401/i.test(rawMessage)) {
      normalized.message =
        'ANTHROPIC_API_KEY was rejected by Anthropic. Update backend/.env with a valid key and restart the backend.';
      normalized.code = 'LLM_AUTH_INVALID';
      normalized.status = 503;
      return normalized;
    }

    if (/not_found_error|model:|model .* not found|invalid model/i.test(rawMessage)) {
      normalized.message =
        `The configured Anthropic model is unavailable. Update backend/.env to use a current model such as ${ANTHROPIC_MODELS.primary} or ${ANTHROPIC_MODELS.fallback}, then restart the backend.`;
      normalized.code = 'LLM_MODEL_INVALID';
      normalized.status = 503;
      return normalized;
    }

    if (/rate.?limit|too many requests|429/i.test(rawMessage)) {
      normalized.message = 'Anthropic rate limited the request. Please try again in a moment.';
      normalized.code = 'LLM_RATE_LIMITED';
      normalized.status = 429;
      return normalized;
    }

    if (/overloaded|timeout|timed out|temporarily unavailable|5\d\d/i.test(rawMessage)) {
      normalized.message = 'Anthropic is temporarily unavailable. Please try again shortly.';
      normalized.code = 'LLM_UNAVAILABLE';
      normalized.status = 503;
      return normalized;
    }
  }

  if (rawMessage) {
    normalized.message = rawMessage;
  }

  return normalized;
}

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey) {
    const error = new Error('ANTHROPIC_API_KEY is required for agent responses.');
    error.status = 503;
    error.code = 'LLM_NOT_CONFIGURED';
    throw error;
  }

  if (/xxxx|your_|placeholder/i.test(apiKey) || !apiKey.startsWith('sk-ant-')) {
    const error = new Error(
      'ANTHROPIC_API_KEY in backend/.env is invalid. Add a real Anthropic API key and restart the backend.',
    );
    error.status = 503;
    error.code = 'LLM_AUTH_INVALID';
    throw error;
  }

  return new Anthropic({ apiKey });
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is required for routed OpenAI tasks.');
    error.status = 503;
    error.code = 'OPENAI_NOT_CONFIGURED';
    throw error;
  }

  if (/xxxx|your_|placeholder/i.test(apiKey) || !apiKey.startsWith('sk-')) {
    const error = new Error(
      'OPENAI_API_KEY in backend/.env is invalid. Add a real OpenAI API key and restart the backend.',
    );
    error.status = 503;
    error.code = 'OPENAI_AUTH_INVALID';
    throw error;
  }

  return new OpenAI({ apiKey });
}

function getGeminiClient() {
  return getGeminiLlmProvider();
}

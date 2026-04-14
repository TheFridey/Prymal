import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { getAgent } from '../agents/config.js';
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
import { getAgentMemory } from './memory.js';
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

const LEGACY_MODEL_REPLACEMENTS = {
  'claude-3-5-sonnet-latest': 'claude-sonnet-4-6',
  'claude-3-5-sonnet-20240620': 'claude-sonnet-4-6',
  'claude-3-5-sonnet-20241022': 'claude-sonnet-4-6',
  'claude-3-7-sonnet-latest': 'claude-sonnet-4-6',
  'claude-3-7-sonnet-20250219': 'claude-sonnet-4-6',
  'claude-3-5-haiku-latest': 'claude-haiku-4-5',
  'claude-3-5-haiku-20241022': 'claude-haiku-4-5',
};

const ANTHROPIC_MODELS = getAnthropicModels();
const OPENAI_MODELS = getOpenAIModels();
const GEMINI_MODELS = getGeminiModels();

const MAX_CONTEXT_TOKENS = 160_000;
const MAX_RESPONSE_TOKENS = 8192;
const MAX_LORE_CHUNKS = 4;

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

        yield { type: 'text', chunk: response.text };
        yield {
          type: 'done',
          totalTokens: response.totalTokens,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          loreChunkIds: systemPrompt.loreChunkIds,
          sources: systemPrompt.sources,
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
          },
          schemaValidation: response.schemaValidation,
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

      for await (const event of generator) {
        if (event.type === 'text' && needsValidation) {
          accumulatedText += event.chunk;
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
            },
            schemaValidation,
          };
          return;
        }

        yield event;
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

function buildOpenAIUserContent(userMessage, attachments = []) {
  const pdfAttachments = attachments.filter((a) => a.mediaType === 'application/pdf');
  if (pdfAttachments.length > 0) {
    throw Object.assign(
      new Error('PDF attachments are not supported with the current model routing. Try uploading to LORE instead.'),
      { userFacing: true },
    );
  }
  const imageAttachments = attachments.filter((a) => a.mediaType.startsWith('image/'));
  if (imageAttachments.length === 0) return userMessage;
  return [
    { type: 'text', text: userMessage },
    ...imageAttachments.map((a) => ({
      type: 'image_url',
      image_url: { url: `data:${a.mediaType};base64,${a.base64}` },
    })),
  ];
}

async function runProviderResponse({
  plan,
  agent,
  systemPrompt,
  messages,
  userMessage,
  maxTokens,
  attachments = [],
}) {
  if (plan.provider === 'openai') {
    return runOpenAIResponse({
      plan,
      systemPrompt,
      messages,
      userMessage,
      maxTokens,
      attachments,
    });
  }

  if (plan.provider === 'google') {
    return runGeminiResponse({
      plan,
      systemPrompt,
      messages,
      userMessage,
      maxTokens,
    });
  }

  return runAnthropicResponse({
    plan,
    agent,
    systemPrompt,
    messages,
    userMessage,
    maxTokens,
    attachments,
  });
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
      text: validation.verdict === 'repaired' ? formatStructuredOutput(validation.parsed) : initialResponse.text,
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
      text: validation.verdict === 'repaired' ? formatStructuredOutput(validation.parsed) : retryResponse.text,
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
    text: validation.verdict === 'repaired' ? formatStructuredOutput(validation.parsed) : repairResponse.text,
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
  // max_tokens must exceed the thinking budget; bump if needed
  const effectiveMaxTokens = useThinking ? Math.max(maxTokens, thinkingBudget + 1000) : maxTokens;

  const streamParams = {
    model: plan.model,
    max_tokens: effectiveMaxTokens,
    system: systemPrompt.text,
    messages: [...messages, { role: 'user', content: buildAnthropicUserContent(userMessage, attachments) }],
  };

  if (useThinking) {
    streamParams.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
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
  // buildOpenAIUserContent throws a user-facing error if PDFs are present
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

async function* streamGeminiResponse({ plan, systemPrompt, messages, userMessage, maxTokens }) {
  const client = getGeminiClient();
  const geminiModel = client.getGenerativeModel({
    model: plan.model,
    systemInstruction: systemPrompt.text,
  });

  const history = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const result = await geminiModel.generateContentStream({
    contents: [...history, { role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: { maxOutputTokens: maxTokens },
  });

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield { type: 'text', chunk: text };
  }

  const response = await result.response;
  yield {
    type: 'done',
    totalTokens: (response.usageMetadata?.promptTokenCount ?? 0) + (response.usageMetadata?.candidatesTokenCount ?? 0),
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    loreChunkIds: systemPrompt.loreChunkIds,
    sources: systemPrompt.sources,
    model: plan.model,
    provider: 'google',
    route: plan.route,
    routeReason: plan.reason,
  };
}

async function runGeminiResponse({ plan, systemPrompt, messages, userMessage, maxTokens }) {
  const client = getGeminiClient();
  const geminiModel = client.getGenerativeModel({
    model: plan.model,
    systemInstruction: systemPrompt.text,
  });

  const history = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const result = await geminiModel.generateContent({
    contents: [...history, { role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: { maxOutputTokens: maxTokens },
  });

  return {
    text: result.response.text(),
    model: plan.model,
    provider: 'google',
    route: plan.route,
    routeReason: plan.reason,
    totalTokens: (result.response.usageMetadata?.promptTokenCount ?? 0) + (result.response.usageMetadata?.candidatesTokenCount ?? 0),
    inputTokens: result.response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
    sources: systemPrompt.sources,
  };
}

async function runAnthropicResponse({ plan, agent, systemPrompt, messages, userMessage, maxTokens, attachments = [] }) {
  const client = getAnthropicClient();
  const useThinking = agent?.useExtendedThinking === true && ANTHROPIC_MODELS.opus === plan.model;
  const thinkingBudget = agent?.thinkingBudgetTokens ?? 8000;
  const effectiveMaxTokens = useThinking ? Math.max(maxTokens, thinkingBudget + 1000) : maxTokens;
  const response = await client.messages.create({
    model: plan.model,
    max_tokens: effectiveMaxTokens,
    system: systemPrompt.text,
    messages: [...messages, { role: 'user', content: buildAnthropicUserContent(userMessage, attachments) }],
    ...(useThinking ? { thinking: { type: 'enabled', budget_tokens: thinkingBudget } } : {}),
  });

  const text = response.content
    ?.filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

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

  return {
    text: extractOpenAIOutputText(response),
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
  ];
  const sources = [];
  const loreChunkIds = [];
  const loreDocumentIds = new Set();
  const memoryReadIds = [];
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

  if (useLore && orgId && userMessage && contract?.allowedTools?.includes('lore_search')) {
    try {
      const loreChunks = await ragSearch({
        orgId,
        query: userMessage,
        limit: MAX_LORE_CHUNKS,
      });

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
    const memory = await getAgentMemory({
      orgId,
      userId,
      agentId: agent.id,
      workflowRunId,
      sessionKey: conversationId ? `conversation:${conversationId}` : null,
      limit: 10,
      contract,
    });

    if (memory.length > 0) {
      toolsUsed.add('memory_read');
      memoryReadIds.push(...memory.map((entry) => entry.id));
      const memorySections = [
        {
          title: 'Organisation context:',
          rows: memory.filter((entry) => entry.scope === 'org'),
        },
        {
          title: 'User preferences:',
          rows: memory.filter((entry) => entry.scope === 'user'),
        },
        {
          title: 'Restricted context:',
          rows: memory.filter((entry) => entry.scope === 'restricted'),
        },
        {
          title: 'Agent-private context:',
          rows: memory.filter((entry) => entry.scope === 'agent_private'),
        },
        {
          title: 'Workflow-run context:',
          rows: memory.filter((entry) => entry.scope === 'workflow_run'),
        },
        {
          title: 'Temporary session context:',
          rows: memory.filter((entry) => entry.scope === 'temporary_session'),
        },
      ].filter((section) => section.rows.length > 0);

      sections.push(
        ['AGENT MEMORY']
          .concat(
            memorySections.map((section) =>
              [section.title, ...section.rows.map((entry) => `- ${entry.key}: ${entry.value}`)].join('\n'),
            ),
          )
          .join('\n\n'),
      );
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
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    const error = new Error('GEMINI_API_KEY is required for Gemini tasks.');
    error.status = 503;
    error.code = 'GEMINI_NOT_CONFIGURED';
    throw error;
  }

  if (/xxxx|your_|placeholder/i.test(apiKey) || !apiKey.startsWith('AI')) {
    const error = new Error(
      'GEMINI_API_KEY in backend/.env is invalid. Add a real Google AI API key and restart the backend.',
    );
    error.status = 503;
    error.code = 'GEMINI_AUTH_INVALID';
    throw error;
  }

  return new GoogleGenerativeAI(apiKey);
}

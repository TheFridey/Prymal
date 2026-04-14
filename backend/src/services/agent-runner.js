// ─────────────────────────────────────────────────────────────────
// axiom/backend/src/services/agent-runner.js
// Core execution loop for single-turn agent chat interactions.
// Wraps llm.js streaming with lifecycle management: eval, trace,
// fallback handling, and tool dispatch enforcement.
// ─────────────────────────────────────────────────────────────────

import { getAgent } from '../agents/config.js';
import { buildRuntimeContractSummary, getRuntimeAgentContract } from '../agents/runtime.js';
import { evaluateAgentOutput } from './evals.js';
import { streamAgentResponse } from './llm.js';
import { classifyLLMFailure, recordLLMExecutionTrace } from './llm-observability.js';
import { extractMemoryFromTurn } from './memory.js';
import { selectExecutionPlan, EXTENDED_THINKING_PLANS } from './model-policy.js';
import { reviewAgentOutputWithSentinel } from './sentinel-review.js';

/**
 * Run a single agent chat turn and stream the result.
 *
 * Yields objects with shape:
 *   { type: 'chunk', text: string }
 *   { type: 'done', messageId?, conversationId, tokensUsed, sources, model, provider, route,
 *                   routeReason, policyKey, fallbackUsed, evaluation, memoryWrites, loreChunkIds }
 *   { type: 'error', message, code, upgrade? }
 *
 * @param {object} options
 * @param {string} options.agentId
 * @param {string} options.orgId
 * @param {string} options.orgPlan
 * @param {string|null} options.userId
 * @param {string|null} options.conversationId
 * @param {string} options.userMessage
 * @param {object[]} options.messages         - Prior conversation history
 * @param {boolean} [options.useLore]
 * @param {boolean} [options.useMemory]
 * @param {object} [options.preferences]
 * @param {string} [options.model]
 * @param {object[]} [options.attachments]
 * @param {string} [options.mode]
 * @param {string|null} [options.taskType]
 * @param {string|null} [options.policyOverride]
 * @param {string|null} [options.providerOverride]
 * @param {string|null} [options.workflowRunId]
 * @param {string|null} [options.requestId]
 */
export async function* runAgentChat({
  agentId,
  orgId,
  orgPlan = 'free',
  orgMetadata = {},
  userId = null,
  conversationId = null,
  userMessage,
  messages = [],
  useLore = true,
  useMemory = true,
  preferences = {},
  model,
  attachments = [],
  mode = 'chat',
  taskType = null,
  policyOverride = null,
  providerOverride = null,
  workflowRunId = null,
  requestId = null,
}) {
  const startedAt = Date.now();
  const agent = getAgent(agentId);

  if (!agent) {
    yield { type: 'error', message: `Unknown agent: ${agentId}`, code: 'UNKNOWN_AGENT' };
    return;
  }

  const contract = getRuntimeAgentContract(agentId);

  // Gate extended thinking behind eligible plans
  const effectiveOrgPlan = gateExtendedThinking(agent, orgPlan) ? orgPlan : 'free';

  let assistantText = '';
  let lastDoneEvent = null;

  try {
    const generator = streamAgentResponse({
      agentId,
      orgId,
      orgPlan: effectiveOrgPlan,
      orgMetadata,
      userId,
      conversationId,
      taskType,
      policyOverride,
      providerOverride,
      messages,
      userMessage,
      useLore,
      useMemory,
      preferences,
      model,
      attachments,
    });

    for await (const event of generator) {
      if (event.type === 'text') {
        assistantText += event.chunk;
        yield { type: 'chunk', text: event.chunk };
      }

      if (event.type === 'done') {
        lastDoneEvent = event;
      }
    }

    // Run eval on the completed response
    const evaluation = evaluateAgentOutput({
      agentId,
      text: assistantText,
      sources: lastDoneEvent?.sources ?? [],
      usedTools: lastDoneEvent?.toolsUsed ?? [],
      structuredOutput: contract?.structuredOutput ?? null,
    });
    const sentinelReview = reviewAgentOutputWithSentinel({
      agentId,
      orgPlan,
      assistantText,
      evaluation,
      schemaValidation: lastDoneEvent?.schemaValidation ?? null,
      sources: lastDoneEvent?.sources ?? [],
    });

    // Extract memory from this turn (non-blocking, best-effort)
    let memoryWrites = [];
    if (useMemory && orgId && userMessage) {
      try {
        memoryWrites = await extractMemoryFromTurn({
          orgId,
          userId,
          agentId,
          conversationId,
          userMessage,
        });
      } catch (memErr) {
        console.warn('[AGENT-RUNNER] Memory extraction failed:', memErr.message);
      }
    }

    // Determine outcome status — HOLD verdict means the response is withheld.
    const sentinelVerdict = sentinelReview?.verdict ?? 'skipped';
    const outcomeStatus = sentinelVerdict === 'HOLD' ? 'held' : 'succeeded';

    // Persist the execution trace (always — even for held responses).
    await recordLLMExecutionTrace({
      orgId,
      userId,
      conversationId,
      workflowRunId,
      agentId,
      provider: lastDoneEvent?.provider ?? 'unknown',
      model: lastDoneEvent?.model ?? 'unknown',
      policyKey: lastDoneEvent?.policyKey ?? 'fast_chat',
      route: lastDoneEvent?.route ?? 'unknown',
      routeReason: lastDoneEvent?.routeReason ?? null,
      fallbackUsed: lastDoneEvent?.fallbackUsed ?? false,
      latencyMs: Date.now() - startedAt,
      promptTokens: lastDoneEvent?.inputTokens ?? null,
      completionTokens: lastDoneEvent?.outputTokens ?? null,
      totalTokens: lastDoneEvent?.totalTokens ?? null,
      toolsUsed: lastDoneEvent?.toolsUsed ?? [],
      loreChunkIds: lastDoneEvent?.loreChunkIds ?? [],
      loreDocumentIds: lastDoneEvent?.loreDocumentIds ?? [],
      memoryReadIds: lastDoneEvent?.memoryReadIds ?? [],
      memoryWriteKeys: memoryWrites.map((w) => w.memoryWriteKey ?? w.key),
      outcomeStatus,
      metadata: {
        mode,
        attachmentCount: attachments.length,
        sourceCount: lastDoneEvent?.sources?.length ?? 0,
        sourceTypes: [...new Set((lastDoneEvent?.sources ?? []).map((s) => s.sourceType ?? s.mode ?? 'unknown'))],
        sources: lastDoneEvent?.sources ?? [],
        evaluation,
        sentinelReview,
        contract: buildRuntimeContractSummary(agentId),
        policyClass: lastDoneEvent?.selectionDetails?.policyClass ?? lastDoneEvent?.policyKey ?? null,
        fallbackModel: lastDoneEvent?.selectionDetails?.fallbackModelUsed ?? null,
        routing: lastDoneEvent?.selectionDetails ?? {},
        requestId,
      },
    });

    // SENTINEL HOLD gate: withhold the response from the client.
    if (sentinelVerdict === 'HOLD') {
      yield {
        type: 'hold',
        message: 'This response has been held for quality review by SENTINEL.',
        sentinelConcerns: sentinelReview.concerns ?? [],
        sentinelRepairActions: sentinelReview.repair_actions ?? [],
        conversationId,
        agentId,
      };
      return;
    }

    yield {
      type: 'done',
      conversationId,
      assistantText,
      tokensUsed: lastDoneEvent?.totalTokens ?? 0,
      inputTokens: lastDoneEvent?.inputTokens ?? 0,
      outputTokens: lastDoneEvent?.outputTokens ?? 0,
      processingMs: Date.now() - startedAt,
      sources: lastDoneEvent?.sources ?? [],
      model: lastDoneEvent?.model ?? null,
      provider: lastDoneEvent?.provider ?? null,
      route: lastDoneEvent?.route ?? null,
      routeReason: lastDoneEvent?.routeReason ?? null,
      policyKey: lastDoneEvent?.policyKey ?? null,
      fallbackUsed: lastDoneEvent?.fallbackUsed ?? false,
      selectionDetails: lastDoneEvent?.selectionDetails ?? {},
      loreChunkIds: lastDoneEvent?.loreChunkIds ?? [],
      loreDocumentIds: lastDoneEvent?.loreDocumentIds ?? [],
      toolsUsed: lastDoneEvent?.toolsUsed ?? [],
      memoryWrites,
      evaluation,
      schemaValidation: lastDoneEvent?.schemaValidation ?? null,
      sentinelReview,
      sentinelRepaired: sentinelVerdict === 'REPAIR',
      sentinelRepairSummary: sentinelVerdict === 'REPAIR'
        ? (sentinelReview?.repair_actions?.join('; ') ?? null)
        : null,
    };
  } catch (error) {
    // Record the failure trace
    await recordLLMExecutionTrace({
      orgId,
      userId,
      conversationId,
      workflowRunId,
      agentId,
      provider: error.llmMeta?.provider ?? 'unknown',
      model: error.llmMeta?.model ?? 'unknown',
      policyKey: error.llmMeta?.policyKey ?? 'fast_chat',
      route: error.llmMeta?.route ?? 'unknown',
      routeReason: error.llmMeta?.routeReason ?? null,
      fallbackUsed: error.llmMeta?.fallbackUsed ?? false,
      latencyMs: Date.now() - startedAt,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      toolsUsed: error.llmMeta?.toolsUsed ?? [],
      loreChunkIds: error.llmMeta?.loreChunkIds ?? [],
      loreDocumentIds: error.llmMeta?.loreDocumentIds ?? [],
      memoryReadIds: error.llmMeta?.memoryReadIds ?? [],
      memoryWriteKeys: [],
      outcomeStatus: 'failed',
      failureClass: classifyLLMFailure(error),
      metadata: {
        mode,
        code: error.code ?? 'AGENT_RUN_FAILED',
        message: error.message,
        contract: buildRuntimeContractSummary(agentId),
        policyClass: error.llmMeta?.selectionDetails?.policyClass ?? error.llmMeta?.policyKey ?? null,
        fallbackModel: error.llmMeta?.selectionDetails?.fallbackModelUsed ?? null,
        sources: error.llmMeta?.sources ?? [],
        routing: error.llmMeta?.selectionDetails ?? {},
        requestId,
      },
    });

    yield {
      type: 'error',
      message: error.message || 'Generation failed.',
      code: error.code || 'AGENT_RUN_FAILED',
      upgrade: Boolean(error.upgrade),
    };
  }
}

/**
 * Returns true if extended thinking is allowed for this agent + plan.
 * CIPHER and SAGE use extended thinking; it is only enabled on pro/teams/agency.
 */
function gateExtendedThinking(agent, orgPlan) {
  if (!agent?.useExtendedThinking) {
    return true; // Not an extended-thinking agent — gate is irrelevant
  }

  const allowed = EXTENDED_THINKING_PLANS.has(orgPlan);

  if (!allowed) {
    console.info(
      `[AGENT-RUNNER] Extended thinking disabled for ${agent.id} on plan '${orgPlan}'.`,
    );
  }

  return allowed;
}

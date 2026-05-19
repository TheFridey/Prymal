// ─────────────────────────────────────────────────────────────────
// Prymal backend agent runner.
// Core execution loop for single-turn agent chat interactions.
// Wraps llm.js streaming with lifecycle management: eval, trace,
// fallback handling, and tool dispatch enforcement.
// ─────────────────────────────────────────────────────────────────

import { getAgent } from '../agents/config.js';
import { getAgentEnforcement, getAgentTraceFields } from '../agents/contracts.js';
import { buildRuntimeContractSummary, getRuntimeAgentContract } from '../agents/runtime.js';
import { evaluateAgentOutput } from './evals.js';
import { streamAgentResponse } from './llm.js';
import { classifyLLMFailure, recordLLMExecutionTrace } from './llm-observability.js';
import { extractMemoryFromTurn, persistConversationContextMemories } from './memory.js';
import { insertMemoryEvent } from './memory-events.js';
import { EXTENDED_THINKING_PLANS } from './model-policy.js';
import { reviewAgentOutputWithSentinel, shouldRunSentinelReview } from './sentinel-review.js';

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
  const bufferUntilSentinelVerdict = shouldRunSentinelReview({ agentId, orgPlan });

  try {
    const generator = streamAgentResponse({
      agentId,
      orgId,
      orgPlan: effectiveOrgPlan,
      orgMetadata,
      userId,
      conversationId,
      workflowRunId,
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
      mode,
    });

    for await (const event of generator) {
      if (event.type === 'text') {
        assistantText += event.chunk;
        if (!bufferUntilSentinelVerdict) {
          yield { type: 'chunk', text: event.chunk };
        }
      }

      if (event.type === 'done') {
        lastDoneEvent = event;
      }
    }

    if (!lastDoneEvent) {
      const streamError = new Error('The agent response stream ended unexpectedly. Please try again.');
      streamError.code = 'LLM_STREAM_INCOMPLETE';
      streamError.status = 502;
      throw streamError;
    }

    if (lastDoneEvent?.repairedText) {
      assistantText = lastDoneEvent.repairedText;
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

    if (useMemory && orgId && userMessage && assistantText) {
      try {
        const contextWrites = await persistConversationContextMemories({
          orgId,
          userId,
          agentId,
          conversationId,
          userMessage,
          assistantText,
        });
        memoryWrites = [...memoryWrites, ...contextWrites.map((write) => ({
          id: write.id ?? null,
          key: write.key,
          memoryWriteKey: write.key,
          scope: write.scope,
          created: write.created ?? false,
          conflict: write.conflict ?? false,
          memoryFeedback: write.memoryFeedback ?? [],
        }))];
      } catch (memErr) {
        console.warn('[AGENT-RUNNER] Context memory persistence failed:', memErr.message);
      }
    }

    let memoryEvents = dedupeMemoryFeedbackEvents(memoryWrites.flatMap((w) => w.memoryFeedback ?? []));

    // Determine outcome status — HOLD verdict means the response is withheld.
    const sentinelVerdict = sentinelReview?.verdict ?? 'skipped';
    const outcomeStatus = sentinelVerdict === 'HOLD' ? 'held' : 'succeeded';

    const enforcementSummary = buildEnforcementSummary({
      agentId,
      contract,
      doneEvent: lastDoneEvent,
      evaluation,
      sentinelReview,
    });

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
        enforcementSummary,
        geminiGrounding: lastDoneEvent?.geminiGrounding ?? null,
        contract: buildRuntimeContractSummary(agentId),
        policyClass: lastDoneEvent?.selectionDetails?.policyClass ?? lastDoneEvent?.policyKey ?? null,
        fallbackModel: lastDoneEvent?.selectionDetails?.fallbackModelUsed ?? null,
        schemaValidation: lastDoneEvent?.schemaValidation ?? null,
        routing: lastDoneEvent?.selectionDetails ?? {},
        requestId,
      },
    });

    // SENTINEL HOLD gate: withhold the response from the client.
    if (sentinelVerdict === 'HOLD') {
      if (orgId) {
        await insertMemoryEvent({
          orgId,
          userId,
          agentId,
          workflowRunId,
          eventType: 'output_held',
          title: 'Output held for review',
          description: String(sentinelReview?.hold_reason ?? '').slice(0, 280) || 'Sentinel quality gate',
          importanceScore: 0.78,
          sourceType: 'sentinel',
          sourceRef: conversationId,
          metadata: { sentinelRiskScore: sentinelReview?.riskScore ?? null },
        }).catch(() => {});
      }

      memoryEvents = dedupeMemoryFeedbackEvents([
        ...memoryEvents,
        { type: 'held', message: 'Held for review before delivery' },
      ]);

      yield {
        type: 'hold',
        message: 'This response has been held for quality review by SENTINEL.',
        sentinelConcerns: sentinelReview.concerns ?? [],
        sentinelRepairActions: sentinelReview.repair_actions ?? [],
        sentinelHoldReason: sentinelReview.hold_reason ?? null,
        sentinelRiskScore: sentinelReview.riskScore ?? null,
        enforcementSummary,
        conversationId,
        agentId,
        memoryEvents,
      };
      return;
    }

    if (sentinelVerdict === 'REPAIR' && orgId) {
      await insertMemoryEvent({
        orgId,
        userId,
        agentId,
        workflowRunId,
        eventType: 'output_repaired',
        title: 'Output refined',
        description:
          (sentinelReview?.repair_actions ?? []).slice(0, 3).join('; ')
          || 'Minor adjustments flagged during automated review',
        importanceScore: 0.52,
        sourceType: 'sentinel',
        sourceRef: conversationId,
        metadata: {},
      }).catch(() => {});
      memoryEvents.push({ type: 'repaired', message: 'Response refined after automated review' });
      memoryEvents = dedupeMemoryFeedbackEvents(memoryEvents);
    }

    if (orgId) {
      await insertMemoryEvent({
        orgId,
        userId,
        agentId,
        workflowRunId,
        eventType: 'agent_response',
        title: `${agent.name} responded`,
        description: summarizeAgentTurn(assistantText, userMessage),
        importanceScore: 0.48,
        sourceType: 'agent_runner',
        sourceRef: conversationId,
        metadata: { mode },
      }).catch(() => {});
    }

    if (bufferUntilSentinelVerdict && assistantText) {
      yield { type: 'chunk', text: assistantText, bufferedForSentinel: true };
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
      enforcementSummary,
      geminiGrounding: lastDoneEvent?.geminiGrounding ?? null,
      sentinelRepaired: sentinelVerdict === 'REPAIR',
      sentinelRepairSummary: sentinelVerdict === 'REPAIR'
        ? (sentinelReview?.repair_actions?.join('; ') ?? null)
        : null,
      memoryEvents,
      usedMemories: lastDoneEvent?.usedMemories ?? lastDoneEvent?.selectionDetails?.usedMemories ?? [],
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
      message: formatUserFacingAgentError(error),
      code: error.code || 'AGENT_RUN_FAILED',
      upgrade: Boolean(error.upgrade),
    };
  }
}

function summarizeAgentTurn(assistantText, userMessage) {
  const trimmed = String(assistantText ?? '').trim();
  if (trimmed.length > 0) {
    return trimmed.slice(0, 220);
  }
  return `Answered request: ${String(userMessage ?? '').trim().slice(0, 120)}`;
}

function dedupeMemoryFeedbackEvents(events) {
  const priority = { conflict: 5, held: 4, repaired: 3, promoted: 2, updated: 1, saved: 0 };
  const sorted = [...events].sort((a, b) => (priority[b.type] ?? 0) - (priority[a.type] ?? 0));
  const seen = new Set();
  const out = [];

  for (const ev of sorted) {
    const key = `${ev.type}:${ev.message}:${ev.detail ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }

  return out;
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

/**
 * Build a flat, queryable enforcement summary for the trace metadata.
 * Maps the raw schema/tool/sentinel/eval signals into the contract-defined
 * trace field names so analytics dashboards can pivot per-agent without
 * touching nested structures.
 */
function buildEnforcementSummary({ agentId, contract, doneEvent, evaluation, sentinelReview }) {
  const enforcement = getAgentEnforcement(agentId) ?? {};
  const traceFields = getAgentTraceFields(agentId) ?? {};

  const schemaValidation = doneEvent?.schemaValidation ?? null;
  const schemaRepair = doneEvent?.selectionDetails?.schemaRepair ?? null;
  const toolValidation = doneEvent?.selectionDetails?.toolValidation ?? null;
  const toolViolations = Array.isArray(toolValidation?.violations) ? toolValidation.violations : [];

  const schemaVerdict = schemaValidation?.verdict ?? 'skipped';
  const schemaRepairAttempts = Number(schemaRepair?.attempts ?? 0) || 0;
  const schemaRepairStage = schemaRepair?.stage ?? null;

  const hallucinationRiskLevel = evaluation?.hallucinationRisk ?? 'unknown';
  const hallucinationThreshold = enforcement.hallucinationRiskThreshold ?? null;
  const citationRate = evaluation?.citationRate ?? null;
  const citationCount = evaluation?.citationCount ?? (doneEvent?.sources?.length ?? 0);

  const sentinelVerdict = sentinelReview?.verdict ?? 'skipped';
  const sentinelRiskScore = sentinelReview?.riskScore ?? null;
  const sentinelHoldReason = sentinelReview?.hold_reason ?? null;
  const sentinelConcernCount = Array.isArray(sentinelReview?.concerns) ? sentinelReview.concerns.length : 0;
  const sentinelRepairActionCount = Array.isArray(sentinelReview?.repair_actions)
    ? sentinelReview.repair_actions.length
    : 0;
  const contradictionCount = Array.isArray(schemaValidation?.parsed?.contradictionsFound)
    ? schemaValidation.parsed.contradictionsFound.length
    : 0;

  const retrievalDecision = doneEvent?.selectionDetails?.retrievalDecision ?? null;
  const memorySummary = doneEvent?.selectionDetails?.memorySummary ?? null;

  const summary = {
    strictRuntime: Boolean(contract?.strictRuntime),
    schemaEnforced: Boolean(contract?.schemaEnforced),
    schemaVerdict,
    schemaRepairAttempts,
    schemaRepairStage,
    schemaErrors: Array.isArray(schemaValidation?.errors)
      ? schemaValidation.errors.slice(0, 5)
      : [],
    schemaRepairNotes: schemaValidation?.repairNotes ?? null,
    semanticBlocks: Array.isArray(schemaValidation?.semantic?.blocks)
      ? schemaValidation.semantic.blocks.slice(0, 5)
      : [],
    semanticWarnings: Array.isArray(schemaValidation?.semantic?.warnings)
      ? schemaValidation.semantic.warnings.slice(0, 5)
      : [],
    toolViolationCount: toolViolations.length,
    toolViolationTypes: [...new Set(toolViolations.map((v) => v?.type).filter(Boolean))],
    toolViolationAction: enforcement.toolViolationAction ?? null,
    toolUsePass: evaluation?.toolUsePass !== false,
    disallowedToolsUsed: evaluation?.disallowedToolsUsed ?? [],
    hallucinationRiskLevel,
    hallucinationRiskThreshold: hallucinationThreshold,
    hallucinationOverThreshold:
      typeof hallucinationThreshold === 'number' && hallucinationRiskLevel === 'high',
    citationRate,
    citationCount,
    citationRequired: Boolean(enforcement.citationRequiredOnEveryFactualClaim),
    groundedness: evaluation?.groundedness ?? 'unknown',
    sentinelVerdict,
    sentinelRiskScore,
    sentinelHoldReason,
    sentinelConcernCount,
    sentinelRepairActionCount,
    contradictionCount,
    fallbackUsed: Boolean(doneEvent?.fallbackUsed),
    retrieval: retrievalDecision,
    memory: memorySummary,
  };

  // Mirror the per-agent contract-defined trace fields so analytics can pivot
  // per-agent (e.g. cipher_repair_loops, sage_hallucination_risk).
  const fieldMap = {};
  if (traceFields.schemaViolationField) {
    fieldMap[traceFields.schemaViolationField] = schemaVerdict === 'failed' ? 1 : 0;
  }
  if (traceFields.toolPolicyViolationField) {
    fieldMap[traceFields.toolPolicyViolationField] = toolViolations.length;
  }
  if (traceFields.repairLoopCountField) {
    fieldMap[traceFields.repairLoopCountField] = schemaRepairAttempts;
  }
  if (traceFields.hallucinationRiskField) {
    fieldMap[traceFields.hallucinationRiskField] = hallucinationRiskLevel;
  }
  if (traceFields.citationRateField) {
    fieldMap[traceFields.citationRateField] = citationRate;
  }
  if (traceFields.contradictionCountField) {
    fieldMap[traceFields.contradictionCountField] = contradictionCount;
  }
  if (traceFields.verdictField) {
    fieldMap[traceFields.verdictField] = sentinelVerdict;
  }
  if (traceFields.riskScoreField) {
    fieldMap[traceFields.riskScoreField] = sentinelRiskScore;
  }
  if (traceFields.stepConfirmationField && Array.isArray(schemaValidation?.parsed?.steps)) {
    fieldMap[traceFields.stepConfirmationField] = schemaValidation.parsed.steps.length;
  }

  if (Object.keys(fieldMap).length > 0) {
    summary.agentFields = fieldMap;
  }

  return summary;
}

function formatUserFacingAgentError(error) {
  const message = String(error?.message ?? '').trim();

  if (!message) {
    return 'Prymal could not generate a response. Please try again.';
  }

  if (message === 'mode is not defined') {
    return 'Prymal hit an internal routing error while selecting a model. Please retry your message.';
  }

  return message;
}

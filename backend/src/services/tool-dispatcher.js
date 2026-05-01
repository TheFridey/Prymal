// ─────────────────────────────────────────────────────────────────
// Prymal backend tool dispatcher.
// Routes tool calls from agents to the correct handler service.
// Enforces allowedTools / disallowedTools from the agent contract.
// ─────────────────────────────────────────────────────────────────

import { enforceAgentToolPolicy, isSideEffectTool } from '../agents/runtime.js';
import { retrieveRankedMemories } from './memory-retrieval.js';
import { formatLoreChunkForPrompt, ragSearch } from './rag.js';
import { fetchLiveWebContext } from './web-research.js';
import { getAccessToken } from '../routes/integrations.js';
import { scanToolRequest, WARDEN_VERDICTS } from './warden/index.js';

export const KNOWN_TOOLS = new Set([
  'lore_search',
  'knowledge_gap_check',
  'memory_read',
  'email_send',
  'live_web_research',
  'vision_input',
  'file_input',
]);

/**
 * Dispatch a single tool call from an agent.
 *
 * @param {object} options
 * @param {string} options.tool           - Tool name (e.g. 'lore_search')
 * @param {object} options.toolInput      - Parameters for the tool
 * @param {string} options.agentId        - Calling agent's ID
 * @param {string} options.orgId          - Organisation ID
 * @param {string|null} options.userId    - User ID (may be null in workflow context)
 * @param {string|null} options.conversationId
 * @param {string|null} options.workflowRunId
 * @returns {Promise<{ tool: string, success: boolean, result: any, error: string|null }>}
 */
export async function dispatchTool({
  tool,
  toolInput = {},
  agentId,
  orgId,
  userId = null,
  conversationId = null,
  workflowRunId = null,
  toolOverrides = {},
}) {
  // Reject unknown tool names up-front so contract-allowed tools can never
  // smuggle a typo or aliased call through the dispatcher.
  if (!KNOWN_TOOLS.has(tool)) {
    const error = `Tool '${tool}' is not a known tool. Allowed tools: ${[...KNOWN_TOOLS].join(', ')}.`;
    console.warn(`[TOOL-DISPATCH] ${error}`);
    recordToolPolicyEvent({
      agentId,
      orgId,
      tool,
      verdict: 'rejected_unknown',
      reason: error,
    });
    return { tool, success: false, result: null, error, code: 'UNKNOWN_TOOL' };
  }

  const policy = enforceAgentToolPolicy(agentId, tool);

  if (!policy.allowed) {
    console.warn(`[TOOL-DISPATCH] ${policy.reason}`);
    recordToolPolicyEvent({
      agentId,
      orgId,
      tool,
      verdict: 'blocked',
      reason: policy.reason,
    });
    return {
      tool,
      success: false,
      result: null,
      error: policy.reason,
      code: 'CONTRACT_TOOL_VIOLATION',
    };
  }

  if (policy.requiresAudit) {
    recordToolPolicyEvent({
      agentId,
      orgId,
      userId,
      conversationId,
      workflowRunId,
      tool,
      verdict: 'side_effect_dispatched',
      reason: `Side-effect tool '${tool}' dispatched`,
    });
  }

  try {
    const wardenDecision = await scanToolRequest({
      toolName: tool,
      arguments: toolInput,
      userIntent: toolInput?.userIntent ?? toolInput?.query ?? toolInput?.body ?? '',
      sourceContext: toolInput?.sourceContext ?? { sourceType: 'USER' },
      userId,
      orgId,
      confirmed: Boolean(toolInput?.confirmed),
      isAdmin: Boolean(toolInput?.isAdmin),
    });

    if ([WARDEN_VERDICTS.BLOCK, WARDEN_VERDICTS.REQUIRE_CONFIRMATION].includes(wardenDecision.verdict)) {
      const error = wardenDecision.verdict === WARDEN_VERDICTS.REQUIRE_CONFIRMATION
        ? 'This action needs confirmation before I can run it.'
        : "I can summarise that content, but I won't follow tool instructions embedded inside it.";
      recordToolPolicyEvent({
        agentId,
        orgId,
        userId,
        conversationId,
        workflowRunId,
        tool,
        verdict: `warden_${wardenDecision.verdict.toLowerCase()}`,
        reason: error,
      });
      return {
        tool,
        success: false,
        result: null,
        error,
        code: 'WARDEN_TOOL_DENIED',
        wardenAuditId: wardenDecision.auditId,
      };
    }

    const result = await routeTool({
      tool,
      toolInput,
      agentId,
      orgId,
      userId,
      conversationId,
      workflowRunId,
      toolOverrides,
    });

    if (policy.requiresAudit) {
      recordToolPolicyEvent({
        agentId,
        orgId,
        userId,
        conversationId,
        workflowRunId,
        tool,
        verdict: 'side_effect_completed',
        reason: `Side-effect tool '${tool}' completed`,
      });
    }

    return { tool, success: true, result, error: null };
  } catch (err) {
    console.error(`[TOOL-DISPATCH] Tool '${tool}' failed for agent ${agentId}:`, err.message);
    if (policy.requiresAudit) {
      recordToolPolicyEvent({
        agentId,
        orgId,
        userId,
        conversationId,
        workflowRunId,
        tool,
        verdict: 'side_effect_failed',
        reason: err.message,
      });
    }
    return { tool, success: false, result: null, error: err.message };
  }
}

/**
 * Single-line structured audit log entry for tool dispatch decisions.
 * Designed to be parseable by log-aggregation tooling without a DB write.
 */
function recordToolPolicyEvent({ agentId, orgId, userId = null, conversationId = null, workflowRunId = null, tool, verdict, reason }) {
  const payload = {
    event: 'tool_policy',
    verdict,
    tool,
    agentId,
    orgId: orgId ?? null,
    userId,
    conversationId,
    workflowRunId,
    reason,
    sideEffect: isSideEffectTool(tool),
    timestamp: new Date().toISOString(),
  };
  console.info(`[TOOL-AUDIT] ${JSON.stringify(payload)}`);
}

/**
 * Dispatch multiple tool calls sequentially (used by workflow nodes).
 */
export async function dispatchTools(calls, context) {
  const results = [];
  for (const call of calls) {
    results.push(await dispatchTool({ ...call, ...context }));
  }
  return results;
}

// ─── Internal router ──────────────────────────────────────────────

async function routeTool({
  tool,
  toolInput,
  agentId,
  orgId,
  userId,
  conversationId,
  workflowRunId,
  toolOverrides = {},
}) {
  switch (tool) {
    case 'lore_search':
      return handleLoreSearch({ toolInput, orgId });

    case 'knowledge_gap_check':
      return handleKnowledgeGapCheck({ toolInput, orgId, detectKnowledgeGapImpl: toolOverrides.detectKnowledgeGap });

    case 'memory_read':
      return handleMemoryRead({ toolInput, agentId, orgId, userId, conversationId, workflowRunId });

    case 'email_send':
      return handleEmailSend({ toolInput, orgId });

    case 'live_web_research':
      return handleLiveWebResearch({ toolInput });

    default:
      throw Object.assign(
        new Error(`Unknown tool '${tool}'. Supported tools: ${[...KNOWN_TOOLS].join(', ')}.`),
        { code: 'UNKNOWN_TOOL' },
      );
  }
}

// ─── Handlers ─────────────────────────────────────────────────────

async function handleLoreSearch({ toolInput, orgId }) {
  const query = String(toolInput?.query ?? toolInput?.q ?? '').trim();
  const limit = Math.min(Math.max(Number(toolInput?.limit ?? 3), 1), 10);

  if (!query) {
    throw new Error('lore_search requires a non-empty query string.');
  }

  const chunks = await ragSearch({ orgId, query, limit });

  return {
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      sourceType: chunk.sourceType,
      sourceUrl: chunk.sourceUrl,
      content: formatLoreChunkForPrompt(chunk),
      similarity: chunk.similarity,
      citation: chunk.citation,
    })),
    count: chunks.length,
  };
}

async function handleMemoryRead({ toolInput, agentId, orgId, userId, conversationId, workflowRunId }) {
  const limit = Math.min(Math.max(Number(toolInput?.limit ?? 10), 1), 50);

  const envelopes = await retrieveRankedMemories({
    orgId,
    userId,
    agentId,
    workflowRunId: workflowRunId ?? null,
    sessionKey: conversationId ? `conversation:${conversationId}` : null,
    userMessage: String(toolInput?.query ?? toolInput?.q ?? ''),
    conversationId,
    traceRecord: false,
  });

  const memories = envelopes.slice(0, limit).map((envelope) => ({
    id: envelope.memory.id,
    scope: envelope.memory.scope,
    memoryType: envelope.memory.memoryType,
    key: envelope.memory.key,
    value: envelope.memory.value,
    confidence: envelope.memory.confidence,
    retrievalScore: envelope.retrievalScore,
    selectedBecause: envelope.selectedBecause,
  }));

  return {
    memories,
    count: memories.length,
  };
}

export async function handleKnowledgeGapCheck({ toolInput, orgId, detectKnowledgeGapImpl = null }) {
  const { query } = toolInput ?? {};

  if (!query?.trim()) {
    throw new Error('knowledge_gap_check requires a query string.');
  }

  const detectKnowledgeGap = detectKnowledgeGapImpl
    ?? (await import('./rag.js')).detectKnowledgeGap;
  const hasGap = await detectKnowledgeGap({ orgId, query });

  return {
    query,
    hasGap,
    message: hasGap
      ? 'No sufficient knowledge base coverage found for this query. Consider uploading relevant documents to LORE.'
      : 'Knowledge base has coverage for this query.',
  };
}

async function handleEmailSend({ toolInput, orgId }) {
  const { to, subject, body } = toolInput ?? {};

  if (!to || !subject || !body) {
    throw new Error('email_send requires "to", "subject", and "body" fields.');
  }

  let accessToken;

  try {
    accessToken = await getAccessToken(orgId, 'gmail');
  } catch {
    throw Object.assign(
      new Error('Gmail integration is not connected for this organisation. Connect it in Integrations first.'),
      { code: 'GMAIL_NOT_CONNECTED' },
    );
  }

  const rfcMessage = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n');

  const encoded = Buffer.from(rfcMessage).toString('base64url');

  const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  });

  const gmailData = await gmailResponse.json().catch(() => ({}));

  if (!gmailResponse.ok) {
    const message = gmailData?.error?.message || 'Gmail send failed.';
    throw Object.assign(new Error(message), { code: 'GMAIL_SEND_FAILED' });
  }

  return {
    sent: true,
    messageId: gmailData.id ?? null,
    to,
    subject,
  };
}

async function handleLiveWebResearch({ toolInput }) {
  const query = String(toolInput?.query ?? toolInput?.url ?? '').trim();

  if (!query) {
    throw new Error('live_web_research requires a non-empty "query" or "url" field.');
  }

  const results = await fetchLiveWebContext(query);

  return {
    sources: results.map((source) => ({
      title: source.title,
      url: source.url,
      snippet: source.snippet ?? '',
      summary: source.summary ?? '',
      mode: source.mode ?? 'direct',
      error: source.error ?? null,
    })),
    count: results.length,
  };
}

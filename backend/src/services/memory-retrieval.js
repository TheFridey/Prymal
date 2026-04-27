import { getRuntimeAgentContract } from '../agents/runtime.js';
import { memoryRetrievalTraces } from '../db/schema.js';
import { db } from '../db/index.js';
import { getAgentMemory } from './memory.js';
import { getMemoryPolicyForAgent } from './memory-policies.js';
import { calculateMemoryDecay } from './memory-decay.js';
import { recordMemoryUse, bumpConfidenceOnReuse } from './memory-confidence.js';

function estimateTokens(text) {
  return Math.ceil(String(text ?? '').length / 4);
}

function lexicalScore(query, entry) {
  const q = String(query ?? '').toLowerCase();
  const hay = `${entry.key ?? ''} ${entry.value ?? ''} ${entry.title ?? ''}`.toLowerCase();
  if (!q.trim()) return 0.5;
  const words = q.split(/\s+/).filter(Boolean);
  let hits = 0;

  for (const w of words) {
    if (hay.includes(w)) hits += 1;
  }

  return hits / Math.max(words.length, 1);
}

function rankScore(entry, policy, query, now) {
  const { decayFactor, reason } = calculateMemoryDecay(entry, now);
  const prefBoost = policy.preferredTypes?.includes(entry.memoryType) ? 0.12 : 0;
  const pinBoost = entry.pinned ? 0.15 : 0;
  const alwaysBoost = entry.alwaysInclude ? 0.2 : 0;
  const lex = lexicalScore(query, entry);
  const freshness = entry.freshnessScore ?? 0.5;
  const authority = entry.authorityScore ?? 0.5;
  const conf = entry.effectiveConfidence ?? entry.confidence ?? 0.5;
  const stalePenalty = entry.status === 'stale' ? -0.08 : entry.status === 'aging' ? -0.04 : 0;
  const conflictPenalty = entry.memoryItemStatus === 'conflicted' && !policy.includeContradictions ? -0.25 : 0;

  const base =
    conf * 0.26 * decayFactor
    + authority * 0.11
    + freshness * 0.07 * decayFactor
    + lex * 0.24
    + prefBoost
    + pinBoost
    + alwaysBoost
    + stalePenalty
    + conflictPenalty;

  const effectiveScore = Number(Math.min(1.05, Math.max(0, base)).toFixed(4));

  return { retrievalScore: effectiveScore, decayFactor, decayReason: reason, effectiveScore };
}

/**
 * Safe summaries for chat UI — omits sensitive verbatim content for agent_private / restricted.
 */
export function buildMemoryClientPreview(envelopes, { agentId } = {}) {
  return envelopes.map((e) => {
    const m = e.memory;
    const agentPrivate = m.scope === 'agent_private';
    const restricted = m.scope === 'restricted';

    const redacted = agentPrivate || restricted;

    return {
      id: m.id,
      title: redacted ? 'Internal contextual memory' : (m.title ?? m.key ?? 'Memory'),
      type: m.memoryType,
      scope: m.scope,
      confidenceScore: m.confidence ?? 0.5,
      effectiveScore: e.effectiveScore ?? e.retrievalScore,
      sourceType: m.memorySourceKind ?? 'conversation',
      selectedBecause: e.selectedBecause,
      matchedBy: e.matchedBy,
      decayFactor: e.decayFactor,
      decayReason: e.decayReason,
      redacted,
      lastUsedAt: m.lastUsedAt,
      agentId,
    };
  });
}

/**
 * Policy-ranked retrieval with provenance-ready envelopes for prompts and traces.
 */
export async function retrieveRankedMemories({
  orgId,
  userId,
  agentId,
  workflowRunId,
  sessionKey,
  userMessage = '',
  conversationId,
  contract = getRuntimeAgentContract(agentId),
  traceRecord = false,
}) {
  const policy = getMemoryPolicyForAgent(agentId);
  const limit = Math.min(policy.maxMemories * 2, 60);
  const now = new Date();

  const base = await getAgentMemory({
    orgId,
    userId,
    agentId,
    workflowRunId,
    sessionKey,
    limit,
    contract,
    retrievalPolicy: policy,
  });

  const perType = new Map();
  const wrapped = [];

  for (const entry of base) {
    if (policy.blockedTypes?.includes(entry.memoryType)) {
      continue;
    }

    if ((entry.confidence ?? 0) < policy.minConfidence) {
      continue;
    }

    if (entry.memoryItemStatus === 'deleted' || entry.memoryItemStatus === 'rejected') {
      continue;
    }

    const scored = rankScore(entry, policy, userMessage, now);
    const retrievalScore = scored.retrievalScore;
    const matchedBy =
      lexicalScore(userMessage, entry) > 0.35 ? 'lexical+policy' : 'scope_priority+policy';

    const selectedBecause =
      retrievalScore >= 0.55
        ? 'Strong policy fit, confidence, decay-adjusted score, and lexical overlap with the request.'
        : 'Eligible under agent policy and recency; moderate overlap with current query.';

    const tokenEstimate = estimateTokens(entry.value ?? entry.content ?? '');

    const envelope = {
      memory: entry,
      retrievalScore,
      effectiveScore: scored.effectiveScore,
      decayFactor: scored.decayFactor,
      decayReason: scored.decayReason,
      matchedBy,
      selectedBecause,
      policyApplied: policy,
      tokenEstimate,
    };

    const typeCount = perType.get(entry.memoryType) ?? 0;

    if (typeCount >= policy.maxMemoriesPerType) {
      continue;
    }

    perType.set(entry.memoryType, typeCount + 1);
    wrapped.push(envelope);
  }

  wrapped.sort((a, b) => b.retrievalScore - a.retrievalScore);

  let budget = policy.maxTokenBudget;
  const trimmed = [];

  for (const row of wrapped) {
    if (budget <= 0) break;
    trimmed.push(row);
    budget -= row.tokenEstimate;
    if (trimmed.length >= policy.maxMemories) break;
  }

  for (const row of trimmed) {
    await recordMemoryUse(row.memory.id, { source: 'retrieval_ranked' }).catch(() => {});
    await bumpConfidenceOnReuse(row.memory.id, 0.01).catch(() => {});
  }

  if (traceRecord) {
    await db.insert(memoryRetrievalTraces).values({
      orgId,
      agentId,
      workflowRunId: workflowRunId ?? null,
      conversationId: conversationId ?? null,
      policySnapshot: policy,
      selectedIds: trimmed.map((t) => t.memory.id),
      retrievalItems: trimmed,
    });
  }

  return trimmed;
}

import { and, desc, eq, ne, notInArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { agentMemory } from '../db/schema.js';
import { cosineSimilarity, ruleBasedConflictSignals } from './memory-contradictions.js';
import { relationOverlapRisk } from './memory-promotion.js';
import { embedTextsForMemoryContrast } from './rag.js';
import { insertMemoryEvent } from './memory-events.js';

const LEXICAL_DUP_MIN = 0.82;
const SEMANTIC_DUP_MIN = 0.86;

/**
 * Find duplicate memories for a candidate write (same agent scope bucket).
 */
export async function detectDuplicateMemories(candidate, orgId, agentId) {
  const results = [];

  if (!candidate?.value?.trim() || !candidate.scopeKey || !candidate.scope) {
    return results;
  }

  const siblings = await db.query.agentMemory.findMany({
    where: and(
      eq(agentMemory.orgId, orgId),
      eq(agentMemory.agentId, agentId),
      eq(agentMemory.scope, candidate.scope),
      eq(agentMemory.scopeKey, candidate.scopeKey),
      eq(agentMemory.memoryType, candidate.memoryType),
      candidate.existingId ? ne(agentMemory.id, candidate.existingId) : undefined,
      notInArray(agentMemory.memoryItemStatus, ['deleted', 'rejected', 'archived']),
    ),
    orderBy: [desc(agentMemory.updatedAt)],
    limit: 40,
  });

  let embeddings = null;
  const texts = [candidate.value, ...siblings.map((s) => s.value ?? '')];
  embeddings = await embedTextsForMemoryContrast(texts);

  const candEmb = embeddings?.[0];

  for (let i = 0; i < siblings.length; i += 1) {
    const row = siblings[i];
    const lexical = relationOverlapRisk(row.value ?? '', candidate.value ?? '');
    let similarityScore = null;

    if (candEmb && embeddings?.[i + 1]) {
      similarityScore = cosineSimilarity(candEmb, embeddings[i + 1]);
    }

    const rule = ruleBasedConflictSignals(candidate.value ?? '', row.value ?? '', candidate.memoryType ?? '');
    if (rule.contradicts) {
      results.push({
        memoryId: row.id,
        similarityScore: similarityScore ?? lexical,
        reason: 'similar_but_rule_conflict',
        mergeRecommended: false,
      });
      continue;
    }

    const strongLexical = lexical >= LEXICAL_DUP_MIN;
    const strongSemantic = similarityScore != null && similarityScore >= SEMANTIC_DUP_MIN;

    if (strongLexical || strongSemantic) {
      results.push({
        memoryId: row.id,
        similarityScore: similarityScore ?? lexical,
        reason: strongSemantic ? 'semantic_near_duplicate' : 'lexical_near_duplicate',
        mergeRecommended: true,
      });
    }
  }

  return results.sort((a, b) => (b.similarityScore ?? 0) - (a.similarityScore ?? 0));
}

/**
 * Merge incoming candidate into existing row — boosts confidence, merges provenance metadata.
 */
export async function mergeMemoryIntoExisting({
  orgId,
  agentId,
  existingMemoryId,
  candidate,
  actor = 'system',
}) {
  const existing = await db.query.agentMemory.findFirst({
    where: and(eq(agentMemory.orgId, orgId), eq(agentMemory.id, existingMemoryId)),
  });

  if (!existing) {
    return { merged: false, reason: 'not_found' };
  }

  if (existing.userLocked) {
    return { merged: false, reason: 'user_locked', pendingReview: true };
  }

  const meta = {
    ...(existing.metadata ?? {}),
    mergeSources: [...(existing.metadata?.mergeSources ?? []), candidate.sourceRef ?? candidate.metadata?.source ?? 'merge'].slice(-12),
    lastMergedAt: new Date().toISOString(),
    lastMergedBy: actor,
  };

  const mergedValue =
    String(existing.value ?? '').length >= String(candidate.value ?? '').length ? existing.value : candidate.value;

  const nextConfidence = Math.min(1, (existing.confidence ?? 0.5) + 0.06);

  await db
    .update(agentMemory)
    .set({
      value: mergedValue,
      content: mergedValue,
      confidence: nextConfidence,
      metadata: meta,
      version: (existing.version ?? 1) + 1,
      updatedAt: new Date(),
      confidenceUpdatedAt: new Date(),
    })
    .where(eq(agentMemory.id, existingMemoryId));

  await insertMemoryEvent({
    orgId,
    userId: existing.userId ?? null,
    agentId,
    workflowRunId: existing.workflowRunId ?? null,
    eventType: 'memory_merged',
    title: 'Memory merged',
    description: `Merged duplicate signal into ${existing.memoryType ?? 'memory'}`,
    importanceScore: 0.54,
    sourceType: 'memory_merge',
    sourceRef: existingMemoryId,
    metadata: { mergedFromPreview: String(candidate.value ?? '').slice(0, 200) },
  }).catch(() => {});

  return {
    merged: true,
    memoryId: existingMemoryId,
    memoryFeedback: [{ type: 'merged', message: 'Updated an existing memory' }],
  };
}

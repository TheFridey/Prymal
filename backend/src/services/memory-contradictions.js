import { and, desc, eq, inArray, ne, notInArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { agentMemory, memoryContradictionGroups } from '../db/schema.js';
import { embedTextsForMemoryContrast } from './rag.js';
import { relationOverlapRisk } from './memory-promotion.js';
import { insertMemoryEvent } from './memory-events.js';

const LEXICAL_OVERLAP_MIN = 0.22;
const SEMANTIC_SIM_HIGH = 0.88;
const SEMANTIC_SIM_CONFLICT_FLOOR = 0.76;

export function getLogicalMemoryKey(row) {
  return row?.metadata?.logicalKey ?? row?.key ?? null;
}

export function cosineSimilarity(vectorA, vectorB) {
  if (!vectorA?.length || !vectorB?.length || vectorA.length !== vectorB.length) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vectorA.length; i += 1) {
    const a = vectorA[i];
    const b = vectorB[i];
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Lightweight rule-based contradiction hints (tone polarity, negation, numeric mismatch).
 */
export function ruleBasedConflictSignals(leftText, rightText, memoryType) {
  const a = String(leftText ?? '').toLowerCase();
  const b = String(rightText ?? '').toLowerCase();
  const reasons = [];

  const tonePairs = [
    ['formal', 'casual'],
    ['formal', 'informal'],
    ['professional', 'casual'],
    ['corporate', 'casual'],
    ['serious', 'playful'],
    ['direct', 'indirect'],
    ['verbose', 'concise'],
  ];

  for (const [x, y] of tonePairs) {
    if ((a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x))) {
      reasons.push(`tone_polarity:${x}_vs_${y}`);
    }
  }

  const negA = /\b(no|not|never|avoid|don't|do not)\b/.test(a);
  const negB = /\b(no|not|never|avoid|don't|do not)\b/.test(b);
  if (negA !== negB && relationOverlapRisk(a, b) >= 0.25) {
    reasons.push('negation_mismatch');
  }

  const numA = a.match(/\b\d+(?:\.\d+)?\s*%?/g) ?? [];
  const numB = b.match(/\b\d+(?:\.\d+)?\s*%?/g) ?? [];
  if (numA.length && numB.length && relationOverlapRisk(a, b) >= 0.2) {
    const setB = new Set(numB);
    const overlapNum = numA.some((n) => setB.has(n));
    if (!overlapNum && numA[0] !== numB[0]) {
      reasons.push('numeric_mismatch');
    }
  }

  if ((memoryType ?? '').includes('preference') || (memoryType ?? '').includes('instruction')) {
    if (reasons.length > 0) {
      return { contradicts: true, reason: reasons.join(';'), type: 'rule_based' };
    }
  }

  return reasons.length > 0 ? { contradicts: true, reason: reasons.join(';'), type: 'rule_based' } : { contradicts: false };
}

function semanticContradictionLikely(similarityScore, leftText, rightText, ruleHint) {
  if (similarityScore < SEMANTIC_SIM_CONFLICT_FLOOR) {
    return { contradicts: false };
  }

  const normLeft = String(leftText ?? '').trim().toLowerCase();
  const normRight = String(rightText ?? '').trim().toLowerCase();
  if (normLeft === normRight) {
    return { contradicts: false, duplicate: true };
  }

  if (similarityScore >= SEMANTIC_SIM_HIGH && normLeft !== normRight) {
    const rule = ruleBasedConflictSignals(leftText, rightText, 'semantic');
    if (rule.contradicts) {
      return { contradicts: true, type: 'semantic', similarityScore, reason: rule.reason };
    }
    if (relationOverlapRisk(normLeft, normRight) >= LEXICAL_OVERLAP_MIN && normLeft !== normRight) {
      return {
        contradicts: true,
        type: 'semantic',
        similarityScore,
        reason: 'high_similarity_different_surface',
      };
    }
  }

  if (ruleHint?.contradicts) {
    return { contradicts: true, type: 'rule_based', similarityScore, reason: ruleHint.reason };
  }

  return { contradicts: false, similarityScore };
}

export async function mergeIntoContradictionGroup(orgId, memoryIds, metadata = {}) {
  const uniqueIds = [...new Set(memoryIds)].filter(Boolean);
  if (uniqueIds.length < 2) {
    return null;
  }

  const rows = await db.query.agentMemory.findMany({
    where: and(eq(agentMemory.orgId, orgId), inArray(agentMemory.id, uniqueIds)),
  });

  const existingGroupId = rows.map((row) => row.contradictionGroupId).find(Boolean) ?? null;

  let groupId = existingGroupId;

  if (!groupId) {
    const [created] = await db
      .insert(memoryContradictionGroups)
      .values({ orgId, metadata })
      .returning({ id: memoryContradictionGroups.id });
    groupId = created?.id ?? null;
  }

  if (!groupId) {
    return null;
  }

  await db
    .update(agentMemory)
    .set({
      memoryItemStatus: 'conflicted',
      contradictionGroupId: groupId,
      updatedAt: new Date(),
    })
    .where(and(eq(agentMemory.orgId, orgId), inArray(agentMemory.id, uniqueIds)));

  return { groupId, memoryIds: uniqueIds };
}

/**
 * Post-upsert contradiction pipeline: lexical + optional embeddings + rules.
 */
export async function processContradictionsAfterUpsert({ orgId, memoryRow, agentId }) {
  const feedback = [];

  if (!memoryRow?.id || memoryRow.scope === 'temporary_session') {
    return { conflicts: [], feedback, timelineInserted: false };
  }

  try {
    const siblings = await db.query.agentMemory.findMany({
      where: and(
        eq(agentMemory.orgId, orgId),
        eq(agentMemory.agentId, agentId),
        eq(agentMemory.scope, memoryRow.scope),
        eq(agentMemory.scopeKey, memoryRow.scopeKey),
        ne(agentMemory.id, memoryRow.id),
        notInArray(agentMemory.memoryItemStatus, ['deleted', 'rejected']),
      ),
      orderBy: [desc(agentMemory.updatedAt)],
      limit: 48,
    });

    if (siblings.length === 0) {
      return { conflicts: [], feedback, timelineInserted: false };
    }

    const enriched = [];
    const pairScratch = [];

    for (const sib of siblings) {
      const lexical = relationOverlapRisk(sib.value ?? '', memoryRow.value ?? '');
      const ruleHint = ruleBasedConflictSignals(memoryRow.value ?? '', sib.value ?? '', memoryRow.memoryType ?? '');
      const sameKeyDifferentValue = getLogicalMemoryKey(sib) === getLogicalMemoryKey(memoryRow) && sib.value !== memoryRow.value;

      if (lexical >= LEXICAL_OVERLAP_MIN || sameKeyDifferentValue || ruleHint?.contradicts) {
        pairScratch.push({ sib, lexical, ruleHint, sameKeyDifferentValue });
      }
    }

    let embeddings = null;

    if (pairScratch.length > 0) {
      const textsForEmbed = [memoryRow.value ?? '', ...pairScratch.map((p) => p.sib.value ?? '')];
      embeddings = await embedTextsForMemoryContrast(textsForEmbed);
    }

    const embCandidate = embeddings?.[0];

    pairScratch.forEach((item, index) => {
      const { sib, lexical, ruleHint, sameKeyDifferentValue } = item;
      let similarityScore = null;

      if (embCandidate && embeddings?.[index + 1]) {
        similarityScore = cosineSimilarity(embCandidate, embeddings[index + 1]);
      }

      let verdict;
      let verdictType = 'rule_based';

      if (similarityScore != null) {
        verdict = semanticContradictionLikely(similarityScore, memoryRow.value, sib.value, ruleHint);
        verdictType = verdict.type ?? 'semantic';
      } else if (sameKeyDifferentValue || (lexical >= 0.35 && lexical < 0.95 && ruleHint?.contradicts)) {
        verdict = { contradicts: true, type: 'rule_based', reason: ruleHint.reason ?? 'lexical_or_key_mismatch' };
      } else if (lexical >= 0.35 && lexical < 0.95 && memoryRow.value !== sib.value) {
        verdict = { contradicts: true, type: 'rule_based', reason: 'lexical_overlap_conflicting_values' };
      } else {
        verdict = { contradicts: false };
      }

      if (verdict?.duplicate) {
        return;
      }

      if (verdict?.contradicts) {
        enriched.push({
          memoryId: sib.id,
          type: verdict.type ?? verdictType,
          similarityScore: verdict.similarityScore ?? similarityScore,
          reason: verdict.reason ?? 'contradiction',
          lexicalOverlap: lexical,
        });

        if ((memoryRow.confidence ?? 0.5) + 0.08 < (sib.confidence ?? 0.5)) {
          markMemoryAsStale(memoryRow.id, orgId).catch(() => {});
        } else if ((sib.confidence ?? 0.5) + 0.08 < (memoryRow.confidence ?? 0.5)) {
          markMemoryAsStale(sib.id, orgId).catch(() => {});
        }
      }
    });

    if (enriched.length === 0) {
      return { conflicts: [], feedback, timelineInserted: false };
    }

    const mergeIds = [memoryRow.id, ...enriched.map((entry) => entry.memoryId)];
    const groupMeta = {
      candidateMemoryType: memoryRow.memoryType,
      conflictTypes: enriched.map((e) => e.type),
      similarities: enriched.map((e) => e.similarityScore).filter((s) => s != null),
    };

    await mergeIntoContradictionGroup(orgId, mergeIds, groupMeta);

    await insertMemoryEvent({
      orgId,
      userId: memoryRow.userId ?? null,
      agentId: memoryRow.agentId ?? null,
      workflowRunId: memoryRow.workflowRunId ?? null,
      eventType: 'memory_contradiction_detected',
      title: 'Conflicting memory detected',
      description: `${enriched.length} overlap candidate(s) for ${memoryRow.memoryType ?? 'memory'} — ids: ${mergeIds.join(', ')}`,
      importanceScore: 0.72,
      sourceType: 'memory_pipeline',
      sourceRef: mergeIds[0],
      metadata: {
        involvedIds: mergeIds,
        conflicts: enriched,
        memoryType: memoryRow.memoryType,
      },
    });

    feedback.push({
      type: 'conflict',
      message: 'Conflicting memory detected — review in Memory Centre.',
      memoryId: memoryRow.id,
    });

    return { conflicts: enriched, feedback, timelineInserted: true };
  } catch (error) {
    console.warn('[MEMORY_CONTRADICTIONS]', error.message);
    return { conflicts: [], feedback, timelineInserted: false };
  }
}

export async function detectContradictions(candidateMemory, orgId) {
  const scopeKey = candidateMemory.scopeKey;
  const scope = candidateMemory.scope;

  const siblings = await db.query.agentMemory.findMany({
    where: and(
      eq(agentMemory.orgId, orgId),
      eq(agentMemory.scope, scope),
      eq(agentMemory.scopeKey, scopeKey),
      eq(agentMemory.memoryItemStatus, 'active'),
    ),
    limit: 80,
    orderBy: [desc(agentMemory.updatedAt)],
  });

  const overlaps = [];

  for (const row of siblings) {
    if (row.id === candidateMemory.id) continue;
    const overlap = relationOverlapRisk(row.value ?? '', candidateMemory.value ?? '');
    const sameKey = getLogicalMemoryKey(row) === getLogicalMemoryKey(candidateMemory);
    if ((overlap >= 0.35 && overlap < 0.95) || (sameKey && row.value !== candidateMemory.value)) {
      overlaps.push({ memoryId: row.id, overlap });
    }
  }

  return overlaps;
}

export async function createContradictionGroup(orgId, memoryIds = [], metadata = {}) {
  return mergeIntoContradictionGroup(orgId, memoryIds, metadata);
}

export async function resolveContradiction(groupId, winningMemoryId, orgId) {
  await db
    .update(memoryContradictionGroups)
    .set({
      resolvedAt: new Date(),
      winningMemoryId,
    })
    .where(and(eq(memoryContradictionGroups.id, groupId), eq(memoryContradictionGroups.orgId, orgId)));

  await db
    .update(agentMemory)
    .set({
      memoryItemStatus: 'active',
      updatedAt: new Date(),
    })
    .where(and(eq(agentMemory.orgId, orgId), eq(agentMemory.id, winningMemoryId)));

  await db
    .update(agentMemory)
    .set({
      memoryItemStatus: 'archived',
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agentMemory.orgId, orgId),
        eq(agentMemory.contradictionGroupId, groupId),
        ne(agentMemory.id, winningMemoryId),
      ),
    );
}

export async function markMemoryAsStale(memoryId, orgId) {
  await db
    .update(agentMemory)
    .set({
      freshnessScore: sql`least(coalesce(${agentMemory.freshnessScore}, 0.5), 0.25)`,
      memoryItemStatus: 'pending_review',
      contradictionDetected: true,
      updatedAt: new Date(),
    })
    .where(and(eq(agentMemory.id, memoryId), eq(agentMemory.orgId, orgId)));
}

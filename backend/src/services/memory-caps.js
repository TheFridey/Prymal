import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { agentMemory } from '../db/schema.js';
import { insertMemoryEvent } from './memory-events.js';

/**
 * Soft/hard caps per memory_type (canonical enum names).
 */
export const MEMORY_CAPS_BY_TYPE = {
  user_preference: { soft: 30, hard: 50 },
  preference: { soft: 30, hard: 50 },
  brand_voice: { soft: 20, hard: 40 },
  task_state: { soft: 50, hard: 100 },
  workflow_state: { soft: 50, hard: 100 },
  agent_observation: { soft: 100, hard: 200 },
  episodic_event: { soft: 500, hard: 1000 },
  business_fact: { soft: 150, hard: 300 },
  project_fact: { soft: 150, hard: 300 },
  fact: { soft: 120, hard: 240 },
  instruction: { soft: 80, hard: 160 },
  pattern: { soft: 60, hard: 120 },
};

export function getCapsForMemoryType(memoryType) {
  return MEMORY_CAPS_BY_TYPE[memoryType] ?? { soft: 80, hard: 120 };
}

function archiveScore(row) {
  let score = (row.confidence ?? 0.5) * 40;
  score += (row.usageCount ?? 0) * 0.8;
  score += row.lastUsedAt ? new Date(row.lastUsedAt).getTime() / 1e12 : 0;
  score += row.pinned ? 5000 : 0;
  score += row.neverForget ? 8000 : 0;
  score += row.alwaysInclude ? 2000 : 0;
  score -= (row.importanceScore ?? 0.5) * 10;
  return score;
}

/**
 * When hard cap exceeded for a bucket, archive lowest-value rows.
 */
export async function enforceMemoryCapsForBucket({
  orgId,
  agentId,
  scope,
  scopeKey,
  memoryType,
  userId = null,
}) {
  const caps = getCapsForMemoryType(memoryType);
  const rows = await db.query.agentMemory.findMany({
    where: and(
      eq(agentMemory.orgId, orgId),
      eq(agentMemory.agentId, agentId),
      eq(agentMemory.scope, scope),
      eq(agentMemory.scopeKey, scopeKey),
      eq(agentMemory.memoryType, memoryType),
      eq(agentMemory.memoryItemStatus, 'active'),
    ),
    orderBy: [asc(agentMemory.confidence), asc(agentMemory.lastUsedAt)],
    limit: caps.hard + 40,
  });

  if (rows.length <= caps.hard) {
    return { pruned: 0, softWarning: rows.length >= caps.soft };
  }

  const protectedIds = new Set(
    rows.filter((r) => r.pinned || r.neverForget || r.userLocked).map((r) => r.id),
  );

  const candidates = rows
    .filter((r) => !protectedIds.has(r.id))
    .sort((a, b) => archiveScore(a) - archiveScore(b));

  const overflow = rows.length - caps.hard;
  const toArchive = candidates.slice(0, Math.min(overflow, candidates.length)).map((r) => r.id);

  if (toArchive.length === 0) {
    return { pruned: 0, softWarning: rows.length >= caps.soft };
  }

  await db
    .update(agentMemory)
    .set({
      memoryItemStatus: 'archived',
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(agentMemory.orgId, orgId), inArray(agentMemory.id, toArchive)));

  await insertMemoryEvent({
    orgId,
    userId,
    agentId,
    eventType: 'memory_pruned',
    title: 'Memory pruned',
    description: `Archived ${toArchive.length} ${memoryType} entr${toArchive.length === 1 ? 'y' : 'ies'} to enforce cap (${caps.hard}).`,
    importanceScore: 0.48,
    sourceType: 'memory_caps',
    sourceRef: scopeKey,
    metadata: { memoryType, scope, archivedIds: toArchive },
  }).catch(() => {});

  return { pruned: toArchive.length, softWarning: rows.length - toArchive.length >= caps.soft };
}

export async function countMemoryForOrgByType(orgId, memoryType) {
  const [row] = await db
    .select({ c: count() })
    .from(agentMemory)
    .where(and(eq(agentMemory.orgId, orgId), eq(agentMemory.memoryType, memoryType)));

  return Number(row?.c ?? 0);
}

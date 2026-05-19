import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { agentMemory } from '../db/schema.js';
import { insertMemoryEvent } from './memory-events.js';

const CLAMP = (v) => Math.min(1, Math.max(0, Number(v)));

/**
 * Record retrieval usage — updates last_used_at, usage_count, light freshness bump.
 */
export async function recordMemoryUse(memoryId, { source = 'retrieval' } = {}) {
  if (!memoryId) return;

  await db
    .update(agentMemory)
    .set({
      lastUsedAt: new Date(),
      lastSeenAt: new Date(),
      usageCount: sql`${agentMemory.usageCount} + 1`,
      freshnessScore: sql`least(1.0, coalesce(${agentMemory.freshnessScore}, 0.5) + 0.02)`,
      updatedAt: new Date(),
    })
    .where(eq(agentMemory.id, memoryId));

  void source;
}

/**
 * Adjust confidence with clamping and audit timestamp.
 */
export async function adjustMemoryConfidence(memoryId, delta, reason, { orgId = null, timeline = true } = {}) {
  const row = await db.query.agentMemory.findFirst({ where: eq(agentMemory.id, memoryId) });
  if (!row) return null;

  const next = CLAMP((row.confidence ?? 0.5) + delta);
  await db
    .update(agentMemory)
    .set({
      confidence: next,
      confidenceUpdatedAt: new Date(),
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentMemory.id, memoryId));

  if (timeline && orgId) {
    await insertMemoryEvent({
      orgId,
      userId: row.userId ?? null,
      agentId: row.agentId ?? null,
      workflowRunId: row.workflowRunId ?? null,
      eventType: 'memory_confidence_adjusted',
      title: 'Confidence updated',
      description: `${reason} → ${next.toFixed(3)}`,
      importanceScore: 0.42,
      sourceType: 'memory_pipeline',
      sourceRef: memoryId,
      metadata: { delta, reason, previous: row.confidence },
    }).catch(() => {});
  }

  return next;
}

export async function downgradeMemory(memoryId, reason, { orgId = null } = {}) {
  return adjustMemoryConfidence(memoryId, -0.18, reason ?? 'manual_downgrade', { orgId, timeline: Boolean(orgId) });
}

export async function confirmMemoryConfidence(memoryId, { orgId = null, actor = 'user' } = {}) {
  const row = await db.query.agentMemory.findFirst({ where: eq(agentMemory.id, memoryId) });
  if (!row) return null;

  await db
    .update(agentMemory)
    .set({
      confidence: CLAMP(Math.max(row.confidence ?? 0.5, 0.92)),
      provenanceKind: 'confirmed',
      confirmedAt: row.confirmedAt ?? new Date(),
      lastConfirmedAt: new Date(),
      lastSeenAt: new Date(),
      updatedAt: new Date(),
      confidenceUpdatedAt: new Date(),
    })
    .where(eq(agentMemory.id, memoryId));

  if (orgId) {
    await insertMemoryEvent({
      orgId,
      userId: row.userId ?? null,
      agentId: row.agentId ?? null,
      workflowRunId: row.workflowRunId ?? null,
      eventType: 'memory_confirmed',
      title: 'Memory confirmed',
      description: `Validated by ${actor}`,
      importanceScore: 0.55,
      sourceType: 'memory_pipeline',
      sourceRef: memoryId,
      metadata: {},
    }).catch(() => {});
  }

  return true;
}

export async function bumpConfidenceOnReuse(memoryId, amount = 0.012) {
  const row = await db.query.agentMemory.findFirst({ where: eq(agentMemory.id, memoryId) });
  if (!row || row.userLocked) return null;
  const meta = row.metadata ?? {};
  const lastBump = meta.lastConfidenceBumpAt ? new Date(meta.lastConfidenceBumpAt).getTime() : 0;
  if (Date.now() - lastBump < 60 * 60 * 1000) {
    return row.confidence;
  }

  const next = CLAMP((row.confidence ?? 0.5) + amount);
  await db
    .update(agentMemory)
    .set({
      confidence: next,
      confidenceUpdatedAt: new Date(),
      lastSeenAt: new Date(),
      updatedAt: new Date(),
      metadata: { ...meta, lastConfidenceBumpAt: new Date().toISOString() },
    })
    .where(eq(agentMemory.id, memoryId));

  return next;
}

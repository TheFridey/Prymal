import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { memoryEvents } from '../db/schema.js';

export async function insertMemoryEvent(payload) {
  const [row] = await db
    .insert(memoryEvents)
    .values({
      orgId: payload.orgId,
      userId: payload.userId ?? null,
      agentId: payload.agentId ?? null,
      workflowRunId: payload.workflowRunId ?? null,
      eventType: payload.eventType,
      title: payload.title,
      description: payload.description ?? null,
      importanceScore: payload.importanceScore ?? 0.55,
      sourceType: payload.sourceType ?? 'system',
      sourceRef: payload.sourceRef ?? null,
      dailyBucket: payload.dailyBucket ?? undefined,
      metadata: payload.metadata ?? {},
    })
    .returning({ id: memoryEvents.id });

  return row;
}

/** Timeline entries for workflow runs — lower importance for noisy node steps. */
export async function emitWorkflowTimelineEvent(payload) {
  return insertMemoryEvent({
    ...payload,
    sourceType: payload.sourceType ?? 'workflow',
    importanceScore: payload.importanceScore ?? 0.45,
  });
}

export async function listMemoryEventsTimeline({ orgId, from, to, limit = 100 }) {
  const clauses = [eq(memoryEvents.orgId, orgId)];

  if (from) {
    clauses.push(gte(memoryEvents.createdAt, from));
  }

  if (to) {
    clauses.push(lte(memoryEvents.createdAt, to));
  }

  return db.select().from(memoryEvents).where(and(...clauses)).orderBy(desc(memoryEvents.createdAt)).limit(limit);
}

export async function groupEventsByDay(rows) {
  const buckets = new Map();

  for (const row of rows) {
    const key =
      row.dailyBucket instanceof Date
        ? row.dailyBucket.toISOString().slice(0, 10)
        : String(row.dailyBucket ?? row.createdAt?.toISOString?.().slice(0, 10) ?? '');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }

  return [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export async function summarizeDailyEvents(orgId, dayIso) {
  const dayStart = new Date(`${dayIso}T00:00:00.000Z`);
  const dayEnd = new Date(`${dayIso}T23:59:59.999Z`);

  const rows = await db
    .select()
    .from(memoryEvents)
    .where(
      and(eq(memoryEvents.orgId, orgId), gte(memoryEvents.createdAt, dayStart), lte(memoryEvents.createdAt, dayEnd)),
    )
    .orderBy(desc(memoryEvents.importanceScore))
    .limit(50);

  const highlights = rows.slice(0, 8).map((r) => r.title);
  return {
    day: dayIso,
    eventCount: rows.length,
    highlights,
  };
}

import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { agentMemory, memoryContradictionGroups } from '../db/schema.js';
import { requireOrg } from '../middleware/auth.js';
import { resolveContradiction } from '../services/memory-contradictions.js';
import { downgradeMemory } from '../services/memory-confidence.js';
import { MEMORY_CAPS_BY_TYPE, countMemoryForOrgByType } from '../services/memory-caps.js';
import { calculateMemoryDecay } from '../services/memory-decay.js';
import { buildMemoryExplanation } from '../services/memory-explain.js';
import { buildMemoryIntelligenceSummary } from '../services/memory-intelligence.js';
import { insertMemoryEvent, groupEventsByDay, summarizeDailyEvents, listMemoryEventsTimeline } from '../services/memory-events.js';
import { getMemoryStatus } from '../services/memory.js';
import { evaluateMemoryPromotion, recordPromotionEvaluation } from '../services/memory-promotion.js';
import { reviewMemoryCandidate } from '../services/memory-safety.js';
import { recordProductEventOnce } from '../services/telemetry.js';

const router = new Hono();

function enrichMemoryRow(row) {
  const { decayFactor, reason } = calculateMemoryDecay(row);
  const confidence = Number(row.confidence ?? 0.5);
  const confidenceLevel = confidence >= 0.8 ? 'high' : confidence >= 0.55 ? 'medium' : 'low';
  return {
    ...row,
    retrievalStatus: getMemoryStatus(row),
    decayFactor,
    decayReason: reason,
    confidenceLevel,
    contradictionDetected: Boolean(row.contradictionDetected),
    lastSeenAt: row.lastSeenAt ?? null,
    lastConfirmedAt: row.lastConfirmedAt ?? row.confirmedAt ?? null,
    supersededAt: row.supersededAt ?? null,
    supersededBy: row.supersededBy ?? null,
  };
}

function canEditScope(org, scope, rowUserId) {
  if (scope === 'org' || scope === 'workflow_run') {
    return org.userRole === 'owner' || org.userRole === 'admin';
  }
  if (scope === 'user' || scope === 'temporary_session') {
    return rowUserId === org.userId;
  }
  if (scope === 'restricted') {
    return org.userRole === 'owner' || org.userRole === 'admin';
  }
  if (scope === 'agent_private') {
    return false;
  }
  return rowUserId === org.userId;
}

router.get('/', requireOrg, async (context) => {
  const org = context.get('org');
  const scope = context.req.query('scope');
  const agentId = context.req.query('agentId');
  const memoryType = context.req.query('type');
  const status = context.req.query('status');
  const q = context.req.query('q');

  try {
    const clauses = [eq(agentMemory.orgId, org.orgId)];

    if (scope) clauses.push(eq(agentMemory.scope, scope));
    if (agentId) clauses.push(eq(agentMemory.agentId, agentId));
    if (memoryType) clauses.push(eq(agentMemory.memoryType, memoryType));
    if (status) clauses.push(eq(agentMemory.memoryItemStatus, status));

    if (q?.trim()) {
      clauses.push(
        or(
          ilike(agentMemory.key, `%${q.trim()}%`),
          ilike(agentMemory.value, `%${q.trim()}%`),
          ilike(agentMemory.title, `%${q.trim()}%`),
        ),
      );
    }

    const rows = await db.query.agentMemory.findMany({
      where: and(...clauses),
      orderBy: [desc(agentMemory.updatedAt)],
      limit: 300,
    });

    const filtered = rows.filter((row) => {
      if (row.scope === 'agent_private') {
        return false;
      }
      if (row.scope === 'user' || row.scope === 'temporary_session') {
        return row.userId === org.userId || org.userRole === 'owner' || org.userRole === 'admin';
      }
      return true;
    });

    return context.json({ memory: filtered.map((row) => enrichMemoryRow(row)) });
  } catch (error) {
    console.error('[memory] GET / failed:', error?.message ?? error);
    return context.json(
      {
        error: 'Memory inventory is unavailable. Ensure PostgreSQL is running and database migrations are applied.',
        code: 'MEMORY_QUERY_FAILED',
      },
      503,
    );
  }
});

router.get('/intelligence', requireOrg, async (context) => {
  const org = context.get('org');
  const rows = await db.query.agentMemory.findMany({
    where: eq(agentMemory.orgId, org.orgId),
    orderBy: [desc(agentMemory.updatedAt)],
    limit: 400,
  });

  const filtered = rows.filter((row) => row.scope !== 'agent_private');
  return context.json(buildMemoryIntelligenceSummary(filtered, { internal: false }));
});

router.get('/timeline', requireOrg, async (context) => {
  const org = context.get('org');
  const from = context.req.query('from');
  const to = context.req.query('to');

  const rows = await listMemoryEventsTimeline({
    orgId: org.orgId,
    from: from ? new Date(from) : null,
    to: to ? new Date(to) : null,
    limit: 200,
  });

  const grouped = await groupEventsByDay(rows);
  return context.json({ events: rows, grouped });
});

router.get('/caps-stats', requireOrg, async (context) => {
  const org = context.get('org');

  try {
    const counts = {};

    for (const memoryType of Object.keys(MEMORY_CAPS_BY_TYPE)) {
      counts[memoryType] = await countMemoryForOrgByType(org.orgId, memoryType);
    }

    return context.json({ caps: MEMORY_CAPS_BY_TYPE, counts });
  } catch (error) {
    console.error('[memory] GET /caps-stats failed:', error?.message ?? error);
    return context.json(
      {
        error: 'Memory caps are unavailable. Ensure PostgreSQL is running and database migrations are applied.',
        code: 'MEMORY_CAPS_FAILED',
      },
      503,
    );
  }
});

router.get('/timeline/daily', requireOrg, async (context) => {
  const org = context.get('org');
  const day = context.req.query('day') ?? new Date().toISOString().slice(0, 10);
  const summary = await summarizeDailyEvents(org.orgId, day);
  return context.json(summary);
});

router.get('/contradictions', requireOrg, async (context) => {
  const org = context.get('org');

  const rows = await db.query.agentMemory.findMany({
    where: and(eq(agentMemory.orgId, org.orgId), eq(agentMemory.memoryItemStatus, 'conflicted')),
    orderBy: [desc(agentMemory.updatedAt)],
    limit: 100,
  });

  const groups = await db.select().from(memoryContradictionGroups).where(eq(memoryContradictionGroups.orgId, org.orgId)).limit(50);

  return context.json({ conflicts: rows, groups });
});

router.post(
  '/contradictions/:groupId/resolve',
  requireOrg,
  zValidator(
    'json',
    z.object({
      winningMemoryId: z.string().uuid(),
    }),
  ),
  async (context) => {
    const org = context.get('org');
    const { groupId } = context.req.param();
    const payload = context.req.valid('json');

    await resolveContradiction(groupId, payload.winningMemoryId, org.orgId);

    await insertMemoryEvent({
      orgId: org.orgId,
      userId: org.userId,
      eventType: 'contradiction_resolved',
      title: 'Memory contradiction resolved',
      description: `Group ${groupId} settled on ${payload.winningMemoryId}`,
      sourceType: 'user_action',
    });

    return context.json({ ok: true });
  },
);

router.post(
  '/evaluate-promotion',
  requireOrg,
  zValidator(
    'json',
    z.object({
      candidate: z.any().optional(),
      context: z.any().optional(),
      metadata: z.any().optional(),
    }),
  ),
  async (context) => {
    const org = context.get('org');
    const body = context.req.valid('json');
    const decision = evaluateMemoryPromotion(body.candidate ?? {}, body.context ?? {});

    await recordPromotionEvaluation(org.orgId, decision, body.candidate?.id ?? null, body.metadata ?? {});

    return context.json(decision);
  },
);

router.post(
  '/review-candidate',
  requireOrg,
  zValidator(
    'json',
    z.object({
      candidate: z.any().optional(),
    }),
  ),
  async (context) => {
    const body = context.req.valid('json');
    const verdict = reviewMemoryCandidate(body.candidate ?? body);
    return context.json(verdict);
  },
);

router.get('/:id/explain', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();

  const row = await db.query.agentMemory.findFirst({
    where: and(eq(agentMemory.id, id), eq(agentMemory.orgId, org.orgId)),
  });

  if (!row) {
    return context.json({ error: 'Not found' }, 404);
  }

  const explanation = buildMemoryExplanation(row, {
    actorRole: org.userRole,
    actorUserId: org.userId,
    retrievedBecause: context.req.query('because') ?? undefined,
  });

  return context.json(explanation);
});

router.get('/:id', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();

  const row = await db.query.agentMemory.findFirst({
    where: and(eq(agentMemory.id, id), eq(agentMemory.orgId, org.orgId)),
  });

  if (!row || row.scope === 'agent_private') {
    return context.json({ error: 'Not found' }, 404);
  }

  return context.json({ memory: enrichMemoryRow(row) });
});

const upsertSchema = z.object({
  agentId: z.string(),
  scope: z.string(),
  memoryType: z.string(),
  key: z.string(),
  value: z.string(),
  title: z.string().optional(),
  summary: z.string().optional(),
  confidence: z.number().optional(),
  workflowRunId: z.string().uuid().nullable().optional(),
  metadata: z.any().optional(),
});

router.post('/', requireOrg, zValidator('json', upsertSchema), async (context) => {
  const org = context.get('org');
  const payload = context.req.valid('json');

  const { upsertMemory } = await import('../services/memory.js');

  const created = await upsertMemory({
    orgId: org.orgId,
    userId: org.userId,
    agentId: payload.agentId,
    scope: payload.scope,
    workflowRunId: payload.workflowRunId ?? undefined,
    memoryType: payload.memoryType,
    key: payload.key,
    value: payload.value,
    metadata: {
      ...(payload.metadata ?? {}),
      title: payload.title,
    },
    confidence: payload.confidence ?? 0.75,
  });

  await recordProductEventOnce({
    orgId: org.orgId,
    userId: org.userId,
    eventName: 'first_memory_saved',
    metadata: {
      memoryId: created.id,
      agentId: payload.agentId,
      scope: payload.scope,
    },
  });

  return context.json({ memory: created });
});

const patchSchema = z.object({
  value: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  confidence: z.number().optional(),
  pinned: z.boolean().optional(),
  memoryItemStatus: z.string().optional(),
  alwaysInclude: z.boolean().optional(),
  neverForget: z.boolean().optional(),
  userLocked: z.boolean().optional(),
});

router.patch('/:id', requireOrg, zValidator('json', patchSchema), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const payload = context.req.valid('json');

  const row = await db.query.agentMemory.findFirst({
    where: and(eq(agentMemory.id, id), eq(agentMemory.orgId, org.orgId)),
  });

  if (!row) {
    return context.json({ error: 'Not found' }, 404);
  }

  if (!canEditScope(org, row.scope, row.userId)) {
    return context.json({ error: 'Forbidden', code: 'MEMORY_EDIT_DENIED' }, 403);
  }

  await db
    .update(agentMemory)
    .set({
      value: payload.value ?? row.value,
      title: payload.title ?? row.title,
      summary: payload.summary ?? row.summary,
      confidence: payload.confidence ?? row.confidence,
      pinned: payload.pinned ?? row.pinned,
      memoryItemStatus: payload.memoryItemStatus ?? row.memoryItemStatus,
      alwaysInclude: payload.alwaysInclude ?? row.alwaysInclude,
      neverForget: payload.neverForget ?? row.neverForget,
      userLocked: payload.userLocked ?? row.userLocked,
      content: payload.value ?? row.content ?? row.value,
      updatedAt: new Date(),
    })
    .where(eq(agentMemory.id, id));

  return context.json({ ok: true });
});

router.delete('/:id', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();

  const row = await db.query.agentMemory.findFirst({
    where: and(eq(agentMemory.id, id), eq(agentMemory.orgId, org.orgId)),
  });

  if (!row) {
    return context.json({ error: 'Not found' }, 404);
  }

  if (!canEditScope(org, row.scope, row.userId)) {
    return context.json({ error: 'Forbidden' }, 403);
  }

  await db
    .update(agentMemory)
    .set({
      memoryItemStatus: 'deleted',
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentMemory.id, id));

  return context.json({ ok: true });
});

router.post('/:id/archive', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();

  const row = await db.query.agentMemory.findFirst({
    where: and(eq(agentMemory.id, id), eq(agentMemory.orgId, org.orgId)),
  });

  if (!row || !canEditScope(org, row.scope, row.userId)) {
    return context.json({ error: 'Forbidden or not found' }, row ? 403 : 404);
  }

  await db
    .update(agentMemory)
    .set({
      memoryItemStatus: 'archived',
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentMemory.id, id));

  return context.json({ ok: true });
});

router.post('/:id/pin', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();

  const row = await db.query.agentMemory.findFirst({
    where: and(eq(agentMemory.id, id), eq(agentMemory.orgId, org.orgId)),
  });

  if (!row || !canEditScope(org, row.scope, row.userId)) {
    return context.json({ error: 'Forbidden or not found' }, row ? 403 : 404);
  }

  await db
    .update(agentMemory)
    .set({
      pinned: true,
      updatedAt: new Date(),
    })
    .where(eq(agentMemory.id, id));

  return context.json({ ok: true });
});

router.post('/:id/always-include', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();

  const row = await db.query.agentMemory.findFirst({
    where: and(eq(agentMemory.id, id), eq(agentMemory.orgId, org.orgId)),
  });

  if (!row || !canEditScope(org, row.scope, row.userId)) {
    return context.json({ error: 'Forbidden or not found' }, row ? 403 : 404);
  }

  await db
    .update(agentMemory)
    .set({ alwaysInclude: true, updatedAt: new Date() })
    .where(eq(agentMemory.id, id));

  return context.json({ ok: true });
});

router.post('/:id/never-forget', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();

  const row = await db.query.agentMemory.findFirst({
    where: and(eq(agentMemory.id, id), eq(agentMemory.orgId, org.orgId)),
  });

  if (!row || !canEditScope(org, row.scope, row.userId)) {
    return context.json({ error: 'Forbidden or not found' }, row ? 403 : 404);
  }

  await db
    .update(agentMemory)
    .set({ neverForget: true, updatedAt: new Date() })
    .where(eq(agentMemory.id, id));

  return context.json({ ok: true });
});

router.post('/:id/lock', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();

  const row = await db.query.agentMemory.findFirst({
    where: and(eq(agentMemory.id, id), eq(agentMemory.orgId, org.orgId)),
  });

  if (!row || !canEditScope(org, row.scope, row.userId)) {
    return context.json({ error: 'Forbidden or not found' }, row ? 403 : 404);
  }

  await db
    .update(agentMemory)
    .set({ userLocked: true, updatedAt: new Date() })
    .where(eq(agentMemory.id, id));

  return context.json({ ok: true });
});

router.post('/:id/unlock', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();

  const row = await db.query.agentMemory.findFirst({
    where: and(eq(agentMemory.id, id), eq(agentMemory.orgId, org.orgId)),
  });

  if (!row || !canEditScope(org, row.scope, row.userId)) {
    return context.json({ error: 'Forbidden or not found' }, row ? 403 : 404);
  }

  await db
    .update(agentMemory)
    .set({ userLocked: false, updatedAt: new Date() })
    .where(eq(agentMemory.id, id));

  return context.json({ ok: true });
});

router.post('/:id/mark-incorrect', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();

  const row = await db.query.agentMemory.findFirst({
    where: and(eq(agentMemory.id, id), eq(agentMemory.orgId, org.orgId)),
  });

  if (!row || !canEditScope(org, row.scope, row.userId)) {
    return context.json({ error: 'Forbidden or not found' }, row ? 403 : 404);
  }

  await db
    .update(agentMemory)
    .set({
      memoryItemStatus: 'pending_review',
      metadata: { ...(row.metadata ?? {}), markedIncorrect: true, markedBy: org.userId },
      updatedAt: new Date(),
    })
    .where(eq(agentMemory.id, id));

  await downgradeMemory(id, 'marked_incorrect', { orgId: org.orgId });

  await insertMemoryEvent({
    orgId: org.orgId,
    userId: org.userId,
    eventType: 'memory_marked_incorrect',
    title: 'Memory flagged as incorrect',
    description: row.title ?? row.key,
    sourceType: 'user_action',
  });

  return context.json({ ok: true });
});

export default router;

import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { getRuntimeAgentContract } from '../agents/runtime.js';
import { db } from '../db/index.js';
import { agentMemory } from '../db/schema.js';

const MAX_MEMORIES_PER_SCOPE = 50;
const MEMORY_DECAY_WINDOW_DAYS = 45;
const DEFAULT_READ_SCOPES = ['org', 'user'];
const DEFAULT_WRITE_SCOPES = ['org', 'user'];
const MEMORY_SCOPE_PRIORITY = {
  temporary_session: 6,
  workflow_run: 5,
  restricted: 4,
  user: 3,
  agent_private: 2,
  org: 1,
};

const scopeEq = (value) => sql`${agentMemory.scope}::text = ${value}`;

export async function getAgentMemory({
  orgId,
  userId = null,
  agentId,
  workflowRunId = null,
  sessionKey = null,
  limit = 20,
  contract = getRuntimeAgentContract(agentId),
}) {
  const scopePredicates = buildReadableScopePredicates({
    orgId,
    userId,
    agentId,
    workflowRunId,
    sessionKey,
    contract,
  });

  if (scopePredicates.length === 0) {
    return [];
  }

  const now = new Date();
  let memories = [];
  try {
    memories = await db.query.agentMemory.findMany({
      where: and(
        eq(agentMemory.orgId, orgId),
        or(...scopePredicates),
        or(isNull(agentMemory.expiresAt), gt(agentMemory.expiresAt, now)),
      ),
      orderBy: [desc(agentMemory.updatedAt)],
      limit: Math.max(limit * 3, limit),
    });
  } catch (error) {
    console.warn('[MEMORY] Failed to load agent memory, continuing without memory:', error.message);
    return [];
  }

  const scopedMemories = mergeMemoryScopes(
    memories
      .filter((entry) =>
        isMemoryEntryReadableByAgent({
          entry,
          orgId,
          userId,
          agentId,
          workflowRunId,
          sessionKey,
          contract,
        }),
      )
      .map((entry) => ({
        ...entry,
        effectiveConfidence: applyMemoryDecay(entry),
      }))
      .sort(compareMemoryPriority),
    limit,
  );

  if (scopedMemories.length > 0) {
    const memoryIds = scopedMemories.map((memory) => memory.id);

    db.update(agentMemory)
      .set({
        lastUsedAt: now,
        usageCount: sql`${agentMemory.usageCount} + 1`,
      })
      .where(inArray(agentMemory.id, memoryIds))
      .catch((error) => {
        console.error('[MEMORY] Failed to update usage:', error.message);
      });
  }

  return scopedMemories;
}

export function isMemoryEntryReadableByAgent({
  entry,
  orgId,
  userId = null,
  agentId,
  workflowRunId = null,
  sessionKey = null,
  contract = getRuntimeAgentContract(agentId),
}) {
  if (!entry) {
    return false;
  }

  const allowedScopes = contract?.memoryPolicy?.readScopes ?? DEFAULT_READ_SCOPES;
  if (!allowedScopes.includes(entry.scope)) {
    return false;
  }

  switch (entry.scope) {
    case 'org':
      return entry.scopeKey === `org:${orgId}`;
    case 'user':
      return Boolean(userId) && entry.scopeKey === `user:${userId}`;
    case 'agent_private':
      return entry.scopeKey === `agent:${agentId}`;
    case 'restricted':
      return (
        entry.scopeKey === `restricted:agent:${agentId}`
        || (Boolean(userId) && entry.scopeKey === `restricted:user:${userId}`)
      );
    case 'workflow_run':
      return Boolean(workflowRunId) && entry.scopeKey === `workflow:${workflowRunId}`;
    case 'temporary_session':
      return Boolean(sessionKey) && entry.scopeKey === `session:${sessionKey}`;
    default:
      return false;
  }
}

export async function upsertMemory({
  orgId,
  userId = null,
  agentId,
  scope = 'org',
  workflowRunId = null,
  sessionKey = null,
  memoryType,
  key,
  value,
  metadata = {},
  confidence = 0.7,
  provenanceKind = 'inferred',
  sourceRef = null,
  expiresAt = null,
}) {
  const contract = getRuntimeAgentContract(agentId);
  const normalizedScope = normalizeMemoryScope(scope);

  if (!canWriteMemoryScope(contract, normalizedScope)) {
    throw Object.assign(new Error(`Agent ${agentId} is not permitted to write ${normalizedScope} memory.`), {
      code: 'MEMORY_SCOPE_WRITE_FORBIDDEN',
      status: 403,
    });
  }

  const scopeIdentity = buildScopeIdentity({
    scope: normalizedScope,
    orgId,
    userId,
    agentId,
    workflowRunId,
    sessionKey,
  });

  const existing = await db.query.agentMemory.findFirst({
    where: and(
      eq(agentMemory.orgId, orgId),
      eq(agentMemory.agentId, agentId),
      eq(agentMemory.scope, normalizedScope),
      eq(agentMemory.scopeKey, scopeIdentity.scopeKey),
      eq(agentMemory.key, key),
    ),
  });

  const nextConfidence = clampConfidence(
    existing ? Math.max(existing.confidence ?? 0.5, confidence) : confidence,
  );
  const nextProvenanceKind = normalizeProvenanceKind(provenanceKind, nextConfidence);
  const now = new Date();

  if (existing) {
    const mergedMetadata = {
      ...(existing.metadata ?? {}),
      ...metadata,
      lastSource: sourceRef ?? metadata.source ?? existing.sourceRef ?? existing.metadata?.lastSource ?? 'unknown',
      conflict: existing.value !== value,
      previousValue: existing.value !== value ? existing.value : existing.metadata?.previousValue,
      scope: normalizedScope,
    };

    await db
      .update(agentMemory)
      .set({
        userId: scopeIdentity.userId,
        workflowRunId: scopeIdentity.workflowRunId,
        sessionKey: scopeIdentity.sessionKey,
        value,
        memoryType,
        metadata: mergedMetadata,
        sourceRef: sourceRef ?? existing.sourceRef,
        provenanceKind: nextProvenanceKind,
        confidence: nextConfidence,
        version: (existing.version ?? 1) + 1,
        confirmedAt:
          nextProvenanceKind === 'confirmed'
            ? existing.confirmedAt ?? now
            : existing.confirmedAt,
        expiresAt: expiresAt ? new Date(expiresAt) : existing.expiresAt,
        updatedAt: now,
      })
      .where(eq(agentMemory.id, existing.id));

    return {
      id: existing.id,
      key,
      scope: normalizedScope,
      scopeKey: scopeIdentity.scopeKey,
      created: false,
      conflict: existing.value !== value,
      provenanceKind: nextProvenanceKind,
    };
  }

  const [created] = await db
    .insert(agentMemory)
    .values({
      orgId,
      userId: scopeIdentity.userId,
      agentId,
      scope: normalizedScope,
      scopeKey: scopeIdentity.scopeKey,
      workflowRunId: scopeIdentity.workflowRunId,
      sessionKey: scopeIdentity.sessionKey,
      memoryType,
      key,
      value,
      metadata: {
        ...metadata,
        scope: normalizedScope,
      },
      provenanceKind: nextProvenanceKind,
      sourceRef,
      confidence: nextConfidence,
      confirmedAt: nextProvenanceKind === 'confirmed' ? now : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .returning({ id: agentMemory.id });

  await pruneMemories({
    orgId,
    agentId,
    scope: normalizedScope,
    scopeKey: scopeIdentity.scopeKey,
  });

  return {
    id: created.id,
    key,
    scope: normalizedScope,
    scopeKey: scopeIdentity.scopeKey,
    created: true,
    conflict: false,
    provenanceKind: nextProvenanceKind,
  };
}

export async function confirmMemory(memoryId) {
  await db
    .update(agentMemory)
    .set({
      confidence: 1,
      provenanceKind: 'confirmed',
      confirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentMemory.id, memoryId));
}

export async function deleteMemory(memoryId) {
  await db.delete(agentMemory).where(eq(agentMemory.id, memoryId));
}

export async function clearAgentMemory({
  orgId,
  agentId,
  scope = null,
  userId = null,
  workflowRunId = null,
  sessionKey = null,
}) {
  const normalizedScope = scope ? normalizeMemoryScope(scope) : null;
  const scopeIdentity = normalizedScope
    ? buildScopeIdentity({
        scope: normalizedScope,
        orgId,
        userId,
        agentId,
        workflowRunId,
        sessionKey,
      })
    : null;

  await db
    .delete(agentMemory)
    .where(
      and(
        eq(agentMemory.orgId, orgId),
        eq(agentMemory.agentId, agentId),
        normalizedScope ? eq(agentMemory.scope, normalizedScope) : undefined,
        scopeIdentity ? eq(agentMemory.scopeKey, scopeIdentity.scopeKey) : undefined,
      ),
    );
}

export async function extractMemoryFromTurn({
  orgId,
  userId = null,
  agentId,
  conversationId = null,
  userMessage,
}) {
  const contract = getRuntimeAgentContract(agentId);
  const patterns = [
    { regex: /I prefer (.+?)(?:\.|$)/i, type: 'preference', prefix: 'pref_', scope: 'user' },
    { regex: /I(?:'d| would) like (.+?)(?:\.|$)/i, type: 'preference', prefix: 'pref_', scope: 'user' },
    { regex: /always (.+?)(?:\.|$)/i, type: 'instruction', prefix: 'always_', scope: 'user' },
    { regex: /never (.+?)(?:\.|$)/i, type: 'instruction', prefix: 'never_', scope: 'user' },
    { regex: /my writing style is (.+?)(?:\.|$)/i, type: 'pattern', prefix: 'style_', scope: 'user' },
    { regex: /my (?:company|business) is (.+?)(?:\.|,|$)/i, type: 'fact', prefix: 'company_', scope: 'org' },
    { regex: /we(?:'re| are) based in (.+?)(?:\.|,|$)/i, type: 'fact', prefix: 'location_', scope: 'org' },
    { regex: /our brand voice is (.+?)(?:\.|$)/i, type: 'instruction', prefix: 'brand_voice_', scope: 'org' },
    { regex: /our ideal customer is (.+?)(?:\.|$)/i, type: 'fact', prefix: 'icp_', scope: 'org' },
    { regex: /remember this for this chat(?: only)?[: ]+(.+?)(?:\.|$)/i, type: 'instruction', prefix: 'session_', scope: 'temporary_session' },
  ];

  const extracted = [];

  for (const pattern of patterns) {
    const match = userMessage.match(pattern.regex);

    if (!match) {
      continue;
    }

    const value = match[1].trim();

    if (value.length < 3 || value.length > 200) {
      continue;
    }

    const normalizedValue = value.toLowerCase().replace(/\s+/g, '_').slice(0, 40);
    extracted.push({
      scope: pattern.scope,
      memoryType: pattern.type,
      key: `${pattern.prefix}${normalizedValue}`,
      value,
      metadata: {
        source: 'chat_turn',
        inferred: true,
      },
      provenanceKind: 'inferred',
      sourceRef: conversationId ? `conversation:${conversationId}` : 'chat_turn',
      confidence: pattern.scope === 'temporary_session' ? 0.8 : 0.65,
      sessionKey: pattern.scope === 'temporary_session' && conversationId ? `conversation:${conversationId}` : null,
    });
  }

  const writes = await Promise.all(
    extracted.map((memory) =>
      canWriteMemoryScope(contract, memory.scope)
        ? upsertMemory({
            orgId,
            userId: shouldScopeTrackUser(memory.scope) ? userId : null,
            agentId,
            scope: memory.scope,
            sessionKey: memory.sessionKey,
            memoryType: memory.memoryType,
            key: memory.key,
            value: memory.value,
            metadata: memory.metadata,
            confidence: memory.confidence,
            provenanceKind: memory.provenanceKind,
            sourceRef: memory.sourceRef,
            expiresAt:
              memory.scope === 'temporary_session'
                ? new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
                : null,
          })
        : Promise.resolve({
            id: null,
            key: memory.key,
            scope: memory.scope,
            created: false,
            conflict: false,
            skipped: true,
          }),
    ),
  );

  return extracted.map((memory, index) => ({
    ...memory,
    id: writes[index]?.id ?? null,
    memoryWriteKey: writes[index]?.key ?? memory.key,
    created: writes[index]?.created ?? false,
    conflict: writes[index]?.conflict ?? false,
  }));
}

function buildReadableScopePredicates({ orgId, userId, agentId, workflowRunId, sessionKey, contract }) {
  const allowedScopes = contract?.memoryPolicy?.readScopes ?? DEFAULT_READ_SCOPES;
  const predicates = [];

  if (allowedScopes.includes('org')) {
    predicates.push(and(scopeEq('org'), eq(agentMemory.scopeKey, `org:${orgId}`)));
  }

  if (allowedScopes.includes('user') && userId) {
    predicates.push(
      and(
        scopeEq('user'),
        eq(agentMemory.userId, userId),
        eq(agentMemory.scopeKey, `user:${userId}`),
      ),
    );
  }

  if (allowedScopes.includes('agent_private')) {
    predicates.push(
      and(scopeEq('agent_private'), eq(agentMemory.scopeKey, `agent:${agentId}`)),
    );
  }

  if (allowedScopes.includes('restricted')) {
    const restrictedPredicates = [
      and(scopeEq('restricted'), eq(agentMemory.scopeKey, `restricted:agent:${agentId}`)),
    ];

    if (userId) {
      restrictedPredicates.push(
        and(
          scopeEq('restricted'),
          eq(agentMemory.userId, userId),
          eq(agentMemory.scopeKey, `restricted:user:${userId}`),
        ),
      );
    }

    predicates.push(or(...restrictedPredicates));
  }

  if (allowedScopes.includes('workflow_run') && workflowRunId) {
    predicates.push(
      and(
        scopeEq('workflow_run'),
        eq(agentMemory.workflowRunId, workflowRunId),
        eq(agentMemory.scopeKey, `workflow:${workflowRunId}`),
      ),
    );
  }

  if (allowedScopes.includes('temporary_session') && sessionKey) {
    predicates.push(
      and(
        scopeEq('temporary_session'),
        eq(agentMemory.sessionKey, sessionKey),
        eq(agentMemory.scopeKey, `session:${sessionKey}`),
      ),
    );
  }

  return predicates;
}

async function pruneMemories({ orgId, agentId, scope, scopeKey }) {
  const memories = await db.query.agentMemory.findMany({
    where: and(
      eq(agentMemory.orgId, orgId),
      eq(agentMemory.agentId, agentId),
      eq(agentMemory.scope, scope),
      eq(agentMemory.scopeKey, scopeKey),
    ),
    orderBy: [asc(agentMemory.confidence), asc(agentMemory.lastUsedAt)],
  });

  if (memories.length <= MAX_MEMORIES_PER_SCOPE) {
    return;
  }

  const toDelete = memories
    .filter((memory) => (memory.provenanceKind ?? 'inferred') !== 'confirmed')
    .slice(0, memories.length - MAX_MEMORIES_PER_SCOPE);

  if (toDelete.length === 0) {
    return;
  }

  await db.delete(agentMemory).where(inArray(agentMemory.id, toDelete.map((memory) => memory.id)));
}

function mergeMemoryScopes(memories, limit) {
  const seenKeys = new Set();
  const ordered = [];

  for (const entry of memories) {
    const dedupeKey = `${entry.memoryType}:${entry.key}`;

    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    seenKeys.add(dedupeKey);
    ordered.push(entry);

    if (ordered.length >= limit) {
      break;
    }
  }

  return ordered;
}

function compareMemoryPriority(left, right) {
  const rightPriority = MEMORY_SCOPE_PRIORITY[right.scope] ?? 0;
  const leftPriority = MEMORY_SCOPE_PRIORITY[left.scope] ?? 0;

  if (rightPriority !== leftPriority) {
    return rightPriority - leftPriority;
  }

  if (right.effectiveConfidence !== left.effectiveConfidence) {
    return right.effectiveConfidence - left.effectiveConfidence;
  }

  return new Date(right.lastUsedAt ?? right.updatedAt ?? right.createdAt ?? 0).getTime()
    - new Date(left.lastUsedAt ?? left.updatedAt ?? left.createdAt ?? 0).getTime();
}

function applyMemoryDecay(entry) {
  const baseConfidence = entry.confidence ?? 0.5;
  const referenceDate = entry.lastUsedAt ?? entry.updatedAt ?? entry.createdAt;

  if (!referenceDate) {
    return baseConfidence;
  }

  const ageMs = Date.now() - new Date(referenceDate).getTime();
  const ageDays = Math.max(ageMs / (1000 * 60 * 60 * 24), 0);
  const decay = (entry.provenanceKind ?? 'inferred') === 'confirmed'
    ? Math.min(ageDays / (MEMORY_DECAY_WINDOW_DAYS * 2), 0.2)
    : Math.min(ageDays / MEMORY_DECAY_WINDOW_DAYS, 0.35);

  return Number(Math.max(baseConfidence - decay, 0.05).toFixed(4));
}

function canWriteMemoryScope(contract, scope) {
  const allowedScopes = contract?.memoryPolicy?.writeScopes ?? DEFAULT_WRITE_SCOPES;
  return allowedScopes.includes(scope);
}

function normalizeMemoryScope(scope = 'org') {
  const normalized = String(scope ?? 'org').toLowerCase();
  if (Object.hasOwn(MEMORY_SCOPE_PRIORITY, normalized)) {
    return normalized;
  }
  return normalized === 'user' ? 'user' : 'org';
}

function normalizeProvenanceKind(kind, confidence) {
  const normalized = String(kind ?? '').toLowerCase();

  if (normalized === 'confirmed') {
    return 'confirmed';
  }

  if (normalized === 'inferred') {
    return 'inferred';
  }

  return confidence >= 0.95 ? 'confirmed' : 'inferred';
}

function clampConfidence(confidence) {
  return Math.min(Math.max(Number(confidence ?? 0.5), 0), 1);
}

function buildScopeIdentity({ scope, orgId, userId, agentId, workflowRunId, sessionKey }) {
  switch (scope) {
    case 'user':
      if (!userId) {
        throw Object.assign(new Error('User-scoped memory requires userId.'), {
          code: 'MEMORY_SCOPE_USER_REQUIRED',
        });
      }
      return {
        scopeKey: `user:${userId}`,
        userId,
        workflowRunId: null,
        sessionKey: null,
      };
    case 'agent_private':
      return {
        scopeKey: `agent:${agentId}`,
        userId: null,
        workflowRunId: null,
        sessionKey: null,
      };
    case 'restricted':
      return {
        scopeKey: userId ? `restricted:user:${userId}` : `restricted:agent:${agentId}`,
        userId: userId ?? null,
        workflowRunId: null,
        sessionKey: null,
      };
    case 'workflow_run':
      if (!workflowRunId) {
        throw Object.assign(new Error('Workflow-run-scoped memory requires workflowRunId.'), {
          code: 'MEMORY_SCOPE_WORKFLOW_REQUIRED',
        });
      }
      return {
        scopeKey: `workflow:${workflowRunId}`,
        userId: null,
        workflowRunId,
        sessionKey: null,
      };
    case 'temporary_session':
      if (!sessionKey) {
        throw Object.assign(new Error('Temporary-session memory requires sessionKey.'), {
          code: 'MEMORY_SCOPE_SESSION_REQUIRED',
        });
      }
      return {
        scopeKey: `session:${sessionKey}`,
        userId: userId ?? null,
        workflowRunId: null,
        sessionKey,
      };
    case 'org':
    default:
      return {
        scopeKey: `org:${orgId}`,
        userId: null,
        workflowRunId: null,
        sessionKey: null,
      };
  }
}

function shouldScopeTrackUser(scope) {
  return scope === 'user' || scope === 'restricted' || scope === 'temporary_session';
}

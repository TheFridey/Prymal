import { and, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { getRuntimeAgentContract } from '../agents/runtime.js';
import { getMemorySessionTtlHours, getMemoryWorkflowTtlHours } from '../env.js';
import { db } from '../db/index.js';
import { agentMemory } from '../db/schema.js';
import { reviewMemoryCandidate } from './memory-safety.js';
import { getMemoryPolicyForAgent } from './memory-policies.js';
import { insertMemoryEvent } from './memory-events.js';
import { evaluateMemoryPromotion, recordPromotionEvaluation } from './memory-promotion.js';
import { processContradictionsAfterUpsert } from './memory-contradictions.js';
import { calculateMemoryDecay } from './memory-decay.js';
import { confirmMemoryConfidence } from './memory-confidence.js';
import { detectDuplicateMemories, mergeMemoryIntoExisting } from './memory-duplicates.js';
import { enforceMemoryCapsForBucket } from './memory-caps.js';

const MEMORY_FRESH_DAYS = 14;
const MEMORY_AGING_DAYS = 30;
const MEMORY_STALE_DAYS = 60;
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
const SENSITIVE_WRITE_SCOPES = new Set(['restricted', 'org', 'workflow_run']);

function visibilityForScope(scope) {
  switch (scope) {
    case 'user':
      return 'user_private';
    case 'agent_private':
      return 'agent_private_visible';
    case 'restricted':
      return 'restricted_visible';
    default:
      return 'org_shared';
  }
}

function resolveExpiresAtForScope(normalizedScope, expiresAt) {
  if (expiresAt) {
    return new Date(expiresAt);
  }

  if (normalizedScope === 'workflow_run') {
    return new Date(Date.now() + getMemoryWorkflowTtlHours() * 60 * 60 * 1000);
  }

  return null;
}

const scopeEq = (value) => sql`${agentMemory.scope}::text = ${value}`;

export async function getAgentMemory({
  orgId,
  userId = null,
  agentId,
  workflowRunId = null,
  sessionKey = null,
  limit = 20,
  contract = getRuntimeAgentContract(agentId),
  retrievalPolicy = null,
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

  const rp = retrievalPolicy ?? getMemoryPolicyForAgent(agentId);
  const allowedStatuses = ['active', 'pending_review'];
  if (rp.includeConflicted !== false) {
    allowedStatuses.push('conflicted');
  }
  if (rp.includeExpired) {
    allowedStatuses.push('expired');
  }

  const now = new Date();
  let memories = [];
  try {
    memories = await db.query.agentMemory.findMany({
      where: and(
        eq(agentMemory.orgId, orgId),
        or(...scopePredicates),
        ...(rp.includeExpired ? [] : [or(isNull(agentMemory.expiresAt), gt(agentMemory.expiresAt, now))]),
        inArray(agentMemory.memoryItemStatus, allowedStatuses),
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
      .map((entry) => {
        const { decayFactor, reason } = calculateMemoryDecay(entry, now);
        const baseConf = entry.confidence ?? 0.5;
        const effectiveConfidence = Number(Math.min(1, Math.max(0.05, baseConf * decayFactor)).toFixed(4));
        return {
          ...entry,
          decayFactor,
          decayReason: reason,
          effectiveConfidence,
          status: getMemoryStatus(entry),
          provenanceLabel: getProvenanceLabel(entry),
          displaySource: getDisplaySource(entry),
        };
      })
      .sort(compareMemoryPriority),
    limit,
  );

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

async function runMemoryPostWriteHooks({ orgId, agentId, memoryId, normalizedScope, operation }) {
  const memoryFeedback = [];

  memoryFeedback.push({
    type: operation === 'update' ? 'updated' : 'saved',
    message: operation === 'update' ? 'Updated memory' : 'Saved to memory',
  });

  try {
    const row = await db.query.agentMemory.findFirst({
      where: and(eq(agentMemory.orgId, orgId), eq(agentMemory.id, memoryId)),
    });

    if (!row || row.memoryItemStatus === 'rejected') {
      return { memoryFeedback };
    }

    if (normalizedScope === 'temporary_session') {
      const decision = evaluateMemoryPromotion(
        {
          scope: row.scope,
          memoryType: row.memoryType,
          confidence: row.confidence,
        },
        {
          repetitionCount: 0,
          explicitUserInstruction: false,
          workflowRunId: row.workflowRunId,
        },
      );

      await recordPromotionEvaluation(orgId, decision, row.id, { source: 'chat_upsert' }).catch(() => {});

      if (decision.shouldPromote) {
        memoryFeedback.push({
          type: 'promoted',
          message: 'Promoted to long-term memory',
          detail: decision.reason,
        });

        await insertMemoryEvent({
          orgId,
          userId: row.userId ?? null,
          agentId: row.agentId ?? null,
          workflowRunId: row.workflowRunId ?? null,
          eventType: 'memory_promoted',
          title: 'Promoted to long-term memory',
          description: decision.reason,
          importanceScore: 0.58,
          sourceType: 'memory_promotion',
          sourceRef: row.id,
          metadata: { evaluation: decision },
        }).catch(() => {});
      }

      return { memoryFeedback };
    }

    await insertMemoryEvent({
      orgId,
      userId: row.userId ?? null,
      agentId: row.agentId ?? null,
      workflowRunId: row.workflowRunId ?? null,
      eventType: 'memory_saved',
      title: 'Memory saved',
      description: `${row.memoryType ?? 'memory'} · ${String(row.value ?? '').slice(0, 120)}`,
      importanceScore: 0.42,
      sourceType: 'memory_pipeline',
      sourceRef: row.id,
      metadata: { memoryType: row.memoryType, memoryId: row.id, scope: row.scope },
    }).catch(() => {});

    const { feedback = [] } = await processContradictionsAfterUpsert({ orgId, memoryRow: row, agentId });
    memoryFeedback.push(...feedback);
    return { memoryFeedback };
  } catch (error) {
    console.warn('[MEMORY] Post-write hooks failed:', error.message);
    return { memoryFeedback };
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

  const safety = reviewMemoryCandidate({
    content: value,
    title: key,
    memorySourceKind: metadata.memorySourceKind ?? 'conversation',
    authorityHint: metadata.authorityHint,
  });

  if (safety.status === 'rejected') {
    console.warn('[MEMORY] Candidate rejected', safety.reasons);
    return {
      id: null,
      key,
      scope: normalizedScope,
      skipped: true,
      rejected: true,
      reasons: safety.reasons,
      memoryFeedback: [],
    };
  }

  const resolvedStatus = safety.status === 'pending_review' ? 'pending_review' : 'active';

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
        content: value,
        title: metadata.title ?? existing.title ?? key,
        version: (existing.version ?? 1) + 1,
        confirmedAt:
          nextProvenanceKind === 'confirmed'
            ? existing.confirmedAt ?? now
            : existing.confirmedAt,
        expiresAt:
          expiresAt != null
            ? new Date(expiresAt)
            : normalizedScope === 'workflow_run'
              ? resolveExpiresAtForScope(normalizedScope, null)
              : existing.expiresAt,
        updatedAt: now,
      })
      .where(eq(agentMemory.id, existing.id));

    recordSensitiveMemoryWrite({
      orgId,
      agentId,
      scope: normalizedScope,
      key,
      scopeKey: scopeIdentity.scopeKey,
      contract,
      action: 'update',
    });

    const postUpdate = await runMemoryPostWriteHooks({
      orgId,
      agentId,
      memoryId: existing.id,
      normalizedScope,
      operation: 'update',
    });

    return {
      id: existing.id,
      key,
      scope: normalizedScope,
      scopeKey: scopeIdentity.scopeKey,
      created: false,
      conflict: existing.value !== value,
      provenanceKind: nextProvenanceKind,
      memoryFeedback: postUpdate.memoryFeedback,
    };
  }

  try {
    const dupes = await detectDuplicateMemories(
      {
        value,
        scope: normalizedScope,
        scopeKey: scopeIdentity.scopeKey,
        memoryType,
        key,
      },
      orgId,
      agentId,
    );

    const best = dupes.find((d) => d.mergeRecommended && (d.similarityScore ?? 0) >= 0.75);
    if (best) {
      const merged = await mergeMemoryIntoExisting({
        orgId,
        agentId,
        existingMemoryId: best.memoryId,
        candidate: { value, sourceRef, metadata },
      });

      if (merged.merged) {
        return {
          id: best.memoryId,
          key,
          scope: normalizedScope,
          scopeKey: scopeIdentity.scopeKey,
          created: false,
          merged: true,
          conflict: false,
          provenanceKind: nextProvenanceKind,
          memoryFeedback: merged.memoryFeedback ?? [],
        };
      }
    }
  } catch (dupErr) {
    console.warn('[MEMORY] Duplicate merge skipped:', dupErr.message);
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
      content: value,
      title: metadata.title ?? key,
      metadata: {
        ...metadata,
        scope: normalizedScope,
      },
      provenanceKind: nextProvenanceKind,
      sourceRef,
      confidence: nextConfidence,
      confirmedAt: nextProvenanceKind === 'confirmed' ? now : null,
      expiresAt: resolveExpiresAtForScope(normalizedScope, expiresAt),
      memoryItemStatus: resolvedStatus,
      visibility: visibilityForScope(normalizedScope),
    })
    .returning({ id: agentMemory.id });

  await enforceMemoryCapsForBucket({
    orgId,
    agentId,
    scope: normalizedScope,
    scopeKey: scopeIdentity.scopeKey,
    memoryType,
    userId,
  }).catch((err) => console.warn('[MEMORY] Cap enforcement skipped:', err.message));

  recordSensitiveMemoryWrite({
    orgId,
    agentId,
    scope: normalizedScope,
    key,
    scopeKey: scopeIdentity.scopeKey,
    contract,
    action: 'create',
  });

  const postCreate = await runMemoryPostWriteHooks({
    orgId,
    agentId,
    memoryId: created.id,
    normalizedScope,
    operation: 'create',
  });

  return {
    id: created.id,
    key,
    scope: normalizedScope,
    scopeKey: scopeIdentity.scopeKey,
    created: true,
    conflict: false,
    provenanceKind: nextProvenanceKind,
    memoryFeedback: postCreate.memoryFeedback,
  };
}

export async function confirmMemory(memoryId, options = {}) {
  await confirmMemoryConfidence(memoryId, options);
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
                ? new Date(Date.now() + getMemorySessionTtlHours() * 60 * 60 * 1000)
                : null,
          })
        : Promise.resolve({
            id: null,
            key: memory.key,
            scope: memory.scope,
            created: false,
            conflict: false,
            skipped: true,
            memoryFeedback: [],
          }),
    ),
  );

  return extracted.map((memory, index) => ({
    ...memory,
    id: writes[index]?.id ?? null,
    memoryWriteKey: writes[index]?.key ?? memory.key,
    created: writes[index]?.created ?? false,
    conflict: writes[index]?.conflict ?? false,
    memoryFeedback: writes[index]?.memoryFeedback ?? [],
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

  if (Boolean(right.alwaysInclude) !== Boolean(left.alwaysInclude)) {
    return right.alwaysInclude ? 1 : -1;
  }

  if (Boolean(right.pinned) !== Boolean(left.pinned)) {
    return right.pinned ? 1 : -1;
  }

  if (right.effectiveConfidence !== left.effectiveConfidence) {
    return right.effectiveConfidence - left.effectiveConfidence;
  }

  return new Date(right.lastUsedAt ?? right.updatedAt ?? right.createdAt ?? 0).getTime()
    - new Date(left.lastUsedAt ?? left.updatedAt ?? left.createdAt ?? 0).getTime();
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

/**
 * Compute a human-friendly age status for a memory entry.
 * Returns: 'fresh' | 'aging' | 'stale' | 'expired'.
 * Confirmed memories age more slowly than inferred ones.
 */
export function getMemoryStatus(entry) {
  if (!entry) return 'expired';

  if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now()) {
    return 'expired';
  }

  const referenceDate = entry.lastUsedAt ?? entry.updatedAt ?? entry.createdAt;
  if (!referenceDate) return 'fresh';

  const ageDays = Math.max((Date.now() - new Date(referenceDate).getTime()) / 86_400_000, 0);
  const isConfirmed = (entry.provenanceKind ?? 'inferred') === 'confirmed';
  const freshCutoff = isConfirmed ? MEMORY_FRESH_DAYS * 1.5 : MEMORY_FRESH_DAYS;
  const agingCutoff = isConfirmed ? MEMORY_AGING_DAYS * 1.5 : MEMORY_AGING_DAYS;
  const staleCutoff = isConfirmed ? MEMORY_STALE_DAYS * 1.5 : MEMORY_STALE_DAYS;

  if (ageDays <= freshCutoff) return 'fresh';
  if (ageDays <= agingCutoff) return 'aging';
  if (ageDays <= staleCutoff) return 'stale';
  return 'expired';
}

export function getProvenanceLabel(entry) {
  const kind = entry?.provenanceKind ?? 'inferred';
  return kind === 'confirmed' ? 'confirmed' : 'inferred';
}

export function getDisplaySource(entry) {
  if (!entry) return null;
  return (
    entry.sourceRef
    ?? entry.metadata?.lastSource
    ?? entry.metadata?.source
    ?? null
  );
}

/**
 * Emit an audit record when a sensitive memory write happens.
 * This is non-blocking — failures are logged but do not break the write.
 */
function recordSensitiveMemoryWrite({ orgId, agentId, scope, key, scopeKey, contract, action }) {
  const isSensitiveScope = SENSITIVE_WRITE_SCOPES.has(scope);
  const isSensitivePolicy = Boolean(contract?.memoryPolicy?.sensitiveWrites);

  if (!isSensitiveScope && !isSensitivePolicy) {
    return;
  }

  console.info(
    `[MEMORY AUDIT] org=${orgId} agent=${agentId} action=${action} scope=${scope} key=${key} scopeKey=${scopeKey}`,
  );
}

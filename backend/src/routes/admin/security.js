// routes/admin/security.js
// WARDEN classifier observability + security trace aggregation.
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/index.js';
import {
  adminActionLogs,
  conversations,
  llmExecutionTraces,
  organisations,
  users,
  wardenAuditEvents,
  workflowRiskConfirmations,
  workflowRuns,
} from '../../db/schema.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';
import {
  evaluateClassifierCap,
  getClassifierMetricsSnapshot,
} from '../../services/warden/warden-classifier-metrics.js';

const router = new Hono();

router.get(
  '/security/warden',
  requireStaff,
  requireStaffPermission('admin.activity.read'),
  async (context) => {
    const { filters, limit, offset } = buildWardenFilters(context);
    const rows = await db.query.wardenAuditEvents.findMany({
      where: filters.length > 0 ? and(...filters) : undefined,
      orderBy: [desc(wardenAuditEvents.createdAt)],
      limit,
      offset,
    });

    return context.json({
      events: rows.map(safeWardenEvent),
      count: rows.length,
      limit,
      summary: summarizeWardenEvents(rows),
    });
  },
);

router.get(
  '/security/warden/:auditId',
  requireStaff,
  requireStaffPermission('admin.activity.read'),
  async (context) => {
    const { auditId } = context.req.param();
    const row = await db.query.wardenAuditEvents.findFirst({
      where: eq(wardenAuditEvents.id, auditId),
    });
    if (!row) return context.json({ error: 'WARDEN audit event not found.' }, 404);
    if (!canAccessOrg(context, row.orgId)) return context.json({ error: 'Cross-org access denied.' }, 403);

    return context.json({
      event: safeWardenEvent(row),
      modelClassifier: row.metadata?.modelClassifier ?? null,
      related: extractRelatedIdentifiers(row.metadata ?? {}),
      safeMetadata: stripUnsafeMetadata(row.metadata ?? {}),
    });
  },
);

router.get(
  '/security/workflow-confirmations',
  requireStaff,
  requireStaffPermission('admin.activity.read'),
  async (context) => {
    const limit = boundedLimit(context.req.query('limit'));
    const offset = Math.max(Number(context.req.query('offset') ?? 0), 0);
    const filters = [];
    const scopedOrgId = getScopedOrgId(context);
    if (scopedOrgId) filters.push(eq(workflowRiskConfirmations.orgId, scopedOrgId));

    const filterMap = [
      ['status', workflowRiskConfirmations.status],
      ['orgId', workflowRiskConfirmations.orgId],
      ['workflowId', workflowRiskConfirmations.workflowId],
    ];
    for (const [queryKey, column] of filterMap) {
      const value = context.req.query(queryKey);
      if (value) filters.push(eq(column, value));
    }
    const from = context.req.query('from');
    const to = context.req.query('to');
    if (from) filters.push(gte(workflowRiskConfirmations.createdAt, new Date(from)));
    if (to) filters.push(lte(workflowRiskConfirmations.createdAt, new Date(to)));

    const rows = await db.query.workflowRiskConfirmations.findMany({
      where: filters.length > 0 ? and(...filters) : undefined,
      orderBy: [desc(workflowRiskConfirmations.createdAt)],
      limit,
      offset,
    });

    return context.json({
      confirmations: rows.map(safeConfirmation),
      count: rows.length,
      limit,
    });
  },
);

router.get(
  '/security/classifier-metrics',
  requireStaff,
  requireStaffPermission('admin.activity.read'),
  async (context) => {
    const snapshot = getClassifierMetricsSnapshot();
    const cap = evaluateClassifierCap();
    return context.json({ snapshot, cap });
  },
);

router.get(
  '/security/dashboard',
  requireStaff,
  requireStaffPermission('admin.activity.read'),
  async (context) => {
    const sinceMs = 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - sinceMs);

    const [blockedRows, confirmRows, byCategoryRows, bySurfaceRows] = await Promise.all([
      db.query.wardenAuditEvents.findMany({
        where: and(gte(wardenAuditEvents.createdAt, since), eq(wardenAuditEvents.verdict, 'BLOCK')),
        limit: 200,
        orderBy: [desc(wardenAuditEvents.createdAt)],
      }),
      db.query.wardenAuditEvents.findMany({
        where: and(
          gte(wardenAuditEvents.createdAt, since),
          eq(wardenAuditEvents.verdict, 'REQUIRE_CONFIRMATION'),
        ),
        limit: 200,
        orderBy: [desc(wardenAuditEvents.createdAt)],
      }),
      db.query.wardenAuditEvents.findMany({
        where: gte(wardenAuditEvents.createdAt, since),
        limit: 1000,
        orderBy: [desc(wardenAuditEvents.createdAt)],
      }),
      db.query.wardenAuditEvents.findMany({
        where: gte(wardenAuditEvents.createdAt, since),
        limit: 1000,
        orderBy: [desc(wardenAuditEvents.createdAt)],
      }),
    ]);

    const categoryCounts = new Map();
    for (const row of byCategoryRows) {
      for (const category of row.categories ?? []) {
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      }
    }

    const surfaceCounts = new Map();
    for (const row of bySurfaceRows) {
      const key = `${row.surface}:${row.verdict}`;
      surfaceCounts.set(key, (surfaceCounts.get(key) ?? 0) + 1);
    }

    const snapshot = getClassifierMetricsSnapshot();

    return context.json({
      windowMs: sinceMs,
      blockCountLast24h: blockedRows.length,
      confirmationCountLast24h: confirmRows.length,
      classifierCacheHitRate: snapshot.rates.cacheHitRate,
      classifierFallbackRate: snapshot.rates.fallbackRate,
      classifierTimeoutRate: snapshot.rates.timeoutRate,
      classifierSkippedRate: snapshot.rates.skippedRate,
      topCategories: [...categoryCounts.entries()]
        .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
        .slice(0, 10)
        .map(([category, count]) => ({ category, count })),
      topBlockedSurfaces: [...surfaceCounts.entries()]
        .filter(([key]) => key.endsWith(':BLOCK'))
        .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
        .slice(0, 10)
        .map(([key, count]) => ({ surface: key.split(':')[0], count })),
      classifierMetrics: snapshot,
    });
  },
);

router.get(
  '/security/trace/:traceId/safety',
  requireStaff,
  requireStaffPermission('admin.activity.read'),
  async (context) => {
    const { traceId } = context.req.param();
    const payload = await buildSecurityTracePayload({ context, traceId });
    if (payload.status) {
      return context.json(payload.body, payload.status);
    }
    return context.json(payload.body);
  },
);

router.get(
  '/security-traces/:traceId',
  requireStaff,
  requireStaffPermission('admin.activity.read'),
  async (context) => {
    const { traceId } = context.req.param();
    const payload = await buildSecurityTracePayload({ context, traceId });
    if (payload.status) {
      return context.json(payload.body, payload.status);
    }
    return context.json(payload.body);
  },
);

export default router;

function boundedLimit(value, fallback = 100) {
  return Math.min(Math.max(Number(value ?? fallback) || fallback, 1), 500);
}

function getScopedOrgId(context) {
  const staff = context.get('staffMember') ?? context.get('user');
  return staff?.scopedOrgId ?? null;
}

function canAccessOrg(context, orgId) {
  const scopedOrgId = getScopedOrgId(context);
  return !scopedOrgId || !orgId || scopedOrgId === orgId;
}

function buildWardenFilters(context) {
  const limit = boundedLimit(context.req.query('limit'));
  const offset = Math.max(Number(context.req.query('offset') ?? 0), 0);
  const filters = [];
  const scopedOrgId = getScopedOrgId(context);
  if (scopedOrgId) filters.push(eq(wardenAuditEvents.orgId, scopedOrgId));

  const filterMap = [
    ['verdict', wardenAuditEvents.verdict],
    ['riskLevel', wardenAuditEvents.riskLevel],
    ['surface', wardenAuditEvents.surface],
    ['sourceType', wardenAuditEvents.sourceType],
    ['userId', wardenAuditEvents.userId],
    ['orgId', wardenAuditEvents.orgId],
    ['toolName', wardenAuditEvents.toolName],
    ['provider', wardenAuditEvents.provider],
  ];

  for (const [queryKey, column] of filterMap) {
    const value = context.req.query(queryKey);
    if (value) filters.push(eq(column, value));
  }
  const category = context.req.query('category');
  if (category) filters.push(sql`${wardenAuditEvents.categories}::jsonb ? ${category}`);
  const from = context.req.query('from');
  const to = context.req.query('to');
  if (from) filters.push(gte(wardenAuditEvents.createdAt, new Date(from)));
  if (to) filters.push(lte(wardenAuditEvents.createdAt, new Date(to)));

  return { filters, limit, offset };
}

function safeWardenEvent(event) {
  return {
    id: event.id,
    orgId: event.orgId,
    userId: event.userId,
    createdAt: event.createdAt,
    surface: event.surface,
    sourceType: event.sourceType,
    action: event.action,
    verdict: event.verdict,
    riskLevel: event.riskLevel,
    categories: event.categories ?? [],
    reasons: event.reasons ?? [],
    contentHash: event.contentHash,
    redactionCount: event.redactionCount,
    sourceUrl: event.sourceUrl,
    fileId: event.fileId,
    toolName: event.toolName,
    provider: event.provider,
    modelClassifier: event.metadata?.modelClassifier ?? null,
    ocr: extractOcrSummary(event.metadata ?? {}),
    metadata: stripUnsafeMetadata(event.metadata ?? {}),
  };
}

function summarizeWardenEvents(rows = []) {
  const summary = { verdicts: {}, risks: {}, categories: {} };
  for (const row of rows) {
    summary.verdicts[row.verdict] = (summary.verdicts[row.verdict] ?? 0) + 1;
    summary.risks[row.riskLevel] = (summary.risks[row.riskLevel] ?? 0) + 1;
    for (const category of row.categories ?? []) {
      summary.categories[category] = (summary.categories[category] ?? 0) + 1;
    }
  }
  return summary;
}

function extractRelatedIdentifiers(metadata = {}) {
  return {
    traceId: metadata.traceId ?? metadata.llmTraceId ?? null,
    conversationId: metadata.conversationId ?? null,
    messageId: metadata.messageId ?? null,
    workflowId: metadata.workflowId ?? null,
    workflowRunId: metadata.workflowRunId ?? null,
    mediaJobId: metadata.mediaJobId ?? null,
  };
}

async function buildSecurityTracePayload({ context, traceId }) {
  const wardenEvent = await db.query.wardenAuditEvents.findFirst({
    where: eq(wardenAuditEvents.id, traceId),
  });

  if (!wardenEvent) {
    return { status: 404, body: { error: 'Trace not found.' } };
  }

  if (!canAccessOrg(context, wardenEvent.orgId)) {
    return { status: 403, body: { error: 'Cross-org access denied.' } };
  }

  const metadata = wardenEvent.metadata ?? {};
  const conversationId = metadata.conversationId ?? null;
  const workflowRunId = metadata.workflowRunId ?? null;

  const [conversation, workflowRun, organisation, user, llmTrace, relatedActionReceipts, relatedConfirmations] = await Promise.all([
    conversationId
      ? db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) })
      : null,
    workflowRunId
      ? db.query.workflowRuns.findFirst({ where: eq(workflowRuns.id, workflowRunId) })
      : null,
    wardenEvent.orgId
      ? db.query.organisations.findFirst({ where: eq(organisations.id, wardenEvent.orgId) })
      : null,
    wardenEvent.userId
      ? db.query.users.findFirst({ where: eq(users.id, wardenEvent.userId) })
      : null,
    metadata.llmTraceId
      ? db.query.llmExecutionTraces.findFirst({ where: eq(llmExecutionTraces.id, metadata.llmTraceId) })
      : null,
    wardenEvent.orgId
      ? db.query.adminActionLogs.findMany({
        where: and(
          eq(adminActionLogs.orgId, wardenEvent.orgId),
          sql`${adminActionLogs.metadata}::jsonb ? ${'wardenAuditId'}`,
        ),
        orderBy: [desc(adminActionLogs.createdAt)],
        limit: 5,
      })
      : Promise.resolve([]),
    wardenEvent.orgId
      ? db.query.workflowRiskConfirmations.findMany({
        where: and(
          eq(workflowRiskConfirmations.orgId, wardenEvent.orgId),
          eq(workflowRiskConfirmations.wardenAuditId, wardenEvent.id),
        ),
        orderBy: [desc(workflowRiskConfirmations.createdAt)],
        limit: 5,
      })
      : Promise.resolve([]),
  ]);

  const timeline = [
    {
      kind: 'warden',
      id: wardenEvent.id,
      createdAt: wardenEvent.createdAt,
      verdict: wardenEvent.verdict,
      riskLevel: wardenEvent.riskLevel,
      surface: wardenEvent.surface,
      categories: wardenEvent.categories ?? [],
    },
    ...relatedConfirmations.map((confirmation) => ({
      kind: 'workflow_confirmation',
      id: confirmation.id,
      createdAt: confirmation.createdAt,
      status: confirmation.status,
      workflowId: confirmation.workflowId,
    })),
    ...relatedActionReceipts.map((receipt) => ({
      kind: 'admin_action',
      id: receipt.id,
      createdAt: receipt.createdAt,
      action: receipt.action,
      targetType: receipt.targetType,
      targetId: receipt.targetId,
    })),
  ].sort((left, right) => new Date(left.createdAt ?? 0) - new Date(right.createdAt ?? 0));

  return {
    body: {
      traceId,
      llmTrace: llmTrace ? safeLlmTrace(llmTrace) : null,
      wardenEvents: [safeWardenEvent(wardenEvent)],
      sentinelReview: metadata.sentinel ?? null,
      workflowRun: workflowRun ? safeWorkflowRun(workflowRun) : null,
      conversation: conversation ? safeConversation(conversation) : null,
      message: metadata.messageId ? { id: metadata.messageId } : null,
      timeline,
      trace: safeWardenEvent(wardenEvent),
      modelClassifier: metadata.modelClassifier ?? null,
      ocr: extractOcrSummary(metadata),
      lore: extractLoreSummary(metadata),
      tool: extractToolSummary(metadata, wardenEvent.toolName),
      workflow: extractWorkflowSummary(metadata),
      billing: metadata.billing ?? null,
      organisation: organisation ? safeOrganisation(organisation) : null,
      user: user ? safeUser(user) : null,
      relatedActionReceipts: relatedActionReceipts.map(safeActionReceipt),
      relatedConfirmations: relatedConfirmations.map(safeConfirmation),
      safeMetadata: stripUnsafeMetadata(metadata),
    },
  };
}

function extractOcrSummary(metadata) {
  if (metadata?.imageMetadata) {
    const { ocrAttempted, ocrAvailable, ocrProvider, ocrSourceCount, ocrTextHash, ocrTimedOut } = metadata.imageMetadata;
    if ([ocrAttempted, ocrAvailable, ocrProvider, ocrSourceCount, ocrTextHash, ocrTimedOut].some((value) => value !== undefined)) {
      return { ocrAttempted, ocrAvailable, ocrProvider, ocrSourceCount, ocrTextHash, ocrTimedOut };
    }
  }
  return null;
}

function extractLoreSummary(metadata) {
  if (!metadata?.lore && !metadata?.loreChunks) return null;
  const chunks = metadata.loreChunks ?? metadata.lore?.chunks ?? [];
  return {
    chunkCount: Array.isArray(chunks) ? chunks.length : 0,
    trustSummary: metadata.lore?.trustSummary ?? null,
  };
}

function extractToolSummary(metadata, toolName) {
  if (!toolName && !metadata?.toolRisk && !metadata?.toolDecision) return null;
  return {
    toolName,
    toolRisk: metadata.toolRisk ?? null,
    decision: metadata.toolDecision ?? null,
  };
}

function extractWorkflowSummary(metadata) {
  if (
    metadata?.workflowId
    || metadata?.workflowHasExternalInput
    || metadata?.workflowHasToolExecution
  ) {
    return {
      workflowId: metadata.workflowId ?? null,
      hasExternalInput: metadata.workflowHasExternalInput ?? null,
      hasToolExecution: metadata.workflowHasToolExecution ?? null,
      hasDestructiveAction: metadata.workflowHasDestructiveAction ?? null,
      nodeCount: metadata.nodeCount ?? null,
      edgeCount: metadata.edgeCount ?? null,
    };
  }
  return null;
}

function stripUnsafeMetadata(metadata) {
  const clone = JSON.parse(JSON.stringify(metadata ?? {}));
  delete clone.content;
  delete clone.text;
  delete clone.html;
  delete clone.prompt;
  delete clone.uploadedImageText;
  delete clone.rawContent;
  return clone;
}

function safeConversation(conversation) {
  return {
    id: conversation.id,
    orgId: conversation.orgId,
    userId: conversation.userId,
    agentId: conversation.agentId,
    title: conversation.title,
    createdAt: conversation.createdAt,
  };
}

function safeWorkflowRun(run) {
  return {
    id: run.id,
    orgId: run.orgId,
    workflowId: run.workflowId,
    status: run.status,
    triggerSource: run.triggerSource,
    executionMode: run.executionMode,
    createdAt: run.createdAt,
  };
}

function safeOrganisation(org) {
  return { id: org.id, name: org.name, plan: org.plan };
}

function safeUser(user) {
  return { id: user.id, email: user.email, name: user.name };
}

function safeLlmTrace(trace) {
  return {
    id: trace.id,
    provider: trace.provider,
    model: trace.model,
    outcomeStatus: trace.outcomeStatus,
    failureClass: trace.failureClass,
    createdAt: trace.createdAt,
  };
}

function safeActionReceipt(receipt) {
  return {
    id: receipt.id,
    action: receipt.action,
    targetType: receipt.targetType,
    targetId: receipt.targetId,
    reasonCode: receipt.reasonCode,
    createdAt: receipt.createdAt,
  };
}

function safeConfirmation(row) {
  return {
    id: row.id,
    status: row.status,
    workflowId: row.workflowId,
    workflowRunId: row.workflowRunId,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    usedAt: row.usedAt,
  };
}

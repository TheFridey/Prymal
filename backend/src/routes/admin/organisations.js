// routes/admin/organisations.js
import { asc, desc, eq, gte, ilike, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../../db/index.js';
import {
  auditLogs,
  adminActionLogs,
  creditAdjustments,
  integrations,
  llmExecutionTraces,
  organisationFeatureFlags,
  organisationInvitations,
  organisations,
  productEvents,
  workflowRuns,
} from '../../db/schema.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';
import { findAdminMutationReplay, getAdminMutationMeta } from '../../services/admin-mutations.js';
import { recordAdminActionLog, recordAuditLog } from '../../services/telemetry.js';
import { combineFilters, getPaginationQuery, getSinceDate, getWindowDays } from './helpers.js';

const router = new Hono();

const orgUpdateSchema = z.object({
  plan: z.enum(['free', 'solo', 'pro', 'teams', 'agency']).optional(),
  monthlyCreditLimit: z.number().int().min(0).max(1_000_000).optional(),
  seatLimit: z.number().int().min(1).max(10_000).optional(),
  reasonCode: z.string().trim().min(2).max(80).optional().default('manual_override'),
  reason: z.string().trim().min(4).max(500).optional().default('Updated in staff console.'),
});

const featureFlagSchema = z.object({
  enabled: z.boolean(),
  metadata: z.record(z.any()).optional().default({}),
});

router.patch(
  '/organisations/:orgId',
  requireStaff,
  requireStaffPermission('admin.org.update'),
  zValidator('json', orgUpdateSchema),
  async (context) => {
    const staff = context.get('staff');
    const { orgId } = context.req.param();
    const payload = context.req.valid('json');
    const mutationMeta = getAdminMutationMeta(context);
    const replay = await findAdminMutationReplay({
      actorUserId: staff.userId,
      action: 'admin.organisation.update',
      idempotencyKey: mutationMeta.idempotencyKey,
    });

    if (replay) {
      return context.json({
        organisation: replay.metadata?.after ?? null,
        receipt: replay,
        replayed: true,
      });
    }

    const existing = await db.query.organisations.findFirst({ where: eq(organisations.id, orgId) });
    if (!existing) return context.json({ error: 'Organisation not found.' }, 404);

    const nextValues = {
      ...(payload.plan ? { plan: payload.plan } : {}),
      ...(payload.monthlyCreditLimit != null ? { monthlyCreditLimit: payload.monthlyCreditLimit } : {}),
      ...(payload.seatLimit != null ? { seatLimit: payload.seatLimit } : {}),
      updatedAt: new Date(),
    };

    const [updated] = await db.update(organisations).set(nextValues).where(eq(organisations.id, orgId)).returning();

    await recordAuditLog({
      orgId, actorUserId: staff.userId, action: 'staff.admin.organisation_updated',
      targetType: 'organisation', targetId: orgId,
      metadata: {
        before: { plan: existing.plan, monthlyCreditLimit: existing.monthlyCreditLimit, seatLimit: existing.seatLimit },
        after: { plan: updated.plan, monthlyCreditLimit: updated.monthlyCreditLimit, seatLimit: updated.seatLimit },
      },
    });

    const receipt = await recordAdminActionLog({
      orgId, actorUserId: staff.userId, actorStaffRole: staff.staffRole,
      action: 'admin.organisation.update', permission: 'admin.org.update',
      targetType: 'organisation', targetId: orgId,
      requestId: mutationMeta.requestId,
      idempotencyKey: mutationMeta.idempotencyKey,
      reasonCode: payload.reasonCode, reason: payload.reason ?? null,
      metadata: {
        before: { plan: existing.plan, monthlyCreditLimit: existing.monthlyCreditLimit, seatLimit: existing.seatLimit },
        after: { plan: updated.plan, monthlyCreditLimit: updated.monthlyCreditLimit, seatLimit: updated.seatLimit },
      },
    });

    return context.json({
      organisation: {
        id: updated.id,
        plan: updated.plan,
        monthlyCreditLimit: updated.monthlyCreditLimit,
        seatLimit: updated.seatLimit,
        updatedAt: updated.updatedAt,
      },
      receipt,
    });
  },
);

router.get('/organisations', requireStaff, requireStaffPermission('admin.org.read'), async (context) => {
  const limit = Math.min(Math.max(Number(context.req.query('limit') ?? 25), 1), 100);
  const offset = Math.max(Number(context.req.query('offset') ?? 0), 0);
  const query = context.req.query('q')?.trim();

  const rows = await db.query.organisations.findMany({
    where: query ? or(ilike(organisations.name, `%${query}%`), ilike(organisations.slug, `%${query}%`)) : undefined,
    orderBy: [desc(organisations.createdAt)],
    limit,
    offset,
  });

  return context.json({ organisations: rows, count: rows.length, limit, offset });
});

router.get('/organisations/:orgId/timeline', requireStaff, requireStaffPermission('admin.org.timeline'), async (context) => {
  const { orgId } = context.req.param();
  const { limit, offset } = getPaginationQuery(context, { limit: 40, maxLimit: 100 });
  const days = getWindowDays(context, 90);
  const timelineSince = getSinceDate(days);
  const timelineLimit = Math.min(limit + offset, 120);

  const [org, auditRows, adminActionRows, eventRows, traceRows, runRows, creditRows] = await Promise.all([
    db.query.organisations.findFirst({ where: eq(organisations.id, orgId) }),
    db.query.auditLogs.findMany({ where: combineFilters(eq(auditLogs.orgId, orgId), gte(auditLogs.createdAt, timelineSince)), orderBy: [desc(auditLogs.createdAt)], limit: timelineLimit }),
    db.query.adminActionLogs.findMany({ where: combineFilters(eq(adminActionLogs.orgId, orgId), gte(adminActionLogs.createdAt, timelineSince)), orderBy: [desc(adminActionLogs.createdAt)], limit: timelineLimit }),
    db.query.productEvents.findMany({ where: combineFilters(eq(productEvents.orgId, orgId), gte(productEvents.createdAt, timelineSince)), orderBy: [desc(productEvents.createdAt)], limit: timelineLimit }),
    db.query.llmExecutionTraces.findMany({ where: combineFilters(eq(llmExecutionTraces.orgId, orgId), gte(llmExecutionTraces.createdAt, timelineSince)), orderBy: [desc(llmExecutionTraces.createdAt)], limit: timelineLimit }),
    db.query.workflowRuns.findMany({ where: combineFilters(eq(workflowRuns.orgId, orgId), gte(workflowRuns.createdAt, timelineSince)), orderBy: [desc(workflowRuns.createdAt)], limit: timelineLimit }),
    db.query.creditAdjustments.findMany({ where: combineFilters(eq(creditAdjustments.orgId, orgId), gte(creditAdjustments.createdAt, timelineSince)), orderBy: [desc(creditAdjustments.createdAt)], limit: timelineLimit }),
  ]);

  if (!org) return context.json({ error: 'Organisation not found.' }, 404);

  const timeline = [
    ...auditRows.map((row) => ({ kind: 'audit_log', label: row.action, detail: row.metadata ?? {}, createdAt: row.createdAt })),
    ...adminActionRows.map((row) => ({ kind: 'admin_action', label: row.action, detail: { receiptId: row.id, reasonCode: row.reasonCode, reason: row.reason, actorUserId: row.actorUserId }, createdAt: row.createdAt })),
    ...eventRows.map((row) => ({ kind: 'user_activity', label: row.eventName, detail: row.metadata ?? {}, createdAt: row.createdAt })),
    ...traceRows.map((row) => ({
      kind: row.outcomeStatus === 'failed' ? 'failed_trace' : 'trace',
      label: `${row.agentId} via ${row.model}`,
      detail: {
        id: row.id,
        traceId: row.id,
        policyKey: row.policyKey,
        route: row.route,
        outcomeStatus: row.outcomeStatus,
        totalTokens: row.totalTokens,
        estimatedCostUsd: row.estimatedCostUsd,
      },
      createdAt: row.createdAt,
    })),
    ...runRows.map((row) => ({ kind: 'workflow_run', label: `${row.status} workflow run`, detail: { id: row.id, runId: row.id, workflowId: row.workflowId, failureClass: row.failureClass, executionMode: row.executionMode, attemptCount: row.attemptCount }, createdAt: row.createdAt })),
    ...creditRows.map((row) => ({ kind: 'billing_event', label: `${row.delta > 0 ? 'Credit refund' : 'Credit debit'} ${row.delta}`, detail: { delta: row.delta, reasonCode: row.reasonCode, reason: row.reason }, createdAt: row.createdAt })),
  ]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(offset, offset + limit);

  return context.json({ organisation: org, timeline, limit, offset, days, count: timeline.length });
});

router.get('/organisations/:orgId/feature-flags', requireStaff, requireStaffPermission('admin.org.flags.read'), async (context) => {
  const { orgId } = context.req.param();
  const rows = await db.query.organisationFeatureFlags.findMany({
    where: eq(organisationFeatureFlags.orgId, orgId),
    orderBy: [asc(organisationFeatureFlags.flagKey)],
  });
  return context.json({ flags: rows });
});

router.put(
  '/organisations/:orgId/feature-flags/:flagKey',
  requireStaff,
  requireStaffPermission('admin.org.flags.write'),
  zValidator('json', featureFlagSchema),
  async (context) => {
    const staff = context.get('staff');
    const { orgId, flagKey } = context.req.param();
    const payload = context.req.valid('json');
    const mutationMeta = getAdminMutationMeta(context);
    const replay = await findAdminMutationReplay({
      actorUserId: staff.userId,
      action: 'admin.org.flag.write',
      idempotencyKey: mutationMeta.idempotencyKey,
    });

    if (replay) {
      return context.json({
        flag: replay.metadata?.flag ?? null,
        receipt: replay,
        replayed: true,
      });
    }

    const existing = await db.query.organisationFeatureFlags.findFirst({
      where: combineFilters(eq(organisationFeatureFlags.orgId, orgId), eq(organisationFeatureFlags.flagKey, flagKey)),
    });

    const [row] = existing
      ? await db.update(organisationFeatureFlags).set({ enabled: payload.enabled, metadata: payload.metadata, updatedBy: staff.userId, updatedAt: new Date() }).where(eq(organisationFeatureFlags.id, existing.id)).returning()
      : await db.insert(organisationFeatureFlags).values({ orgId, flagKey, enabled: payload.enabled, metadata: payload.metadata, createdBy: staff.userId, updatedBy: staff.userId }).returning();

    const receipt = await recordAdminActionLog({
      orgId, actorUserId: staff.userId, actorStaffRole: staff.staffRole,
      action: 'admin.org.flag.write', permission: 'admin.org.flags.write',
      targetType: 'organisation_feature_flag', targetId: row.id,
      requestId: mutationMeta.requestId,
      idempotencyKey: mutationMeta.idempotencyKey,
      reasonCode: 'feature_flag_update', reason: `Set ${flagKey} to ${payload.enabled}.`,
      metadata: {
        flagKey,
        enabled: payload.enabled,
        flag: row,
      },
    });

    return context.json({ flag: row, receipt });
  },
);

router.get('/integration-health', requireStaff, requireStaffPermission('admin.integration.read'), async (context) => {
  const { limit, offset } = getPaginationQuery(context, { limit: 200, maxLimit: 500 });
  const rows = await db.query.integrations.findMany({ orderBy: [desc(integrations.updatedAt)], limit, offset });

  const staleThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const organisationRows = await db.query.organisations.findMany();
  const organisationsById = new Map(organisationRows.map((row) => [row.id, row]));

  const health = rows.map((row) => ({
    id: row.id, orgId: row.orgId,
    orgName: organisationsById.get(row.orgId)?.name ?? 'Unknown organisation',
    service: row.service, isActive: row.isActive, accountEmail: row.accountEmail,
    tokenExpiresAt: row.tokenExpiresAt, updatedAt: row.updatedAt,
    healthStatus: !row.isActive ? 'offline'
      : row.tokenExpiresAt && row.tokenExpiresAt < new Date() ? 'expired'
      : row.updatedAt && row.updatedAt < staleThreshold ? 'stale'
      : 'healthy',
  }));

  return context.json({
    count: health.length, limit, offset, integrations: health,
    summary: {
      healthy: health.filter((row) => row.healthStatus === 'healthy').length,
      stale: health.filter((row) => row.healthStatus === 'stale').length,
      expired: health.filter((row) => row.healthStatus === 'expired').length,
      offline: health.filter((row) => row.healthStatus === 'offline').length,
    },
  });
});

export default router;

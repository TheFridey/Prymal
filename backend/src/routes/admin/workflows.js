// routes/admin/workflows.js
import { desc, eq, gte } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { adminActionLogs, llmExecutionTraces, organisations, workflowRuns, workflows, workflowWebhooks } from '../../db/schema.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';
import { findAdminMutationReplay, getAdminMutationMeta } from '../../services/admin-mutations.js';
import { creditsRemaining } from '../../services/entitlements.js';
import { recordAdminActionLog, recordAuditLog } from '../../services/telemetry.js';
import { dispatchWorkflowRun } from '../../queue/trigger.js';
import { combineFilters, getPaginationQuery, getWindowDays, getSinceDate, mapTraceRow } from './helpers.js';

const router = new Hono();

const workflowReplaySchema = z.object({
  reasonCode: z.string().trim().min(2).max(80).optional().default('manual_replay'),
  reason: z.string().trim().min(4).max(500).optional().default('Replayed from the staff control plane.'),
});

router.get('/webhook-delivery-health', requireStaff, requireStaffPermission('admin.workflow.read'), async (context) => {
  const [allSubscriptions, subscriptions] = await Promise.all([
    db.query.workflowWebhooks.findMany({
      orderBy: [desc(workflowWebhooks.updatedAt)],
    }),
    db.query.workflowWebhooks.findMany({
      orderBy: [desc(workflowWebhooks.updatedAt)],
      limit: 20,
    }),
  ]);

  const totalEnabled = allSubscriptions.filter((subscription) => subscription.enabled).length;
  const totalDisabled = allSubscriptions.filter((subscription) => !subscription.enabled).length;
  const orgsWithWebhooks = new Set(allSubscriptions.map((subscription) => subscription.orgId)).size;

  return context.json({
    totalEnabled,
    totalDisabled,
    orgsWithWebhooks,
    subscriptions: subscriptions.map(serializeWorkflowWebhookSubscription),
  });
});

router.get('/failed-workflow-runs', requireStaff, requireStaffPermission('admin.workflow.read'), async (context) => {
  const { limit, offset } = getPaginationQuery(context, { limit: 50, maxLimit: 200 });
  const days = getWindowDays(context, 30);
  const since = getSinceDate(days);
  const orgId = context.req.query('orgId')?.trim();
  const failureClass = context.req.query('failureClass')?.trim();

  const rows = await db.query.workflowRuns.findMany({
    where: combineFilters(
      eq(workflowRuns.status, 'failed'),
      gte(workflowRuns.createdAt, since),
      orgId ? eq(workflowRuns.orgId, orgId) : undefined,
      failureClass ? eq(workflowRuns.failureClass, failureClass) : undefined,
    ),
    orderBy: [desc(workflowRuns.createdAt)],
    limit, offset,
  });

  return context.json({ runs: rows, count: rows.length, limit, offset, days });
});

router.get('/workflow-runs/:runId', requireStaff, requireStaffPermission('admin.workflow.read'), async (context) => {
  const { runId } = context.req.param();
  const run = await db.query.workflowRuns.findFirst({ where: eq(workflowRuns.id, runId) });
  if (!run) return context.json({ error: 'Workflow run not found.' }, 404);

  const [workflow, traces, actionReceipts] = await Promise.all([
    db.query.workflows.findFirst({ where: eq(workflows.id, run.workflowId) }),
    db.query.llmExecutionTraces.findMany({ where: eq(llmExecutionTraces.workflowRunId, run.id), orderBy: [desc(llmExecutionTraces.createdAt)], limit: 100 }),
    db.query.adminActionLogs.findMany({ where: eq(adminActionLogs.targetId, run.id), orderBy: [desc(adminActionLogs.createdAt)], limit: 20 }),
  ]);

  return context.json({ run, workflow, traces: traces.map((trace) => mapTraceRow(trace)), actionReceipts });
});

router.post(
  '/workflow-runs/:runId/replay',
  requireStaff,
  requireStaffPermission('admin.workflow.replay'),
  zValidator('json', workflowReplaySchema),
  async (context) => {
    const staff = context.get('staff');
    const { runId } = context.req.param();
    const payload = context.req.valid('json');
    const mutationMeta = getAdminMutationMeta(context);
    const replay = await findAdminMutationReplay({
      actorUserId: staff.userId,
      action: 'admin.workflow.replay',
      idempotencyKey: mutationMeta.idempotencyKey,
    });

    if (replay) {
      return context.json(
        {
          status: 'queued',
          runId: replay.targetId,
          replayOfRunId: replay.metadata?.sourceRunId ?? null,
          executionMode: replay.metadata?.executionMode ?? 'inline',
          receipt: replay,
          replayed: true,
        },
        202,
      );
    }

    const sourceRun = await db.query.workflowRuns.findFirst({ where: eq(workflowRuns.id, runId) });
    if (!sourceRun) return context.json({ error: 'Workflow run not found.' }, 404);

    const [workflow, organisation] = await Promise.all([
      db.query.workflows.findFirst({ where: eq(workflows.id, sourceRun.workflowId) }),
      db.query.organisations.findFirst({ where: eq(organisations.id, sourceRun.orgId) }),
    ]);

    if (!workflow || !organisation) return context.json({ error: 'Workflow replay context could not be resolved.' }, 404);

    const [replayRun] = await db.insert(workflowRuns).values({
      workflowId: workflow.id, orgId: workflow.orgId, triggeredBy: staff.userId,
      triggerSource: 'replay', status: 'queued', replayOfRunId: sourceRun.id,
    }).returning();

    const dispatch = await dispatchWorkflowRun({
      runId: replayRun.id, workflow,
      orgContext: { userId: staff.userId, orgId: organisation.id, orgPlan: organisation.plan, orgName: organisation.name, credits: creditsRemaining(organisation) },
    });

    await db.update(workflowRuns).set({ executionMode: dispatch.mode }).where(eq(workflowRuns.id, replayRun.id));

    const receipt = await recordAdminActionLog({
      orgId: organisation.id, actorUserId: staff.userId, actorStaffRole: staff.staffRole,
      action: 'admin.workflow.replay', permission: 'admin.workflow.replay',
      targetType: 'workflow_run', targetId: replayRun.id,
      requestId: mutationMeta.requestId,
      idempotencyKey: mutationMeta.idempotencyKey,
      reasonCode: payload.reasonCode, reason: payload.reason,
      metadata: { workflowId: workflow.id, sourceRunId: sourceRun.id, executionMode: dispatch.mode },
    });

    await recordAuditLog({
      orgId: organisation.id, actorUserId: staff.userId,
      action: 'staff.admin.workflow_replayed',
      targetType: 'workflow_run', targetId: replayRun.id,
      metadata: { workflowId: workflow.id, sourceRunId: sourceRun.id, executionMode: dispatch.mode, reasonCode: payload.reasonCode },
    });

    return context.json({ status: 'queued', runId: replayRun.id, replayOfRunId: sourceRun.id, executionMode: dispatch.mode, receipt }, 202);
  },
);

export default router;

function serializeWorkflowWebhookSubscription(subscription) {
  return {
    id: subscription.id,
    orgId: subscription.orgId,
    workflowId: subscription.workflowId,
    url: subscription.url,
    events: subscription.events,
    enabled: subscription.enabled,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

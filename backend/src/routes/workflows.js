import { and, desc, eq } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { organisations, workflowRuns, workflows, workflowWebhooks } from '../db/schema.js';
import { requireOrg, requireRole } from '../middleware/auth.js';
import { planAwareRateLimit } from '../middleware/rateLimit.js';
import { assertCreditsAvailable, creditsRemaining } from '../services/entitlements.js';
import { dispatchWorkflowRun, hasTriggerDevConfig, registerCron, unregisterCron } from '../queue/trigger.js';
import { recordAuditLog, recordProductEvent } from '../services/telemetry.js';
import { validateWorkflowDefinition } from '../services/workflow-engine.js';

const router = new Hono();
const WORKFLOW_WEBHOOK_EVENT_TYPES = [
  'workflow.completed',
  'workflow.failed',
  'workflow.node.completed',
  'workflow.node.failed',
];
const webhookUrlSchema = z
  .string()
  .url('Webhook URL must be a valid URL.')
  .refine((value) => value.startsWith('https://'), 'Webhook URL must use HTTPS.');
const webhookEventsSchema = z
  .array(z.enum(WORKFLOW_WEBHOOK_EVENT_TYPES))
  .min(1, 'At least one webhook event is required.')
  .max(WORKFLOW_WEBHOOK_EVENT_TYPES.length);
const createWorkflowWebhookSchema = z.object({
  workflowId: z.string().uuid().nullable().optional(),
  url: webhookUrlSchema,
  secret: z.string().trim().min(16, 'Webhook secret must be at least 16 characters long.').max(255),
  events: webhookEventsSchema,
  enabled: z.boolean().optional().default(true),
});
const updateWorkflowWebhookSchema = z
  .object({
    url: webhookUrlSchema.optional(),
    events: webhookEventsSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .refine(
    (value) => value.url !== undefined || value.events !== undefined || value.enabled !== undefined,
    'Provide at least one field to update.',
  );

router.get('/', requireOrg, async (context) => {
  const org = context.get('org');
  const [result, recentRuns] = await Promise.all([
    db.query.workflows.findMany({
      where: eq(workflows.orgId, org.orgId),
      orderBy: [desc(workflows.updatedAt)],
    }),
    db.query.workflowRuns.findMany({
      where: eq(workflowRuns.orgId, org.orgId),
      orderBy: [desc(workflowRuns.createdAt)],
    }),
  ]);

  const latestRunByWorkflowId = new Map();
  for (const run of recentRuns) {
    if (!latestRunByWorkflowId.has(run.workflowId)) {
      latestRunByWorkflowId.set(run.workflowId, run);
    }
  }

  const hydrated = result.map((workflow) => {
    const latestRun = latestRunByWorkflowId.get(workflow.id);
    return {
      ...workflow,
      enabled: workflow.isActive,
      lastRunAt: latestRun?.completedAt ?? latestRun?.startedAt ?? workflow.lastRunAt ?? null,
      lastRunStatus: latestRun?.status ?? null,
    };
  });

  return context.json({ workflows: hydrated });
});

router.get('/webhooks', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const webhooks = await db.query.workflowWebhooks.findMany({
    where: eq(workflowWebhooks.orgId, org.orgId),
    orderBy: [desc(workflowWebhooks.createdAt)],
  });

  return context.json({
    webhooks: webhooks.map(serializeWorkflowWebhook),
  });
});

router.post(
  '/webhooks',
  requireOrg,
  requireRole('owner', 'admin'),
  zValidator('json', createWorkflowWebhookSchema),
  async (context) => {
    const org = context.get('org');
    const payload = context.req.valid('json');

    if (payload.workflowId) {
      const workflow = await db.query.workflows.findFirst({
        where: and(eq(workflows.id, payload.workflowId), eq(workflows.orgId, org.orgId)),
      });

      if (!workflow) {
        return context.json({ error: 'Workflow not found.' }, 404);
      }
    }

    const [created] = await db
      .insert(workflowWebhooks)
      .values({
        orgId: org.orgId,
        workflowId: payload.workflowId ?? null,
        url: payload.url,
        secret: payload.secret,
        events: payload.events,
        enabled: payload.enabled,
      })
      .returning();

    await recordAuditLog({
      orgId: org.orgId,
      actorUserId: org.userId,
      action: 'workflow.webhook.created',
      targetType: 'workflow_webhook',
      targetId: created.id,
      metadata: {
        workflowId: created.workflowId,
        url: created.url,
        events: created.events,
        enabled: created.enabled,
      },
    });

    return context.json(
      {
        webhook: serializeWorkflowWebhook(created),
        secret: created.secret,
      },
      201,
    );
  },
);

router.patch(
  '/webhooks/:id',
  requireOrg,
  requireRole('owner', 'admin'),
  zValidator('json', updateWorkflowWebhookSchema),
  async (context) => {
    const org = context.get('org');
    const { id } = context.req.param();
    const payload = context.req.valid('json');

    const [updated] = await db
      .update(workflowWebhooks)
      .set({
        ...(payload.url !== undefined ? { url: payload.url } : {}),
        ...(payload.events !== undefined ? { events: payload.events } : {}),
        ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(workflowWebhooks.id, id), eq(workflowWebhooks.orgId, org.orgId)))
      .returning();

    if (!updated) {
      return context.json({ error: 'Workflow webhook not found.' }, 404);
    }

    await recordAuditLog({
      orgId: org.orgId,
      actorUserId: org.userId,
      action: 'workflow.webhook.updated',
      targetType: 'workflow_webhook',
      targetId: updated.id,
      metadata: {
        workflowId: updated.workflowId,
        url: updated.url,
        events: updated.events,
        enabled: updated.enabled,
      },
    });

    return context.json({ webhook: serializeWorkflowWebhook(updated) });
  },
);

router.delete('/webhooks/:id', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();

  const [deleted] = await db
    .delete(workflowWebhooks)
    .where(and(eq(workflowWebhooks.id, id), eq(workflowWebhooks.orgId, org.orgId)))
    .returning();

  if (!deleted) {
    return context.json({ error: 'Workflow webhook not found.' }, 404);
  }

  await recordAuditLog({
    orgId: org.orgId,
    actorUserId: org.userId,
    action: 'workflow.webhook.deleted',
    targetType: 'workflow_webhook',
    targetId: deleted.id,
    metadata: {
      workflowId: deleted.workflowId,
      url: deleted.url,
      events: deleted.events,
    },
  });

  return context.json({ success: true });
});

router.get('/:id', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const workflow = await db.query.workflows.findFirst({
    where: and(eq(workflows.id, id), eq(workflows.orgId, org.orgId)),
  });

  if (!workflow) {
    return context.json({ error: 'Workflow not found.' }, 404);
  }

  return context.json({ workflow });
});

router.post('/', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const payload = validateWorkflowDefinition(await context.req.json());
  const [workflow] = await db
    .insert(workflows)
    .values({
      orgId: org.orgId,
      createdBy: org.userId,
      name: payload.name,
      description: payload.description ?? null,
      triggerType: payload.triggerType,
      triggerConfig: payload.triggerConfig,
      nodes: payload.nodes,
      edges: payload.edges,
      isActive: false,
    })
    .returning();

  await Promise.all([
    recordAuditLog({
      orgId: org.orgId,
      actorUserId: org.userId,
      action: 'workflow.created',
      targetType: 'workflow',
      targetId: workflow.id,
      metadata: { triggerType: workflow.triggerType, name: workflow.name },
    }),
    recordProductEvent({
      orgId: org.orgId,
      userId: org.userId,
      eventName: 'workflow.created',
      metadata: { triggerType: workflow.triggerType, name: workflow.name },
    }),
  ]);

  return context.json({ workflow }, 201);
});

router.put('/:id', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const existing = await db.query.workflows.findFirst({
    where: and(eq(workflows.id, id), eq(workflows.orgId, org.orgId)),
  });

  if (!existing) {
    return context.json({ error: 'Workflow not found.' }, 404);
  }

  const merged = {
    name: existing.name,
    description: existing.description ?? undefined,
    triggerType: existing.triggerType,
    triggerConfig: existing.triggerConfig ?? {},
    nodes: existing.nodes ?? [],
    edges: existing.edges ?? [],
    ...(await context.req.json()),
  };
  const payload = validateWorkflowDefinition(merged);

  const [workflow] = await db
    .update(workflows)
    .set({
      name: payload.name,
      description: payload.description ?? null,
      triggerType: payload.triggerType,
      triggerConfig: payload.triggerConfig,
      nodes: payload.nodes,
      edges: payload.edges,
      updatedAt: new Date(),
    })
    .where(eq(workflows.id, existing.id))
    .returning();

  await recordAuditLog({
    orgId: org.orgId,
    actorUserId: org.userId,
    action: 'workflow.updated',
    targetType: 'workflow',
    targetId: workflow.id,
    metadata: { triggerType: workflow.triggerType, name: workflow.name },
  });

  return context.json({ workflow });
});

router.patch('/:id/toggle', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const workflow = await db.query.workflows.findFirst({
    where: and(eq(workflows.id, id), eq(workflows.orgId, org.orgId)),
  });

  if (!workflow) {
    return context.json({ error: 'Workflow not found.' }, 404);
  }

  if (!workflow.isActive && workflow.triggerType === 'schedule' && !hasTriggerDevConfig()) {
    return context.json(
      {
        error: 'Trigger.dev is required to activate scheduled workflows.',
      },
      400,
    );
  }

  const [updated] = await db
    .update(workflows)
    .set({
      isActive: !workflow.isActive,
      updatedAt: new Date(),
    })
    .where(eq(workflows.id, workflow.id))
    .returning();

  if (updated.triggerType === 'schedule') {
    if (updated.isActive) {
      await registerCron(updated.id, updated.triggerConfig?.cron);
    } else {
      await unregisterCron(updated.id);
    }
  }

  await recordAuditLog({
    orgId: org.orgId,
    actorUserId: org.userId,
    action: updated.isActive ? 'workflow.activated' : 'workflow.deactivated',
    targetType: 'workflow',
    targetId: updated.id,
    metadata: { triggerType: updated.triggerType },
  });

  return context.json({ workflow: updated });
});

router.delete('/:id', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const workflow = await db.query.workflows.findFirst({
    where: and(eq(workflows.id, id), eq(workflows.orgId, org.orgId)),
  });

  if (!workflow) {
    return context.json({ error: 'Workflow not found.' }, 404);
  }

  await unregisterCron(workflow.id);
  await db.delete(workflows).where(eq(workflows.id, workflow.id));

  await recordAuditLog({
    orgId: org.orgId,
    actorUserId: org.userId,
    action: 'workflow.deleted',
    targetType: 'workflow',
    targetId: workflow.id,
    metadata: { name: workflow.name },
  });

  return context.json({ success: true });
});

router.post('/:id/run', requireOrg, planAwareRateLimit({
  free: 3,
  solo: 10,
  pro: 30,
  teams: 60,
  agency: null,
  keyPrefix: 'workflow-run',
}), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const idempotencyKey = context.req.header('Idempotency-Key')?.trim() || null;
  const workflow = await db.query.workflows.findFirst({
    where: and(eq(workflows.id, id), eq(workflows.orgId, org.orgId)),
  });

  if (!workflow) {
    return context.json({ error: 'Workflow not found.' }, 404);
  }

  assertCreditsAvailable(org, 1);

  if (idempotencyKey) {
    const existingRun = await db.query.workflowRuns.findFirst({
      where: and(eq(workflowRuns.workflowId, workflow.id), eq(workflowRuns.idempotencyKey, idempotencyKey)),
      orderBy: [desc(workflowRuns.createdAt)],
    });

    if (existingRun) {
      return context.json(
        {
          runId: existingRun.id,
          status: existingRun.status,
          executionMode: existingRun.executionMode,
          reused: true,
        },
        existingRun.status === 'completed' ? 200 : 202,
      );
    }
  }

  const [run] = await db
    .insert(workflowRuns)
    .values({
      workflowId: workflow.id,
      orgId: workflow.orgId,
      triggeredBy: org.userId,
      status: 'queued',
      triggerSource: 'manual',
      idempotencyKey,
    })
    .returning();

  const dispatch = await dispatchWorkflowRun({
    runId: run.id,
    workflow,
    orgContext: org,
  });

  await db
    .update(workflowRuns)
    .set({
      executionMode: dispatch.mode,
    })
    .where(eq(workflowRuns.id, run.id));

  await Promise.all([
    recordAuditLog({
      orgId: org.orgId,
      actorUserId: org.userId,
      action: 'workflow.run_queued',
      targetType: 'workflow_run',
      targetId: run.id,
      metadata: { workflowId: workflow.id, executionMode: dispatch.mode },
    }),
    recordProductEvent({
      orgId: org.orgId,
      userId: org.userId,
      eventName: 'workflow.run_queued',
      metadata: { workflowId: workflow.id, executionMode: dispatch.mode },
    }),
  ]);

  return context.json(
    {
      runId: run.id,
      status: 'queued',
      executionMode: dispatch.mode,
      reused: false,
    },
    202,
  );
});

router.post('/webhook/:id/:secret', async (context) => {
  const { id, secret } = context.req.param();
  const idempotencyKey = context.req.header('Idempotency-Key')?.trim() || context.req.header('X-Prymal-Idempotency-Key')?.trim() || null;
  const workflow = await db.query.workflows.findFirst({
    where: eq(workflows.id, id),
  });

  if (!workflow || workflow.triggerType !== 'webhook') {
    return context.json({ error: 'Workflow not found.' }, 404);
  }

  if (!workflow.isActive) {
    return context.json({ error: 'Workflow is not active.' }, 409);
  }

  if (workflow.triggerConfig?.webhookSecret !== secret) {
    return context.json({ error: 'Invalid webhook secret.' }, 401);
  }

  const organisation = await db.query.organisations.findFirst({
    where: eq(organisations.id, workflow.orgId),
  });

  if (!organisation) {
    return context.json({ error: 'Organisation not found.' }, 404);
  }

  if (idempotencyKey) {
    const existingRun = await db.query.workflowRuns.findFirst({
      where: and(eq(workflowRuns.workflowId, workflow.id), eq(workflowRuns.idempotencyKey, idempotencyKey)),
      orderBy: [desc(workflowRuns.createdAt)],
    });

    if (existingRun) {
      return context.json({ runId: existingRun.id, status: existingRun.status, reused: true }, 202);
    }
  }

  const [run] = await db
    .insert(workflowRuns)
    .values({
      workflowId: workflow.id,
      orgId: workflow.orgId,
      triggeredBy: 'webhook',
      status: 'queued',
      triggerSource: 'webhook',
      idempotencyKey,
    })
    .returning();

  const dispatch = await dispatchWorkflowRun({
    runId: run.id,
    workflow,
    orgContext: {
      userId: null,
      orgId: organisation.id,
      orgPlan: organisation.plan,
      orgName: organisation.name,
      credits: creditsRemaining(organisation),
    },
  });

  await db
    .update(workflowRuns)
    .set({
      executionMode: dispatch.mode,
    })
    .where(eq(workflowRuns.id, run.id));

  return context.json({ runId: run.id, status: 'queued' }, 202);
});

router.get('/:id/runs', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const runs = await db.query.workflowRuns.findMany({
    where: and(eq(workflowRuns.workflowId, id), eq(workflowRuns.orgId, org.orgId)),
    orderBy: [desc(workflowRuns.createdAt)],
    limit: 20,
  });

  return context.json({ runs });
});

router.get('/runs/:runId', requireOrg, async (context) => {
  const org = context.get('org');
  const { runId } = context.req.param();
  const run = await db.query.workflowRuns.findFirst({
    where: and(eq(workflowRuns.id, runId), eq(workflowRuns.orgId, org.orgId)),
  });

  if (!run) {
    return context.json({ error: 'Run not found.' }, 404);
  }

  return context.json({ run });
});

router.post('/runs/:runId/replay', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const { runId } = context.req.param();

  const sourceRun = await db.query.workflowRuns.findFirst({
    where: and(eq(workflowRuns.id, runId), eq(workflowRuns.orgId, org.orgId)),
  });

  if (!sourceRun) {
    return context.json({ error: 'Run not found.' }, 404);
  }

  const workflow = await db.query.workflows.findFirst({
    where: and(eq(workflows.id, sourceRun.workflowId), eq(workflows.orgId, org.orgId)),
  });

  if (!workflow) {
    return context.json({ error: 'Workflow not found.' }, 404);
  }

  const [replayRun] = await db
    .insert(workflowRuns)
    .values({
      workflowId: workflow.id,
      orgId: workflow.orgId,
      triggeredBy: org.userId,
      triggerSource: 'replay',
      status: 'queued',
      replayOfRunId: sourceRun.id,
    })
    .returning();

  const dispatch = await dispatchWorkflowRun({
    runId: replayRun.id,
    workflow,
    orgContext: org,
  });

  await db
    .update(workflowRuns)
    .set({
      executionMode: dispatch.mode,
    })
    .where(eq(workflowRuns.id, replayRun.id));

  await recordAuditLog({
    orgId: org.orgId,
    actorUserId: org.userId,
    action: 'workflow.run_replayed',
    targetType: 'workflow_run',
    targetId: replayRun.id,
    metadata: {
      workflowId: workflow.id,
      sourceRunId: sourceRun.id,
      executionMode: dispatch.mode,
    },
  });

  return context.json({ runId: replayRun.id, status: 'queued', replayOfRunId: sourceRun.id }, 202);
});

export default router;

function serializeWorkflowWebhook(entry) {
  return {
    id: entry.id,
    orgId: entry.orgId,
    workflowId: entry.workflowId,
    url: entry.url,
    events: entry.events,
    enabled: entry.enabled,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

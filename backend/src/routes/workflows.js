import { randomUUID } from 'crypto';
import { and, count, desc, eq, or, sql } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { organisations, workflowRuns, workflows, workflowTemplates, workflowWebhooks } from '../db/schema.js';
import { requireOrg, requireRole } from '../middleware/auth.js';
import { planAwareRateLimit } from '../middleware/rateLimit.js';
import { getBillingSnapshotForOrg } from '../services/billing-engine.js';
import { dispatchWorkflowRun, registerCron, unregisterCron } from '../queue/trigger.js';
import { createScheduledWorkflowRunHandler } from '../services/inline-scheduler.js';
import { recordAuditLog, recordProductEvent, recordProductEventOnce } from '../services/telemetry.js';
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
const workflowTemplateSchema = z.object({
  workflowId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  parameters: z.record(z.unknown()).optional().default({}),
  triggerType: z.enum(['manual', 'schedule', 'webhook', 'event']).optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  nodes: z.array(z.unknown()).optional(),
  edges: z.array(z.unknown()).optional(),
  isPublic: z.boolean().optional().default(false),
  metadata: z.record(z.unknown()).optional().default({}),
});
const runAgainSchema = z.object({
  input: z.unknown().optional(),
});

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

router.get('/templates', requireOrg, async (context) => {
  const org = context.get('org');
  const templates = await db.query.workflowTemplates.findMany({
    where: or(eq(workflowTemplates.orgId, org.orgId), eq(workflowTemplates.isPublic, true)),
    orderBy: [desc(workflowTemplates.updatedAt)],
    limit: 100,
  });

  return context.json({ templates: templates.map((template) => serializeWorkflowTemplate(template, org.orgId)) });
});

router.post('/templates', requireOrg, requireRole('owner', 'admin'), zValidator('json', workflowTemplateSchema), async (context) => {
  const org = context.get('org');
  const payload = context.req.valid('json');
  let sourceWorkflow = null;

  if (payload.workflowId) {
    sourceWorkflow = await db.query.workflows.findFirst({
      where: and(eq(workflows.id, payload.workflowId), eq(workflows.orgId, org.orgId)),
    });
    if (!sourceWorkflow) {
      return context.json({ error: 'Workflow not found.' }, 404);
    }
  }

  const templateDefinition = sourceWorkflow
    ? {
      name: payload.name,
      description: payload.description ?? sourceWorkflow.description ?? null,
      triggerType: payload.triggerType ?? sourceWorkflow.triggerType,
      triggerConfig: payload.triggerConfig ?? sourceWorkflow.triggerConfig ?? {},
      nodes: payload.nodes ?? sourceWorkflow.nodes ?? [],
      edges: payload.edges ?? sourceWorkflow.edges ?? [],
    }
    : {
      name: payload.name,
      description: payload.description ?? null,
      triggerType: payload.triggerType ?? 'manual',
      triggerConfig: payload.triggerConfig ?? {},
      nodes: payload.nodes ?? [],
      edges: payload.edges ?? [],
    };

  validateWorkflowDefinition(templateDefinition);

  const [template] = await db
    .insert(workflowTemplates)
    .values({
      orgId: org.orgId,
      sourceWorkflowId: sourceWorkflow?.id ?? null,
      createdBy: org.userId,
      name: templateDefinition.name,
      description: templateDefinition.description,
      parameters: payload.parameters ?? {},
      triggerType: templateDefinition.triggerType,
      triggerConfig: templateDefinition.triggerConfig,
      nodes: templateDefinition.nodes,
      edges: templateDefinition.edges,
      isPublic: payload.isPublic,
      shareId: createTemplateShareId(),
      metadata: payload.metadata ?? {},
    })
    .returning();

  await recordProductEvent({
    orgId: org.orgId,
    userId: org.userId,
    eventName: 'workflow_template.created',
    metadata: { templateId: template.id, isPublic: template.isPublic },
  });

  return context.json({ template: serializeWorkflowTemplate(template, org.orgId) }, 201);
});

router.get('/templates/:id/public', async (context) => {
  const { id } = context.req.param();
  const template = await db.query.workflowTemplates.findFirst({
    where: and(
      eq(workflowTemplates.isPublic, true),
      templateLookup(id),
    ),
  });

  if (!template) {
    return context.json({ error: 'Public template not found.' }, 404);
  }

  return context.json({ template: serializePublicWorkflowTemplate(template) });
});

router.post('/templates/:id/import', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const source = await db.query.workflowTemplates.findFirst({
    where: or(
      and(eq(workflowTemplates.orgId, org.orgId), templateLookup(id)),
      and(eq(workflowTemplates.isPublic, true), templateLookup(id)),
    ),
  });

  if (!source) {
    return context.json({ error: 'Template not found.' }, 404);
  }

  const [template] = await db
    .insert(workflowTemplates)
    .values({
      orgId: org.orgId,
      sourceWorkflowId: source.sourceWorkflowId ?? null,
      createdBy: org.userId,
      name: source.name,
      description: source.description,
      parameters: source.parameters ?? {},
      triggerType: source.triggerType,
      triggerConfig: source.triggerConfig ?? {},
      nodes: source.nodes ?? [],
      edges: source.edges ?? [],
      isPublic: false,
      shareId: createTemplateShareId(),
      usageCount: 0,
      metadata: { ...(source.metadata ?? {}), importedFromTemplateId: source.id },
    })
    .returning();

  await db
    .update(workflowTemplates)
    .set({ usageCount: sql`${workflowTemplates.usageCount} + 1`, updatedAt: new Date() })
    .where(eq(workflowTemplates.id, source.id));

  return context.json({ template: serializeWorkflowTemplate(template, org.orgId) }, 201);
});

router.post('/templates/:id/clone', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const template = await db.query.workflowTemplates.findFirst({
    where: or(
      and(eq(workflowTemplates.orgId, org.orgId), templateLookup(id)),
      and(eq(workflowTemplates.isPublic, true), templateLookup(id)),
    ),
  });

  if (!template) {
    return context.json({ error: 'Template not found.' }, 404);
  }

  const payload = validateWorkflowDefinition({
    name: template.name,
    description: template.description ?? undefined,
    triggerType: template.triggerType,
    triggerConfig: template.triggerConfig ?? {},
    nodes: template.nodes ?? [],
    edges: template.edges ?? [],
  });

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

  await db
    .update(workflowTemplates)
    .set({ usageCount: sql`${workflowTemplates.usageCount} + 1`, updatedAt: new Date() })
    .where(eq(workflowTemplates.id, template.id));

  return context.json({ workflow }, 201);
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
  const [{ wfCount }] = await db
    .select({ wfCount: count() })
    .from(workflows)
    .where(eq(workflows.orgId, org.orgId));

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
    wfCount === 0
      ? recordProductEventOnce({
        orgId: org.orgId,
        userId: org.userId,
        eventName: 'first_workflow_created',
        metadata: { workflowId: workflow.id, name: workflow.name },
      })
      : Promise.resolve(),
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
      await registerCron(
        updated.id,
        updated.triggerConfig?.cron,
        createScheduledWorkflowRunHandler(updated, { runtimeDb: db }),
      );
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

  const executionAvailable = org.credits?.execution?.available ?? 0;
  if (executionAvailable <= 0) {
    return context.json({
      error: 'Execution credits exhausted. Purchase an execution pack or upgrade to continue.',
      code: 'EXECUTION_CREDITS_EXHAUSTED',
      upgrade: true,
    }, 402);
  }

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

router.post('/:id/run-again', requireOrg, requireRole('owner', 'admin'), zValidator('json', runAgainSchema), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const payload = context.req.valid('json');
  const workflow = await db.query.workflows.findFirst({
    where: and(eq(workflows.id, id), eq(workflows.orgId, org.orgId)),
  });

  if (!workflow) {
    return context.json({ error: 'Workflow not found.' }, 404);
  }

  const runInput = payload.input ?? {};
  const workflowForRun = appendRunAgainInput(workflow, runInput);
  const [run] = await db
    .insert(workflowRuns)
    .values({
      workflowId: workflow.id,
      orgId: workflow.orgId,
      triggeredBy: org.userId,
      status: 'queued',
      triggerSource: 'run_again',
      runLog: [{
        type: 'run_again_input',
        input: runInput,
        timestamp: new Date().toISOString(),
      }],
    })
    .returning();

  const dispatch = await dispatchWorkflowRun({
    runId: run.id,
    workflow: workflowForRun,
    orgContext: org,
  });

  await db
    .update(workflowRuns)
    .set({ executionMode: dispatch.mode })
    .where(eq(workflowRuns.id, run.id));

  await recordProductEvent({
    orgId: org.orgId,
    userId: org.userId,
    eventName: 'workflow.run_again_queued',
    metadata: { workflowId: workflow.id, executionMode: dispatch.mode },
  });

  return context.json({ runId: run.id, status: 'queued', executionMode: dispatch.mode }, 202);
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

  const billingSnapshot = await getBillingSnapshotForOrg(organisation.id);
  const dispatch = await dispatchWorkflowRun({
    runId: run.id,
    workflow,
    orgContext: {
      userId: null,
      orgId: organisation.id,
      orgPlan: organisation.plan,
      orgName: organisation.name,
      credits: billingSnapshot.credits,
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

function createTemplateShareId() {
  return `wft_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function templateLookup(id) {
  return isUuid(id) ? or(eq(workflowTemplates.shareId, id), eq(workflowTemplates.id, id)) : eq(workflowTemplates.shareId, id);
}

function serializeWorkflowTemplate(template, orgId) {
  return {
    id: template.id,
    orgId: template.orgId,
    sourceWorkflowId: template.sourceWorkflowId,
    name: template.name,
    description: template.description,
    parameters: template.parameters ?? {},
    triggerType: template.triggerType,
    triggerConfig: template.triggerConfig ?? {},
    nodes: template.nodes ?? [],
    edges: template.edges ?? [],
    isPublic: template.isPublic,
    shareId: template.orgId === orgId || template.isPublic ? template.shareId : null,
    usageCount: template.usageCount ?? 0,
    ownedByOrg: template.orgId === orgId,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function serializePublicWorkflowTemplate(template) {
  return {
    id: template.id,
    shareId: template.shareId,
    name: template.name,
    description: template.description,
    parameters: template.parameters ?? {},
    triggerType: template.triggerType,
    triggerConfig: template.triggerConfig ?? {},
    nodes: template.nodes ?? [],
    edges: template.edges ?? [],
    createdBy: template.createdBy ?? null,
    usageCount: template.usageCount ?? 0,
    createdAt: template.createdAt,
  };
}

function appendRunAgainInput(workflow, runInput) {
  if (runInput == null || (typeof runInput === 'object' && Object.keys(runInput).length === 0)) {
    return workflow;
  }

  const inputText = typeof runInput === 'string' ? runInput : JSON.stringify(runInput, null, 2);
  return {
    ...workflow,
    nodes: (workflow.nodes ?? []).map((node) => ({
      ...node,
      prompt: [node.prompt, 'RUN AGAIN INPUT', inputText].filter(Boolean).join('\n\n'),
    })),
  };
}

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

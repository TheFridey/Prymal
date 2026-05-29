// ─────────────────────────────────────────────────────────────────
// services/inline-scheduler.js
// Lightweight in-process cron scheduler using node-cron.
// Used when Trigger.dev is not configured.
// Schedules are stored in-memory and re-registered on boot from the DB.
// ─────────────────────────────────────────────────────────────────

import cron from 'node-cron';
import { and, eq } from 'drizzle-orm';
import { getEnvironmentMode } from '../env/parse.js';
import { logger } from '../lib/logger.js';

const log = logger.child({ component: 'scheduler' });
import { organisations, workflowRuns, workflows } from '../db/schema.js';
import { getBillingSnapshotForOrg } from './billing-engine.js';

// Map of workflowId → { task: cron.ScheduledTask, cronExpression: string, registeredAt: Date }
const registry = new Map();

function parseBooleanEnv(value) {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return null;
}

export function isInlineSchedulerEnabled(env = process.env) {
  const explicit = parseBooleanEnv(env.INLINE_SCHEDULER_ENABLED);

  if (explicit !== null) {
    return explicit;
  }

  const mode = getEnvironmentMode(env.NODE_ENV);
  const nodeAppInstance = String(env.NODE_APP_INSTANCE ?? '').trim();

  if ((mode === 'staging' || mode === 'production') && nodeAppInstance) {
    return nodeAppInstance === '0';
  }

  return true;
}

/**
 * Register a cron schedule for a workflow.
 * @param {string} workflowId
 * @param {string} cronExpression
 * @param {() => void | Promise<void>} handler
 */
export function registerSchedule(workflowId, cronExpression, handler) {
  if (registry.has(workflowId)) {
    registry.get(workflowId).task.stop();
    registry.delete(workflowId);
  }

  if (!cron.validate(cronExpression)) {
    log.warn({ workflow_id: workflowId, cron: cronExpression }, 'scheduler.invalid_cron');
    return;
  }

  const task = cron.schedule(cronExpression, async () => {
    try {
      await handler();
    } catch (error) {
      log.error({ err: error, workflow_id: workflowId }, 'scheduler.cron_handler_failed');
    }
  });

  registry.set(workflowId, {
    task,
    cronExpression,
    registeredAt: new Date(),
  });

  log.info({ workflow_id: workflowId, cron: cronExpression }, 'scheduler.registered');
}

/**
 * Remove a cron schedule for a workflow.
 * @param {string} workflowId
 */
export function deregisterSchedule(workflowId) {
  const entry = registry.get(workflowId);
  if (entry) {
    entry.task.stop();
    registry.delete(workflowId);
    log.info({ workflow_id: workflowId }, 'scheduler.deregistered');
  }
}

/**
 * Returns all currently registered schedules.
 * @returns {Array<{ workflowId: string, cronExpression: string, registeredAt: Date }>}
 */
export function getRegisteredSchedules() {
  return [...registry.entries()].map(([workflowId, entry]) => ({
    workflowId,
    cronExpression: entry.cronExpression,
    registeredAt: entry.registeredAt,
  }));
}

export async function buildScheduledWorkflowOrgContext(workflow, runtimeDb, options = {}) {
  const organisation = await runtimeDb.query.organisations.findFirst({
    where: eq(organisations.id, workflow.orgId),
  });

  if (!organisation) {
    throw new Error(`Organisation ${workflow.orgId} was not found for scheduled workflow ${workflow.id}.`);
  }

  const loadBillingSnapshot = options.getBillingSnapshotForOrg ?? getBillingSnapshotForOrg;
  const billingSnapshot = await loadBillingSnapshot(organisation.id).catch((error) => {
    log.error({ err: error, workflow_id: workflow.id, org_id: workflow.orgId }, 'scheduler.billing_snapshot_failed');
    return null;
  });

  return {
    userId: null,
    orgId: organisation.id,
    orgPlan: organisation.plan,
    orgName: organisation.name,
    credits: billingSnapshot?.credits ?? {
      execution: {
        available: Math.max((organisation.monthlyCreditLimit ?? 0) - (organisation.creditsUsed ?? 0), 0),
        committedThisCycle: organisation.creditsUsed ?? 0,
        includedAvailable: Math.max((organisation.monthlyCreditLimit ?? 0) - (organisation.creditsUsed ?? 0), 0),
        purchasedAvailable: 0,
        reserved: 0,
      },
      video: {
        available: 0,
        committedThisCycle: 0,
        includedAvailable: 0,
        purchasedAvailable: 0,
        reserved: 0,
      },
    },
  };
}

export function createScheduledWorkflowRunHandler(workflow, options = {}) {
  return async () => {
    const runtimeDb = options.runtimeDb ?? (await import('../db/index.js')).db;
    const dispatchWorkflowRun =
      options.dispatchWorkflowRun ?? (await import('../queue/trigger.js')).dispatchWorkflowRun;

    const [run] = await runtimeDb
      .insert(workflowRuns)
      .values({
        workflowId: workflow.id,
        orgId: workflow.orgId,
        triggeredBy: 'schedule',
        status: 'queued',
        triggerSource: 'schedule',
        nodeOutputs: {},
        runLog: [],
      })
      .returning();

    const orgContext = await buildScheduledWorkflowOrgContext(workflow, runtimeDb, {
      getBillingSnapshotForOrg: options.getBillingSnapshotForOrg,
    });
    const dispatch = await dispatchWorkflowRun({
      runId: run.id,
      workflow,
      orgContext,
    });

    await runtimeDb
      .update(workflowRuns)
      .set({ executionMode: dispatch.mode })
      .where(eq(workflowRuns.id, run.id));
  };
}

/**
 * Boot the inline scheduler: load all active scheduled workflows from DB
 * and register their cron handlers.
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 * @returns {{ stop: () => void }}
 */
export async function startInlineScheduler(db) {
  log.info('scheduler.starting');

  let scheduledWorkflows = [];

  try {
    scheduledWorkflows = await db.query.workflows.findMany({
      where: and(
        eq(workflows.triggerType, 'schedule'),
        eq(workflows.isActive, true),
      ),
    });
  } catch (error) {
    log.error({ err: error }, 'scheduler.db_load_failed');
  }

  let registered = 0;

  for (const workflow of scheduledWorkflows) {
    const cronExpression = workflow.triggerConfig?.cron;
    if (!cronExpression) {
      log.warn({ workflow_id: workflow.id }, 'scheduler.missing_cron');
      continue;
    }

    registerSchedule(workflow.id, cronExpression, createScheduledWorkflowRunHandler(workflow, { runtimeDb: db }));

    registered += 1;
  }

  log.info({ registered }, 'scheduler.ready');

  return {
    stop() {
      for (const [workflowId] of registry.entries()) {
        deregisterSchedule(workflowId);
      }
      log.info('scheduler.stopped');
    },
  };
}

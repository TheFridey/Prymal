// ─────────────────────────────────────────────────────────────────
// services/inline-scheduler.js
// Lightweight in-process cron scheduler using node-cron.
// Used when Trigger.dev is not configured.
// Schedules are stored in-memory and re-registered on boot from the DB.
// ─────────────────────────────────────────────────────────────────

import cron from 'node-cron';
import { eq, and } from 'drizzle-orm';
import { workflows } from '../db/schema.js';

// Map of workflowId → { task: cron.ScheduledTask, cronExpression: string, registeredAt: Date }
const registry = new Map();

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
    console.warn(`[SCHEDULER] Invalid cron expression "${cronExpression}" for workflow ${workflowId} — skipping.`);
    return;
  }

  const task = cron.schedule(cronExpression, async () => {
    try {
      await handler();
    } catch (error) {
      console.error(`[SCHEDULER] Cron handler failed for workflow ${workflowId}:`, error.message);
    }
  });

  registry.set(workflowId, {
    task,
    cronExpression,
    registeredAt: new Date(),
  });

  console.log(`[SCHEDULER] Registered schedule for workflow ${workflowId}: ${cronExpression}`);
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
    console.log(`[SCHEDULER] Deregistered schedule for workflow ${workflowId}.`);
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

/**
 * Boot the inline scheduler: load all active scheduled workflows from DB
 * and register their cron handlers.
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 * @returns {{ stop: () => void }}
 */
export async function startInlineScheduler(db) {
  console.log('[SCHEDULER] Starting inline cron scheduler...');

  let scheduledWorkflows = [];

  try {
    scheduledWorkflows = await db.query.workflows.findMany({
      where: and(
        eq(workflows.triggerType, 'schedule'),
        eq(workflows.enabled, true),
      ),
    });
  } catch (error) {
    console.error('[SCHEDULER] Failed to load scheduled workflows from DB:', error.message);
  }

  let registered = 0;

  for (const workflow of scheduledWorkflows) {
    const cronExpression = workflow.triggerConfig?.cron;
    if (!cronExpression) {
      console.warn(`[SCHEDULER] Workflow ${workflow.id} has no cron expression — skipping.`);
      continue;
    }

    registerSchedule(workflow.id, cronExpression, async () => {
      try {
        // Lazy import to avoid circular deps during boot
        const { dispatchWorkflowRun } = await import('../queue/trigger.js');
        const { db: runtimeDb } = await import('../db/index.js');

        // Create a fresh run record
        const { workflowRuns } = await import('../db/schema.js');
        const [run] = await runtimeDb.insert(workflowRuns).values({
          workflowId: workflow.id,
          orgId: workflow.orgId,
          status: 'queued',
          nodeOutputs: {},
          runLog: [],
        }).returning();

        await dispatchWorkflowRun({
          runId: run.id,
          workflow,
          orgContext: { orgId: workflow.orgId, orgPlan: 'teams', userId: null },
        });
      } catch (error) {
        console.error(`[SCHEDULER] Failed to dispatch scheduled run for workflow ${workflow.id}:`, error.message);
      }
    });

    registered += 1;
  }

  console.log(`[SCHEDULER] Inline scheduler ready. ${registered} schedule(s) registered.`);

  return {
    stop() {
      for (const [workflowId] of registry.entries()) {
        deregisterSchedule(workflowId);
      }
      console.log('[SCHEDULER] Inline scheduler stopped.');
    },
  };
}

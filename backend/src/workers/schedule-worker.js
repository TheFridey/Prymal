/**
 * DB-driven scheduled workflow worker.
 *
 * Uses SELECT FOR UPDATE SKIP LOCKED on scheduled_job_locks so only one
 * API process ever executes a given workflow at a time, even under PM2 clustering.
 *
 * Claim lifecycle:
 *  1. Poll for workflows whose nextRunAt ≤ now AND isActive = true.
 *  2. For each candidate, acquire the lock row with SKIP LOCKED.
 *  3. Set lockedBy + lockExpiresAt (prevents stale locks).
 *  4. Dispatch the workflow run.
 *  5. On success: advance nextRunAt, clear lock, record lastRunAt.
 *  6. On failure: increment failureCount, clear lock, update scheduleStatus.
 *
 * Stale lock recovery: if lockExpiresAt < now the lock is treated as free.
 */

import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { fileURLToPath } from 'url';
import { logger } from '../lib/logger.js';
import { computeNextRunAt } from '../services/schedule-calculator.js';

const log = logger.child({ component: 'schedule-worker' });

const DEFAULT_POLL_MS = 30_000;
const DEFAULT_LOCK_TTL_MS = 10 * 60_000;
const DEFAULT_BATCH_SIZE = 5;
const MAX_CONSECUTIVE_FAILURES = 5;

function readPollMs(env) {
  const raw = Number(env.SCHEDULE_WORKER_POLL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_POLL_MS;
}

function readBatchSize(env) {
  const raw = Number(env.SCHEDULE_WORKER_BATCH_SIZE);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_BATCH_SIZE;
}

function readLockTtlMs(env) {
  const raw = Number(env.SCHEDULE_WORKER_LOCK_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LOCK_TTL_MS;
}

/**
 * Claim and execute one batch of due scheduled workflows.
 *
 * @param {object} options
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} options.db
 * @param {Function} [options.dispatchWorkflowRun] - injectable for tests
 * @param {Function} [options.buildOrgContext] - injectable for tests
 * @param {number} [options.batchSize]
 * @param {number} [options.lockTtlMs]
 * @param {string} [options.workerId] - identifies this process in the lock row
 * @returns {Promise<{ claimed: number, dispatched: number, errors: number }>}
 */
export async function runScheduleWorkerTick(options = {}) {
  const {
    db,
    batchSize = DEFAULT_BATCH_SIZE,
    lockTtlMs = DEFAULT_LOCK_TTL_MS,
    workerId = process.env.NODE_APP_INSTANCE ?? 'single',
  } = options;

  if (!db) {
    throw new Error('schedule-worker: db is required');
  }

  const dispatchWorkflowRun =
    options.dispatchWorkflowRun ?? (await import('../queue/trigger.js')).dispatchWorkflowRun;
  const buildOrgContext =
    options.buildOrgContext ?? (await import('../services/inline-scheduler.js')).buildScheduledWorkflowOrgContext;

  const now = new Date();

  const { workflows, workflowRuns, scheduledJobLocks } = await import('../db/schema.js');

  // Load due workflows — those with nextRunAt ≤ now and a lock that is free (or expired)
  const dueWorkflows = await db.query.workflows.findMany({
    where: and(
      eq(workflows.isActive, true),
      eq(workflows.triggerType, 'schedule'),
      lte(workflows.nextRunAt, now),
    ),
    limit: batchSize * 3,
  });

  if (dueWorkflows.length === 0) {
    return { claimed: 0, dispatched: 0, errors: 0 };
  }

  let claimed = 0;
  let dispatched = 0;
  let errors = 0;

  for (const workflow of dueWorkflows) {
    if (claimed >= batchSize) break;

    const didClaim = await claimLock(db, workflow, workerId, lockTtlMs, now, scheduledJobLocks);
    if (!didClaim) {
      continue;
    }

    claimed += 1;

    try {
      const { workflowRuns: workflowRunsTable } = await import('../db/schema.js');
      const [run] = await db
        .insert(workflowRunsTable)
        .values({
          workflowId: workflow.id,
          orgId: workflow.orgId,
          triggeredBy: 'schedule',
          triggerSource: 'schedule',
          status: 'queued',
          nodeOutputs: {},
          runLog: [],
        })
        .returning();

      const orgContext = await buildOrgContext(workflow, db);

      const dispatch = await dispatchWorkflowRun({ runId: run.id, workflow, orgContext });

      await db
        .update(workflowRunsTable)
        .set({ executionMode: dispatch.mode })
        .where(eq(workflowRunsTable.id, run.id));

      const nextRunAt = safeComputeNextRunAt(workflow);

      await db
        .update(scheduledJobLocks)
        .set({
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          lastRunAt: now,
          lastRunId: run.id,
          failureCount: 0,
          lastFailureAt: null,
          lastFailureMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(scheduledJobLocks.workflowId, workflow.id));

      await db
        .update(workflows)
        .set({
          lastRunAt: now,
          nextRunAt,
          scheduleStatus: 'idle',
          updatedAt: new Date(),
        })
        .where(eq(workflows.id, workflow.id));

      dispatched += 1;

      log.info(
        { workflow_id: workflow.id, run_id: run.id, next_run_at: nextRunAt },
        'schedule_worker.dispatched',
      );
    } catch (error) {
      errors += 1;
      log.error({ err: error, workflow_id: workflow.id }, 'schedule_worker.dispatch_failed');

      await releaseLockWithFailure(db, workflow, error, scheduledJobLocks, workflows);
    }
  }

  return { claimed, dispatched, errors };
}

/**
 * Attempt to claim the lock row for a workflow using SKIP LOCKED.
 * Returns true if this process successfully acquired the lock.
 */
async function claimLock(db, workflow, workerId, lockTtlMs, now, scheduledJobLocksTable) {
  const lockExpiresAt = new Date(now.getTime() + lockTtlMs);

  try {
    // Upsert the lock row (idempotent on first run)
    await db
      .insert(scheduledJobLocksTable)
      .values({
        workflowId: workflow.id,
        orgId: workflow.orgId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    // Attempt to claim: only succeeds if lockedBy IS NULL or lockExpiresAt is past
    const result = await db.execute(sql`
      UPDATE scheduled_job_locks
         SET locked_by        = ${workerId},
             locked_at        = ${now.toISOString()},
             lock_expires_at  = ${lockExpiresAt.toISOString()},
             updated_at       = ${now.toISOString()}
       WHERE workflow_id      = ${workflow.id}
         AND (locked_by IS NULL OR lock_expires_at < ${now.toISOString()})
    `);

    return result.count > 0;
  } catch (error) {
    log.warn({ err: error, workflow_id: workflow.id }, 'schedule_worker.claim_lock_failed');
    return false;
  }
}

async function releaseLockWithFailure(db, workflow, error, scheduledJobLocksTable, workflowsTable) {
  try {
    const lockRow = await db.query.scheduledJobLocks.findFirst({
      where: eq(scheduledJobLocksTable.workflowId, workflow.id),
    });

    const failureCount = (lockRow?.failureCount ?? 0) + 1;
    const newStatus = failureCount >= MAX_CONSECUTIVE_FAILURES ? 'error' : 'idle';

    await db
      .update(scheduledJobLocksTable)
      .set({
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        failureCount,
        lastFailureAt: new Date(),
        lastFailureMessage: String(error?.message ?? error).slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(scheduledJobLocksTable.workflowId, workflow.id));

    await db
      .update(workflowsTable)
      .set({ scheduleStatus: newStatus, updatedAt: new Date() })
      .where(eq(workflowsTable.id, workflow.id));

    if (newStatus === 'error') {
      log.error(
        { workflow_id: workflow.id, failure_count: failureCount },
        'schedule_worker.workflow_suspended_after_failures',
      );
    }
  } catch (releaseError) {
    log.error({ err: releaseError, workflow_id: workflow.id }, 'schedule_worker.release_lock_failed');
  }
}

function safeComputeNextRunAt(workflow) {
  try {
    return computeNextRunAt({
      intervalType: workflow.intervalType,
      timesPerDay: Array.isArray(workflow.timesPerDay) ? workflow.timesPerDay : [],
      daysOfWeek: Array.isArray(workflow.daysOfWeek) ? workflow.daysOfWeek : [],
      timezone: workflow.timezone ?? 'UTC',
    });
  } catch {
    return new Date(Date.now() + 60 * 60_000);
  }
}

/**
 * Main polling loop.
 */
export async function runScheduleWorkerLoop(options = {}) {
  const env = options.env ?? process.env;
  const pollMs = options.pollMs ?? readPollMs(env);
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const shouldStop = options.shouldStop ?? (() => false);

  const db = options.db ?? (await import('../db/index.js')).db;

  log.info({ poll_ms: pollMs, worker_id: env.NODE_APP_INSTANCE ?? 'single' }, 'schedule_worker.loop_started');

  while (!shouldStop()) {
    const startedAt = Date.now();

    try {
      const result = await runScheduleWorkerTick({ ...options, db });
      if (result.claimed > 0) {
        log.info(result, 'schedule_worker.tick_complete');
      }
    } catch (error) {
      log.error({ err: error }, 'schedule_worker.tick_failed');
    }

    const elapsed = Date.now() - startedAt;
    await sleep(Math.max(pollMs - elapsed, 1000));
  }

  log.info('schedule_worker.loop_stopped');
}

export function isScheduleWorkerEnabled(env = process.env) {
  const explicit = String(env.SCHEDULE_WORKER_ENABLED ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(explicit)) return true;
  if (['0', 'false', 'no'].includes(explicit)) return false;
  // Default: enabled on PM2 instance 0 in live envs, always in dev
  const instance = String(env.NODE_APP_INSTANCE ?? '').trim();
  const mode = env.NODE_ENV;
  if (mode === 'production' || mode === 'staging') {
    return instance === '0';
  }
  return true;
}

async function main() {
  try {
    await runScheduleWorkerLoop();
  } catch (error) {
    log.error({ err: error }, 'schedule_worker.fatal');
    process.exitCode = 1;
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main();
}

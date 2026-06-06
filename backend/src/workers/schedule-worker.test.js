import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { runScheduleWorkerTick, isScheduleWorkerEnabled } = await import('./schedule-worker.js');

// ── isScheduleWorkerEnabled ──────────────────────────────────────────────────

test('isScheduleWorkerEnabled: disabled on non-zero PM2 instance in production', () => {
  assert.equal(isScheduleWorkerEnabled({ NODE_ENV: 'production', NODE_APP_INSTANCE: '1' }), false);
  assert.equal(isScheduleWorkerEnabled({ NODE_ENV: 'staging', NODE_APP_INSTANCE: '2' }), false);
});

test('isScheduleWorkerEnabled: enabled on instance 0 in production', () => {
  assert.equal(isScheduleWorkerEnabled({ NODE_ENV: 'production', NODE_APP_INSTANCE: '0' }), true);
});

test('isScheduleWorkerEnabled: explicit env override works', () => {
  assert.equal(isScheduleWorkerEnabled({ NODE_ENV: 'production', NODE_APP_INSTANCE: '1', SCHEDULE_WORKER_ENABLED: 'true' }), true);
  assert.equal(isScheduleWorkerEnabled({ NODE_ENV: 'production', NODE_APP_INSTANCE: '0', SCHEDULE_WORKER_ENABLED: 'false' }), false);
});

test('isScheduleWorkerEnabled: enabled in development by default', () => {
  assert.equal(isScheduleWorkerEnabled({ NODE_ENV: 'development' }), true);
  assert.equal(isScheduleWorkerEnabled({}), true);
});

// ── runScheduleWorkerTick: no due workflows ──────────────────────────────────

test('tick returns zero counts when no workflows are due', async () => {
  const db = makeDb({ workflows: [] });

  const result = await runScheduleWorkerTick({ db, batchSize: 5 });

  assert.equal(result.claimed, 0);
  assert.equal(result.dispatched, 0);
  assert.equal(result.errors, 0);
});

// ── runScheduleWorkerTick: happy path ───────────────────────────────────────

test('tick dispatches a due workflow and advances nextRunAt', async () => {
  const now = new Date();
  const dueAt = new Date(now.getTime() - 5000);

  const workflow = makeWorkflow({ nextRunAt: dueAt, intervalType: 'daily', timesPerDay: [9] });
  let dispatchedRunId = null;
  let workflowUpdates = {};
  let lockUpdates = {};

  const db = makeDb({
    workflows: [workflow],
    onDispatch: (runId) => { dispatchedRunId = runId; },
    onWorkflowUpdate: (v) => { workflowUpdates = v; },
    onLockUpdate: (v) => { lockUpdates = v; },
  });

  const result = await runScheduleWorkerTick({
    db,
    batchSize: 5,
    dispatchWorkflowRun: async ({ runId }) => {
      dispatchedRunId = runId;
      return { mode: 'inline' };
    },
    buildOrgContext: async () => ({ orgId: workflow.orgId, orgPlan: 'solo', credits: {} }),
  });

  assert.equal(result.claimed, 1);
  assert.equal(result.dispatched, 1);
  assert.equal(result.errors, 0);
  assert.ok(dispatchedRunId, 'should have dispatched a run');
  assert.ok(workflowUpdates.nextRunAt, 'should advance nextRunAt');
  assert.ok(workflowUpdates.nextRunAt > now, 'nextRunAt should be in the future');
  assert.equal(lockUpdates.lockedBy, null, 'lock should be released after success');
  assert.equal(lockUpdates.failureCount, 0);
});

// ── runScheduleWorkerTick: duplicate prevention ──────────────────────────────

test('tick does not double-dispatch if lock is already held by another worker', async () => {
  const now = new Date();
  const lockHeldUntil = new Date(now.getTime() + 60_000);
  const dueAt = new Date(now.getTime() - 5000);

  const workflow = makeWorkflow({ nextRunAt: dueAt, intervalType: 'daily', timesPerDay: [9] });

  let dispatchCount = 0;

  const db = makeDb({
    workflows: [workflow],
    lockIsHeld: true,
    lockExpiresAt: lockHeldUntil,
  });

  const result = await runScheduleWorkerTick({
    db,
    batchSize: 5,
    dispatchWorkflowRun: async () => {
      dispatchCount++;
      return { mode: 'inline' };
    },
    buildOrgContext: async () => ({ orgId: workflow.orgId, orgPlan: 'solo', credits: {} }),
  });

  assert.equal(result.claimed, 0, 'should not claim a locked workflow');
  assert.equal(dispatchCount, 0, 'should not dispatch when locked');
});

// ── runScheduleWorkerTick: stale lock recovery ───────────────────────────────

test('tick reclaims a stale (expired) lock', async () => {
  const now = new Date();
  const expiredLock = new Date(now.getTime() - 60_000);
  const dueAt = new Date(now.getTime() - 5000);

  const workflow = makeWorkflow({ nextRunAt: dueAt, intervalType: 'daily', timesPerDay: [9] });
  let dispatched = 0;

  const db = makeDb({
    workflows: [workflow],
    lockIsHeld: true,
    lockExpiresAt: expiredLock,
  });

  const result = await runScheduleWorkerTick({
    db,
    batchSize: 5,
    dispatchWorkflowRun: async () => {
      dispatched++;
      return { mode: 'inline' };
    },
    buildOrgContext: async () => ({ orgId: workflow.orgId, orgPlan: 'solo', credits: {} }),
  });

  assert.equal(result.claimed, 1, 'should reclaim expired lock');
  assert.equal(dispatched, 1);
});

// ── runScheduleWorkerTick: failure handling ──────────────────────────────────

test('tick increments failureCount and releases lock on dispatch error', async () => {
  const now = new Date();
  const dueAt = new Date(now.getTime() - 5000);

  const workflow = makeWorkflow({ nextRunAt: dueAt, intervalType: 'daily', timesPerDay: [9] });
  let lockReleased = false;
  let failureCount = 0;

  const db = makeDb({
    workflows: [workflow],
    onLockUpdate: (v) => {
      if (v.lockedBy === null) lockReleased = true;
      if (v.failureCount !== undefined) failureCount = v.failureCount;
    },
  });

  const result = await runScheduleWorkerTick({
    db,
    batchSize: 5,
    dispatchWorkflowRun: async () => {
      throw new Error('Dispatch exploded');
    },
    buildOrgContext: async () => ({ orgId: workflow.orgId, orgPlan: 'solo', credits: {} }),
  });

  assert.equal(result.claimed, 1);
  assert.equal(result.dispatched, 0);
  assert.equal(result.errors, 1);
  assert.ok(lockReleased, 'lock should be released after error');
  assert.equal(failureCount, 1);
});

// ── runScheduleWorkerTick: respects batchSize ────────────────────────────────

test('tick processes at most batchSize workflows per tick', async () => {
  const now = new Date();
  const dueAt = new Date(now.getTime() - 5000);
  const workflows = [1, 2, 3, 4, 5].map((i) =>
    makeWorkflow({ id: `wf-${i}`, nextRunAt: dueAt, intervalType: 'daily', timesPerDay: [9] }),
  );

  let dispatched = 0;
  const db = makeDb({ workflows });

  await runScheduleWorkerTick({
    db,
    batchSize: 2,
    dispatchWorkflowRun: async () => {
      dispatched++;
      return { mode: 'inline' };
    },
    buildOrgContext: async () => ({ orgId: workflows[0].orgId, orgPlan: 'solo', credits: {} }),
  });

  assert.ok(dispatched <= 2, `Should process at most 2 workflows, got ${dispatched}`);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeWorkflow(overrides = {}) {
  return {
    id: overrides.id ?? 'wf-test-1',
    orgId: 'org-test-1',
    triggerType: 'schedule',
    isActive: true,
    intervalType: overrides.intervalType ?? 'daily',
    timesPerDay: overrides.timesPerDay ?? [9],
    daysOfWeek: overrides.daysOfWeek ?? [],
    timezone: 'UTC',
    nextRunAt: overrides.nextRunAt ?? new Date(Date.now() - 1000),
    scheduleStatus: 'idle',
    ...overrides,
  };
}

function makeDb({ workflows = [], lockIsHeld = false, lockExpiresAt = null, onDispatch, onWorkflowUpdate, onLockUpdate } = {}) {
  const lockData = {
    lockedBy: lockIsHeld ? 'other-worker' : null,
    lockExpiresAt,
    failureCount: 0,
  };

  return {
    query: {
      workflows: {
        findMany: async () => workflows,
      },
      scheduledJobLocks: {
        findFirst: async () => lockData,
      },
    },
    insert: () => ({
      values: () => ({
        onConflictDoNothing: async () => {},
        returning: async () => [{ id: 'run-' + Math.random() }],
      }),
    }),
    update: (table) => ({
      set: (values) => {
        if (onWorkflowUpdate && values.nextRunAt !== undefined) {
          onWorkflowUpdate(values);
        }
        if (onLockUpdate && (values.lockedBy !== undefined || values.failureCount !== undefined)) {
          onLockUpdate(values);
        }
        return {
          where: async () => {},
        };
      },
    }),
    execute: async (query) => {
      const queryStr = String(query?.queryChunks?.map((c) => typeof c === 'string' ? c : c?.value)?.join('') ?? query);
      const now = new Date();
      const expired = lockExpiresAt && lockExpiresAt < now;
      const canClaim = !lockIsHeld || expired;
      return { count: canClaim ? 1 : 0 };
    },
  };
}

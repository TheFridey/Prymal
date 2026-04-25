import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  createScheduledWorkflowRunHandler,
  deregisterSchedule,
  getRegisteredSchedules,
  startInlineScheduler,
} = await import('./inline-scheduler.js');
const { registerCron, unregisterCron } = await import('../queue/trigger.js');

test('registerCron activates inline schedules when Trigger.dev is absent', async () => {
  const previousTriggerKey = process.env.TRIGGER_API_KEY;
  delete process.env.TRIGGER_API_KEY;

  try {
    await registerCron('workflow_inline_activation', '0 9 * * 1', async () => {});

    assert.ok(
      getRegisteredSchedules().some((entry) => entry.workflowId === 'workflow_inline_activation'),
    );
  } finally {
    await unregisterCron('workflow_inline_activation');
    if (previousTriggerKey === undefined) {
      delete process.env.TRIGGER_API_KEY;
    } else {
      process.env.TRIGGER_API_KEY = previousTriggerKey;
    }
  }
});

test('startInlineScheduler registers active scheduled workflows using isActive', async () => {
  const workflow = {
    id: 'workflow_active_schedule',
    orgId: 'org_scheduler',
    triggerType: 'schedule',
    triggerConfig: { cron: '0 9 * * 1' },
    isActive: true,
    nodes: [],
    edges: [],
  };
  const fakeDb = {
    query: {
      workflows: {
        findMany: async () => [workflow],
      },
    },
  };

  const scheduler = await startInlineScheduler(fakeDb);

  try {
    const registered = getRegisteredSchedules();
    assert.ok(registered.some((entry) => entry.workflowId === workflow.id));
  } finally {
    scheduler.stop();
  }
});

test('scheduled workflow handler loads the real organisation plan for dispatch', async () => {
  const workflow = {
    id: 'workflow_scheduled_dispatch',
    orgId: 'org_solo',
    triggerType: 'schedule',
    triggerConfig: { cron: '0 9 * * 1' },
    nodes: [],
    edges: [],
  };
  const insertedRun = { id: 'run_scheduled_1' };
  let dispatchedContext = null;
  let executionMode = null;
  const fakeDb = {
    query: {
      organisations: {
        findFirst: async () => ({
          id: 'org_solo',
          name: 'Solo Org',
          plan: 'solo',
          monthlyCreditLimit: 500,
          creditsUsed: 25,
        }),
      },
    },
    insert: () => ({
      values: () => ({
        returning: async () => [insertedRun],
      }),
    }),
    update: () => ({
      set: (values) => {
        executionMode = values.executionMode;
        return {
          where: async () => undefined,
        };
      },
    }),
  };

  const handler = createScheduledWorkflowRunHandler(workflow, {
    runtimeDb: fakeDb,
    getBillingSnapshotForOrg: async () => ({
      credits: {
        execution: { available: 475 },
        video: { available: 0 },
      },
    }),
    dispatchWorkflowRun: async ({ orgContext }) => {
      dispatchedContext = orgContext;
      return { mode: 'inline' };
    },
  });

  await handler();

  assert.equal(dispatchedContext.orgPlan, 'solo');
  assert.equal(dispatchedContext.orgName, 'Solo Org');
  assert.equal(dispatchedContext.credits.execution.available, 475);
  assert.equal(executionMode, 'inline');
});

test.afterEach(() => {
  for (const entry of getRegisteredSchedules()) {
    deregisterSchedule(entry.workflowId);
  }
});

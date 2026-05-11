import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { db } = await import('../db/index.js');
const { organisations, workflowRuns, workflows } = await import('../db/schema.js');
const {
  claimQueuedWorkflowRunForExecution,
  executeWorkflowRun,
} = await import('./workflow-engine.js');

const baseOrgId = randomUUID();
const baseWorkflowId = randomUUID();

const workflow = {
  id: baseWorkflowId,
  orgId: baseOrgId,
  nodes: [
    {
      id: 'node_1',
      agentId: 'cipher',
      prompt: 'Summarise the launch risks.',
      outputVar: 'summary',
    },
  ],
  edges: [],
};

const orgContext = {
  orgId: baseOrgId,
  orgPlan: 'pro',
  userId: null,
  credits: { execution: { available: 100 } },
};

before(async () => {
  await db.insert(organisations).values({
    id: baseOrgId,
    name: `Workflow Test Org ${baseOrgId.slice(0, 8)}`,
    slug: `workflow-test-${baseOrgId.slice(0, 8)}`,
    plan: 'pro',
    monthlyCreditLimit: 2000,
  });
});

after(async () => {
  await db.delete(organisations).where(eq(organisations.id, baseOrgId));
});

test('executeWorkflowRun skips duplicate dispatches for already-running runs', async () => {
  const originalFindFirst = db.query.workflowRuns.findFirst;
  db.query.workflowRuns.findFirst = async () => ({
    id: 'run_1',
    status: 'running',
    nodeOutputs: { node_1: { text: 'Already running' } },
    creditsUsed: 2,
  });

  try {
    const result = await executeWorkflowRun({ runId: 'run_1', workflow, orgContext });
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'Workflow run is already running.');
    assert.equal(result.creditsUsed, 2);
  } finally {
    db.query.workflowRuns.findFirst = originalFindFirst;
  }
});

test('executeWorkflowRun does not execute when a queued run cannot be atomically claimed', async () => {
  const originalFindFirst = db.query.workflowRuns.findFirst;
  const originalUpdate = db.update;
  let findCount = 0;
  let updateAttempted = false;

  db.query.workflowRuns.findFirst = async () => {
    findCount += 1;
    return findCount === 1
      ? {
          id: 'run_2',
          status: 'queued',
          nodeOutputs: {},
          creditsUsed: 0,
          attemptCount: 0,
          maxAttempts: 3,
          runLog: [],
        }
      : {
          id: 'run_2',
          status: 'running',
          nodeOutputs: {},
          creditsUsed: 0,
        };
  };

  db.update = () => ({
    set: () => ({
      where: () => ({
        returning: async () => {
          updateAttempted = true;
          return [];
        },
      }),
    }),
  });

  try {
    const result = await executeWorkflowRun({ runId: 'run_2', workflow, orgContext });
    assert.equal(updateAttempted, true);
    assert.equal(result.skipped, true);
    assert.match(result.reason, /not claimable from status "running"/);
  } finally {
    db.query.workflowRuns.findFirst = originalFindFirst;
    db.update = originalUpdate;
  }
});

test(
  'claimQueuedWorkflowRunForExecution allows only one DB-backed claimant',
  {
    skip: process.env.PRYMAL_RUN_DB_WORKFLOW_CONCURRENCY_TESTS === 'true'
      ? false
      : 'Set PRYMAL_RUN_DB_WORKFLOW_CONCURRENCY_TESTS=true with a migrated test database to run DB-backed workflow race proof.',
  },
  async () => {
    const orgId = randomUUID();
    const workflowId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    const existingRun = {
      id: runId,
      status: 'queued',
      startedAt: null,
      nodeOutputs: {},
      creditsUsed: 0,
    };

    await db.insert(organisations).values({
      id: orgId,
      name: `Concurrency Org ${orgId.slice(0, 8)}`,
      slug: `concurrency-${orgId.slice(0, 8)}`,
      plan: 'pro',
      monthlyCreditLimit: 2000,
    });

    try {
      await db.insert(workflows).values({
        id: workflowId,
        orgId,
        name: 'Concurrency proof workflow',
        triggerType: 'manual',
        nodes: [{ id: 'node_1', agentId: 'cipher', prompt: 'Test', outputVar: 'out' }],
        edges: [],
      });

      await db.insert(workflowRuns).values({
        id: runId,
        workflowId,
        orgId,
        status: 'queued',
        triggerSource: 'manual',
      });

      const claimAttempts = await Promise.all([
        claimQueuedWorkflowRunForExecution({
          runId,
          existingRun,
          runLog: [{ level: 'system', message: 'claim-a' }],
          attemptCount: 1,
          maxAttempts: 3,
          timeoutAt: new Date(now.getTime() + 60_000),
        }),
        claimQueuedWorkflowRunForExecution({
          runId,
          existingRun,
          runLog: [{ level: 'system', message: 'claim-b' }],
          attemptCount: 1,
          maxAttempts: 3,
          timeoutAt: new Date(now.getTime() + 60_000),
        }),
      ]);

      const winners = claimAttempts.filter((attempt) => attempt.claimedRun);
      const skipped = claimAttempts.filter((attempt) => !attempt.claimedRun);
      const persistedRun = await db.query.workflowRuns.findFirst({
        where: eq(workflowRuns.id, runId),
      });

      assert.equal(winners.length, 1);
      assert.equal(skipped.length, 1);
      assert.equal(persistedRun.status, 'running');
      assert.match(skipped[0].skippedResult.reason, /not claimable from status "running"/);
    } finally {
      await db.delete(organisations).where(eq(organisations.id, orgId));
    }
  },
);

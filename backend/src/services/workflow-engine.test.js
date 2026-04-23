import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { db } = await import('../db/index.js');
const { executeWorkflowRun } = await import('./workflow-engine.js');

const workflow = {
  id: 'workflow_1',
  orgId: 'org_1',
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
  orgId: 'org_1',
  orgPlan: 'pro',
  userId: 'user_1',
  credits: { execution: { available: 100 } },
};

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

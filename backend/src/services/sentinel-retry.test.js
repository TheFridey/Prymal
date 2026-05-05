import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { reviewWorkflowNodeOutputWithSentinel } = await import('./workflow-sentinel.js');

const baseNode = { id: 'node_1', agentId: 'cipher' };
const baseWorkflow = { id: 'workflow_1' };
const baseOrgContext = { orgId: 'org_1', orgPlan: 'pro', userId: 'user_1' };

function makePassReviewer() {
  return () => ({ verdict: 'PASS', riskScore: 0.1, concerns: [], repair_actions: [], hold_reason: null });
}

function makeRepairReviewer(callCount = { n: 0 }, pasAfterAttempt = 2) {
  return () => {
    callCount.n += 1;
    if (callCount.n >= pasAfterAttempt) {
      return { verdict: 'PASS', riskScore: 0.15, concerns: [], repair_actions: [], hold_reason: null };
    }
    return { verdict: 'REPAIR', riskScore: 0.45, concerns: ['weak grounding'], repair_actions: ['add citations'] };
  };
}

function makeHoldReviewer() {
  return () => ({ verdict: 'HOLD', riskScore: 0.95, concerns: ['ungrounded'], repair_actions: [], hold_reason: 'Grounding too weak.' });
}

async function noopRepair() {
  return { text: 'repaired output', sources: [] };
}

async function repairWithFallback({ attemptNumber }) {
  return {
    text: `repaired attempt ${attemptNumber}`,
    sources: [],
    providerFallbackUsed: attemptNumber >= 2,
  };
}

test('PASS on first review — no repair attempted', async () => {
  const result = await reviewWorkflowNodeOutputWithSentinel({
    node: baseNode,
    workflow: baseWorkflow,
    orgContext: baseOrgContext,
    result: { text: 'great output', sources: [] },
    evaluation: { groundedness: 'well_grounded' },
    repairOutput: noopRepair,
    reviewer: makePassReviewer(),
  });

  assert.equal(result.verdict, 'PASS');
  assert.equal(result.repairAttempted, false);
  assert.equal(result.sentinelRepairAttempts, 0);
});

test('second REPAIR attempt fires when first attempt fails', async () => {
  let repairCallCount = 0;
  const callCount = { n: 0 };
  const reviewer = makeRepairReviewer(callCount, 3); // PASS on 3rd review call

  const result = await reviewWorkflowNodeOutputWithSentinel({
    node: baseNode,
    workflow: baseWorkflow,
    orgContext: baseOrgContext,
    result: { text: 'weak output', sources: [] },
    evaluation: { groundedness: 'weak_grounding' },
    repairOutput: async ({ attemptNumber }) => {
      repairCallCount += 1;
      return { text: `attempt ${attemptNumber}`, sources: [] };
    },
    reviewer,
  });

  assert.equal(repairCallCount, 2, 'repairOutput should be called twice');
  assert.equal(result.sentinelRepairAttempts, 2);
  assert.equal(result.verdict, 'PASS');
});

test('provider fallback flag set on second repair attempt', async () => {
  const callCount = { n: 0 };
  const reviewer = makeRepairReviewer(callCount, 3); // PASS on 3rd call

  const result = await reviewWorkflowNodeOutputWithSentinel({
    node: baseNode,
    workflow: baseWorkflow,
    orgContext: baseOrgContext,
    result: { text: 'weak output', sources: [] },
    evaluation: { groundedness: 'weak_grounding' },
    repairOutput: repairWithFallback,
    reviewer,
  });

  assert.equal(result.sentinelRepairAttempts, 2);
  assert.equal(result.sentinelProviderFallback, true);
});

test('maximum 2 repair attempts enforced — HOLD after both fail', async () => {
  let repairCallCount = 0;

  const result = await reviewWorkflowNodeOutputWithSentinel({
    node: baseNode,
    workflow: baseWorkflow,
    orgContext: baseOrgContext,
    result: { text: 'bad output', sources: [] },
    evaluation: { groundedness: 'ungrounded', hallucinationRisk: 'high' },
    repairOutput: async () => {
      repairCallCount += 1;
      return { text: 'still bad', sources: [] };
    },
    reviewer: makeHoldReviewer(),
  });

  assert.equal(result.verdict, 'HOLD');
  assert.ok(repairCallCount <= 2, `Max 2 repair attempts enforced; got ${repairCallCount}`);
  assert.equal(result.sentinelRepairAttempts, 2);
  assert.equal(result.sentinelFinalVerdict, 'HOLD');
});

test('trace records repair attempt count correctly', async () => {
  const callCount = { n: 0 };
  const reviewer = makeRepairReviewer(callCount, 2); // PASS on 2nd review call

  const result = await reviewWorkflowNodeOutputWithSentinel({
    node: baseNode,
    workflow: baseWorkflow,
    orgContext: baseOrgContext,
    result: { text: 'mediocre output', sources: [] },
    evaluation: { groundedness: 'partially_grounded' },
    repairOutput: noopRepair,
    reviewer,
  });

  assert.equal(result.sentinelRepairAttempts, 1);
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.repairAttempted, true);
});

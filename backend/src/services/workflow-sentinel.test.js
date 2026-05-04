import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';
import {
  buildWorkflowSchemaValidation,
  reviewWorkflowNodeOutputWithSentinel,
} from './workflow-sentinel.js';

setupTestEnv();

const baseNode = {
  id: 'node_1',
  agentId: 'cipher',
  prompt: 'Return a launch risk summary.',
  outputVar: 'summary',
};
const baseWorkflow = { id: 'workflow_1' };
const baseOrgContext = { orgId: 'org_1', orgPlan: 'pro', userId: 'user_1' };
const baseResult = {
  text: 'Grounded summary.',
  provider: 'openai',
  model: 'gpt-5.4-mini',
  sources: [{ documentTitle: 'Launch plan' }],
  trace: { schemaValidation: { verdict: 'pass' }, toolsUsed: [] },
};
const baseEvaluation = {
  groundedness: 'well_grounded',
  hallucinationRisk: 'low',
  toolUsePass: true,
  instructionAdherence: 'pass',
};

test('workflow node output that passes SENTINEL continues to downstream nodes', async () => {
  const review = await reviewWorkflowNodeOutputWithSentinel({
    node: baseNode,
    workflow: baseWorkflow,
    orgContext: baseOrgContext,
    result: baseResult,
    evaluation: baseEvaluation,
    reviewer: () => ({ verdict: 'PASS', hold_reason: null }),
  });

  assert.equal(review.verdict, 'PASS');
  assert.equal(review.result.text, 'Grounded summary.');
  assert.equal(review.repairAttempted, false);
});

test('workflow node output that triggers REPAIR is corrected and continues', async () => {
  let reviewCount = 0;
  const review = await reviewWorkflowNodeOutputWithSentinel({
    node: baseNode,
    workflow: baseWorkflow,
    orgContext: baseOrgContext,
    result: baseResult,
    evaluation: baseEvaluation,
    reviewer: () => {
      reviewCount += 1;
      return reviewCount === 1
        ? { verdict: 'REPAIR', repair_actions: ['Tighten the structure.'], hold_reason: null }
        : { verdict: 'PASS', hold_reason: null };
    },
    repairOutput: async () => ({ ...baseResult, text: 'Corrected grounded summary.' }),
  });

  assert.equal(review.verdict, 'PASS');
  assert.equal(review.result.text, 'Corrected grounded summary.');
  assert.equal(review.repairAttempted, true);
});

test('workflow node output that triggers HOLD returns a degraded gate result', async () => {
  const review = await reviewWorkflowNodeOutputWithSentinel({
    node: baseNode,
    workflow: baseWorkflow,
    orgContext: baseOrgContext,
    result: baseResult,
    evaluation: { ...baseEvaluation, hallucinationRisk: 'high' },
    reviewer: () => ({
      verdict: 'HOLD',
      hold_reason: 'Grounding confidence fell below the Sentinel approval threshold.',
    }),
  });

  assert.equal(review.verdict, 'HOLD');
  assert.match(review.review.hold_reason, /Grounding confidence|sentinel/i);
  assert.equal(review.repairAttempted, false);
});

test('SENTINEL failure in workflow context does not propagate as an unhandled exception', async () => {
  const review = await reviewWorkflowNodeOutputWithSentinel({
    node: baseNode,
    workflow: baseWorkflow,
    orgContext: baseOrgContext,
    result: baseResult,
    evaluation: baseEvaluation,
    reviewer: () => {
      throw new Error('SENTINEL unavailable');
    },
  });

  assert.equal(review.verdict, 'HOLD');
  assert.equal(review.review.hold_reason, 'sentinel_review_error');
});

test('workflow SENTINEL schema validation passes JSON object outputs', () => {
  const schemaValidation = buildWorkflowSchemaValidation({
    outputSchema: {
      type: 'object',
      required: ['summary'],
      properties: { summary: { type: 'string' } },
    },
    result: { text: JSON.stringify({ summary: 'Launch risk summary.' }) },
  });

  assert.equal(schemaValidation.verdict, 'pass');
});

test('workflow SENTINEL schema validation fails non-JSON object outputs', () => {
  const schemaValidation = buildWorkflowSchemaValidation({
    outputSchema: {
      type: 'object',
      required: ['summary'],
      properties: { summary: { type: 'string' } },
    },
    result: { text: 'Launch risk summary.' },
  });

  assert.equal(schemaValidation.verdict, 'failed');
  assert.match(schemaValidation.errors[0].message, /not valid JSON/i);
});

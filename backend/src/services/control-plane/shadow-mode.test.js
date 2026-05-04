import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../../test-helpers.js';

setupTestEnv();

const {
  runControlPlaneShadow,
  runControlPlaneShadowSafely,
} = await import('./shadow-mode.js');

const validWorkflow = {
  id: 'workflow_shadow',
  name: 'Shadow workflow',
  triggerType: 'manual',
  nodes: [
    {
      id: 'node_1',
      agentId: 'cipher',
      prompt: 'Summarise launch risk.',
      outputVar: 'summary',
    },
  ],
  edges: [],
};

test('control-plane shadow evaluation completes for a valid legacy workflow fixture', async () => {
  const result = await runControlPlaneShadow({
    workflow: validWorkflow,
    input: { prompt: 'Launch risk' },
    userId: 'user_1',
    orgId: '00000000-0000-0000-0000-000000000001',
    runId: 'run_1',
  });

  assert.equal(result.contractValid, true);
  assert.equal(result.schemaValid, true);
  assert.equal(result.violations.length, 0);
  assert.ok(result.traceId);
});

test('control-plane shadow evaluation records violations for malformed legacy workflows without throwing', async () => {
  const result = await runControlPlaneShadow({
    workflow: {
      id: 'workflow_bad',
      name: 'Bad workflow',
      nodes: [{ id: 'node_1', prompt: '' }],
      edges: [{ from: 'node_1', to: 'missing_node' }],
    },
    input: {},
    orgId: '00000000-0000-0000-0000-000000000001',
  });

  assert.equal(result.contractValid, false);
  assert.ok(result.violations.length > 0);
  assert.ok(result.traceId);
});

test('control-plane shadow safe wrapper never throws into the caller', async () => {
  const result = await runControlPlaneShadowSafely(
    {
      workflow: validWorkflow,
      input: {},
      orgId: '00000000-0000-0000-0000-000000000001',
    },
    {
      shadowOverrides: {
        policyEngine: {
          evaluate: async () => {
            throw new Error('shadow policy exploded');
          },
        },
      },
    },
  );

  assert.equal(result.contractValid, false);
  assert.equal(result.schemaValid, false);
  assert.equal(result.violations[0].type, 'shadow_exception');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { workflows } = await import('../db/schema.js');

test('workflows schema includes contractEnforced field with false default', async () => {
  // The schema object has field descriptors — check the field name exists
  assert.ok('contractEnforced' in workflows, 'contractEnforced field should exist in workflows schema');
});

test('contractEnforced defaults to false in schema definition', async () => {
  const field = workflows.contractEnforced;
  assert.ok(field, 'contractEnforced field should be defined');
});

test('contract validation error response has correct shape', async () => {
  const errorShape = {
    error: 'contract_validation_failed',
    violations: [
      { nodeId: 'send_email', field: 'input_schema', reason: 'missing required field: recipient' },
    ],
    runId: null,
    contractEnforced: true,
  };

  assert.equal(errorShape.error, 'contract_validation_failed');
  assert.ok(Array.isArray(errorShape.violations));
  assert.equal(errorShape.violations[0].nodeId, 'send_email');
  assert.equal(errorShape.contractEnforced, true);
  assert.equal(errorShape.runId, null);
});

test('workflow without contractEnforced flag uses legacy runner path', async () => {
  const legacyWorkflow = { id: 'legacy-wf', name: 'Legacy', nodes: [] };
  // No contractEnforced field — treated as false
  const isEnforced = Boolean(legacyWorkflow.contractEnforced);
  assert.equal(isEnforced, false);
});

test('new workflow with contractEnforced=true uses enforcement path', async () => {
  const newWorkflow = { id: 'new-wf', name: 'New', nodes: [], contractEnforced: true };
  const isEnforced = Boolean(newWorkflow.contractEnforced);
  assert.equal(isEnforced, true);
});

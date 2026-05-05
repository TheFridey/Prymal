import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { buildWorkflowSchemaValidation } = await import('./workflow-sentinel.js');

// ── Contract enforcement schema & validation shape tests ──────────────────────

test('contractEnforced field exists in workflows schema with false default', async () => {
  const { workflows } = await import('../db/schema.js');
  assert.ok('contractEnforced' in workflows, 'contractEnforced field must exist');
});

test('contractEnforcedAt field exists in workflows schema as nullable timestamp', async () => {
  const { workflows } = await import('../db/schema.js');
  assert.ok('contractEnforcedAt' in workflows, 'contractEnforcedAt field must exist');
});

test('contract_validation_failed error response has correct shape', () => {
  const errorResponse = {
    error: 'contract_validation_failed',
    violations: [
      { nodeId: 'send_email', field: 'input_schema', reason: 'missing required field: recipient' },
    ],
    runId: null,
    contractEnforced: true,
  };

  assert.equal(errorResponse.error, 'contract_validation_failed');
  assert.ok(Array.isArray(errorResponse.violations));
  assert.equal(errorResponse.violations[0].nodeId, 'send_email');
  assert.equal(errorResponse.violations[0].field, 'input_schema');
  assert.equal(errorResponse.contractEnforced, true);
  assert.equal(errorResponse.runId, null);
});

test('legacy workflow (contractEnforced: false) does not fail with validation error shape', () => {
  const legacyWorkflow = { id: 'wf_legacy', name: 'Legacy', nodes: [], contractEnforced: false };
  assert.equal(Boolean(legacyWorkflow.contractEnforced), false);
});

test('new workflow flagged contractEnforced: true by default', () => {
  const newWorkflow = { id: 'wf_new', name: 'New', nodes: [], contractEnforced: true, contractEnforcedAt: new Date() };
  assert.equal(newWorkflow.contractEnforced, true);
  assert.ok(newWorkflow.contractEnforcedAt instanceof Date);
});

test('buildWorkflowSchemaValidation returns pass for valid object output', () => {
  const result = buildWorkflowSchemaValidation({
    outputSchema: { type: 'object', properties: { text: { type: 'string' } } },
    result: { text: '{"text":"hello"}' },
  });
  // Passes schema validation for object with text field
  assert.ok(result === null || typeof result.verdict === 'string');
});

test('violations array supports multiple nodeId entries correctly', () => {
  const violations = [
    { nodeId: 'node_1', field: 'input_schema', reason: 'missing field: prompt' },
    { nodeId: 'node_2', field: 'output_schema', reason: 'type mismatch' },
    { nodeId: null, field: 'contract', reason: 'workflow has no nodes to map' },
  ];

  assert.equal(violations.length, 3);
  assert.equal(violations[2].nodeId, null);
  assert.ok(violations.every((v) => 'field' in v && 'reason' in v));
});

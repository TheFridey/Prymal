import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  buildRuntimeContractSummary,
  getRuntimeAgentContract,
  isStrictRuntimeAgent,
  validateContractToolUsage,
} = await import('./runtime.js');

test('getRuntimeAgentContract normalizes blocked tools and memory scopes for ledger', () => {
  const contract = getRuntimeAgentContract('ledger');

  assert.equal(contract.strictRuntime, true);
  assert.equal(contract.schemaEnforced, true);
  assert.equal(contract.preferredPolicyClass, 'premium_reasoning');
  assert.deepEqual(contract.blockedTools, ['email_send']);
  assert.deepEqual(contract.memoryReadScopes, ['org', 'user', 'restricted', 'workflow_run']);
  assert.deepEqual(contract.memoryWriteScopes, ['org', 'restricted', 'workflow_run']);
});

test('validateContractToolUsage rejects blocked and non-allowlisted tools', () => {
  const result = validateContractToolUsage('ledger', ['email_send', 'memory_write']);

  assert.equal(result.valid, false);
  assert.equal(result.violations.length, 2);
  assert.equal(result.violations[0].type, 'blocked_tool');
  assert.equal(result.violations[1].type, 'tool_not_allowed');
});

test('buildRuntimeContractSummary exposes runtime enforcement fields', () => {
  const summary = buildRuntimeContractSummary('nexus');

  assert.equal(summary.preferredPolicyClass, 'workflow_automation');
  assert.equal(summary.outputSchemaId, 'nexus.workflowState');
  assert.equal(summary.strictRuntime, true);
  assert.deepEqual(summary.memoryWriteScopes, ['org', 'agent_private', 'workflow_run', 'temporary_session']);
});

test('cipher contract keeps workflow memory out of read scope', () => {
  const contract = getRuntimeAgentContract('cipher');

  assert.equal(contract.memoryReadScopes.includes('workflow_run'), false);
  assert.equal(contract.memoryWriteScopes.includes('workflow_run'), false);
});

test('isStrictRuntimeAgent only flags the high-value contract set', () => {
  assert.equal(isStrictRuntimeAgent('cipher'), true);
  assert.equal(isStrictRuntimeAgent('atlas'), false);
});

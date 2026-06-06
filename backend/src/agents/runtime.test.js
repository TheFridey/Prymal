import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  buildRuntimeContractSummary,
  enforceAgentToolPolicy,
  getRuntimeAgentContract,
  isSideEffectTool,
  isStrictRuntimeAgent,
  validateContractToolUsage,
} = await import('./runtime.js');
const { AGENT_CONTRACTS, CANONICAL_AGENT_OUTPUT_SCHEMAS, getAgentEnforcement } = await import('./contracts.js');
const { getOutputSchema } = await import('./output-schemas.js');

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

test('isStrictRuntimeAgent flags the expanded high-value contract set', () => {
  // Original strict agents (kept)
  for (const agentId of ['cipher', 'ledger', 'nexus', 'vance', 'herald', 'forge', 'sentinel']) {
    assert.equal(isStrictRuntimeAgent(agentId), true, `${agentId} should be strict`);
  }
  // Newly added in WS1 — research / advisory agents that now require strict enforcement
  for (const agentId of ['wren', 'oracle', 'scout', 'sage', 'atlas']) {
    assert.equal(isStrictRuntimeAgent(agentId), true, `${agentId} should be strict after WS1`);
  }
  // Conversational / creative agents stay non-strict
  for (const agentId of ['echo', 'pixel', 'lore']) {
    assert.equal(isStrictRuntimeAgent(agentId), false, `${agentId} should remain non-strict`);
  }
});

test('atlas runtime contract enforces strict runtime + structured output policy', () => {
  const summary = buildRuntimeContractSummary('atlas');
  assert.equal(summary.strictRuntime, true, 'atlas should report strict runtime after WS1');
});

test('validateContractToolUsage on strict agents rejects non-allowlisted tools', () => {
  // sage was loosened pre-WS1 but is now strict — confirm tool policy is enforced.
  const result = validateContractToolUsage('sage', ['email_send']);
  assert.equal(result.valid, false);
  assert.ok(result.violations.length > 0);
});

test('email-focused agents can use the audited email send tool', () => {
  for (const agentId of ['herald', 'wren']) {
    const result = enforceAgentToolPolicy(agentId, 'email_send');
    assert.equal(result.allowed, true, `${agentId} should be allowed to send email`);
    assert.equal(result.requiresAudit, true);
  }
});

test('every contract references an existing canonical output schema', () => {
  for (const [agentId, contract] of Object.entries(AGENT_CONTRACTS)) {
    assert.ok(contract.outputSchema, `${agentId} must declare an output schema`);
    assert.equal(
      contract.outputSchema,
      CANONICAL_AGENT_OUTPUT_SCHEMAS[agentId] ?? contract.outputSchema,
      `${agentId} must use the canonical schema id`,
    );
    assert.ok(getOutputSchema(contract.outputSchema), `${agentId} schema must exist`);
  }
});

test('forge echo and pixel expose explicit enforcement blocks', () => {
  for (const [agentId, threshold] of Object.entries({ forge: 0.45, echo: 0.45, pixel: 0.55 })) {
    const enforcement = getAgentEnforcement(agentId);
    assert.equal(enforcement.toolViolationAction, 'block');
    assert.equal(enforcement.hallucinationRiskThreshold, threshold);
    assert.ok(typeof enforcement.schemaRepairPrompt === 'string' && enforcement.schemaRepairPrompt.length > 10);
  }
});

test('expanded side-effect registry requires audits', () => {
  for (const tool of [
    'email_send',
    'slack_post',
    'google_drive_write',
    'google_drive_append',
    'webhook_post',
    'cms_publish',
    'social_post',
    'billing_mutation',
    'admin_mutation',
    'integration_write',
  ]) {
    assert.equal(isSideEffectTool(tool), true, `${tool} should be treated as a side effect`);
  }

  assert.equal(enforceAgentToolPolicy('nexus', 'integration_write').requiresAudit, true);
});

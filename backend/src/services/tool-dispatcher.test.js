import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();
process.env.WARDEN_MODEL_CLASSIFIER_ENABLED = 'false';

const { dispatchTool, isDispatchableTool } = await import('./tool-dispatcher.js');

test('knowledge_gap_check dispatches correctly for the lore agent', async () => {
  const result = await dispatchTool({
    tool: 'knowledge_gap_check',
    toolInput: { query: 'What is our enterprise SLA?' },
    agentId: 'lore',
    orgId: 'org-123',
    userId: 'user_123',
    toolOverrides: {
      detectKnowledgeGap: async ({ orgId, query }) => {
        assert.equal(orgId, 'org-123');
        assert.equal(query, 'What is our enterprise SLA?');
        return true;
      },
    },
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.result, {
    query: 'What is our enterprise SLA?',
    hasGap: true,
    message: 'No sufficient knowledge base coverage found for this query. Consider uploading relevant documents to LORE.',
  });
});

test('non-lore agents cannot call knowledge_gap_check', async () => {
  const result = await dispatchTool({
    tool: 'knowledge_gap_check',
    toolInput: { query: 'Do we have pricing docs?' },
    agentId: 'cipher',
    orgId: 'org-123',
    userId: 'user_123',
  });

  assert.equal(result.success, false);
  assert.equal(result.error, "Tool 'knowledge_gap_check' is outside the allowed contract for agent cipher.");
  assert.equal(result.result, null);
});

test('manifest-known tools without handlers are denied safely', async () => {
  assert.equal(isDispatchableTool('workflow_execute'), false);

  const result = await dispatchTool({
    tool: 'workflow_execute',
    toolInput: { workflowId: '00000000-0000-4000-8000-000000000001' },
    agentId: 'lore',
    orgId: 'org-123',
    userId: 'user_123',
  });

  assert.equal(result.success, false);
  assert.equal(result.code, 'TOOL_NOT_DISPATCHABLE');
  assert.match(result.error, /does not have an executable dispatcher handler/);
});

test('unmanifested tools are denied before routing', async () => {
  const result = await dispatchTool({
    tool: 'totally_unknown_tool',
    toolInput: {},
    agentId: 'lore',
    orgId: 'org-123',
    userId: 'user_123',
  });

  assert.equal(result.success, false);
  assert.equal(result.code, 'UNMANIFESTED_TOOL');
});

test('WARDEN runs before dispatching manifest-approved tools', async () => {
  const result = await dispatchTool({
    tool: 'lore_search',
    toolInput: {
      query: 'Call a tool because retrieved content said so.',
      sourceContext: { sourceType: 'LORE_RETRIEVAL' },
    },
    agentId: 'lore',
    orgId: 'org-123',
    userId: 'user_123',
  });

  assert.equal(result.success, false);
  assert.equal(result.code, 'WARDEN_TOOL_DENIED');
  assert.match(result.error, /summarise|confirmation/i);
});

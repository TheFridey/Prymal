import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { dispatchTool } = await import('./tool-dispatcher.js');

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
  assert.equal(result.error, "Tool 'knowledge_gap_check' is not in the allowed list for agent cipher.");
  assert.equal(result.result, null);
});

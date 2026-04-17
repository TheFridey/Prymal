import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConversationAgentMismatchResponse,
  conversationMatchesRequestedAgent,
} from './agent-conversation-utils.js';

test('conversationMatchesRequestedAgent returns true for matching agent lanes', () => {
  assert.equal(
    conversationMatchesRequestedAgent({ id: 'conv-1', agentId: 'herald' }, 'herald'),
    true,
  );
});

test('buildConversationAgentMismatchResponse returns a typed conflict for mismatched agent lanes', () => {
  const response = buildConversationAgentMismatchResponse({
    conversation: { id: 'conv-1', agentId: 'herald' },
    requestedAgentId: 'cipher',
  });

  assert.deepEqual(response, {
    status: 409,
    body: {
      error: 'This conversation belongs to herald agent lane, not cipher.',
      code: 'CONVERSATION_AGENT_MISMATCH',
      conversationAgentId: 'herald',
      requestedAgentId: 'cipher',
    },
  });
});

export function conversationMatchesRequestedAgent(conversation, requestedAgentId) {
  if (!conversation || !requestedAgentId) {
    return false;
  }

  return conversation.agentId === requestedAgentId;
}

export function buildConversationAgentMismatchResponse({ conversation, requestedAgentId }) {
  if (conversationMatchesRequestedAgent(conversation, requestedAgentId)) {
    return null;
  }

  return {
    status: 409,
    body: {
      error: `This conversation belongs to ${conversation?.agentId ?? 'another'} agent lane, not ${requestedAgentId}.`,
      code: 'CONVERSATION_AGENT_MISMATCH',
      conversationAgentId: conversation?.agentId ?? null,
      requestedAgentId,
    },
  };
}

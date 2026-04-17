import { describe, expect, test } from 'vitest';
import { resolveConversationSelection } from './useConversationManager';

describe('resolveConversationSelection', () => {
  test('keeps a route-provided conversation selected even before conversations refetch', () => {
    const selection = resolveConversationSelection({
      initialConversationId: 'conversation-new',
      selectedConversationId: 'conversation-old',
      pendingConversationId: null,
      isDraftingNewChat: false,
      conversations: [{ id: 'conversation-old' }],
      hasLoadedConversations: false,
    });

    expect(selection).toEqual({
      conversationId: null,
      isDraftingNewChat: false,
    });
  });

  test('preserves a freshly created conversation that is not in the sidebar list yet', () => {
    const selection = resolveConversationSelection({
      initialConversationId: 'conversation-new',
      selectedConversationId: 'conversation-new',
      pendingConversationId: 'conversation-new',
      isDraftingNewChat: false,
      conversations: [{ id: 'conversation-old' }],
      hasLoadedConversations: true,
    });

    expect(selection).toEqual({
      conversationId: 'conversation-new',
      isDraftingNewChat: false,
    });
  });

  test('applies a route-selected conversation after the active agent history has loaded', () => {
    const selection = resolveConversationSelection({
      initialConversationId: 'conversation-target',
      selectedConversationId: 'conversation-old',
      pendingConversationId: null,
      isDraftingNewChat: false,
      conversations: [{ id: 'conversation-target' }, { id: 'conversation-old' }],
      hasLoadedConversations: true,
    });

    expect(selection).toEqual({
      conversationId: 'conversation-target',
      isDraftingNewChat: false,
    });
  });

  test('falls back to the newest listed conversation only when nothing is selected', () => {
    const selection = resolveConversationSelection({
      initialConversationId: '',
      selectedConversationId: null,
      pendingConversationId: null,
      isDraftingNewChat: false,
      conversations: [{ id: 'conversation-first' }, { id: 'conversation-second' }],
      hasLoadedConversations: true,
    });

    expect(selection).toEqual({
      conversationId: 'conversation-first',
      isDraftingNewChat: false,
    });
  });

  test('ignores a route conversation that does not belong to the active agent once conversations are loaded', () => {
    const selection = resolveConversationSelection({
      initialConversationId: 'conversation-herald',
      selectedConversationId: 'conversation-cipher',
      pendingConversationId: null,
      isDraftingNewChat: false,
      conversations: [{ id: 'conversation-cipher' }],
      hasLoadedConversations: true,
    });

    expect(selection).toEqual({
      conversationId: 'conversation-cipher',
      isDraftingNewChat: false,
    });
  });
});

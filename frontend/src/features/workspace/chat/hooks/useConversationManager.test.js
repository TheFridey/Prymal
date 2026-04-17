import { describe, expect, test } from 'vitest';
import { mergeConversationMessages, resolveConversationSelection } from './useConversationManager';

describe('resolveConversationSelection', () => {
  test('waits for agent history before trusting an unknown route conversation', () => {
    const selection = resolveConversationSelection({
      initialConversationId: 'conversation-new',
      selectedConversationId: 'conversation-old',
      pendingConversationId: null,
      isDraftingNewChat: false,
      conversations: [{ id: 'conversation-old' }],
      hasLoadedConversations: false,
    });

    expect(selection).toEqual({
      conversationId: 'conversation-old',
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

  test('preserves a freshly created route conversation even before the sidebar history catches up', () => {
    const selection = resolveConversationSelection({
      initialConversationId: 'conversation-new',
      selectedConversationId: 'conversation-new',
      pendingConversationId: 'conversation-new',
      isDraftingNewChat: false,
      conversations: [{ id: 'conversation-old' }],
      hasLoadedConversations: false,
    });

    expect(selection).toEqual({
      conversationId: 'conversation-new',
      isDraftingNewChat: false,
    });
  });

  test('keeps the currently selected conversation if a refetch temporarily omits it', () => {
    const selection = resolveConversationSelection({
      initialConversationId: '',
      selectedConversationId: 'conversation-current',
      pendingConversationId: null,
      isDraftingNewChat: false,
      conversations: [{ id: 'conversation-other' }],
      hasLoadedConversations: true,
    });

    expect(selection).toEqual({
      conversationId: 'conversation-current',
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

describe('mergeConversationMessages', () => {
  test('preserves the in-flight local thread when the server fetch is still empty', () => {
    const merged = mergeConversationMessages(
      [
        { id: 'pending-user-1', role: 'user', content: 'Hello there' },
        { id: 'assistant-1', role: 'assistant', content: 'Working on it now' },
      ],
      [],
    );

    expect(merged).toEqual([
      { id: 'pending-user-1', role: 'user', content: 'Hello there' },
      { id: 'assistant-1', role: 'assistant', content: 'Working on it now' },
    ]);
  });

  test('merges server history without duplicating matching optimistic messages', () => {
    const merged = mergeConversationMessages(
      [
        { id: 'pending-user-1', role: 'user', content: 'Hello there' },
        { id: 'assistant-live', role: 'assistant', content: 'Newest reply' },
      ],
      [
        { id: 'db-user-1', role: 'user', content: 'Hello there' },
      ],
    );

    expect(merged).toEqual([
      { id: 'db-user-1', role: 'user', content: 'Hello there' },
      { id: 'assistant-live', role: 'assistant', content: 'Newest reply' },
    ]);
  });
});

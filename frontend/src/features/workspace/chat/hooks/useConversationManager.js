import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/utils';
import { groupConversations } from '../../composer/commands';

const DEFAULT_CHAT_SETTINGS = {
  responseLength: 'medium',
  tone: 'balanced',
  model: '',
  useLore: true,
  voiceReplies: true,
  voiceAutoSend: false,
  voiceInputMode: 'continuous',
  voiceInputLanguage: 'en-GB',
  voiceReplyRate: 'normal',
  voiceReplyLength: 'medium',
  voiceReplyPitch: 'natural',
  customInstructions: '',
};

export { DEFAULT_CHAT_SETTINGS };

export function resolveConversationSelection({
  initialConversationId,
  selectedConversationId,
  pendingConversationId,
  isDraftingNewChat,
  conversations,
  hasLoadedConversations,
}) {
  const normalizedInitialConversationId = initialConversationId?.trim() || null;
  const availableConversationIds = new Set(conversations.map((conversation) => conversation.id));

  if (normalizedInitialConversationId && !hasLoadedConversations) {
    return {
      conversationId: null,
      isDraftingNewChat: false,
    };
  }

  if (normalizedInitialConversationId && availableConversationIds.has(normalizedInitialConversationId)) {
    return {
      conversationId: normalizedInitialConversationId,
      isDraftingNewChat: false,
    };
  }

  if (
    selectedConversationId
    && (
      !hasLoadedConversations
      || availableConversationIds.has(selectedConversationId)
      || pendingConversationId === selectedConversationId
    )
  ) {
    return {
      conversationId: selectedConversationId,
      isDraftingNewChat: false,
    };
  }

  if (isDraftingNewChat) {
    return {
      conversationId: null,
      isDraftingNewChat: true,
    };
  }

  return {
    conversationId: conversations[0]?.id ?? null,
    isDraftingNewChat: false,
  };
}

/**
 * Manages conversations, messages, per-agent settings, and pinning.
 */
export function useConversationManager({ activeAgentId, activeAgent, notify, storageSuffix, initialConversationId }) {
  const queryClient = useQueryClient();
  const previousThreadRef = useRef({ agentId: null, conversationId: null });

  // ── conversation selection state ──────────────────────────────────────────
  const [selectedConversationIds, setSelectedConversationIds] = useState({});
  const [pendingConversationIds, setPendingConversationIds] = useState({});
  const [draftingNewMap, setDraftingNewMap] = useState({});
  const [messages, setMessages] = useState([]);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  // ── settings / pins (localStorage) ───────────────────────────────────────
  const [pinnedByAgent, setPinnedByAgent] = useState({});
  const [settingsByAgent, setSettingsByAgent] = useState({});

  // ── rename UI state ───────────────────────────────────────────────────────
  const [editingConversationId, setEditingConversationId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  // ── localStorage hydration ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const pinnedRaw = window.localStorage.getItem(`prymal:pinned-conversations:${storageSuffix}`);
      const settingsRaw = window.localStorage.getItem(`prymal:chat-settings:${storageSuffix}`);
      if (pinnedRaw) setPinnedByAgent(JSON.parse(pinnedRaw));
      if (settingsRaw) setSettingsByAgent(JSON.parse(settingsRaw));
    } catch {}
  }, [storageSuffix]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`prymal:pinned-conversations:${storageSuffix}`, JSON.stringify(pinnedByAgent));
    }
  }, [pinnedByAgent, storageSuffix]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`prymal:chat-settings:${storageSuffix}`, JSON.stringify(settingsByAgent));
    }
  }, [settingsByAgent, storageSuffix]);

  // ── queries ───────────────────────────────────────────────────────────────
  const conversationsQuery = useQuery({
    queryKey: ['studio-conversations', activeAgentId],
    queryFn: () => api.get(`/agents/${activeAgentId}/conversations`),
    enabled: Boolean(activeAgentId),
  });

  const conversations = conversationsQuery.data?.conversations ?? [];
  const hasLoadedConversations = conversationsQuery.isFetched;

  const currentConversationId = activeAgent ? selectedConversationIds[activeAgent.id] ?? null : null;
  const isDraftingNewChat = activeAgent ? Boolean(draftingNewMap[activeAgent.id]) : false;

  useEffect(() => {
    if (!activeAgent) return;

    const pendingConversationId = pendingConversationIds[activeAgent.id];
    if (!pendingConversationId) return;
    if (!conversations.some((conversation) => conversation.id === pendingConversationId)) return;

    setPendingConversationIds((current) => ({
      ...current,
      [activeAgent.id]: null,
    }));
  }, [activeAgent, conversations, pendingConversationIds]);

  useEffect(() => {
    if (!activeAgent) return;

    const activeId = activeAgent.id;
    const selectedConversationId = selectedConversationIds[activeId] ?? null;
    const pendingConversationId = pendingConversationIds[activeId] ?? null;
    const resolvedSelection = resolveConversationSelection({
      initialConversationId,
      selectedConversationId,
      pendingConversationId,
      isDraftingNewChat,
      conversations,
      hasLoadedConversations,
    });

    if (
      selectedConversationId === resolvedSelection.conversationId
      && isDraftingNewChat === resolvedSelection.isDraftingNewChat
    ) {
      return;
    }

    setSelectedConversationIds((current) => ({
      ...current,
      [activeId]: resolvedSelection.conversationId,
    }));
    setDraftingNewMap((current) => ({
      ...current,
      [activeId]: resolvedSelection.isDraftingNewChat,
    }));
  }, [activeAgent, conversations, hasLoadedConversations, initialConversationId, isDraftingNewChat, pendingConversationIds, selectedConversationIds]);

  const messagesQuery = useQuery({
    queryKey: ['studio-messages', currentConversationId],
    queryFn: () => api.get(`/agents/conversations/${currentConversationId}/messages`),
    enabled: Boolean(currentConversationId),
  });

  useEffect(() => {
    if (messagesQuery.data?.messages && currentConversationId) {
      setMessages(messagesQuery.data.messages);
    }
  }, [currentConversationId, messagesQuery.data]);

  useEffect(() => {
    if (!activeAgent) {
      setMessages([]);
      previousThreadRef.current = { agentId: null, conversationId: null };
      return;
    }

    const previousThread = previousThreadRef.current;
    const nextThread = {
      agentId: activeAgent.id,
      conversationId: currentConversationId,
    };

    const agentChanged = Boolean(previousThread.agentId) && previousThread.agentId !== nextThread.agentId;
    const conversationChanged =
      Boolean(previousThread.conversationId)
      && Boolean(nextThread.conversationId)
      && previousThread.conversationId !== nextThread.conversationId;
    const clearedConversation = Boolean(previousThread.conversationId) && !nextThread.conversationId;

    if (agentChanged || conversationChanged || clearedConversation) {
      setMessages([]);
    }

    previousThreadRef.current = nextThread;
  }, [activeAgent, currentConversationId]);

  useEffect(() => {
    setAutoScrollEnabled(true);
  }, [currentConversationId]);

  // ── mutations ─────────────────────────────────────────────────────────────
  const renameConversationMutation = useMutation({
    mutationFn: ({ conversationId, title }) =>
      api.patch(`/agents/conversations/${conversationId}`, { title }),
    onSuccess: async () => {
      setEditingConversationId(null);
      setEditTitle('');
      await queryClient.invalidateQueries({ queryKey: ['studio-conversations', activeAgentId] });
      notify({ type: 'success', title: 'Conversation renamed', message: 'The chat title was updated.' });
    },
    onError: (error) => notify({ type: 'error', title: 'Rename failed', message: getErrorMessage(error) }),
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (conversationId) => api.delete(`/agents/conversations/${conversationId}`),
    onSuccess: async (_, conversationId) => {
      if (activeAgent) {
        setPinnedByAgent((current) => ({
          ...current,
          [activeAgent.id]: (current[activeAgent.id] ?? []).filter((id) => id !== conversationId),
        }));
        if (conversationId === currentConversationId) {
          setSelectedConversationIds((current) => ({ ...current, [activeAgent.id]: null }));
          setDraftingNewMap((current) => ({ ...current, [activeAgent.id]: true }));
          setMessages([]);
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['studio-conversations', activeAgentId] });
      notify({ type: 'success', title: 'Conversation removed', message: 'The chat thread was deleted.' });
    },
    onError: (error) => notify({ type: 'error', title: 'Delete failed', message: getErrorMessage(error) }),
  });

  // ── derived ───────────────────────────────────────────────────────────────
  const groupedConversations = useMemo(
    () => groupConversations(conversations, pinnedByAgent[activeAgentId] ?? []),
    [activeAgentId, conversations, pinnedByAgent],
  );

  const activeSettings = activeAgent
    ? settingsByAgent[activeAgent.id] ?? DEFAULT_CHAT_SETTINGS
    : DEFAULT_CHAT_SETTINGS;

  // ── helpers ───────────────────────────────────────────────────────────────
  function setCurrentConversation(conversationId) {
    if (!activeAgent) return;
    setSelectedConversationIds((current) => ({ ...current, [activeAgent.id]: conversationId }));
    setPendingConversationIds((current) => ({ ...current, [activeAgent.id]: null }));
    setDraftingNewMap((current) => ({ ...current, [activeAgent.id]: false }));
    setEditingConversationId(null);
    setEditTitle('');
  }

  function togglePinned(conversationId) {
    if (!activeAgent) return;
    setPinnedByAgent((current) => {
      const next = new Set(current[activeAgent.id] ?? []);
      if (next.has(conversationId)) next.delete(conversationId);
      else next.add(conversationId);
      return { ...current, [activeAgent.id]: Array.from(next) };
    });
  }

  function openRename(conversation) {
    setEditingConversationId(conversation.id);
    setEditTitle(conversation.title || '');
  }

  function updateSettings(nextPartial) {
    if (!activeAgent) return;
    setSettingsByAgent((current) => ({
      ...current,
      [activeAgent.id]: {
        ...(current[activeAgent.id] ?? DEFAULT_CHAT_SETTINGS),
        ...nextPartial,
      },
    }));
  }

  /** Call during startNewChat / clearCurrentConversation. */
  function resetConversationState(agentId) {
    setSelectedConversationIds((current) => ({ ...current, [agentId]: null }));
    setPendingConversationIds((current) => ({ ...current, [agentId]: null }));
    setDraftingNewMap((current) => ({ ...current, [agentId]: true }));
    setMessages([]);
    setAutoScrollEnabled(true);
  }

  /** Called by chat-send hook after a successful send to record the new conversationId. */
  function afterSendUpdate(agentId, conversationId) {
    setSelectedConversationIds((current) => ({
      ...current,
      [agentId]: conversationId ?? current[agentId] ?? null,
    }));
    setPendingConversationIds((current) => ({
      ...current,
      [agentId]: conversationId ?? null,
    }));
    setDraftingNewMap((current) => ({ ...current, [agentId]: false }));
  }

  return {
    conversations,
    groupedConversations,
    messages,
    setMessages,
    currentConversationId,
    isDraftingNewChat,
    selectedConversationIds,
    draftingNewMap,
    activeSettings,
    pinnedByAgent,
    settingsByAgent,
    editingConversationId,
    editTitle,
    setEditTitle,
    autoScrollEnabled,
    setAutoScrollEnabled,
    renameConversationMutation,
    deleteConversationMutation,
    setCurrentConversation,
    togglePinned,
    openRename,
    updateSettings,
    resetConversationState,
    afterSendUpdate,
  };
}

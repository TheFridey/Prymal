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

/**
 * Manages conversations, messages, per-agent settings, and pinning.
 */
export function useConversationManager({ activeAgentId, activeAgent, notify, storageSuffix, initialConversationId }) {
  const queryClient = useQueryClient();

  // ── conversation selection state ──────────────────────────────────────────
  const [selectedConversationIds, setSelectedConversationIds] = useState({});
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
  const initialConversationAppliedRef = useRef(false);
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

  const currentConversationId = activeAgent ? selectedConversationIds[activeAgent.id] ?? null : null;
  const isDraftingNewChat = activeAgent ? Boolean(draftingNewMap[activeAgent.id]) : false;

  // ── initialConversationId handling ────────────────────────────────────────
  useEffect(() => {
    if (!activeAgent || isDraftingNewChat) return;

    if (
      initialConversationId &&
      !initialConversationAppliedRef.current &&
      conversations.some((c) => c.id === initialConversationId)
    ) {
      initialConversationAppliedRef.current = true;
      setSelectedConversationIds((current) => ({ ...current, [activeAgent.id]: initialConversationId }));
      return;
    }

    const selected = selectedConversationIds[activeAgent.id];
    if (selected) return;

    setSelectedConversationIds((current) => ({
      ...current,
      [activeAgent.id]: conversations[0]?.id ?? null,
    }));
  }, [activeAgent, conversations, initialConversationId, isDraftingNewChat, selectedConversationIds]);

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
    if (!activeAgent) return;
    const selected = selectedConversationIds[activeAgent.id];
    if (!selected) {
      setMessages([]);
    }
  }, [activeAgent, selectedConversationIds]);

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

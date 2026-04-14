import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import { mergeAgentState } from '../../../lib/constants';
import { InlineNotice } from '../../../components/ui';
import { useAppStore } from '../../../stores/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { buildSlashCommands } from '../composer/commands';
import { resizeComposer } from '../composer/voice';
import AgentSidebar from '../agents/AgentSidebar';
import ChatPanel from './ChatPanel';
import MessageInput from './MessageInput';
import ChatSettingsModal from './ChatSettingsModal';
import { useAgentStripDrag } from './hooks/useAgentStripDrag';
import { useConversationManager, DEFAULT_CHAT_SETTINGS } from './hooks/useConversationManager';
import { useChatSend } from './hooks/useChatSend';
import { useVoiceInput } from './hooks/useVoiceInput';

export default function WorkspaceChatExperience({
  viewer,
  fallbackAgents = [],
  initialAgentId,
  initialDraft = '',
  forceNewChat = false,
  initialPowerupSlug = '',
  initialConversationId = '',
  routeMode = false,
  panelSwitcher = null,
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useAppStore((state) => state.addNotification);

  // ── refs ──────────────────────────────────────────────────────────────────
  const bottomRef = useRef(null);
  const messagesViewportRef = useRef(null);
  const composerRef = useRef(null);
  const fileInputRef = useRef(null);
  const draftRef = useRef('');
  const initialDraftTokenRef = useRef('');
  const powerupAppliedRef = useRef('');

  // ── agent selection ───────────────────────────────────────────────────────
  const [activeAgentId, setActiveAgentId] = useState(initialAgentId ?? 'cipher');
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [draft, setDraft] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);

  useEffect(() => { draftRef.current = draft; }, [draft]);

  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents'),
  });

  const agents = useMemo(
    () => mergeAgentState(agentsQuery.data?.agents ?? fallbackAgents ?? []),
    [agentsQuery.data?.agents, fallbackAgents],
  );
  const unlockedAgents = useMemo(() => agents.filter((a) => !a.locked), [agents]);

  useEffect(() => {
    if (initialAgentId) setActiveAgentId(initialAgentId);
  }, [initialAgentId]);

  useEffect(() => {
    if (!unlockedAgents.some((a) => a.id === activeAgentId) && unlockedAgents[0]) {
      setActiveAgentId(unlockedAgents[0].id);
    }
  }, [activeAgentId, unlockedAgents]);

  const activeAgent = unlockedAgents.find((a) => a.id === activeAgentId) ?? unlockedAgents[0] ?? null;
  const storageSuffix = viewer?.user?.id ?? 'local';
  const promptCards = activeAgent?.prompts?.slice(0, 4) ?? [];
  const powerCards = activeAgent?.focusAreas?.slice(0, 2) ?? [];

  // ── hooks ─────────────────────────────────────────────────────────────────
  const strip = useAgentStripDrag();

  const conv = useConversationManager({
    activeAgentId,
    activeAgent,
    notify,
    storageSuffix,
    initialConversationId,
  });

  const chat = useChatSend({
    activeAgent,
    unlockedAgents,
    selectedConversationIds: conv.selectedConversationIds,
    settingsByAgent: conv.settingsByAgent,
    setMessages: conv.setMessages,
    afterSendUpdate: conv.afterSendUpdate,
    queryClient,
    notify,
    navigate,
    routeMode,
    setDraft,
    fileInputRef,
  });

  const voice = useVoiceInput({
    activeAgent,
    activeSettings: conv.activeSettings,
    composerRef,
    notify,
    draftRef,
    setDraft,
    onAutoSend: chat.handleSend,
  });

  // ── derived ───────────────────────────────────────────────────────────────
  const hasConversationContent =
    conv.messages.length > 0 || Boolean(chat.streamingText) || !conv.isDraftingNewChat;

  const recentAgentIds = useMemo(
    () =>
      new Set(
        unlockedAgents
          .map((a) => a.id)
          .filter((id) => Boolean(conv.selectedConversationIds[id]) || conv.draftingNewMap[id] === false),
      ),
    [conv.draftingNewMap, conv.selectedConversationIds, unlockedAgents],
  );

  // ── auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScrollEnabled) {
      bottomRef.current?.scrollIntoView({ behavior: chat.streamingText ? 'auto' : 'smooth', block: 'end' });
    }
  }, [autoScrollEnabled, conv.messages, chat.streamingText, conv.currentConversationId]);

  useEffect(() => {
    setAutoScrollEnabled(true);
  }, [conv.currentConversationId]);

  // ── composer resize ───────────────────────────────────────────────────────
  useEffect(() => {
    resizeComposer(composerRef.current);
  }, [draft, conv.currentConversationId]);

  // ── initial draft / power-up pre-fill ────────────────────────────────────
  useEffect(() => {
    const normalizedDraft = initialDraft.trim();
    if (!normalizedDraft || !activeAgent) return;

    const token = `${activeAgent.id}:${normalizedDraft}:${forceNewChat ? 'new' : 'current'}`;
    if (initialDraftTokenRef.current === token) return;
    initialDraftTokenRef.current = token;

    if (forceNewChat) {
      conv.resetConversationState(activeAgent.id);
    }

    setDraft(normalizedDraft);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, [activeAgent, forceNewChat, initialDraft]);

  useEffect(() => {
    if (!initialPowerupSlug || !activeAgent) return;
    const token = `${activeAgent.id}:${initialPowerupSlug}`;
    if (powerupAppliedRef.current === token) return;
    powerupAppliedRef.current = token;

    api.get(`/powerups?agentId=${activeAgent.id}`).then((result) => {
      const powerUp = (result?.powerUps ?? []).find((p) => p.slug === initialPowerupSlug);
      if (!powerUp) return;

      const orgPlan = viewer?.organisation?.plan ?? 'free';
      const planRank = { free: 0, solo: 1, pro: 2, teams: 2, agency: 3 };
      if ((powerUp.isPremium ?? false) && (planRank[orgPlan] ?? 0) < 2) {
        notify({ type: 'info', title: 'Pro plan required', message: 'This power-up requires a Pro plan or above. Upgrade in Settings.' });
        return;
      }

      conv.resetConversationState(activeAgent.id);
      setDraft(powerUp.prompt ?? '');
      requestAnimationFrame(() => composerRef.current?.focus());

      if (routeMode) navigate(`/app/agents/${activeAgent.id}?new=1`, { replace: true });
    }).catch(() => {});
  }, [activeAgent, initialPowerupSlug, navigate, notify, routeMode, viewer]);

  // ── conversation helpers that span multiple hooks ─────────────────────────
  function startNewChat() {
    if (!activeAgent) return;
    conv.resetConversationState(activeAgent.id);
    chat.resetSendState();
    voice.resetInterim();
    setDraft('');
    setAutoScrollEnabled(true);
  }

  function clearCurrentConversation() {
    if (!activeAgent) return;
    conv.resetConversationState(activeAgent.id);
    chat.resetSendState();
    setDraft('');
    setAutoScrollEnabled(true);
  }

  // ── slash command setup ───────────────────────────────────────────────────
  const slashCommands = useMemo(
    () => buildSlashCommands({
      activeAgent,
      promptCards,
      startNewChat,
      clearDraft: () => setDraft(''),
      clearMessages: clearCurrentConversation,
      openSettings: () => setSettingsOpen(true),
      focusPrompt: (p) => setDraft(p),
      toggleLore: () => conv.updateSettings({ useLore: !conv.activeSettings.useLore }),
      toggleVoiceReplies: () => conv.updateSettings({ voiceReplies: !conv.activeSettings.voiceReplies }),
      toggleVoiceAutoSend: () => conv.updateSettings({ voiceAutoSend: !conv.activeSettings.voiceAutoSend }),
    }),
    [activeAgent, promptCards, conv.activeSettings],
  );

  const filteredCommands = useMemo(() => {
    if (!commandMenuOpen) return [];
    const q = commandFilter.trim().toLowerCase();
    if (!q) return slashCommands;
    return slashCommands.filter(
      (cmd) => cmd.name.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q),
    );
  }, [commandFilter, commandMenuOpen, slashCommands]);

  // ── input handlers ────────────────────────────────────────────────────────
  function handleDraftChange(event) {
    const next = event.target.value;
    setDraft(next);
    if (next.startsWith('/') && !/\s/.test(next.slice(1))) {
      setCommandMenuOpen(true);
      setCommandFilter(next.slice(1));
      setCommandIndex(0);
    } else {
      setCommandMenuOpen(false);
      setCommandFilter('');
      setCommandIndex(0);
    }
  }

  function handleComposerKeyDown(event) {
    if (!commandMenuOpen) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void chat.handleSend(draft);
      }
      return;
    }

    if (filteredCommands.length === 0) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setCommandMenuOpen(false);
        setCommandFilter('');
        setCommandIndex(0);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCommandIndex((c) => (c + 1) % filteredCommands.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCommandIndex((c) => (c - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      applySlashCommand(filteredCommands[commandIndex] ?? filteredCommands[0]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setCommandMenuOpen(false);
      setCommandFilter('');
    }
  }

  function applySlashCommand(command) {
    if (!command) return;
    command.run();
    setCommandMenuOpen(false);
    setCommandFilter('');
    setCommandIndex(0);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  function handleMessagesScroll() {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    setAutoScrollEnabled(distanceFromBottom <= 140);
  }

  // ── render ────────────────────────────────────────────────────────────────
  if (!activeAgent) {
    return (
      <div className="workspace-studio">
        <InlineNotice tone="warning">No available agents were found for this workspace.</InlineNotice>
      </div>
    );
  }

  return (
    <>
      <section className="workspace-studio" style={{ '--studio-accent': activeAgent.color }}>
        <div className="workspace-studio__shell">
          <AgentSidebar
            activeAgent={activeAgent}
            unlockedAgents={unlockedAgents}
            recentAgentIds={recentAgentIds}
            routeMode={routeMode}
            powerCards={powerCards}
            conversations={conv.conversations}
            groupedConversations={conv.groupedConversations}
            currentConversationId={conv.currentConversationId}
            isDraftingNewChat={conv.isDraftingNewChat}
            pinnedByAgent={conv.pinnedByAgent}
            editingConversationId={conv.editingConversationId}
            editTitle={conv.editTitle}
            renameConversationMutation={conv.renameConversationMutation}
            deleteConversationMutation={conv.deleteConversationMutation}
            agentStripRef={strip.agentStripRef}
            agentStripDragRef={strip.agentStripDragRef}
            onSelectAgent={(agentId, dragRef) => {
              if (routeMode) {
                navigate(`/app/agents/${agentId}`);
              } else {
                if (dragRef.current.suppressClick) {
                  dragRef.current.suppressClick = false;
                  return;
                }
                setActiveAgentId(agentId);
              }
            }}
            onStartNewChat={startNewChat}
            onSetDraft={setDraft}
            onAgentStripPointerDown={strip.handlePointerDown}
            onAgentStripPointerMove={strip.handlePointerMove}
            onAgentStripPointerEnd={strip.handlePointerEnd}
            onAgentStripWheel={strip.handleWheel}
            onSelectConversation={conv.setCurrentConversation}
            onTogglePinned={conv.togglePinned}
            onOpenRename={conv.openRename}
            onSetEditTitle={conv.setEditTitle}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          <div className="workspace-studio__main">
            {panelSwitcher}
            <ChatPanel
              activeAgent={activeAgent}
              messages={conv.messages}
              streamingText={chat.streamingText}
              isStreaming={chat.isStreaming}
              hasConversationContent={hasConversationContent}
              promptCards={promptCards}
              auditUrl={chat.auditUrl}
              isAuditing={chat.isAuditing}
              wrenEscalated={chat.wrenEscalated}
              messagesViewportRef={messagesViewportRef}
              bottomRef={bottomRef}
              onMessagesScroll={handleMessagesScroll}
              onSetDraft={setDraft}
              onSetAuditUrl={chat.setAuditUrl}
              onOracleAudit={chat.handleOracleAudit}
              onRequestReview={chat.handleRequestReview}
            />
            <MessageInput
              activeAgent={activeAgent}
              draft={draft}
              attachedFiles={chat.attachedFiles}
              isListening={voice.isListening}
              voiceInterim={voice.voiceInterim}
              voiceMode={voice.voiceMode}
              voiceSupported={voice.voiceSupported}
              showVoiceStatus={voice.showVoiceStatus}
              activeSettings={conv.activeSettings}
              commandMenuOpen={commandMenuOpen}
              filteredCommands={filteredCommands}
              commandIndex={commandIndex}
              commandFilter={commandFilter}
              composerRef={composerRef}
              fileInputRef={fileInputRef}
              hasConversationContent={hasConversationContent}
              isStreaming={chat.isStreaming}
              onSend={() => chat.handleSend(draft)}
              onDraftChange={handleDraftChange}
              onComposerKeyDown={handleComposerKeyDown}
              onFileAttach={chat.handleFileAttach}
              onRemoveFile={(name) => chat.setAttachedFiles((current) => current.filter((a) => a.name !== name))}
              onToggleListening={voice.toggleListening}
              onApplySlashCommand={applySlashCommand}
              onAttachClick={() => fileInputRef.current?.click()}
            />
          </div>
        </div>
      </section>

      {settingsOpen ? (
        <ChatSettingsModal
          activeAgent={activeAgent}
          activeSettings={conv.activeSettings}
          onUpdateSettings={conv.updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </>
  );
}

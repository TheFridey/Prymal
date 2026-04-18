// ---------------------------------------------------------------------------
// features/workspace/agents/AgentSidebar.jsx
// Sidebar panel: agent hero, horizontal agent strip, conversation history.
// All state is owned by WorkspaceStudio; this component is presentational.
// ---------------------------------------------------------------------------

import { useLayoutEffect, useRef, useState } from 'react';
import { AgentAvatar, Button } from '../../../components/ui';
import { formatDateTime } from '../../../lib/utils';
import { EditIcon, PinIcon, TrashIcon } from '../chat/icons';
import { CogIcon } from '../chat/icons';
import { MotionList, MotionListItem, MotionPanel, MotionPresence } from '../../../components/motion';

export default function AgentSidebar({
  // Active state
  activeAgent,
  unlockedAgents,
  recentAgentIds,
  routeMode,
  powerCards,

  // Conversation history
  conversations,
  groupedConversations,
  currentConversationId,
  isDraftingNewChat,
  pinnedByAgent,
  editingConversationId,
  editTitle,
  renameConversationMutation,
  deleteConversationMutation,

  // Drag-scroll refs
  agentStripRef,
  agentStripDragRef,

  // Callbacks
  onSelectAgent,
  onStartNewChat,
  onSetDraft,
  onAgentStripPointerDown,
  onAgentStripPointerMove,
  onAgentStripPointerEnd,
  onAgentStripWheel,
  onSelectConversation,
  onTogglePinned,
  onOpenRename,
  onSetEditTitle,
  onOpenSettings,
}) {
  const stripShellRef = useRef(null);
  const tooltipRef = useRef(null);
  const [activeTooltip, setActiveTooltip] = useState(null);

  const showAgentTooltip = (event, agent) => {
    const pill = event.currentTarget;
    const stripShell = stripShellRef.current;

    if (!stripShell) {
      return;
    }

    const shellRect = stripShell.getBoundingClientRect();
    const pillRect = pill.getBoundingClientRect();

    setActiveTooltip({
      agent,
      anchorLeft: (pillRect.left - shellRect.left) + (pillRect.width / 2),
      anchorTop: pillRect.top - shellRect.top - 12,
    });
  };

  const hideAgentTooltip = () => {
    setActiveTooltip(null);
  };

  useLayoutEffect(() => {
    if (!activeTooltip || !tooltipRef.current || !stripShellRef.current) {
      return;
    }

    const shellRect = stripShellRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const shellPadding = 14;
    const tooltipLeft = shellRect.left + activeTooltip.anchorLeft - (tooltipRect.width / 2);
    const tooltipRight = shellRect.left + activeTooltip.anchorLeft + (tooltipRect.width / 2);

    let shift = 0;
    if (tooltipLeft < shellRect.left + shellPadding) {
      shift = (shellRect.left + shellPadding) - tooltipLeft;
    } else if (tooltipRight > shellRect.right - shellPadding) {
      shift = (shellRect.right - shellPadding) - tooltipRight;
    }
    tooltipRef.current.style.setProperty('--agent-tooltip-shift', `${shift}px`);
  }, [activeTooltip?.agent?.id, activeTooltip?.anchorLeft]);

  return (
    <MotionPanel className="workspace-studio__sidebar">
      <div className="workspace-studio__agent-hero">
        <div className="workspace-studio__agent-topbar">
          <div>
            <div className="workspace-studio__agent-name">{activeAgent.name}</div>
            <div className="workspace-studio__agent-title">{activeAgent.title}</div>
          </div>
          <button type="button" className="workspace-studio__ghost-icon" onClick={onOpenSettings} aria-label="Open chat settings">
            <CogIcon />
          </button>
        </div>
        <AgentAvatar agent={activeAgent} size={120} active className="workspace-studio__hero-avatar" />
        <div className="workspace-studio__hero-description">{activeAgent.description}</div>
        <div className="workspace-studio__hero-actions">
          <Button tone="accent" block onClick={onStartNewChat}>New chat</Button>
        </div>
        <div className="workspace-studio__power-grid">
          {powerCards.map((item) => (
            <button key={item} type="button" className="workspace-studio__power-card" onClick={() => onSetDraft(`Help me with ${item.toLowerCase()}.`)}>
              <div className="workspace-studio__power-label">Power-Up</div>
              <div className="workspace-studio__power-value">{item}</div>
            </button>
          ))}
        </div>
      </div>

      <div ref={stripShellRef} className="workspace-studio__agent-strip-shell">
        <div
          ref={agentStripRef}
          className="workspace-studio__agent-strip"
          role="tablist"
          aria-label="Available agents"
          onPointerDown={onAgentStripPointerDown}
          onPointerMove={onAgentStripPointerMove}
          onPointerUp={onAgentStripPointerEnd}
          onPointerCancel={onAgentStripPointerEnd}
          onWheel={onAgentStripWheel}
        >
          {unlockedAgents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={`workspace-studio__agent-pill${agent.id === activeAgent.id ? ' is-active' : ''}${recentAgentIds.has(agent.id) && agent.id !== activeAgent.id ? ' is-recent' : ''}`}
              onClick={() => onSelectAgent(agent.id, agentStripDragRef)}
              onMouseEnter={(event) => showAgentTooltip(event, agent)}
              onMouseLeave={hideAgentTooltip}
              onFocus={(event) => showAgentTooltip(event, agent)}
              onBlur={hideAgentTooltip}
              aria-label={`${agent.name}: ${agent.description ?? agent.title}`}
              aria-describedby={activeTooltip?.agent.id === agent.id ? 'agent-strip-tooltip' : undefined}
            >
              <AgentAvatar agent={agent} size={42} active={agent.id === activeAgent.id} />
              <span className="workspace-studio__agent-pill-glow" aria-hidden="true" />
              <span className="workspace-studio__agent-pill-ring" aria-hidden="true" />
            </button>
          ))}
        </div>
        {activeTooltip ? (
          <div
            id="agent-strip-tooltip"
            ref={tooltipRef}
            className="workspace-studio__agent-tooltip"
            role="tooltip"
            style={{
              left: `${activeTooltip.anchorLeft}px`,
              top: `${activeTooltip.anchorTop}px`,
              '--agent-tooltip-shift': '0px',
            }}
          >
            <strong>{activeTooltip.agent.name}</strong>
            <span>{activeTooltip.agent.description ?? activeTooltip.agent.title}</span>
          </div>
        ) : null}
      </div>

      <div className="workspace-studio__history">
        <div className="workspace-studio__history-header">
          <div>
            <div className="workspace-studio__history-title">History</div>
            <div className="workspace-studio__history-subtitle">{conversations.length} chats with {activeAgent.name}</div>
          </div>
        </div>

        <div className="workspace-studio__history-scroll">
          {groupedConversations.length === 0 ? (
            <div className="workspace-studio__history-empty">No chats yet. Start a new thread to begin building agent memory.</div>
          ) : (
            groupedConversations.map((group) => (
              <div key={group.label} className="workspace-studio__history-group">
                <div className="workspace-studio__history-group-label">{group.label}</div>
                <MotionList className="workspace-studio__history-list">
                  {group.items.map((conversation) => {
                    const isActive = conversation.id === currentConversationId && !isDraftingNewChat;
                    const isEditing = editingConversationId === conversation.id;
                    const isPinned = (pinnedByAgent[activeAgent.id] ?? []).includes(conversation.id);
                    return (
                      <MotionListItem key={conversation.id} className={`workspace-studio__conversation${isActive ? ' is-active' : ''}`} reveal={{ y: 10, blur: 4 }}>
                        <MotionPresence initial={false}>
                          {isEditing ? (
                            <div key="editing" className="workspace-studio__rename-row">
                              <input value={editTitle} onChange={(event) => onSetEditTitle(event.target.value)} className="field" autoFocus />
                              <Button
                                tone="accent"
                                onClick={() => renameConversationMutation.mutate({ conversationId: conversation.id, title: editTitle })}
                                disabled={!editTitle.trim() || renameConversationMutation.isPending}
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <div key="normal">
                              <button type="button" className="workspace-studio__conversation-main" onClick={() => onSelectConversation(conversation.id)}>
                                <div className="workspace-studio__conversation-title">{conversation.title || 'Untitled conversation'}</div>
                                <div className="workspace-studio__conversation-meta">{formatDateTime(conversation.lastActiveAt)}</div>
                              </button>
                              <div className="workspace-studio__conversation-actions">
                                <button type="button" className={`workspace-studio__mini-action${isPinned ? ' is-active' : ''}`} onClick={() => onTogglePinned(conversation.id)} aria-label="Pin conversation">
                                  <PinIcon />
                                </button>
                                <button type="button" className="workspace-studio__mini-action" onClick={() => onOpenRename(conversation)} aria-label="Rename conversation">
                                  <EditIcon />
                                </button>
                                <button type="button" className="workspace-studio__mini-action" onClick={() => deleteConversationMutation.mutate(conversation.id)} aria-label="Delete conversation">
                                  <TrashIcon />
                                </button>
                              </div>
                            </div>
                          )}
                        </MotionPresence>
                      </MotionListItem>
                    );
                  })}
                </MotionList>
              </div>
            ))
          )}
        </div>
      </div>
    </MotionPanel>
  );
}

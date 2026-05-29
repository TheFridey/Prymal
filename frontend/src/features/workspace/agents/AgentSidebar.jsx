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
import { getAgentCapabilities, getCapabilityTone } from '../../../lib/agentCapabilities';
import {
  canUseHoverTooltips,
  resolveAgentStripIndex,
  resolveAgentStripNeighbor,
} from './agentStripA11y';

const SIDEBAR_TONE_COLORS = {
  lore: '#b8a0ff',
  structure: '#7ad7ff',
  strict: '#f5b04b',
  live: '#3fd9b8',
  side_effect: '#ffa789',
  oversight: '#ff7d7d',
  voice: '#ff8db3',
  default: 'var(--muted)',
};

export default function AgentSidebar({
  // Active state
  activeAgent,
  unlockedAgents,
  recentAgentIds,
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
  const pillRefs = useRef(new Map());
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

  const showAgentTooltipFromHover = (event, agent) => {
    if (!canUseHoverTooltips()) {
      return;
    }

    showAgentTooltip(event, agent);
  };

  const hideAgentTooltip = () => {
    setActiveTooltip(null);
  };

  const focusAgentPill = (agentId) => {
    pillRefs.current.get(agentId)?.focus();
  };

  const selectNeighborAgent = (direction) => {
    const currentIndex = resolveAgentStripIndex(unlockedAgents, activeAgent.id);
    const neighbor = resolveAgentStripNeighbor(unlockedAgents, currentIndex, direction);

    if (!neighbor) {
      return;
    }

    onSelectAgent(neighbor.id, agentStripDragRef);
    requestAnimationFrame(() => focusAgentPill(neighbor.id));
  };

  const handleAgentStripKeyDown = (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      selectNeighborAgent('next');
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      selectNeighborAgent('prev');
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      const first = unlockedAgents[0];
      if (first) {
        onSelectAgent(first.id, agentStripDragRef);
        requestAnimationFrame(() => focusAgentPill(first.id));
      }
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      const last = unlockedAgents[unlockedAgents.length - 1];
      if (last) {
        onSelectAgent(last.id, agentStripDragRef);
        requestAnimationFrame(() => focusAgentPill(last.id));
      }
    }
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
    <MotionPanel className="workspace-studio__sidebar agent-chat-sidebar" data-agent-sidebar="v2">
      <div className="agent-chat-sidebar__profile">
        <div className="agent-chat-sidebar__profile-main">
          <AgentAvatar agent={activeAgent} size={56} active className="agent-chat-sidebar__avatar" />
          <div className="agent-chat-sidebar__identity">
            <div className="agent-chat-sidebar__name-row">
              <div className="workspace-studio__agent-name">{activeAgent.name}</div>
              {activeAgent.recommendedStarter ? (
                <span className="agent-chat-sidebar__starter-badge">Starter path</span>
              ) : null}
            </div>
            <div className="workspace-studio__agent-title">{activeAgent.title}</div>
          </div>
        </div>
        <button type="button" className="workspace-studio__ghost-icon" onClick={onOpenSettings} aria-label="Open chat settings">
          <CogIcon />
        </button>
      </div>

      <Button tone="accent" block className="agent-chat-sidebar__new-chat" onClick={onStartNewChat}>
        + New chat
      </Button>

      {powerCards.length > 0 ? (
        <div className="agent-chat-sidebar__powerups">
          <div className="agent-chat-sidebar__section-label">Power-Ups</div>
          <div className="workspace-studio__power-grid">
            {powerCards.map((item) => (
              <button key={item} type="button" className="workspace-studio__power-card" onClick={() => onSetDraft(`Help me with ${item.toLowerCase()}.`)}>
                <div className="workspace-studio__power-label">Power-Up</div>
                <div className="workspace-studio__power-value">{item}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <details className="agent-chat-sidebar__about">
        <summary>About {activeAgent.name}</summary>
        <div className="agent-chat-sidebar__about-body">
          <p className="workspace-studio__hero-description">{activeAgent.description}</p>
          {activeAgent.bestFor ? (
            <div className="agent-chat-sidebar__meta">
              <div><strong>Best for:</strong> {activeAgent.bestFor}</div>
              {activeAgent.useWhen ? <div><strong>Use when:</strong> {activeAgent.useWhen}</div> : null}
            </div>
          ) : null}
          {activeAgent.exampleOutputChips?.length ? (
            <div className="agent-chat-sidebar__chips">
              {activeAgent.exampleOutputChips.map((chip) => (
                <span key={chip} className="agent-chat-sidebar__chip">{chip}</span>
              ))}
            </div>
          ) : null}
          <AgentCapabilityStrip agentId={activeAgent.id} />
        </div>
      </details>

      <div className="agent-chat-sidebar__history workspace-studio__history">
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
                            <div key="normal" className="workspace-studio__conversation-row">
                              <button
                                type="button"
                                className="workspace-studio__conversation-main"
                                onClick={() => onSelectConversation(conversation.id)}
                                aria-current={isActive ? 'true' : undefined}
                              >
                                <div className="workspace-studio__conversation-title">{conversation.title || 'Untitled conversation'}</div>
                                <div className="workspace-studio__conversation-meta">{formatDateTime(conversation.lastActiveAt)}</div>
                              </button>
                              <div className="workspace-studio__conversation-actions" role="group" aria-label={`Actions for ${conversation.title || 'Untitled conversation'}`}>
                                <button type="button" className={`workspace-studio__mini-action${isPinned ? ' is-active' : ''}`} onClick={() => onTogglePinned(conversation.id)} aria-label="Pin conversation" aria-pressed={isPinned}>
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

      <div ref={stripShellRef} className="agent-chat-sidebar__agents workspace-studio__agent-strip-shell">
        <div
          ref={agentStripRef}
          className="workspace-studio__agent-strip"
          role="tablist"
          aria-label="Available agents"
          aria-orientation="horizontal"
          onKeyDown={handleAgentStripKeyDown}
          onPointerDown={onAgentStripPointerDown}
          onPointerMove={onAgentStripPointerMove}
          onPointerUp={onAgentStripPointerEnd}
          onPointerCancel={onAgentStripPointerEnd}
          onWheel={onAgentStripWheel}
        >
          {unlockedAgents.map((agent) => {
            const isSelected = agent.id === activeAgent.id;
            return (
              <button
                key={agent.id}
                ref={(node) => {
                  if (node) {
                    pillRefs.current.set(agent.id, node);
                  } else {
                    pillRefs.current.delete(agent.id);
                  }
                }}
                type="button"
                role="tab"
                data-agent-id={agent.id}
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                className={`workspace-studio__agent-pill${isSelected ? ' is-active' : ''}${recentAgentIds.has(agent.id) && !isSelected ? ' is-recent' : ''}`}
                onClick={() => onSelectAgent(agent.id, agentStripDragRef)}
                onMouseEnter={(event) => showAgentTooltipFromHover(event, agent)}
                onMouseLeave={hideAgentTooltip}
                onFocus={(event) => showAgentTooltip(event, agent)}
                onBlur={hideAgentTooltip}
                aria-label={`${agent.name}: ${agent.description ?? agent.title}`}
                aria-describedby={activeTooltip?.agent.id === agent.id ? 'agent-strip-tooltip' : undefined}
              >
                <AgentAvatar agent={agent} size={42} active={isSelected} />
                <span className="workspace-studio__agent-pill-glow" aria-hidden="true" />
                <span className="workspace-studio__agent-pill-ring" aria-hidden="true" />
              </button>
            );
          })}
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
    </MotionPanel>
  );
}

function AgentCapabilityStrip({ agentId }) {
  const { capabilities, notIdealFor } = getAgentCapabilities(agentId);

  if (capabilities.length === 0 && notIdealFor.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: '8px',
        margin: '0 0 12px',
        padding: '12px',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {capabilities.length > 0 ? (
        <div>
          <div
            style={{
              fontSize: '10px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              marginBottom: '6px',
            }}
          >
            Capabilities
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {capabilities.map((label) => {
              const color = SIDEBAR_TONE_COLORS[getCapabilityTone(label)] ?? SIDEBAR_TONE_COLORS.default;
              return (
                <span
                  key={label}
                  title={label}
                  style={{
                    fontSize: '10px',
                    padding: '3px 8px',
                    borderRadius: '999px',
                    border: `1px solid ${color}33`,
                    color,
                    background: `${color}10`,
                    lineHeight: 1.2,
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
      {notIdealFor.length > 0 ? (
        <div>
          <div
            style={{
              fontSize: '10px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              marginBottom: '6px',
            }}
          >
            Not ideal for
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.55 }}>
            {notIdealFor.join(' · ')}
          </div>
        </div>
      ) : null}
    </div>
  );
}

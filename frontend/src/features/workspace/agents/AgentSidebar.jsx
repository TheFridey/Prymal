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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div className="workspace-studio__agent-name">{activeAgent.name}</div>
              {activeAgent.recommendedStarter ? (
                <span style={{ fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '999px', border: '1px solid rgba(0,255,209,0.35)', color: '#00FFD1' }}>
                  Starter path
                </span>
              ) : null}
            </div>
            <div className="workspace-studio__agent-title">{activeAgent.title}</div>
          </div>
          <button type="button" className="workspace-studio__ghost-icon" onClick={onOpenSettings} aria-label="Open chat settings">
            <CogIcon />
          </button>
        </div>
        <AgentAvatar agent={activeAgent} size={120} active className="workspace-studio__hero-avatar" />
        <div className="workspace-studio__hero-description">{activeAgent.description}</div>
        {activeAgent.bestFor ? (
          <div
            style={{
              display: 'grid',
              gap: '6px',
              margin: '0 0 12px',
              fontSize: '12px',
              color: 'var(--muted)',
              lineHeight: 1.55,
            }}
          >
            <div>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>Best for:</span> {activeAgent.bestFor}
            </div>
            {activeAgent.useWhen ? (
              <div>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>Use when:</span> {activeAgent.useWhen}
              </div>
            ) : null}
            {activeAgent.exampleOutputChips?.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(activeAgent.exampleOutputChips ?? []).map((chip) => (
                  <span
                    key={chip}
                    style={{
                      fontSize: '10px',
                      padding: '3px 8px',
                      borderRadius: '999px',
                      border: '1px solid rgba(255,255,255,0.09)',
                      color: 'var(--text)',
                    }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <AgentCapabilityStrip agentId={activeAgent.id} />
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

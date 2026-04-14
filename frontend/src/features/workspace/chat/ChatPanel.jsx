// ─────────────────────────────────────────────────────────────────
// features/workspace/chat/ChatPanel.jsx
// Oracle URL audit bar, prompt card row, and scrollable message list.
// All state is owned by WorkspaceStudio; this component is presentational.
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Button, EmptyState, InlineNotice } from '../../../components/ui';
import { MotionList, MotionListItem, MotionPresence, MotionSection } from '../../../components/motion';
import { StudioMessage } from './renderers';

function SentinelHoldBlock({ holdData, onRequestReview }) {
  const [requested, setRequested] = useState(false);
  const concerns = holdData?.concerns ?? [];
  const repairActions = holdData?.repairActions ?? [];

  async function handleRequest() {
    setRequested(true);
    await onRequestReview?.(holdData?.conversationId);
  }

  return (
    <div
      style={{
        margin: '12px 0',
        padding: '16px 20px',
        borderRadius: '14px',
        border: '1px solid rgba(255,59,107,0.35)',
        background: 'rgba(255,59,107,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B6B" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <strong style={{ color: '#FF3B6B', fontSize: '14px' }}>Response held by SENTINEL</strong>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 10px' }}>
        {holdData?.message ?? 'This response has been held for quality review.'}
      </p>
      {concerns.length > 0 ? (
        <ul style={{ margin: '0 0 10px', paddingLeft: '18px', color: 'var(--muted)', fontSize: '13px' }}>
          {concerns.slice(0, 3).map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      ) : null}
      {repairActions.length > 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 12px', fontStyle: 'italic' }}>
          Suggested: {repairActions[0]}
        </p>
      ) : null}
      <Button
        tone="ghost"
        onClick={handleRequest}
        disabled={requested}
      >
        {requested ? 'Review requested' : 'Request review'}
      </Button>
    </div>
  );
}

export default function ChatPanel({
  // Agent
  activeAgent,

  // Messages
  messages,
  streamingText,
  isStreaming,
  hasConversationContent,
  promptCards,

  // Oracle audit
  auditUrl,
  isAuditing,

  // WREN escalation
  wrenEscalated,

  // Refs
  messagesViewportRef,
  bottomRef,

  // Callbacks
  onMessagesScroll,
  onSetDraft,
  onSetAuditUrl,
  onOracleAudit,
  onRequestReview,
}) {
  return (
    <>
      {activeAgent.id === 'oracle' ? (
        <div className="workspace-studio__url-audit-bar">
          <input
            type="url"
            className="field"
            placeholder="https://example.com — audit any public URL"
            value={auditUrl}
            onChange={(event) => onSetAuditUrl(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void onOracleAudit(); } }}
            disabled={isAuditing || isStreaming}
          />
          <Button
            tone="accent"
            onClick={onOracleAudit}
            disabled={!auditUrl.trim() || isAuditing || isStreaming}
          >
            {isAuditing ? 'Auditing...' : 'Audit URL'}
          </Button>
        </div>
      ) : null}

      {!hasConversationContent && promptCards.length > 0 ? (
        <MotionSection className="workspace-studio__prompt-row" reveal={{ y: 18, blur: 6 }}>
          {promptCards.map((prompt) => (
            <button key={prompt} type="button" className="workspace-studio__prompt-card" onClick={() => onSetDraft(prompt)}>
              {prompt}
            </button>
          ))}
        </MotionSection>
      ) : null}

      <div className="workspace-studio__messages" ref={messagesViewportRef} onScroll={onMessagesScroll}>
        {messages.length === 0 && !streamingText ? (
          <MotionSection reveal={{ y: 20, blur: 8 }}>
            <EmptyState
              title={`Start a ${activeAgent.name} conversation`}
              description="Everything here is integrated: chat, history, agent settings, and future avatar-driven presence in one workspace."
              accent={activeAgent.color}
            />
          </MotionSection>
        ) : (
          <MotionList className="workspace-studio__message-list" staggerChildren={0.04}>
            <MotionPresence initial={false}>
              {messages.map((message) =>
                message._held ? (
                  <MotionListItem key={message.id} reveal={{ y: 12, blur: 4 }}>
                    <SentinelHoldBlock
                      holdData={message.holdData}
                      onRequestReview={onRequestReview}
                    />
                  </MotionListItem>
                ) : (
                  <MotionListItem key={message.id} reveal={{ y: 12, blur: 4 }}>
                    <StudioMessage message={message} agent={activeAgent} />
                  </MotionListItem>
                ),
              )}
              {isStreaming ? (
                <MotionListItem key="streaming" reveal={{ y: 8, blur: 3 }}>
                  <StudioMessage
                    message={{ id: 'streaming', role: 'assistant', content: streamingText }}
                    agent={activeAgent}
                    streaming
                  />
                </MotionListItem>
              ) : null}
            </MotionPresence>
            <MotionPresence initial={false}>
              {wrenEscalated ? (
                <div key="wren-notice" style={{ marginTop: '12px' }}>
                  <InlineNotice tone="warning">
                    This conversation has been flagged for human review. Your support team will follow up.
                  </InlineNotice>
                </div>
              ) : null}
            </MotionPresence>
            <div ref={bottomRef} />
          </MotionList>
        )}
      </div>
    </>
  );
}

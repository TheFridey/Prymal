// ─────────────────────────────────────────────────────────────────
// features/workspace/chat/ChatPanel.jsx
// Oracle URL audit bar, prompt card row, and scrollable message list.
// All state is owned by WorkspaceStudio; this component is presentational.
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Button, EmptyState, InlineNotice } from '../../../components/ui';
import { MotionPresence, MotionSection, motion } from '../../../components/motion';
import { StudioMessage } from './renderers';
import { getAgentMeta } from '../../../lib/constants';

function SentinelHoldBlock({ holdData, onRequestReview, onEditRequest, onCancel }) {
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
        <strong style={{ color: '#FF3B6B', fontSize: '14px' }}>SENTINEL paused this output</strong>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 10px', lineHeight: 1.65 }}>
        {holdData?.message ?? 'SENTINEL paused this output because it may need evidence, repair, or review before it is safe to deliver. You can edit the request, add clearer source material, or request review.'}
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
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Button tone="ghost" onClick={onEditRequest}>
          Edit request
        </Button>
        <Button
          tone="ghost"
          onClick={handleRequest}
          disabled={requested}
        >
          {requested ? 'Review requested' : 'Request review'}
        </Button>
        <Button tone="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function AgentErrorBlock({ errorData, onRetry }) {
  const retryText = errorData?.retryText ?? '';

  return (
    <div
      style={{
        margin: '12px 0',
        padding: '16px 20px',
        borderRadius: '14px',
        border: '1px solid rgba(245,158,11,0.35)',
        background: 'rgba(245,158,11,0.07)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <strong style={{ color: '#f59e0b', fontSize: '14px' }}>Response could not be completed</strong>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 12px', lineHeight: 1.7 }}>
        {errorData?.message ??
          'Prymal could not reach the model provider or the run stopped early. Wait a moment and try again — credits stay reserved until a successful completion.'}
      </p>
      {retryText ? (
        <Button tone="ghost" onClick={() => onRetry?.(retryText)}>
          Retry prompt
        </Button>
      ) : null}
    </div>
  );
}

export default function ChatPanel({
  // Agent
  activeAgent,
  firstRunOutcome = null,

  // Messages
  messages,
  streamingText,
  isStreaming,
  streamingTask,
  hasConversationContent,
  promptCards,
  showFirstRunHint,

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
  onDismissFirstRunHint,
  onHandoff,
  onChangeRecommendedAgent,

  conversationId = '',
  onInsertDraft = () => {},
}) {
  const showOutcomeBanner = Boolean(firstRunOutcome);
  const alternateAgents = (firstRunOutcome?.alternateAgentIds ?? [])
    .map((agentId) => getAgentMeta(agentId))
    .filter(Boolean);

  return (
    <>
      {showOutcomeBanner ? (
        <MotionSection className="workspace-studio__first-run-hint" reveal={{ y: 14, blur: 6 }}>
          <div>
            <strong>Recommended path: {firstRunOutcome.title} {'->'} {firstRunOutcome.recommendedAgentId.toUpperCase()}</strong>
            <span>
              Using {activeAgent.name} because {(firstRunOutcome.recommendationReason ?? 'this agent is the best fit for the outcome.').replace(/^[A-Z]+ is best at /, 'it is best at ')}
            </span>
          </div>
          {alternateAgents.length > 0 ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {alternateAgents.slice(0, 2).map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => onChangeRecommendedAgent?.(agent.id)}
                  title={`Change agent to ${agent.name}`}
                >
                  {agent.name}
                </button>
              ))}
            </div>
          ) : null}
        </MotionSection>
      ) : null}

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

      {showFirstRunHint ? (
        <MotionSection className="workspace-studio__first-run-hint" reveal={{ y: 14, blur: 6 }}>
          <div>
            <strong>Start by asking Prymal to do something for your business</strong>
            <span>Choose a starter prompt or type one practical task below.</span>
          </div>
          <button type="button" onClick={onDismissFirstRunHint}>
            Got it
          </button>
        </MotionSection>
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
        {messages.length === 0 && !streamingText && !isStreaming ? (
          <MotionSection reveal={{ y: 20, blur: 8 }}>
            <EmptyState
              title={`Start a ${activeAgent.name} conversation`}
              description={
                activeAgent.useWhen
                  ? `${activeAgent.useWhen} Prymal streams replies here — use starter prompts below or describe one concrete outcome.`
                  : `Ask Prymal for one concrete outcome. Streams stay visible here — credits, retries, and holds surface clearly when something fails.`
              }
              accent={activeAgent.color}
            />
          </MotionSection>
        ) : (
          <div className="workspace-studio__message-list" aria-live="polite">
            <MotionPresence initial={false}>
              {messages.map((message) =>
                message._held ? (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
                    transition={{ duration: 0.2 }}
                  >
                    <SentinelHoldBlock
                      holdData={message.holdData}
                      onRequestReview={onRequestReview}
                      onEditRequest={() => onSetDraft('Please revise my last request so it can be answered safely with clear evidence and no unsupported claims.')}
                      onCancel={() => onSetDraft('')}
                    />
                  </motion.div>
                ) : message._error ? (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
                    transition={{ duration: 0.2 }}
                  >
                    <AgentErrorBlock
                      errorData={message.errorData}
                      onRetry={onSetDraft}
                    />
                  </motion.div>
                ) : (
                  <StudioMessage
                    key={message.id}
                    message={message}
                    agent={activeAgent}
                    onHandoff={onHandoff}
                    conversationId={conversationId}
                    onInsertDraft={onInsertDraft}
                  />
                ),
              )}
              {isStreaming ? (
                <motion.div
                  key="streaming"
                  initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
                  transition={{ duration: 0.16 }}
                >
                  <StudioMessage
                    message={{ id: 'streaming', role: 'assistant', content: streamingText }}
                    agent={activeAgent}
                    streaming
                    streamingTask={streamingTask}
                  />
                </motion.div>
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
          </div>
        )}
      </div>
    </>
  );
}

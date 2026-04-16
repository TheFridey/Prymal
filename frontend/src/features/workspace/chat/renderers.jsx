import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../../../lib/api';
import { formatNumber } from '../../../lib/utils';
import { AgentAvatar } from '../../../components/ui';
import { motion, MotionList, MotionListItem, MotionPresence, MotionSection, usePrymalReducedMotion } from '../../../components/motion';
import {
  GeneratedImageCard,
  SchemaValidationBadge,
  SentinelReviewBadge,
  SourceCard,
} from './MessageArtifacts';

export function StudioMessage({ message, agent, streaming = false }) {
  const reducedMotion = usePrymalReducedMotion();
  const isUser = message.role === 'user';
  const sources = message.metadata?.sources ?? [];
  const generatedImages = message.metadata?.generatedImages ?? [];
  const schemaValidation = message.schemaValidation ?? message.metadata?.schemaValidation ?? null;
  const sentinelReview = message.sentinelReview ?? message.metadata?.sentinelReview ?? null;
  const showThinkingState = streaming && !message.content.trim();

  const isHeraldDraft = !isUser && !streaming && agent?.id === 'herald' && /subject:/i.test(message.content);
  const isAtlasSummary = !isUser && !streaming && agent?.id === 'atlas' && message.content.trim().length > 50;

  return (
    <motion.div
      className={`workspace-studio__message${isUser ? ' is-user' : ''}`}
      layout
      initial={{
        opacity: 0,
        y: reducedMotion ? 0 : isUser ? 16 : 22,
        scale: reducedMotion ? 1 : 0.99,
        filter: reducedMotion ? 'none' : 'blur(8px)',
      }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: reducedMotion ? 0 : -10, scale: reducedMotion ? 1 : 0.99 }}
      transition={{ duration: reducedMotion ? 0.01 : streaming ? 0.16 : 0.26 }}
    >
      {!isUser ? (
        <AgentAvatar
          agent={agent}
          size={42}
          className={`workspace-studio__message-avatar${showThinkingState ? ' is-thinking' : ''}`}
        />
      ) : null}
      <div className={`workspace-studio__bubble${isUser ? ' is-user' : ''}`}>
        {showThinkingState ? (
          <ThinkingBubble agent={agent} />
        ) : isUser ? (
          <div style={{ lineHeight: 1.8 }}>{message.content}</div>
        ) : (
          <div className="markdown">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {streaming && !showThinkingState ? (
          <div className="workspace-studio__bubble-meta workspace-studio__bubble-meta--thinking" style={{ color: agent.color }}>
            <span className="workspace-studio__thinking-inline">
              <span className="workspace-studio__thinking-dot" />
              <span className="workspace-studio__thinking-dot" />
              <span className="workspace-studio__thinking-dot" />
            </span>
            Prymal is thinking
          </div>
        ) : null}
        {message.tokensUsed ? <div className="workspace-studio__bubble-meta">{formatNumber(message.tokensUsed)} tokens</div> : null}
        <MotionPresence initial={false}>
          {schemaValidation ? (
            <MotionSection key="schema-badge" delay={0.15} reveal={{ y: 0, blur: 0 }}>
              <SchemaValidationBadge validation={schemaValidation} />
            </MotionSection>
          ) : null}
        </MotionPresence>
        <MotionPresence initial={false}>
          {sentinelReview ? (
            <MotionSection key="sentinel-badge" delay={0.15} reveal={{ y: 0, blur: 0 }}>
              <SentinelReviewBadge review={sentinelReview} />
            </MotionSection>
          ) : null}
        </MotionPresence>
        {generatedImages.length > 0 ? (
          <div className="workspace-studio__generated-row">
            {generatedImages.map((image, index) => (
              <GeneratedImageCard
                key={`${image.url ?? image.fileName ?? 'generated'}-${index}`}
                image={image}
              />
            ))}
          </div>
        ) : null}
        {sources.length > 0 ? (
          <MotionList className="workspace-studio__source-row" staggerChildren={0.04}>
            {sources.map((source, index) => (
              <MotionListItem
                key={`${source.documentId ?? source.documentTitle ?? source.sourceUrl ?? 'source'}-${index}`}
                reveal={{ y: 8, blur: 4 }}
              >
                <SourceCard source={source} />
              </MotionListItem>
            ))}
          </MotionList>
        ) : null}
        {isHeraldDraft ? <HeraldEmailSend content={message.content} /> : null}
        {isAtlasSummary ? <AtlasNotionExport content={message.content} /> : null}
      </div>
    </motion.div>
  );
}

function HeraldEmailSend({ content }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const subjectMatch = content.match(/^subject:\s*(.+)$/im);
  const subject = subjectMatch ? subjectMatch[1].trim() : 'Email from Prymal';
  const body = content;

  async function handleSend() {
    if (!to.trim()) return;
    setStatus('sending');
    setErrorMsg('');
    try {
      await api.post('/agents/herald/send-email', { to: to.trim(), subject, body });
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err?.data?.error || err?.message || 'Send failed.');
    }
  }

  if (!open) {
    return (
      <div style={{ marginTop: '12px' }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-strong)', cursor: 'pointer' }}
        >
          Send via Gmail
        </button>
      </div>
    );
  }

  if (status === 'sent') {
    return <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--accent)' }}>Email sent via Gmail.</div>;
  }

  return (
    <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
      <input
        type="email"
        placeholder="Recipient email"
        value={to}
        onChange={(event) => setTo(event.target.value)}
        style={{ padding: '8px 14px', borderRadius: '999px', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-strong)', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
      />
      {errorMsg ? <div style={{ fontSize: '12px', color: '#ef4444' }}>{errorMsg}</div> : null}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          disabled={status === 'sending' || !to.trim()}
          onClick={handleSend}
          style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '999px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', opacity: status === 'sending' ? 0.6 : 1 }}
        >
          {status === 'sending' ? 'Sending...' : 'Send'}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function AtlasNotionExport({ content }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('Atlas Summary');
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [pageUrl, setPageUrl] = useState('');

  async function handleExport() {
    if (!title.trim()) return;
    setStatus('exporting');
    setErrorMsg('');
    try {
      const result = await api.post('/agents/atlas/export-notion', { title: title.trim(), content });
      setPageUrl(result.pageUrl ?? '');
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err?.data?.error || err?.message || 'Export failed.');
    }
  }

  if (!open) {
    return (
      <div style={{ marginTop: '12px' }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-strong)', cursor: 'pointer' }}
        >
          Export to Notion
        </button>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--accent)' }}>
        Exported to Notion.
        {pageUrl ? (
          <a href={pageUrl} target="_blank" rel="noreferrer" style={{ marginLeft: '8px', color: 'var(--accent)' }}>
            Open page
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
      <input
        type="text"
        placeholder="Page title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        style={{ padding: '8px 14px', borderRadius: '999px', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-strong)', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
      />
      {errorMsg ? <div style={{ fontSize: '12px', color: '#ef4444' }}>{errorMsg}</div> : null}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          disabled={status === 'exporting' || !title.trim()}
          onClick={handleExport}
          style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '999px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', opacity: status === 'exporting' ? 0.6 : 1 }}
        >
          {status === 'exporting' ? 'Exporting...' : 'Export'}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ThinkingBubble({ agent }) {
  return (
    <div className="workspace-studio__thinking">
      <motion.div
        className="workspace-studio__thinking-label"
        style={{ color: agent.color }}
        animate={{ opacity: [0.72, 1, 0.72] }}
        transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY }}
      >
        {agent.name} is thinking
      </motion.div>
      <div className="workspace-studio__thinking-copy">
        Pulling context, lining up the next move, and preparing a response.
      </div>
      <div className="workspace-studio__thinking-dots" aria-hidden="true">
        <span className="workspace-studio__thinking-dot" />
        <span className="workspace-studio__thinking-dot" />
        <span className="workspace-studio__thinking-dot" />
      </div>
    </div>
  );
}

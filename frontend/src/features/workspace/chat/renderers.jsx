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
import { buildMessagePresentation } from './messagePresentation';

function CipherScorecard({ data }) {
  const { summary, keyMetrics, anomalies, recommendations, confidence, dataQuality } = data ?? {};
  const severityColor = (s) =>
    s === 'high' ? '#FF3B6B' : s === 'medium' ? '#FF9500' : 'var(--muted)';
  const severityBg = (s) =>
    s === 'high' ? 'rgba(255,59,107,0.08)' : s === 'medium' ? 'rgba(255,165,0,0.08)' : 'rgba(255,255,255,0.04)';
  const severityBorder = (s) =>
    s === 'high' ? 'rgba(255,59,107,0.2)' : s === 'medium' ? 'rgba(255,165,0,0.2)' : 'rgba(255,255,255,0.07)';

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      {summary ? (
        <p style={{ margin: 0, lineHeight: 1.8, color: 'var(--text)', fontSize: '15px' }}>{summary}</p>
      ) : null}

      {keyMetrics && Object.keys(keyMetrics).length > 0 ? (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
            Key Metrics
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
            {Object.entries(keyMetrics).map(([key, value]) => (
              <div
                key={key}
                style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', textTransform: 'capitalize' }}>
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-strong)', wordBreak: 'break-word', lineHeight: 1.6 }}>
                  {value ?? '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {anomalies?.length > 0 ? (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
            Anomalies
          </div>
          <div style={{ display: 'grid', gap: '6px' }}>
            {anomalies.map((a, i) => (
              <div
                key={i}
                style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 14px', borderRadius: '10px', background: severityBg(a.severity), border: `1px solid ${severityBorder(a.severity)}` }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: severityBg(a.severity), color: severityColor(a.severity), flexShrink: 0, marginTop: '2px', textTransform: 'uppercase', border: `1px solid ${severityBorder(a.severity)}` }}>
                  {a.severity ?? 'info'}
                </span>
                <span style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.65 }}>{a.description}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {recommendations?.length > 0 ? (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
            Recommendations
          </div>
          <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--text)', fontSize: '14px', lineHeight: 1.8, display: 'grid', gap: '4px' }}>
            {recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ol>
        </div>
      ) : null}

      {(confidence !== undefined || dataQuality) ? (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {confidence !== undefined ? (
            <span style={{ fontSize: '13px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.07)' }}>
              Confidence: {Math.round(Number(confidence) * 100)}%
            </span>
          ) : null}
          {dataQuality ? (
            <span style={{ fontSize: '13px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.07)' }}>
              Data quality: {dataQuality}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatStructuredLabel(value) {
  return String(value)
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function CopyBlock({ content, tone = 'default' }) {
  return (
    <div
      style={{
        padding: tone === 'soft' ? '12px 14px' : 0,
        borderRadius: tone === 'soft' ? '14px' : 0,
        background: tone === 'soft' ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: tone === 'soft' ? '1px solid rgba(255,255,255,0.06)' : 'none',
      }}
    >
      <div className="markdown">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

function StructuredGroup({ title, children }) {
  return (
    <section style={{ display: 'grid', gap: '10px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>
        {title}
      </div>
      {children}
    </section>
  );
}

function StructuredMetric({ label, value }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '4px',
        padding: '12px 14px',
        borderRadius: '14px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-strong)' }}>{value}</div>
    </div>
  );
}

function HeraldSequenceCard({ data }) {
  const sequenceName = data?.sequenceName ?? 'Email sequence';
  const emails = Array.isArray(data?.emails) ? data.emails : [];

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div style={{ display: 'grid', gap: '12px' }}>
        <div style={{ display: 'grid', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Sequence
          </div>
          <div style={{ fontSize: '20px', lineHeight: 1.2, color: 'var(--text-strong)', fontWeight: 700 }}>{sequenceName}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
          {data?.targetAudience ? <StructuredMetric label="Audience" value={data.targetAudience} /> : null}
          <StructuredMetric label="Emails" value={String((data?.totalEmails ?? emails.length) || 0)} />
          {data?.notes ? <StructuredMetric label="Status" value="Needs personalization inputs" /> : null}
        </div>
      </div>

      {emails.map((email, index) => (
        <article
          key={`${email.emailNumber ?? index}-${email.subject ?? 'email'}`}
          style={{
            display: 'grid',
            gap: '14px',
            padding: '18px',
            borderRadius: '18px',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Email {email.emailNumber ?? index + 1}
            </span>
            <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)', background: 'rgba(255,255,255,0.04)' }}>
              Day {email.sendDay ?? 0}
            </span>
            {email?.tone ? (
              <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)', background: 'rgba(255,255,255,0.04)' }}>
                {email.tone}
              </span>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                Subject
              </div>
              <div style={{ fontSize: '18px', lineHeight: 1.35, color: 'var(--text-strong)', fontWeight: 600 }}>{email.subject}</div>
            </div>

            {email?.preview ? (
              <div style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.6 }}>{email.preview}</div>
            ) : null}
          </div>

          <StructuredGroup title="Body">
            <CopyBlock content={email.body ?? ''} tone="soft" />
          </StructuredGroup>

          {email?.cta ? (
            <StructuredGroup title="Call To Action">
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: 'rgba(76, 201, 240, 0.08)',
                  border: '1px solid rgba(76, 201, 240, 0.18)',
                  color: 'var(--text-strong)',
                  fontSize: '14px',
                  lineHeight: 1.6,
                }}
              >
                {email.cta}
              </div>
            </StructuredGroup>
          ) : null}

          {Array.isArray(email?.abVariants) && email.abVariants.length > 0 ? (
            <StructuredGroup title="A/B Variants">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                {email.abVariants.map((variant, variantIndex) => (
                  <div
                    key={`${variant.variant ?? variantIndex}-${variant.subject ?? 'variant'}`}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                      Variant {variant.variant ?? variantIndex + 1}
                    </div>
                    <div style={{ color: 'var(--text)', fontSize: '14px', lineHeight: 1.55 }}>{variant.subject}</div>
                  </div>
                ))}
              </div>
            </StructuredGroup>
          ) : null}
        </article>
      ))}

      {data?.notes ? (
        <StructuredGroup title="Notes">
          <CopyBlock content={data.notes} tone="soft" />
        </StructuredGroup>
      ) : null}
    </div>
  );
}

function renderStructuredValue(value, path) {
  if (value == null || value === '') {
    return <div style={{ color: 'var(--muted)' }}>-</div>;
  }

  if (typeof value === 'string') {
    return value.includes('\n')
      ? <CopyBlock content={value} tone="soft" />
      : <div style={{ color: 'var(--text)', lineHeight: 1.6 }}>{value}</div>;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return <div style={{ color: 'var(--text-strong)', lineHeight: 1.6 }}>{String(value)}</div>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <div style={{ color: 'var(--muted)' }}>None</div>;
    }

    if (value.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')) {
      return (
        <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '6px', color: 'var(--text)', lineHeight: 1.6 }}>
          {value.map((item, index) => <li key={`${path}-${index}`}>{String(item)}</li>)}
        </ul>
      );
    }

    return (
      <div style={{ display: 'grid', gap: '10px' }}>
        {value.map((item, index) => (
          <div
            key={`${path}-${index}`}
            style={{
              padding: '12px 14px',
              borderRadius: '14px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {renderStructuredValue(item, `${path}-${index}`)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        {Object.entries(value).map(([key, nestedValue]) => (
          <div
            key={`${path}-${key}`}
            style={{
              display: 'grid',
              gap: '6px',
              padding: '12px 14px',
              borderRadius: '14px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              {formatStructuredLabel(key)}
            </div>
            {renderStructuredValue(nestedValue, `${path}-${key}`)}
          </div>
        ))}
      </div>
    );
  }

  return <div style={{ color: 'var(--text)' }}>{String(value)}</div>;
}

function GenericStructuredCard({ data }) {
  const entries = Object.entries(data ?? {}).filter(([key]) => key !== 'agent');

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {entries.map(([key, value]) => (
        <StructuredGroup key={key} title={formatStructuredLabel(key)}>
          {renderStructuredValue(value, key)}
        </StructuredGroup>
      ))}
    </div>
  );
}

function StructuredAgentOutput({ parsed, agentId }) {
  if (agentId === 'cipher' && parsed?.agent === 'cipher') {
    return <CipherScorecard data={parsed} />;
  }
  if (parsed?.agent === 'herald') {
    return <HeraldSequenceCard data={parsed} />;
  }
  return <GenericStructuredCard data={parsed} />;
}

function MarkdownTable({ table }) {
  return (
    <div className="workspace-studio__markdown-table-shell">
      <table className="workspace-studio__markdown-table">
        <thead>
          <tr>
            {table.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>{cell || '-'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessageBody({ presentation, agentId }) {
  if (presentation.structuredData && !presentation.markdown) {
    return <StructuredAgentOutput parsed={presentation.structuredData} agentId={agentId} />;
  }

  return (
    <div className="workspace-studio__message-rich">
      {presentation.markdownBlocks.map((block, index) =>
        block.type === 'table' ? (
          <MarkdownTable key={`table-${index}`} table={block} />
        ) : (
          <div key={`text-${index}`} className="markdown">
            <ReactMarkdown>{block.content}</ReactMarkdown>
          </div>
        ),
      )}

      {presentation.structuredData ? (
        <details className="workspace-studio__structured-panel">
          <summary>
            <span>Structured output</span>
            <span>{presentation.structuredData.agent?.toUpperCase() ?? 'JSON'}</span>
          </summary>
          <div className="workspace-studio__structured-panel-body">
            <StructuredAgentOutput parsed={presentation.structuredData} agentId={agentId} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ResearchTrace({ sources }) {
  return (
    <div className="workspace-studio__trace-panel">
      <div className="workspace-studio__trace-heading">Research trace</div>
      <div className="workspace-studio__trace-grid">
        {sources.map((source, index) => (
          <div className="workspace-studio__trace-card" key={`${source.title}-${index}`}>
            <div className="workspace-studio__trace-title">{source.title}</div>
            {source.snippet ? <div className="workspace-studio__trace-snippet">{source.snippet}</div> : null}
            <div className="workspace-studio__trace-meta">{source.mode}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudioMessage({ message, agent, streaming = false }) {
  const reducedMotion = usePrymalReducedMotion();
  const isUser = message.role === 'user';
  const sources = message.metadata?.sources ?? [];
  const generatedImages = message.metadata?.generatedImages ?? [];
  const schemaValidation = message.schemaValidation ?? message.metadata?.schemaValidation ?? null;
  const sentinelReview = message.sentinelReview ?? message.metadata?.sentinelReview ?? null;
  const showThinkingState = streaming && !message.content.trim();

  // Normalize mixed markdown, embedded payloads, and tool traces once the response is complete.
  const presentation = !isUser && !streaming
    ? buildMessagePresentation({ content: message.content, agentId: agent?.id })
    : null;

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
          <MessageBody
            presentation={presentation ?? buildMessagePresentation({ content: message.content, agentId: agent?.id })}
            agentId={agent?.id}
          />
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
        {sources.length === 0 && presentation?.traceSources?.length ? (
          <ResearchTrace sources={presentation.traceSources} />
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

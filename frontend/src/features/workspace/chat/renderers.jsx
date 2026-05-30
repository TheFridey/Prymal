import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../../../lib/api';
import { formatNumber, getErrorMessage } from '../../../lib/utils';
import { AgentAvatar } from '../../../components/ui';
import { motion, MotionPresence, MotionSection, usePrymalReducedMotion } from '../../../components/motion';
import {
  EvidenceDrawer,
  GeneratedImageCard,
  GeneratedVideoCard,
  GroundingSourcesPanel,
  SchemaValidationBadge,
  SentinelReviewBadge,
  TrustGrammarPanel,
} from './MessageArtifacts';
import AgentMessageFeedback from './AgentMessageFeedback';
import { buildMessagePresentation, tokenizeMarkdownWithTables } from './messagePresentation';
import { getAgentHandoffs } from '../../../lib/agentHandoffs';
import { getAgentMeta } from '../../../lib/constants';
import { trackProductEvent } from '../../../lib/product-events';
import { FIRST_WIN_STATES, writeFirstWinState } from '../../../lib/first-run-outcomes';
import { createWorkflowDraftFromChat, isWorkflowCandidate } from '../../../lib/chat-to-workflow';

const SOCIAL_CHAT_SERVICES = new Set(['linkedin', 'slack', 'x', 'mastodon', 'bluesky', 'discord', 'telegram', 'line']);

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

function isCompactTableCell(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '-') return true;
  if (text.includes('\n- ') || text.includes('\n* ') || text.split('\n').filter(Boolean).length > 1) {
    return false;
  }
  return text.length <= 56;
}

function MetadataTable({ headers, row }) {
  const items = headers.map((header, index) => ({
    header,
    value: row[index] || '-',
  }));
  const compactItems = items.filter((item) => isCompactTableCell(item.value));
  const detailItems = items.filter((item) => !isCompactTableCell(item.value));

  return (
    <div className="workspace-studio__markdown-meta">
      {compactItems.length > 0 ? (
        <div className="workspace-studio__markdown-stats">
          {compactItems.map(({ header, value }) => (
            <div key={header} className="workspace-studio__markdown-stat">
              <span className="workspace-studio__markdown-stat-label">{header}</span>
              <span className="workspace-studio__markdown-stat-value">{value}</span>
            </div>
          ))}
        </div>
      ) : null}
      {detailItems.map(({ header, value }) => (
        <div key={header} className="workspace-studio__markdown-detail">
          <div className="workspace-studio__markdown-detail-label">{header}</div>
          <div className="workspace-studio__markdown-detail-body markdown">
            <ReactMarkdown>{value}</ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}

function MarkdownTable({ table }) {
  if (table.headers.length >= 3) {
    if (table.rows.length === 1) {
      return <MetadataTable headers={table.headers} row={table.rows[0]} />;
    }

    return (
      <div className="workspace-studio__markdown-rows">
        {table.rows.map((row, rowIndex) => (
          <MetadataTable key={`table-row-${rowIndex}`} headers={table.headers} row={row} />
        ))}
      </div>
    );
  }

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

function MarkdownTextBlock({ content }) {
  const blocks = tokenizeMarkdownWithTables(content);

  if (blocks.length === 1 && blocks[0].type === 'text') {
    return (
      <div className="markdown">
        <ReactMarkdown>{blocks[0].content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <>
      {blocks.map((block, index) =>
        block.type === 'table' ? (
          <MarkdownTable key={`text-table-${index}`} table={block} />
        ) : (
          <div key={`text-block-${index}`} className="markdown">
            <ReactMarkdown>{block.content}</ReactMarkdown>
          </div>
        ),
      )}
    </>
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
          <MarkdownTextBlock key={`text-${index}`} content={block.content} />
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

function StructuredStreamingPlaceholder({ agent, content }) {
  const preview = getStructuredStreamingPreview(agent, content);

  return (
    <div
      style={{
        display: 'grid',
        gap: '14px',
        padding: '16px 18px',
        borderRadius: '18px',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
      }}
    >
      <div style={{ display: 'grid', gap: '6px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Structured reply
        </div>
        <div style={{ fontSize: '18px', lineHeight: 1.3, color: 'var(--text-strong)', fontWeight: 700 }}>
          {preview.title}
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.6 }}>
          {preview.subtitle}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {preview.chips.map((chip) => (
          <span
            key={chip}
            style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            {chip}
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '8px' }} aria-hidden="true">
        <div style={{ height: '12px', width: '88%', borderRadius: '999px', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ height: '12px', width: '72%', borderRadius: '999px', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ height: '12px', width: '61%', borderRadius: '999px', background: 'rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  );
}

function StreamingMessageBody({ content, agent }) {
  const normalizedContent = String(content ?? '').trim();
  const isStructuredCandidate = looksLikeStructuredStreaming(normalizedContent);
  const presentation = isStructuredCandidate
    ? buildMessagePresentation({ content: normalizedContent, agentId: agent?.id })
    : null;

  if (presentation?.structuredData) {
    return (
      <div className="workspace-studio__message-rich">
        <StructuredAgentOutput parsed={presentation.structuredData} agentId={agent?.id} />
      </div>
    );
  }

  if (isStructuredCandidate) {
    return <StructuredStreamingPlaceholder agent={agent} content={normalizedContent} />;
  }

  return (
    <div className="workspace-studio__message-rich">
      <div className="markdown">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
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

function LoreImpactPanel({ sources, agentId, conversationId }) {
  const [expanded, setExpanded] = useState(false);
  const sourceCount = sources.length;
  const titles = sources
    .map((source) => source.documentTitle ?? source.title ?? source.sourceUrl ?? source.documentId)
    .filter(Boolean)
    .slice(0, 3);
  const hasTrustSignals = sources.some((source) =>
    source.confidenceLabel
    || source.trustLabel
    || source.freshnessScore != null
    || source.authorityScore != null
    || source.staleWarning
    || (source.contradictionSignals ?? []).length > 0
  );

  useEffect(() => {
    if (!sourceCount) return;
    void trackProductEvent('lore_source_used_in_response', {
      agent_id: agentId,
      conversation_id: conversationId || undefined,
      source_count: sourceCount,
    });
  }, [agentId, conversationId, sourceCount]);

  return (
    <div
      style={{
        marginTop: '12px',
        padding: '12px 14px',
        borderRadius: '12px',
        border: '1px solid rgba(199,125,255,0.24)',
        background: 'rgba(199,125,255,0.07)',
        display: 'grid',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ color: '#C77DFF', fontSize: '13px' }}>Grounded by LORE</strong>
        <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Used {sourceCount} business source{sourceCount === 1 ? '' : 's'}
        </span>
      </div>
      {titles.length > 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: '12px', lineHeight: 1.6 }}>
          This answer used your workspace knowledge: {titles.join(', ')}{sourceCount > titles.length ? ` and ${sourceCount - titles.length} more` : ''}.
        </div>
      ) : null}
      <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-strong)', fontSize: '12px' }}>
          Why this is better with LORE
        </summary>
        <div style={{ marginTop: '8px', color: 'var(--muted)', fontSize: '12px', lineHeight: 1.7 }}>
          Prymal matched this response to your organisation's own documents, so the answer can use your terminology, policies, offers, and evidence instead of generic chat context.
          {hasTrustSignals ? ' Freshness, confidence, and contradiction warnings appear in the evidence drawer when available.' : ' Add more source material if you want stronger evidence coverage.'}
        </div>
      </details>
    </div>
  );
}

function WorkflowFromChatCta({ agentId, content, conversationId }) {
  const [dismissed, setDismissed] = useState(false);
  const show = !dismissed && isWorkflowCandidate({ agentId, content });

  useEffect(() => {
    if (!show) return;
    void trackProductEvent('workflow_cta_shown', {
      agent_id: agentId,
      conversation_id: conversationId || undefined,
    });
  }, [agentId, conversationId, show]);

  if (!show) {
    return null;
  }

  function handleClick() {
    const draft = createWorkflowDraftFromChat({ agentId, content });
    try {
      window.sessionStorage.setItem('prymal:workflow-draft', JSON.stringify(draft));
    } catch {
      // Session storage is optional; the builder can still open blank.
    }
    writeFirstWinState('local', {
      state: FIRST_WIN_STATES.WORKFLOW_DRAFT_CREATED,
      agentId,
      conversationId: conversationId || undefined,
    });
    void trackProductEvent('workflow_cta_clicked', {
      agent_id: agentId,
      conversation_id: conversationId || undefined,
    });
    void trackProductEvent('workflow_draft_created_from_chat', {
      agent_id: agentId,
      conversation_id: conversationId || undefined,
      step_count: draft.nodes.length,
    });
    window.location.assign('/app/workflows?view=builder&draft=chat');
  }

  return (
    <div className="workspace-studio__workflow-cta">
      <div className="workspace-studio__workflow-cta-copy">
        <strong>Turn this into a workflow</strong>
        <span>Save this result as a repeatable NEXUS blueprint.</span>
      </div>
      <div className="workspace-studio__workflow-cta-actions">
        <button type="button" className="button button--ghost" onClick={handleClick}>
          Create draft blueprint
        </button>
        <button type="button" className="button button--ghost" onClick={() => setDismissed(true)}>
          Not now
        </button>
      </div>
    </div>
  );
}

export function StudioMessage({
  message,
  agent,
  streaming = false,
  streamingTask = null,
  onHandoff = null,
  conversationId = '',
  onInsertDraft,
}) {
  const reducedMotion = usePrymalReducedMotion();
  const isUser = message.role === 'user';
  const sources = message.metadata?.sources ?? [];
  const generatedImages = message.metadata?.generatedImages ?? [];
  const generatedVideos = message.metadata?.generatedVideos ?? [];
  const schemaValidation = message.schemaValidation ?? message.metadata?.schemaValidation ?? null;
  const sentinelReview = message.sentinelReview ?? message.metadata?.sentinelReview ?? null;
  const evidenceSummary = message.evidenceSummary ?? message.metadata?.evidenceSummary ?? null;
  const enforcementSummary = message.enforcementSummary ?? message.metadata?.enforcementSummary ?? null;
  const geminiGrounding = message.geminiGrounding ?? message.metadata?.geminiGrounding ?? null;
  const groundingSources = message.groundingSources ?? null;
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
      data-testid={isUser ? undefined : 'agent-response'}
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
          <ThinkingBubble agent={agent} streamingTask={streamingTask} content={message.content} />
        ) : isUser ? (
          <div style={{ lineHeight: 1.8 }}>{message.content}</div>
        ) : streaming ? (
          <StreamingMessageBody content={message.content} agent={agent} />
        ) : (
          <MessageBody
            presentation={presentation ?? buildMessagePresentation({ content: message.content, agentId: agent?.id })}
            agentId={agent?.id}
          />
        )}
        {streaming && !showThinkingState ? (
          <StreamingStatusMeta agent={agent} streamingTask={streamingTask} content={message.content} />
        ) : null}
        {message.tokensUsed ? <div className="workspace-studio__bubble-meta">{formatNumber(message.tokensUsed)} tokens</div> : null}
        {!isUser && !streaming && (message.metadata?.usedMemories?.length ?? 0) > 0 ? (
          <details className="workspace-studio__memory-used">
            <summary>Memory used in this reply</summary>
            <ul className="workspace-studio__memory-used-list">
              {(message.metadata?.usedMemories ?? []).map((m) => (
                <li key={m.id}>
                  <div className="workspace-studio__memory-used-title">{m.title}</div>
                  <div className="workspace-studio__bubble-meta">{m.selectedBecause}</div>
                  {m.redacted ? <div className="workspace-studio__bubble-meta">Label redacted for privacy</div> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
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
        {!isUser && !streaming ? (
          <TrustGrammarPanel enforcementSummary={enforcementSummary} geminiGrounding={geminiGrounding} />
        ) : null}
        {!isUser && !streaming && groundingSources ? (
          <GroundingSourcesPanel sources={groundingSources} />
        ) : null}
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
        {generatedVideos.length > 0 ? (
          <div className="workspace-studio__generated-row">
            {generatedVideos.map((video, index) => (
              <GeneratedVideoCard
                key={`${video.url ?? video.fileName ?? 'generated-video'}-${index}`}
                video={video}
              />
            ))}
          </div>
        ) : null}
        {sources.length > 0 ? (
          <>
            <LoreImpactPanel sources={sources} agentId={agent?.id} conversationId={conversationId} />
            <EvidenceDrawer evidenceSummary={evidenceSummary} sources={sources} />
          </>
        ) : null}
        {!isUser && !streaming && evidenceSummary && sources.length === 0 ? (
          <EvidenceDrawer evidenceSummary={evidenceSummary} sources={[]} />
        ) : null}
        {sources.length === 0 && presentation?.traceSources?.length ? (
          <ResearchTrace sources={presentation.traceSources} />
        ) : null}
        {isHeraldDraft ? <HeraldEmailSend content={message.content} messageId={message.id} /> : null}
        {isAtlasSummary ? <AtlasNotionExport content={message.content} /> : null}
        {!isUser && !streaming ? (
          <ChatSocialPublish
            message={message}
            agent={agent}
            presentation={presentation}
          />
        ) : null}
        {!isUser && !streaming && onHandoff ? (
          <HandoffSuggestions
            sourceAgentId={agent?.id}
            messageContent={message.content}
            onHandoff={onHandoff}
          />
        ) : null}
        {!isUser && !streaming ? (
          <WorkflowFromChatCta
            agentId={agent?.id}
            content={message.content}
            conversationId={conversationId}
          />
        ) : null}
        {!isUser && !streaming && conversationId && message.id ? (
          <AgentMessageFeedback
            agentId={agent?.id}
            conversationId={conversationId}
            messageId={message.id}
            onInsertDraft={onInsertDraft}
          />
        ) : null}
      </div>
    </motion.div>
  );
}

function HandoffSuggestions({ sourceAgentId, messageContent, onHandoff }) {
  const [dismissed, setDismissed] = useState(false);
  const handoffs = getAgentHandoffs(sourceAgentId);

  if (dismissed || handoffs.length === 0) {
    return null;
  }

  const trimmed = String(messageContent ?? '').slice(0, 600);
  const seedDraft = trimmed
    ? `Continuing from a ${(sourceAgentId ?? 'previous agent').toUpperCase()} reply:\n\n"${trimmed}${messageContent.length > 600 ? '…' : ''}"\n\nPlease take this further.`
    : '';

  return (
    <div
      style={{
        marginTop: '12px',
        padding: '10px 12px',
        borderRadius: '12px',
        border: '1px dashed rgba(91,107,134,0.28)',
        background: 'rgba(91,107,134,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
        <div
          style={{
            fontSize: '10px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
          }}
        >
          Continue with another specialist
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--muted)',
            fontSize: '11px',
            cursor: 'pointer',
            padding: '0 2px',
          }}
          aria-label="Dismiss handoff suggestions"
        >
          Dismiss
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {handoffs.slice(0, 3).map((handoff) => {
          const target = getAgentMeta(handoff.to);
          if (!target) return null;
          return (
            <button
              key={handoff.to}
              type="button"
              onClick={() => onHandoff(handoff.to, seedDraft)}
              title={`When ${handoff.when}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '999px',
                border: `1px solid ${target.color}44`,
                background: `${target.color}10`,
                color: target.color,
                fontSize: '11px',
                cursor: 'pointer',
                lineHeight: 1.2,
              }}
            >
              <span style={{ fontWeight: 600 }}>{target.name}</span>
              <span style={{ color: 'var(--muted)', fontWeight: 400 }}>·</span>
              <span style={{ color: 'var(--text)' }}>{handoff.label.replace(`Send to ${target.name} `, '').replace(`Send to ${target.name}`, target.name)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HeraldEmailSend({ content, messageId }) {
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
      await api.post('/agents/herald/send-email', { to: to.trim(), subject, body, messageId });
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

const SOCIAL_PREAMBLE_RE = [
  /^hi[,\s!]/i,
  /^hello[,\s!]/i,
  /^here('s| is)\s+(a|an|your|the|this)\s+/i,
  /^below\s+(is|you'?ll find)\s+/i,
  /^(i'?ve?|we'?ve?)\s+(written|drafted|created|prepared|put together)/i,
  /^as requested[,!]/i,
  /^sure[,!]/i,
  /^of course[,!]/i,
  /^absolutely[,!]/i,
  /^great[,!]/i,
];

const SOCIAL_SUFFIX_RE = [
  /^optional (first )?comment/i,
  /^if you (want|would like|need|'d like|need me)/i,
  /^let me know if/i,
  /^feel free to/i,
  /^want me to/i,
  /^should i /i,
  /^note:/i,
  /^p\.?s\.?\s/i,
  /^---+\s*$/,
];

function extractSocialPostText(raw) {
  if (!raw) return '';

  // Strip markdown code fences and trailing raw JSON blobs
  let text = raw
    .replace(/```(?:json)?\s*[\s\S]*?```/g, '')
    .replace(/\n\{[\s\S]{20,}\}\s*$/m, '')
    .trim();

  const lines = text.split('\n');

  // Skip preamble lines at the top
  let start = 0;
  while (start < lines.length) {
    const line = lines[start].trim();
    if (!line) { start++; continue; }
    if (SOCIAL_PREAMBLE_RE.some((re) => re.test(line))) { start++; continue; }
    break;
  }

  // Cut off at the first suffix marker
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (SOCIAL_SUFFIX_RE.some((re) => re.test(lines[i].trim()))) {
      end = i;
      break;
    }
  }

  const extracted = lines.slice(start, end).join('\n').trim();
  // Fall back to the cleaned-but-unstripped text if extraction yields nothing useful
  return extracted.length >= 20 ? extracted : text;
}

function getPublishableChatText(message, presentation) {
  const data = presentation?.structuredData;

  // Herald sequences: the actual post lives in emails[0].body
  if (data?.agent === 'herald' && Array.isArray(data.emails) && data.emails.length > 0) {
    const body = String(data.emails[0].body ?? '').trim();
    if (body.length >= 20) return body;
  }

  // Other structured agents: look for a direct text/post/content field
  if (data && typeof data === 'object') {
    const direct = data.post ?? data.content ?? data.body ?? data.text ?? data.copy;
    if (typeof direct === 'string' && direct.trim().length >= 20) return direct.trim();
  }

  // Prose agents: markdown has the JSON fence stripped already
  const markdown = String(presentation?.markdown ?? '').trim();
  if (markdown) return extractSocialPostText(markdown);

  // Last resort: strip JSON fences from the raw content
  return extractSocialPostText(String(message?.content ?? '').trim());
}

function getSocialTargetLabel(connection) {
  if (connection?.service === 'linkedin') {
    const settings = connection?.meta?.settings ?? {};
    const availableAuthors = connection?.meta?.profile?.availableAuthors ?? [];
    const matchedAuthor = availableAuthors.find((a) => a.urn === settings.authorUrn);
    const displayName =
      settings.selectedOrganizationName
      || matchedAuthor?.name
      || connection?.meta?.profile?.name
      || connection?.accountEmail
      || null;
    return displayName ? `LinkedIn: ${displayName}` : 'LinkedIn: set an author in Integrations';
  }

  if (connection?.accountEmail) {
    return `${connection.name}: ${connection.accountEmail}`;
  }

  return connection?.name ?? connection?.service ?? 'Connected platform';
}

function getSocialDeliveryLabel(result, fallbackService) {
  const delivery = result?.delivery ?? result?.result?.delivery ?? null;
  return delivery?.target || delivery?.preview || fallbackService || 'connected platform';
}

function ChatSocialPublish({ message, agent, presentation }) {
  const [open, setOpen] = useState(false);
  const [integrations, setIntegrations] = useState(null);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(false);
  const [service, setService] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [text, setText] = useState(() => getPublishableChatText(message, presentation).slice(0, 3000));
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [publishedTarget, setPublishedTarget] = useState('');

  const publishText = getPublishableChatText(message, presentation);
  const connected = (integrations?.connected ?? [])
    .filter((connection) => (
      SOCIAL_CHAT_SERVICES.has(connection.service)
      && connection.supportsPublish
      && !connection.publishDisabled
    ));
  const unavailable = (integrations?.connected ?? [])
    .filter((connection) => SOCIAL_CHAT_SERVICES.has(connection.service) && connection.supportsPublish && connection.publishDisabled);

  useEffect(() => {
    if (!open || integrations) return;
    setIsLoadingIntegrations(true);
    setErrorMsg('');

    api.get('/integrations')
      .then((result) => {
        setIntegrations(result);
        const first = (result.connected ?? []).find((connection) => (
          SOCIAL_CHAT_SERVICES.has(connection.service)
          && connection.supportsPublish
          && !connection.publishDisabled
        ));
        if (first) setService(first.service);
      })
      .catch((error) => {
        setErrorMsg(getErrorMessage(error, 'Could not load connected social platforms.'));
      })
      .finally(() => {
        setIsLoadingIntegrations(false);
      });
  }, [integrations, open]);

  useEffect(() => {
    setText(publishText.slice(0, 3000));
  }, [publishText]);

  if (!publishText) {
    return null;
  }

  async function handlePublish() {
    if (!service || !text.trim()) return;
    setStatus('publishing');
    setErrorMsg('');
    setPublishedTarget('');

    try {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const result = await api.post(`/integrations/${service}/publish`, {
        text: text.trim(),
        linkUrl: linkUrl.trim() || undefined,
        messageId: UUID_RE.test(message.id ?? '') ? message.id : undefined,
      });

      setPublishedTarget(getSocialDeliveryLabel(result, service));
      setStatus('published');
    } catch (error) {
      setStatus('error');
      setErrorMsg(getErrorMessage(error, 'Publish failed.'));
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
          Publish to social
        </button>
      </div>
    );
  }

  if (status === 'published') {
    return (
      <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--accent)' }}>
        Published to {publishedTarget || service}.
      </div>
    );
  }

  return (
    <div style={{ marginTop: '12px', display: 'grid', gap: '10px', padding: '12px', borderRadius: '14px', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.035)' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '13px', color: 'var(--text-strong)' }}>Publish from this reply</strong>
        <button type="button" onClick={() => setOpen(false)} style={{ fontSize: '12px', border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>

      {isLoadingIntegrations ? (
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Loading connected platforms...</div>
      ) : connected.length > 0 ? (
        <>
          <select
            value={service}
            onChange={(event) => setService(event.target.value)}
            style={{ padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-strong)', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
          >
            {connected.map((connection) => (
              <option key={connection.service} value={connection.service}>
                {getSocialTargetLabel(connection)}
              </option>
            ))}
          </select>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={3000}
            rows={6}
            style={{ padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-strong)', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }}
          />
          <input
            type="url"
            placeholder="Optional link URL"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            style={{ padding: '8px 12px', borderRadius: '999px', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-strong)', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
          />
          {errorMsg ? <div style={{ fontSize: '12px', color: '#ef4444' }}>{errorMsg}</div> : null}
          <button
            type="button"
            disabled={status === 'publishing' || !service || !text.trim()}
            onClick={handlePublish}
            style={{ justifySelf: 'start', fontSize: '13px', padding: '8px 16px', borderRadius: '999px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', opacity: status === 'publishing' ? 0.6 : 1 }}
          >
            {status === 'publishing' ? 'Publishing...' : 'Publish'}
          </button>
        </>
      ) : (
        <div style={{ display: 'grid', gap: '6px', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
          <span>No connected social publishing platform is ready yet.</span>
          {unavailable.length > 0 ? (
            <span>{unavailable.map((connection) => connection.name).join(', ')} needs reconnecting or posting permissions before live publishing.</span>
          ) : (
            <span>Connect LinkedIn, Slack, X, Mastodon, Bluesky, Discord, Telegram, or LINE in Integrations first.</span>
          )}
          {errorMsg ? <span style={{ color: '#ef4444' }}>{errorMsg}</span> : null}
        </div>
      )}
    </div>
  );
}

function useCyclingStep(steps, shouldCycle = true, intervalMs = 2200) {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepKey = steps.join('|');

  useEffect(() => {
    setActiveIndex(0);
  }, [stepKey]);

  useEffect(() => {
    if (!shouldCycle || steps.length < 2) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % steps.length);
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [intervalMs, shouldCycle, stepKey, steps.length]);

  return activeIndex;
}

function createTaskProfile({ agent, streamingTask, content }) {
  const agentName = agent?.name ?? streamingTask?.agentName ?? 'Prymal';
  const useLore = Boolean(streamingTask?.useLore);
  const hasAttachments = Boolean(streamingTask?.hasAttachments);
  const structuredReply = looksLikeStructuredStreaming(content);

  if (streamingTask?.kind === 'image') {
    return {
      label: `${agentName} is creating the image`,
      summary: 'Turning your brief into a polished visual and preparing the final asset.',
      metaLabel: 'Rendering image',
      steps: [
        'Reading the prompt and visual constraints',
        'Composing the scene, style, and framing',
        'Rendering the final image file',
      ],
    };
  }

  if (streamingTask?.kind === 'video') {
    return {
      label: `${agentName} is rendering the video`,
      summary: 'Queuing the render, waiting for the cinematic lane to finish, and preparing the final clip.',
      metaLabel: 'Rendering video',
      steps: [
        'Validating duration, resolution, and credit limits',
        'Rendering the clip in the media queue',
        'Packaging the finished video back into the chat',
      ],
    };
  }

  if (streamingTask?.kind === 'audit' || agent?.id === 'oracle') {
    return {
      label: `${agentName} is auditing the page`,
      summary: 'Checking the URL, reviewing the page signals, and assembling the audit.',
      metaLabel: 'Auditing page',
      steps: [
        'Fetching the page and validating the target URL',
        'Reviewing technical, content, and search signals',
        'Packaging the audit into a readable report',
      ],
    };
  }

  if (agent?.id === 'herald') {
    return {
      label: `${agentName} is drafting the sequence`,
      summary: 'Shaping the outreach angle, drafting the copy, and polishing the final message.',
      metaLabel: 'Drafting sequence',
      steps: [
        hasAttachments ? 'Reviewing the brief and attached context' : 'Reviewing the audience and objective',
        useLore ? 'Cross-checking prior conversations and lore' : 'Choosing the strongest outreach angle',
        structuredReply ? 'Formatting the final sequence card' : 'Drafting the send-ready copy',
      ],
    };
  }

  if (agent?.id === 'cipher') {
    return {
      label: `${agentName} is analysing the brief`,
      summary: 'Reviewing the signal, spotting the patterns, and assembling the clearest readout.',
      metaLabel: 'Analysing signal',
      steps: [
        hasAttachments ? 'Reviewing the attached files and exports' : 'Reviewing the request and available signal',
        useLore ? 'Cross-checking saved context and prior findings' : 'Looking for patterns, changes, and anomalies',
        structuredReply ? 'Formatting the scorecard output' : 'Writing the final findings',
      ],
    };
  }

  if (agent?.id === 'atlas') {
    return {
      label: `${agentName} is shaping the plan`,
      summary: 'Turning the request into a practical plan with clear structure and next steps.',
      metaLabel: 'Building plan',
      steps: [
        hasAttachments ? 'Reviewing the brief and attached context' : 'Reviewing the objective and constraints',
        useLore ? 'Cross-checking lore and prior operating context' : 'Structuring the milestones and dependencies',
        structuredReply ? 'Formatting the final plan layout' : 'Drafting the final plan',
      ],
    };
  }

  if (agent?.id === 'sage') {
    return {
      label: `${agentName} is synthesising the answer`,
      summary: 'Pulling the main threads together and turning them into one clear recommendation.',
      metaLabel: 'Synthesising answer',
      steps: [
        hasAttachments ? 'Reviewing your files, notes, and prompt' : 'Reviewing the request and surrounding context',
        useLore ? 'Cross-checking prior conversations and lore' : 'Connecting the strongest signals together',
        'Drafting the final recommendation',
      ],
    };
  }

  return {
    label: `${agentName} is preparing the reply`,
    summary: 'Reviewing the request, pulling the right context, and drafting the response.',
    metaLabel: 'Preparing reply',
    steps: [
      hasAttachments ? 'Reviewing your attachments and notes' : 'Reviewing your request',
      useLore ? 'Cross-checking lore and prior context' : structuredReply ? 'Formatting the structured reply' : 'Pulling the relevant context',
      'Drafting the final response',
    ],
  };
}

function ThinkingBubble({ agent, streamingTask, content }) {
  const reducedMotion = usePrymalReducedMotion();
  const profile = createTaskProfile({ agent, streamingTask, content });
  const activeStep = useCyclingStep(profile.steps, !reducedMotion);

  return (
    <div className="workspace-studio__thinking">
      <motion.div
        className="workspace-studio__thinking-label"
        style={{ color: agent.color }}
        animate={{ opacity: [0.72, 1, 0.72] }}
        transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY }}
      >
        {profile.label}
      </motion.div>
      <div className="workspace-studio__thinking-copy">
        {profile.summary}
      </div>
      <div style={{ display: 'grid', gap: '8px', marginTop: '4px' }}>
        {profile.steps.map((step, index) => {
          const status = index < activeStep ? 'complete' : index === activeStep ? 'active' : 'upcoming';
          return (
            <div
              key={step}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: status === 'upcoming' ? 'var(--muted)' : 'var(--text-strong)',
                opacity: status === 'upcoming' ? 0.66 : 1,
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '8px',
                  height: '8px',
                  flexShrink: 0,
                  borderRadius: '999px',
                  background: status === 'complete' ? agent.color : status === 'active' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)',
                  boxShadow: status === 'active' ? `0 0 0 4px ${agent.color}22` : 'none',
                }}
              />
              <span>{step}</span>
            </div>
          );
        })}
      </div>
      <div className="workspace-studio__thinking-dots" aria-hidden="true">
        <span className="workspace-studio__thinking-dot" />
        <span className="workspace-studio__thinking-dot" />
        <span className="workspace-studio__thinking-dot" />
      </div>
    </div>
  );
}

function StreamingStatusMeta({ agent, streamingTask, content }) {
  const reducedMotion = usePrymalReducedMotion();
  const profile = createTaskProfile({ agent, streamingTask, content });
  const activeStep = useCyclingStep(profile.steps, !reducedMotion);

  return (
    <div className="workspace-studio__bubble-meta workspace-studio__bubble-meta--thinking" style={{ color: agent.color }}>
      <span className="workspace-studio__thinking-inline">
        <span className="workspace-studio__thinking-dot" />
        <span className="workspace-studio__thinking-dot" />
        <span className="workspace-studio__thinking-dot" />
      </span>
      {profile.metaLabel} | {profile.steps[activeStep] ?? profile.summary}
    </div>
  );
}

function looksLikeStructuredStreaming(content = '') {
  const trimmed = String(content ?? '').trim();

  if (!trimmed) {
    return false;
  }

  return trimmed.startsWith('{') || trimmed.startsWith('```json');
}

function extractPartialJsonString(content, key) {
  const pattern = new RegExp(`"${key}"\\s*:\\s*"([^"]*)`, 'i');
  const match = String(content ?? '').match(pattern);
  return match?.[1]?.trim() || '';
}

function getStructuredStreamingPreview(agent, content) {
  const sequenceName = extractPartialJsonString(content, 'sequenceName');
  const subject = extractPartialJsonString(content, 'subject');

  if (agent?.id === 'herald') {
    return {
      title: sequenceName || 'Drafting email sequence',
      subtitle: subject
        ? `Finishing "${subject}" and formatting the final sequence card.`
        : 'Preparing subject lines, body copy, and CTA for the final sequence card.',
      chips: ['Sequence', 'Body copy', 'Variants'],
    };
  }

  if (agent?.id === 'cipher') {
    return {
      title: 'Building scorecard',
      subtitle: 'Organising the summary, metrics, and anomalies into the final scorecard.',
      chips: ['Summary', 'Metrics', 'Anomalies'],
    };
  }

  if (agent?.id === 'atlas') {
    return {
      title: 'Building plan outline',
      subtitle: 'Structuring milestones, owners, and risks into the final operating plan.',
      chips: ['Milestones', 'Owners', 'Risks'],
    };
  }

  return {
    title: `${agent?.name ?? 'Prymal'} is structuring the final reply`,
    subtitle: 'Formatting the response into its final validated layout.',
    chips: ['Structured', 'Validated', 'Formatting'],
  };
}

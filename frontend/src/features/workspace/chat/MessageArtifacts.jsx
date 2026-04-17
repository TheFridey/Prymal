import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../../lib/api';

const SCHEMA_BADGE_STYLES = {
  pass: { bg: 'rgba(24,199,160,0.12)', color: '#18c7a0', label: 'Schema validated' },
  repaired: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Schema repaired' },
  failed: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'Schema failed' },
  skipped: null,
};

const SENTINEL_STYLES = {
  PASS: { bg: 'rgba(24,199,160,0.08)', color: '#18c7a0', label: 'SENTINEL verified' },
  REPAIR: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'SENTINEL repaired' },
  HOLD: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'SENTINEL held for review' },
};

function ArtifactChip({ label, tone = 'default' }) {
  const toneStyle = tone === 'warning'
    ? { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', borderColor: '#f59e0b44' }
    : tone === 'danger'
      ? { background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderColor: '#ef444444' }
      : tone === 'success'
        ? { background: 'rgba(24,199,160,0.12)', color: '#18c7a0', borderColor: '#18c7a044' }
        : { background: 'rgba(91,107,134,0.16)', color: 'var(--muted)', borderColor: 'rgba(91,107,134,0.26)' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '999px',
        border: `1px solid ${toneStyle.borderColor}`,
        background: toneStyle.background,
        color: toneStyle.color,
        fontSize: '11px',
        lineHeight: 1.2,
      }}
    >
      {label}
    </span>
  );
}

function formatScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return score <= 1 ? `${Math.round(score * 100)}%` : score.toFixed(2);
}

export function SchemaValidationBadge({ validation }) {
  const [expanded, setExpanded] = useState(false);
  if (!validation?.verdict || validation.verdict === 'skipped') return null;

  const style = SCHEMA_BADGE_STYLES[validation.verdict];
  if (!style) return null;

  const repairNotes = Array.isArray(validation.repairNotes)
    ? validation.repairNotes
    : validation.repairNotes
      ? [validation.repairNotes]
      : [];
  const errors = validation.errors ?? [];
  const hasDetail = repairNotes.length > 0 || errors.length > 0;

  return (
    <div style={{ marginTop: '6px' }}>
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((value) => !value)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '11px',
          padding: '3px 9px',
          borderRadius: '999px',
          background: style.bg,
          color: style.color,
          border: `1px solid ${style.color}44`,
          cursor: hasDetail ? 'pointer' : 'default',
        }}
      >
        <span>{style.label}</span>
        {hasDetail ? <span style={{ opacity: 0.7 }}>{expanded ? 'Hide' : 'Show'}</span> : null}
      </button>
      {expanded && hasDetail ? (
        <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>
          {repairNotes.map((note, index) => (
            <div key={`repair-${index}`} style={{ padding: '2px 0' }}>
              Repair: {note}
            </div>
          ))}
          {errors.map((error, index) => (
            <div key={`error-${index}`} style={{ padding: '2px 0', color: '#ef4444' }}>
              Issue: {error}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SentinelReviewBadge({ review }) {
  const [expanded, setExpanded] = useState(false);
  if (!review?.verdict) return null;

  const style = SENTINEL_STYLES[review.verdict];
  if (!style) return null;

  const repairActions = review.repair_actions ?? [];
  const concerns = review.concerns ?? [];
  const hasDetail = review.hold_reason || repairActions.length > 0 || concerns.length > 0;

  return (
    <div style={{ marginTop: '6px' }}>
      {review.verdict === 'HOLD' ? (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '10px',
            background: style.bg,
            border: `1px solid ${style.color}44`,
            marginBottom: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: style.color, fontSize: '12px' }}>
            <span>!</span>
            <span>{style.label}</span>
          </div>
          {review.hold_reason ? (
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-strong)', lineHeight: 1.5 }}>
              {review.hold_reason}
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => hasDetail && setExpanded((value) => !value)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            padding: '3px 9px',
            borderRadius: '999px',
            background: style.bg,
            color: style.color,
            border: `1px solid ${style.color}44`,
            cursor: hasDetail ? 'pointer' : 'default',
          }}
        >
          {review.verdict === 'PASS' ? (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 6l3 3 5-5" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 2v4M6 8h.01" />
            </svg>
          )}
          <span>{style.label}</span>
          {hasDetail ? <span style={{ opacity: 0.7 }}>{expanded ? 'Hide' : 'Show'}</span> : null}
        </button>
      )}
      {expanded && hasDetail && review.verdict !== 'HOLD' ? (
        <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>
          {repairActions.map((action, index) => (
            <div key={`repair-action-${index}`} style={{ padding: '2px 0' }}>
              Repair: {action}
            </div>
          ))}
          {concerns.map((concern, index) => (
            <div key={`concern-${index}`} style={{ padding: '2px 0' }}>
              Concern: {concern}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function GeneratedImageCard({ image }) {
  const origin = API_BASE_URL.replace(/\/api$/, '');
  const baseImageUrl = image.url ? new URL(image.url, origin).toString() : null;
  const [cacheBust, setCacheBust] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setCacheBust('');
    setRetryCount(0);
    setHasLoaded(false);
  }, [baseImageUrl]);

  useEffect(() => {
    if (!baseImageUrl || hasLoaded || retryCount === 0 || retryCount > 5) {
      return undefined;
    }

    const delayMs = Math.min(700 * retryCount, 2200);
    const timeoutId = window.setTimeout(() => {
      setCacheBust(`v=${Date.now()}`);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [baseImageUrl, hasLoaded, retryCount]);

  const imageUrl = baseImageUrl
    ? `${baseImageUrl}${cacheBust ? `${baseImageUrl.includes('?') ? '&' : '?'}${cacheBust}` : ''}`
    : null;

  function handleLoad() {
    setHasLoaded(true);
  }

  function handleError() {
    if (retryCount >= 5) {
      return;
    }

    setRetryCount((current) => current + 1);
  }

  return (
    <div className="workspace-studio__generated-card">
      {imageUrl ? (
        <a href={imageUrl} target="_blank" rel="noreferrer" className="workspace-studio__generated-link">
          <img
            src={imageUrl}
            alt={image.prompt ?? 'Generated visual'}
            className="workspace-studio__generated-image"
            loading="eager"
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
          />
        </a>
      ) : null}
      <div className="workspace-studio__generated-meta">
        <div>
          <div className="workspace-studio__source-title">Generated visual</div>
          <div className="workspace-studio__source-meta">
            {image.model ?? 'openai-image'} | {image.size ?? 'auto'} | {image.quality ?? 'medium'}
          </div>
        </div>
        {imageUrl ? (
          <a href={imageUrl} target="_blank" rel="noreferrer" className="workspace-studio__source-link">
            Open
          </a>
        ) : null}
      </div>
      {!hasLoaded && retryCount > 0 ? (
        <div className="workspace-studio__source-summary">
          Loading the generated preview...
        </div>
      ) : null}
      {image.revisedPrompt ? <div className="workspace-studio__source-summary">{image.revisedPrompt}</div> : null}
    </div>
  );
}

export function SourceCard({ source }) {
  const [expanded, setExpanded] = useState(false);
  const title = source.documentTitle ?? source.title ?? source.documentId ?? 'Source';
  const origin = API_BASE_URL.replace(/\/api$/, '');
  const screenshotUrl = source.screenshotUrl ? new URL(source.screenshotUrl, origin).toString() : null;
  const citation = source.citation ?? {};
  const freshness = formatScore(source.freshnessScore ?? citation.freshnessScore);
  const authority = formatScore(source.authorityScore ?? citation.authorityScore);
  const confidence = source.confidenceLabel ?? citation.confidenceLabel ?? source.trustLabel ?? citation.trustLabel ?? null;
  const rankScore = formatScore(source.finalScore ?? source.rankingScore);
  const contradictionSignals = Array.isArray(source.contradictionSignals) ? source.contradictionSignals : [];
  const versionLineage = source.versionLineage ?? null;
  const lexical = formatScore(source.lexicalScore);
  const canExpand = Boolean(
    lexical
    || freshness
    || authority
    || rankScore
    || contradictionSignals.length > 0
    || versionLineage
    || source.staleWarning
    || source.summary
    || source.snippet,
  );

  return (
    <div className="workspace-studio__source-card">
      {screenshotUrl ? (
        <a href={source.sourceUrl ?? screenshotUrl} target="_blank" rel="noreferrer" className="workspace-studio__source-shot-link">
          <img src={screenshotUrl} alt={title} className="workspace-studio__source-shot" loading="lazy" />
        </a>
      ) : null}
      <div className="workspace-studio__source-head">
        <div>
          <div className="workspace-studio__source-title">{title}</div>
          <div className="workspace-studio__source-meta">
            {source.sourceType ?? 'source'}
            {source.fetchedVia ? ` | ${source.fetchedVia}` : ''}
            {source.mode ? ` | ${source.mode}` : ''}
          </div>
        </div>
        {source.sourceUrl ? (
          <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="workspace-studio__source-link">
            Open
          </a>
        ) : null}
      </div>
      <div className="workspace-studio__source-badges">
        {confidence ? <ArtifactChip label={`Confidence ${confidence}`} tone={confidence.toLowerCase() === 'high' ? 'success' : 'default'} /> : null}
        {freshness ? <ArtifactChip label={`Freshness ${freshness}`} /> : null}
        {authority ? <ArtifactChip label={`Authority ${authority}`} /> : null}
        {rankScore ? <ArtifactChip label={`Rank ${rankScore}`} /> : null}
        {versionLineage?.latestVersion ? <ArtifactChip label={`Latest v${versionLineage.latestVersion}`} /> : null}
        {versionLineage?.isSuperseded ? <ArtifactChip label="Superseded" tone="warning" /> : null}
        {contradictionSignals.length > 0 ? <ArtifactChip label={`${contradictionSignals.length} contradiction${contradictionSignals.length === 1 ? '' : 's'}`} tone="warning" /> : null}
      </div>
      {source.staleWarning ? (
        <div className="workspace-studio__source-error" style={{ color: '#f59e0b', borderColor: '#f59e0b33', background: 'rgba(245,158,11,0.08)' }}>
          {source.staleWarning}
        </div>
      ) : null}
      {source.snippet ? <div className="workspace-studio__source-snippet">{source.snippet}</div> : null}
      {source.summary ? <div className="workspace-studio__source-summary">{source.summary.slice(0, 260)}</div> : null}
      {canExpand ? (
        <button
          type="button"
          className="workspace-studio__source-toggle"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Hide ranking details' : 'Why this source won'}
        </button>
      ) : null}
      {expanded ? (
        <div className="workspace-studio__source-detail-grid">
          <div className="workspace-studio__source-detail-card">
            <div className="workspace-studio__source-detail-title">Ranking signal mix</div>
            <div className="workspace-studio__source-list">
              <div className="workspace-studio__source-detail-row">
                <span>Semantic match</span>
                <strong>{formatScore(source.similarity) ?? 'n/a'}</strong>
              </div>
              <div className="workspace-studio__source-detail-row">
                <span>Lexical lift</span>
                <strong>{lexical ?? 'n/a'}</strong>
              </div>
              <div className="workspace-studio__source-detail-row">
                <span>Freshness lift</span>
                <strong>{freshness ?? 'n/a'}</strong>
              </div>
              <div className="workspace-studio__source-detail-row">
                <span>Authority lift</span>
                <strong>{authority ?? 'n/a'}</strong>
              </div>
              <div className="workspace-studio__source-detail-row">
                <span>Final rank</span>
                <strong>{rankScore ?? 'n/a'}</strong>
              </div>
            </div>
          </div>

          <div className="workspace-studio__source-detail-card">
            <div className="workspace-studio__source-detail-title">Trust interpretation</div>
            <div className="workspace-studio__source-list">
              <div className="workspace-studio__source-detail-row">
                <span>Confidence</span>
                <strong>{describeConfidence(confidence)}</strong>
              </div>
              <div className="workspace-studio__source-detail-row">
                <span>Freshness posture</span>
                <strong>{source.staleWarning ? 'Stale warning attached' : 'No stale warning'}</strong>
              </div>
              <div className="workspace-studio__source-detail-row">
                <span>Retrieval mode</span>
                <strong>{humanizeSignal(source.retrievalMode ?? source.mode ?? 'semantic')}</strong>
              </div>
              <div className="workspace-studio__source-detail-row">
                <span>Source type</span>
                <strong>{humanizeSignal(source.sourceType ?? citation.sourceType ?? 'source')}</strong>
              </div>
            </div>
          </div>

          {versionLineage ? (
            <div className="workspace-studio__source-detail-card">
              <div className="workspace-studio__source-detail-title">Version lineage</div>
              <div className="workspace-studio__source-list">
                <div className="workspace-studio__source-detail-row">
                  <span>Status</span>
                  <strong>{versionLineage.isSuperseded ? 'Superseded' : 'Current or latest known'}</strong>
                </div>
                {versionLineage.latestVersion ? (
                  <div className="workspace-studio__source-detail-row">
                    <span>Latest version</span>
                    <strong>v{versionLineage.latestVersion}</strong>
                  </div>
                ) : null}
                {versionLineage.versionChainId ? (
                  <div className="workspace-studio__source-detail-row">
                    <span>Version chain</span>
                    <strong>{String(versionLineage.versionChainId).slice(0, 14)}</strong>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {contradictionSignals.length > 0 ? (
            <div className="workspace-studio__source-detail-card">
              <div className="workspace-studio__source-detail-title">Contradiction signals</div>
              <div className="workspace-studio__source-list">
                {contradictionSignals.slice(0, 3).map((signal, index) => (
                  <div key={`${signal.type ?? 'signal'}-${index}`} className="workspace-studio__source-contradiction">
                    <strong>{humanizeSignal(signal.type ?? 'conflict')}</strong>
                    {signal.excerpt ? <span>{truncateText(signal.excerpt, 120)}</span> : null}
                    {signal.existingDocumentTitle ? <small>{signal.existingDocumentTitle}</small> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {Array.isArray(source.followedLinks) && source.followedLinks.length > 0 ? (
        <div className="workspace-studio__source-followed">
          {source.followedLinks.slice(0, 3).map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="workspace-studio__source-followed-link">
              {link.title}
            </a>
          ))}
        </div>
      ) : null}
      {source.error ? <div className="workspace-studio__source-error">{source.error}</div> : null}
    </div>
  );
}

function describeConfidence(confidence) {
  if (!confidence) {
    return 'No confidence label';
  }

  if (/high/i.test(confidence)) {
    return 'High confidence';
  }

  if (/low|ungrounded/i.test(confidence)) {
    return 'Needs review';
  }

  return humanizeSignal(confidence);
}

function humanizeSignal(value) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function truncateText(value, limit = 120) {
  if (!value) {
    return '';
  }

  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

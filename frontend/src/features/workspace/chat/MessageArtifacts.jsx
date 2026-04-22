import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../../lib/api';
import { createExplainabilityChipStyle } from '../../../design-system/primitives';

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

function ArtifactChip({ label, tone = 'default', title }) {
  const toneStyle = tone === 'warning'
    ? { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', borderColor: '#f59e0b44' }
    : tone === 'danger'
      ? { background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderColor: '#ef444444' }
      : tone === 'success'
        ? { background: 'rgba(24,199,160,0.12)', color: '#18c7a0', borderColor: '#18c7a044' }
        : { background: 'rgba(91,107,134,0.16)', color: 'var(--muted)', borderColor: 'rgba(91,107,134,0.26)' };

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        ...createExplainabilityChipStyle({ accent: toneStyle.color }),
        border: `1px solid ${toneStyle.borderColor}`,
        background: toneStyle.background,
        color: toneStyle.color,
        lineHeight: 1.2,
      }}
    >
      {label}
    </span>
  );
}

function formatScore(value) {
  if (value == null || value === '') return null;
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

const HALLUCINATION_RISK_TONE = {
  low: 'success',
  medium: 'default',
  high: 'warning',
  critical: 'danger',
};

function formatPercent(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return `${Math.round(num <= 1 ? num * 100 : num)}%`;
}

function pluralize(count, singular, plural) {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function TrustGrammarPanel({ enforcementSummary, geminiGrounding }) {
  const [expanded, setExpanded] = useState(false);

  if (!enforcementSummary && !geminiGrounding) {
    return null;
  }

  const summary = enforcementSummary ?? {};
  const retrieval = summary.retrieval ?? null;
  const memory = summary.memory ?? null;
  const grounding = geminiGrounding ?? null;

  const chips = [];

  if (summary.sentinelVerdict && summary.sentinelVerdict !== 'PASS') {
    const tone = summary.sentinelVerdict === 'HOLD' ? 'danger' : 'warning';
    chips.push({
      key: 'sentinel-risk',
      label: `SENTINEL ${summary.sentinelVerdict.toLowerCase()}`,
      tone,
      title: summary.sentinelHoldReason ?? `SENTINEL ${summary.sentinelVerdict.toLowerCase()} verdict`,
    });
  }

  if (Number(summary.sentinelRiskScore) > 0) {
    const tone = summary.sentinelRiskScore >= 0.7 ? 'danger' : summary.sentinelRiskScore >= 0.4 ? 'warning' : 'default';
    chips.push({
      key: 'sentinel-score',
      label: `Risk ${formatPercent(summary.sentinelRiskScore)}`,
      tone,
      title: 'SENTINEL composite risk score',
    });
  }

  if (summary.schemaRepairAttempts > 0) {
    chips.push({
      key: 'schema-repair',
      label: `${summary.schemaRepairAttempts} ${pluralize(summary.schemaRepairAttempts, 'schema repair')}`,
      tone: 'warning',
      title: 'Output failed initial schema validation and was repaired',
    });
  }

  if (summary.hallucinationRiskLevel && summary.hallucinationRiskLevel !== 'low') {
    chips.push({
      key: 'hallucination-risk',
      label: `Hallucination ${summary.hallucinationRiskLevel}`,
      tone: HALLUCINATION_RISK_TONE[summary.hallucinationRiskLevel] ?? 'warning',
      title: summary.hallucinationRiskOverThreshold ? 'Hallucination risk above contract threshold' : 'Hallucination risk score',
    });
  }

  if (summary.citationRequired && Number(summary.citationRate) > 0 && summary.citationRate < 1) {
    chips.push({
      key: 'citation-rate',
      label: `Cited ${formatPercent(summary.citationRate)}`,
      tone: summary.citationRate < 0.6 ? 'warning' : 'default',
      title: 'Share of factual claims with citation backing',
    });
  }

  if (summary.toolViolationCount > 0) {
    chips.push({
      key: 'tool-violations',
      label: `${summary.toolViolationCount} ${pluralize(summary.toolViolationCount, 'tool violation')}`,
      tone: summary.toolViolationAction === 'BLOCK' ? 'danger' : 'warning',
      title: (summary.toolViolationTypes ?? []).join(', ') || 'Tool contract violations were detected',
    });
  }

  if (summary.contradictionCount > 0) {
    chips.push({
      key: 'contradictions',
      label: `${summary.contradictionCount} ${pluralize(summary.contradictionCount, 'contradiction')}`,
      tone: 'warning',
      title: 'Conflicting signals detected across retrieved sources',
    });
  }

  if (summary.semanticBlocks?.length > 0) {
    chips.push({
      key: 'semantic-blocks',
      label: `${summary.semanticBlocks.length} semantic ${pluralize(summary.semanticBlocks.length, 'block')}`,
      tone: 'danger',
      title: summary.semanticBlocks[0],
    });
  }

  if (summary.semanticWarnings?.length > 0) {
    chips.push({
      key: 'semantic-warnings',
      label: `${summary.semanticWarnings.length} semantic ${pluralize(summary.semanticWarnings.length, 'warning')}`,
      tone: 'warning',
      title: summary.semanticWarnings[0],
    });
  }

  if (retrieval?.expanded) {
    chips.push({
      key: 'retrieval-expand',
      label: `Retrieval +${(retrieval.hardCap ?? 0) - (retrieval.baseLimit ?? 0)}`,
      tone: 'default',
      title: `Adaptive retrieval pulled ${retrieval.fetchedCount ?? 0} chunks, kept ${retrieval.selectedCount ?? 0} (${retrieval.confidentCount ?? 0} confident)`,
    });
  }

  if (memory?.staleEntryKeys?.length > 0) {
    chips.push({
      key: 'memory-stale',
      label: `${memory.staleEntryKeys.length} stale ${pluralize(memory.staleEntryKeys.length, 'memory', 'memories')}`,
      tone: 'warning',
      title: `Stale: ${memory.staleEntryKeys.slice(0, 4).join(', ')}`,
    });
  }

  if (memory?.restrictedEntryCount > 0) {
    chips.push({
      key: 'memory-restricted',
      label: `${memory.restrictedEntryCount} restricted`,
      tone: 'default',
      title: 'Restricted-scope memory used in this turn',
    });
  }

  if (grounding?.chunkCount > 0) {
    chips.push({
      key: 'gemini-grounding',
      label: `Live grounding ${grounding.chunkCount}`,
      tone: 'success',
      title: `Gemini grounded against ${grounding.chunkCount} live web chunks`,
    });
  }

  if (summary.fallbackUsed) {
    chips.push({
      key: 'fallback',
      label: 'Provider fallback',
      tone: 'warning',
      title: 'Primary provider failed and a fallback model answered',
    });
  }

  if (chips.length === 0) {
    return null;
  }

  const hasDetail = Boolean(
    retrieval
      || memory
      || grounding?.queries?.length
      || (summary.schemaErrors ?? []).length > 0
      || (summary.schemaRepairNotes ?? []).length > 0
      || (summary.semanticBlocks ?? []).length > 0
      || (summary.semanticWarnings ?? []).length > 0
      || summary.sentinelHoldReason,
  );

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        {chips.map((chip) => (
          <ArtifactChip key={chip.key} label={chip.label} tone={chip.tone} title={chip.title} />
        ))}
        {hasDetail ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            style={{
              fontSize: '11px',
              color: 'var(--muted)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
            }}
          >
            {expanded ? 'Hide trust trail' : 'Trust trail'}
          </button>
        ) : null}
      </div>
      {expanded && hasDetail ? (
        <div
          style={{
            marginTop: '8px',
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'rgba(91,107,134,0.06)',
            border: '1px solid rgba(91,107,134,0.18)',
            display: 'grid',
            gap: '10px',
            fontSize: '11px',
            color: 'var(--muted)',
            lineHeight: 1.55,
          }}
        >
          {retrieval ? (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-strong)', marginBottom: '4px' }}>Retrieval</div>
              <div>
                Budget {retrieval.baseLimit ?? '—'} → cap {retrieval.hardCap ?? '—'} ·
                fetched {retrieval.fetchedCount ?? 0} ·
                kept {retrieval.selectedCount ?? 0} ·
                confident {retrieval.confidentCount ?? 0}
                {retrieval.confidenceFloor ? ` · floor ${formatScore(retrieval.confidenceFloor)}` : ''}
              </div>
            </div>
          ) : null}
          {memory ? (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-strong)', marginBottom: '4px' }}>Memory</div>
              <div>
                {memory.totalEntries ?? 0} {pluralize(memory.totalEntries ?? 0, 'entry', 'entries')}
                {memory.statusBreakdown ? ` · ${Object.entries(memory.statusBreakdown).map(([k, v]) => `${v} ${k}`).join(' · ')}` : ''}
              </div>
              {memory.provenanceBreakdown && Object.keys(memory.provenanceBreakdown).length > 0 ? (
                <div style={{ marginTop: '2px' }}>
                  Provenance: {Object.entries(memory.provenanceBreakdown).map(([k, v]) => `${v} ${k}`).join(' · ')}
                </div>
              ) : null}
              {memory.staleEntryKeys?.length > 0 ? (
                <div style={{ marginTop: '2px', color: '#f59e0b' }}>
                  Stale keys: {memory.staleEntryKeys.slice(0, 6).join(', ')}
                </div>
              ) : null}
            </div>
          ) : null}
          {grounding?.queries?.length > 0 ? (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-strong)', marginBottom: '4px' }}>Live grounding queries</div>
              <div>{grounding.queries.slice(0, 4).join(' · ')}</div>
              {grounding.supportCount ? (
                <div style={{ marginTop: '2px' }}>{grounding.supportCount} support {pluralize(grounding.supportCount, 'span')}</div>
              ) : null}
            </div>
          ) : null}
          {summary.sentinelHoldReason && summary.sentinelVerdict !== 'HOLD' ? (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-strong)', marginBottom: '4px' }}>SENTINEL note</div>
              <div>{summary.sentinelHoldReason}</div>
            </div>
          ) : null}
          {(summary.schemaRepairNotes ?? []).length > 0 ? (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-strong)', marginBottom: '4px' }}>Schema repair</div>
              {summary.schemaRepairNotes.slice(0, 3).map((note, index) => (
                <div key={`schema-note-${index}`}>{note}</div>
              ))}
            </div>
          ) : null}
          {(summary.semanticBlocks?.length > 0 || summary.semanticWarnings?.length > 0) ? (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-strong)', marginBottom: '4px' }}>Semantic checks</div>
              {(summary.semanticBlocks ?? []).map((block, index) => (
                <div key={`block-${index}`} style={{ color: '#ef4444' }}>Block: {block}</div>
              ))}
              {(summary.semanticWarnings ?? []).map((warning, index) => (
                <div key={`warn-${index}`} style={{ color: '#f59e0b' }}>Warning: {warning}</div>
              ))}
            </div>
          ) : null}
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

export function GeneratedVideoCard({ video }) {
  const origin = API_BASE_URL.replace(/\/api$/, '');
  const videoUrl = video.url ? new URL(video.url, origin).toString() : null;

  return (
    <div className="workspace-studio__generated-card">
      {videoUrl ? (
        <div className="workspace-studio__generated-link">
          <video
            src={videoUrl}
            className="workspace-studio__generated-image"
            controls
            preload="metadata"
          />
        </div>
      ) : null}
      <div className="workspace-studio__generated-meta">
        <div>
          <div className="workspace-studio__source-title">Generated video</div>
          <div className="workspace-studio__source-meta">
            {video.durationSeconds ?? 4}s | {video.resolution ?? '720p'} | {video.aspectRatio ?? '16:9'}
          </div>
        </div>
        {videoUrl ? (
          <a href={videoUrl} target="_blank" rel="noreferrer" className="workspace-studio__source-link">
            Open
          </a>
        ) : null}
      </div>
      {video.prompt ? <div className="workspace-studio__source-summary">{video.prompt}</div> : null}
    </div>
  );
}

export function SourceCard({ source }) {
  const [expanded, setExpanded] = useState(false);
  const title = source.documentTitle ?? source.title ?? source.documentId ?? 'Source';
  const origin = API_BASE_URL.replace(/\/api$/, '');
  const screenshotUrl = source.screenshotUrl ? new URL(source.screenshotUrl, origin).toString() : null;
  const citation = source.citation ?? {};
  const semantic = formatScore(source.similarity);
  const lexical = formatScore(source.lexicalScore);
  const freshness = formatScore(source.freshnessScore ?? citation.freshnessScore);
  const authority = formatScore(source.authorityScore ?? citation.authorityScore);
  const confidence = source.confidenceLabel ?? citation.confidenceLabel ?? source.trustLabel ?? citation.trustLabel ?? null;
  const rankScore = formatScore(source.finalScore ?? source.rankingScore);
  const contradictionSignals = Array.isArray(source.contradictionSignals) ? source.contradictionSignals : [];
  const versionLineage = source.versionLineage ?? null;
  const hasRankingSignals = Boolean(
    semantic
    || lexical
    || freshness
    || authority
    || rankScore
  );
  const hasTrustDetails = Boolean(
    confidence
    || source.staleWarning
    || source.retrievalMode
    || source.mode
    || source.sourceType
    || citation.sourceType
  );
  const canExpand = Boolean(
    hasRankingSignals
    || contradictionSignals.length > 0
    || versionLineage
    || hasTrustDetails,
  );
  const detailToggleLabel = hasRankingSignals ? 'Why this source won' : 'Source details';
  const detailHideLabel = hasRankingSignals ? 'Hide ranking details' : 'Hide source details';

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
        {confidence ? <ArtifactChip label={`Confidence ${confidence}`} tone={confidence.toLowerCase() === 'high' ? 'success' : 'default'} title="Model confidence label for this source" /> : null}
        {freshness ? <ArtifactChip label={`Freshness ${freshness}`} title="Freshness score contribution" /> : null}
        {authority ? <ArtifactChip label={`Authority ${authority}`} title="Authority score contribution" /> : null}
        {rankScore ? <ArtifactChip label={`Rank ${rankScore}`} title="Final retrieval rank" /> : null}
        {versionLineage?.latestVersion ? <ArtifactChip label={`Latest v${versionLineage.latestVersion}`} title="Latest known document version" /> : null}
        {versionLineage?.isSuperseded ? <ArtifactChip label="Superseded" tone="warning" title="A newer document version exists" /> : null}
        {contradictionSignals.length > 0 ? <ArtifactChip label={`${contradictionSignals.length} contradiction${contradictionSignals.length === 1 ? '' : 's'}`} tone="warning" title="This source conflicts with another indexed document" /> : null}
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
          {expanded ? detailHideLabel : detailToggleLabel}
        </button>
      ) : null}
      {expanded ? (
        <div className="workspace-studio__source-detail-grid">
          {hasRankingSignals ? (
            <div className="workspace-studio__source-detail-card">
              <div className="workspace-studio__source-detail-title">Ranking signal mix</div>
              <div className="workspace-studio__source-list">
                {semantic ? (
                  <div className="workspace-studio__source-detail-row">
                    <span>Semantic match</span>
                    <strong>{semantic}</strong>
                  </div>
                ) : null}
                {lexical ? (
                  <div className="workspace-studio__source-detail-row">
                    <span>Lexical lift</span>
                    <strong>{lexical}</strong>
                  </div>
                ) : null}
                {freshness ? (
                  <div className="workspace-studio__source-detail-row">
                    <span>Freshness lift</span>
                    <strong>{freshness}</strong>
                  </div>
                ) : null}
                {authority ? (
                  <div className="workspace-studio__source-detail-row">
                    <span>Authority lift</span>
                    <strong>{authority}</strong>
                  </div>
                ) : null}
                {rankScore ? (
                  <div className="workspace-studio__source-detail-row">
                    <span>Final rank</span>
                    <strong>{rankScore}</strong>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="workspace-studio__source-detail-card">
            <div className="workspace-studio__source-detail-title">{hasRankingSignals ? 'Trust interpretation' : 'Source details'}</div>
            <div className="workspace-studio__source-list">
              {confidence ? (
                <div className="workspace-studio__source-detail-row">
                  <span>Confidence</span>
                  <strong>{describeConfidence(confidence)}</strong>
                </div>
              ) : null}
              {(hasRankingSignals || source.staleWarning) ? (
                <div className="workspace-studio__source-detail-row">
                  <span>Freshness posture</span>
                  <strong>{source.staleWarning ? 'Stale warning attached' : 'No stale warning'}</strong>
                </div>
              ) : null}
              <div className="workspace-studio__source-detail-row">
                <span>Retrieval mode</span>
                <strong>{humanizeSignal(source.retrievalMode ?? source.mode ?? (hasRankingSignals ? 'semantic' : 'direct'))}</strong>
              </div>
              <div className="workspace-studio__source-detail-row">
                <span>Source type</span>
                <strong>{humanizeSignal(source.sourceType ?? citation.sourceType ?? 'source')}</strong>
              </div>
              {!hasRankingSignals ? (
                <div className="workspace-studio__source-detail-row">
                  <span>Selection method</span>
                  <strong>{source.fetchedVia ? `Live web ${humanizeSignal(source.fetchedVia)}` : 'Direct source retrieval'}</strong>
                </div>
              ) : null}
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

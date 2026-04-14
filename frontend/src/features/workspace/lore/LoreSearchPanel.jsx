import { InlineNotice, StatusPill, SurfaceCard, TextInput } from '../../../components/ui';
import { getErrorMessage } from '../../../lib/utils';
import {
  buildExcerpt,
  formatAge,
  formatPercent,
  formatSimilarity,
  getTrustMeta,
} from './loreHelpers';
import { MotionList, MotionListItem } from '../../../components/motion';

function TrustBar({ score }) {
  const pct = Math.round(Math.max(Math.min(Number(score ?? 0), 1), 0) * 100);
  const color = pct >= 90 ? '#18c7a0' : pct >= 75 ? '#4CC9F0' : pct >= 60 ? '#F59E0B' : '#EF4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
      <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'var(--line)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: '10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{pct}%</span>
    </div>
  );
}

export function LoreSearchPanel({
  searchValue,
  onSearchChange,
  debouncedSearch,
  searchQuery,
}) {
  const searchResults = searchQuery.data?.results ?? [];

  return (
    <SurfaceCard accent="#C77DFF" className="workspace-knowledge-panel__search">
      <div className="workspace-knowledge-panel__search-row">
        <div className="workspace-knowledge-panel__search-input">
          <TextInput
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search LORE for indexed knowledge..."
            aria-label="Search LORE"
          />
        </div>
        {debouncedSearch ? (
          <StatusPill color="#4CC9F0">
            {searchQuery.isFetching ? 'Searching...' : `${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`}
          </StatusPill>
        ) : (
          <StatusPill color="#98A2B3">Type to search</StatusPill>
        )}
      </div>

      {searchQuery.isError ? (
        <InlineNotice tone="danger">{getErrorMessage(searchQuery.error)}</InlineNotice>
      ) : null}

      {searchQuery.data?.knowledgeGap ? (
        <InlineNotice tone="warning">
          Prymal could not find strong evidence for this query yet. Uploading a more direct source may improve grounded answers.
        </InlineNotice>
      ) : null}

      {debouncedSearch ? (
        <div className="workspace-knowledge-panel__results">
          {searchResults.length === 0 && !searchQuery.isFetching ? (
            <div className="workspace-knowledge-panel__results-empty">
              No indexed chunks matched this search yet.
            </div>
          ) : (
            <MotionList key={debouncedSearch} staggerChildren={0.04}>
            {searchResults.map((result) => {
              const trustLabel = result.citation?.trustLabel ?? result.metadata?.trustLabel;
              const trustScore = result.citation?.trustScore ?? result.metadata?.trustScore;
              const trustMeta = getTrustMeta(trustLabel);
              const ageLabel = formatAge(result.documentUpdatedAt);
              const isHybrid = result.retrievalMode === 'hybrid';

              return (
                <MotionListItem key={result.id} reveal={{ y: 10, blur: 4 }} className="workspace-knowledge-panel__result-card">
                  <div className="workspace-knowledge-panel__result-head">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3>{result.documentTitle}</h3>
                      <p style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <MetricChip color={trustMeta.color}>{trustMeta.label}</MetricChip>
                        <MetricChip color={isHybrid ? '#8b5cf6' : '#94A3B8'}>{isHybrid ? 'hybrid' : 'semantic'}</MetricChip>
                        <MetricChip color="#4CC9F0">{result.confidenceLabel ?? 'medium'} confidence</MetricChip>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {result.citation?.sourceType ?? result.sourceType ?? 'source'}
                          {result.citation?.chunkIndex != null ? ` | chunk ${result.citation.chunkIndex + 1}` : ''}
                        </span>
                        {ageLabel ? (
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{ageLabel}</span>
                        ) : null}
                        {result.documentVersion > 1 ? (
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>v{result.documentVersion}</span>
                        ) : null}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                      <StatusPill color="#4CC9F0">{formatSimilarity(result.similarity)}</StatusPill>
                      <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                        Rank {formatPercent(result.finalScore)}
                      </span>
                    </div>
                  </div>

                  <p className="workspace-knowledge-panel__result-excerpt">{buildExcerpt(result.content)}</p>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <MetricChip color="#4CC9F0">Authority {formatPercent(result.authorityScore)}</MetricChip>
                    <MetricChip color="#18c7a0">Freshness {formatPercent(result.freshnessScore)}</MetricChip>
                    {result.versionLineage?.isSuperseded ? (
                      <MetricChip color="#F59E0B">Superseded</MetricChip>
                    ) : null}
                    {(result.contradictionSignals ?? []).length > 0 ? (
                      <MetricChip color="#EF4444">
                        {result.contradictionSignals.length} contradiction{result.contradictionSignals.length === 1 ? '' : 's'}
                      </MetricChip>
                    ) : null}
                  </div>

                  {result.staleWarning ? (
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#F59E0B' }}>{result.staleWarning}</div>
                  ) : null}

                  {trustScore != null ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Trust</span>
                      <TrustBar score={trustScore} />
                    </div>
                  ) : null}
                </MotionListItem>
              );
            })}
            </MotionList>
          )}
        </div>
      ) : (
        <div className="workspace-knowledge-panel__results-empty">
          Search across indexed chunks to preview what agents can ground against.
        </div>
      )}
    </SurfaceCard>
  );
}

function MetricChip({ children, color }) {
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: '999px',
        background: `${color}22`,
        color,
      }}
    >
      {children}
    </span>
  );
}

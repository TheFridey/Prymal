import {
  Button,
  EmptyState,
  InlineNotice,
  StatusPill,
  SurfaceCard,
} from '../../../components/ui';
import { LORE_STATUS_META } from '../../../lib/constants';
import { formatDateTime, formatNumber, getErrorMessage, truncate } from '../../../lib/utils';
import { normalizeDocumentSource, SOURCE_BADGE_META } from './loreHelpers';
import { MotionList, MotionListItem, MotionSection } from '../../../components/motion';

export function LoreDocumentInventory({
  loreQuery,
  documents,
  deleteMutation,
}) {
  return (
    <SurfaceCard title="Document inventory" subtitle={`${documents.length} total`} accent="#C77DFF">
      {loreQuery.isError ? (
        <InlineNotice tone="danger">{getErrorMessage(loreQuery.error)}</InlineNotice>
      ) : null}

      {documents.length === 0 && !loreQuery.isLoading ? (
        <MotionSection reveal={{ y: 16, blur: 6 }}>
          <EmptyState
            title="Upload your first source"
            description="Start with pricing notes, product docs, support FAQs, or a high-value page from your site so agent outputs can ground against something real."
            accent="#C77DFF"
          />
        </MotionSection>
      ) : (
        <MotionList className="workspace-knowledge-panel__document-list">
          {documents.map((document) => {
            const statusMeta = LORE_STATUS_META[document.status] ?? LORE_STATUS_META.pending;
            const sourceMeta =
              SOURCE_BADGE_META[normalizeDocumentSource(document.sourceType)] ?? SOURCE_BADGE_META.text;
            const versionMeta = document.metadata ?? {};
            const latestVersion = versionMeta.latestVersion ?? document.version;

            return (
              <MotionListItem key={document.id} className="workspace-knowledge-panel__document-row">
                <div className="workspace-knowledge-panel__document-main">
                  <div className="workspace-knowledge-panel__document-head">
                    <div className="workspace-knowledge-panel__document-title-wrap">
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <h3>{document.title}</h3>
                        {Number(versionMeta.contradictionCount ?? 0) > 0 ? (
                          <StatusPill
                            color="#F59E0B"
                            title={`This document has ${versionMeta.contradictionCount} detected conflict${Number(versionMeta.contradictionCount) !== 1 ? 's' : ''} with other knowledge base entries.`}
                          >
                            {`⚠ ${versionMeta.contradictionCount} conflict${Number(versionMeta.contradictionCount) !== 1 ? 's' : ''}`}
                          </StatusPill>
                        ) : null}
                      </div>
                      <div className="workspace-knowledge-panel__document-meta">
                        <StatusPill color={sourceMeta.color}>{sourceMeta.label}</StatusPill>
                        <span className={`workspace-knowledge-panel__status workspace-knowledge-panel__status--${document.status}`}>
                          <span className="workspace-knowledge-panel__status-dot" />
                          {statusMeta.label}
                        </span>
                        <StatusPill color={versionMeta.isLatestVersion === false ? '#F59E0B' : '#4CC9F0'}>
                          v{document.version}{latestVersion > document.version ? ` of ${latestVersion}` : ''}
                        </StatusPill>
                      </div>
                    </div>
                    <Button
                      tone="ghost"
                      onClick={() => {
                        if (window.confirm(`Delete "${document.title}" and all indexed chunks?`)) {
                          deleteMutation.mutate(document.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>

                  <div className="workspace-knowledge-panel__document-submeta">
                    <span>{document.wordCount ? `${formatNumber(document.wordCount)} words` : 'Word count pending'}</span>
                    <span>Updated {formatDateTime(document.updatedAt)}</span>
                    {document.sourceUrl ? <span title={document.sourceUrl}>{truncate(document.sourceUrl, 80)}</span> : null}
                  </div>

                  {versionMeta.supersedesDocumentId ? (
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                      Supersedes {truncate(versionMeta.supersedesDocumentId, 12)}
                    </div>
                  ) : null}

                  {document.status === 'failed' ? (
                    <InlineNotice tone="danger">
                      Indexing failed for this document. Delete and re-upload, or check that the file contents are parseable text.
                    </InlineNotice>
                  ) : null}
                </div>
              </MotionListItem>
            );
          })}
        </MotionList>
      )}

      {loreQuery.isLoading && documents.length === 0 ? (
        <div className="workspace-knowledge-panel__results-empty">Loading document inventory...</div>
      ) : null}
    </SurfaceCard>
  );
}

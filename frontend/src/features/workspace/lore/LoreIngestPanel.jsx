import {
  Button,
  InlineNotice,
  SurfaceCard,
  TextArea,
  TextInput,
} from '../../../components/ui';
import { getErrorMessage } from '../../../lib/utils';
import { humanizeContradictionType } from './loreHelpers';
import { MotionPresence, MotionSection } from '../../../components/motion';

export function LoreIngestPanel({
  fileInputRef,
  acceptedUploads,
  ingestMode,
  onIngestModeChange,
  ingestDraft,
  onIngestDraftChange,
  onIngestSubmit,
  ingestTextMutation,
  ingestUrlMutation,
  dragActive,
  setDragActive,
  handleDrop,
  handleFiles,
  uploadItems,
  contradictionNotice,
  onDismissContradictionNotice,
}) {
  const hasQueuedUploads = uploadItems.length > 0;
  const visibleContradictions = contradictionNotice?.items?.slice(0, 3) ?? [];
  const ingestError = ingestTextMutation.error ?? ingestUrlMutation.error ?? null;
  const ingestErrorMessage = ingestError?.code === 'RATE_LIMITED'
    ? `You've reached your plan's LORE ingest limit. Upgrade for higher limits, or wait ${ingestError.retryAfter}s.`
    : getErrorMessage(ingestError);

  return (
    <SurfaceCard title="Add knowledge" subtitle="Files, URLs, or pasted text" accent="#00FFD1">
      <div className="workspace-knowledge-panel__ingest-tabs">
        <Button tone={ingestMode === 'url' ? 'accent' : 'ghost'} onClick={() => onIngestModeChange('url')}>
          URL
        </Button>
        <Button tone={ingestMode === 'text' ? 'accent' : 'ghost'} onClick={() => onIngestModeChange('text')}>
          Pasted text
        </Button>
      </div>

      <form className="workspace-knowledge-panel__form" onSubmit={onIngestSubmit}>
        <label className="workspace-modal__field">
          <span>Title</span>
          <TextInput
            value={ingestDraft.title}
            onChange={(event) => onIngestDraftChange({ title: event.target.value })}
            placeholder={ingestMode === 'url' ? 'Optional document title' : 'Document title'}
          />
        </label>

        {ingestMode === 'url' ? (
          <label className="workspace-modal__field workspace-modal__field--full">
            <span>URL</span>
            <TextInput
              type="url"
              value={ingestDraft.url}
              onChange={(event) => onIngestDraftChange({ url: event.target.value })}
              placeholder="https://example.com/knowledge-page"
            />
          </label>
        ) : (
          <label className="workspace-modal__field workspace-modal__field--full">
            <span>Content</span>
            <TextArea
              rows={8}
              value={ingestDraft.content}
              onChange={(event) => onIngestDraftChange({ content: event.target.value })}
              placeholder="Paste support docs, positioning notes, pricing guidance, SOPs, or other useful org knowledge..."
            />
          </label>
        )}

        {ingestError ? (
          <InlineNotice tone="danger">
            {ingestErrorMessage}
          </InlineNotice>
        ) : null}

        <Button
          type="submit"
          tone="accent"
          disabled={
            ingestTextMutation.isPending ||
            ingestUrlMutation.isPending ||
            (ingestMode === 'url'
              ? !ingestDraft.url.trim()
              : !ingestDraft.title.trim() || !ingestDraft.content.trim())
          }
        >
          {ingestTextMutation.isPending || ingestUrlMutation.isPending ? 'Queueing...' : 'Ingest into LORE'}
        </Button>
      </form>

      <MotionPresence initial={false}>
        {contradictionNotice && visibleContradictions.length > 0 ? (
        <MotionSection key="contradiction-notice" reveal={{ y: 12, blur: 6 }}>
        <InlineNotice tone="warning">
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>Potential conflicts detected</div>
                <div style={{ marginTop: '4px' }}>
                  Review the conflicting documents in the knowledge base before relying on this content.
                </div>
              </div>
              <Button type="button" tone="ghost" onClick={onDismissContradictionNotice}>
                Dismiss
              </Button>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              {visibleContradictions.map((entry, index) => (
                <div
                  key={`${entry.existingDocumentId ?? entry.existingDocumentTitle ?? 'conflict'}-${index}`}
                  style={{
                    display: 'grid',
                    gap: '4px',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: '1px solid rgba(245, 158, 11, 0.22)',
                    background: 'rgba(245, 158, 11, 0.08)',
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {entry.existingDocumentTitle || 'Existing document'}
                  </div>
                  <div style={{ fontSize: '12px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                    {humanizeContradictionType(entry.type)}
                  </div>
                  <div style={{ color: 'var(--muted)' }}>{String(entry.excerpt ?? '').slice(0, 120).trim()}{String(entry.excerpt ?? '').length > 120 ? '...' : ''}</div>
                </div>
              ))}
            </div>
          </div>
        </InlineNotice>
        </MotionSection>
        ) : null}
      </MotionPresence>

      <div className="workspace-knowledge-panel__divider" />

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedUploads}
        multiple
        style={{ display: 'none' }}
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <div
        className={`workspace-knowledge-panel__dropzone${dragActive ? ' is-drag-active' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) {
            setDragActive(false);
          }
        }}
        onDrop={handleDrop}
      >
        <div className="workspace-knowledge-panel__drop-copy">
          <strong>Drop files here</strong>
          <p>PDF, DOCX, MD, TXT, and CSV files are parsed and queued for indexing.</p>
        </div>
        <Button tone="ghost" onClick={() => fileInputRef.current?.click()}>
          Choose files
        </Button>
      </div>

      {hasQueuedUploads ? (
        <div className="workspace-knowledge-panel__uploads">
          {uploadItems.map((item) => (
            <div key={item.id} className="workspace-knowledge-panel__upload-row">
              <div className="workspace-knowledge-panel__upload-head">
                <div>
                  <h4>{item.documentTitle ?? item.name}</h4>
                  <p>
                    {item.status === 'uploading'
                      ? `Uploading ${item.progress}%`
                      : item.status === 'queued'
                        ? 'Upload complete | queued for indexing'
                        : 'Upload failed'}
                  </p>
                </div>
                <span className="status-pill" style={{ '--status-pill-color': item.status === 'error' ? '#EF4444' : item.status === 'queued' ? '#18C7A0' : '#4CC9F0' }}>
                  {item.status}
                </span>
              </div>
              {item.status !== 'error' ? (
                <div className="workspace-knowledge-panel__progress">
                  <span style={{ width: `${Math.max(item.progress ?? 0, item.status === 'queued' ? 100 : 6)}%` }} />
                </div>
              ) : null}
              {item.error ? <InlineNotice tone="danger">{item.error}</InlineNotice> : null}
            </div>
          ))}
        </div>
      ) : null}
    </SurfaceCard>
  );
}

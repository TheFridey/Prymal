import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { LORE_STATUS_META } from '../lib/constants';
import { formatDateTime, formatNumber, getErrorMessage, truncate } from '../lib/utils';
import { Button, EmptyState, InlineNotice, PageHeader, PageShell, SectionLabel, StatGrid, StatusPill, SurfaceCard, TextArea, TextInput } from '../components/ui';
import { useAppStore } from '../stores/useAppStore';

export default function Lore() {
  const notify = useAppStore((state) => state.addNotification);
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState('documents');
  const [searchValue, setSearchValue] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [urlValue, setUrlValue] = useState('');
  const [textDraft, setTextDraft] = useState({ title: '', content: '' });

  const loreQuery = useQuery({
    queryKey: ['lore-documents'],
    queryFn: () => api.get('/lore'),
    refetchInterval: (query) => {
      const documents = query.state.data?.documents ?? [];
      return documents.some((document) => ['pending', 'indexing'].includes(document.status)) ? 5000 : false;
    },
  });

  const uploadTextMutation = useMutation({
    mutationFn: (payload) => api.post('/lore/text', payload),
    onSuccess: async (result) => {
      setTextDraft({ title: '', content: '' });
      await queryClient.invalidateQueries({ queryKey: ['lore-documents'] });
      notify({
        type: 'success',
        title: 'Knowledge queued',
        message: result.contradictions?.length ? `Queued with ${result.contradictions.length} contradiction check warnings.` : 'The document is queued for indexing.',
      });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'LORE ingest failed', message: getErrorMessage(error) });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: (file) => {
      const formData = new FormData();
      formData.set('file', file);
      return api.post('/lore/upload', formData);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['lore-documents'] });
      notify({
        type: 'success',
        title: 'File queued',
        message: result.contradictions?.length ? `Queued with ${result.contradictions.length} contradiction check warnings.` : 'The file is queued for indexing.',
      });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Upload failed', message: getErrorMessage(error) });
    },
  });

  const crawlMutation = useMutation({
    mutationFn: (payload) => api.post('/lore/crawl', payload),
    onSuccess: async () => {
      setUrlValue('');
      await queryClient.invalidateQueries({ queryKey: ['lore-documents'] });
      notify({ type: 'success', title: 'URL queued', message: 'The page is being fetched and indexed.' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Crawl failed', message: getErrorMessage(error) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId) => api.delete(`/lore/${documentId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lore-documents'] });
      notify({ type: 'success', title: 'Document removed', message: 'The document and its chunks were deleted.' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Delete failed', message: getErrorMessage(error) });
    },
  });

  const reindexMutation = useMutation({
    mutationFn: (documentId) => api.post(`/lore/${documentId}/reindex`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lore-documents'] });
      notify({ type: 'success', title: 'Re-indexing started', message: 'The stored raw content is being indexed again.' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Re-index failed', message: getErrorMessage(error) });
    },
  });

  const documents = loreQuery.data?.documents ?? [];
  const acceptedUploads = loreQuery.data?.acceptedUploads ?? '.txt,.md,.markdown,.csv,.pdf,.docx';
  const indexedCount = documents.filter((document) => document.status === 'indexed').length;

  const stats = useMemo(
    () => [
      { label: 'Documents', value: formatNumber(documents.length), helper: 'Stored in this organisation', accent: '#C77DFF' },
      { label: 'Indexed', value: formatNumber(indexedCount), helper: 'Ready for retrieval', accent: '#00FFD1' },
      { label: 'Chunks', value: formatNumber(loreQuery.data?.totalChunks ?? 0), helper: 'Embeddings across active documents', accent: '#4CC9F0' },
    ],
    [documents.length, indexedCount, loreQuery.data?.totalChunks],
  );

  async function runSearch() {
    if (!searchValue.trim()) {
      return;
    }

    try {
      const result = await api.get(`/lore/search?q=${encodeURIComponent(searchValue.trim())}&limit=5`);
      setSearchResult(result);
    } catch (error) {
      notify({ type: 'error', title: 'Search failed', message: getErrorMessage(error) });
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="LORE"
        title="Knowledge that the agents can actually retrieve"
        description="The ingest contract now matches the parser layer: upload plain text, markdown, CSV, PDF, and DOCX files, paste manual text, or crawl a URL. Search and chat responses carry source metadata through the stack."
        accent="#C77DFF"
      />

      <StatGrid items={stats} />

      <SurfaceCard accent="#C77DFF" style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['documents', 'add', 'search'].map((entry) => (
            <Button key={entry} tone={tab === entry ? 'accent' : 'ghost'} onClick={() => setTab(entry)}>
              {entry}
            </Button>
          ))}
        </div>
      </SurfaceCard>

      {tab === 'documents' ? (
        <SurfaceCard title="Document inventory" subtitle={`${documents.length} total`} accent="#C77DFF">
          {documents.length === 0 ? (
            <EmptyState
              title="LORE is empty"
              description="Add your best source material first: pricing notes, product documentation, onboarding docs, positioning, or support knowledge."
              accent="#C77DFF"
            />
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {documents.map((document) => {
                const status = LORE_STATUS_META[document.status] ?? LORE_STATUS_META.pending;
                return (
                  <div key={document.id} style={{ display: 'grid', gap: '10px', padding: '16px', borderRadius: '16px', border: '1px solid var(--line)', background: 'var(--panel-soft)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'start', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '16px', marginBottom: '6px' }}>{document.title}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.7 }}>
                          {document.sourceType} · {document.wordCount ? `${formatNumber(document.wordCount)} words` : 'Word count pending'} · version {document.version}
                          {document.status === 'indexed' && document.updatedAt ? ` · indexed ${formatDateTime(document.updatedAt)}` : ''}
                        </div>
                        {document.sourceUrl ? (
                          <a href={document.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#C77DFF', fontSize: '12px' }}>
                            {truncate(document.sourceUrl, 84)}
                          </a>
                        ) : null}
                      </div>
                      <StatusPill color={status.color}>{status.label}</StatusPill>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {document.rawContent ? (
                        <Button tone="ghost" onClick={() => reindexMutation.mutate(document.id)} disabled={reindexMutation.isPending}>
                          Re-index
                        </Button>
                      ) : null}
                      <Button
                        tone="danger"
                        onClick={() => {
                          if (window.confirm(`Delete "${document.title}"? This cannot be undone.`)) {
                            deleteMutation.mutate(document.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SurfaceCard>
      ) : null}

      {tab === 'add' ? (
        <div style={{ display: 'grid', gap: '14px' }}>
          <SurfaceCard title="Paste knowledge" accent="#C77DFF">
            <div style={{ display: 'grid', gap: '10px' }}>
              <TextInput
                value={textDraft.title}
                onChange={(event) => setTextDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Document title"
              />
              <TextArea
                rows={10}
                value={textDraft.content}
                onChange={(event) => setTextDraft((current) => ({ ...current, content: event.target.value }))}
                placeholder="Paste brand, product, policy, or support context..."
              />
              <Button tone="accent" onClick={() => uploadTextMutation.mutate({ ...textDraft, sourceType: 'manual' })} disabled={!textDraft.title.trim() || !textDraft.content.trim() || uploadTextMutation.isPending}>
                {uploadTextMutation.isPending ? 'Queueing' : 'Add to LORE'}
              </Button>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Upload files" accent="#4CC9F0">
            <SectionLabel>Accepted today</SectionLabel>
            <InlineNotice tone="default">Supported file types: {acceptedUploads}. Uploaded PDFs and DOCX files are parsed into retrievable text before indexing.</InlineNotice>
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedUploads}
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  uploadFileMutation.mutate(file);
                }
                event.target.value = '';
              }}
            />
            <div style={{ marginTop: '14px' }}>
              <Button tone="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploadFileMutation.isPending}>
                {uploadFileMutation.isPending ? 'Uploading' : 'Choose file'}
              </Button>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Crawl a URL" accent="#00FFD1">
            <div style={{ display: 'grid', gap: '10px' }}>
              <TextInput value={urlValue} onChange={(event) => setUrlValue(event.target.value)} placeholder="https://example.com/knowledge-page" />
              <Button tone="ghost" onClick={() => crawlMutation.mutate({ url: urlValue.trim() })} disabled={!urlValue.trim() || crawlMutation.isPending}>
                {crawlMutation.isPending ? 'Fetching' : 'Queue URL crawl'}
              </Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {tab === 'search' ? (
        <SurfaceCard title="Search LORE" accent="#C77DFF">
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <TextInput
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    runSearch();
                  }
                }}
                placeholder="Ask a question about your org knowledge..."
              />
            </div>
            <Button tone="accent" onClick={runSearch}>
              Search
            </Button>
          </div>

          {searchResult?.knowledgeGap ? (
            <InlineNotice tone="warning">LORE did not find strong evidence for this query. Consider uploading a document that covers the missing topic more directly.</InlineNotice>
          ) : null}

          <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
            {searchResult?.results?.map((result) => (
              <div key={result.id} style={{ padding: '16px', borderRadius: '16px', border: '1px solid var(--line)', background: 'var(--panel-soft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <div style={{ color: '#C77DFF', fontSize: '13px' }}>{result.documentTitle}</div>
                  <StatusPill color="#4CC9F0">{Math.round((result.similarity ?? 0) * 100)}% match</StatusPill>
                </div>
                <div style={{ color: 'var(--text-strong)', lineHeight: 1.9 }}>{result.content}</div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}
    </PageShell>
  );
}

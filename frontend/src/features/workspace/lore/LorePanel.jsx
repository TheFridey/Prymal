import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { formatNumber, getErrorMessage } from '../../../lib/utils';
import { SurfaceCard } from '../../../components/ui';
import { LoreDocumentInventory } from './LoreDocumentInventory';
import { LoreIngestPanel } from './LoreIngestPanel';
import { LoreSearchPanel } from './LoreSearchPanel';
import { nextUploadId } from './loreHelpers';

export default function LorePanel() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [ingestMode, setIngestMode] = useState('url');
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadItems, setUploadItems] = useState([]);
  const [contradictionNotice, setContradictionNotice] = useState(null);
  const [ingestDraft, setIngestDraft] = useState({
    title: '',
    url: '',
    content: '',
  });

  const loreQuery = useQuery({
    queryKey: ['workspace-lore-documents'],
    queryFn: () => api.get('/lore'),
    refetchInterval: (query) => {
      const documents = query.state.data?.documents ?? [];
      return documents.some((document) => ['pending', 'indexing'].includes(document.status)) ? 5000 : false;
    },
  });

  const documents = loreQuery.data?.documents ?? [];
  const acceptedUploads = loreQuery.data?.acceptedUploads ?? '.txt,.md,.markdown,.csv,.pdf,.docx';

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchValue]);

  useEffect(() => {
    if (uploadItems.length === 0 || documents.length === 0) {
      return;
    }

    setUploadItems((current) =>
      current.filter((item) => {
        if (!item.documentId || item.status === 'error') {
          return true;
        }

        return !documents.some((document) => document.id === item.documentId);
      }),
    );
  }, [documents, uploadItems.length]);

  const searchQuery = useQuery({
    queryKey: ['workspace-lore-search', debouncedSearch],
    queryFn: () => api.get(`/lore/search?q=${encodeURIComponent(debouncedSearch)}&limit=6`),
    enabled: debouncedSearch.length > 1,
  });

  const ingestTextMutation = useMutation({
    mutationFn: (payload) => api.post('/lore/text', payload),
    onSuccess: async (result) => {
      setIngestDraft((current) => ({ ...current, title: '', content: '' }));
      setContradictionNotice((result?.contradictions?.length ?? 0) > 0 ? {
        items: result.contradictions,
        source: 'text',
      } : null);
      await queryClient.invalidateQueries({ queryKey: ['workspace-lore-documents'] });
    },
  });

  const ingestUrlMutation = useMutation({
    mutationFn: (payload) => api.post('/lore/crawl', payload),
    onSuccess: async (result) => {
      setIngestDraft((current) => ({ ...current, title: '', url: '' }));
      setContradictionNotice((result?.contradictions?.length ?? 0) > 0 ? {
        items: result.contradictions,
        source: 'url',
      } : null);
      await queryClient.invalidateQueries({ queryKey: ['workspace-lore-documents'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId) => api.delete(`/lore/${documentId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace-lore-documents'] });
    },
  });

  const sourceSummary = useMemo(() => {
    const totalWords = documents.reduce((sum, document) => sum + Number(document.wordCount ?? 0), 0);
    return {
      documents: documents.length,
      indexed: documents.filter((document) => document.status === 'indexed').length,
      totalWords,
    };
  }, [documents]);

  async function handleFiles(fileList) {
    const files = Array.from(fileList ?? []);

    for (const file of files) {
      const localId = nextUploadId();
      setUploadItems((current) => [
        {
          id: localId,
          name: file.name,
          status: 'uploading',
          progress: 0,
          error: null,
          documentId: null,
        },
        ...current,
      ]);

      const formData = new FormData();
      formData.set('file', file);

      try {
        const result = await api.upload('/lore/upload', formData, {
          timeoutMs: 30_000,
          onProgress: ({ percent }) => {
            setUploadItems((current) =>
              current.map((item) =>
                item.id === localId
                  ? {
                      ...item,
                      progress: percent ?? item.progress,
                    }
                  : item,
              ),
            );
          },
        });

        setUploadItems((current) =>
          current.map((item) =>
            item.id === localId
              ? {
                  ...item,
                  status: 'queued',
                  progress: 100,
                  documentId: result.document?.id ?? null,
                  documentTitle: result.document?.title ?? file.name,
                }
              : item,
          ),
        );
        setContradictionNotice((result?.contradictions?.length ?? 0) > 0 ? {
          items: result.contradictions,
          source: 'file',
        } : null);

        await queryClient.invalidateQueries({ queryKey: ['workspace-lore-documents'] });
      } catch (error) {
        setUploadItems((current) =>
          current.map((item) =>
            item.id === localId
              ? {
                  ...item,
                  status: 'error',
                  error: getErrorMessage(error),
                }
              : item,
          ),
        );
      }
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    void handleFiles(event.dataTransfer?.files);
  }

  function handleIngestSubmit(event) {
    event.preventDefault();

    if (ingestMode === 'text') {
      ingestTextMutation.mutate({
        title: ingestDraft.title.trim(),
        content: ingestDraft.content.trim(),
        sourceType: 'manual',
      });
      return;
    }

    ingestUrlMutation.mutate({
      title: ingestDraft.title.trim() || undefined,
      url: ingestDraft.url.trim(),
    });
  }

  function updateIngestDraft(patch) {
    setIngestDraft((current) => ({
      ...current,
      ...patch,
    }));
  }

  return (
    <div className="workspace-knowledge-panel">
      <div className="workspace-panel__header">
        <div>
          <div className="workspace-modal__eyebrow">LORE</div>
          <h2 className="workspace-modal__title">Organisation knowledge base</h2>
          <p className="workspace-panel__copy">
            Upload source material, ingest URLs or pasted text, and search indexed chunks before they surface in agent runs.
          </p>
        </div>
        <div className="workspace-knowledge-panel__stats">
          <div className="workspace-knowledge-panel__stat">
            <span>Docs</span>
            <strong>{formatNumber(sourceSummary.documents)}</strong>
          </div>
          <div className="workspace-knowledge-panel__stat">
            <span>Indexed</span>
            <strong>{formatNumber(sourceSummary.indexed)}</strong>
          </div>
          <div className="workspace-knowledge-panel__stat">
            <span>Words</span>
            <strong>{formatNumber(sourceSummary.totalWords)}</strong>
          </div>
        </div>
      </div>

      <LoreSearchPanel
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        debouncedSearch={debouncedSearch}
        searchQuery={searchQuery}
      />

      <div className="workspace-knowledge-panel__grid">
        <LoreIngestPanel
          fileInputRef={fileInputRef}
          acceptedUploads={acceptedUploads}
          ingestMode={ingestMode}
          onIngestModeChange={setIngestMode}
          ingestDraft={ingestDraft}
          onIngestDraftChange={updateIngestDraft}
          onIngestSubmit={handleIngestSubmit}
          ingestTextMutation={ingestTextMutation}
          ingestUrlMutation={ingestUrlMutation}
          dragActive={dragActive}
          setDragActive={setDragActive}
          handleDrop={handleDrop}
          handleFiles={handleFiles}
          uploadItems={uploadItems}
          contradictionNotice={contradictionNotice}
          onDismissContradictionNotice={() => setContradictionNotice(null)}
        />

        <LoreDocumentInventory
          loreQuery={loreQuery}
          documents={documents}
          deleteMutation={deleteMutation}
        />
      </div>

      <SurfaceCard accent="#4CC9F0">
        <div style={{ color: 'var(--muted)', fontSize: '12px', lineHeight: 1.7 }}>
          Retrieval diagnostics now include ranking, freshness, authority, contradiction, and version lineage signals so operators can see why a source was trusted or down-ranked.
        </div>
      </SurfaceCard>
    </div>
  );
}

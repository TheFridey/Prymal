import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatDateTime, getErrorMessage } from '../lib/utils';
import {
  Button,
  EmptyState,
  InlineNotice,
  PageHeader,
  PageShell,
  SectionLabel,
  SurfaceCard,
  TextInput,
} from '../components/ui';
import { useAppStore } from '../stores/useAppStore';
import '../styles/memory-page.css';

function memoryBool(row, camel, snake) {
  if (!row) return false;
  const a = row[camel];
  if (typeof a === 'boolean') return a;
  const b = row[snake];
  if (typeof b === 'boolean') return b;
  return Boolean(a ?? b);
}

export default function Memory() {
  const notify = useAppStore((state) => state.addNotification);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('centre');
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const memoryQuery = useQuery({
    queryKey: ['memory-centre', scope, q],
    queryFn: () => {
      const params = new URLSearchParams();
      if (scope) params.set('scope', scope);
      if (q.trim()) params.set('q', q.trim());
      const suffix = params.toString();
      return api.get(`/memory${suffix ? `?${suffix}` : ''}`);
    },
    retry: false,
  });

  const explainQuery = useQuery({
    queryKey: ['memory-explain', selectedId],
    queryFn: () => api.get(`/memory/${selectedId}/explain`),
    enabled: Boolean(selectedId),
  });

  const capsQuery = useQuery({
    queryKey: ['memory-caps-stats'],
    queryFn: () => api.get('/memory/caps-stats'),
    retry: false,
  });

  const timelineQuery = useQuery({
    queryKey: ['memory-timeline'],
    queryFn: () => api.get('/memory/timeline'),
    enabled: tab === 'timeline',
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/memory/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['memory-centre'] });
      notify({ type: 'success', title: 'Forgotten', message: 'Memory entry removed.' });
    },
    onError: (error) => notify({ type: 'error', title: 'Delete failed', message: getErrorMessage(error) }),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/memory/${id}`, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['memory-centre'] });
      await queryClient.invalidateQueries({ queryKey: ['memory-explain', selectedId] });
      notify({ type: 'success', title: 'Updated', message: 'Memory settings saved.' });
    },
    onError: (error) => notify({ type: 'error', title: 'Update failed', message: getErrorMessage(error) }),
  });

  const rows = memoryQuery.data?.memory ?? [];

  const selectedRow = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const groupedTimeline = useMemo(() => timelineQuery.data?.grouped ?? [], [timelineQuery.data]);

  return (
    <PageShell className="memory-page">
      <PageHeader
        eyebrow="Workspace"
        title="Memory Centre"
        description="Structured preferences, facts, and episodic timeline — scoped, sourced, and reviewable."
      />

      <div className="memory-page__tabs">
        <button type="button" className={tab === 'centre' ? 'is-active' : ''} onClick={() => setTab('centre')}>
          Memories
        </button>
        <button type="button" className={tab === 'timeline' ? 'is-active' : ''} onClick={() => setTab('timeline')}>
          Timeline
        </button>
      </div>

      {memoryQuery.isError ? (
        <InlineNotice tone="danger" title="Could not load memories" message={getErrorMessage(memoryQuery.error)} />
      ) : null}

      {tab === 'centre' ? (
        <div className="memory-page__layout">
          <SurfaceCard className="memory-page__filters">
            <SectionLabel>Filters</SectionLabel>
            <SectionLabel>Search</SectionLabel>
            <TextInput value={q} onChange={(event) => setQ(event.target.value)} placeholder="Key, value, title..." />
            {capsQuery.data?.counts ? (
              <p className="memory-page__muted">
                User preferences stored: {capsQuery.data.counts.user_preference ?? 0} /{' '}
                {capsQuery.data.caps?.user_preference?.hard ?? 50} (hard cap)
              </p>
            ) : null}
            <label className="memory-page__select-label">
              Scope
              <select value={scope} onChange={(event) => setScope(event.target.value)}>
                <option value="">All visible</option>
                <option value="org">Organisation</option>
                <option value="user">User</option>
                <option value="workflow_run">Workflow run</option>
                <option value="temporary_session">Session</option>
              </select>
            </label>
          </SurfaceCard>

          <SurfaceCard className="memory-page__list">
            {rows.length === 0 ? (
              <EmptyState
                title="No memories visible yet"
                description="Memory appears when Prymal learns durable preferences, facts, and workflow context. You can review, edit, lock, or forget memory at any time from here."
              />
            ) : (
              <ul className="memory-page__items">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`memory-page__item ${selectedId === row.id ? 'is-selected' : ''}`}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <div className="memory-page__item-title">{row.title ?? row.key}</div>
                      <div className="memory-page__meta">
                        <span className="memory-page__badge">{row.scope}</span>
                        <span className="memory-page__badge">{row.memory_type ?? row.memoryType}</span>
                        <span className="memory-page__muted">{formatDateTime(row.updated_at ?? row.updatedAt)}</span>
                      </div>
                      <p className="memory-page__value">{row.value}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>

          <SurfaceCard className="memory-page__detail">
            <SectionLabel>Why am I seeing this?</SectionLabel>
            {selectedRow ? (
              <div className="memory-page__retention">
                <SectionLabel>Retention & retrieval</SectionLabel>
                <p className="memory-page__muted">
                  Tune how this memory is ranked and whether automation can change it.
                </p>
                <div className="memory-page__retention-actions">
                  <Button
                    type="button"
                    tone={memoryBool(selectedRow, 'alwaysInclude', 'always_include') ? 'primary' : 'ghost'}
                    disabled={patchMutation.isPending}
                    onClick={() =>
                      patchMutation.mutate({
                        id: selectedId,
                        body: {
                          alwaysInclude: !memoryBool(selectedRow, 'alwaysInclude', 'always_include'),
                        },
                      })
                    }
                  >
                    {memoryBool(selectedRow, 'alwaysInclude', 'always_include') ? 'Always include · on' : 'Always include'}
                  </Button>
                  <Button
                    type="button"
                    tone={memoryBool(selectedRow, 'neverForget', 'never_forget') ? 'primary' : 'ghost'}
                    disabled={patchMutation.isPending}
                    onClick={() =>
                      patchMutation.mutate({
                        id: selectedId,
                        body: {
                          neverForget: !memoryBool(selectedRow, 'neverForget', 'never_forget'),
                        },
                      })
                    }
                  >
                    {memoryBool(selectedRow, 'neverForget', 'never_forget') ? 'Never forget · on' : 'Never forget'}
                  </Button>
                  <Button
                    type="button"
                    tone={memoryBool(selectedRow, 'userLocked', 'user_locked') ? 'primary' : 'ghost'}
                    disabled={patchMutation.isPending}
                    onClick={() =>
                      patchMutation.mutate({
                        id: selectedId,
                        body: {
                          userLocked: !memoryBool(selectedRow, 'userLocked', 'user_locked'),
                        },
                      })
                    }
                  >
                    {memoryBool(selectedRow, 'userLocked', 'user_locked') ? 'Locked · on' : 'Lock edits'}
                  </Button>
                </div>
              </div>
            ) : null}
            {explainQuery.data ? (
              <div className="memory-page__explain">
                <p>{explainQuery.data.answer}</p>
                <dl>
                  <dt>Confidence</dt>
                  <dd>{explainQuery.data.confidenceScore?.toFixed?.(2) ?? explainQuery.data.confidenceScore}</dd>
                  <dt>Source kind</dt>
                  <dd>{explainQuery.data.sourceType}</dd>
                  <dt>Scope</dt>
                  <dd>{explainQuery.data.scope}</dd>
                </dl>
                {explainQuery.data.canDelete ? (
                  <Button
                    type="button"
                    tone="danger"
                    onClick={() => selectedId && deleteMutation.mutate(selectedId)}
                    disabled={deleteMutation.isPending}
                  >
                    Forget this memory
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="memory-page__muted">Select a memory to load explanation metadata.</p>
            )}
          </SurfaceCard>
        </div>
      ) : (
        <SurfaceCard>
          {timelineQuery.isLoading ? (
            <p className="memory-page__muted">Loading timeline…</p>
          ) : groupedTimeline.length === 0 ? (
            <EmptyState title="No timeline events yet" body="Agent actions and memory milestones will appear here." />
          ) : (
            groupedTimeline.map(([day, items]) => (
              <div key={day} className="memory-page__day">
                <h3>{day}</h3>
                <ul>
                  {items.map((ev) => (
                    <li key={ev.id}>
                      <strong>{ev.title}</strong>
                      <span className="memory-page__muted"> · {ev.event_type ?? ev.eventType}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </SurfaceCard>
      )}
    </PageShell>
  );
}

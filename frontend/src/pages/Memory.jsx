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

function getMemoryMetadata(row) {
  return row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
}

function getContextGroup(row) {
  const metadata = getMemoryMetadata(row);
  if (metadata.contextLayer === 'global') return 'global';
  if (metadata.contextLayer === 'agent') return 'agent';
  if (metadata.contextLayer === 'project') return 'project';
  return 'other';
}

function getContextHeading(group) {
  if (group === 'global') return 'Global Context';
  if (group === 'agent') return 'Agent Context';
  if (group === 'project') return 'Project Context';
  return 'Other Memory';
}

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

  const intelligenceQuery = useQuery({
    queryKey: ['memory-intelligence'],
    queryFn: () => api.get('/memory/intelligence'),
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
  const groupedRows = useMemo(() => {
    const groups = {
      global: [],
      agent: [],
      project: [],
      other: [],
    };

    rows.forEach((row) => {
      groups[getContextGroup(row)].push(row);
    });

    return groups;
  }, [rows]);

  const groupedTimeline = useMemo(() => timelineQuery.data?.grouped ?? [], [timelineQuery.data]);
  const selectedMeta = getMemoryMetadata(selectedRow);
  const selectedConfidence = Number(selectedRow?.confidence ?? 0);

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
                User preferences stored: {capsQuery.data.counts.user_preference ?? 0}. Usage is managed per your current plan.
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
              <div style={{ display: 'grid', gap: '18px' }}>
                {['global', 'agent', 'project', 'other'].map((group) => (
                  groupedRows[group].length > 0 ? (
                    <section key={group} style={{ display: 'grid', gap: '8px' }}>
                      <SectionLabel>{getContextHeading(group)}</SectionLabel>
                      <ul className="memory-page__items">
                        {groupedRows[group].map((row) => {
                          const metadata = getMemoryMetadata(row);
                          const confidencePct = Math.round(Math.max(Math.min(Number(row.confidence ?? 0), 1), 0) * 100);
                          const contradictionDetected = Boolean(row.contradictionDetected ?? row.contradiction_detected);
                          const retrievalStatus = row.retrievalStatus ?? row.retrieval_status ?? 'active';
                          return (
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
                                  {metadata.targetAgentId ? (
                                    <span className="memory-page__badge">{metadata.targetAgentId}</span>
                                  ) : null}
                                  {metadata.projectName ? (
                                    <span className="memory-page__badge">{metadata.projectName}</span>
                                  ) : null}
                                  {metadata.sourceConversationId ? (
                                    <span className="memory-page__badge">conversation</span>
                                  ) : null}
                                  <span className="memory-page__badge">{retrievalStatus}</span>
                                  {contradictionDetected ? (
                                    <span className="memory-page__badge">needs review</span>
                                  ) : null}
                                  <span className="memory-page__muted">{formatDateTime(row.updated_at ?? row.updatedAt)}</span>
                                </div>
                                <p className="memory-page__value">{row.value}</p>
                                {Number.isFinite(confidencePct) ? (
                                  <div className="memory-page__muted" style={{ fontSize: '12px' }}>
                                    Confidence {confidencePct}%
                                  </div>
                                ) : null}
                                {row.lastConfirmedAt || row.last_confirmed_at ? (
                                  <div className="memory-page__muted" style={{ fontSize: '12px' }}>
                                    Last confirmed {formatDateTime(row.lastConfirmedAt ?? row.last_confirmed_at)}
                                  </div>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ) : null
                ))}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard className="memory-page__detail">
            <SectionLabel>Why am I seeing this?</SectionLabel>
            {intelligenceQuery.data?.overview ? (
              <div className="memory-page__retention">
                <SectionLabel>Business profile confidence</SectionLabel>
                <p className="memory-page__muted">
                  {intelligenceQuery.data.overview.safeSummary}
                </p>
                <div className="memory-page__meta">
                  <span className="memory-page__badge">{intelligenceQuery.data.overview.confidenceLevel}</span>
                  <span className="memory-page__badge">{intelligenceQuery.data.overview.staleFactsCount} stale</span>
                  <span className="memory-page__badge">{intelligenceQuery.data.overview.contradictionsCount} contradictions</span>
                  <span className="memory-page__badge">{intelligenceQuery.data.overview.activeProjectsCount} active projects</span>
                </div>
                {intelligenceQuery.data.overview.topMissingContext?.length ? (
                  <p className="memory-page__muted">
                    Missing context: {intelligenceQuery.data.overview.topMissingContext.map((entry) => entry.label).join(', ')}.
                  </p>
                ) : null}
              </div>
            ) : null}
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
                  {selectedMeta.contextLayer ? (
                    <>
                      <dt>Context layer</dt>
                      <dd>
                        {selectedMeta.contextLayer === 'global'
                          ? 'Global Context'
                          : selectedMeta.contextLayer === 'agent'
                            ? 'Agent Context'
                            : selectedMeta.contextLayer === 'project'
                              ? 'Project Context'
                              : selectedMeta.contextLayer}
                      </dd>
                    </>
                  ) : null}
                  {selectedMeta.targetAgentId ? (
                    <>
                      <dt>Agent context</dt>
                      <dd>{selectedMeta.targetAgentId}</dd>
                    </>
                  ) : null}
                  {selectedMeta.sourceConversationId ? (
                    <>
                      <dt>Source conversation</dt>
                      <dd>{selectedMeta.sourceConversationId}</dd>
                    </>
                  ) : null}
                  {selectedMeta.sourceAgentId ? (
                    <>
                      <dt>Source agent</dt>
                      <dd>{selectedMeta.sourceAgentId}</dd>
                    </>
                  ) : null}
                  {selectedMeta.generatedBy ? (
                    <>
                      <dt>Generated by</dt>
                      <dd>{selectedMeta.generatedBy}</dd>
                    </>
                  ) : null}
                  {selectedMeta.sensitivity ? (
                    <>
                      <dt>Sensitivity</dt>
                      <dd>{selectedMeta.sensitivity}</dd>
                    </>
                  ) : null}
                  {selectedMeta.projectName ? (
                    <>
                      <dt>Project</dt>
                      <dd>{selectedMeta.projectName}</dd>
                    </>
                  ) : null}
                  {selectedMeta.projectStatus ? (
                    <>
                      <dt>Project status</dt>
                      <dd>{selectedMeta.projectStatus}</dd>
                    </>
                  ) : null}
                  {selectedRow?.lastSeenAt || selectedRow?.last_seen_at ? (
                    <>
                      <dt>Last seen</dt>
                      <dd>{formatDateTime(selectedRow.lastSeenAt ?? selectedRow.last_seen_at)}</dd>
                    </>
                  ) : null}
                  {selectedRow?.lastConfirmedAt || selectedRow?.last_confirmed_at ? (
                    <>
                      <dt>Last confirmed</dt>
                      <dd>{formatDateTime(selectedRow.lastConfirmedAt ?? selectedRow.last_confirmed_at)}</dd>
                    </>
                  ) : null}
                  {selectedRow?.supersededAt || selectedRow?.superseded_at ? (
                    <>
                      <dt>Superseded</dt>
                      <dd>{formatDateTime(selectedRow.supersededAt ?? selectedRow.superseded_at)}</dd>
                    </>
                  ) : null}
                  {selectedRow?.decayReason ? (
                    <>
                      <dt>Staleness signal</dt>
                      <dd>{selectedRow.decayReason}</dd>
                    </>
                  ) : null}
                  {selectedRow?.contradictionDetected || selectedRow?.contradiction_detected ? (
                    <>
                      <dt>Review status</dt>
                      <dd>A recent contradiction or context change needs review.</dd>
                    </>
                  ) : null}
                  {selectedConfidence > 0 ? (
                    <>
                      <dt>Confidence score</dt>
                      <dd>{selectedConfidence.toFixed(2)}</dd>
                    </>
                  ) : null}
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

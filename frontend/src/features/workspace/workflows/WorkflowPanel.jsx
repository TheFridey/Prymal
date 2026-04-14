import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { formatDateTime, formatNumber, getErrorMessage, truncate } from '../../../lib/utils';
import {
  Button,
  EmptyState,
  InlineNotice,
  LoadingPanel,
  SectionLabel,
  StatusPill,
  SurfaceCard,
} from '../../../components/ui';
import { MotionList, MotionListItem, MotionModal, MotionPresence, MotionSection } from '../../../components/motion';

const WorkflowBuilder = lazy(() => import('../../../pages/WorkflowBuilder'));
const WebhookSubscriptionsPanel = lazy(() => import('./WebhookSubscriptionsPanel'));

const TRIGGER_META = {
  manual: { label: 'manual', color: '#4CC9F0' },
  schedule: { label: 'schedule', color: '#C77DFF' },
  webhook: { label: 'webhook', color: '#FF9F1C' },
  event: { label: 'event', color: '#00FFD1' },
};

const RUN_STATUS_META = {
  queued: { label: 'Queued', color: '#98A2B3' },
  running: { label: 'Running', color: '#F59E0B' },
  completed: { label: 'Completed', color: '#18C7A0' },
  failed: { label: 'Failed', color: '#EF4444' },
  cancelled: { label: 'Cancelled', color: '#64748B' },
};

function formatDuration(startedAt, completedAt) {
  if (!startedAt || !completedAt) {
    return 'In progress';
  }

  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return 'Complete';
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

function summarizeRunEntry(entry) {
  const metadata = entry.metadata ?? {};
  const parts = [];

  if (metadata.nodeId) {
    parts.push(`Node ${metadata.nodeId}`);
  }

  if (metadata.agentId) {
    parts.push(`Agent ${metadata.agentId}`);
  }

  if (metadata.outputVar) {
    parts.push(`Output ${metadata.outputVar}`);
  }

  if (metadata.totalTokens) {
    parts.push(`${formatNumber(metadata.totalTokens)} tokens`);
  }

  if (metadata.creditsUsed) {
    parts.push(`${formatNumber(metadata.creditsUsed)} credits`);
  }

  return parts.join(' · ');
}

export default function WorkflowPanel() {
  const queryClient = useQueryClient();
  const [expandedWorkflowId, setExpandedWorkflowId] = useState(null);
  const [expandedWebhookPanels, setExpandedWebhookPanels] = useState({});
  const [logRun, setLogRun] = useState(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const workflowsQuery = useQuery({
    queryKey: ['workspace-workflows'],
    queryFn: () => api.get('/workflows'),
  });

  const workflows = workflowsQuery.data?.workflows ?? [];

  const webhooksQuery = useQuery({
    queryKey: ['workflow-webhooks'],
    queryFn: () => api.get('/workflows/webhooks'),
    enabled: workflows.length > 0,
  });

  useEffect(() => {
    if (expandedWorkflowId && !workflows.some((workflow) => workflow.id === expandedWorkflowId)) {
      setExpandedWorkflowId(null);
    }
  }, [expandedWorkflowId, workflows]);

  const runsQuery = useQuery({
    queryKey: ['workspace-workflow-runs', expandedWorkflowId],
    queryFn: () => api.get(`/workflows/${expandedWorkflowId}/runs`),
    enabled: Boolean(expandedWorkflowId),
    refetchInterval: (query) => {
      const runs = query.state.data?.runs ?? [];
      return runs.some((run) => ['queued', 'running'].includes(run.status)) ? 3000 : false;
    },
  });

  const expandedRuns = runsQuery.data?.runs?.slice(0, 10) ?? [];

  const workflowSummary = useMemo(
    () => ({
      total: workflows.length,
      enabled: workflows.filter((workflow) => workflow.enabled ?? workflow.isActive).length,
      live: workflows.filter((workflow) => ['queued', 'running'].includes(workflow.lastRunStatus)).length,
    }),
    [workflows],
  );

  const runMutation = useMutation({
    mutationFn: (workflowId) =>
      api.post(`/workflows/${workflowId}/run`, null, {
        headers: {
          'Idempotency-Key': `workspace-manual-${workflowId}-${Date.now()}`,
        },
      }),
    onSuccess: async (_, workflowId) => {
      setExpandedWorkflowId(workflowId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspace-workflows'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-workflow-runs', workflowId] }),
      ]);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (workflowId) => api.patch(`/workflows/${workflowId}/toggle`),
    onSuccess: async (_, workflowId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspace-workflows'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-workflow-runs', workflowId] }),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (workflowId) => api.delete(`/workflows/${workflowId}`),
    onSuccess: async (_, workflowId) => {
      if (expandedWorkflowId === workflowId) {
        setExpandedWorkflowId(null);
      }
      await queryClient.invalidateQueries({ queryKey: ['workspace-workflows'] });
    },
  });

  const webhookCountByWorkflow = useMemo(() => {
    const counts = {};

    for (const webhook of webhooksQuery.data?.webhooks ?? []) {
      if (webhook.workflowId) {
        counts[webhook.workflowId] = (counts[webhook.workflowId] ?? 0) + 1;
      }
    }

    return counts;
  }, [webhooksQuery.data]);

  const relevantWebhookCountByWorkflowId = useMemo(() => {
    const counts = {};
    const allWebhooks = webhooksQuery.data?.webhooks ?? [];
    const orgWideCount = allWebhooks.filter((webhook) => webhook.workflowId == null).length;

    for (const workflow of workflows) {
      counts[workflow.id] = orgWideCount;
    }

    for (const webhook of allWebhooks) {
      if (webhook.workflowId) {
        counts[webhook.workflowId] = (counts[webhook.workflowId] ?? orgWideCount) + 1;
      }
    }

    return counts;
  }, [webhooksQuery.data?.webhooks, workflows]);

  return (
    <>
      <div className="workspace-workflow-panel">
        <div className="workspace-panel__header">
          <div>
            <div className="workspace-modal__eyebrow">NEXUS</div>
            <h2 className="workspace-modal__title">Workflow operations</h2>
            <p className="workspace-panel__copy">
              Monitor workflow status, trigger manual runs, inspect execution history, and open the builder when a new automation is needed.
            </p>
          </div>
          <div className="workspace-workflow-panel__stats">
            <div className="workspace-workflow-panel__stat">
              <span>Total</span>
              <strong>{formatNumber(workflowSummary.total)}</strong>
            </div>
            <div className="workspace-workflow-panel__stat">
              <span>Enabled</span>
              <strong>{formatNumber(workflowSummary.enabled)}</strong>
            </div>
            <div className="workspace-workflow-panel__stat">
              <span>Live</span>
              <strong>{formatNumber(workflowSummary.live)}</strong>
            </div>
          </div>
        </div>

        <SurfaceCard
          title="Workflow inventory"
          subtitle={`${workflows.length} configured`}
          accent="#F72585"
          className="workspace-workflow-panel__surface"
        >
          <div className="workspace-workflow-panel__actions">
            <Button tone="accent" onClick={() => setBuilderOpen(true)}>
              Open workflow builder
            </Button>
          </div>

          {workflowsQuery.isError ? (
            <InlineNotice tone="danger">{getErrorMessage(workflowsQuery.error)}</InlineNotice>
          ) : null}

          {workflows.length === 0 && !workflowsQuery.isLoading ? (
            <MotionSection reveal={{ y: 20, blur: 8 }}>
              <EmptyState
                title="No workflows yet"
                description="Create a first workflow in the builder, then manage runs and logs from this panel without leaving the workspace."
                accent="#F72585"
                action={
                  <Button tone="accent" onClick={() => setBuilderOpen(true)}>
                    Open WorkflowBuilder
                  </Button>
                }
              />
            </MotionSection>
          ) : (
            <MotionList className="workspace-workflow-panel__list">
              {workflows.map((workflow) => {
                const triggerMeta = TRIGGER_META[workflow.triggerType] ?? TRIGGER_META.manual;
                const statusMeta = RUN_STATUS_META[workflow.lastRunStatus] ?? null;
                const isExpanded = expandedWorkflowId === workflow.id;
                const isLive = ['queued', 'running'].includes(workflow.lastRunStatus);
                const enabled = workflow.enabled ?? workflow.isActive;
                const webhookCount = relevantWebhookCountByWorkflowId[workflow.id] ?? 0;
                const webhooksOpen = Boolean(expandedWebhookPanels[workflow.id]);

                return (
                  <MotionListItem
                    key={workflow.id}
                    className={`workspace-workflow-panel__workflow${isExpanded ? ' is-expanded' : ''}`}
                  >
                    <button
                      type="button"
                      className="workspace-workflow-panel__workflow-head"
                      onClick={() => setExpandedWorkflowId((current) => (current === workflow.id ? null : workflow.id))}
                    >
                      <div className="workspace-workflow-panel__workflow-copy">
                        <div className="workspace-workflow-panel__workflow-title-row">
                          <h3>{workflow.name}</h3>
                          {isLive ? <span className="workspace-workflow-panel__live-pulse" aria-hidden="true" /> : null}
                        </div>
                        <p>{workflow.description || 'No description provided yet.'}</p>
                        <div className="workspace-workflow-panel__workflow-meta">
                          <StatusPill color={triggerMeta.color}>{triggerMeta.label}</StatusPill>
                          {webhookCountByWorkflow[workflow.id] > 0 ? (
                            <span
                              style={{
                                fontSize: '11px',
                                padding: '2px 7px',
                                borderRadius: '999px',
                                background: 'rgba(189,224,254,0.12)',
                                color: '#BDE0FE',
                                border: '1px solid rgba(189,224,254,0.2)',
                              }}
                            >
                              {webhookCountByWorkflow[workflow.id]} webhook{webhookCountByWorkflow[workflow.id] !== 1 ? 's' : ''}
                            </span>
                          ) : null}
                          {statusMeta ? <StatusPill color={statusMeta.color}>{statusMeta.label}</StatusPill> : null}
                          <span>Last run {workflow.lastRunAt ? formatDateTime(workflow.lastRunAt) : 'Never'}</span>
                        </div>
                      </div>

                      <div className="workspace-workflow-panel__workflow-controls">
                        <label
                          className={`workspace-workflow-panel__toggle${enabled ? ' is-enabled' : ''}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={() => toggleMutation.mutate(workflow.id)}
                            disabled={toggleMutation.isPending}
                          />
                          <span>{enabled ? 'Enabled' : 'Disabled'}</span>
                        </label>
                        <Button
                          tone="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            runMutation.mutate(workflow.id);
                          }}
                          disabled={runMutation.isPending}
                        >
                          Run now
                        </Button>
                        <Button
                          tone="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (window.confirm(`Delete workflow "${workflow.name}"? This cannot be undone.`)) {
                              deleteMutation.mutate(workflow.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </button>

                    {isExpanded ? (
                      <MotionSection className="workspace-workflow-panel__history" reveal={{ y: 14, blur: 6 }}>
                        {runsQuery.isError ? (
                          <InlineNotice tone="danger">{getErrorMessage(runsQuery.error)}</InlineNotice>
                        ) : null}

                        <SectionLabel>Recent runs</SectionLabel>

                        {expandedRuns.length === 0 && !runsQuery.isLoading ? (
                          <div className="workspace-workflow-panel__history-empty">
                            No runs yet. Trigger the workflow manually to inspect its first execution log.
                          </div>
                        ) : (
                          <MotionList className="workspace-workflow-panel__history-list" staggerChildren={0.05}>
                            {expandedRuns.map((run) => {
                              const runMeta = RUN_STATUS_META[run.status] ?? RUN_STATUS_META.failed;
                              const isRunLive = ['queued', 'running'].includes(run.status);

                              return (
                                <MotionListItem key={run.id} className="workspace-workflow-panel__run-row" reveal={{ y: 12, blur: 5 }}>
                                  <div className="workspace-workflow-panel__run-copy">
                                    <div className="workspace-workflow-panel__run-head">
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <StatusPill color={runMeta.color}>{runMeta.label}</StatusPill>
                                        {isRunLive ? <span className="workspace-workflow-panel__live-pulse" aria-hidden="true" /> : null}
                                      </div>
                                      <span>{formatDateTime(run.startedAt ?? run.createdAt)}</span>
                                    </div>
                                    <p>
                                      {run.completedAt ? `Completed ${formatDateTime(run.completedAt)}` : 'Still in progress'} ·{' '}
                                      {formatDuration(run.startedAt ?? run.createdAt, run.completedAt)} ·{' '}
                                      {formatNumber(run.creditsUsed ?? 0)} credits
                                    </p>
                                  </div>
                                  <Button tone="ghost" onClick={() => setLogRun(run)}>
                                    View log
                                  </Button>
                                </MotionListItem>
                              );
                            })}
                          </MotionList>
                        )}

                        <div style={{ marginTop: '16px', display: 'grid', gap: '10px' }}>
                          <Button
                            tone="ghost"
                            onClick={() =>
                              setExpandedWebhookPanels((current) => ({
                                ...current,
                                [workflow.id]: !current[workflow.id],
                              }))
                            }
                            style={{ justifySelf: 'start' }}
                          >
                            {webhooksOpen ? 'Hide' : 'Show'} webhook subscriptions ({webhookCount})
                          </Button>

                          <MotionPresence initial={false}>
                            {webhooksOpen ? (
                              <MotionSection key="webhook-subscriptions" reveal={{ y: 12, blur: 6 }}>
                                <Suspense fallback={<LoadingPanel label="Loading webhook subscriptions..." />}>
                                  <WebhookSubscriptionsPanel
                                    workflowId={workflow.id}
                                    initialWebhooks={webhooksQuery.data?.webhooks ?? null}
                                  />
                                </Suspense>
                              </MotionSection>
                            ) : null}
                          </MotionPresence>
                        </div>
                      </MotionSection>
                    ) : null}
                  </MotionListItem>
                );
              })}
            </MotionList>
          )}

          {runMutation.isError ? (
            <InlineNotice tone={runMutation.error?.code === 'RATE_LIMITED' ? 'warning' : 'danger'}>
              {runMutation.error?.code === 'RATE_LIMITED'
                ? `You've reached your plan's workflow run limit. Upgrade for higher limits, or wait ${runMutation.error.retryAfter}s.`
                : getErrorMessage(runMutation.error)}
            </InlineNotice>
          ) : null}
          {toggleMutation.isError ? (
            <InlineNotice tone="danger">{getErrorMessage(toggleMutation.error)}</InlineNotice>
          ) : null}
          {deleteMutation.isError ? (
            <InlineNotice tone="danger">{getErrorMessage(deleteMutation.error)}</InlineNotice>
          ) : null}
        </SurfaceCard>
      </div>

      {builderOpen ? (
        <MotionModal
          open={builderOpen}
          onClose={() => setBuilderOpen(false)}
          className="workspace-modal workspace-workflow-panel__builder-modal"
          backdropClassName="workspace-modal-backdrop"
          backdropLabel="Close workflow builder"
          onClick={(event) => event.stopPropagation()}
        >
            <div className="workspace-modal__header">
              <div>
                <div className="workspace-modal__eyebrow">Workflow builder</div>
                <h2 className="workspace-modal__title">Create a new workflow</h2>
              </div>
              <Button tone="ghost" onClick={() => setBuilderOpen(false)}>Close</Button>
            </div>
            <Suspense fallback={<LoadingPanel label="Loading workflow builder..." />}>
              <WorkflowBuilder onClose={() => setBuilderOpen(false)} />
            </Suspense>
        </MotionModal>
      ) : null}

      {logRun ? (
        <MotionModal
          open={Boolean(logRun)}
          onClose={() => setLogRun(null)}
          className="workspace-modal workspace-workflow-panel__log-modal"
          backdropClassName="workspace-modal-backdrop"
          backdropLabel="Close run log"
          onClick={(event) => event.stopPropagation()}
        >
            <div className="workspace-modal__header">
              <div>
                <div className="workspace-modal__eyebrow">Run log</div>
                <h2 className="workspace-modal__title">{logRun.id}</h2>
              </div>
              <Button tone="ghost" onClick={() => setLogRun(null)}>Close</Button>
            </div>

            <div className="workspace-workflow-panel__log-feed">
              {(logRun.runLog ?? []).length === 0 ? (
                <div className="workspace-workflow-panel__history-empty">
                  No log entries were recorded for this run yet.
                </div>
              ) : (
                <MotionList className="workspace-workflow-panel__log-feed" staggerChildren={0.05}>
                  {logRun.runLog.map((entry, index) => {
                    const statusMeta =
                      entry.level === 'error'
                        ? RUN_STATUS_META.failed
                        : entry.level === 'system'
                          ? RUN_STATUS_META.queued
                          : RUN_STATUS_META.completed;

                    return (
                      <MotionListItem key={`${entry.at}-${index}`} className="workspace-workflow-panel__log-entry" reveal={{ y: 12, blur: 5 }}>
                        <div className="workspace-workflow-panel__log-head">
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <StatusPill color={statusMeta.color}>{entry.level}</StatusPill>
                            <span>{entry.metadata?.nodeId ?? 'workflow'}</span>
                          </div>
                          <span>{formatDateTime(entry.at)}</span>
                        </div>
                        <h3>{entry.message}</h3>
                        {summarizeRunEntry(entry) ? (
                          <p>{summarizeRunEntry(entry)}</p>
                        ) : null}
                      </MotionListItem>
                    );
                  })}
                </MotionList>
              )}
            </div>
        </MotionModal>
      ) : null}
    </>
  );
}

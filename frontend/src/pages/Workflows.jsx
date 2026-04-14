import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { WORKFLOW_TEMPLATES, getAgentMeta } from '../lib/constants';
import { formatDateTime, formatNumber, getErrorMessage, truncate } from '../lib/utils';
import {
  Button,
  EmptyState,
  InlineNotice,
  PageHeader,
  PageShell,
  SectionLabel,
  StatGrid,
  StatusPill,
  SurfaceCard,
} from '../components/ui';
import { useAppStore } from '../stores/useAppStore';
import WorkflowBuilder from './WorkflowBuilder';

const RUN_STATUS_COLORS = {
  queued: '#F59E0B',
  running: '#4CC9F0',
  completed: '#00FFD1',
  failed: '#EF4444',
  cancelled: '#98A2B3',
};

export default function Workflows() {
  const [view, setView] = useState('monitor');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const notify = useAppStore((state) => state.addNotification);
  const queryClient = useQueryClient();

  const workflowsQuery = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.get('/workflows'),
  });

  const selectedWorkflow = (workflowsQuery.data?.workflows ?? []).find((workflow) => workflow.id === selectedWorkflowId) ?? null;

  const runsQuery = useQuery({
    queryKey: ['workflow-runs', selectedWorkflowId],
    queryFn: () => api.get(`/workflows/${selectedWorkflowId}/runs`),
    enabled: Boolean(selectedWorkflowId),
    refetchInterval: selectedRunId ? 2500 : 5000,
  });

  const selectedRun = (runsQuery.data?.runs ?? []).find((run) => run.id === selectedRunId) ?? null;

  const runDetailQuery = useQuery({
    queryKey: ['workflow-run-detail', selectedRunId],
    queryFn: () => api.get(`/workflows/runs/${selectedRunId}`),
    enabled: Boolean(selectedRunId),
    refetchInterval:
      selectedRun?.status === 'queued' || selectedRun?.status === 'running'
        ? 2500
        : false,
  });

  useEffect(() => {
    if (!selectedWorkflowId) {
      return;
    }

    const runs = runsQuery.data?.runs ?? [];

    if (runs.length === 0) {
      setSelectedRunId(null);
      return;
    }

    if (!selectedRunId || !runs.some((run) => run.id === selectedRunId)) {
      setSelectedRunId(runs[0].id);
    }
  }, [runsQuery.data?.runs, selectedRunId, selectedWorkflowId]);

  const createMutation = useMutation({
    mutationFn: (template) => api.post('/workflows', template),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setSelectedWorkflowId(result.workflow.id);
      notify({ type: 'success', title: 'Workflow created', message: 'A validated workflow template was added to the workspace.' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Create failed', message: getErrorMessage(error) });
    },
  });

  const runMutation = useMutation({
    mutationFn: (workflowId) => api.post(`/workflows/${workflowId}/run`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workflows'] }),
        queryClient.invalidateQueries({ queryKey: ['workflow-runs', selectedWorkflowId] }),
        queryClient.invalidateQueries({ queryKey: ['billing-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['viewer'] }),
      ]);
      notify({ type: 'success', title: 'Run queued', message: 'Execution has been added to the live run queue.' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Run failed', message: getErrorMessage(error) });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (workflowId) => api.patch(`/workflows/${workflowId}/toggle`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workflows'] });
      notify({ type: 'success', title: 'Workflow updated', message: 'The workflow activation state was changed.' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Toggle failed', message: getErrorMessage(error) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (workflowId) => api.delete(`/workflows/${workflowId}`),
    onSuccess: async () => {
      setSelectedWorkflowId(null);
      setSelectedRunId(null);
      await queryClient.invalidateQueries({ queryKey: ['workflows'] });
      notify({ type: 'success', title: 'Workflow deleted', message: 'The workflow and its runtime trigger were removed.' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Delete failed', message: getErrorMessage(error) });
    },
  });

  const workflows = workflowsQuery.data?.workflows ?? [];
  const stats = useMemo(
    () => [
      { label: 'Workflows', value: formatNumber(workflows.length), helper: 'Validated graph definitions', accent: '#F72585' },
      { label: 'Active', value: formatNumber(workflows.filter((workflow) => workflow.isActive).length), helper: 'Triggerable right now', accent: '#00FFD1' },
      { label: 'Runs', value: formatNumber(workflows.reduce((sum, workflow) => sum + (workflow.runCount ?? 0), 0)), helper: 'Persisted execution history', accent: '#4CC9F0' },
    ],
    [workflows],
  );

  const runDetail = runDetailQuery.data?.run ?? selectedRun ?? null;
  const runLog = runDetail?.runLog ?? [];
  const nodeOutputs = Object.entries(runDetail?.nodeOutputs ?? {});

  return (
    <PageShell>
      <PageHeader
        eyebrow="NEXUS"
        title="Workflow execution and operational oversight"
        description="Prymal now treats workflows as monitored operating systems: validated definitions, live queueing, run history, execution logs, and step-by-step output inspection."
        accent="#F72585"
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button tone={view === 'monitor' ? 'accent' : 'ghost'} onClick={() => setView('monitor')}>Monitor</Button>
            <Button tone={view === 'builder' ? 'accent' : 'ghost'} onClick={() => setView('builder')}>Builder</Button>
          </div>
        }
      />

      <StatGrid items={stats} />

      {view === 'builder' ? (
        <SurfaceCard title="Visual workflow builder" subtitle="Drag agents, connect steps, save" accent="#F72585">
          <WorkflowBuilder onClose={() => setView('monitor')} />
        </SurfaceCard>
      ) : null}

      {view === 'monitor' ? (
      <InlineNotice tone="default">
        Use templates to launch quickly, then inspect execution status, node-by-node outputs, and run logs in one place. This keeps workflows central to the product rather than buried behind chat.
      </InlineNotice>
      ) : null}

      {view === 'monitor' ? <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(420px, 0.95fr)', gap: '14px', marginTop: '14px' }}>
        <SurfaceCard title="Workspace workflows" subtitle={`${workflows.length} configured`} accent="#F72585">
          {workflows.length === 0 ? (
            <EmptyState
              title="No workflows yet"
              description="Use the template library to create the first validated graph, then inspect live runs and logs on the right."
              accent="#F72585"
            />
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  style={{
                    padding: '16px',
                    borderRadius: '16px',
                    border: `1px solid ${workflow.id === selectedWorkflowId ? '#F7258555' : workflow.isActive ? '#F7258533' : 'var(--line)'}`,
                    background: 'var(--panel-soft)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '16px', marginBottom: '6px' }}>{workflow.name}</div>
                      <div style={{ color: 'var(--muted)', lineHeight: 1.7 }}>{workflow.description || 'No description provided.'}</div>
                    </div>
                    <StatusPill color={workflow.isActive ? '#F72585' : '#98A2B3'}>{workflow.isActive ? 'Active' : 'Paused'}</StatusPill>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {(workflow.nodes ?? []).map((node) => {
                      const agent = getAgentMeta(node.agentId);
                      return (
                        <span
                          key={node.id}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '999px',
                            border: agent?.color ? `1px solid ${agent.color}44` : '1px solid var(--line)',
                            color: agent?.color ?? 'var(--muted)',
                            fontSize: '11px',
                          }}
                        >
                          {agent?.name ?? node.agentId}
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Button tone="ghost" onClick={() => setSelectedWorkflowId(workflow.id)}>Inspect</Button>
                    <Button tone="accent" onClick={() => runMutation.mutate(workflow.id)} disabled={runMutation.isPending}>Run</Button>
                    <Button tone="ghost" onClick={() => toggleMutation.mutate(workflow.id)} disabled={toggleMutation.isPending}>
                      {workflow.isActive ? 'Pause' : 'Activate'}
                    </Button>
                    <Button tone="danger" onClick={() => deleteMutation.mutate(workflow.id)} disabled={deleteMutation.isPending}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>

        <div style={{ display: 'grid', gap: '14px' }}>
          <SurfaceCard title="Template library" accent="#4CC9F0">
            <div style={{ display: 'grid', gap: '10px' }}>
              {WORKFLOW_TEMPLATES.map((template) => (
                <div key={template.name} style={panelStyle}>
                  <div style={{ fontSize: '15px', marginBottom: '6px' }}>{template.name}</div>
                  <div style={{ color: 'var(--muted)', lineHeight: 1.7, marginBottom: '10px' }}>{template.description}</div>
                  <Button tone="ghost" onClick={() => createMutation.mutate(template)} disabled={createMutation.isPending}>
                    Use template
                  </Button>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard title={selectedWorkflow ? selectedWorkflow.name : 'Workflow detail'} accent="#F72585">
            {!selectedWorkflow ? (
              <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>Select a workflow to inspect nodes, triggers, runs, and execution detail.</div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <SectionLabel>Definition</SectionLabel>
                  <div style={{ color: 'var(--muted)', lineHeight: 1.8, marginBottom: '10px' }}>{selectedWorkflow.description || 'No description provided.'}</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <StatusPill color="#4CC9F0">{selectedWorkflow.triggerType}</StatusPill>
                    <StatusPill color={selectedWorkflow.isActive ? '#F72585' : '#98A2B3'}>{selectedWorkflow.isActive ? 'Active' : 'Paused'}</StatusPill>
                    <StatusPill color="#00FFD1">{formatNumber(selectedWorkflow.runCount ?? 0)} runs</StatusPill>
                  </div>
                </div>

                <div>
                  <SectionLabel>Node chain</SectionLabel>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {(selectedWorkflow.nodes ?? []).map((node, index) => {
                      const agent = getAgentMeta(node.agentId);
                      return (
                        <div key={node.id} style={panelStyle}>
                          <div style={{ color: agent?.color ?? 'var(--text-strong)', fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Step {index + 1} | {agent?.name ?? node.agentId}
                          </div>
                          <div style={{ color: 'var(--text-strong)', marginBottom: '6px' }}>{node.label || 'Untitled node'}</div>
                          <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>{node.prompt}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <SectionLabel>Run history</SectionLabel>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {(runsQuery.data?.runs ?? []).length === 0 ? (
                      <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>No runs yet. Queue the workflow to see execution history and logs.</div>
                    ) : (
                      runsQuery.data.runs.map((run) => (
                        <button
                          key={run.id}
                          type="button"
                          onClick={() => setSelectedRunId(run.id)}
                          style={{
                            ...panelStyle,
                            cursor: 'pointer',
                            textAlign: 'left',
                            borderColor: run.id === selectedRunId ? '#F7258555' : 'var(--line)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            <StatusPill color={RUN_STATUS_COLORS[run.status] ?? '#98A2B3'}>{run.status}</StatusPill>
                            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{formatDateTime(run.createdAt)}</div>
                          </div>
                          <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
                            {run.creditsUsed ? `${formatNumber(run.creditsUsed)} credits used` : 'Credits pending'}
                            {run.errorLog ? ` | ${truncate(run.errorLog, 120)}` : ''}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {runDetail ? (
                  <>
                    <div>
                      <SectionLabel>Execution summary</SectionLabel>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        <StatusPill color={RUN_STATUS_COLORS[runDetail.status] ?? '#98A2B3'}>{runDetail.status}</StatusPill>
                        <StatusPill color="#4CC9F0">{formatNumber(runDetail.creditsUsed ?? 0)} credits</StatusPill>
                        <StatusPill color="#BDB4FE">{nodeOutputs.length} node outputs</StatusPill>
                      </div>
                      {runDetail.errorLog ? (
                        <InlineNotice tone="warning">{runDetail.errorLog}</InlineNotice>
                      ) : null}
                    </div>

                    <div>
                      <SectionLabel>Execution log</SectionLabel>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {runLog.length === 0 ? (
                          <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>Run log will appear here as steps are queued, executed, skipped, or failed.</div>
                        ) : (
                          runLog.map((entry, index) => (
                            <div key={`${entry.at}-${index}`} style={panelStyle}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                <StatusPill color={entry.level === 'error' ? '#EF4444' : entry.level === 'system' ? '#BDB4FE' : '#4CC9F0'}>
                                  {entry.level}
                                </StatusPill>
                                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{formatDateTime(entry.at)}</div>
                              </div>
                              <div style={{ color: 'var(--text-strong)', marginBottom: '4px' }}>{entry.message}</div>
                              {Object.keys(entry.metadata ?? {}).length > 0 ? (
                                <div style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
                                  {Object.entries(entry.metadata)
                                    .map(([key, value]) => `${key}: ${String(value)}`)
                                    .join(' | ')}
                                </div>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <SectionLabel>Node outputs</SectionLabel>
                      <div style={{ display: 'grid', gap: '10px' }}>
                        {nodeOutputs.length === 0 ? (
                          <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>No node output has been persisted yet for this run.</div>
                        ) : (
                          nodeOutputs.map(([nodeId, output]) => (
                            <div key={nodeId} style={panelStyle}>
                              <div style={{ fontSize: '14px', marginBottom: '6px' }}>{nodeId}</div>
                              <div style={{ color: 'var(--muted)', lineHeight: 1.8, marginBottom: '8px' }}>
                                {output.skipped
                                  ? 'Skipped because its conditions were not met.'
                                  : `Tokens: ${formatNumber(output.totalTokens ?? 0)} | Sources: ${formatNumber(output.sourceCount ?? 0)} | Duration: ${formatDuration(output.durationMs)}`}
                              </div>
                              {!output.skipped ? (
                                <div style={{ color: 'var(--text-strong)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                                  {truncate(output.text ?? '', 800)}
                                </div>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </SurfaceCard>
        </div>
      </div> : null}
    </PageShell>
  );
}

const panelStyle = {
  padding: '14px',
  borderRadius: '14px',
  border: '1px solid var(--line)',
  background: 'var(--panel-soft)',
};

function formatDuration(value) {
  const duration = Number(value ?? 0);

  if (!duration) {
    return 'n/a';
  }

  if (duration < 1000) {
    return `${duration}ms`;
  }

  return `${(duration / 1000).toFixed(1)}s`;
}

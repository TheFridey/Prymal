import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, InlineNotice, LoadingPanel } from '../../../components/ui';
import { api } from '../../../lib/api';
import { formatNumber } from '../../../lib/utils';
import { useAppStore } from '../../../stores/useAppStore';

const POLICY_KEYS = ['fast_chat', 'premium_reasoning', 'grounded_research', 'structured_extraction', 'workflow_automation', 'vision_file', 'low_cost_bulk'];

export function ModelUsageTab({ query, days = '30', policyKey = 'all', onDaysChange, onPolicyKeyChange }) {
  const notify = useAppStore((state) => state.addNotification);
  const queryClient = useQueryClient();

  const schedulerQuery = useQuery({
    queryKey: ['staff-admin-scheduler-status'],
    queryFn: () => api.get('/admin/scheduler-status'),
    staleTime: 30_000,
  });
  const [sortCol, setSortCol] = useState('runs');
  const [sortAsc, setSortAsc] = useState(false);

  function toggleSort(col) {
    if (sortCol === col) {
      setSortAsc((prev) => !prev);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  }

  function sortIndicator(col) {
    if (sortCol !== col) return ' ↕';
    return sortAsc ? ' ↑' : ' ↓';
  }
  const [pruneResult, setPruneResult] = useState(null);

  const pruneMutation = useMutation({
    mutationFn: ({ dryRun = false } = {}) => api.post('/admin/memory/prune', { dryRun }),
    onSuccess: async (result) => {
      setPruneResult(result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff-admin-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['staff-admin-traces'] }),
      ]);
      notify({
        type: 'success',
        title: 'Session memory pruned',
        message: `Removed ${formatNumber(result.pruned ?? 0)} expired temporary session records.`,
      });
    },
    onError: (error) => {
      notify({
        type: 'error',
        title: 'Memory prune failed',
        message: error?.message ?? 'The temporary session memory prune could not be completed.',
      });
    },
  });

  if (query.isLoading) {
    return <LoadingPanel />;
  }

  const data = query.data ?? {};
  const modelUsage = data.modelUsage ?? [];
  const providerUsage = data.providerUsage ?? [];
  const orgUsage = data.orgUsage ?? [];
  const policySummary = data.policySummary ?? [];
  const maxRuns = Math.max(...(data.modelComparisons ?? []).map((r) => r.runs ?? 0), 1);

  const modelComparisons = [...(data.modelComparisons ?? [])].sort((a, b) => {
    const colMap = {
      runs: [a.runs ?? 0, b.runs ?? 0],
      successRate: [a.successRate ?? 0, b.successRate ?? 0],
      averageLatencyMs: [a.averageLatencyMs ?? 0, b.averageLatencyMs ?? 0],
      averageCostUsd: [a.averageCostUsd ?? 0, b.averageCostUsd ?? 0],
    };
    const [va, vb] = colMap[sortCol] ?? [0, 0];
    return sortAsc ? va - vb : vb - va;
  });

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <section className="staff-admin__panel">
        <div className="staff-admin__panel-header">Runtime maintenance</div>
        <p className="staff-admin__panel-copy">
          Clear out expired <code>temporary_session</code> memory records so short-lived chat context does not
          accumulate indefinitely.
        </p>
        {pruneResult ? (
          <InlineNotice
            variant="success"
            title="Session memory pruned"
            message={`Removed ${formatNumber(pruneResult.pruned ?? 0)} expired temporary session records.`}
          />
        ) : null}
        <div className="staff-admin__button-row">
          <Button
            type="button"
            size="sm"
            disabled={pruneMutation.isPending}
            onClick={() => {
              if (!window.confirm('Prune expired temporary session memory across Prymal now?')) {
                return;
              }
              pruneMutation.mutate({ dryRun: false });
            }}
          >
            {pruneMutation.isPending ? 'Pruning…' : 'Prune session memory'}
          </Button>
        </div>
      </section>

      <section className="staff-admin__panel">
        <div className="staff-admin__panel-header">Scheduler status</div>
        {schedulerQuery.isLoading ? (
          <p className="staff-admin__panel-copy">Loading…</p>
        ) : (
          <>
            <p className="staff-admin__panel-copy">
              Mode: <strong>{schedulerQuery.data?.mode ?? '—'}</strong>
              {schedulerQuery.data?.mode === 'inline' && (
                <> &mdash; {schedulerQuery.data.registeredSchedules?.length ?? 0} schedule(s) registered in-process</>
              )}
            </p>
            {schedulerQuery.data?.mode === 'inline' && (schedulerQuery.data.registeredSchedules?.length ?? 0) > 0 ? (
              <table className="staff-admin__table">
                <thead>
                  <tr>
                    <th>Workflow ID</th>
                    <th>Cron</th>
                    <th>Registered at</th>
                  </tr>
                </thead>
                <tbody>
                  {schedulerQuery.data.registeredSchedules.map((s) => (
                    <tr key={s.workflowId}>
                      <td>{s.workflowId}</td>
                      <td><code>{s.cronExpression}</code></td>
                      <td>{new Date(s.registeredAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </>
        )}
      </section>

      <section className="staff-admin__panel">
        <div className="staff-admin__panel-header">Provider analytics</div>
        <table className="staff-admin__table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Runs</th>
              <th>Failures</th>
              <th>Fallbacks</th>
              <th>Failure rate</th>
              <th>Avg latency</th>
              <th>Total cost</th>
            </tr>
          </thead>
          <tbody>
            {providerUsage.map((row) => (
              <tr key={row.provider}>
                <td>{row.provider}</td>
                <td>{formatNumber(row.runs)}</td>
                <td>{formatNumber(row.failureCount)}</td>
                <td>{formatNumber(row.fallbackCount)}</td>
                <td>{row.runs > 0 ? `${Math.round((row.failureCount / row.runs) * 100)}%` : '0%'}</td>
                <td>{formatNumber(row.averageLatencyMs)} ms</td>
                <td>${Number(row.totalCostUsd ?? 0).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="staff-admin__panel">
        <div className="staff-admin__panel-header">Model usage by provider and model</div>
        <table className="staff-admin__table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Runs</th>
              <th>Fallbacks</th>
              <th>Errors</th>
              <th>Avg latency</th>
              <th>Avg tokens</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {modelUsage.map((row) => (
              <tr key={row.model}>
                <td>{row.model}</td>
                <td>{formatNumber(row.runs)}</td>
                <td>{formatNumber(row.fallbackCount)}</td>
                <td>{formatNumber(row.failureCount)}</td>
                <td>{formatNumber(row.averageLatencyMs)} ms</td>
                <td>{formatNumber(row.averageTokens)}</td>
                <td>${Number(row.totalCostUsd ?? 0).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '20px' }}>
        <div className="staff-admin__panel">
          <div className="staff-admin__panel-header">Model comparison snapshot</div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {['7', '30', '90'].map((d) => (
              <button
                key={d}
                type="button"
                className={`staff-admin__filter-chip${days === d ? ' is-active' : ''}`}
                onClick={() => onDaysChange?.(d)}
              >
                {d}d
              </button>
            ))}
            <select
              value={policyKey}
              onChange={(e) => onPolicyKeyChange?.(e.target.value)}
              style={{ padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--panel-soft)', color: 'var(--text-strong)', fontSize: '12px' }}
            >
              <option value="all">All policies</option>
              {POLICY_KEYS.map((pk) => <option key={pk} value={pk}>{pk}</option>)}
            </select>
          </div>

          <table className="staff-admin__table">
            <thead>
              <tr>
                <th>Model</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('runs')}>Runs{sortIndicator('runs')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('successRate')}>Success rate{sortIndicator('successRate')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('averageLatencyMs')}>Avg latency{sortIndicator('averageLatencyMs')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('averageCostUsd')}>Avg cost{sortIndicator('averageCostUsd')}</th>
              </tr>
            </thead>
            <tbody>
              {modelComparisons.map((row) => (
                <tr
                  key={row.model}
                  style={(row.runs ?? 0) === maxRuns ? { background: 'var(--panel-soft)' } : undefined}
                >
                  <td>{row.model}</td>
                  <td>{formatNumber(row.runs)}</td>
                  <td>{Math.round((row.successRate ?? 0) * 100)}%</td>
                  <td>{formatNumber(row.averageLatencyMs)} ms</td>
                  <td>${Number(row.averageCostUsd ?? 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {policySummary.length > 0 ? (
            <>
              <div className="staff-admin__panel-header" style={{ marginTop: '20px' }}>Policy outcome summary</div>
              <table className="staff-admin__table">
                <thead>
                  <tr>
                    <th>Policy</th>
                    <th>Runs</th>
                    <th>Success</th>
                    <th>Failure</th>
                    <th>Fallback</th>
                    <th>Avg latency</th>
                    <th>Avg cost</th>
                  </tr>
                </thead>
                <tbody>
                  {policySummary.map((row) => (
                    <tr key={row.policyKey}>
                      <td>{row.policyKey}</td>
                      <td>{formatNumber(row.runs)}</td>
                      <td>{Math.round((row.successRate ?? 0) * 100)}%</td>
                      <td>{Math.round((row.failureRate ?? 0) * 100)}%</td>
                      <td>{Math.round((row.fallbackRate ?? 0) * 100)}%</td>
                      <td>{formatNumber(row.averageLatencyMs)} ms</td>
                      <td>${Number(row.averageCostUsd ?? 0).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </div>

        <div className="staff-admin__panel">
          <div className="staff-admin__panel-header">Top org usage</div>
          <table className="staff-admin__table">
            <thead>
              <tr>
                <th>Org</th>
                <th>Runs</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {orgUsage.slice(0, 10).map((row) => (
                <tr key={row.orgId}>
                  <td>{row.orgId}</td>
                  <td>{formatNumber(row.runs)}</td>
                  <td>${Number(row.totalCostUsd ?? 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function ModelPolicyTab({ query }) {
  if (query.isLoading) return <LoadingPanel />;
  if (query.error) return <div className="staff-admin__empty">Could not load model policy config.</div>;

  const providers = query.data?.providers ?? {};
  const policyLanes = query.data?.policyLanes ?? [];
  const orgBudgetCaps = query.data?.orgBudgetCaps ?? [];

  const anthropic = providers.anthropic ?? {};
  const openai = providers.openai ?? {};
  const google = providers.google ?? {};
  const orgControlOverrides = query.data?.orgControlOverrides ?? [];

  return (
    <div style={{ display: 'grid', gap: '20px' }}>

      {/* ── Provider status ───────────────────────────────────────── */}
      <section className="staff-admin__surface">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Model stack</div>
            <h2>Active provider lanes</h2>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {[
            { label: 'Anthropic', configured: anthropic.configured, models: anthropic.models ?? {} },
            { label: 'OpenAI', configured: openai.configured, models: openai.models ?? {} },
            { label: 'Google Gemini', configured: google.configured, models: google.models ?? {} },
          ].map((provider) => (
            <div key={provider.label} style={{ padding: '16px', borderRadius: '12px', background: 'var(--panel-soft)', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-strong)' }}>{provider.label}</span>
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                  background: provider.configured ? 'rgba(24,199,160,0.12)' : 'rgba(239,68,68,0.12)',
                  color: provider.configured ? '#18c7a0' : '#ef4444',
                }}>
                  {provider.configured ? 'Configured' : 'Not configured'}
                </span>
              </div>
              <div style={{ display: 'grid', gap: '6px' }}>
                {Object.entries(provider.models).map(([tier, modelId]) => (
                  <div key={tier} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{tier}</span>
                    <code style={{ color: 'var(--text-strong)', fontFamily: 'monospace', fontSize: '11px' }}>{modelId}</code>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Policy lanes ──────────────────────────────────────────── */}
      <section className="staff-admin__surface">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Routing logic</div>
            <h2>Policy lanes ({policyLanes.length})</h2>
          </div>
        </div>
        <table className="staff-admin__table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Latency</th>
              <th>Reasoning</th>
              <th>Requires grounding</th>
              <th>Structured output</th>
              <th>Tool use</th>
              <th>Multimodal</th>
            </tr>
          </thead>
          <tbody>
            {policyLanes.map((lane) => (
              <tr key={lane.key}>
                <td><code style={{ fontFamily: 'monospace', fontSize: '12px' }}>{lane.key}</code></td>
                <td>{lane.latencyTarget}</td>
                <td>{lane.reasoningDepth}</td>
                <td>{lane.groundingRequired ? '✓' : '—'}</td>
                <td>{lane.structuredOutputRequired ? '✓' : '—'}</td>
                <td>{lane.toolUsageRequired ? '✓' : '—'}</td>
                <td>{lane.multimodalRequired ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Per-org budget caps ───────────────────────────────────── */}
      <section className="staff-admin__surface">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Budget enforcement</div>
            <h2>Org-level budget caps ({orgBudgetCaps.length})</h2>
          </div>
          <div className="staff-admin__surface-meta">
            Configured via <code style={{ fontFamily: 'monospace', fontSize: '11px' }}>ORG_MODEL_POLICY_OVERRIDES</code>
          </div>
        </div>
        {orgBudgetCaps.length === 0 ? (
          <div className="staff-admin__empty">No per-org budget caps are currently configured.</div>
        ) : (
          <table className="staff-admin__table">
            <thead>
              <tr>
                <th>Org ID</th>
                <th>Allowed policies</th>
                <th>Max cost / run</th>
                <th>Max tokens / run</th>
              </tr>
            </thead>
            <tbody>
              {orgBudgetCaps.map((cap) => (
                <tr key={cap.orgId}>
                  <td><code style={{ fontFamily: 'monospace', fontSize: '11px' }}>{cap.orgId}</code></td>
                  <td>
                    {cap.allowedPolicies
                      ? cap.allowedPolicies.map((p) => (
                        <span key={p} style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '999px', background: 'var(--line)', marginRight: '4px' }}>{p}</span>
                      ))
                      : <span style={{ color: 'var(--muted)' }}>All policies</span>}
                  </td>
                  <td>{cap.maxCostUsdPerRun != null ? `$${cap.maxCostUsdPerRun.toFixed(4)}` : '—'}</td>
                  <td>{cap.maxOutputTokensPerRun != null ? formatNumber(cap.maxOutputTokensPerRun) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="staff-admin__surface">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Customer overrides</div>
            <h2>Org AI controls ({orgControlOverrides.length})</h2>
          </div>
          <div className="staff-admin__surface-meta">
            Persisted in organisation metadata and merged with env-level overrides.
          </div>
        </div>
        {orgControlOverrides.length === 0 ? (
          <div className="staff-admin__empty">No organisation-level AI controls are configured yet.</div>
        ) : (
          <table className="staff-admin__table">
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Plan</th>
                <th>Provider</th>
                <th>Reasoning</th>
                <th>Fast lane</th>
                <th>Budget cap</th>
                <th>Failover</th>
              </tr>
            </thead>
            <tbody>
              {orgControlOverrides.map((entry) => (
                <tr key={entry.orgId}>
                  <td>
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <strong>{entry.orgName}</strong>
                      <span style={{ color: 'var(--muted)', fontSize: '11px' }}>{entry.orgId}</span>
                    </div>
                  </td>
                  <td>{entry.plan}</td>
                  <td>{entry.controls.providerPreference}</td>
                  <td>{entry.controls.reasoningTier}</td>
                  <td>{entry.controls.fastLane}</td>
                  <td>
                    {entry.effectiveBudgetCap?.maxCostUsdPerRun != null || entry.effectiveBudgetCap?.maxOutputTokensPerRun != null
                      ? `${entry.effectiveBudgetCap.maxCostUsdPerRun != null ? `$${entry.effectiveBudgetCap.maxCostUsdPerRun}` : 'no $ cap'} / ${entry.effectiveBudgetCap.maxOutputTokensPerRun != null ? `${formatNumber(entry.effectiveBudgetCap.maxOutputTokensPerRun)} tokens` : 'no token cap'}`
                      : 'No cap'}
                  </td>
                  <td>{entry.controls.failoverOrder?.length > 0 ? entry.controls.failoverOrder.join(' > ') : 'Default'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export function ScorecardsTab({ query }) {
  if (query.isLoading) {
    return <LoadingPanel />;
  }

  const scorecards = query.data?.scorecards ?? [];

  return (
    <div className="staff-admin__panel">
      <div className="staff-admin__panel-header">Agent performance scorecards</div>
      <table className="staff-admin__table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Usage</th>
            <th>Success</th>
            <th>Fallback</th>
            <th>Citation</th>
            <th>Grounded</th>
            <th>Structured</th>
            <th>Errors</th>
            <th>Avg latency</th>
          </tr>
        </thead>
        <tbody>
          {scorecards.map((card) => (
            <tr key={card.agentId}>
              <td>{card.agentId}</td>
              <td>{formatNumber(card.usageCount)}</td>
              <td>{card.completionSuccessRate}%</td>
              <td>{card.fallbackRate}%</td>
              <td>{card.citationRate}%</td>
              <td>{card.groundedRate}%</td>
              <td>{card.structuredOutputPassRate}%</td>
              <td>{card.errorRate}%</td>
              <td>{formatNumber(card.averageLatencyMs)} ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

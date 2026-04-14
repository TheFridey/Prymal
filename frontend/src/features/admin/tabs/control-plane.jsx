import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, InlineNotice, LoadingPanel } from '../../../components/ui';
import { api } from '../../../lib/api';
import { formatNumber } from '../../../lib/utils';
import { useAppStore } from '../../../stores/useAppStore';

const POLICY_KEYS = ['fast_chat', 'premium_reasoning', 'grounded_research', 'structured_extraction', 'workflow_automation', 'vision_file', 'low_cost_bulk'];
const HIGH_VALUE_AGENT_IDS = ['cipher', 'lore', 'herald', 'scout', 'oracle', 'sage', 'nexus', 'sentinel'];
const PROVIDER_ROLES = [
  {
    key: 'anthropic',
    label: 'Anthropic',
    accent: '#7DD3FC',
    role: 'Deep reasoning and contract-heavy specialist work',
    helper: 'Best for deliberate analysis, stronger instruction adherence, and premium long-form synthesis.',
  },
  {
    key: 'openai',
    label: 'OpenAI',
    accent: '#7CFFCB',
    role: 'Premium multimodal, structured, and realtime lane',
    helper: 'Best for voice, polished customer-facing results, and structured operator flows.',
  },
  {
    key: 'google',
    label: 'Gemini',
    accent: '#BDB4FE',
    role: 'Fast lower-cost and experimentation lane',
    helper: 'Best for budget-sensitive throughput, fast bulk work, and controlled provider experiments.',
  },
];

function formatPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function metricCard(label, value, helper) {
  return (
    <div className="staff-admin__runtime-summary-card" key={label}>
      <div className="staff-admin__surface-label">{label}</div>
      <strong>{value}</strong>
      {helper ? <div className="staff-admin__surface-meta">{helper}</div> : null}
    </div>
  );
}

export function ModelUsageTab({ query, days = '30', policyKey = 'all', onDaysChange, onPolicyKeyChange }) {
  const notify = useAppStore((state) => state.addNotification);
  const queryClient = useQueryClient();
  const [sortCol, setSortCol] = useState('runs');
  const [sortAsc, setSortAsc] = useState(false);
  const [pruneResult, setPruneResult] = useState(null);

  const schedulerQuery = useQuery({
    queryKey: ['staff-admin-scheduler-status'],
    queryFn: () => api.get('/admin/scheduler-status'),
    staleTime: 30_000,
  });

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

  function toggleSort(column) {
    if (sortCol === column) {
      setSortAsc((current) => !current);
      return;
    }

    setSortCol(column);
    setSortAsc(false);
  }

  function sortIndicator(column) {
    if (sortCol !== column) return ' ^v';
    return sortAsc ? ' ^' : ' v';
  }

  if (query.isLoading) {
    return <LoadingPanel />;
  }

  const data = query.data ?? {};
  const modelUsage = data.modelUsage ?? [];
  const providerUsage = data.providerUsage ?? [];
  const orgUsage = data.orgUsage ?? [];
  const policySummary = data.policySummary ?? [];
  const maxRuns = Math.max(...(data.modelComparisons ?? []).map((entry) => entry.runs ?? 0), 1);

  const modelComparisons = [...(data.modelComparisons ?? [])].sort((left, right) => {
    const columnMap = {
      runs: [left.runs ?? 0, right.runs ?? 0],
      successRate: [left.successRate ?? 0, right.successRate ?? 0],
      averageLatencyMs: [left.averageLatencyMs ?? 0, right.averageLatencyMs ?? 0],
      averageCostUsd: [left.averageCostUsd ?? 0, right.averageCostUsd ?? 0],
    };
    const [leftValue, rightValue] = columnMap[sortCol] ?? [0, 0];
    return sortAsc ? leftValue - rightValue : rightValue - leftValue;
  });

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <section className="staff-admin__panel">
        <div className="staff-admin__panel-header">Runtime maintenance</div>
        <p className="staff-admin__panel-copy">
          Clear out expired <code>temporary_session</code> memory records so short-lived chat context does not accumulate indefinitely.
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
            disabled={pruneMutation.isPending}
            onClick={() => {
              if (!window.confirm('Prune expired temporary session memory across Prymal now?')) {
                return;
              }
              pruneMutation.mutate({ dryRun: false });
            }}
          >
            {pruneMutation.isPending ? 'Pruning...' : 'Prune session memory'}
          </Button>
        </div>
      </section>

      <section className="staff-admin__panel">
        <div className="staff-admin__panel-header">Scheduler status</div>
        {schedulerQuery.isLoading ? (
          <p className="staff-admin__panel-copy">Loading...</p>
        ) : (
          <>
            <p className="staff-admin__panel-copy">
              Mode: <strong>{schedulerQuery.data?.mode ?? '-'}</strong>
              {schedulerQuery.data?.mode === 'inline'
                ? ` | ${schedulerQuery.data.registeredSchedules?.length ?? 0} schedule(s) registered in-process`
                : ''}
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
                  {schedulerQuery.data.registeredSchedules.map((entry) => (
                    <tr key={entry.workflowId}>
                      <td>{entry.workflowId}</td>
                      <td><code>{entry.cronExpression}</code></td>
                      <td>{new Date(entry.registeredAt).toLocaleString()}</td>
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
                <td>{row.runs > 0 ? formatPercent(row.failureCount / row.runs) : '0%'}</td>
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
            {['7', '30', '90'].map((value) => (
              <button
                key={value}
                type="button"
                className={`staff-admin__filter-chip${days === value ? ' is-active' : ''}`}
                onClick={() => onDaysChange?.(value)}
              >
                {value}d
              </button>
            ))}
            <select
              value={policyKey}
              onChange={(event) => onPolicyKeyChange?.(event.target.value)}
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--panel-soft)',
                color: 'var(--text-strong)',
                fontSize: '12px',
              }}
            >
              <option value="all">All policies</option>
              {POLICY_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
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
                  <td>{formatPercent(row.successRate)}</td>
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
                      <td>{formatPercent(row.successRate)}</td>
                      <td>{formatPercent(row.failureRate)}</td>
                      <td>{formatPercent(row.fallbackRate)}</td>
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
  const orgControlOverrides = query.data?.orgControlOverrides ?? [];

  const providerSummary = {
    configuredCount: PROVIDER_ROLES.filter((provider) => providers[provider.key]?.configured).length,
    experimentingOrgs: orgControlOverrides.filter((entry) => entry.controls?.experimentationEnabled).length,
    geminiPreferredOrgs: orgControlOverrides.filter((entry) => entry.controls?.providerPreference === 'google').length,
    budgetCappedOrgs: orgControlOverrides.filter((entry) =>
      entry.effectiveBudgetCap?.maxCostUsdPerRun != null || entry.effectiveBudgetCap?.maxOutputTokensPerRun != null,
    ).length,
  };

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <section className="staff-admin__surface">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Provider posture</div>
            <h2>Active provider lanes</h2>
          </div>
        </div>

        <div className="staff-admin__runtime-summary-grid">
          {metricCard('Configured providers', providerSummary.configuredCount, 'Expected total: 3')}
          {metricCard('Org override profiles', orgControlOverrides.length, 'Persisted in organisation metadata')}
          {metricCard('Experimentation enabled', providerSummary.experimentingOrgs, 'Provider-routing comparison mode')}
          {metricCard('Gemini-first orgs', providerSummary.geminiPreferredOrgs, 'Fast lane / experimentation adoption')}
          {metricCard('Budget-capped orgs', providerSummary.budgetCappedOrgs, 'Explicit cost or token ceilings')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '16px' }}>
          {PROVIDER_ROLES.map((provider) => {
            const meta = providers[provider.key] ?? {};
            const models = meta.models ?? {};
            return (
              <div
                key={provider.key}
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  background: 'var(--panel-soft)',
                  border: `1px solid ${provider.accent}33`,
                  boxShadow: `0 20px 50px -36px ${provider.accent}66`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ color: 'var(--text-strong)', fontWeight: 700 }}>{provider.label}</div>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: meta.configured ? `${provider.accent}22` : 'rgba(239,68,68,0.12)',
                      color: meta.configured ? provider.accent : '#ef4444',
                    }}
                  >
                    {meta.configured ? 'Configured' : 'Not configured'}
                  </span>
                </div>
                <div style={{ color: 'var(--text-strong)', lineHeight: 1.6, marginBottom: '8px' }}>{provider.role}</div>
                <div style={{ color: 'var(--muted)', lineHeight: 1.6, marginBottom: '12px' }}>{provider.helper}</div>
                <div style={{ display: 'grid', gap: '6px' }}>
                  {Object.entries(models).map(([tier, modelId]) => (
                    <div key={tier} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px' }}>
                      <span style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{tier}</span>
                      <code style={{ color: 'var(--text-strong)', fontSize: '11px' }}>{modelId}</code>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

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
              <th>Grounding</th>
              <th>Structured output</th>
              <th>Tool use</th>
              <th>Multimodal</th>
            </tr>
          </thead>
          <tbody>
            {policyLanes.map((lane) => (
              <tr key={lane.key}>
                <td><code style={{ fontSize: '12px' }}>{lane.key}</code></td>
                <td>{lane.latencyTarget}</td>
                <td>{lane.reasoningDepth}</td>
                <td>{lane.groundingRequired ? 'Yes' : 'No'}</td>
                <td>{lane.structuredOutputRequired ? 'Yes' : 'No'}</td>
                <td>{lane.toolUsageRequired ? 'Yes' : 'No'}</td>
                <td>{lane.multimodalRequired ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="staff-admin__surface">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Budget enforcement</div>
            <h2>Org-level budget caps ({orgBudgetCaps.length})</h2>
          </div>
          <div className="staff-admin__surface-meta">
            Configured via <code style={{ fontSize: '11px' }}>ORG_MODEL_POLICY_OVERRIDES</code>
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
                  <td><code style={{ fontSize: '11px' }}>{cap.orgId}</code></td>
                  <td>
                    {cap.allowedPolicies?.length > 0
                      ? cap.allowedPolicies.map((policy) => (
                        <span key={policy} style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '999px', background: 'var(--line)', marginRight: '4px' }}>
                          {policy}
                        </span>
                      ))
                      : <span style={{ color: 'var(--muted)' }}>All policies</span>}
                  </td>
                  <td>{cap.maxCostUsdPerRun != null ? `$${cap.maxCostUsdPerRun.toFixed(4)}` : '-'}</td>
                  <td>{cap.maxOutputTokensPerRun != null ? formatNumber(cap.maxOutputTokensPerRun) : '-'}</td>
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
                <th>Experimentation</th>
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
                  <td>{entry.controls.experimentationEnabled ? 'Enabled' : 'Off'}</td>
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

  const summary = scorecards.length === 0
    ? {
        agentsTracked: 0,
        avgHoldRate: 0,
        avgSentinelInterventionRate: 0,
        avgBlockedToolAttemptRate: 0,
      }
    : (() => {
        const totals = scorecards.reduce((accumulator, card) => ({
          avgHoldRate: accumulator.avgHoldRate + (card.holdRate ?? 0),
          avgSentinelInterventionRate: accumulator.avgSentinelInterventionRate + (card.sentinelInterventionRate ?? 0),
          avgBlockedToolAttemptRate: accumulator.avgBlockedToolAttemptRate + (card.blockedToolAttemptRate ?? 0),
        }), {
          avgHoldRate: 0,
          avgSentinelInterventionRate: 0,
          avgBlockedToolAttemptRate: 0,
        });

        return {
          agentsTracked: scorecards.length,
          avgHoldRate: totals.avgHoldRate / scorecards.length,
          avgSentinelInterventionRate: totals.avgSentinelInterventionRate / scorecards.length,
          avgBlockedToolAttemptRate: totals.avgBlockedToolAttemptRate / scorecards.length,
        };
      })();

  const highValueWatchlist = HIGH_VALUE_AGENT_IDS
    .map((agentId) => scorecards.find((card) => card.agentId === agentId))
    .filter(Boolean);

  if (scorecards.length === 0) {
    return (
      <div className="staff-admin__panel">
        <div className="staff-admin__panel-header">Agent performance scorecards</div>
        <div className="staff-admin__empty">No scorecard data is available for the selected window.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <section className="staff-admin__surface">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Governance summary</div>
            <h2>Agent enforcement scorecards</h2>
          </div>
        </div>
        <div className="staff-admin__runtime-summary-grid">
          {metricCard('Agents tracked', formatNumber(summary.agentsTracked), 'Active in this reporting window')}
          {metricCard('Avg hold rate', formatPercent(summary.avgHoldRate), 'SENTINEL held responses')}
          {metricCard('Avg interventions', formatPercent(summary.avgSentinelInterventionRate), 'REPAIR or HOLD verdicts')}
          {metricCard('Blocked tool attempts', formatPercent(summary.avgBlockedToolAttemptRate), 'Contract-enforced tool denials')}
        </div>
      </section>

      <section className="staff-admin__surface">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">High-value agent watchlist</div>
            <h2>Governance hot spots</h2>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {highValueWatchlist.map((card) => (
            <div
              key={card.agentId}
              style={{
                padding: '16px',
                borderRadius: '16px',
                background: 'var(--panel-soft)',
                border: `1px solid ${card.holdRate > 0 ? 'rgba(249,115,22,0.35)' : 'var(--line)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                <strong style={{ textTransform: 'uppercase' }}>{card.agentId}</strong>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: card.holdRate > 0 ? 'rgba(249,115,22,0.12)' : 'rgba(24,199,160,0.12)',
                    color: card.holdRate > 0 ? '#f97316' : '#18c7a0',
                  }}
                >
                  {card.holdRate > 0 ? 'Needs review' : 'Stable'}
                </span>
              </div>
              <div style={{ display: 'grid', gap: '6px', color: 'var(--muted)' }}>
                <div>Success: <strong style={{ color: 'var(--text-strong)' }}>{formatPercent(card.completionSuccessRate)}</strong></div>
                <div>SENTINEL interventions: <strong style={{ color: 'var(--text-strong)' }}>{formatPercent(card.sentinelInterventionRate)}</strong></div>
                <div>Schema repairs: <strong style={{ color: 'var(--text-strong)' }}>{formatPercent(card.schemaRepairRate)}</strong></div>
                <div>Blocked tools: <strong style={{ color: 'var(--text-strong)' }}>{formatPercent(card.blockedToolAttemptRate)}</strong></div>
                <div>Memory scope violations: <strong style={{ color: 'var(--text-strong)' }}>{formatPercent(card.memoryScopeViolationRate)}</strong></div>
                <div>Policy class: <strong style={{ color: 'var(--text-strong)' }}>{card.dominantPolicyClass ?? '-'}</strong></div>
              </div>
              {card.topHoldReasons?.[0]?.reason ? (
                <div style={{ marginTop: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
                  Top hold reason: <strong style={{ color: 'var(--text-strong)' }}>{card.topHoldReasons[0].reason}</strong>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="staff-admin__panel">
        <div className="staff-admin__panel-header">Per-agent enforcement detail</div>
        <table className="staff-admin__table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Usage</th>
              <th>Success</th>
              <th>Hold</th>
              <th>SENTINEL</th>
              <th>Schema repair</th>
              <th>Blocked tools</th>
              <th>Memory scope</th>
              <th>Avg latency</th>
              <th>Policy</th>
              <th>Top failure</th>
            </tr>
          </thead>
          <tbody>
            {scorecards.map((card) => (
              <tr key={card.agentId}>
                <td>{card.agentId}</td>
                <td>{formatNumber(card.usageCount)}</td>
                <td>{formatPercent(card.completionSuccessRate)}</td>
                <td>{formatPercent(card.holdRate)}</td>
                <td>{formatPercent(card.sentinelInterventionRate)}</td>
                <td>{formatPercent(card.schemaRepairRate)}</td>
                <td>{formatPercent(card.blockedToolAttemptRate)}</td>
                <td>{formatPercent(card.memoryScopeViolationRate)}</td>
                <td>{formatNumber(card.averageLatencyMs)} ms</td>
                <td>{card.dominantPolicyClass ?? '-'}</td>
                <td>{card.topFailureClasses?.[0]?.failureClass ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

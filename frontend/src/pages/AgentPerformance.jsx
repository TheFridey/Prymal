import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { isInternalDiagnosticsVisible } from '../lib/diagnostics';
import { formatDateTime, formatNumber } from '../lib/utils';
import { Button, LoadingPanel, PageShell, SectionLabel, TextInput } from '../components/ui';
import { MotionList, MotionListItem, MotionSection } from '../components/motion';

const POLICY_CLASS_LABELS = {
  fast_chat: 'Fast chat',
  premium_reasoning: 'Premium reasoning',
  low_cost_bulk: 'Low cost bulk',
  structured_extraction: 'Structured extraction',
  grounded_research: 'Grounded research',
  workflow_automation: 'Workflow automation',
  vision_file: 'Vision / file',
};

function holdPercent(row) {
  const total = (row.holdCount ?? 0) + (row.repairCount ?? 0) + (row.passCount ?? 0);
  if (total === 0) return 0;
  return ((row.holdCount ?? 0) / total) * 100;
}

function weightColor(weight) {
  if (weight == null) return undefined;
  if (weight < 0.5) return '#ef4444';
  if (weight < 0.65) return '#f59e0b';
  return '#18c7a0';
}

function weightRowBg(weight) {
  if (weight == null) return undefined;
  if (weight < 0.5) return 'rgba(239,68,68,0.06)';
  if (weight < 0.65) return 'rgba(245,158,11,0.05)';
  return undefined;
}

function exportCsv(rows) {
  const headers = ['Agent', 'Policy class', 'Org', 'Weight', 'Confidence', 'Hold%', 'Sample size', 'Updated'];
  const lines = rows.map((r) => [
    r.agentId,
    r.policyClass,
    r.orgId,
    r.avgWeight != null ? r.avgWeight.toFixed(3) : '',
    r.confidence ?? '',
    holdPercent(r).toFixed(1),
    r.sampleSize ?? '',
    r.updatedAt ? new Date(r.updatedAt).toISOString() : '',
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agent-performance-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AgentPerformance() {
  const { viewer } = useOutletContext();
  const isStaff = isInternalDiagnosticsVisible(viewer);

  const [agentFilter, setAgentFilter] = useState('');
  const [policyFilter, setPolicyFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');

  const summariesQuery = useQuery({
    queryKey: ['admin-agent-eval-summaries'],
    queryFn: () => api.get('/admin/agent-eval-summaries'),
    enabled: isStaff,
    staleTime: 60_000,
  });

  const rows = summariesQuery.data?.summaries ?? [];

  const filtered = useMemo(() => {
    const agentNeedle = agentFilter.trim().toLowerCase();
    const policyNeedle = policyFilter.trim().toLowerCase();
    const orgNeedle = orgFilter.trim().toLowerCase();
    return rows.filter((r) => {
      if (agentNeedle && !String(r.agentId ?? '').toLowerCase().includes(agentNeedle)) return false;
      if (policyNeedle && !String(r.policyClass ?? '').toLowerCase().includes(policyNeedle)) return false;
      if (orgNeedle && !String(r.orgId ?? '').toLowerCase().includes(orgNeedle)) return false;
      return true;
    });
  }, [rows, agentFilter, policyFilter, orgFilter]);

  if (!isStaff) return <Navigate to="/app/dashboard" replace />;

  return (
    <PageShell>
      <MotionSection reveal={{ y: 18, blur: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: '#7f8cff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Staff admin
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Agent Performance</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
              Eval score summaries per agent, policy class, and org. Rows in amber/red indicate low routing weight.
            </p>
          </div>
          <Button
            tone="ghost"
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
          >
            Export CSV
          </Button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <TextInput
            placeholder="Filter by agent…"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            style={{ flex: '1 1 160px' }}
          />
          <TextInput
            placeholder="Filter by policy class…"
            value={policyFilter}
            onChange={(e) => setPolicyFilter(e.target.value)}
            style={{ flex: '1 1 180px' }}
          />
          <TextInput
            placeholder="Filter by org ID…"
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            style={{ flex: '1 1 200px' }}
          />
        </div>

        {summariesQuery.isLoading ? (
          <LoadingPanel label="Loading eval summaries…" />
        ) : (
          <>
            <SectionLabel>
              {formatNumber(filtered.length)} of {formatNumber(rows.length)} rows
            </SectionLabel>
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {['Agent', 'Policy class', 'Org', 'Weight', 'Confidence', 'Hold%', 'Sample size', 'Updated'].map((col) => (
                      <th key={col} style={thStyle}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '32px 16px' }}>
                        No summaries match the current filters.
                      </td>
                    </tr>
                  ) : (
                    <MotionList as="tbody">
                      {filtered.map((row) => {
                        const w = row.avgWeight;
                        const hp = holdPercent(row);
                        return (
                          <MotionListItem
                            key={`${row.agentId}-${row.policyClass}-${row.orgId}`}
                            as="tr"
                            reveal={{ y: 8, blur: 3 }}
                            style={{ background: weightRowBg(w) }}
                          >
                            <td style={tdStyle}>{row.agentId}</td>
                            <td style={tdStyle}>{POLICY_CLASS_LABELS[row.policyClass] ?? row.policyClass}</td>
                            <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-muted)' }}>{row.orgId}</td>
                            <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                              {w != null ? (
                                <span style={{ fontWeight: 700, color: weightColor(w) }}>
                                  {Math.round(w * 100)}%
                                </span>
                              ) : '—'}
                            </td>
                            <td style={tdStyle}>
                              {row.confidence ? (
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: row.confidence === 'high' ? '#18c7a0' : row.confidence === 'medium' ? '#f59e0b' : 'var(--text-muted)',
                                }}>
                                  {row.confidence}
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums', color: hp > 15 ? '#ef4444' : undefined }}>
                              {hp.toFixed(1)}%
                            </td>
                            <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                              {formatNumber(row.sampleSize ?? 0)}
                            </td>
                            <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-muted)' }}>
                              {row.updatedAt ? formatDateTime(row.updatedAt) : '—'}
                            </td>
                          </MotionListItem>
                        );
                      })}
                    </MotionList>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </MotionSection>
    </PageShell>
  );
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyle = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '10px 12px',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  verticalAlign: 'middle',
};

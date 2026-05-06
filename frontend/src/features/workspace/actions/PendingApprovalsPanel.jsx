import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { formatDateTime } from '../../../lib/utils';
import { EmptyState, LoadingPanel, SectionLabel } from '../../../components/ui';
import { MotionList, MotionListItem, MotionSection } from '../../../components/motion';
import ActionApprovalCard from './ActionApprovalCard';

const ACTION_LABELS = {
  'email.send': 'Send email',
  'drive.write': 'Write to Drive',
  'drive.append': 'Append to Drive',
  'drive.folder': 'Create Drive folder',
  'slack.post': 'Post to Slack',
  'slack.reply': 'Reply in Slack',
};

const RISK_COLOR = {
  critical: '#ef4444',
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#64748b',
};

/**
 * Slide-over panel listing all pending action approvals for the org.
 * Shown in the NEXUS (workflows) workspace via a notification badge.
 */
export default function PendingApprovalsPanel({ onClose }) {
  const [selectedId, setSelectedId] = useState(null);

  const approvalsQuery = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: () => api.get('/actions/approvals'),
    refetchInterval: 30_000,
  });

  const approvals = approvalsQuery.data?.approvals ?? [];
  const selected = selectedId ? approvals.find((a) => a.id === selectedId) : null;

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <div style={{ fontSize: 11, color: '#7f8cff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            NEXUS
          </div>
          <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700 }}>Pending approvals</h2>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} style={closeBtnStyle} aria-label="Close approvals panel">
            ✕
          </button>
        ) : null}
      </div>

      {approvalsQuery.isLoading && !approvalsQuery.data ? (
        <LoadingPanel label="Loading pending approvals…" />
      ) : selected ? (
        <MotionSection reveal={{ y: 12, blur: 5 }}>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            style={{ fontSize: 13, color: '#7f8cff', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px', display: 'block' }}
          >
            ← Back to list
          </button>
          <ActionApprovalCard
            approval={selected}
            onDone={() => setSelectedId(null)}
          />
        </MotionSection>
      ) : approvals.length === 0 ? (
        <MotionSection reveal={{ y: 16, blur: 6 }}>
          <EmptyState
            title="No pending approvals"
            description="When a workflow action requires human approval, it will appear here."
            accent="#7f8cff"
          />
        </MotionSection>
      ) : (
        <MotionSection reveal={{ y: 14, blur: 6 }}>
          <SectionLabel>{approvals.length} approval{approvals.length !== 1 ? 's' : ''} waiting</SectionLabel>
          <MotionList style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {approvals.map((approval) => {
              const riskLevel = approval.risk?.level ?? 'medium';
              const riskColor = RISK_COLOR[riskLevel] ?? RISK_COLOR.medium;
              const actionLabel = ACTION_LABELS[approval.actionType] ?? approval.actionType;
              const expiresMs = new Date(approval.expiresAt).getTime() - Date.now();
              const expiresMinutes = Math.max(0, Math.floor(expiresMs / 60_000));

              return (
                <MotionListItem key={approval.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(approval.id)}
                    style={itemStyle}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{actionLabel}</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: `${riskColor}18`,
                          color: riskColor,
                          border: `1px solid ${riskColor}33`,
                          textTransform: 'capitalize',
                        }}
                      >
                        {riskLevel}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>Requested {formatDateTime(approval.createdAt)}</span>
                      <span style={{ color: expiresMinutes < 5 ? '#ef4444' : undefined }}>
                        Expires in {expiresMinutes}m
                      </span>
                    </div>
                  </button>
                </MotionListItem>
              );
            })}
          </MotionList>
        </MotionSection>
      )}
    </div>
  );
}

const panelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  padding: 20,
  minHeight: 200,
};

const headerStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 20,
  paddingBottom: 16,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
};

const closeBtnStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  fontSize: 16,
  padding: 4,
  lineHeight: 1,
};

const itemStyle = {
  width: '100%',
  textAlign: 'left',
  padding: '12px 14px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  cursor: 'pointer',
  transition: 'background 0.15s',
};

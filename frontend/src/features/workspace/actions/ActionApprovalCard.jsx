import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { getErrorMessage, truncate } from '../../../lib/utils';
import { Button, InlineNotice } from '../../../components/ui';
import { useAppStore } from '../../../stores/useAppStore';

const ACTION_LABELS = {
  'email.send': 'Send email',
  'drive.write': 'Write to Drive',
  'drive.append': 'Append to Drive',
  'drive.folder': 'Create Drive folder',
  'slack.post': 'Post to Slack',
  'slack.reply': 'Reply in Slack',
};

const RISK_META = {
  critical: { label: 'Critical risk', bg: 'rgba(239,68,68,0.12)', color: '#ef4444', pulse: true },
  high: { label: 'High risk', bg: 'rgba(239,68,68,0.08)', color: '#ef4444', pulse: false },
  medium: { label: 'Medium risk', bg: 'rgba(245,158,11,0.10)', color: '#f59e0b', pulse: false },
  low: { label: 'Low risk', bg: 'rgba(100,116,139,0.10)', color: '#64748b', pulse: false },
};

function getDestination(actionType, payload) {
  if (!payload) return null;
  if (actionType === 'email.send' || actionType === 'email.draft') {
    const to = Array.isArray(payload.to) ? payload.to : [payload.to].filter(Boolean);
    return to.length > 0 ? to.join(', ') : null;
  }
  if (actionType?.startsWith('drive.')) return payload.name ?? payload.folder ?? null;
  if (actionType?.startsWith('slack.')) return payload.channel ?? null;
  return null;
}

function getContentPreview(actionType, payload) {
  if (!payload) return null;
  if (actionType === 'email.send') return payload.body ?? payload.content ?? null;
  if (actionType?.startsWith('drive.')) return payload.content ?? null;
  if (actionType?.startsWith('slack.')) return payload.text ?? null;
  return null;
}

function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(() => {
    if (!expiresAt) return null;
    return Math.max(0, new Date(expiresAt).getTime() - Date.now());
  });

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (remaining === null) return null;
  if (remaining <= 0) return { label: 'Expired', isExpired: true, isUrgent: false };

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isUrgent = remaining < 5 * 60 * 1000;
  return {
    label: `${minutes}m ${String(seconds).padStart(2, '0')}s`,
    isExpired: false,
    isUrgent,
  };
}

/**
 * Shows an action pending approval — inline or from the approvals inbox.
 *
 * Props:
 *   approval    { id, actionType, payload, risk, expiresAt, createdAt }
 *   approvalToken  optional — present when shown immediately after execute (2a flow)
 *                  absent when shown from the inbox (uses approve-inline endpoint)
 *   onDone      called when approved, denied, or expired
 */
export default function ActionApprovalCard({ approval, approvalToken, onDone }) {
  const notify = useAppStore((s) => s.addNotification);
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState(null);
  const doneCalledRef = useRef(false);

  const countdown = useCountdown(approval?.expiresAt);
  const riskLevel = approval?.risk?.level ?? 'medium';
  const riskMeta = RISK_META[riskLevel] ?? RISK_META.medium;
  const actionLabel = ACTION_LABELS[approval?.actionType] ?? approval?.actionType ?? 'Unknown action';
  const destination = getDestination(approval?.actionType, approval?.payload);
  const contentPreview = getContentPreview(approval?.actionType, approval?.payload);

  const approveEndpoint = approvalToken
    ? `/actions/approvals/${approval.id}/approve`
    : `/actions/approvals/${approval.id}/approve-inline`;

  const approveMutation = useMutation({
    mutationFn: () =>
      approvalToken
        ? api.post(approveEndpoint, { token: approvalToken })
        : api.post(approveEndpoint),
    onSuccess: (result) => {
      setOutcome('approved');
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      notify({
        type: result.success ? 'success' : 'warning',
        title: result.success ? 'Action approved and executed' : 'Approved but execution failed',
        message: result.error ?? undefined,
      });
      if (!doneCalledRef.current) {
        doneCalledRef.current = true;
        onDone?.('approved', result);
      }
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Approval failed', message: getErrorMessage(error) });
    },
  });

  const denyMutation = useMutation({
    mutationFn: () =>
      approvalToken
        ? api.post(`/actions/approvals/${approval.id}/deny`, { token: approvalToken })
        : api.post(`/actions/approvals/${approval.id}/deny-inline`),
    onSuccess: () => {
      setOutcome('denied');
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      notify({ type: 'info', title: 'Action denied', message: 'Workflow marked as degraded.' });
      if (!doneCalledRef.current) {
        doneCalledRef.current = true;
        onDone?.('denied');
      }
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Denial failed', message: getErrorMessage(error) });
    },
  });

  if (!approval) return null;

  if (outcome === 'approved') {
    return (
      <div style={cardStyle}>
        <div style={{ color: '#18c7a0', fontWeight: 600, marginBottom: 4 }}>Action approved and executing…</div>
      </div>
    );
  }

  if (outcome === 'denied') {
    return (
      <div style={cardStyle}>
        <div style={{ color: '#64748b' }}>Action denied — workflow marked as degraded.</div>
      </div>
    );
  }

  if (countdown?.isExpired) {
    return (
      <div style={cardStyle}>
        <div style={{ color: '#ef4444' }}>Approval expired — action was not executed.</div>
      </div>
    );
  }

  const isPending = approveMutation.isPending || denyMutation.isPending;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#7f8cff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Action pending approval
          </div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{actionLabel}</h4>
          {destination ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              {destination}
            </div>
          ) : null}
        </div>

        <div
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 999,
            background: riskMeta.bg,
            color: riskMeta.color,
            border: `1px solid ${riskMeta.color}33`,
            animation: riskMeta.pulse ? 'pulse 1.5s infinite' : undefined,
          }}
        >
          {riskMeta.label}
        </div>
      </div>

      {contentPreview ? (
        <div
          style={{
            marginTop: 10,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            fontFamily: 'monospace',
            fontSize: 12,
            color: 'var(--text-muted)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {truncate(contentPreview, 200)}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 }}>
        <span
          style={{
            fontSize: 12,
            color: countdown?.isUrgent ? '#ef4444' : 'var(--text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {countdown ? `Expires in ${countdown.label}` : 'Expires in 30m'}
        </span>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            tone="ghost"
            onClick={() => denyMutation.mutate()}
            disabled={isPending}
          >
            Deny
          </Button>
          <Button
            tone="accent"
            onClick={() => approveMutation.mutate()}
            disabled={isPending}
          >
            Approve
          </Button>
        </div>
      </div>

      {(approveMutation.isError || denyMutation.isError) ? (
        <div style={{ marginTop: 8 }}>
          <InlineNotice tone="danger">
            {getErrorMessage(approveMutation.error ?? denyMutation.error)}
          </InlineNotice>
        </div>
      ) : null}
    </div>
  );
}

const cardStyle = {
  padding: '14px 16px',
  borderRadius: 12,
  background: 'rgba(127,140,255,0.06)',
  border: '1px solid rgba(127,140,255,0.18)',
};

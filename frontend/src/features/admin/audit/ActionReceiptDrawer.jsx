import { useState } from 'react';
import { InlineNotice, LoadingPanel } from '../../../components/ui';
import { formatDateTime } from '../../../lib/utils';
import { humanize } from '../utils';
import { AdminDetailDrawer, DetailBlock, JsonBlock, diffReceipt } from '../runtime/shared';
import { MotionList, MotionListItem, MotionSection } from '../../../components/motion';

export function ActionReceiptDrawer({ receiptQuery, onClose }) {
  const [copied, setCopied] = useState(false);
  const receipt = receiptQuery.data?.receipt;
  const before = receipt?.metadata?.before ?? {};
  const after = receipt?.metadata?.after ?? {};
  const changes = diffReceipt(before, after);

  function copyReceiptId() {
    if (!receipt?.id) return;
    navigator.clipboard.writeText(receipt.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <AdminDetailDrawer title="Immutable action receipt" eyebrow="Audit trail" onClose={onClose}>
      {receiptQuery.isLoading && !receiptQuery.data ? <LoadingPanel label="Loading action receipt..." /> : null}
      {receiptQuery.error ? <InlineNotice tone="danger">{receiptQuery.error.message}</InlineNotice> : null}
      {receipt ? (
        <div className="staff-admin__drawer-stack">
          <MotionSection reveal={{ y: 14, blur: 6 }}>
          <section className="staff-admin__drawer-section" style={{ background: 'var(--panel-soft)', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div>
                <div className="staff-admin__surface-label">Immutable log reference</div>
                <code style={{ fontSize: '12px', wordBreak: 'break-all', color: 'var(--text-strong)', fontFamily: 'monospace' }}>
                  {receipt.id}
                </code>
              </div>
              <button
                type="button"
                onClick={copyReceiptId}
                style={{ flexShrink: 0, fontSize: '12px', padding: '4px 12px', borderRadius: '999px', border: '1px solid var(--line)', background: 'transparent', color: copied ? '#18c7a0' : 'var(--text-strong)', cursor: 'pointer' }}
              >
                {copied ? 'Copied!' : 'Copy ID'}
              </button>
            </div>
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: 'var(--line)', color: 'var(--muted)' }}>
                {humanize(receipt.actorStaffRole)}
              </span>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: 'var(--line)', color: 'var(--muted)' }}>
                {receipt.permission ?? 'staff'}
              </span>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                {humanize(receipt.action)}
              </span>
            </div>
          </section>
          </MotionSection>

          <div className="staff-admin__drawer-grid">
            <DetailBlock label="Actor">{receipt.actorUserId ?? 'Unknown'}</DetailBlock>
            <DetailBlock label="Reason code">{receipt.reasonCode}</DetailBlock>
            <DetailBlock label="Target">{humanize(receipt.targetType)} | {receipt.targetId ?? 'n/a'}</DetailBlock>
            <DetailBlock label="Timestamp">{formatDateTime(receipt.createdAt)}</DetailBlock>
          </div>

          <section className="staff-admin__drawer-section">
            <div className="staff-admin__surface-label">Stated reason</div>
            <p className="staff-admin__drawer-copy">{receipt.reason ?? 'No reason attached.'}</p>
          </section>

          <section className="staff-admin__drawer-section">
            <div className="staff-admin__surface-label">Before / after diff</div>
            {changes.length === 0 ? (
              <div className="staff-admin__empty">No field diff was attached to this receipt.</div>
            ) : (
              <MotionList className="staff-admin__queue-list">
                {changes.map((change) => (
                  <MotionListItem key={change.key} className="staff-admin__queue-item" reveal={{ y: 10, blur: 3 }}>
                    <div className="staff-admin__queue-head">
                      <strong>{humanize(change.key)}</strong>
                    </div>
                    <p>Before: {stringifyValue(change.before)}</p>
                    <small>After: {stringifyValue(change.after)}</small>
                  </MotionListItem>
                ))}
              </MotionList>
            )}
          </section>

          <section className="staff-admin__drawer-section">
            <div className="staff-admin__surface-label">Attached metadata</div>
            <JsonBlock value={receipt.metadata} />
          </section>
        </div>
      ) : null}
    </AdminDetailDrawer>
  );
}

function stringifyValue(value) {
  if (value == null) {
    return 'n/a';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

import { Button } from '../../../components/ui';
import { MotionDrawer, MotionTimelineItem } from '../../../components/motion';
import { truncate } from '../../../lib/utils';
import { humanize } from '../utils';

export const TIMELINE_KIND_OPTIONS = [
  { value: 'all', label: 'All events' },
  { value: 'trace', label: 'Traces' },
  { value: 'failed_trace', label: 'Failed traces' },
  { value: 'workflow_run', label: 'Workflow runs' },
  { value: 'user_activity', label: 'User activity' },
  { value: 'admin_action', label: 'Admin actions' },
  { value: 'billing_event', label: 'Billing events' },
  { value: 'audit_log', label: 'Audit logs' },
];

export const TIMELINE_KIND_ACCENT = {
  trace: 'var(--accent)',
  failed_trace: '#ef4444',
  workflow_run: '#8b5cf6',
  user_activity: '#06b6d4',
  admin_action: '#f59e0b',
  billing_event: '#18c7a0',
  audit_log: '#94a3b8',
};

export function AdminDetailDrawer({ title, eyebrow, children, onClose }) {
  return (
    <MotionDrawer
      open
      onClose={onClose}
      className="staff-admin__drawer"
      backdropClassName="staff-admin__drawer-backdrop"
      backdropLabel="Close detail drawer"
      onClick={(event) => event.stopPropagation()}
    >
        <div className="staff-admin__drawer-head">
          <div>
            <div className="staff-admin__surface-label">{eyebrow}</div>
            <h2>{title}</h2>
          </div>
          <Button tone="ghost" onClick={onClose}>Close</Button>
        </div>
        <div className="staff-admin__drawer-body">
          {children}
        </div>
    </MotionDrawer>
  );
}

export function DetailBlock({ label, children }) {
  return (
    <MotionTimelineItem className="staff-admin__detail-block" accent="var(--accent)">
      <div className="staff-admin__surface-label">{label}</div>
      <strong>{children}</strong>
    </MotionTimelineItem>
  );
}

export function JsonBlock({ value }) {
  return (
    <pre className="staff-admin__json-block">
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  );
}

export function formatRate(count = 0, total = 0) {
  if (!total) {
    return '0%';
  }

  return `${Math.round((count / total) * 100)}%`;
}

export function summarizeDetail(detail) {
  if (!detail || typeof detail !== 'object') {
    return 'No metadata attached.';
  }

  return Object.entries(detail)
    .filter(([, value]) => value != null && value !== '')
    .slice(0, 3)
    .map(([key, value]) => `${humanize(key)}: ${truncate(String(value), 42)}`)
    .join(' / ');
}

export function diffReceipt(before = {}, after = {}) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  return keys
    .filter((key) => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null))
    .map((key) => ({
      key,
      before: before?.[key] ?? null,
      after: after?.[key] ?? null,
    }));
}

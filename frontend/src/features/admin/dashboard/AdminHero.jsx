import { Button } from '../../../components/ui';
import { formatCurrency } from '../utils';
import { formatNumber } from '../../../lib/utils';

export function AdminHero({
  data,
  seatTotals,
  indexedTotals,
  billingTotals,
  onRefresh,
  onOpenBilling,
  onOpenActivity,
}) {
  return (
    <header className="staff-admin__hero">
      <div className="staff-admin__hero-copy">
        <div className="staff-admin__surface-label">Staff control plane</div>
        <h1>Operate the platform with live product, billing, and runtime context.</h1>
        <p>
          Track workspace health, investigate traces, review failed runs, and apply admin mutations with immutable receipts.
        </p>
        <div className="staff-admin__hero-actions">
          <Button tone="accent" onClick={onRefresh}>
            Refresh live
          </Button>
          <button
            type="button"
            className="staff-admin__ghost-action"
            onClick={onOpenBilling}
          >
            Review billing
          </button>
          <button
            type="button"
            className="staff-admin__ghost-action"
            onClick={onOpenActivity}
          >
            Watch queues
          </button>
        </div>
      </div>

      <div className="staff-admin__hero-visual">
        <div className="staff-admin__hero-spotlight">
          <div className="staff-admin__surface-label">Platform pulse</div>
          <div className="staff-admin__hero-spotlight-grid">
            <article className="staff-admin__hero-stat">
              <span>Live workspaces</span>
              <strong>{formatNumber(data.summary.organisations)}</strong>
              <small>{formatNumber(data.summary.openInvites)} open invites</small>
            </article>
            <article className="staff-admin__hero-stat">
              <span>Active users</span>
              <strong>{formatNumber(data.summary.activeUsers7d)}</strong>
              <small>Seen in the last 7 days</small>
            </article>
            <article className="staff-admin__hero-stat">
              <span>Workflow queue</span>
              <strong>{formatNumber(data.pipeline.workflowRunsQueued)}</strong>
              <small>{formatNumber(data.pipeline.failedRuns)} failed runs need review</small>
            </article>
            <article className="staff-admin__hero-stat">
              <span>Knowledge queue</span>
              <strong>{formatNumber(data.pipeline.docsPending)}</strong>
              <small>{formatNumber(data.summary.documentsIndexed)} indexed documents live</small>
            </article>
          </div>
        </div>

        <div className="staff-admin__hero-telemetry">
          <div className="staff-admin__telemetry-card">
            <span>Seat usage</span>
            <strong>{seatTotals.percent.toFixed(0)}%</strong>
            <small>{formatNumber(seatTotals.members)} / {formatNumber(seatTotals.seats)} in use</small>
          </div>
          <div className="staff-admin__telemetry-card">
            <span>Knowledge coverage</span>
            <strong>{indexedTotals.percent.toFixed(0)}%</strong>
            <small>{formatNumber(indexedTotals.indexed)} indexed of {formatNumber(indexedTotals.documents)}</small>
          </div>
          <div className="staff-admin__telemetry-card">
            <span>Collection volume</span>
            <strong>{formatCurrency(billingTotals.amountPaid)}</strong>
            <small>{formatNumber(billingTotals.activeSubscriptions)} active subscriptions</small>
          </div>
        </div>
      </div>
    </header>
  );
}

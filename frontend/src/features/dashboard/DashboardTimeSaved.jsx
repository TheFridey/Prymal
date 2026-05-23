import { useEffect, useRef } from 'react';
import {
  estimateTimeSavedFromApiStats,
  formatSavedMinutes,
} from '../../lib/time-saved';
import { trackDashboardTimeSavedViewed } from '../../lib/analytics';

export default function DashboardTimeSaved({ timeSavedStats, isLoading = false }) {
  const trackedRef = useRef(false);
  const estimate = estimateTimeSavedFromApiStats(timeSavedStats);

  useEffect(() => {
    if (trackedRef.current || isLoading) {
      return;
    }
    trackedRef.current = true;
    trackDashboardTimeSavedViewed({
      is_empty: estimate.isEmpty,
      minutes_month: estimate.month.minutesTotal,
      workflows_run: estimate.month.workflowsRun,
    });
  }, [estimate.isEmpty, estimate.month.minutesTotal, estimate.month.workflowsRun, isLoading]);

  return (
    <section className="pm-dash__time-saved" aria-labelledby="dash-time-saved-title">
      <div className="pm-dash__time-saved-head">
        <h2 id="dash-time-saved-title" className="pm-dash__section-label">
          Time saved with Prymal
        </h2>
        <span className="pm-dash__time-saved-note">Estimated from completed work in each period</span>
      </div>

      {isLoading ? (
        <p className="pm-dash__time-saved-empty">Loading your activity estimates…</p>
      ) : estimate.isEmpty ? (
        <p className="pm-dash__time-saved-empty">
          Start your first task and Prymal will begin estimating time saved.
        </p>
      ) : (
        <>
          <div className="pm-dash__time-saved-metrics">
            <article className="pm-dash__time-saved-metric">
              <span>{estimate.month.label}</span>
              <strong>{formatSavedMinutes(estimate.month.minutesTotal)}</strong>
            </article>
            <article className="pm-dash__time-saved-metric">
              <span>{estimate.week.label}</span>
              <strong>{formatSavedMinutes(estimate.week.minutesTotal)}</strong>
            </article>
            <article className="pm-dash__time-saved-metric">
              <span>Completed tasks ({estimate.month.label.toLowerCase()})</span>
              <strong>{estimate.month.completedTasks}</strong>
            </article>
            <article className="pm-dash__time-saved-metric">
              <span>Workflows run ({estimate.month.label.toLowerCase()})</span>
              <strong>{estimate.month.workflowsRun}</strong>
            </article>
            <article className="pm-dash__time-saved-metric">
              <span>Est. value ({estimate.month.label.toLowerCase()})</span>
              <strong>£{estimate.month.estimatedValueGbp.toLocaleString()}</strong>
            </article>
          </div>
          <p className="pm-dash__time-saved-foot">
            Based on completed chats (2+ messages), finished workflows, delivered outputs, feedback, and media
            in each period — not lifetime totals. Illustrative only; not a billing charge.
          </p>
        </>
      )}
    </section>
  );
}

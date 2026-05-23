import { useEffect, useRef } from 'react';
import {
  buildTimeSavedInputFromViewer,
  estimateTimeSaved,
  formatSavedMinutes,
} from '../../lib/time-saved';
import { trackDashboardTimeSavedViewed } from '../../lib/analytics';

export default function DashboardTimeSaved({ viewer, billingStats }) {
  const trackedRef = useRef(false);
  const estimate = estimateTimeSaved(buildTimeSavedInputFromViewer(viewer, billingStats));

  useEffect(() => {
    if (trackedRef.current) {
      return;
    }
    trackedRef.current = true;
    trackDashboardTimeSavedViewed({
      is_empty: estimate.isEmpty,
      minutes_month: estimate.minutesMonth,
      workflows_run: estimate.workflowsRun,
    });
  }, [estimate.isEmpty, estimate.minutesMonth, estimate.workflowsRun]);

  return (
    <section className="pm-dash__time-saved" aria-labelledby="dash-time-saved-title">
      <div className="pm-dash__time-saved-head">
        <h2 id="dash-time-saved-title" className="pm-dash__section-label">
          Time saved with Prymal
        </h2>
        {estimate.isWeekEstimate ? (
          <span className="pm-dash__time-saved-note">Estimates from completed work</span>
        ) : null}
      </div>

      {estimate.isEmpty ? (
        <p className="pm-dash__time-saved-empty">
          Start your first task and Prymal will begin estimating time saved.
        </p>
      ) : (
        <>
          <div className="pm-dash__time-saved-metrics">
            <article className="pm-dash__time-saved-metric">
              <span>This month</span>
              <strong>{formatSavedMinutes(estimate.minutesMonth)}</strong>
            </article>
            <article className="pm-dash__time-saved-metric">
              <span>This week</span>
              <strong>{formatSavedMinutes(estimate.minutesWeek)}</strong>
            </article>
            <article className="pm-dash__time-saved-metric">
              <span>Completed tasks</span>
              <strong>{estimate.completedTasks}</strong>
            </article>
            <article className="pm-dash__time-saved-metric">
              <span>Workflows run</span>
              <strong>{estimate.workflowsRun}</strong>
            </article>
            <article className="pm-dash__time-saved-metric">
              <span>Est. value</span>
              <strong>£{estimate.estimatedValueGbp.toLocaleString()}</strong>
            </article>
          </div>
          <p className="pm-dash__time-saved-foot">
            Based on typical time for chats, workflows, and outputs. Not a billing charge.
          </p>
        </>
      )}
    </section>
  );
}

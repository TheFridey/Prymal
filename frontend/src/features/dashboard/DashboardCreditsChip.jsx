import { Link } from 'react-router-dom';

export default function DashboardCreditsChip({ executionBalance, videoBalance }) {
  if (!executionBalance && !videoBalance) {
    return null;
  }

  const executionPct = Math.min(Number(executionBalance?.percentUsed ?? 0), 100);
  const videoPct = Math.min(Number(videoBalance?.percentUsed ?? 0), 100);

  return (
    <div className="pm-dash__credits-row">
      {executionBalance ? (
        <Link to="/app/settings?tab=Billing" className="pm-dash__credits-chip">
          <span>Execution credits</span>
          <strong>{executionPct.toFixed(0)}% used</strong>
        </Link>
      ) : null}
      {videoBalance ? (
        <Link to="/app/settings?tab=Billing" className="pm-dash__credits-chip">
          <span>Video credits</span>
          <strong>{videoPct.toFixed(0)}% used</strong>
        </Link>
      ) : null}
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { getAgentMeta } from '../../lib/constants';
import {
  FIRST_RUN_OUTCOMES,
  FIRST_WIN_STATES,
  writeFirstWinState,
} from '../../lib/first-run-outcomes';
import { trackFirstWinSelected } from '../../lib/analytics';
import { trackProductEvent } from '../../lib/product-events';

const STRIP_OUTCOMES = FIRST_RUN_OUTCOMES.slice(0, 4);

export default function DashboardFirstWinStrip({ userId, onStateChange, firstWinNudge }) {
  const navigate = useNavigate();

  function handleSelect(outcome) {
    const nextState = writeFirstWinState(userId, {
      state: FIRST_WIN_STATES.OUTCOME_SELECTED,
      outcomeId: outcome.id,
      recommendedAgentId: outcome.recommendedAgentId,
    });
    onStateChange(nextState);
    trackFirstWinSelected({
      outcome_id: outcome.id,
      recommended_agent_id: outcome.recommendedAgentId,
      credit_intensity: outcome.creditIntensity,
      surface: 'dashboard_first_run',
    });
    void trackProductEvent('credit_estimate_shown', {
      surface: 'dashboard_first_run',
      outcome_id: outcome.id,
      credit_intensity: outcome.creditIntensity,
    });
    navigate(outcome.route);
  }

  return (
    <section className="pm-dash__first-win-strip" aria-labelledby="dash-first-win-title">
      <div className="pm-dash__first-win-strip-head">
        <h2 id="dash-first-win-title" className="pm-dash__section-label">
          Start your first useful task
        </h2>
        <p>{firstWinNudge}. Pick one outcome to open the right specialist.</p>
      </div>
      <div className="pm-dash__first-win-strip-grid">
        {STRIP_OUTCOMES.map((outcome) => {
          const agent = getAgentMeta(outcome.recommendedAgentId);
          return (
            <button
              key={outcome.id}
              type="button"
              className="pm-dash__first-win-strip-card"
              onClick={() => handleSelect(outcome)}
            >
              <strong>{outcome.title}</strong>
              <span>{outcome.plainOutcome}</span>
              <small>{agent?.name ?? outcome.recommendedAgentId} · {outcome.timeToResult}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

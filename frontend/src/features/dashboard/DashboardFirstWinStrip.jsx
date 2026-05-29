import { useNavigate } from 'react-router-dom';
import { getAgentMeta } from '../../lib/constants';
import {
  FIRST_WIN_STATES,
  STARTER_OUTCOMES,
  getStarterOutcome,
  writeFirstWinState,
} from '../../lib/first-run-outcomes';
import { trackFirstWinSelected } from '../../lib/analytics';

export default function DashboardFirstWinStrip({
  userId,
  firstWinState,
  onStateChange,
  firstWinNudge,
}) {
  const navigate = useNavigate();

  const selectedStarterOutcome = firstWinState?.starterOutcomeId
    ? getStarterOutcome(firstWinState.starterOutcomeId)
    : null;

  const isOutcomeSelected =
    firstWinState?.state &&
    firstWinState.state !== FIRST_WIN_STATES.NO_OUTCOME &&
    (firstWinState.outcomeId || firstWinState.starterOutcomeId);

  function handleStarterSelect(outcome) {
    const nextState = writeFirstWinState(userId, {
      state: FIRST_WIN_STATES.OUTCOME_SELECTED,
      starterOutcomeId: outcome.id,
      outcomeId: outcome.id,
      recommendedAgentId: outcome.recommendedAgentId,
    });
    onStateChange(nextState);
    trackFirstWinSelected({
      outcome_id: outcome.id,
      recommended_agent_id: outcome.recommendedAgentId,
      credit_intensity: outcome.creditIntensity,
      surface: 'dashboard_starter_run',
    });
    navigate(outcome.route);
  }

  if (isOutcomeSelected && selectedStarterOutcome) {
    const agent = getAgentMeta(selectedStarterOutcome.recommendedAgentId);
    return (
      <section
        className="pm-dash__first-win-strip pm-dash__first-win-strip--single"
        aria-labelledby="dash-first-win-title"
      >
        <div className="pm-dash__first-win-strip-head">
          <h2 id="dash-first-win-title" className="pm-dash__section-label">
            Your first outcome is ready
          </h2>
          <p>{firstWinNudge}.</p>
        </div>
        <div className="pm-dash__first-win-next-action" data-testid="first-win-next-action">
          <div className="pm-dash__first-win-next-action-body">
            <strong>{selectedStarterOutcome.title}</strong>
            <span>{selectedStarterOutcome.plainOutcome}</span>
            <small>{agent?.name ?? selectedStarterOutcome.recommendedAgentId} · {selectedStarterOutcome.timeToResult} · {selectedStarterOutcome.creditIntensity} cost</small>
          </div>
          <button
            type="button"
            className="pm-btn pm-btn--primary"
            onClick={() => navigate(selectedStarterOutcome.route)}
            data-testid="first-win-open-btn"
          >
            {selectedStarterOutcome.cta}
          </button>
          {firstWinState?.hasSourceOfTruth ? (
            <button
              type="button"
              className="pm-btn pm-btn--ghost"
              style={{ fontSize: '13px' }}
              onClick={() => navigate('/app/lore')}
              data-testid="first-win-lore-btn"
            >
              Add your context to LORE →
            </button>
          ) : null}
        </div>
      </section>
    );
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
        {STARTER_OUTCOMES.map((outcome) => {
          const agent = getAgentMeta(outcome.recommendedAgentId);
          return (
            <button
              key={outcome.id}
              type="button"
              className="pm-dash__first-win-strip-card"
              data-testid={`first-win-outcome-${outcome.id}`}
              onClick={() => handleStarterSelect(outcome)}
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

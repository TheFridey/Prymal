import { useNavigate } from 'react-router-dom';
import { trackDashboardRecommendedNextStepClicked } from '../../lib/analytics';

export default function DashboardRecommendedNext({ recommendation }) {
  const navigate = useNavigate();

  if (!recommendation) {
    return null;
  }

  return (
    <section className="pm-dash__recommend" aria-labelledby="dash-recommend-title">
      <h2 id="dash-recommend-title" className="pm-dash__section-label">
        Recommended next step
      </h2>
      <article className="pm-dash__recommend-card">
        <div>
          <strong>{recommendation.title}</strong>
          <p>{recommendation.description}</p>
        </div>
        <button
          type="button"
          className="pm-btn pm-btn--primary"
          onClick={() => {
            trackDashboardRecommendedNextStepClicked({
              recommendation_id: recommendation.recommendation_id,
              route: recommendation.route,
              plan_id: recommendation.plan_id,
            });
            navigate(recommendation.route);
          }}
        >
          {recommendation.ctaLabel}
        </button>
      </article>
    </section>
  );
}

import { useNavigate } from 'react-router-dom';
import { trackDashboardQuickActionClicked } from '../../lib/analytics';
import { DASHBOARD_QUICK_ACTIONS } from './dashboard-quick-actions';

export default function DashboardQuickActions() {
  const navigate = useNavigate();

  return (
    <section className="pm-dash__quick" aria-labelledby="dash-quick-actions-title">
      <h2 id="dash-quick-actions-title" className="pm-dash__section-label">
        Quick actions
      </h2>
      <div className="pm-dash__quick-grid">
        {DASHBOARD_QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              className="pm-dash__quick-card"
              onClick={() => {
                trackDashboardQuickActionClicked({
                  action_id: action.id,
                  route: action.route,
                });
                navigate(action.route);
              }}
            >
              <span className="pm-dash__quick-icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="pm-dash__quick-title">{action.title}</span>
              <span className="pm-dash__quick-benefit">{action.benefit}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { trackDashboardContinueClicked } from '../../lib/analytics';
import { getAgentMeta } from '../../lib/constants';
import { getFeaturedWorkflowTemplates } from '../../lib/workflow-templates';

function timeAgo(dateString) {
  if (!dateString) return 'Recently';
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardContinueWork({ conversations = [], workflows = [] }) {
  const navigate = useNavigate();
  const template = getFeaturedWorkflowTemplates(1)[0];

  const items = useMemo(() => {
    const rows = [];

    for (const conversation of conversations.slice(0, 4)) {
      const agent = getAgentMeta(conversation.agentId);
      rows.push({
        id: `conversation-${conversation.id}`,
        type: 'conversation',
        title: conversation.title ?? `${agent?.name ?? 'Agent'} thread`,
        meta: `${agent?.name ?? conversation.agentId} · ${timeAgo(conversation.lastActiveAt)}`,
        route: `/app/agents/${conversation.agentId}?cid=${conversation.id}`,
      });
    }

    for (const workflow of workflows.slice(0, 2)) {
      rows.push({
        id: `workflow-${workflow.id}`,
        type: 'workflow',
        title: workflow.name ?? 'Workflow',
        meta: `${workflow.runCount ?? 0} runs · ${workflow.isActive ? 'Active' : 'Paused'}`,
        route: '/app/workflows',
      });
    }

    if (template) {
      rows.push({
        id: `template-${template.slug}`,
        type: 'template',
        title: template.name,
        meta: 'Workflow template',
        route: `/app/workflows?view=builder&template=${encodeURIComponent(template.slug)}`,
      });
    }

    return rows.slice(0, 6);
  }, [conversations, template, workflows]);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="pm-dash__continue" aria-labelledby="dash-continue-title">
      <h2 id="dash-continue-title" className="pm-dash__section-label">
        Continue work
      </h2>
      <ul className="pm-dash__continue-list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="pm-dash__continue-item"
              onClick={() => {
                trackDashboardContinueClicked({
                  item_type: item.type,
                  route: item.route,
                });
                navigate(item.route);
              }}
            >
              <span className="pm-dash__continue-type">{item.type}</span>
              <span className="pm-dash__continue-copy">
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </span>
              <span className="pm-dash__continue-cta">Continue</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

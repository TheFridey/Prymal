import { AgentAvatar } from '../../components/ui';
import { MotionCard, MotionList, MotionListItem, MotionSection } from '../../components/motion';
import { getAgentMeta } from '../../lib/constants';

function SignalBoardPanel({ panel }) {
  return (
    <MotionCard
      className={`prymal-signal-board__panel${panel.wide ? ' prymal-signal-board__panel--wide' : ''}`}
      accent={panel.accent}
    >
      <div className="prymal-signal-board__panel-label">{panel.label}</div>
      {panel.value ? <div className="prymal-signal-board__panel-value">{panel.value}</div> : null}
      {panel.copy ? <div className="prymal-signal-board__panel-copy">{panel.copy}</div> : null}

      {panel.chips?.length ? (
        <div className="prymal-signal-board__audience-row">
          {panel.chips.map((chip) => (
            <span key={chip} className="mini-chip">
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      {panel.bars?.length ? (
        <div className="prymal-usecase-bars">
          {panel.bars.map((bar) => (
            <div key={bar.label} className="prymal-usecase-bars__row">
              <span>{bar.label}</span>
              <div className="prymal-usecase-bars__track">
                <span style={{ width: bar.width }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {panel.timeline?.length ? (
        <MotionList className="prymal-signal-board__timeline">
          {panel.timeline.map((item, index) => (
            <MotionListItem key={`${item.label}-${index}`} className="prymal-signal-board__timeline-item">
              <div className="prymal-signal-board__timeline-index">{String(index + 1).padStart(2, '0')}</div>
              <div>
                <div style={{ color: 'var(--text-strong)', marginBottom: '4px' }}>{item.label}</div>
                <div className="prymal-signal-board__panel-copy">{item.detail}</div>
              </div>
            </MotionListItem>
          ))}
        </MotionList>
      ) : null}
    </MotionCard>
  );
}

export function UseCaseSignalBoard({
  eyebrow,
  title,
  statusLabel,
  lead,
  agentIds = [],
  panels = [],
}) {
  const agents = agentIds.map((id) => getAgentMeta(id)).filter(Boolean);

  return (
    <MotionSection className="prymal-signal-board" delay={0.04} reveal={{ y: 26, blur: 8 }}>
      <div className="prymal-signal-board__header">
        <div>
          <div className="prymal-signal-board__eyebrow">{eyebrow}</div>
          <div className="prymal-signal-board__title">{title}</div>
        </div>
        {statusLabel ? (
          <div className="prymal-signal-board__pulse">
            <span className="prymal-signal-board__pulse-dot" />
            {statusLabel}
          </div>
        ) : null}
      </div>

      <div className="prymal-signal-board__hero-card">
        <div>
          <div className="prymal-signal-board__hero-label">{lead.label}</div>
          <div className="prymal-signal-board__hero-title">{lead.title}</div>
          <div className="prymal-signal-board__hero-text">{lead.copy}</div>
        </div>

        <div className="prymal-signal-board__agent-stack">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="prymal-signal-board__agent-chip"
              style={{ '--chip-accent': agent.color }}
            >
              <AgentAvatar agent={agent} size={60} active />
              <div>
                <div className="prymal-signal-board__agent-name">{agent.name}</div>
                <div className="prymal-signal-board__agent-role">{agent.title}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="prymal-signal-board__grid">
        {panels.map((panel) => (
          <SignalBoardPanel key={panel.label} panel={panel} />
        ))}
      </div>
    </MotionSection>
  );
}

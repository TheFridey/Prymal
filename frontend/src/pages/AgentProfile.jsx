import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { AGENT_LIBRARY, INTEGRATION_LIBRARY, POWERUP_LIBRARY, getAgentMeta } from '../lib/constants';
import { AgentAvatar, BrandMark, Button, Reveal, StatusPill, ThemeToggle } from '../components/ui';
import { PageMeta } from '../components/PublicPageChrome';
import { usePrymalReducedMotion } from '../components/motion';
import { MagicalCanvas } from '../features/marketing/MagicalCanvas';
import '../styles/landing-rebuild.css';

export default function AgentProfile() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const agent = getAgentMeta(agentId);

  if (!agent) {
    return <Navigate to="/" replace />;
  }

  const relatedIntegrations = Object.values(INTEGRATION_LIBRARY).filter((integration) =>
    integration.agentIds.includes(agent.id),
  );
  const companionAgents = AGENT_LIBRARY.filter((entry) => entry.id !== agent.id).slice(0, 4);
  const agentPowerUps = POWERUP_LIBRARY.filter((entry) => entry.agentId === agent.id);

  const reducedMotion = usePrymalReducedMotion();

  return (
    <div className="agent-profile-shell pm-page">
      <MagicalCanvas reducedMotion={reducedMotion} />
      <PageMeta
        title={`${agent.name} — ${agent.title} | Prymal`}
        description={agent.description}
        canonicalPath={`/agents/${agent.id}`}
      />
      <div className="agent-profile-nav">
        <Link to="/">
          <BrandMark compact />
        </Link>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link className="marketing-link" to="/">Home</Link>
          <SignedOut>
            <Link className="marketing-link" to="/login">Login</Link>
          </SignedOut>
          <ThemeToggle />
        </div>
      </div>

      <div className="agent-profile-stage" style={{ '--agent-accent': agent.color }}>
        <Reveal>
          <aside className="agent-profile-showcase">
            <div className="agent-profile-showcase__header">
              <div className="hero-pill" style={{ borderColor: `${agent.color}33`, color: agent.color }}>
                Agent profile
              </div>
              <button type="button" className="agent-profile-showcase__badge">
                {agent.name}
              </button>
            </div>

            <div className="agent-profile-showcase__avatar-wrap">
              <div className="agent-profile-showcase__glow" />
              <AgentAvatar agent={agent} size={280} active className="agent-profile-showcase__avatar" />
            </div>

            <div className="agent-profile-showcase__copy">
              <div className="agent-profile-showcase__name">{agent.name}</div>
              <div className="agent-profile-showcase__title">{agent.title}</div>
              <p className="agent-profile-showcase__description">{agent.description}</p>
            </div>

            <div className="agent-profile-showcase__actions">
              <SignedOut>
                <Link to="/signup"><Button tone="accent" block>Start Prymal</Button></Link>
              </SignedOut>
              <SignedIn>
                <Link to={`/app/agents/${agent.id}`}><Button tone="accent" block>Open in workspace</Button></Link>
              </SignedIn>
              <Link to="/"><Button tone="ghost" block>Back to platform</Button></Link>
            </div>

            <div className="agent-profile-showcase__prompts">
              {agent.prompts.slice(0, 3).map((prompt) => (
                <div key={prompt} className="agent-profile-showcase__prompt">{prompt}</div>
              ))}
            </div>
          </aside>
        </Reveal>

        <Reveal delay={60}>
          <div className="agent-profile-stage-main">
            <section className="agent-profile-command">
              <div className="agent-profile-command__meta">
                <StatusPill color={agent.color}>{agent.name}</StatusPill>
                <StatusPill color="var(--text-strong)">Specialist role</StatusPill>
                <StatusPill color="var(--muted)">{agent.focusAreas[0]}</StatusPill>
              </div>
              <h1 className="agent-profile-title">{agent.title}</h1>
              <p className="agent-profile-copy">{agent.overview}</p>

              <div className="agent-profile-command__stats">
                {agent.stats.map((entry) => (
                  <div key={entry.label} className="agent-profile-command__stat">
                    <div className="agent-profile-command__stat-value">{entry.value}</div>
                    <div className="agent-profile-command__stat-label">{entry.label}</div>
                  </div>
                ))}
              </div>
            </section>

            {agent.characterStory?.length ? (
              <section className="agent-profile-story feature-panel">
                <div className="eyebrow" style={{ '--eyebrow-accent': agent.color }}>
                  Field notes{agent.animal ? ` / ${agent.animal}` : ''}
                </div>
                <h2 className="agent-profile-story__title">The character behind {agent.name}.</h2>
                <div className="agent-profile-story__body">
                  {agent.characterStory.map((paragraph) => (
                    <p key={paragraph} className="agent-profile-story__copy">{paragraph}</p>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </Reveal>
      </div>

      <div className="agent-profile-grid">
        <div style={{ display: 'grid', gap: '16px' }}>
          <Reveal>
            <section className="feature-panel">
              <div className="marketing-section__header" style={{ marginBottom: '10px' }}>
                <div>
                  <div className="eyebrow" style={{ '--eyebrow-accent': agent.color }}>Mission</div>
                  <h2 className="marketing-section__heading" style={{ fontSize: '2rem' }}>{agent.mission}</h2>
                </div>
              </div>
              <p className="agent-highlight__copy" style={{ fontSize: '0.96rem' }}>{agent.personality}</p>
              <div className="detail-list" style={{ marginTop: '14px' }}>
                {agent.deliverables.map((item) => (
                  <div key={item} className="detail-list__item">
                    <div className="detail-list__label">Deliverable</div>
                    <div className="detail-list__value">{item}</div>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>

          <Reveal delay={80}>
            <section className="timeline">
              <div>
                <div className="eyebrow" style={{ '--eyebrow-accent': agent.color }}>Operational loop</div>
                <h2 className="marketing-section__heading" style={{ fontSize: '2rem', marginBottom: '10px' }}>
                  How {agent.name} works inside Prymal.
                </h2>
              </div>
              {agent.workflow.map((item, index) => (
                <div key={item} className="timeline__item">
                  <div className="timeline__index" style={{ color: agent.color }}>{index + 1}</div>
                  <div>
                    <div className="timeline__eyebrow">Step {index + 1}</div>
                    <div className="agent-highlight__title" style={{ fontSize: '1rem' }}>{item}</div>
                    <p className="timeline__copy">
                      Prymal keeps this step scoped to the organisation, so outputs remain tied to your workspace context rather than generic chat history.
                    </p>
                  </div>
                </div>
              ))}
            </section>
          </Reveal>

          {agentPowerUps.length > 0 ? (
            <Reveal delay={100}>
              <section className="feature-panel">
                <div className="eyebrow" style={{ '--eyebrow-accent': agent.color }}>Power-ups</div>
                <h2 className="marketing-section__heading" style={{ fontSize: '2rem', marginBottom: '12px' }}>
                  Ready-made prompts for {agent.name}.
                </h2>
                <div className="integration-grid">
                  {agentPowerUps.map((powerUp) => (
                    <div key={powerUp.slug} className="integration-card">
                      <div className="agent-highlight__title" style={{ marginBottom: '8px' }}>{powerUp.name}</div>
                      <p className="agent-highlight__copy">{powerUp.description}</p>
                      <SignedIn>
                        <Button
                          tone="ghost"
                          style={{ marginTop: '12px' }}
                          onClick={() => navigate(`/app/agents/${agent.id}?powerup=${encodeURIComponent(powerUp.slug)}&new=1`)}
                        >
                          Run this power-up
                        </Button>
                      </SignedIn>
                      <SignedOut>
                        <Link to="/signup">
                          <Button tone="ghost" style={{ marginTop: '12px' }}>Start Prymal to use</Button>
                        </Link>
                      </SignedOut>
                    </div>
                  ))}
                </div>
              </section>
            </Reveal>
          ) : null}

          {relatedIntegrations.length > 0 ? (
            <Reveal delay={120}>
              <section className="feature-panel">
                <div className="eyebrow" style={{ '--eyebrow-accent': agent.color }}>Connected stack</div>
                <h2 className="marketing-section__heading" style={{ fontSize: '2rem', marginBottom: '12px' }}>
                  Strongest when linked to live tools.
                </h2>
                <div className="integration-grid">
                  {relatedIntegrations.map((integration) => (
                    <div key={integration.name} className="integration-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start', marginBottom: '10px' }}>
                        <div>
                          <div className="detail-list__label">{integration.category}</div>
                          <div className="agent-highlight__title">{integration.name}</div>
                        </div>
                        <div
                          className="agent-profile-glyph"
                          style={{
                            width: '44px',
                            height: '44px',
                            color: integration.color,
                            border: `1px solid ${integration.color}33`,
                            background: `${integration.color}14`,
                          }}
                        >
                          {integration.icon}
                        </div>
                      </div>
                      <p className="agent-highlight__copy">{integration.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            </Reveal>
          ) : null}
        </div>

        <div style={{ display: 'grid', gap: '16px' }}>
          <Reveal delay={80}>
            <aside className="agent-profile-panel">
              <div className="eyebrow" style={{ '--eyebrow-accent': agent.color }}>Operating lane</div>
              <div className="stack-list">
                <div className="stack-list__item">
                  <div className="detail-list__label">Focus areas</div>
                  <div className="mini-chip-row">
                    {agent.focusAreas.map((item) => (
                      <span key={item} className="mini-chip">{item}</span>
                    ))}
                  </div>
                </div>
                <div className="stack-list__item">
                  <div className="detail-list__label">Best for</div>
                  <div className="mini-chip-row">
                    {agent.idealFor.map((item) => (
                      <span key={item} className="mini-chip">{item}</span>
                    ))}
                  </div>
                </div>
                <div className="stack-list__item">
                  <div className="detail-list__label">System role</div>
                  <div className="detail-list__value">
                    {agent.name} is not a generic assistant. It is one specialist inside a wider 13-agent operating model with shared workspace memory.
                  </div>
                </div>
                <div className="stack-list__item">
                  <div className="detail-list__label">Quality bar</div>
                  <div className="detail-list__value">
                    It is tuned to produce outputs that can move into a workflow, a handoff, or a client deliverable without another full rewrite.
                  </div>
                </div>
              </div>
            </aside>
          </Reveal>

          <Reveal delay={150}>
            <aside className="agent-profile-panel">
              <div className="eyebrow" style={{ '--eyebrow-accent': agent.color }}>Companion agents</div>
              <div style={{ display: 'grid', gap: '10px' }}>
                {companionAgents.map((entry) => (
                  <Link key={entry.id} to={`/agents/${entry.id}`} className="agent-card" style={{ '--agent-color': entry.color, padding: '18px' }}>
                    <AgentAvatar agent={entry} size={72} className="agent-card__glyph" />
                    <div className="agent-card__name">{entry.name}</div>
                    <div className="agent-card__title">{entry.title}</div>
                    <div className="agent-card__description">{entry.description}</div>
                  </Link>
                ))}
              </div>
            </aside>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

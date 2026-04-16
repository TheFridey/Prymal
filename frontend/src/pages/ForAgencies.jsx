import { Link } from 'react-router-dom';
import { AgentAvatar, Button, PageShell } from '../components/ui';
import { MotionCard, MotionList, MotionListItem, MotionSection, usePrymalReducedMotion } from '../components/motion';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { getAgentMeta } from '../lib/constants';
import { AgentAvatarDisplay } from '../features/marketing/AgentAvatarDisplay';
import { MagicalCanvas } from '../features/marketing/MagicalCanvas';
import '../styles/landing-rebuild.css';
import '../styles/app-rebuild.css';

const agencyAgents = ['herald', 'forge', 'echo', 'vance', 'atlas']
  .map((agentId) => getAgentMeta(agentId))
  .filter(Boolean);

const heroMetrics = [
  { value: '<5 min', label: 'to first client-ready output' },
  { value: '5 lanes', label: 'covered inside one agency pod' },
  { value: '1 control plane', label: 'for briefs, delivery, and reporting' },
];

const agencyPainPoints = [
  {
    title: 'New business keeps eating delivery time',
    detail:
      'VANCE qualifies and frames the opportunity, HERALD handles follow-up, and FORGE packages the offer before the pitch work hijacks the whole week.',
  },
  {
    title: 'Campaign work gets rebuilt for every channel',
    detail:
      'FORGE shapes the core message, ECHO turns it into channel-native variants, and the handoff stays coherent instead of fragmenting across tabs.',
  },
  {
    title: 'Client reporting arrives late and reads like homework',
    detail:
      'CIPHER and LORE pull the evidence together into something sharp, credible, and client-readable instead of a midnight deck scramble.',
  },
  {
    title: 'Projects drift because ownership is implied, not mapped',
    detail:
      'ATLAS turns vague coordination into milestones, owners, dependencies, and an execution path the team can actually follow.',
  },
];

const agencyOperatingLanes = [
  {
    agentId: 'herald',
    lane: 'Outreach and client comms',
    detail:
      'Keeps prospecting, follow-ups, stakeholder updates, renewals, and launch announcements moving with sharper timing and cleaner copy.',
    deliverables: ['Outbound ladders', 'Renewal nudges', 'Client update emails'],
  },
  {
    agentId: 'forge',
    lane: 'Content and positioning',
    detail:
      'Builds landing copy, campaign narratives, ad angles, and long-form assets that sound considered instead of machine-generated.',
    deliverables: ['Homepage copy', 'Launch narratives', 'Campaign messaging'],
  },
  {
    agentId: 'echo',
    lane: 'Social and repurposing',
    detail:
      'Turns approved content into LinkedIn, X, short-form social, and founder voice posts without flattening the original idea.',
    deliverables: ['Post sequences', 'Hook packs', 'Repurposed campaign sets'],
  },
  {
    agentId: 'vance',
    lane: 'Proposals and deal movement',
    detail:
      'Sharpens scope framing, lead qualification, offer positioning, and next-step messaging so commercial momentum stops stalling.',
    deliverables: ['Proposal skeletons', 'Deal progression notes', 'ICP-fit scoring'],
  },
  {
    agentId: 'atlas',
    lane: 'Delivery operations',
    detail:
      'Converts team plans into milestones, owners, dependencies, and working delivery structure the whole account team can follow.',
    deliverables: ['Launch plans', 'Milestone maps', 'Dependency registers'],
  },
];

const campaignPipeline = [
  {
    agentId: 'forge',
    label: 'Shape the idea',
    detail:
      'FORGE turns the brief, target-account context, and commercial objective into one clear campaign concept with stronger hierarchy and positioning.',
    output: 'Campaign angle, hooks, and first-pass copy system',
  },
  {
    agentId: 'echo',
    label: 'Stretch it across channels',
    detail:
      'ECHO repackages the approved idea into social cuts, teaser posts, launch variants, and founder content without losing tone.',
    output: 'Multi-channel rollout pack',
  },
  {
    agentId: 'herald',
    label: 'Handle the human-facing comms',
    detail:
      'HERALD writes the client update, launch note, follow-up email, and stakeholder narrative around the work.',
    output: 'Client-ready communication ladder',
  },
  {
    agentId: 'atlas',
    label: 'Operationalise the delivery',
    detail:
      'ATLAS turns the campaign into owners, deadlines, approvals, risks, and dependencies so the whole thing can actually ship on time.',
    output: 'Execution plan with milestones and owners',
  },
];

const weeklyRhythm = [
  {
    day: 'Monday',
    title: 'Brief intake',
    detail: 'LORE centralises the context, FORGE frames the angle, and ATLAS maps the week before the kickoff note even goes out.',
  },
  {
    day: 'Tuesday',
    title: 'Production sprint',
    detail: 'FORGE and ECHO build content variations while CIPHER turns raw campaign data into a readable insight layer.',
  },
  {
    day: 'Wednesday',
    title: 'Client-facing polish',
    detail: 'HERALD packages updates, approvals, and follow-ups so account managers are not rewriting everything by hand.',
  },
  {
    day: 'Thursday',
    title: 'Commercial follow-through',
    detail: 'VANCE sharpens the next-step offer, renewal note, or upsell angle while ATLAS keeps the delivery plan honest.',
  },
  {
    day: 'Friday',
    title: 'Reporting and reset',
    detail: 'CIPHER summarises what moved, what stalled, and what needs attention next week so the team leaves with clarity.',
  },
];

const proofRows = [
  {
    label: 'Replace scattered prompt tabs',
    before: 'One strategist, one account manager, and one copy lead all rewriting the same context.',
    after: 'Shared LORE context plus role-based agents working from the same operating picture.',
  },
  {
    label: 'Reduce delivery rework',
    before: 'Approved ideas get reshaped from scratch for every channel, client note, and proposal.',
    after: 'One idea becomes a repeatable execution chain with consistent handoffs.',
  },
  {
    label: 'Protect senior time',
    before: 'Sharp people spend their best hours formatting, recapping, and following up.',
    after: 'Prymal handles the repetitive layer so human judgment goes back to strategy and relationships.',
  },
];

const faqItems = [
  {
    question: 'Does this replace account managers or strategists?',
    answer:
      'No. Prymal gives them leverage. It takes the repetitive work that drains margin and turns it into a coordinated system, while the team stays in charge of taste, approvals, and commercial judgement.',
  },
  {
    question: 'Can an agency use one workspace for multiple clients?',
    answer:
      'Yes. Teams can keep shared operational memory inside the organisation while controlling what gets stored, uploaded, or structured in LORE for each workflow or delivery lane.',
  },
  {
    question: 'Is this only for content agencies?',
    answer:
      'No. The mix works for growth agencies, creative shops, service firms, consultancies, and hybrid operators that need proposals, reporting, planning, follow-up, and repeatable execution in one place.',
  },
  {
    question: 'What makes Prymal different from generic AI chat tools?',
    answer:
      'The agents are role-based, the context is grounded, the memory is scoped, and the outputs are structured around business work rather than clever one-off prompts.',
  },
];

export default function ForAgencies() {
  const reducedMotion = usePrymalReducedMotion();
  const trackSignup = (source) => {
    if (typeof window !== 'undefined' && typeof window.prymalTrack === 'function') {
      window.prymalTrack('signup_button_clicked', { source });
    }
  };

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title="Prymal for Agencies | Your AI content, outreach, and ops team"
        description="Give your agency an AI pod for outreach, content, proposals, delivery planning, and client comms. First useful output in under 5 minutes."
        canonicalPath="/for-agencies"
      />
      <JsonLd
        id="schema-faq-agencies"
        schema={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqItems.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        }}
      />

      <MagicalCanvas reducedMotion={reducedMotion} />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="agencies" onSignupClick={trackSignup} />

        <PageShell width="100%">
          <div className="prymal-usecase-page__inner">
            <section className="pm-uc-hero" style={{ '--uc-accent': '#7f8cff', '--uc-accent-end': '#68f5d0' }}>
              <div className="pm-uc-hero__eyebrow">
                <span className="pm-uc-hero__eyebrow-dot" />
                For agencies
              </div>
              <h1 className="pm-uc-hero__title">
                An agency <span>operating pod</span> for campaigns, comms, and delivery.
              </h1>
              <p className="pm-uc-hero__desc">
                Prymal gives agencies a live AI system for the messy middle of service delivery: follow-ups, content, planning, reporting, and the operational handoffs that usually consume the sharpest hours of the week.
              </p>
              <div className="pm-uc-hero__metrics">
                {heroMetrics.map((m) => (
                  <div key={m.label} className="pm-uc-hero__metric">
                    <span className="pm-uc-hero__metric-value">{m.value}</span>
                    <span className="pm-uc-hero__metric-label">{m.label}</span>
                  </div>
                ))}
              </div>
              <div className="pm-uc-hero__ctas">
                <Link to="/signup" className="pm-btn pm-btn--primary" onClick={() => trackSignup('agencies-hero')}>Start free →</Link>
                <a href="/#pricing" className="pm-btn pm-btn--ghost">See plans</a>
              </div>
              <div className="pm-uc-hero__chips">
                {['Client-ready drafts', 'Shared LORE memory', 'NEXUS workflow handoffs', 'Operator receipts'].map((chip) => (
                  <span key={chip} className="pm-uc-hero__chip">{chip}</span>
                ))}
              </div>
              <div className="pm-uc-hero__agents">
                {agencyAgents.map((agent) => (
                  <Link key={agent.id} to={`/agents/${agent.id}`} className="pm-uc-hero__agent" style={{ '--agent-color': agent.color }}>
                    <AgentAvatarDisplay agent={agent} className="pm-uc-hero__agent-avatar" />
                    <span className="pm-uc-hero__agent-name">{agent.name}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="prymal-section prymal-usecase-section">
              <div className="prymal-section__header">
                <div>
                  <div className="eyebrow" style={{ '--eyebrow-accent': '#68f5d0' }}>Invisible time sinks</div>
                  <h2 className="marketing-section__heading">Prymal is strongest where agencies lose time in invisible layers.</h2>
                </div>
                <p className="marketing-section__copy">
                  The platform is not just faster writing. It is operational continuity: shared context, better handoffs, sharper
                  client-facing polish, and less duplication across the same account work.
                </p>
              </div>

              <MotionList className="prymal-usecase-grid prymal-usecase-grid--four">
                {agencyPainPoints.map((item) => (
                  <MotionListItem key={item.title}>
                    <MotionCard className="prymal-usecase-card" accent="#7f8cff">
                      <h3>{item.title}</h3>
                      <p>{item.detail}</p>
                    </MotionCard>
                  </MotionListItem>
                ))}
              </MotionList>
            </section>

            <section className="prymal-section prymal-usecase-section">
              <div className="prymal-section__header">
                <div>
                  <div className="eyebrow" style={{ '--eyebrow-accent': '#ff8e6a' }}>Role coverage</div>
                  <h2 className="marketing-section__heading">Five specialist lanes covering the agency work that still gets done by hand.</h2>
                </div>
                <p className="marketing-section__copy">
                  Each lane has a defined commercial job. Together they behave like a coordinated delivery pod rather than a box of interchangeable prompts.
                </p>
              </div>

              <MotionList className="prymal-usecase-grid prymal-usecase-grid--five">
                {agencyOperatingLanes.map((lane) => {
                  const agent = getAgentMeta(lane.agentId);
                  return (
                    <MotionListItem key={lane.agentId}>
                      <MotionCard className="prymal-usecase-lane" accent={agent?.color}>
                        <div className="prymal-usecase-lane__top">
                          <AgentAvatar agent={agent} size={90} className="prymal-usecase-lane__avatar" />
                          <div>
                            <div className="prymal-usecase-lane__name">{agent?.name}</div>
                            <div className="prymal-usecase-lane__role">{lane.lane}</div>
                          </div>
                        </div>
                        <p>{lane.detail}</p>
                        <div className="prymal-usecase-lane__chips">
                          {lane.deliverables.map((item) => (
                            <span key={item} className="mini-chip">{item}</span>
                          ))}
                        </div>
                        <Link to={`/agents/${agent.id}`} className="prymal-usecase-link">
                          Explore {agent?.name}
                        </Link>
                      </MotionCard>
                    </MotionListItem>
                  );
                })}
              </MotionList>
            </section>

            <section className="prymal-section prymal-usecase-section">
              <div className="prymal-section__header">
                <div>
                  <div className="eyebrow" style={{ '--eyebrow-accent': '#7f8cff' }}>Pipeline story</div>
                  <h2 className="marketing-section__heading">A four-agent campaign chain that feels like real delivery, not a marketing demo.</h2>
                </div>
                <p className="marketing-section__copy">
                  The creative system, client comms, and execution planning stay synchronized because the same context is carried all the way through.
                </p>
              </div>

              <MotionList className="prymal-usecase-flow">
                {campaignPipeline.map((step, index) => {
                  const agent = getAgentMeta(step.agentId);
                  return (
                    <MotionListItem key={step.label}>
                      <MotionCard className="prymal-usecase-flow__step" accent={agent?.color}>
                        <div className="prymal-usecase-flow__index">0{index + 1}</div>
                        <AgentAvatar agent={agent} size={72} />
                        <div className="prymal-usecase-flow__body">
                          <div className="prymal-usecase-flow__label">{step.label}</div>
                          <p>{step.detail}</p>
                        </div>
                        <div className="prymal-usecase-flow__output">
                          <span>Output</span>
                          <strong>{step.output}</strong>
                        </div>
                      </MotionCard>
                    </MotionListItem>
                  );
                })}
              </MotionList>
            </section>

            <section className="prymal-section prymal-usecase-section prymal-usecase-section--split">
              <MotionSection className="prymal-usecase-proof">
                <MotionCard className="prymal-usecase-proof-card" accent="#68f5d0">
                  <div className="eyebrow" style={{ '--eyebrow-accent': '#68f5d0' }}>Where the return shows up</div>
                  <h3>Better continuity, less rework, stronger use of senior agency time.</h3>
                  <div className="prymal-usecase-proof-list">
                    {proofRows.map((row) => (
                      <div key={row.label} className="prymal-usecase-proof-row">
                        <div className="prymal-usecase-proof-row__label">{row.label}</div>
                        <div className="prymal-usecase-proof-row__before">Before: {row.before}</div>
                        <div className="prymal-usecase-proof-row__after">After: {row.after}</div>
                      </div>
                    ))}
                  </div>
                </MotionCard>
              </MotionSection>

              <MotionSection className="prymal-usecase-proof">
                <MotionCard className="prymal-usecase-proof-card" accent="#ff8e6a">
                  <div className="eyebrow" style={{ '--eyebrow-accent': '#ff8e6a' }}>Weekly operating rhythm</div>
                  <h3>A cadence the team can actually adopt without changing how the agency works.</h3>
                  <div className="prymal-usecase-rhythm">
                    {weeklyRhythm.map((item) => (
                      <div key={item.day} className="prymal-usecase-rhythm__item">
                        <div className="prymal-usecase-rhythm__day">{item.day}</div>
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </MotionCard>
              </MotionSection>
            </section>

            <section className="prymal-section prymal-usecase-section">
              <div className="prymal-section__header">
                <div>
                  <div className="eyebrow" style={{ '--eyebrow-accent': '#b8d7ff' }}>Practical questions</div>
                  <h2 className="marketing-section__heading">Enough structure to be useful. Enough flexibility to fit the account team.</h2>
                </div>
              </div>

              <MotionList className="prymal-usecase-grid prymal-usecase-grid--two">
                {faqItems.map((item) => (
                  <MotionListItem key={item.question}>
                    <MotionCard className="prymal-usecase-card prymal-usecase-card--faq" accent="#b8d7ff">
                      <h3>{item.question}</h3>
                      <p>{item.answer}</p>
                    </MotionCard>
                  </MotionListItem>
                ))}
              </MotionList>
            </section>

            <MotionSection className="prymal-cta">
              <div className="prymal-cta__panel prymal-cta__panel--split">
                <div>
                  <div className="eyebrow" style={{ '--eyebrow-accent': '#68f5d0' }}>Start the pod</div>
                  <h2>Create a workspace now and get your first client-facing output in the same session.</h2>
                  <p>
                    Start free, connect one source of context, pick the lane you need most, and move from brief to useful draft without spinning up extra process.
                  </p>
                </div>
                <div className="prymal-cta__actions">
                  <Link to="/signup" onClick={() => trackSignup('agencies-footer')}>
                    <Button tone="accent">Start free</Button>
                  </Link>
                  <a href="/#pricing">
                    <Button tone="ghost">See plans</Button>
                  </a>
                </div>
              </div>
            </MotionSection>
          </div>
        </PageShell>

        <PublicPageFooter />
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { AgentAvatar, Button, PageShell } from '../components/ui';
import { MotionCard, MotionList, MotionListItem, MotionSection } from '../components/motion';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { getAgentMeta } from '../lib/constants';
import { UseCaseHero } from '../features/marketing/UseCaseHero';
import { UseCaseSignalBoard } from '../features/marketing/UseCaseSignalBoard';

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
  const trackSignup = (source) => {
    if (typeof window !== 'undefined' && typeof window.prymalTrack === 'function') {
      window.prymalTrack('signup_button_clicked', { source });
    }
  };

  return (
    <div className="marketing-page prymal-marketing prymal-usecase-page prymal-usecase-page--agencies">
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

      <div className="prymal-marketing__aura prymal-marketing__aura--one" />
      <div className="prymal-marketing__aura prymal-marketing__aura--two" />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="agencies" onSignupClick={trackSignup} />

        <PageShell width="100%">
          <div className="prymal-usecase-page__inner">
            <UseCaseHero
              eyebrow="For agencies"
              title="An agency operating pod for campaigns, client comms, proposals, and delivery control."
              description="Prymal gives agencies a live AI system for the messy middle of service delivery: follow-ups, content, planning, reporting, and the operational handoffs that usually consume the sharpest hours of the week."
              metrics={heroMetrics}
              trustChips={['Client-ready drafts', 'Shared LORE memory', 'NEXUS workflow handoffs', 'Operator receipts']}
              sceneAgentIds={['forge', 'herald', 'echo', 'atlas', 'vance', 'lore']}
              primaryAction={{ label: 'Start free', to: '/signup', onClick: () => trackSignup('agencies-hero') }}
              secondaryAction={{ label: 'See plans', href: '/#pricing' }}
              hudCards={[
                {
                  title: 'Agency command pod',
                  body: 'One brief fans out into positioning, channel content, stakeholder comms, and execution planning without losing the thread.',
                  position: 'prymal-cinematic-stage__hud-card--top',
                },
                {
                  title: 'Trust layer',
                  chips: ['LORE', 'SENTINEL', 'Receipts'],
                  position: 'prymal-cinematic-stage__hud-card--left',
                },
                {
                  title: 'Commercial continuity',
                  body: 'Ops, delivery, reporting, and next-step movement stay linked inside the same workspace.',
                  position: 'prymal-cinematic-stage__hud-card--bottom',
                },
              ]}
              stageClassName="prymal-cinematic-stage--agency"
            />

            <UseCaseSignalBoard
              eyebrow="Live delivery view"
              title="What one agency workflow can feel like when the system is actually orchestrated."
              statusLabel="Agency pod active"
              lead={{
                label: 'Campaign command pod',
                title: 'One client brief becomes outreach, production, delivery structure, and reporting rhythm.',
                copy:
                  'Instead of copying the same context between tabs, Prymal keeps the narrative, evidence, and next-step movement connected from first draft to client-facing recap.',
              }}
              agentIds={['forge', 'echo', 'herald', 'atlas']}
              panels={[
                {
                  label: 'Client brief in',
                  value: 'Launch a Q2 demand-generation campaign for a B2B SaaS retainer.',
                  copy: 'The system pulls in brand context, prior campaign memory, search signals, and delivery constraints before anyone starts rewriting the brief.',
                  accent: '#7f8cff',
                },
                {
                  label: 'Outputs moving back',
                  timeline: [
                    { label: 'Campaign narrative', detail: 'A sharper angle, positioning hierarchy, and launch copy system.' },
                    { label: 'Channel repurposing', detail: 'LinkedIn, email, and teaser variants built from the same approved idea.' },
                    { label: 'Client follow-through', detail: 'Stakeholder update, owner list, and milestone mapping ready to ship.' },
                  ],
                  accent: '#68f5d0',
                },
                {
                  label: 'Commercial effect',
                  copy: 'The agency gets faster delivery, fewer handoff gaps, and better use of senior attention.',
                  bars: [
                    { label: 'Pitch-to-delivery continuity', width: '82%' },
                    { label: 'Client-ready comms speed', width: '74%' },
                    { label: 'Reporting clarity', width: '88%' },
                  ],
                  accent: '#ff8e6a',
                },
                {
                  label: 'Pod signals',
                  chips: ['Shared memory', 'Run receipts', 'Workflow replay', 'Citation-backed outputs'],
                  copy: 'The system feels less like AI chat and more like a premium operating layer for service delivery.',
                  wide: true,
                  accent: '#b8d7ff',
                },
              ]}
            />

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

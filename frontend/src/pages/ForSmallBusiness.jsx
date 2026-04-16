import { Link } from 'react-router-dom';
import { AgentAvatar, Button, PageShell } from '../components/ui';
import { MotionCard, MotionList, MotionListItem, MotionSection, usePrymalReducedMotion } from '../components/motion';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { getAgentMeta } from '../lib/constants';
import { UseCaseHero } from '../features/marketing/UseCaseHero';
import { UseCaseSignalBoard } from '../features/marketing/UseCaseSignalBoard';
import { MagicalCanvas } from '../features/marketing/MagicalCanvas';
import '../styles/landing-rebuild.css';

const smbAgents = ['wren', 'herald', 'oracle', 'cipher', 'ledger']
  .map((agentId) => getAgentMeta(agentId))
  .filter(Boolean);

const heroMetrics = [
  { value: '15', label: 'specialist agents in one workspace' },
  { value: '50', label: 'free credits to test the first win' },
  { value: 'GBP 39/mo', label: 'starting point for a live AI team' },
];

const businessPressurePoints = [
  {
    title: 'Customers still need answers when you are busy selling',
    detail:
      'WREN keeps support replies calm, clear, and human so the inbox does not become another night shift for the founder.',
  },
  {
    title: 'Follow-ups keep slipping because real work keeps winning',
    detail:
      'HERALD keeps leads, quotes, reminders, and customer nudges moving so opportunities do not disappear through silence.',
  },
  {
    title: 'The website needs improvement, but nobody has time to audit it',
    detail:
      'ORACLE reviews copy, intent fit, and search opportunities so your site starts pulling its weight instead of just existing online.',
  },
  {
    title: 'Numbers arrive, but insight does not',
    detail:
      'CIPHER and LEDGER turn exports, reports, and transaction summaries into something you can actually use to make a decision this week.',
  },
];

const smbOperatingLanes = [
  {
    agentId: 'wren',
    lane: 'Support and customer replies',
    detail:
      'Handles everyday support writing, resolution notes, and FAQ drafting with the kind of clarity that protects trust when your team is stretched.',
    outputs: ['Support drafts', 'Resolution templates', 'FAQ packs'],
  },
  {
    agentId: 'herald',
    lane: 'Sales emails and follow-up',
    detail:
      'Keeps leads warm, writes polished follow-ups, and turns half-finished owner notes into messages that actually move the conversation.',
    outputs: ['Lead follow-ups', 'Reminder emails', 'Lifecycle outreach'],
  },
  {
    agentId: 'oracle',
    lane: 'SEO and site opportunity',
    detail:
      'Surfaces obvious search gaps, homepage mismatches, and content opportunities so your site can work harder without an agency retainer.',
    outputs: ['SEO briefs', 'Homepage audits', 'Search opportunity lists'],
  },
  {
    agentId: 'cipher',
    lane: 'Business analysis',
    detail:
      'Reads the exports you have, spots anomalies, and explains what changed in plain business language instead of spreadsheet folklore.',
    outputs: ['Trend summaries', 'Anomaly reviews', 'Decision-ready analysis'],
  },
  {
    agentId: 'ledger',
    lane: 'Reporting and finance summaries',
    detail:
      'Packages operational and financial movement into a report you can review quickly, share cleanly, and act on confidently.',
    outputs: ['Weekly reports', 'Cashflow summaries', 'Board-ready recaps'],
  },
];

const comparisonRows = [
  ['Support handling cover', 'GBP 1,600+/mo', 'Included inside Prymal'],
  ['Sales email and follow-up time', 'GBP 1,200+/mo', 'Included inside Prymal'],
  ['SEO review and content guidance', 'GBP 1,000+/mo', 'Included inside Prymal'],
  ['Reporting and spreadsheet analysis', 'GBP 1,400+/mo', 'Included inside Prymal'],
  ['Operational finance summaries', 'GBP 1,000+/mo', 'Included inside Prymal'],
];

const firstWeekPlan = [
  {
    step: 'Day 1',
    title: 'Connect one useful source of context',
    detail:
      'Add your website, upload a doc, or drop in a recurring report so Prymal has something real to work from immediately.',
  },
  {
    step: 'Day 2',
    title: 'Pick the first problem that already costs time',
    detail:
      'Support, follow-up emails, reporting, and website review are the fastest routes to visible value for small teams.',
  },
  {
    step: 'Day 3',
    title: 'Reuse the winning output',
    detail:
      'Turn one strong reply, report, or audit into a repeatable prompt, a saved pattern, or a NEXUS workflow.',
  },
  {
    step: 'Day 4-5',
    title: 'Make it part of the weekly rhythm',
    detail:
      'By the end of the week, the repetitive layer is no longer living purely in your head or your inbox.',
  },
];

const dailyRhythm = [
  {
    moment: 'Morning',
    title: 'Clear the inbox pressure first',
    detail: 'WREN and HERALD cover support replies, customer updates, and lead follow-ups while you focus on real conversations.',
    outcome: 'Inbox under control before lunch',
    outcomeDetail: 'Customer replies, lead nudges, and owner updates stop stacking up before the day properly starts.',
  },
  {
    moment: 'Midday',
    title: 'Review what is moving commercially',
    detail: 'CIPHER turns your latest numbers into a quick insight pass so decisions happen before the day disappears.',
    outcome: 'Faster decisions with less guesswork',
    outcomeDetail: 'The numbers turn into readable signal instead of sitting in a spreadsheet until next week.',
  },
  {
    moment: 'Afternoon',
    title: 'Improve the website or offer system',
    detail: 'ORACLE surfaces what the market is looking for and where your pages are underserving that demand.',
    outcome: 'A clearer route to more demand',
    outcomeDetail: 'You finish the day knowing what to fix on the site, what to say better, and where attention should go next.',
  },
  {
    moment: 'End of week',
    title: 'Close the loop with a clean report',
    detail: 'LEDGER packages the week into a readable summary you can use for next-step planning.',
    outcome: 'A weekly wrap you can act on',
    outcomeDetail: 'The week ends with a usable summary rather than a vague feeling that a lot happened but nothing was captured properly.',
  },
];

const faqItems = [
  {
    question: 'Do I need a team to get value from Prymal?',
    answer:
      'No. Prymal is designed for owner-led businesses and lean teams first. The point is to take repeatable work off your plate before you need to hire across multiple functions.',
  },
  {
    question: 'Will this feel too technical to set up?',
    answer:
      'It should not. The fastest route is to connect one source of context, open the first relevant agent, and send a real task. The product is designed around first output, not configuration theatre.',
  },
  {
    question: 'What if my work is spread across docs, websites, and spreadsheets?',
    answer:
      'That is exactly where Prymal helps. LORE stores shared knowledge, agents can inspect URLs, and the analysis stack is built to deal with imperfect exports and messy business context.',
  },
  {
    question: 'Can I start free before deciding on a paid plan?',
    answer:
      'Yes. The free plan includes 50 credits and foundational agent access, so you can test the first useful workflow without adding a card.',
  },
];

export default function ForSmallBusiness() {
  const reducedMotion = usePrymalReducedMotion();
  const trackSignup = (source) => {
    if (typeof window !== 'undefined' && typeof window.prymalTrack === 'function') {
      window.prymalTrack('signup_button_clicked', { source });
    }
  };

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title="Prymal for Small Business | 15 AI agents from GBP 39/month"
        description="Support, follow-ups, reporting, and website review handled by specialist AI agents. Built for owner-led businesses and lean teams."
        canonicalPath="/for-small-business"
      />
      <JsonLd
        id="schema-faq-smb"
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
        <PublicPageNavbar sourcePrefix="small-business" onSignupClick={trackSignup} />

        <PageShell width="100%">
          <div className="prymal-usecase-page__inner">
            <UseCaseHero
              eyebrow="For small business"
              title="A premium AI operating layer for the recurring work founders and lean teams never get back."
              description="Prymal helps small businesses clear support, follow-ups, reporting, SEO review, and weekly operating admin fast enough to feel the relief immediately, not eventually."
              metrics={heroMetrics}
              trustChips={['Support cover', 'Follow-up system', 'Website review', 'Weekly reporting']}
              sceneAgentIds={['wren', 'herald', 'oracle', 'cipher', 'ledger', 'lore']}
              primaryAction={{ label: 'Start free', to: '/signup', onClick: () => trackSignup('small-business-hero') }}
              secondaryAction={{ label: 'See pricing', href: '/#pricing' }}
              hudCards={[
                {
                  title: 'Owner-mode relief',
                  body: 'The system covers the repetitive work that usually steals time from selling, delivery, and actual decision-making.',
                  position: 'prymal-cinematic-stage__hud-card--top',
                },
                {
                  title: 'High-trust outputs',
                  chips: ['WREN', 'ORACLE', 'LEDGER'],
                  position: 'prymal-cinematic-stage__hud-card--left',
                },
                {
                  title: 'First-week value',
                  body: 'Support, site review, and reporting are the fastest routes to a visible win for a lean team.',
                  position: 'prymal-cinematic-stage__hud-card--bottom',
                },
              ]}
              stageClassName="prymal-cinematic-stage--small-business"
            />

            <UseCaseSignalBoard
              eyebrow="First-week operating picture"
              title="What Prymal can take off your plate in the first week."
              statusLabel="Owner mode active"
              lead={{
                label: 'Small-team command view',
                title: 'Inbox pressure, lead follow-up, reporting, and site fixes stop competing for the same human hour.',
                copy:
                  'The value is not one giant automation project. It is turning dozens of repeatable jobs into a calmer, clearer operating rhythm that actually holds.',
              }}
              agentIds={['wren', 'herald', 'oracle', 'cipher']}
              panels={[
                {
                  label: 'Owner reality',
                  value: 'Inbox, leads, reports, and site changes all waiting at once.',
                  copy: 'Prymal works best when the pressure comes from too many recurring jobs rather than one big transformation project.',
                  accent: '#68f5d0',
                },
                {
                  label: 'Immediate wins',
                  timeline: [
                    { label: 'Support drafts', detail: 'Calm, customer-friendly replies and FAQ-ready patterns.' },
                    { label: 'Lead movement', detail: 'Warm follow-ups, reminders, and next-step messages ready to send.' },
                    { label: 'Reporting clarity', detail: 'Weekly summaries that explain what changed and what to do next.' },
                  ],
                  accent: '#7f8cff',
                },
                {
                  label: 'Where time comes back',
                  copy: 'Small businesses do not need more dashboards. They need recurring work to stop stealing attention.',
                  bars: [
                    { label: 'Support cover', width: '76%' },
                    { label: 'Follow-up continuity', width: '81%' },
                    { label: 'Weekly reporting clarity', width: '72%' },
                  ],
                  accent: '#ff8e6a',
                },
                {
                  label: 'System signals',
                  chips: ['LORE context', 'Voice input', 'NEXUS workflows', 'Source-backed analysis'],
                  copy: 'The same platform can clear the immediate jobs, then turn the winners into repeatable workflows once the team is ready.',
                  wide: true,
                  accent: '#b8d7ff',
                },
              ]}
            />

            <section className="prymal-section prymal-usecase-section">
              <div className="prymal-section__header">
                <div>
                  <div className="eyebrow" style={{ '--eyebrow-accent': '#68f5d0' }}>Pressure points</div>
                  <h2 className="marketing-section__heading">Small businesses do not need more dashboards. They need the boring work handled.</h2>
                </div>
                <p className="marketing-section__copy">
                  The fastest path to value is practical: pick the recurring task that drains energy, match it to the right agent, and make the first useful output part of the week.
                </p>
              </div>

              <MotionList className="prymal-usecase-grid prymal-usecase-grid--four">
                {businessPressurePoints.map((item) => (
                  <MotionListItem key={item.title}>
                    <MotionCard className="prymal-usecase-card" accent="#68f5d0">
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
                  <div className="eyebrow" style={{ '--eyebrow-accent': '#ff8e6a' }}>Specialist lanes</div>
                  <h2 className="marketing-section__heading">Five specialist lanes for the work a small team still has to get done.</h2>
                </div>
                <p className="marketing-section__copy">
                  The product works best when it takes responsibility for real recurring jobs: support, follow-up, analysis, reporting, and the website improvements that keep getting deferred.
                </p>
              </div>

              <MotionList className="prymal-usecase-grid prymal-usecase-grid--five">
                {smbOperatingLanes.map((lane) => {
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
                          {lane.outputs.map((item) => (
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

            <section className="prymal-section prymal-usecase-section prymal-usecase-section--split">
              <MotionSection className="prymal-usecase-proof">
                <MotionCard className="prymal-usecase-proof-card" accent="#ff8e6a">
                  <div className="eyebrow" style={{ '--eyebrow-accent': '#ff8e6a' }}>What those jobs cost separately</div>
                  <h3>One operating layer replaces a surprising amount of piecemeal spend.</h3>
                  <div className="prymal-usecase-comparison">
                    {comparisonRows.map(([label, cost, replacement]) => (
                      <div key={label} className="prymal-usecase-comparison__row">
                        <div>
                          <div className="prymal-usecase-proof-row__label">{label}</div>
                          <div className="prymal-usecase-proof-row__before">{cost}</div>
                        </div>
                        <div className="prymal-usecase-comparison__replacement">{replacement}</div>
                      </div>
                    ))}
                  </div>
                </MotionCard>
              </MotionSection>

              <MotionSection className="prymal-usecase-proof">
                <MotionCard className="prymal-usecase-proof-card" accent="#7f8cff">
                  <div className="eyebrow" style={{ '--eyebrow-accent': '#7f8cff' }}>First-week plan</div>
                  <h3>A simple adoption path that gets to the first useful output fast.</h3>
                  <div className="prymal-usecase-rhythm">
                    {firstWeekPlan.map((item) => (
                      <div key={item.step} className="prymal-usecase-rhythm__item">
                        <div className="prymal-usecase-rhythm__day">{item.step}</div>
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
                  <div className="eyebrow" style={{ '--eyebrow-accent': '#b8d7ff' }}>Normal business week</div>
                  <h2 className="marketing-section__heading">Prymal works best when it becomes part of the weekly operating rhythm.</h2>
                </div>
                <p className="marketing-section__copy">
                  The premium experience matters because the product should feel calm and clear even when the business is not.
                </p>
              </div>

              <MotionList className="prymal-usecase-flow">
                {dailyRhythm.map((item) => (
                  <MotionListItem key={item.moment}>
                    <MotionCard className="prymal-usecase-flow__step prymal-usecase-flow__step--compact" accent="#b8d7ff">
                      <div className="prymal-usecase-flow__index">{item.moment}</div>
                      <div className="prymal-usecase-flow__body">
                        <div className="prymal-usecase-flow__label">{item.title}</div>
                        <p>{item.detail}</p>
                      </div>
                      <div className="prymal-usecase-flow__output">
                        <span>{item.outcome}</span>
                        <strong>{item.outcomeDetail}</strong>
                      </div>
                    </MotionCard>
                  </MotionListItem>
                ))}
              </MotionList>
            </section>

            <section className="prymal-section prymal-usecase-section">
              <div className="prymal-section__header">
                <div>
                  <div className="eyebrow" style={{ '--eyebrow-accent': '#68f5d0' }}>Practical questions</div>
                  <h2 className="marketing-section__heading">Designed to feel practical on day one, not impressive by week eight.</h2>
                </div>
              </div>

              <MotionList className="prymal-usecase-grid prymal-usecase-grid--two">
                {faqItems.map((item) => (
                  <MotionListItem key={item.question}>
                    <MotionCard className="prymal-usecase-card prymal-usecase-card--faq" accent="#68f5d0">
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
                  <div className="eyebrow" style={{ '--eyebrow-accent': '#68f5d0' }}>Start the week better</div>
                  <h2>Open a workspace, connect one source, and let Prymal clear the first recurring job this week.</h2>
                  <p>
                    Start free, test the first useful workflow, and keep the parts that genuinely reduce pressure on the business.
                  </p>
                </div>
                <div className="prymal-cta__actions">
                  <Link to="/signup" onClick={() => trackSignup('small-business-footer')}>
                    <Button tone="accent">Start free</Button>
                  </Link>
                  <a href="/#pricing">
                    <Button tone="ghost">See pricing</Button>
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

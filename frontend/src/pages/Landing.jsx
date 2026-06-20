import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TbBolt,
  TbBrain,
  TbBuildingStore,
  TbChecks,
  TbCircleCheck,
  TbCircleX,
  TbDatabase,
  TbFileAnalytics,
  TbRoute,
  TbShieldCheck,
  TbSparkles,
  TbUsersGroup,
} from 'react-icons/tb';
import {
  AGENT_LIBRARY,
  AGENT_UI_LAYERS,
  PLAN_LIBRARY,
  getWorkspacePlanMeta,
  sortAgentsByUiHierarchy,
} from '../lib/constants';
import { api } from '../lib/api';
import { getErrorMessage } from '../lib/utils';
import { Button, InlineNotice, PageShell, TextInput } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { AnswerBlock, FAQSection, LinkCardGrid } from '../components/PublicContent';
import { AgentAvatarDisplay } from '../features/marketing/AgentAvatarDisplay';
import CookieConsentBanner from '../components/CookieConsentBanner';
import { SimpleAdvancedModeSection } from '../features/marketing/SimpleAdvancedModeSection';
import { SeePrymalInActionSection } from '../features/marketing/SeePrymalInActionSection';
import { HomeProofStrip } from '../features/marketing/HomeProofStrip';
import { PublicCtaAnchor, PublicCtaLink } from '../components/PublicCta';
import { trackPublicEvent } from '../lib/public-analytics';
import {
  buildOrganizationSchema,
  buildSoftwareApplicationSchema,
  buildWebPageSchema,
  buildWebSiteSchema,
} from '../lib/seo';
import { HOME_AEO_BLOCK, HOME_FAQ_ITEMS, PUBLIC_OG_DEFAULTS } from '../lib/site-content';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

const PARADE_EXCLUDE = new Set(['sentinel', ...AGENT_UI_LAYERS.core]);
const AGENT_PARADE_DATA = AGENT_LIBRARY.filter((a) => !PARADE_EXCLUDE.has(a.id)).map((agent) => {
  const iconMap = {
    cipher: [{ emoji: '📊', x: '-20%', y: '-15%' }, { emoji: '🔍', x: '85%', y: '10%' }],
    herald: [{ emoji: '✉️', x: '-25%', y: '0%' }, { emoji: '📨', x: '80%', y: '-20%' }],
    echo: [{ emoji: '💙', x: '-15%', y: '-25%' }, { emoji: '📱', x: '88%', y: '5%' }],
    oracle: [{ emoji: '🔮', x: '-20%', y: '-10%' }, { emoji: '📈', x: '82%', y: '-18%' }],
    scout: [{ emoji: '🗺️', x: '-22%', y: '5%' }, { emoji: '🔭', x: '85%', y: '-15%' }],
    lore: [{ emoji: '📚', x: '-18%', y: '-20%' }, { emoji: '✨', x: '88%', y: '0%' }],
    forge: [{ emoji: '✏️', x: '-20%', y: '-10%' }, { emoji: '📝', x: '85%', y: '-15%' }],
    atlas: [{ emoji: '🗓️', x: '-22%', y: '0%' }, { emoji: '📋', x: '84%', y: '-10%' }],
    vance: [{ emoji: '🎯', x: '-20%', y: '-15%' }, { emoji: '💰', x: '86%', y: '5%' }],
    wren: [{ emoji: '💬', x: '-18%', y: '-20%' }, { emoji: '❤️', x: '88%', y: '-10%' }],
    ledger: [{ emoji: '📊', x: '-20%', y: '0%' }, { emoji: '💹', x: '84%', y: '-18%' }],
    nexus: [{ emoji: '⚡', x: '-22%', y: '-10%' }, { emoji: '🔗', x: '86%', y: '0%' }],
    pixel: [{ emoji: '🎨', x: '-20%', y: '-15%' }, { emoji: '🖼️', x: '85%', y: '5%' }],
    sage: [{ emoji: '🧠', x: '-18%', y: '-10%' }, { emoji: '💡', x: '86%', y: '-15%' }],
  };
  return { ...agent, icons: iconMap[agent.id] || [] };
});

const HOW_IT_WORKS = [
  {
    agent: 'lore',
    headline: 'Feed it your world.',
    copy: 'Upload docs, paste URLs, add brand guidelines. LORE indexes everything and makes it available to every other agent automatically.',
    color: '#C77DFF',
  },
  {
    agent: 'nexus',
    headline: 'Build workflows that run themselves.',
    copy: 'Chain agents in sequence. HERALD drafts the email, CIPHER checks the numbers, ORACLE optimises the copy. Set it once.',
    color: '#BDE0FE',
  },
  {
    agent: 'sentinel',
    headline: 'Nothing ships without a review.',
    copy: 'SENTINEL checks every output before you see it. PASS, REPAIR, or HOLD. No hallucinations slipping through.',
    color: '#F72585',
  },
];

/** Visual order: ATLAS — NEXUS — LORE (NEXUS remains first in `AGENT_UI_LAYERS.core` for app chrome sort). */
const CORE_TRIO_VISUAL = ['atlas', 'nexus', 'lore']
  .map((id) => AGENT_LIBRARY.find((a) => a.id === id))
  .filter(Boolean);

const INTELLIGENCE_SHOWCASE_AGENTS = AGENT_UI_LAYERS.intelligence
  .map((id) => AGENT_LIBRARY.find((a) => a.id === id))
  .filter(Boolean);
const EXECUTION_SHOWCASE_AGENTS = AGENT_UI_LAYERS.execution
  .map((id) => AGENT_LIBRARY.find((a) => a.id === id))
  .filter(Boolean);
const SPECIALIST_SHOWCASE_AGENTS = AGENT_UI_LAYERS.specialist
  .map((id) => AGENT_LIBRARY.find((a) => a.id === id))
  .filter(Boolean);
const BENTO_AGENTS = [...AGENT_LIBRARY.filter((a) => a.id !== 'sentinel')].sort(sortAgentsByUiHierarchy);

const EXECUTION_STEPS = [
  { agent: 'lore', label: 'Context loaded', detail: 'LORE retrieves relevant knowledge from your workspace.', color: '#C77DFF' },
  { agent: 'cipher', label: 'Data analysed', detail: 'CIPHER processes the numbers and finds the signal.', color: '#33c7ff' },
  { agent: 'herald', label: 'Draft composed', detail: 'HERALD shapes the output into a client-ready message.', color: '#ff8b5f' },
  { agent: 'sentinel', label: 'QA reviewed', detail: 'SENTINEL checks for accuracy, schema compliance, and risk.', color: '#F72585' },
];

const HERO_FLOW = [
  { label: 'User', detail: 'Brief or trigger', Icon: TbUsersGroup, color: '#9cf5e0' },
  { label: 'Agents', detail: '15 specialists coordinate', Icon: TbSparkles, color: '#c77dff' },
  { label: 'Memory', detail: 'LORE recalls context', Icon: TbBrain, color: '#ffd166' },
  { label: 'Workflow', detail: 'NEXUS runs the steps', Icon: TbRoute, color: '#4cc9f0' },
  { label: 'Output', detail: 'Validated and ready', Icon: TbShieldCheck, color: '#ff6b9a' },
];

const HERO_TRUST = [
  'Multi-agent system',
  'Built-in memory (LORE)',
  'Workflow automation',
  'Output validation (SENTINEL)',
];

const DIFFERENCE_COLUMNS = [
  {
    title: 'Typical AI tools',
    tone: 'dim',
    items: ['Chat-based', 'No memory', 'No workflows', 'Unvalidated outputs', 'Costs scale unpredictably'],
  },
  {
    title: 'Prymal',
    tone: 'brand',
    items: [
      'Multi-agent execution',
      'Persistent memory (LORE)',
      'Workflow engine',
      'SENTINEL QA validation',
      'Cost control + usage system',
    ],
  },
];

const SYSTEM_STACK = [
  { title: 'AGENTS', meta: '15 specialists', copy: 'Specialist operators for content, research, sales, planning, support, and more.', Icon: TbSparkles, color: '#c77dff' },
  { title: 'LORE', meta: 'memory + context', copy: 'Workspace knowledge, documents, and source-backed context shared across execution.', Icon: TbDatabase, color: '#ffd166' },
  { title: 'WORKFLOWS', meta: 'automation engine', copy: 'Repeatable multi-step runs that coordinate agents instead of leaving work in chat.', Icon: TbRoute, color: '#4cc9f0' },
  { title: 'SENTINEL', meta: 'validation layer', copy: 'QA checks outputs before delivery so weak results get repaired or held.', Icon: TbShieldCheck, color: '#ff6b9a' },
  { title: 'BILLING + CONTROL', meta: 'cost governance', copy: 'Credits, limits, visibility, and plan controls for predictable scaling.', Icon: TbBolt, color: '#9cf5e0' },
];

const USE_CASES = [
  {
    title: 'Generate full content pipelines',
    copy: 'Turn a brief into research, outlines, drafts, repurposed posts, and reviewed deliverables.',
    Icon: TbFileAnalytics,
  },
  {
    title: 'Audit websites and fix issues',
    copy: 'Find conversion, SEO, messaging, and quality gaps, then turn them into an action plan.',
    Icon: TbChecks,
  },
  {
    title: 'Build lead generation workflows',
    copy: 'Move from target list to outreach strategy, follow-up copy, and sales-ready next steps.',
    Icon: TbBuildingStore,
  },
  {
    title: 'Automate recurring business tasks',
    copy: 'Run repeatable processes for reporting, research, support prep, and client delivery.',
    Icon: TbRoute,
  },
];

const SIGNED_OUT_WORKFLOW_ROUTE = '/signup?redirect_url=%2Fapp%2Fworkflows';

function useDeferredMagicalCanvas() {
  const [CanvasComponent, setCanvasComponent] = useState(null);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(min-width: 921px)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const canLoadCanvas = () => (
      mediaQuery.matches
      && !reducedMotionQuery.matches
      && !connection?.saveData
      && !/(^|-)2g$/.test(connection?.effectiveType ?? '')
    );

    let cancelled = false;
    let loaded = false;
    let timeoutId = 0;

    const loadCanvas = () => {
      if (loaded || cancelled || !canLoadCanvas()) return;
      loaded = true;
      import('../features/marketing/MagicalCanvas')
        .then((mod) => {
          if (!cancelled) {
            setCanvasComponent(() => mod.MagicalCanvas);
          }
        })
        .catch(() => {});
    };

    timeoutId = window.setTimeout(loadCanvas, 30_000);
    window.addEventListener('pointerdown', loadCanvas, { once: true, passive: true });
    window.addEventListener('keydown', loadCanvas, { once: true });
    window.addEventListener('scroll', loadCanvas, { once: true, passive: true });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener('pointerdown', loadCanvas);
      window.removeEventListener('keydown', loadCanvas);
      window.removeEventListener('scroll', loadCanvas);
    };
  }, []);

  return CanvasComponent;
}

export default function Landing() {
  const [email, setEmail] = useState('');
  const [waitlistResult, setWaitlistResult] = useState(null);
  const [waitlistPending, setWaitlistPending] = useState(false);
  const [specialistsOpen, setSpecialistsOpen] = useState(false);
  const scopeRef = useRef(null);
  const MagicalCanvas = useDeferredMagicalCanvas();

  const freePlan = getWorkspacePlanMeta('free');

  const trackSignup = (source) => {
    trackPublicEvent('signup_button_clicked', { source });
  };

  useEffect(() => {
    if (waitlistResult?.tone) {
      const timeoutId = window.setTimeout(() => setWaitlistResult(null), 4200);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [waitlistResult]);

  const handleWaitlistSubmit = async (event) => {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail) {
      setWaitlistResult({ tone: 'warning', message: 'Enter your email address so we know where to send the invite.' });
      return;
    }

    setWaitlistPending(true);
    try {
      await api.post('/waitlist', { email: nextEmail, source: 'landing_page' });
      setWaitlistResult({
        tone: 'success',
        message: 'You are on the waitlist. We will send the invite as soon as your workspace is ready.',
      });
      setEmail('');
    } catch (error) {
      setWaitlistResult({ tone: 'danger', message: getErrorMessage(error, 'Unable to join the waitlist right now.') });
    } finally {
      setWaitlistPending(false);
    }
  };

        // Hero stat counter — counts up to 15 on scroll into view
  return (
    <div ref={scopeRef} className="marketing-page prymal-marketing prymal-marketing--home">
      <PageMeta
        title={PUBLIC_OG_DEFAULTS.home.title}
        description={PUBLIC_OG_DEFAULTS.home.description}
        canonicalPath="/"
        ogImage={PUBLIC_OG_DEFAULTS.home.image}
        ogImageAlt={PUBLIC_OG_DEFAULTS.home.imageAlt}
      />
      <JsonLd
        id="schema-home-product"
        schema={buildSoftwareApplicationSchema({
          description:
            'Prymal is a multi-agent AI operating system with specialist agents, SENTINEL QA, grounded memory, workflow orchestration, and an operator-grade control plane.',
          offers: [
            { '@type': 'Offer', name: freePlan.name, price: '0', priceCurrency: 'GBP' },
            ...PLAN_LIBRARY.map((plan) => ({
              '@type': 'Offer',
              name: plan.name,
              price: String(plan.monthlyPrice),
              priceCurrency: 'GBP',
            })),
          ],
        })}
      />
      <JsonLd id="schema-home-organization" schema={buildOrganizationSchema()} />
      <JsonLd id="schema-home-website" schema={buildWebSiteSchema()} />
      <JsonLd
        id="schema-home-webpage"
        schema={buildWebPageSchema({
          name: PUBLIC_OG_DEFAULTS.home.title,
          description: PUBLIC_OG_DEFAULTS.home.description,
          path: '/',
        })}
      />
      {MagicalCanvas ? <MagicalCanvas startDelayMs={0} /> : null}

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="landing" onSignupClick={trackSignup} />

        <PageShell width="100%">
          <div className="prymal-homepage prymal-homepage--primal">

            {/* ── Hero + core constellation ── */}
            <section className="pm-hero">
              <div className="pm-hero__intro">
                <div className="pm-hero__badge">
                  <span className="pm-hero__badge-dot" />
                  AI operating system for business execution
                </div>

                <h1 className="pm-hero__headline">
                  Run your business with AI <span className="pm-hero__headline--glow">not just prompts</span>
                </h1>

                <p className="pm-hero__sub">
                  Prymal is a multi-agent AI system that executes real workflows, remembers context, and delivers validated outputs.
                </p>
              </div>

              <div className="pm-hero-flow" aria-label="Prymal execution flow">
                <div className="pm-hero-flow__beam" aria-hidden="true" />
                <div className="pm-hero-flow__grid">
                  {HERO_FLOW.map(({ label, detail, Icon, color }, index) => (
                    <div
                      key={label}
                      className="pm-hero-flow__node"
                      style={{ '--flow-color': color, '--flow-delay': `${index * 0.12}s` }}
                    >
                      <span className="pm-hero-flow__icon" aria-hidden="true">
                        <Icon />
                      </span>
                      <span className="pm-hero-flow__label">{label}</span>
                      <span className="pm-hero-flow__detail">{detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pm-hero__ctas">
                <PublicCtaLink
                  to={SIGNED_OUT_WORKFLOW_ROUTE}
                  cta="start-workflows"
                  surface="landing-hero"
                  intent="convert"
                  className="pm-btn pm-btn--primary"
                >
                  Start building workflows
                </PublicCtaLink>
                <PublicCtaAnchor
                  href="#how-it-works"
                  cta="see-how-it-works"
                  surface="landing-hero"
                  intent="learn"
                  className="pm-btn pm-btn--ghost"
                >
                  See how it works
                </PublicCtaAnchor>
              </div>

              <div className="pm-hero__trust" aria-label="Prymal trust signals">
                {HERO_TRUST.map((item) => (
                  <span key={item}><TbCircleCheck aria-hidden="true" /> {item}</span>
                ))}
              </div>
              <p className="pm-hero__trust-link">
                <Link to="/trust">Trust Centre</Link>
                {' '}
                — safety, data boundaries, and readiness without overclaiming certifications.
              </p>
            </section>

            <HomeProofStrip />

            <AnswerBlock title={HOME_AEO_BLOCK.title} answer={HOME_AEO_BLOCK.answer} />

            <section id="how-it-works" className="pm-difference">
              <div className="pm-section__header">
                <div className="pm-section__eyebrow" style={{ '--section-accent': '#9cf5e0' }}>Why this is different</div>
                <h2 className="pm-section__title">Most AI tools help you write. Prymal helps you execute.</h2>
              </div>
              <div className="pm-difference__grid">
                {DIFFERENCE_COLUMNS.map((column) => {
                  const Mark = column.tone === 'brand' ? TbCircleCheck : TbCircleX;
                  return (
                    <div key={column.title} className={`pm-difference__panel pm-difference__panel--${column.tone}`}>
                      <h3>{column.title}</h3>
                      <ul>
                        {column.items.map((item) => (
                          <li key={item}>
                            <Mark aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="pm-system-stack">
              <div className="pm-section__header">
                <div className="pm-section__eyebrow" style={{ '--section-accent': '#C77DFF' }}>System stack</div>
                <h2 className="pm-section__title">An AI system, not a single tool</h2>
                <p className="pm-section__sub">Prymal connects specialists, memory, automation, validation, and cost controls into one execution layer.</p>
              </div>
              <div className="pm-system-stack__diagram">
                {SYSTEM_STACK.map(({ title, meta, copy, Icon, color }, index) => (
                  <div
                    key={title}
                    className="pm-system-stack__block"
                    style={{ '--stack-color': color, '--stack-delay': `${index * 0.12}s` }}
                  >
                    <span className="pm-system-stack__icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="pm-system-stack__meta">{meta}</span>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="pm-use-cases">
              <div className="pm-section__header">
                <div className="pm-section__eyebrow" style={{ '--section-accent': '#FFD166' }}>What you can actually do</div>
                <h2 className="pm-section__title">Turn business work into repeatable execution.</h2>
              </div>
              <div className="pm-use-cases__grid">
                {USE_CASES.map(({ title, copy, Icon }) => (
                  <article key={title} className="pm-use-cases__card">
                    <span className="pm-use-cases__icon" aria-hidden="true"><Icon /></span>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </article>
                ))}
              </div>
            </section>

            <SimpleAdvancedModeSection surface="landing" />

            <SeePrymalInActionSection surface="landing" />

            {/* ── Layered agent system ── */}
            <section id="agents" className="pm-agent-showcase">
              <div className="pm-agent-showcase__header">
                <div className="pm-section__eyebrow" style={{ '--section-accent': '#C77DFF' }}>Agent system</div>
                <h2 className="pm-section__title">One spine. Four layers.</h2>
                <p className="pm-section__sub">Scale, light, and motion show what matters first — not a flat grid of equals.</p>
              </div>

              <div className="pm-agent-showcase__stack">
                <div className="pm-agent-showcase__layer pm-agent-showcase__layer--core">
                  <div className="pm-agent-showcase__layer-label">Core</div>
                  <div className="pm-agent-showcase__core-row">
                    {CORE_TRIO_VISUAL.map((agent) => (
                      <Link
                        key={agent.id}
                        to={`/agents/${agent.id}`}
                        className={`pm-showcase-card pm-showcase-card--core${agent.id === 'nexus' ? ' pm-showcase-card--nexus' : ''}`}
                        style={{ '--agent-color': agent.color }}
                      >
                        <span className="pm-showcase-card__glow" aria-hidden="true" />
                        <AgentAvatarDisplay agent={agent} className="pm-showcase-card__avatar" />
                        <span className="pm-showcase-card__name">{agent.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="pm-agent-showcase__layer pm-agent-showcase__layer--intelligence">
                  <div className="pm-agent-showcase__layer-label">Intelligence</div>
                  <div className="pm-agent-showcase__intel-row">
                    {INTELLIGENCE_SHOWCASE_AGENTS.map((agent) => (
                      <Link
                        key={agent.id}
                        to={`/agents/${agent.id}`}
                        className="pm-showcase-card pm-showcase-card--intelligence"
                        style={{ '--agent-color': agent.color }}
                      >
                        <span className="pm-showcase-card__glow pm-showcase-card__glow--soft" aria-hidden="true" />
                        <AgentAvatarDisplay agent={agent} className="pm-showcase-card__avatar" />
                        <span className="pm-showcase-card__name">{agent.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="pm-agent-showcase__layer pm-agent-showcase__layer--execution">
                  <div className="pm-agent-showcase__layer-label">Execution</div>
                  <div className="pm-agent-showcase__exec-grid">
                    {EXECUTION_SHOWCASE_AGENTS.map((agent) => (
                      <Link
                        key={agent.id}
                        to={`/agents/${agent.id}`}
                        className="pm-showcase-card pm-showcase-card--execution"
                        style={{ '--agent-color': agent.color }}
                      >
                        <AgentAvatarDisplay agent={agent} className="pm-showcase-card__avatar" />
                        <span className="pm-showcase-card__name">{agent.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className={`pm-agent-showcase__layer pm-agent-showcase__layer--specialist${specialistsOpen ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="pm-agent-showcase__specialist-toggle"
                    onClick={() => setSpecialistsOpen((o) => !o)}
                    aria-expanded={specialistsOpen}
                  >
                    <span className="pm-agent-showcase__layer-label">Specialists</span>
                    <span className="pm-agent-showcase__chevron">{specialistsOpen ? '▾' : '▸'}</span>
                  </button>
                  <div className="pm-agent-showcase__specialist-panel">
                    <div className="pm-agent-showcase__spec-grid">
                      {SPECIALIST_SHOWCASE_AGENTS.map((agent) => (
                        <Link
                          key={agent.id}
                          to={`/agents/${agent.id}`}
                          className="pm-showcase-card pm-showcase-card--specialist"
                          style={{ '--agent-color': agent.color }}
                        >
                          <AgentAvatarDisplay agent={agent} className="pm-showcase-card__avatar" />
                          <span className="pm-showcase-card__name">{agent.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pm-agent-showcase__cta">
                <a href="#roster" className="pm-btn pm-btn--ghost">Full roster ↓</a>
              </div>
            </section>

            {/* ── Execution Preview ── */}
            <section id="stack" className="pm-execution">
              <div className="pm-section__header">
                <div className="pm-section__eyebrow" style={{ '--section-accent': '#4CC9F0' }}>Execution engine</div>
                <h2 className="pm-section__title">How a single request becomes a trusted output.</h2>
                <p className="pm-section__sub">Every response flows through context retrieval, specialist processing, and quality review before it reaches you.</p>
              </div>
              <div className="pm-execution__pipeline">
                {EXECUTION_STEPS.map((step, i) => {
                  const agent = AGENT_LIBRARY.find((a) => a.id === step.agent);
                  return (
                    <div key={step.agent} className="pm-execution__step" style={{ '--step-color': step.color, '--step-delay': `${i * 0.6}s` }}>
                      <div className="pm-execution__step-line" />
                      <div className="pm-execution__step-dot" />
                      <div className="pm-execution__step-content">
                        <div className="pm-execution__step-avatar">
                          <AgentAvatarDisplay agent={agent || { glyph: '?', color: step.color }} className="pm-execution__step-img" />
                        </div>
                        <div>
                          <div className="pm-execution__step-label">{step.label}</div>
                          <p className="pm-execution__step-detail">{step.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="pm-execution__result">
                  <div className="pm-execution__result-dot" />
                  <div className="pm-execution__result-label">✓ Output delivered</div>
                </div>
              </div>
            </section>

            {/* ── Agent Parade ── */}
            <section className="pm-agents-parade">
              <div className="pm-agents-parade__label">Intelligence, tools & specialists</div>
              <div className="pm-agents-parade__grid">
                {AGENT_PARADE_DATA.map((agent, i) => (
                  <Link
                    key={agent.id}
                    to={`/agents/${agent.id}`}
                    className="pm-agent-float"
                    style={{ '--float-delay': `${i * 0.15}s`, '--float-color': agent.color }}
                  >
                    <div className="pm-agent-float__scene">
                      <AgentAvatarDisplay agent={agent} className="pm-agent-float__character" />
                      {agent.icons.map((icon, j) => (
                        <div
                          key={j}
                          className="pm-agent-float__icon-badge"
                          style={{ '--badge-x': icon.x, '--badge-y': icon.y, '--badge-delay': `${j * 0.4}s` }}
                        >
                          {icon.emoji}
                        </div>
                      ))}
                    </div>
                    <div className="pm-agent-float__name">{agent.name}</div>
                    <div className="pm-agent-float__role">{agent.title}</div>
                  </Link>
                ))}
              </div>
            </section>

            {/* ── How It Works ── */}
            <section className="pm-how">
              <div className="pm-how__label">How Prymal works</div>
              {HOW_IT_WORKS.map((item, i) => (
                <div key={item.agent} className={`pm-how__row${i % 2 === 1 ? ' pm-how__row--flip' : ''}`}>
                  <div className="pm-how__character">
                    <div className="pm-how__glow" style={{ '--glow-color': item.color }} />
                    <AgentAvatarDisplay
                      agent={AGENT_LIBRARY.find((a) => a.id === item.agent) || { glyph: '?', color: item.color }}
                      className="pm-how__img"
                    />
                  </div>
                  <div className="pm-how__copy">
                    <div className="pm-how__step">0{i + 1}</div>
                    <h2 className="pm-how__headline">{item.headline}</h2>
                    <p className="pm-how__body">{item.copy}</p>
                  </div>
                </div>
              ))}
            </section>

            {/* ── Full Roster Grid ── */}
            <section id="roster" className="pm-bento">
              <div className="pm-bento__label">The full roster</div>
              <p className="pm-bento__sub">14 specialist agents, each with defined contracts, output schemas, and a clear commercial job.</p>
              <div className="pm-bento__grid">
                {BENTO_AGENTS.map((agent) => (
                  <Link key={agent.id} to={`/agents/${agent.id}`} className="pm-bento__card" style={{ '--card-color': agent.color }}>
                    <div className="pm-bento__card-glow" />
                    <AgentAvatarDisplay agent={agent} className="pm-bento__card-character" />
                    <div className="pm-bento__card-name">{agent.name}</div>
                    <div className="pm-bento__card-role">{agent.title}</div>
                    <p className="pm-bento__card-desc">{agent.description}</p>
                    <span className="pm-bento__card-cta">Explore {agent.name} →</span>
                  </Link>
                ))}
              </div>
            </section>

            {/* ── Pricing teaser → full page ── */}
            <section id="pricing" className="pm-pricing-section">
              <div className="pm-hero__badge" style={{ marginBottom: 14 }}>
                <span className="pm-hero__badge-dot" />
                Pricing
              </div>
              <h2 className="pm-pricing-ladder__title">Simple plans for serious work</h2>
              <p className="pm-pricing-ladder__lede" style={{ maxWidth: 560 }}>
                Execution credits for workflow runs, agents, and AI video renders. Pro is the best balance for most
                teams — see every tier, limits, and FAQs on the dedicated pricing page.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
                <PublicCtaLink
                  to="/pricing"
                  cta="view-pricing"
                  surface="landing-pricing-teaser"
                  intent="learn"
                  className="button button--accent"
                >
                  View pricing
                </PublicCtaLink>
                <PublicCtaLink
                  to="/signup"
                  cta="signup"
                  surface="landing-pricing-teaser"
                  intent="convert"
                  className="button button--ghost"
                  onClick={() => trackSignup('landing-pricing-teaser')}
                >
                  Start now
                </PublicCtaLink>
              </div>
            </section>

            {/* ── Waitlist ── */}
            <section className="pm-waitlist">
              <div className="pm-waitlist__inner">
                <div className="pm-hero__badge" style={{ marginBottom: 18 }}>
                  <span className="pm-hero__badge-dot" />
                  Prefer a guided rollout?
                </div>
                <h2>Join the waitlist for a curated Prymal onboarding wave.</h2>
                <p>
                  If you want a more hands-on workspace setup, leave your email and we will route you into the next
                  guided rollout group.
                </p>

                <form className="pm-waitlist__form" onSubmit={handleWaitlistSubmit}>
                  <TextInput
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    inputMode="email"
                  />
                  <Button tone="accent" type="submit" disabled={waitlistPending}>
                    Join waitlist
                  </Button>
                </form>

                {waitlistResult?.tone ? (
                  <InlineNotice tone={waitlistResult.tone} style={{ marginTop: 12 }}>
                    {waitlistResult.message}
                  </InlineNotice>
                ) : null}
              </div>
            </section>

            <FAQSection
              title="Prymal FAQ"
              items={HOME_FAQ_ITEMS}
              schemaId="schema-home-faq"
            />

            <LinkCardGrid
              surface="landing-footer-hub"
              items={[
                {
                  to: '/features',
                  title: 'Explore feature pages',
                  description: 'See how Prymal approaches AI agents, business memory, workflows, trust, reporting, and outreach.',
                  cta: 'Browse features ->',
                },
                {
                  to: '/blog',
                  title: 'Read practical guides',
                  description: 'Get answer-first explainers on AI operating systems, memory, workflows, and business-safe adoption.',
                  cta: 'Open the blog ->',
                },
                {
                  to: '/compare',
                  title: 'Compare product categories',
                  description: 'Understand when Prymal fits better than a chat-first tool, workflow product, or agent platform.',
                  cta: 'View comparisons ->',
                },
              ]}
            />

          </div>
        </PageShell>

        <PublicPageFooter sourcePrefix="landing" onSignupClick={trackSignup} />
      </div>
      <CookieConsentBanner />
    </div>
  );
}

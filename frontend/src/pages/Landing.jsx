import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import {
  AGENT_LIBRARY,
  AGENT_UI_LAYERS,
  BILLING_INTERVALS,
  PLAN_LIBRARY,
  getPlanPrice,
  getWorkspacePlanMeta,
  sortAgentsByUiHierarchy,
} from '../lib/constants';
import { api } from '../lib/api';
import { getErrorMessage } from '../lib/utils';
import { Button, InlineNotice, PageShell, TextInput } from '../components/ui';
import { MotionSection, usePrymalReducedMotion } from '../components/motion';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { MagicalCanvas } from '../features/marketing/MagicalCanvas';
import { AgentAvatarDisplay } from '../features/marketing/AgentAvatarDisplay';
import '../styles/landing-rebuild.css';

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

/** Hero constellation: why these three sit above every other agent. */
const CORE_TRIO_HERO_BLURB = {
  nexus:
    'The hub that wires specialists, triggers, and QA into one graph. This is the default front door when you “start Prymal” — not another chat thread.',
  atlas:
    'Where vague intent becomes milestones, owners, and dependencies. ATLAS is the operating layer that keeps delivery legible while everything else executes.',
  lore:
    'The memory the whole stack trusts. LORE grounds answers in indexed knowledge with provenance, so the system speaks from evidence — not vibes.',
};
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

/** Visual accent per tier (card border / glow). Prices unchanged — display only. */
const PLAN_CARD_ACCENT = {
  solo: '#5bc0eb',
  pro: '#c77dff',
  teams: '#40d7c3',
  agency: '#ffb86b',
};

/** Capability ladder framing — execution depth, not SKU lists. */
const PRICING_TIER_UX = {
  solo: {
    mode: 'Personal operator',
    tier: 1,
    capabilityLine:
      'One seat, full roster: run Prymal as your private control surface—retrieval, specialists, and QA on work that has to land.',
    throughputLine: (credits) =>
      `${Number(credits).toLocaleString('en-GB')} monthly credits · focused throughput to prove repeatable wins on live briefs.`,
    ctaSignedOut: 'Start in operator mode',
    ctaSignedIn: 'Select Solo in billing',
  },
  pro: {
    mode: 'Primary execution',
    tier: 2,
    capabilityLine:
      'Where Prymal becomes a coordinated engine: chain agents in NEXUS, deepen runs, and use Power-Ups when throughput is the job.',
    throughputLine: (credits) =>
      `${Number(credits).toLocaleString('en-GB')} monthly credits · serious day-to-day execution volume for operators who live in the product.`,
    ctaSignedOut: 'Unlock full execution',
    ctaSignedIn: 'Upgrade to Pro execution',
    anchor: true,
  },
  teams: {
    mode: 'Organisational intelligence',
    tier: 3,
    capabilityLine:
      'Shared workspace memory, seats, and credits mapped to how teams actually ship—parallel threads without fragmenting truth.',
    throughputLine: (credits) =>
      `${Number(credits).toLocaleString('en-GB')} monthly credits · pooled execution headroom for concurrent lanes and handoffs.`,
    ctaSignedOut: 'Enable team-scale ops',
    ctaSignedIn: 'Configure Teams billing',
  },
  agency: {
    mode: 'System deployment',
    tier: 4,
    capabilityLine:
      'API keys, high seat count, and runway for agencies wiring Prymal into client systems, billing, and always-on workflows.',
    throughputLine: (credits) =>
      `${Number(credits).toLocaleString('en-GB')} monthly credits · capacity shaped for multi-client throughput and automation load.`,
    ctaSignedOut: 'Deploy at agency depth',
    ctaSignedIn: 'Open Agency billing',
  },
};

/** Prymal vs generic “AI assistant” products — ticks/crosses; `other: true` where mainstream tools commonly ship it. */
const PRICING_VS_OTHERS_ROWS = [
  { label: 'Multi-agent workflows with explicit steps, gates, and structured handoffs (NEXUS)', prymal: true, other: false },
  { label: '14 specialist agents with defined roles, outputs, and commercial contracts—not one generic model', prymal: true, other: false },
  { label: 'Durable workspace corpus with retrieval grounding and provenance (LORE)', prymal: true, other: false },
  { label: 'Pre-delivery QA: policy, schema, and risk checks before outputs ship (SENTINEL)', prymal: true, other: false },
  { label: 'Credits map to throughput: parallel lanes, depth, and voice—not “one reply at a time” pricing', prymal: true, other: false },
  { label: 'Shared organisation memory, seats, pooled credits, and billing in one workspace', prymal: true, other: false },
  { label: 'First-class automation posture (webhooks, pipeline-friendly controls)', prymal: true, other: false },
  { label: 'API keys and programmatic access for always-on / multi-tenant deployments', prymal: 'partial', other: false, note: 'Agency plan' },
  { label: 'Natural-language prompting for ad-hoc drafting, analysis, and Q&A', prymal: true, other: true },
  { label: 'Fast access to frontier models without operating your own inference stack', prymal: true, other: true },
  { label: 'Single-thread “chat with documents” in a session (upload-and-ask)', prymal: true, other: true },
  { label: 'Built as a control plane for delivery and ops—not only conversation', prymal: true, other: false },
  { label: 'Explicit specialist orchestration instead of one model improvising every job', prymal: true, other: false },
  { label: 'Operating posture for agencies: high seat counts, client separation, and deployment runway', prymal: true, other: false },
];

const EXECUTION_STEPS = [
  { agent: 'lore', label: 'Context loaded', detail: 'LORE retrieves relevant knowledge from your workspace.', color: '#C77DFF' },
  { agent: 'cipher', label: 'Data analysed', detail: 'CIPHER processes the numbers and finds the signal.', color: '#33c7ff' },
  { agent: 'herald', label: 'Draft composed', detail: 'HERALD shapes the output into a client-ready message.', color: '#ff8b5f' },
  { agent: 'sentinel', label: 'QA reviewed', detail: 'SENTINEL checks for accuracy, schema compliance, and risk.', color: '#F72585' },
];

export default function Landing() {
  const reducedMotion = usePrymalReducedMotion();
  const { isSignedIn } = useAuth();
  const [billingInterval, setBillingInterval] = useState(BILLING_INTERVALS[0]?.id ?? 'monthly');
  const [email, setEmail] = useState('');
  const [waitlistResult, setWaitlistResult] = useState(null);
  const [specialistsOpen, setSpecialistsOpen] = useState(false);
  const scopeRef = useRef(null);

  const nexusEntryHref = isSignedIn ? '/app/workflows' : '/signup';
  const atlasEntryHref = isSignedIn ? '/app/agents/atlas' : '/agents/atlas';
  const loreEntryHref = isSignedIn ? '/app/lore' : '/agents/lore';

  const freePlan = getWorkspacePlanMeta('free');
  const activeBillingInterval =
    BILLING_INTERVALS.find((interval) => interval.id === billingInterval) ?? BILLING_INTERVALS[0];

  const waitlistMutation = useMutation({
    mutationFn: async (nextEmail) => api.post('/waitlist', { email: nextEmail, source: 'landing_page' }),
    onSuccess: () => {
      setWaitlistResult({
        tone: 'success',
        message: 'You are on the waitlist. We will send the invite as soon as your workspace is ready.',
      });
      setEmail('');
    },
    onError: (error) => {
      setWaitlistResult({ tone: 'danger', message: getErrorMessage(error, 'Unable to join the waitlist right now.') });
    },
  });

  useEffect(() => {
    if (waitlistResult?.tone) {
      const timeoutId = window.setTimeout(() => setWaitlistResult(null), 4200);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [waitlistResult]);

  useLayoutEffect(() => {
    if (reducedMotion || !scopeRef.current) return undefined;

    let active = true;
    let gsapContext = null;

    (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);

      if (!active || !scopeRef.current) return;

      gsap.registerPlugin(ScrollTrigger);

      gsapContext = gsap.context(() => {
        gsap.from('.pm-hero__intro > *', {
          y: 28,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.08,
        });

        gsap.from('.pm-core-constellation__card', {
          y: 36,
          opacity: 0,
          scale: 0.92,
          duration: 0.85,
          ease: 'power3.out',
          stagger: 0.12,
        });

        gsap.utils.toArray('.pm-agents-parade__grid .pm-agent-float').forEach((card, i) => {
          gsap.fromTo(
            card,
            { opacity: 0, y: 30, scale: 0.9 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.5,
              ease: 'back.out(1.4)',
              delay: i * 0.04,
              scrollTrigger: { trigger: '.pm-agents-parade', start: 'top 75%', toggleActions: 'play none none none' },
            },
          );
        });

        gsap.utils.toArray('.pm-how__row').forEach((row, i) => {
          gsap.fromTo(
            row,
            { opacity: 0, y: 60, filter: 'blur(12px)' },
            {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              duration: 0.9,
              ease: 'power3.out',
              delay: i * 0.1,
              scrollTrigger: { trigger: row, start: 'top 78%', toggleActions: 'play none none none' },
            },
          );
        });

        gsap.utils.toArray('.pm-bento__card').forEach((card, i) => {
          gsap.fromTo(
            card,
            { opacity: 0, scale: 0.85, y: 40 },
            {
              opacity: 1,
              scale: 1,
              y: 0,
              duration: 0.7,
              ease: 'back.out(1.5)',
              delay: i * 0.08,
              scrollTrigger: { trigger: '.pm-bento__grid', start: 'top 75%', toggleActions: 'play none none none' },
            },
          );
        });

        gsap.fromTo(
          '.pm-agent-float__icon-badge',
          { opacity: 0, scale: 0 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.4,
            ease: 'back.out(2)',
            stagger: 0.05,
            scrollTrigger: { trigger: '.pm-agents-parade', start: 'top 70%', toggleActions: 'play none none none' },
          },
        );
      }, scopeRef);
    })();

    return () => {
      active = false;
      gsapContext?.revert();
    };
  }, [reducedMotion]);

  const handleWaitlistSubmit = (event) => {
    event.preventDefault();
    if (!email.trim()) {
      setWaitlistResult({ tone: 'warning', message: 'Enter your email address so we know where to send the invite.' });
      return;
    }
    waitlistMutation.mutate(email.trim());
  };

  return (
    <div ref={scopeRef} className="marketing-page prymal-marketing prymal-marketing--home">
      <PageMeta
        title="Prymal | The premium AI operating system for business execution"
        description="15 specialist AI agents, grounded retrieval, workflow orchestration, realtime voice, and an operator-grade control plane in one premium operating system."
        canonicalPath="/"
      />
      <JsonLd
        id="schema-home-product"
        schema={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Prymal',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          description:
            'Prymal is a premium AI operating system with 15 specialist agents, hybrid RAG, workflow orchestration, and an operator-grade SaaS control plane.',
          offers: [
            { '@type': 'Offer', name: freePlan.name, price: '0', priceCurrency: 'GBP' },
            ...PLAN_LIBRARY.map((plan) => ({
              '@type': 'Offer',
              name: plan.name,
              price: String(plan.monthlyPrice),
              priceCurrency: 'GBP',
            })),
          ],
        }}
      />

      <MagicalCanvas reducedMotion={reducedMotion} />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="landing" />

        <PageShell width="100%">
          <div className="prymal-homepage prymal-homepage--primal">

            {/* ── Hero + core constellation ── */}
            <section className="pm-hero">
              <div className="pm-hero__intro">
                <div className="pm-hero__badge">
                  <span className="pm-hero__badge-dot" />
                  15 Specialist AI Agents · Now Live
                </div>

                <h1 className="pm-hero__headline">
                  Your Business.<br />
                  <span className="pm-hero__headline--glow">Orchestrated.</span>
                </h1>

                <p className="pm-hero__sub">
                  Not one chatbot — a structured operating system. Core orchestration, an intelligence layer, execution tools, and specialists that only surface when they matter.
                </p>
              </div>

              <div className="pm-core-constellation" aria-label="Core Prymal agents">
                <svg className="pm-core-constellation__wires" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="pm-wire-nexus" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgba(189,224,254,0.15)" />
                      <stop offset="50%" stopColor="rgba(199,125,255,0.55)" />
                      <stop offset="100%" stopColor="rgba(189,224,254,0.15)" />
                    </linearGradient>
                  </defs>
                  <path
                    className="pm-core-constellation__path pm-core-constellation__path--left"
                    d="M 12 88 Q 92 24 200 56"
                    fill="none"
                    stroke="url(#pm-wire-nexus)"
                    strokeWidth="1.2"
                  />
                  <path
                    className="pm-core-constellation__path pm-core-constellation__path--right"
                    d="M 388 88 Q 308 24 200 56"
                    fill="none"
                    stroke="url(#pm-wire-nexus)"
                    strokeWidth="1.2"
                  />
                </svg>

                <div className="pm-core-constellation__grid">
                  {CORE_TRIO_VISUAL.map((agent) => {
                    const isNexus = agent.id === 'nexus';
                    const href =
                      agent.id === 'nexus' ? nexusEntryHref : agent.id === 'atlas' ? atlasEntryHref : loreEntryHref;
                    return (
                      <Link
                        key={agent.id}
                        to={href}
                        className={`pm-core-constellation__card${isNexus ? ' pm-core-constellation__card--nexus' : ' pm-core-constellation__card--wing'}`}
                        style={{ '--agent-color': agent.color }}
                      >
                        <span className="pm-core-constellation__halo" aria-hidden="true" />
                        <div className="pm-core-constellation__avatar-wrap">
                          <AgentAvatarDisplay agent={agent} className="pm-core-constellation__avatar" />
                        </div>
                        <div className="pm-core-constellation__copy">
                          <span className="pm-core-constellation__name">{agent.name}</span>
                          <span className="pm-core-constellation__title">{agent.title}</span>
                          <p className="pm-core-constellation__why">{CORE_TRIO_HERO_BLURB[agent.id]}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="pm-hero__ctas">
                <SignedOut>
                  <Link to={nexusEntryHref} className="pm-btn pm-btn--primary">Start with Prymal</Link>
                  <a href="#pricing" className="pm-btn pm-btn--ghost">See plans</a>
                </SignedOut>
                <SignedIn>
                  <Link to={nexusEntryHref} className="pm-btn pm-btn--primary">Start with Prymal</Link>
                  <Link to="/app/dashboard" className="pm-btn pm-btn--ghost">Open workspace</Link>
                </SignedIn>
              </div>

              <div className="pm-hero__trust">
                <span>✓ No credit card</span>
                <span>✓ Setup in 3 minutes</span>
                <span>✓ Cancel anytime</span>
              </div>
            </section>

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

            {/* ── Pricing: capability ladder ── */}
            <MotionSection id="pricing" className="pm-pricing-section pm-pricing-ladder" delay={0.06} reveal={{ y: 24, blur: 10 }}>
              <header className="pm-pricing-ladder__framing">
                <div className="pm-hero__badge pm-pricing-ladder__eyebrow" style={{ animationDelay: '0.5s' }}>
                  <span className="pm-hero__badge-dot" />
                  Execution tiers · same agent system
                </div>
                <h2 className="pm-pricing-ladder__title">Scale operational power, not chat seats.</h2>
                <p className="pm-pricing-ladder__lede">
                  Prymal is a coordinated multi-agent execution layer: workflows hand off between specialists, LORE keeps outputs
                  grounded, and your tier defines throughput, seats, and deployment depth—not which “AI” you unlock.
                </p>
                <div className="pm-pricing-ladder__pillars" aria-label="What Prymal optimises for">
                  <div className="pm-pricing-ladder__pillar">
                    <span className="pm-pricing-ladder__pillar-k">Orchestration</span>
                    <span className="pm-pricing-ladder__pillar-v">NEXUS graphs, gates, and specialist sequencing</span>
                  </div>
                  <div className="pm-pricing-ladder__pillar">
                    <span className="pm-pricing-ladder__pillar-k">Throughput</span>
                    <span className="pm-pricing-ladder__pillar-v">Credits as concurrent execution capacity</span>
                  </div>
                  <div className="pm-pricing-ladder__pillar">
                    <span className="pm-pricing-ladder__pillar-k">Deployment</span>
                    <span className="pm-pricing-ladder__pillar-v">Solo → team → API-grade agency posture</span>
                  </div>
                </div>
              </header>

              <div className="pm-pricing-ladder__orbit" aria-hidden="true">
                <div className="pm-pricing-ladder__orbit-line" />
                <div className="pm-pricing-ladder__orbit-nodes">
                  {PLAN_LIBRARY.map((plan, i) => (
                    <div key={plan.id} className="pm-pricing-ladder__orbit-node">
                      <span
                        className="pm-pricing-ladder__orbit-dot"
                        style={{ '--orbit-accent': PLAN_CARD_ACCENT[plan.id] ?? '#c77dff' }}
                      />
                      {i < PLAN_LIBRARY.length - 1 ? <span className="pm-pricing-ladder__orbit-seg" /> : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="prymal-pricing__toggle-scroll">
                <div className="prymal-pricing__toggle" role="tablist" aria-label="Billing period">
                  {BILLING_INTERVALS.map((interval) => (
                    <button
                      key={interval.id}
                      type="button"
                      role="tab"
                      aria-selected={interval.id === billingInterval}
                      className={`prymal-pricing__toggle-button${interval.id === billingInterval ? ' is-active' : ''}`}
                      onClick={() => setBillingInterval(interval.id)}
                    >
                      <span>{interval.label}</span>
                      {interval.caption ? <small>{interval.caption}</small> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pm-pricing-ladder__grid pm-pricing-ladder__grid--snap">
                {PLAN_LIBRARY.map((plan) => {
                  const price = getPlanPrice(plan, activeBillingInterval.id);
                  const ux = PRICING_TIER_UX[plan.id];
                  const accent = PLAN_CARD_ACCENT[plan.id] ?? '#c77dff';
                  const isAnchor = Boolean(ux?.anchor);
                  return (
                    <div
                      key={plan.id}
                      className={`pm-pricing__card pm-pricing__card--ladder pm-pricing__card--${plan.id}${isAnchor ? ' pm-pricing__card--anchor' : ''}`}
                      style={{ '--card-color': accent }}
                    >
                      {isAnchor ? (
                        <div className="pm-pricing-ladder__anchor-ribbon" aria-hidden="true">
                          Primary execution tier
                        </div>
                      ) : null}
                      <div className="pm-pricing__card-inner">
                        <div className="pm-pricing-ladder__flow-bg" aria-hidden="true" />
                        <div className="pm-pricing-ladder__card-head">
                          <div className="pm-pricing-ladder__tier-row">
                            <span className="pm-pricing-ladder__mode">{ux.mode}</span>
                            <span className="pm-pricing-ladder__tier-index">Tier {ux.tier} / 4</span>
                          </div>
                          <div className="pm-pricing-ladder__meter" role="img" aria-label={`Execution depth ${ux.tier} of four`}>
                            {[1, 2, 3, 4].map((step) => (
                              <span key={step} className={`pm-pricing-ladder__meter-bar${step <= ux.tier ? ' is-lit' : ''}`} />
                            ))}
                          </div>
                          <h3 className="pm-pricing-ladder__plan-name">{plan.name}</h3>
                          <p className="pm-pricing-ladder__capability">{ux.capabilityLine}</p>
                        </div>

                        <div className="pm-pricing-ladder__price-wrap prymal-pricing__top">
                          {price.hasPeriodDiscount ? (
                            <div className="prymal-pricing__price-block">
                              <div className="prymal-pricing__period-row">
                                <span className="prymal-pricing__list-total" aria-label={`List price before discount ${price.listPeriodDisplay}`}>
                                  {price.listPeriodDisplay}
                                </span>
                                <strong className="prymal-pricing__discounted-total">
                                  {price.display}
                                  <small className="prymal-pricing__suffix-inline"> / {price.suffix}</small>
                                </strong>
                              </div>
                              <div className="prymal-pricing__monthly-row">
                                <span className="prymal-pricing__list-monthly" aria-label={`Published monthly list ${price.monthlyListDisplay} per month`}>
                                  {price.monthlyListDisplay}
                                  <span className="prymal-pricing__per-mo">/mo</span>
                                </span>
                                <span className="prymal-pricing__monthly-arrow" aria-hidden="true">→</span>
                                <span className="prymal-pricing__effective-monthly">{price.monthlyEquivalent}</span>
                                <span className="prymal-pricing__equiv-label">effective</span>
                              </div>
                              {price.savingsDisplay ? (
                                <div className="prymal-pricing__save-row">
                                  <span className="prymal-pricing__save-pill">
                                    Save {price.savingsDisplay}
                                    {price.discountLabel ? ` · ${price.discountLabel}` : ''}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <strong className="pm-pricing-ladder__price-primary">
                              {price.display}
                              <small> / {price.suffix}</small>
                            </strong>
                          )}
                          <p className="pm-pricing-ladder__throughput">{ux.throughputLine(plan.credits)}</p>
                          <p className="pm-pricing-ladder__fineprint">{plan.description}</p>
                        </div>

                        <div className="pm-pricing-ladder__includes">
                          <span className="pm-pricing-ladder__includes-label">Infrastructure included</span>
                          <div className="prymal-pricing__features pm-pricing-ladder__features">
                            {plan.features.map((feature) => (
                              <span key={feature}>{feature}</span>
                            ))}
                          </div>
                        </div>

                        <div className="prymal-pricing__cta pm-pricing-ladder__cta">
                          <SignedOut>
                            <Link
                              to="/signup"
                              className={`button button--${isAnchor || plan.id === 'agency' ? 'accent' : 'ghost'} button--block pm-pricing-ladder__cta-btn`}
                            >
                              {ux.ctaSignedOut}
                            </Link>
                          </SignedOut>
                          <SignedIn>
                            <Link
                              to="/app/settings?tab=Billing"
                              className={`button button--${isAnchor || plan.id === 'agency' ? 'accent' : 'ghost'} button--block pm-pricing-ladder__cta-btn`}
                            >
                              {ux.ctaSignedIn}
                            </Link>
                          </SignedIn>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <section className="pm-pricing-compare" aria-labelledby="pricing-compare-heading">
                <h3 id="pricing-compare-heading" className="pm-pricing-compare__title">
                  Prymal vs other AI platforms
                </h3>
                <p className="pm-pricing-compare__lede">
                  Not a competitor call-out—a capability map. Typical assistant products optimise for a single chat thread;
                  Prymal optimises for coordinated execution, shared truth, and how work actually ships.
                </p>
                <div className="pm-pricing-compare__scroll">
                  <div className="pm-pricing-compare__table" role="table" aria-label="Capability comparison">
                    <div role="row" className="pm-pricing-compare__row pm-pricing-compare__row--head">
                      <div role="columnheader" className="pm-pricing-compare__cell pm-pricing-compare__cell--dim">
                        Capability
                      </div>
                      <div role="columnheader" className="pm-pricing-compare__cell pm-pricing-compare__cell--brand">
                        Prymal
                      </div>
                      <div role="columnheader" className="pm-pricing-compare__cell pm-pricing-compare__cell--other">
                        Other AI platforms
                      </div>
                    </div>
                    {PRICING_VS_OTHERS_ROWS.map((row) => (
                      <div role="row" key={row.label} className="pm-pricing-compare__row">
                        <div role="cell" className="pm-pricing-compare__cell pm-pricing-compare__cell--dim">
                          {row.label}
                          {row.note ? (
                            <span className="pm-pricing-compare__note"> ({row.note})</span>
                          ) : null}
                        </div>
                        <div role="cell" className="pm-pricing-compare__cell pm-pricing-compare__cell--tick">
                          {row.prymal === true ? (
                            <span className="pm-pricing-compare__mark pm-pricing-compare__mark--yes" title="Included">
                              <span aria-hidden="true">✓</span>
                              <span className="pm-pricing-compare__sr">Yes</span>
                            </span>
                          ) : row.prymal === 'partial' ? (
                            <span className="pm-pricing-compare__mark pm-pricing-compare__mark--partial" title="Included on Agency tier">
                              <span aria-hidden="true">◆</span>
                              <span className="pm-pricing-compare__sr">Agency tier</span>
                            </span>
                          ) : (
                            <span className="pm-pricing-compare__mark pm-pricing-compare__mark--no" title="Not included">
                              <span aria-hidden="true">✕</span>
                              <span className="pm-pricing-compare__sr">No</span>
                            </span>
                          )}
                        </div>
                        <div role="cell" className="pm-pricing-compare__cell pm-pricing-compare__cell--cross">
                          {row.other ? (
                            <span className="pm-pricing-compare__mark pm-pricing-compare__mark--yes" title="Often included">
                              <span aria-hidden="true">✓</span>
                              <span className="pm-pricing-compare__sr">Yes</span>
                            </span>
                          ) : (
                            <span className="pm-pricing-compare__mark pm-pricing-compare__mark--no" title="Not typical for assistant-style products">
                              <span aria-hidden="true">✕</span>
                              <span className="pm-pricing-compare__sr">No</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </MotionSection>

            {/* ── Waitlist ── */}
            <MotionSection className="pm-waitlist" delay={0.06} reveal={{ y: 24, blur: 10 }}>
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
                  <Button tone="accent" type="submit" disabled={waitlistMutation.isLoading}>
                    Join waitlist
                  </Button>
                </form>

                {waitlistResult?.tone ? (
                  <InlineNotice tone={waitlistResult.tone} style={{ marginTop: 12 }}>
                    {waitlistResult.message}
                  </InlineNotice>
                ) : null}
              </div>
            </MotionSection>

          </div>
        </PageShell>

        <PublicPageFooter />
      </div>
    </div>
  );
}

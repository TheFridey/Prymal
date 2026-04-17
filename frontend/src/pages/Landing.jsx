import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { AGENT_LIBRARY, BILLING_INTERVALS, PLAN_LIBRARY, getPlanPrice, getWorkspacePlanMeta } from '../lib/constants';
import { api } from '../lib/api';
import { getErrorMessage } from '../lib/utils';
import { Button, InlineNotice, PageShell, TextInput } from '../components/ui';
import { MotionCard, MotionSection, usePrymalReducedMotion } from '../components/motion';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { MagicalCanvas } from '../features/marketing/MagicalCanvas';
import { AgentAvatarDisplay } from '../features/marketing/AgentAvatarDisplay';
import '../styles/landing-rebuild.css';

const AGENT_PARADE_DATA = AGENT_LIBRARY.filter((a) => a.id !== 'sentinel').map((agent) => {
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

const FEATURED_AGENTS = ['cipher', 'herald', 'forge', 'lore', 'atlas', 'echo']
  .map((id) => AGENT_LIBRARY.find((a) => a.id === id))
  .filter(Boolean);

const EXECUTION_STEPS = [
  { agent: 'lore', label: 'Context loaded', detail: 'LORE retrieves relevant knowledge from your workspace.', color: '#C77DFF' },
  { agent: 'cipher', label: 'Data analysed', detail: 'CIPHER processes the numbers and finds the signal.', color: '#33c7ff' },
  { agent: 'herald', label: 'Draft composed', detail: 'HERALD shapes the output into a client-ready message.', color: '#ff8b5f' },
  { agent: 'sentinel', label: 'QA reviewed', detail: 'SENTINEL checks for accuracy, schema compliance, and risk.', color: '#F72585' },
];

export default function Landing() {
  const reducedMotion = usePrymalReducedMotion();
  const [billingInterval, setBillingInterval] = useState(BILLING_INTERVALS[0]?.id ?? 'monthly');
  const [email, setEmail] = useState('');
  const [waitlistResult, setWaitlistResult] = useState(null);
  const scopeRef = useRef(null);

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
        gsap.from('.pm-hero > *', {
          y: 28,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.08,
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

            {/* ── Hero ── */}
            <section className="pm-hero">
              <div className="pm-hero__badge">
                <span className="pm-hero__badge-dot" />
                15 Specialist AI Agents · Now Live
              </div>

              <h1 className="pm-hero__headline">
                Your Business.<br />
                <span className="pm-hero__headline--glow">Orchestrated.</span>
              </h1>

              <p className="pm-hero__sub">
                Not one AI. A full team. 15 specialist agents with contracts,
                memory, and a QA gate — working together like they actually know your business.
              </p>

              <div className="pm-hero__ctas">
                <SignedOut>
                  <Link to="/signup" className="pm-btn pm-btn--primary">Start free →</Link>
                  <a href="#pricing" className="pm-btn pm-btn--ghost">See plans</a>
                </SignedOut>
                <SignedIn>
                  <Link to="/app/dashboard" className="pm-btn pm-btn--primary">Open workspace →</Link>
                  <Link to="/app/workflows" className="pm-btn pm-btn--ghost">View workflows</Link>
                </SignedIn>
              </div>

              <div className="pm-hero__trust">
                <span>✓ No credit card</span>
                <span>✓ Setup in 3 minutes</span>
                <span>✓ Cancel anytime</span>
              </div>
            </section>

            {/* ── Featured Agents ── */}
            <section id="agents" className="pm-featured-agents">
              <div className="pm-section__header">
                <div className="pm-section__eyebrow" style={{ '--section-accent': '#C77DFF' }}>Core specialists</div>
                <h2 className="pm-section__title">Meet the agents that run your business.</h2>
                <p className="pm-section__sub">Each agent has a defined contract, output schema, and clear commercial job. They share memory, context, and a QA gate.</p>
              </div>
              <div className="pm-featured-agents__grid">
                {FEATURED_AGENTS.map((agent) => (
                  <Link key={agent.id} to={`/agents/${agent.id}`} className="pm-featured-agent" style={{ '--agent-color': agent.color }}>
                    <div className="pm-featured-agent__avatar-wrap">
                      <div className="pm-featured-agent__glow" />
                      <AgentAvatarDisplay agent={agent} className="pm-featured-agent__avatar" />
                    </div>
                    <div className="pm-featured-agent__info">
                      <div className="pm-featured-agent__name">{agent.name}</div>
                      <div className="pm-featured-agent__title">{agent.title}</div>
                      <p className="pm-featured-agent__desc">{agent.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="pm-featured-agents__cta">
                <a href="#roster" className="pm-btn pm-btn--ghost">View the full team ↓</a>
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
              <div className="pm-agents-parade__label">Meet your team</div>
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
                {AGENT_LIBRARY.filter((a) => a.id !== 'sentinel').map((agent) => (
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

            {/* ── Pricing ── */}
            <MotionSection id="pricing" className="pm-pricing-section" delay={0.06} reveal={{ y: 24, blur: 10 }}>
              <div className="pm-pricing-section__header">
                <div className="pm-hero__badge" style={{ animationDelay: '0.5s' }}>
                  <span className="pm-hero__badge-dot" />
                  Plans built for real operators
                </div>
                <h2>Pricing that scales with the team.</h2>
                <p>All paid plans include the full specialist roster.</p>
              </div>

              <div className="prymal-pricing__toggle">
                {BILLING_INTERVALS.map((interval) => (
                  <button
                    key={interval.id}
                    type="button"
                    className={`prymal-pricing__toggle-button${interval.id === billingInterval ? ' is-active' : ''}`}
                    onClick={() => setBillingInterval(interval.id)}
                  >
                    <span>{interval.label}</span>
                    <small>{interval.caption}</small>
                  </button>
                ))}
              </div>

              <div className="prymal-pricing__grid">
                {PLAN_LIBRARY.map((plan) => {
                  const price = getPlanPrice(plan, activeBillingInterval.id);
                  return (
                    <div key={plan.id} className="pm-pricing__card" style={{ '--card-color': plan.accent || '#C77DFF' }}>
                      <div className="pm-pricing__card-inner">
                        <div className="prymal-pricing__top">
                          <span>{plan.name}</span>
                          <strong>
                            {price.display}
                            <small> / {price.suffix}</small>
                          </strong>
                          <p>{plan.description}</p>
                        </div>
                        <div className="prymal-pricing__features">
                          {plan.features.map((feature) => (
                            <span key={feature}>{feature}</span>
                          ))}
                        </div>
                        <div className="prymal-pricing__cta">
                          <SignedOut>
                            <Link to="/signup">
                              <Button tone={plan.id === 'agency' ? 'accent' : 'ghost'}>Start with {plan.name}</Button>
                            </Link>
                          </SignedOut>
                          <SignedIn>
                            <Link to="/app/settings?tab=Billing">
                              <Button tone={plan.id === 'agency' ? 'accent' : 'ghost'}>Open billing</Button>
                            </Link>
                          </SignedIn>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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

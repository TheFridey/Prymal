import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { BILLING_INTERVALS, PLAN_LIBRARY, getPlanPrice, getWorkspacePlanMeta } from '../lib/constants';
import { api } from '../lib/api';
import { getErrorMessage } from '../lib/utils';
import { Button, InlineNotice, PageShell, TextInput } from '../components/ui';
import { MotionCard, MotionSection, MotionStat, usePrymalReducedMotion } from '../components/motion';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';

const HERO_METRICS = [
  { value: '15', label: 'Specialist agents', detail: 'Named operators with contracts and output schemas.' },
  { value: 'Hybrid RAG', label: 'Grounded trust', detail: 'Freshness, authority, contradiction checks.' },
  { value: 'PASS / REPAIR / HOLD', label: 'SENTINEL QA', detail: 'Hard enforcement for sensitive outputs.' },
];

const PRIMAL_STEPS = [
  {
    id: 'sense',
    eyebrow: 'Sense',
    title: 'Pull reality into the run',
    copy: 'Documents, URLs, memory scopes, and live workspace context converge before a response is composed.',
    accent: '#6cf6c4',
  },
  {
    id: 'route',
    eyebrow: 'Route',
    title: 'Specialists with explicit contracts',
    copy: 'Each agent has allowed tools, preferred policy lanes, and enforced output schemas.',
    accent: '#7fa3ff',
  },
  {
    id: 'execute',
    eyebrow: 'Execute',
    title: 'Workflows that feel alive',
    copy: 'States, retries, and outbound delivery remain visible so the system never hides causality.',
    accent: '#a18bff',
  },
  {
    id: 'govern',
    eyebrow: 'Govern',
    title: 'Trust stays attached',
    copy: 'SENTINEL, receipts, admin ops, and billing state remain part of the same surface.',
    accent: '#ff9b7a',
  },
];

const SHOWCASE_SECTIONS = [
  {
    id: 'workspace',
    eyebrow: 'Workspace cockpit',
    title: 'A command center that stays grounded.',
    copy: 'Messages, citations, schema badges, and handoffs are designed to stay legible while the system is moving.',
    accent: '#6cf6c4',
    bullets: ['Citations reveal with confidence', 'Schema verdicts stay visible', 'Voice and handoffs stay in flow'],
    videoLabel: 'Workspace demo reel',
  },
  {
    id: 'workflow',
    eyebrow: 'Workflow execution',
    title: 'Execution that reads like causality.',
    copy: 'Nodes, retries, and delivery events show a real operational timeline instead of a static graph.',
    accent: '#7fa3ff',
    bullets: ['Live node state pulses', 'Retries and failures are visible', 'Outbound webhooks close the loop'],
    videoLabel: 'Workflow execution reel',
  },
  {
    id: 'control',
    eyebrow: 'Operator control plane',
    title: 'Admin oversight without leaving the surface.',
    copy: 'Trace drilldowns, receipts, billing posture, and webhook health live in the same operator-grade environment.',
    accent: '#ff9b7a',
    bullets: ['Trace drilldowns show policy + cost', 'Receipts preserve before/after history', 'Health and billing stay visible'],
    videoLabel: 'Control plane reel',
  },
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
    if (reducedMotion || !scopeRef.current) {
      return undefined;
    }

    let active = true;
    let gsapContext = null;

    (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);

      if (!active || !scopeRef.current) {
        return;
      }

      gsap.registerPlugin(ScrollTrigger);
      gsapContext = gsap.context(() => {
        gsap.from('.prymal-hero__copy > *', {
          y: 28,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.08,
        });

        gsap.from('.prymal-video-card, .prymal-ivy__card, .prymal-showcase__panel', {
          y: 28,
          opacity: 0,
          duration: 0.7,
          ease: 'power2.out',
          stagger: 0.08,
          scrollTrigger: {
            trigger: scopeRef.current,
            start: 'top 70%',
          },
        });

        gsap.from('.prymal-hero__metric, .prymal-trust-chip, .prymal-pricing__card, .prymal-waitlist__card', {
          y: 20,
          opacity: 0,
          duration: 0.66,
          ease: 'power2.out',
          stagger: 0.06,
          scrollTrigger: {
            trigger: scopeRef.current,
            start: 'top 66%',
          },
        });

        gsap.to('.prymal-forest__trees--back', {
          yPercent: -6,
          ease: 'none',
          scrollTrigger: {
            trigger: scopeRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });

        gsap.to('.prymal-forest__trees--mid', {
          yPercent: -12,
          ease: 'none',
          scrollTrigger: {
            trigger: scopeRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });

        gsap.to('.prymal-forest__trees--front', {
          yPercent: -18,
          ease: 'none',
          scrollTrigger: {
            trigger: scopeRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });

        gsap.to('.prymal-marketing__aura--one', {
          xPercent: 8,
          yPercent: -5,
          ease: 'none',
          scrollTrigger: {
            trigger: scopeRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });

        gsap.to('.prymal-marketing__aura--two', {
          xPercent: -10,
          yPercent: 6,
          ease: 'none',
          scrollTrigger: {
            trigger: scopeRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });

        gsap.to('.prymal-ivy__stem', {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: '.prymal-ivy',
            start: 'top 75%',
            end: 'bottom 20%',
            scrub: true,
          },
        });

        gsap.utils.toArray('.prymal-showcase__visual').forEach((visual) => {
          gsap.to(visual, {
            y: -32,
            ease: 'none',
            scrollTrigger: {
              trigger: visual,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1.4,
            },
          });
        });
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

      <div className="prymal-marketing__aura prymal-marketing__aura--one" />
      <div className="prymal-marketing__aura prymal-marketing__aura--two" />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="landing" />

        <PageShell width="100%">
          <div className="prymal-homepage prymal-homepage--primal">
            <section className="prymal-hero">
              <div className="prymal-forest">
                <div className="prymal-forest__sky" />
                <div className="prymal-forest__trees prymal-forest__trees--back" />
                <div className="prymal-forest__trees prymal-forest__trees--mid" />
                <div className="prymal-forest__trees prymal-forest__trees--front" />
                <div className="prymal-forest__mist" />
                <div className="prymal-forest__ivy" />
              </div>

              <div className="prymal-hero__grid">
                <div className="prymal-hero__copy">
                  <div className="prymal-hero__pill">
                    Premium AI operating system | 15 specialists | Trust + orchestration built in
                  </div>
                  <h1>Run your business like a primal operating system.</h1>
                  <p>
                    Prymal is a premium multi-agent OS with grounded retrieval, workflows, realtime voice, and operator
                    oversight. It is built to feel alive, accountable, and execution-ready from the first click.
                  </p>

                  <div className="prymal-hero__actions">
                    <SignedOut>
                      <Link to="/signup">
                        <Button tone="accent">Start free</Button>
                      </Link>
                      <a href="#showcase">
                        <Button tone="ghost">Watch the system</Button>
                      </a>
                    </SignedOut>
                    <SignedIn>
                      <Link to="/app/dashboard">
                        <Button tone="accent">Open workspace</Button>
                      </Link>
                      <Link to="/app/workflows">
                        <Button tone="ghost">View workflows</Button>
                      </Link>
                    </SignedIn>
                  </div>

                  <div className="prymal-hero__metrics">
                    {HERO_METRICS.map((metric) => (
                      <MotionStat key={metric.label} className="prymal-hero__metric" accent="#6cf6c4">
                        <strong>{metric.value}</strong>
                        <span>{metric.label}</span>
                        <small>{metric.detail}</small>
                      </MotionStat>
                    ))}
                  </div>
                </div>

                <div className="prymal-hero__media">
                  <div className="prymal-video-card">
                    <div className="prymal-video-placeholder">
                      <div className="prymal-video-placeholder__badge">Hero video placeholder</div>
                      <div className="prymal-video-placeholder__caption">
                        Drop a cinematic product reel here. This slot is designed for a 16:9 or 21:9 hero video.
                      </div>
                    </div>
                  </div>

                  <div className="prymal-hero__media-row">
                    {['Workspace cut', 'Workflow cut', 'Admin cut'].map((label) => (
                      <div key={label} className="prymal-video-mini">
                        <span>{label}</span>
                        <div className="prymal-video-mini__surface" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <MotionSection className="prymal-ivy" delay={0.06} reveal={{ y: 24, blur: 10 }}>
              <div className="prymal-ivy__header">
                <div className="hero-pill">Primal operating loop</div>
                <h2>Sense. Route. Execute. Govern.</h2>
                <p>Every step is visible, animated, and designed to feel like a living system instead of a static UI.</p>
              </div>

              <div className="prymal-ivy__track">
                <div className="prymal-ivy__stem" />
                <div className="prymal-ivy__leaves" />
                <div className="prymal-ivy__cards">
                  {PRIMAL_STEPS.map((step) => (
                    <MotionCard key={step.id} className="prymal-ivy__card" accent={step.accent}>
                      <span className="prymal-ivy__eyebrow">{step.eyebrow}</span>
                      <h3>{step.title}</h3>
                      <p>{step.copy}</p>
                    </MotionCard>
                  ))}
                </div>
              </div>
            </MotionSection>

            <MotionSection id="showcase" className="prymal-showcase" delay={0.06} reveal={{ y: 24, blur: 10 }}>
              <div className="prymal-showcase__header">
                <div className="hero-pill">Cinematic product surfaces</div>
                <h2>Every surface is built for premium motion and trust.</h2>
                <p>Drop your showcase videos in the slots below. The layout keeps them the hero of each section.</p>
              </div>

              <div className="prymal-showcase__grid">
                {SHOWCASE_SECTIONS.map((section, index) => (
                  <div
                    key={section.id}
                    className={`prymal-showcase__panel${index % 2 === 1 ? ' is-reversed' : ''}`}
                  >
                    <div className="prymal-showcase__copy">
                      <span style={{ color: section.accent }}>{section.eyebrow}</span>
                      <h3>{section.title}</h3>
                      <p>{section.copy}</p>
                      <ul>
                        {section.bullets.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="prymal-showcase__media prymal-showcase__visual">
                      <div className="prymal-video-placeholder">
                        <div className="prymal-video-placeholder__badge">{section.videoLabel}</div>
                        <div className="prymal-video-placeholder__caption">
                          Place your cinematic loop or walkthrough here. 16:9 recommended.
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </MotionSection>

            <MotionSection id="pricing" className="prymal-pricing" delay={0.06} reveal={{ y: 24, blur: 10 }}>
              <div className="prymal-pricing__header">
                <div className="hero-pill">Plans built for real operators</div>
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
                    <MotionCard key={plan.id} className="prymal-pricing__card" accent={plan.accent}>
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
                    </MotionCard>
                  );
                })}
              </div>
            </MotionSection>

            <MotionSection className="prymal-waitlist" delay={0.06} reveal={{ y: 24, blur: 10 }}>
              <div className="prymal-waitlist__card">
                <div>
                  <span className="hero-pill">Prefer a guided rollout?</span>
                  <h2>Join the waitlist for a curated Prymal onboarding wave.</h2>
                  <p>
                    If you want a more hands-on workspace setup, leave your email and we will route you into the next
                    guided rollout group.
                  </p>
                </div>

                <form className="prymal-waitlist__form" onSubmit={handleWaitlistSubmit}>
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

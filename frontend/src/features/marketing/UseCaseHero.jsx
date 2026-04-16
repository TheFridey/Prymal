import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui';
import { MotionSection, usePrymalReducedMotion } from '../../components/motion';
import { getAgentMeta } from '../../lib/constants';

const CinematicHeroScene = lazy(() => import('./CinematicHeroScene'));

function ActionButton({ action, tone }) {
  if (!action) {
    return null;
  }

  const content = <Button tone={tone}>{action.label}</Button>;

  if (action.to) {
    return (
      <Link to={action.to} onClick={action.onClick}>
        {content}
      </Link>
    );
  }

  if (action.href) {
    return (
      <a href={action.href} onClick={action.onClick}>
        {content}
      </a>
    );
  }

  return null;
}

export function UseCaseHero({
  eyebrow,
  title,
  description,
  metrics = [],
  trustChips = [],
  sceneAgentIds = [],
  primaryAction,
  secondaryAction,
  hudCards = [],
  stageClassName = '',
}) {
  const reducedMotion = usePrymalReducedMotion();
  const [heroSceneReady, setHeroSceneReady] = useState(false);
  const scopeRef = useRef(null);

  const sceneAgents = useMemo(
    () => sceneAgentIds.map((id) => getAgentMeta(id)).filter(Boolean),
    [sceneAgentIds],
  );

  useEffect(() => {
    if (reducedMotion) {
      setHeroSceneReady(false);
      return undefined;
    }

    let active = true;
    let timeoutId = null;
    let idleId = null;

    const enable = () => {
      if (active) {
        setHeroSceneReady(true);
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(enable, { timeout: 900 });
    } else {
      timeoutId = window.setTimeout(enable, 260);
    }

    return () => {
      active = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (idleId && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [reducedMotion]);

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
        const introTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
        introTimeline
          .from('.prymal-usecase-hero__copy > *', {
            y: 34,
            opacity: 0,
            duration: 0.88,
            stagger: 0.08,
          })
          .from(
            '.prymal-usecase-hero__scene-shell',
            {
              y: 24,
              opacity: 0,
              scale: 0.985,
              filter: 'blur(10px)',
              duration: 0.92,
            },
            '-=0.58',
          );

        gsap.from('.prymal-usecase-hero .prymal-cinematic-stage__hud-card', {
          y: 24,
          opacity: 0,
          duration: 0.72,
          ease: 'power3.out',
          stagger: 0.1,
          delay: 0.14,
        });

        gsap.from('.prymal-usecase-metric, .prymal-usecase-hero .prymal-trust-chip', {
          y: 18,
          opacity: 0,
          duration: 0.62,
          ease: 'power2.out',
          stagger: 0.06,
          delay: 0.18,
        });

        gsap.to('.prymal-usecase-hero__scene-shell', {
          yPercent: 6,
          ease: 'none',
          scrollTrigger: {
            trigger: scopeRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });

        gsap.utils.toArray('.prymal-cinematic-stage__hud-card').forEach((card) => {
          gsap.to(card, {
            y: -20,
            ease: 'none',
            scrollTrigger: {
              trigger: card,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1.3,
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

  return (
    <section ref={scopeRef} className="prymal-usecase-hero">
      <MotionSection className="prymal-usecase-hero__copy" delay={0.04} reveal={{ y: 24, blur: 10 }}>
        <div className="hero-pill prymal-usecase-hero__pill">{eyebrow}</div>
        <h1 className="prymal-usecase-hero__headline">{title}</h1>
        <p className="prymal-usecase-hero__subcopy">{description}</p>

        <div className="prymal-usecase-hero__actions">
          <ActionButton action={primaryAction} tone="accent" />
          <ActionButton action={secondaryAction} tone="ghost" />
        </div>

        {metrics.length > 0 ? (
          <div className="prymal-usecase-hero__metrics">
            {metrics.map((metric) => (
              <div key={metric.label} className="prymal-usecase-metric">
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        {trustChips.length > 0 ? (
          <div className="prymal-usecase-hero__trust">
            {trustChips.map((chip) => (
              <span key={chip} className="prymal-trust-chip">
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </MotionSection>

      <MotionSection className="prymal-usecase-hero__scene" delay={0.12} reveal={{ x: 20, y: 0, blur: 10 }}>
        <div className={`prymal-cinematic-stage prymal-cinematic-stage--usecase prymal-usecase-hero__scene-shell ${stageClassName}`.trim()}>
          {heroSceneReady ? (
            <Suspense
              fallback={(
                <div className="prymal-cinematic-stage__fallback">
                  <div className="prymal-cinematic-stage__fallback-core" />
                  <div className="prymal-cinematic-stage__fallback-ring prymal-cinematic-stage__fallback-ring--inner" />
                  <div className="prymal-cinematic-stage__fallback-ring prymal-cinematic-stage__fallback-ring--outer" />
                </div>
              )}
            >
              <CinematicHeroScene agents={sceneAgents} />
            </Suspense>
          ) : (
            <div className="prymal-cinematic-stage__fallback">
              <div className="prymal-cinematic-stage__fallback-core" />
              <div className="prymal-cinematic-stage__fallback-ring prymal-cinematic-stage__fallback-ring--inner" />
              <div className="prymal-cinematic-stage__fallback-ring prymal-cinematic-stage__fallback-ring--outer" />
              {sceneAgents.map((agent) => (
                <span
                  key={agent.id}
                  className="prymal-cinematic-stage__fallback-node"
                  style={{ '--node-accent': agent.color }}
                >
                  {agent.name}
                </span>
              ))}
            </div>
          )}

          <div className="prymal-cinematic-stage__hud">
            {hudCards.map((card) => (
              <div key={card.title} className={`prymal-cinematic-stage__hud-card ${card.position ?? ''}`.trim()}>
                <strong>{card.title}</strong>
                {card.chips?.length ? (
                  <div className="prymal-cinematic-stage__hud-pills">
                    {card.chips.map((chip) => (
                      <span key={chip} className="prymal-cinematic-stage__hud-pill">
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
                {card.body ? <span>{card.body}</span> : null}
              </div>
            ))}
          </div>
        </div>
      </MotionSection>
    </section>
  );
}

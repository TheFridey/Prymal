import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import {
  TbBolt,
  TbBrain,
  TbBuildingStore,
  TbChecks,
  TbFileAnalytics,
  TbRoute,
  TbShieldCheck,
  TbSparkles,
} from 'react-icons/tb';

const FULL_MODE_CONTENT = {
  simple: {
    label: 'Simple Mode',
    title: 'Start with one task',
    subtitle: 'Choose a guided workflow, answer a few questions, and let Prymal handle the structure.',
    cta: 'Start with a task',
    href: '/signup',
    modeMicrocopy: 'Guided tasks for getting value quickly.',
    microcopy: 'No setup required. No complex workflow building. Just pick a task and run.',
    defaultWin: {
      badge: 'Most popular starting point',
      title: 'Generate a 30-day content plan',
      description: 'Turn one business goal into a full month of posts, campaign angles and ready-to-use content ideas.',
      cta: 'Start with this',
    },
    cards: [
      {
        title: 'Content Engine',
        description: 'Create posts, campaigns and content plans without building a workflow from scratch.',
        Icon: TbFileAnalytics,
      },
      {
        title: 'Website Audit',
        description: 'Analyse a site, identify improvements and generate clear next steps.',
        Icon: TbChecks,
      },
      {
        title: 'Lead Generation',
        description: 'Build outreach angles, lead research prompts and follow-up sequences.',
        Icon: TbBuildingStore,
      },
      {
        title: 'Business Assistant',
        description: 'Use Prymal like a smart operator for everyday business tasks.',
        Icon: TbSparkles,
      },
    ],
  },
  advanced: {
    label: 'Advanced Mode',
    title: 'Scale into the full AI operating system',
    subtitle: 'Build deeper workflows with agents, memory, validation and cost-controlled execution.',
    cta: 'Build a workflow',
    href: '/app/workflows',
    modeMicrocopy: "You're viewing the full AI operating system.",
    microcopy: 'Use the surface-level assistant when you want speed. Use the full system when you need scale.',
    scaleLine: 'Built for repeatable workflows, client work and high-volume execution.',
    reassurance: "You don't need to start here, but it's ready when you need more control.",
    usedFor: {
      title: 'Used for serious execution',
      bullets: ['Running client workflows', 'Automating business operations', 'Scaling output across teams'],
      line: 'Designed for repeated, high-volume execution without losing control of cost or quality.',
    },
    cards: [
      {
        title: 'Multi-Agent Workflows',
        description: 'Chain specialist agents together for larger business processes.',
        Icon: TbRoute,
      },
      {
        title: 'LORE Memory',
        description: 'Give Prymal persistent business context, files, notes and knowledge.',
        Icon: TbBrain,
      },
      {
        title: 'SENTINEL Validation',
        description: 'Review, repair or hold risky outputs before they reach the user.',
        Icon: TbShieldCheck,
      },
      {
        title: 'Usage Control',
        description: 'Run AI at scale with credits, caps, add-ons and admin economics.',
        Icon: TbBolt,
      },
    ],
  },
};

const COMPACT_MODE_CONTENT = {
  simple: {
    label: 'Simple Mode',
    title: 'Start with a guided task',
    subtitle: 'Pick a simple workflow and get a useful result fast.',
    paths: ['Content builder', 'Website audit', 'Lead generation', 'First agent chat'],
  },
  advanced: {
    label: 'Advanced Mode',
    title: 'Build a custom workflow',
    subtitle: 'Start with agents, memory and workflow logic from day one.',
    paths: ['Workflow builder', 'LORE setup', 'Integrations', 'Agent selection'],
  },
};

const SIGNED_IN_SIMPLE_ROUTE = '/app/dashboard?intent=simple';
const SIGNED_IN_ADVANCED_ROUTE = '/app/workflows';
const SIGNED_OUT_SIMPLE_ROUTE = '/signup?intent=simple&redirect_url=%2Fapp%2Fdashboard%3Fintent%3Dsimple';
const SIGNED_OUT_ADVANCED_ROUTE = '/signup?intent=advanced&redirect_url=%2Fapp%2Fworkflows';

function trackModeEvent(eventName, metadata = {}) {
  if (typeof window !== 'undefined' && typeof window.prymalTrack === 'function') {
    try {
      window.prymalTrack(eventName, metadata);
    } catch {
      // Analytics should never break the positioning layer.
    }
  }
}

function persistStartIntent(intent, route) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem('prymal_start_intent', intent);
    window.sessionStorage.setItem('prymal_start_redirect', route);
  } catch {
    // Storage can be blocked in private contexts; query params still carry intent to signup.
  }
}

export function SimpleAdvancedModeSection({
  variant = 'full',
  selectedMode,
  onModeChange,
  simpleHref,
  advancedHref,
  surface = variant === 'compact' ? 'onboarding' : 'landing',
}) {
  const { isSignedIn } = useAuth();
  const fallbackId = useId();
  const [internalMode, setInternalMode] = useState('simple');
  const viewedRef = useRef(false);
  const mode = selectedMode ?? internalMode;
  const isCompact = variant === 'compact';
  const content = isCompact ? COMPACT_MODE_CONTENT[mode] : FULL_MODE_CONTENT[mode];
  const modeKeys = ['simple', 'advanced'];

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackModeEvent('simple_advanced_mode_viewed', {
      surface,
      selectedMode: mode,
      variant,
    });
  }, [mode, surface, variant]);

  const setMode = (nextMode) => {
    setInternalMode(nextMode);
    onModeChange?.(nextMode);
    trackModeEvent(nextMode === 'simple' ? 'simple_mode_selected' : 'advanced_mode_selected', {
      surface,
      selectedMode: nextMode,
      previousMode: mode,
      variant,
    });
  };

  const trackCta = (eventName, ctaType, route) => {
    trackModeEvent(eventName, {
      surface,
      selectedMode: mode,
      ctaType,
      route,
      variant,
    });
  };

  if (isCompact) {
    return (
      <section
        className="pm-mode-switch pm-mode-switch--compact"
        aria-labelledby={`${fallbackId}-heading`}
        data-event="simple_advanced_mode_viewed"
        data-surface={surface}
        data-selected-mode={mode}
      >
        <div className="pm-mode-switch__compact-head">
          <div>
            <div className="pm-mode-switch__eyebrow">Start path</div>
            <h2 id={`${fallbackId}-heading`}>Choose how you want to start</h2>
          </div>
          <ModeTabs idPrefix={fallbackId} mode={mode} modeKeys={modeKeys} onModeChange={setMode} surface={surface} />
        </div>

        <div
          id={`${fallbackId}-${mode}-panel`}
          className="pm-mode-switch__compact-panel"
          role="tabpanel"
          aria-labelledby={`${fallbackId}-${mode}-tab`}
          data-mode={mode}
        >
          <h3>{content.title}</h3>
          <p>{content.subtitle}</p>
          <div className="pm-mode-switch__path-grid">
            {content.paths.map((path) => (
              <span key={path}>{path}</span>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const resolvedSimpleHref = simpleHref ?? (isSignedIn ? SIGNED_IN_SIMPLE_ROUTE : SIGNED_OUT_SIMPLE_ROUTE);
  const resolvedAdvancedHref = advancedHref ?? (isSignedIn ? SIGNED_IN_ADVANCED_ROUTE : SIGNED_OUT_ADVANCED_ROUTE);
  const ctaHref = mode === 'simple' ? resolvedSimpleHref : resolvedAdvancedHref;
  const defaultWinHref = resolvedSimpleHref;

  return (
    <section
      id="start-modes"
      className="pm-mode-switch"
      aria-labelledby={`${fallbackId}-heading`}
      data-event="simple_advanced_mode_viewed"
      data-surface={surface}
      data-selected-mode={mode}
    >
      <div className="pm-section__header pm-mode-switch__header">
        <div className="pm-section__eyebrow" style={{ '--section-accent': '#9cf5e0' }}>Simple Mode / Advanced Mode</div>
        <h2 id={`${fallbackId}-heading`} className="pm-section__title">Start simple. Scale into the full system.</h2>
        <p className="pm-section__sub">
          Prymal can feel as quick as a guided task on day one, then open into workflows, memory, validation, and cost control when the work gets serious.
        </p>
      </div>

      <ModeTabs idPrefix={fallbackId} mode={mode} modeKeys={modeKeys} onModeChange={setMode} surface={surface} />
      <p className="pm-mode-switch__mode-note" data-mode={mode}>{content.modeMicrocopy}</p>

      <div
        id={`${fallbackId}-${mode}-panel`}
        className="pm-mode-switch__panel"
        role="tabpanel"
        aria-labelledby={`${fallbackId}-${mode}-tab`}
        data-mode={mode}
      >
        <div className="pm-mode-switch__copy">
          <h3>{content.title}</h3>
          <p>{content.subtitle}</p>
          {content.scaleLine ? <p className="pm-mode-switch__scale-line">{content.scaleLine}</p> : null}
          {content.reassurance ? <p className="pm-mode-switch__reassurance">{content.reassurance}</p> : null}
        </div>

        {mode === 'simple' ? (
          <article className="pm-mode-switch__default-win">
            <div>
              <span className="pm-mode-switch__default-badge">{content.defaultWin.badge}</span>
              <h4>{content.defaultWin.title}</h4>
              <p>{content.defaultWin.description}</p>
            </div>
            <Link
              to={defaultWinHref}
              className="pm-btn pm-btn--primary pm-mode-switch__default-cta"
              data-event="simple_mode_default_win_clicked"
              data-surface={surface}
              data-selected-mode={mode}
              data-cta-type="default_win"
              onClick={() => {
                if (!isSignedIn) persistStartIntent('simple', SIGNED_IN_SIMPLE_ROUTE);
                trackCta('simple_mode_default_win_clicked', 'default_win', defaultWinHref);
              }}
            >
              {content.defaultWin.cta}
            </Link>
          </article>
        ) : null}

        <div className="pm-mode-switch__cards">
          {content.cards.map(({ title, description, Icon }) => (
            <article key={title} className="pm-mode-switch__card">
              <span className="pm-mode-switch__icon" aria-hidden="true"><Icon /></span>
              <h4>{title}</h4>
              <p>{description}</p>
            </article>
          ))}
        </div>

        {mode === 'advanced' ? (
          <aside className="pm-mode-switch__used-for" aria-label="Advanced Mode use cases">
            <div>
              <h4>{content.usedFor.title}</h4>
              <ul>
                {content.usedFor.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
            <p>{content.usedFor.line}</p>
          </aside>
        ) : null}

        <div className="pm-mode-switch__actions">
          <Link
            to={ctaHref}
            className="pm-btn pm-btn--primary"
            data-event={mode === 'simple' ? 'simple_mode_cta_clicked' : 'advanced_mode_cta_clicked'}
            data-surface={surface}
            data-selected-mode={mode}
            data-cta-type="primary"
            onClick={() => {
              if (!isSignedIn) persistStartIntent(mode, mode === 'simple' ? SIGNED_IN_SIMPLE_ROUTE : SIGNED_IN_ADVANCED_ROUTE);
              trackCta(mode === 'simple' ? 'simple_mode_cta_clicked' : 'advanced_mode_cta_clicked', 'primary', ctaHref);
            }}
          >
            {content.cta}
          </Link>
          <span>{content.microcopy}</span>
        </div>
      </div>
    </section>
  );
}

function ModeTabs({ idPrefix, mode, modeKeys, onModeChange, surface }) {
  return (
    <div className="pm-mode-switch__toggle" role="tablist" aria-label="Choose Prymal start mode">
      <span className={`pm-mode-switch__indicator pm-mode-switch__indicator--${mode}`} aria-hidden="true" />
      {modeKeys.map((modeKey) => (
        <button
          key={modeKey}
          id={`${idPrefix}-${modeKey}-tab`}
          type="button"
          role="tab"
          aria-selected={mode === modeKey}
          aria-controls={`${idPrefix}-${modeKey}-panel`}
          className={`pm-mode-switch__tab${mode === modeKey ? ' is-active' : ''}`}
          data-event={modeKey === 'simple' ? 'simple_mode_selected' : 'advanced_mode_selected'}
          data-surface={surface}
          data-selected-mode={modeKey}
          onClick={() => onModeChange(modeKey)}
        >
          {FULL_MODE_CONTENT[modeKey].label}
        </button>
      ))}
    </div>
  );
}

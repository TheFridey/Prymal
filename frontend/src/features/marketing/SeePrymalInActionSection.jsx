import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { TbCircleCheck } from 'react-icons/tb';

const SIGNED_IN_SIMPLE_ROUTE = '/app/dashboard?intent=simple';
const SIGNED_OUT_SIMPLE_ROUTE = '/signup?intent=simple&redirect_url=%2Fapp%2Fdashboard%3Fintent%3Dsimple';

const ACTION_EXAMPLES = [
  {
    key: 'content_strategy',
    input: 'Build me a 30-day content strategy',
    output: [
      'Full content calendar',
      'Platform-specific posts',
      'Campaign angles',
      'Ready-to-publish content',
    ],
  },
  {
    key: 'website_audit',
    input: 'Audit my website',
    output: [
      'SEO issues identified',
      'UX improvements suggested',
      'Conversion fixes',
      'Actionable roadmap',
    ],
  },
  {
    key: 'agency_lead_generation',
    input: 'Create a lead generation workflow for agencies.',
    output: [
      'ICP outline',
      'Outreach angles',
      'Follow-up sequence',
      'Workflow steps',
    ],
  },
];

const TRUST_BADGES = [
  'Multi-agent execution',
  'Memory-aware workflows',
  'Output validation',
  'Cost-controlled AI',
];

function trackActionEvent(eventName, metadata = {}) {
  if (typeof window === 'undefined' || typeof window.prymalTrack !== 'function') return;
  try {
    window.prymalTrack(eventName, metadata);
  } catch {
    // Analytics should never break the marketing page.
  }
}

function persistSimpleIntent() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem('prymal_start_intent', 'simple');
    window.sessionStorage.setItem('prymal_start_redirect', SIGNED_IN_SIMPLE_ROUTE);
  } catch {
    // Query params still carry intent if storage is blocked.
  }
}

export function SeePrymalInActionSection({ signedIn = false, surface = 'landing' }) {
  const viewedRef = useRef(false);
  const route = signedIn ? SIGNED_IN_SIMPLE_ROUTE : SIGNED_OUT_SIMPLE_ROUTE;
  const selectedExample = ACTION_EXAMPLES[0].key;

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackActionEvent('see_prymal_action_viewed', {
      selectedExample,
      surface,
      route,
      signedIn: Boolean(signedIn),
    });
  }, [route, selectedExample, signedIn, surface]);

  return (
    <section
      className="pm-action-examples"
      aria-labelledby="pm-action-examples-title"
      data-event="see_prymal_action_viewed"
      data-surface={surface}
      data-selected-example={selectedExample}
    >
      <div className="pm-section__header">
        <div className="pm-section__eyebrow" style={{ '--section-accent': '#9cf5e0' }}>Execution examples</div>
        <h2 id="pm-action-examples-title" className="pm-section__title">See Prymal in action</h2>
        <p className="pm-section__sub">
          Start with a simple request. Prymal turns it into structured, usable business output.
        </p>
      </div>

      <div className="pm-action-examples__grid">
        {ACTION_EXAMPLES.map((example, index) => (
          <article key={example.key} className="pm-action-example" style={{ '--example-delay': `${index * 0.12}s` }}>
            <div className="pm-action-example__bar" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="pm-action-example__input">
              <span>INPUT:</span>
              <p>{example.input}</p>
            </div>
            <div className="pm-action-example__output">
              <span>OUTPUT:</span>
              <ul>
                {example.output.map((item) => (
                  <li key={item}>
                    <TbCircleCheck aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>

      <div className="pm-action-examples__trust-strip">
        <p>Built for founders, operators and agencies who need AI to execute, not just respond.</p>
        <div>
          {TRUST_BADGES.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
      </div>

      <div className="pm-action-examples__actions">
        <Link
          to={route}
          className="pm-btn pm-btn--primary"
          data-event="see_prymal_action_cta_clicked"
          data-surface={surface}
          data-selected-example={selectedExample}
          onClick={() => {
            if (!signedIn) persistSimpleIntent();
            trackActionEvent('see_prymal_action_cta_clicked', {
              selectedExample,
              surface,
              route,
              signedIn: Boolean(signedIn),
            });
          }}
        >
          Try a guided task
        </Link>
      </div>
    </section>
  );
}

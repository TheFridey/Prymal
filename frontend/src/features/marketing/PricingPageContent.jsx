import { useState } from 'react';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import {
  TbBolt,
  TbCheck,
  TbCoin,
  TbMovie,
  TbScale,
  TbX,
} from 'react-icons/tb';
import {
  BILLING_INTERVALS,
  FOUNDING_ACCESS_DISCOUNT_PERCENT,
  PLAN_ENTITLEMENTS,
  PLAN_LIBRARY,
  PREFERRED_CREDIT_PACKS_PUBLIC,
  getPlanPrice,
} from '../../lib/constants';
import { shouldShowFoundingPricingUi } from './founding-access';

const PERSONA_LINE = {
  solo: 'For individuals getting started',
  pro: 'For serious operators',
  teams: 'For collaborative workflows',
  agency: 'For client-scale execution',
};

const PRIORITY_LABEL = {
  solo: 'Standard',
  pro: 'Elevated',
  teams: 'High',
  agency: 'Priority',
};

const PLAN_POWER_LINE = {
  solo: 'Starter workflows, shallow LORE memory, 1 execution lane',
  pro: 'Production workflows, medium LORE memory, 3 concurrent runs',
  teams: 'Shared workflows, deeper LORE memory, 5 concurrent runs',
  agency: 'Client-scale workflows, deeper LORE memory, 8 concurrent runs',
};

const PLAN_BADGES = {
  pro: 'Best value',
  agency: 'Scale plan',
};

const WHOLE_GBP_FORMATTER = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const PLATFORM_COMPARISON_ROWS = [
  ['AI chat / prompts', 'yes', 'yes'],
  ['Multi-agent system', 'no', 'yes'],
  ['Workflow automation', 'no', 'yes'],
  ['Persistent memory', 'no', 'yes'],
  ['Output validation (QA layer)', 'no', 'yes'],
  ['Cost control system', 'no', 'yes'],
  ['Admin usage visibility', 'no', 'yes'],
  ['Scales with teams', 'Limited', 'yes'],
  ['Add-ons instead of hidden overuse cost', 'no', 'yes'],
];

const FAQ_ITEMS = [
  {
    q: 'How do credits work?',
    a: 'Credits are used when you run execution work: chat, agents, workflows, retrieval-heavy tasks, and guided image generation draw from your execution balance. Most short runs use about 1-3 credits; larger workflows with more context use more. AI video credits are separate and only power AI-generated video renders.',
  },
  {
    q: 'What happens if I run out?',
    a: 'New runs that need credits pause until your next reset or until you add capacity. We show usage in real time in your workspace so you are never surprised.',
  },
  {
    q: 'Can I buy more?',
    a: 'Yes. Credit packs are available as a top-up if you need a short boost. For steady growth, upgrading your plan is usually better value.',
  },
  {
    q: 'Do credits roll over?',
    a: 'Included monthly credits refresh on your billing cycle and do not roll over. Purchased top-up credits follow the terms shown at checkout and in your billing portal.',
  },
  {
    q: 'Is pricing predictable?',
    a: 'Your subscription price is fixed in GBP. Usage stays within the included execution credits and AI video credits for your tier, with clear limits for concurrent runs and daily video caps on higher plans.',
  },
  {
    q: 'Fair usage',
    a: 'Prymal includes generous monthly usage allowances. Heavy media generation, deep memory retrieval, bulk workflows, and premium model usage are subject to fair-use controls and may require usage packs.',
  },
  {
    q: 'Are there usage limits?',
    a: 'Yes. Every tier has clear execution and AI video allowances, plus fair-use controls for costly workloads. Usage packs refill capacity for short bursts — they do not remove limits.',
  },
  {
    q: 'What media can I generate?',
    a: 'The guided image builder uses execution credits. The guided video builder supports Fast Draft and Cinematic one-shot renders at 4, 6, or 8 seconds; video reference images currently require the Cinematic lane at 8 seconds.',
  },
];

function scrollToPricingGrid() {
  document.getElementById('pricing-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function ComparisonValue({ value, highlight = false }) {
  if (value === 'yes') {
    return (
      <span className={`pricing-platform-compare__mark pricing-platform-compare__mark--yes${highlight ? ' is-highlight' : ''}`}>
        <TbCheck aria-hidden="true" />
        <span className="pricing-compare-sr-only">Included</span>
      </span>
    );
  }

  if (value === 'no') {
    return (
      <span className="pricing-platform-compare__mark pricing-platform-compare__mark--no">
        <TbX aria-hidden="true" />
        <span className="pricing-compare-sr-only">Not included</span>
      </span>
    );
  }

  return <span className="pricing-platform-compare__limited">{value}</span>;
}

export function PricingPageContent({ foundingAccessState = { status: 'idle', offer: null } }) {
  const [billingInterval, setBillingInterval] = useState(BILLING_INTERVALS[0]?.id ?? 'monthly');
  const activeInterval = BILLING_INTERVALS.find((i) => i.id === billingInterval) ?? BILLING_INTERVALS[0];
  const foundingAccessActive = shouldShowFoundingPricingUi(foundingAccessState);
  const devPricingUnavailable = Boolean(foundingAccessState.offer?.devPricingUnavailable);

  return (
    <>
      <section className="pricing-hero" aria-labelledby="pricing-hero-title">
        <div className="pricing-hero__eyebrow">
          <span className="pricing-hero__eyebrow-dot" aria-hidden="true" />
          Plans &amp; credits
        </div>
        <h1 id="pricing-hero-title" className="pricing-hero__title">
          Run your entire business with AI agents
        </h1>
        <p className="pricing-hero__lede">
          Choose a lane in seconds: Solo is the starter tier, Pro for serious operators, Teams for collaboration, Agency for
          client-scale orchestration. Usage packs are available when you need extra execution or video renders without changing
          caps or safety controls.
        </p>
        <div className="pricing-hero__ctas">
          <SignedOut>
            <Link to="/signup" className="button button--accent">
              Start now
            </Link>
            <button type="button" className="pricing-hero__secondary" onClick={scrollToPricingGrid}>
              View pricing
            </button>
          </SignedOut>
          <SignedIn>
            <Link to="/app/dashboard" className="button button--accent">
              Open workspace
            </Link>
            <Link to="/app/settings?tab=Billing" className="pricing-hero__secondary">
              Billing &amp; upgrade
            </Link>
          </SignedIn>
        </div>
      </section>

      {devPricingUnavailable ? (
        <p className="pricing-dev-hint" role="status">
          Development mode: run the API (e.g. port 3001) with a connected database so the live offer endpoint can confirm
          availability and Stripe checkout can apply eligible founder price IDs.
        </p>
      ) : null}

      {foundingAccessActive ? (
        <section className="pricing-founding-banner" aria-labelledby="founding-access-heading">
          <div>
            <div className="pricing-founding-banner__eyebrow">Limited founding accounts</div>
            <h2 id="founding-access-heading">Founding Access: {FOUNDING_ACCESS_DISCOUNT_PERCENT}% off for your first 3 months</h2>
            <p>
              Founder badge, priority onboarding, early roadmap access, and a one-time onboarding execution credit bonus. Standard
              monthly usage limits apply — discount renews at standard plan rates after the founding window (see checkout &amp;
              billing portal for your quote).
            </p>
          </div>
          <button type="button" className="button button--accent" onClick={scrollToPricingGrid}>
            Claim Founding Access
          </button>
        </section>
      ) : null}

      <section className="pricing-platform-compare" aria-labelledby="platform-compare-heading">
        <div className="pricing-platform-compare__header">
          <h2 id="platform-compare-heading">Not all AI platforms are built the same</h2>
          <p>Execution, memory, validation, and usage control are built into the system.</p>
        </div>
        <div className="pricing-platform-compare__scroll" role="region" aria-label="AI platform comparison table" tabIndex={0}>
          <table className="pricing-platform-compare__table">
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Typical AI Tools</th>
                <th scope="col" className="pricing-platform-compare__brand">Prymal</th>
              </tr>
            </thead>
            <tbody>
              {PLATFORM_COMPARISON_ROWS.map(([feature, typical, prymal]) => (
                <tr key={feature}>
                  <td>{feature}</td>
                  <td><ComparisonValue value={typical} /></td>
                  <td className="pricing-platform-compare__brand"><ComparisonValue value={prymal} highlight /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pricing-platform-compare__footer">Most tools generate content. Prymal runs systems.</p>
      </section>

      <div className="pricing-intervals">
        <div className="pricing-intervals__inner" role="tablist" aria-label="Billing period">
          {BILLING_INTERVALS.map((interval) => (
            <button
              key={interval.id}
              type="button"
              role="tab"
              aria-selected={interval.id === billingInterval}
              className={`pricing-intervals__btn${interval.id === billingInterval ? ' is-active' : ''}`}
              onClick={() => setBillingInterval(interval.id)}
            >
              <span>{interval.label}</span>
              {interval.caption ? <small>{interval.caption}</small> : null}
            </button>
          ))}
        </div>
      </div>

      <p className="pricing-cards-hint">Swipe to compare plans</p>
      <div
        id="pricing-plans"
        className="pricing-cards"
        role="region"
        aria-label="Pricing plans — swipe sideways on small screens"
      >
        {PLAN_LIBRARY.map((plan) => {
          const ent = PLAN_ENTITLEMENTS[plan.id];
          const price = getPlanPrice(plan, activeInterval.id);
          const isPro = plan.id === 'pro';
          const planBadge = PLAN_BADGES[plan.id];
          return (
            <article
              key={plan.id}
              className={`pricing-card${isPro ? ' pricing-card--pro' : ''}${foundingAccessActive ? ' pricing-card--founding' : ''}`}
              aria-label={`${plan.name} plan`}
            >
              {planBadge ? (
                <div className={`pricing-card__badge${plan.id === 'agency' ? ' pricing-card__badge--scale' : ''}`}>
                  {planBadge}
                </div>
              ) : foundingAccessActive ? (
                <div className="pricing-card__badge pricing-card__badge--founding">Founding Access</div>
              ) : null}
              <h2 className="pricing-card__name">{plan.name}</h2>
              {plan.monthlyPriceLabel ? (
                <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '6px' }}>{plan.monthlyPriceLabel}</p>
              ) : null}
              <p className="pricing-card__persona">{PERSONA_LINE[plan.id]}</p>
              <p className="pricing-card__power-line">{PLAN_POWER_LINE[plan.id]}</p>
              <div
                className={`pricing-card__price${foundingAccessActive ? ' pricing-card__price--founding' : ''}`}
                aria-label={
                  foundingAccessActive
                    ? `${plan.name} founding price ${price.founding.display}, originally ${price.display}, ${price.founding.discountLabel}`
                    : `${plan.name} price ${price.display}`
                }
              >
                {foundingAccessActive ? (
                  <div className="pricing-card__price-stack" aria-hidden="true">
                    <span className="pricing-card__price-was">{price.display}</span>
                    <span className="pricing-card__price-now">{price.founding.display}</span>
                    <span className="pricing-card__discount-pill">{price.founding.discountLabel}</span>
                  </div>
                ) : (
                  price.display
                )}
                <small> / {price.suffix}</small>
              </div>
              {foundingAccessActive ? (
                <p className="pricing-card__period-note">
                  Founding price shown for the intro window; then {price.display} / {price.suffix}. Checkout confirms eligibility.
                </p>
              ) : price.hasPeriodDiscount ? (
                <p className="pricing-card__period-note">
                  {price.monthlyEquivalent} · {price.discountLabel ?? 'Longer commitment'}
                </p>
              ) : (
                <p className="pricing-card__period-note">Billed monthly</p>
              )}
              <ul className="pricing-card__list">
                <li>
                  {plan.credits.toLocaleString('en-GB')} execution credits / month (metered with clear plan caps)
                </li>
                <li>
                  {plan.seats.toLocaleString('en-GB')} {plan.seats === 1 ? 'seat' : 'seats'} included
                  {plan.additionalSeatPrice ? `; extra seats ${WHOLE_GBP_FORMATTER.format(plan.additionalSeatPrice)}/mo` : ''}
                </li>
                <li>
                  {ent.monthlyVideoCredits > 0
                    ? `${ent.monthlyVideoCredits} AI video credits / month`
                    : 'AI video credits via upgrade'}
                </li>
                <li>Guided image builder uses execution credits</li>
                <li>AI system workflows &amp; automations</li>
                {foundingAccessActive ? <li>Bonus launch execution credits (one-time, same limits as standard plans)</li> : null}
                {foundingAccessActive ? <li>Founder badge &amp; early roadmap access</li> : null}
                <li>
                  {ent.concurrencyExecution > 1
                    ? `Run up to ${ent.concurrencyExecution} execution runs at once`
                    : 'Single-lane execution runs (upgrade for more)'}
                </li>
              </ul>
              <div className="pricing-card__cta">
                <SignedOut>
                  <Link
                    to={foundingAccessActive ? '/signup?offer=founding-access' : '/signup'}
                    className={(isPro || foundingAccessActive) ? 'button button--accent button--block' : 'button button--ghost button--block'}
                  >
                    {foundingAccessActive ? 'Claim Founding Access' : isPro ? 'Start on Pro' : 'Start now'}
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link
                    to={foundingAccessActive ? '/app/settings?tab=Billing&offer=founding-access' : '/app/settings?tab=Billing'}
                    className={(isPro || foundingAccessActive) ? 'button button--accent button--block' : 'button button--ghost button--block'}
                  >
                    {foundingAccessActive ? 'Claim Founding Access' : isPro ? 'Upgrade to Pro' : 'Choose plan'}
                  </Link>
                </SignedIn>
              </div>
            </article>
          );
        })}
      </div>

      <section className="pricing-usage-clarity" aria-labelledby="usage-clarity-heading">
        <div className="pricing-usage-clarity__header">
          <h2 id="usage-clarity-heading">Built for real usage, not hidden limits</h2>
          <p>Execution credits, video credits, and add-on packs are designed for predictable scaling.</p>
        </div>
        <div className="pricing-usage-clarity__grid">
          <article>
            <span className="pricing-usage-clarity__icon" aria-hidden="true"><TbBolt /></span>
            <h3>Execution credits</h3>
            <p>Used for chat, agents, workflow runs, retrieval-heavy work, guided image generation, and other execution activity.</p>
          </article>
          <article>
            <span className="pricing-usage-clarity__icon" aria-hidden="true"><TbMovie /></span>
            <h3>Guided video builder</h3>
            <p>Fast Draft and Cinematic renders use separate video credits, with 4, 6, or 8 second one-shot outputs.</p>
          </article>
          <article>
            <span className="pricing-usage-clarity__icon" aria-hidden="true"><TbCoin /></span>
            <h3>Add-on packs</h3>
            <p>Top up for short bursts of execution or video without turning usage into surprise overage.</p>
          </article>
        </div>
      </section>

      <section className="pricing-explainer" aria-labelledby="credit-clarity-heading">
        <div className="pricing-panel">
          <h3 id="credit-clarity-heading">How credits work</h3>
          <p>
            <strong>Credits are used when you run execution work.</strong> A quick reply might be one credit; a deep multi-step workflow
            uses more. Guided image generation also uses execution credits. Most everyday tasks fall in the 1–3 credit range; larger automations scale up from there.
          </p>
          <p>
            <strong>AI video credits power video renders only.</strong> They are separate from execution credits so you always
            know what kind of work you are funding.
          </p>
        </div>
        <div className="pricing-panel">
          <h3>Simple, predictable billing</h3>
          <p>
            Your plan price is fixed. Included execution credits and AI video credits reset each billing cycle. You can see remaining
            balances in the app, get early warnings as you approach limits, and add top-ups only if you need them.
          </p>
        </div>
      </section>

      <section aria-labelledby="credit-types-heading">
        <h2 id="credit-types-heading" className="pricing-section-title" style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          Two balances, one workspace
        </h2>
        <div className="pricing-credit-visual">
          <div className="pricing-credit-visual__block">
            <h4>
              <span className="pricing-credit-visual__icon" aria-hidden="true">
                ⚡
              </span>
              Execution credits
            </h4>
            <p>Used for chat, agents, workflows, and guided image generation — everything that is not video output.</p>
          </div>
          <div className="pricing-credit-visual__block pricing-credit-visual__block--video">
            <h4>
              <span className="pricing-credit-visual__icon" aria-hidden="true">
                ▶
              </span>
              AI video credits
            </h4>
            <p>Used only when you create AI-generated video renders. Reference images are currently supported on the Cinematic lane at 8 seconds.</p>
          </div>
        </div>
        <div className="pricing-reassure">
          <h4>You are always in control</h4>
          <ul>
            <li>See usage in real time in the dashboard and settings</li>
            <li>Get alerts before you hit limits</li>
            <li>Upgrade for sustained volume, or add a pack for a short burst</li>
          </ul>
        </div>
      </section>

      <section className="pricing-compare-wrap" aria-labelledby="plan-compare-heading">
        <h2 id="plan-compare-heading" className="pricing-section-title" style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          Compare plan limits
        </h2>
        <p className="pricing-compare-hint">Swipe sideways to see all plans</p>
        <div className="pricing-compare-scroll" role="region" aria-label="Plan comparison table" tabIndex={0}>
        <table className="pricing-compare">
          <thead>
            <tr>
              <th scope="col" className="pricing-compare__corner">
                <span className="pricing-compare-sr-only">Feature</span>
              </th>
              {PLAN_LIBRARY.map((plan) => (
                <th
                  key={plan.id}
                  scope="col"
                  className={plan.id === 'pro' ? 'pricing-compare__highlight' : undefined}
                >
                  {plan.name}
                  {plan.id === 'pro' ? ' ★' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Monthly execution credits</td>
              {PLAN_LIBRARY.map((plan) => (
                <td key={plan.id}>{plan.credits.toLocaleString('en-GB')}</td>
              ))}
            </tr>
            <tr>
              <td>Monthly AI video credits</td>
              {PLAN_LIBRARY.map((plan) => (
                <td key={plan.id}>
                  {PLAN_ENTITLEMENTS[plan.id].monthlyVideoCredits > 0
                    ? PLAN_ENTITLEMENTS[plan.id].monthlyVideoCredits
                    : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td>Max concurrent execution runs</td>
              {PLAN_LIBRARY.map((plan) => (
                <td key={plan.id}>{PLAN_ENTITLEMENTS[plan.id].concurrencyExecution}</td>
              ))}
            </tr>
            <tr>
              <td>Max concurrent video renders</td>
              {PLAN_LIBRARY.map((plan) => (
                <td key={plan.id}>{PLAN_ENTITLEMENTS[plan.id].concurrencyVideo}</td>
              ))}
            </tr>
            <tr>
              <td>Active workspaces</td>
              {PLAN_LIBRARY.map((plan) => (
                <td key={plan.id}>{PLAN_ENTITLEMENTS[plan.id].maxActiveWorkspaces}</td>
              ))}
            </tr>
            <tr>
              <td>Included seats</td>
              {PLAN_LIBRARY.map((plan) => (
                <td key={plan.id}>
                  {plan.seats}
                  {plan.additionalSeatPrice ? ` + ${WHOLE_GBP_FORMATTER.format(plan.additionalSeatPrice)}/mo add-ons` : ''}
                </td>
              ))}
            </tr>
            <tr>
              <td>Usage packs</td>
              {PLAN_LIBRARY.map((plan) => (
                <td key={plan.id} className="pricing-compare__tick">
                  Add execution or video credits (any paid tier)
                </td>
              ))}
            </tr>
            <tr>
              <td>Daily video cap</td>
              {PLAN_LIBRARY.map((plan) => (
                <td key={plan.id}>
                  {PLAN_ENTITLEMENTS[plan.id].dailyVideoCap > 0 ? PLAN_ENTITLEMENTS[plan.id].dailyVideoCap : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td>Priority speed</td>
              {PLAN_LIBRARY.map((plan) => (
                <td key={plan.id} className="pricing-compare__tick">
                  {PRIORITY_LABEL[plan.id]}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        </div>
      </section>

      <section className="pricing-explainer pricing-explainer--packs" aria-labelledby="usage-packs-heading">
        <h2 id="usage-packs-heading" className="pricing-section-title" style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          Usage packs
        </h2>
        <div className="pricing-panel" style={{ maxWidth: '720px', margin: '0 auto 1.25rem' }}>
          <p>
            <strong>Execution Boost</strong> adds chat, agent, and workflow capacity when your monthly pool runs thin.{' '}
            <strong>AI video packs</strong> refill render credits only — video stays visibly metered separately from execution.
          </p>
          <p style={{ marginBottom: 0 }}>
            Purchase packs anytime from{' '}
            <Link to="/app/settings?tab=Billing" style={{ color: 'var(--accent, #00FFD1)', textDecoration: 'underline' }}>
              Settings → Billing
            </Link>
            . Caps and fair-use safeguards stay in force; packs bridge spikes without weakening enforcement.
          </p>
        </div>
        <div className="pricing-credit-visual">
          {PREFERRED_CREDIT_PACKS_PUBLIC.map((pack) => (
            <div key={pack.id} className="pricing-credit-visual__block">
              <h4>{pack.label}</h4>
              <p>
                +{pack.credits.toLocaleString('en-GB')}{' '}
                {pack.creditType === 'video' ? 'AI video credits' : 'execution credits'} for £{pack.priceGbp}.
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="pricing-scale-simple" aria-labelledby="scale-simple-heading">
        <span className="pricing-scale-simple__icon" aria-hidden="true"><TbScale /></span>
        <div>
          <h2 id="scale-simple-heading">Start simple. Scale when you need.</h2>
          <p>
            You do not need to understand the whole system on day one. Start with a single task, then grow into repeatable
            workflows as your team finds the processes worth automating.
          </p>
        </div>
        <SignedOut>
          <Link to="/signup" className="button button--ghost">
            Start with one workflow
          </Link>
        </SignedOut>
        <SignedIn>
          <Link to="/app/workflows" className="button button--ghost">
            Start with one workflow
          </Link>
        </SignedIn>
      </section>

      <section className="pricing-faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading">Questions</h2>
        {FAQ_ITEMS.map((item) => (
          <div key={item.q} className="pricing-faq__item">
            <h3 className="pricing-faq__q">{item.q}</h3>
            <p className="pricing-faq__a">{item.a}</p>
          </div>
        ))}
      </section>

      <section className="pricing-final-cta" aria-labelledby="final-cta-heading">
        <h2 id="final-cta-heading">Start using Prymal today</h2>
        <p>No jargon, no surprise mechanics — just clear plans and live usage in your workspace.</p>
        <div className="pricing-final-cta__row">
          <SignedOut>
            <Link to="/signup" className="button button--accent">
              Start free
            </Link>
            <Link to="/login" className="button button--ghost">
              Sign in
            </Link>
          </SignedOut>
          <SignedIn>
            <Link to="/app/dashboard" className="button button--accent">
              Go to workspace
            </Link>
            <Link to="/app/settings?tab=Billing" className="button button--ghost">
              Manage billing
            </Link>
          </SignedIn>
        </div>
      </section>
    </>
  );
}

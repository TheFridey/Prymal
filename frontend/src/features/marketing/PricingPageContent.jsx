import { useState } from 'react';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import {
  BILLING_INTERVALS,
  PLAN_ENTITLEMENTS,
  PLAN_LIBRARY,
  getFoundingPlanPrice,
  getPlanPrice,
} from '../../lib/constants';

const PERSONA_LINE = {
  solo: 'For individuals getting started',
  pro: 'For growing businesses and creators',
  teams: 'For teams running workflows',
  agency: 'For high-scale operations',
};

const PRIORITY_LABEL = {
  solo: 'Standard',
  pro: 'Elevated',
  teams: 'High',
  agency: 'Maximum',
};

const FAQ_ITEMS = [
  {
    q: 'How do credits work?',
    a: 'Credits are used when you run AI tasks — chat, agents, and workflows draw from your execution balance. Most short tasks use about 1–3 credits; larger workflows with more context use more. AI video credits are separate and only power AI-generated video renders.',
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
];

function scrollToPricingGrid() {
  document.getElementById('pricing-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function PricingPageContent({ foundingOffer = null }) {
  const [billingInterval, setBillingInterval] = useState(BILLING_INTERVALS[0]?.id ?? 'monthly');
  const activeInterval = BILLING_INTERVALS.find((i) => i.id === billingInterval) ?? BILLING_INTERVALS[0];
  const foundingAccessActive = Boolean(foundingOffer?.active);

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
          Create content, automate workflows, and produce video — in one system. Pick the tier that matches how often you ship
          work; Pro is the sweet spot for most operators.
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

      {foundingAccessActive ? (
        <section className="pricing-founding-banner" aria-labelledby="founding-access-heading">
          <div>
            <div className="pricing-founding-banner__eyebrow">Limited founding accounts</div>
            <h2 id="founding-access-heading">Founding Access is open</h2>
            <p>
              Lock in early pricing, receive 2x credits for your first month, and get priority access to new Prymal capabilities.
            </p>
          </div>
          <button type="button" className="button button--accent" onClick={scrollToPricingGrid}>
            Claim Founding Access
          </button>
        </section>
      ) : null}

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
          const foundingPrice = getFoundingPlanPrice(plan, activeInterval.id);
          const displayedPrice = foundingAccessActive ? foundingPrice : price;
          const isPro = plan.id === 'pro';
          return (
            <article
              key={plan.id}
              className={`pricing-card${isPro ? ' pricing-card--pro' : ''}${foundingAccessActive ? ' pricing-card--founding' : ''}`}
              aria-label={`${plan.name} plan`}
            >
              {foundingAccessActive ? (
                <div className="pricing-card__badge pricing-card__badge--founding">Founding Access</div>
              ) : isPro ? (
                <div className="pricing-card__badge">Most popular</div>
              ) : null}
              <h2 className="pricing-card__name">{plan.name}</h2>
              <p className="pricing-card__persona">{PERSONA_LINE[plan.id]}</p>
              <div className="pricing-card__price">
                {displayedPrice.display}
                <small> / {displayedPrice.suffix}</small>
              </div>
              {foundingAccessActive ? (
                <p className="pricing-card__period-note">
                  Early pricing locked while your subscription remains active
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
                  {plan.credits.toLocaleString('en-GB')} execution credits / month
                </li>
                <li>
                  {ent.monthlyVideoCredits > 0
                    ? `${ent.monthlyVideoCredits} AI video credits / month`
                    : 'AI video credits via upgrade'}
                </li>
                <li>AI agents &amp; automations</li>
                {foundingAccessActive ? <li>Includes 2x first-month credits</li> : null}
                {foundingAccessActive ? <li>Priority access to new agent capabilities</li> : null}
                <li>
                  {ent.concurrencyExecution > 1
                    ? `Run up to ${ent.concurrencyExecution} AI tasks at once`
                    : 'Single-lane AI runs (upgrade for more)'}
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

      <section className="pricing-explainer" aria-labelledby="credit-clarity-heading">
        <div className="pricing-panel">
          <h3 id="credit-clarity-heading">How credits work</h3>
          <p>
            <strong>Credits are used when you run AI tasks.</strong> A quick reply might be one credit; a deep multi-step workflow
            uses more. Most everyday tasks fall in the 1–3 credit range; larger automations scale up from there.
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
            <p>Used for AI tasks, agents, and workflows — everything that is not video output.</p>
          </div>
          <div className="pricing-credit-visual__block pricing-credit-visual__block--video">
            <h4>
              <span className="pricing-credit-visual__icon" aria-hidden="true">
                ▶
              </span>
              AI video credits
            </h4>
            <p>Used only when you create AI-generated video renders. Keeps video spend visible and separate.</p>
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
          Compare plans
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
              <td>Max concurrent AI runs</td>
              {PLAN_LIBRARY.map((plan) => (
                <td key={plan.id}>{PLAN_ENTITLEMENTS[plan.id].concurrencyExecution}</td>
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

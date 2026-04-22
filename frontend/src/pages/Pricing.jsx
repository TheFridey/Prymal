import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { PageShell } from '../components/ui';
import { PricingPageContent } from '../features/marketing/PricingPageContent';
import { PLAN_LIBRARY, getWorkspacePlanMeta } from '../lib/constants';
import '../styles/landing-rebuild.css';
import '../styles/pricing-page.css';

export default function Pricing() {
  const freePlan = getWorkspacePlanMeta('free');

  return (
    <div className="marketing-page prymal-marketing pricing-page">
      <PageMeta
        title="Prymal | Pricing — AI agents, workflows & video"
        description="Simple plans for execution credits and video credits. Pro is the best balance of power and cost for most teams."
        canonicalPath="/pricing"
      />
      <JsonLd
        id="schema-pricing"
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Prymal pricing',
          description: 'Prymal subscription plans: Solo, Pro, Teams, and Agency with execution and video credits.',
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

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="pricing" />

        <PageShell width="100%">
          <div style={{ maxWidth: 1120, margin: '0 auto', padding: '2rem 1.25rem 3rem' }}>
            <PricingPageContent />
          </div>
        </PageShell>

        <PublicPageFooter />
      </div>
    </div>
  );
}

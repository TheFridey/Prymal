import { Link } from 'react-router-dom';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { FAQSection, AnswerBlock, ResourceCta } from '../components/PublicContent';
import { PageShell } from '../components/ui';
import { FoundingAccessPopup } from '../features/marketing/FoundingAccessPopup';
import { PricingPageContent } from '../features/marketing/PricingPageContent';
import { useFoundingAccessOffer } from '../features/marketing/founding-access';
import { PLAN_LIBRARY, getWorkspacePlanMeta } from '../lib/constants';
import { PRICING_FAQ_ITEMS } from '../lib/site-content';
import '../styles/landing-rebuild.css';
import '../styles/pricing-page.css';
import '../styles/public-content.css';

export default function Pricing() {
  const freePlan = getWorkspacePlanMeta('free');
  const foundingAccessState = useFoundingAccessOffer();

  return (
    <div className="marketing-page prymal-marketing pricing-page">
      <PageMeta
        title="Prymal | Pricing for AI workflows, memory, and execution control"
        description="Simple plans for Prymal's multi-agent AI system, workflow engine, LORE memory, SENTINEL validation, execution credits, and AI video credits."
        canonicalPath="/pricing"
      />
      <JsonLd
        id="schema-pricing"
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Prymal pricing',
          description: 'Prymal subscription plans: Solo, Pro, Teams, and Agency with execution credits and AI video credits.',
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

        <PageShell width="100%" flushMobile>
          <div className="pricing-page__shell public-content-page">
            <AnswerBlock
              title="How does Prymal pricing work?"
              answer="Prymal pricing is structured around workspace plans, execution capacity, shared business memory, workflow depth, and team-level control rather than just more chat volume."
            />
            <PricingPageContent foundingAccessState={foundingAccessState} />
            <FAQSection title="Pricing FAQ" items={PRICING_FAQ_ITEMS} schemaId="schema-pricing-faq" />
            <ResourceCta
              title="Need the product detail behind the plans?"
              description="Feature pages, comparison pages, and the trust page explain how Prymal approaches business execution, memory, and compliance-ready operations."
              primary={<Link to="/features" className="pm-btn pm-btn--primary">Explore features</Link>}
              secondary={<Link to="/trust" className="pm-btn pm-btn--ghost">Review trust</Link>}
            />
          </div>
        </PageShell>

        <PublicPageFooter />
      </div>
      <FoundingAccessPopup
        offer={foundingAccessState.status === 'ready' ? foundingAccessState.offer : null}
        surface="pricing"
      />
    </div>
  );
}

import { Link } from 'react-router-dom';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { FAQSection, AnswerBlock, EntityDefinition, PageFreshness, ResourceCta } from '../components/PublicContent';
import { PageShell } from '../components/ui';
import { FoundingAccessPopup } from '../features/marketing/FoundingAccessPopup';
import { PricingPageContent } from '../features/marketing/PricingPageContent';
import { useFoundingAccessOffer } from '../features/marketing/founding-access';
import { buildWebPageSchema } from '../lib/seo';
import { PRICING_FAQ_ITEMS, PUBLIC_CONTENT_UPDATED_AT, PUBLIC_OG_DEFAULTS } from '../lib/site-content';
import '../styles/landing-rebuild.css';
import '../styles/pricing-page.css';
import '../styles/public-content.css';

export default function Pricing() {
  const foundingAccessState = useFoundingAccessOffer();

  return (
    <div className="marketing-page prymal-marketing pricing-page">
      <PageMeta
        title={PUBLIC_OG_DEFAULTS.pricing.title}
        description={PUBLIC_OG_DEFAULTS.pricing.description}
        canonicalPath="/pricing"
        ogImage={PUBLIC_OG_DEFAULTS.pricing.image}
        ogImageAlt={PUBLIC_OG_DEFAULTS.pricing.imageAlt}
      />
      <JsonLd
        id="schema-pricing"
        schema={buildWebPageSchema({
          name: PUBLIC_OG_DEFAULTS.pricing.title,
          description: PUBLIC_OG_DEFAULTS.pricing.description,
          path: '/pricing',
          dateModified: PUBLIC_CONTENT_UPDATED_AT,
        })}
      />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="pricing" />

        <PageShell width="100%" flushMobile>
          <div className="pricing-page__shell public-content-page">
            <PageFreshness date={PUBLIC_CONTENT_UPDATED_AT} />
            <EntityDefinition />
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

import { Link, Navigate, useParams } from 'react-router-dom';
import { AGENT_LIBRARY } from '../lib/constants';
import { getFeaturePageBySlug } from '../lib/site-content';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  FAQSection,
  PremiumHero,
  SectionBlock,
  BulletList,
  ResourceCta,
  AgentRail,
  BeforeAfterComparison,
  SignalCards,
  buildBreadcrumbSchema,
} from '../components/PublicContent';
import { buildWebPageSchema } from '../lib/seo';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function FeaturePage() {
  const { slug } = useParams();
  const page = getFeaturePageBySlug(slug);

  if (!page) {
    return <Navigate to="/features" replace />;
  }

  const relevantAgents = page.agentIds
    .map((id) => AGENT_LIBRARY.find((agent) => agent.id === id))
    .filter(Boolean);

  const useCaseSignals = page.useCases.map((item, index) => ({
    eyebrow: `Use case 0${index + 1}`,
    title: page.useCaseChips?.[index] ?? `Execution lane ${index + 1}`,
    body: item,
    accent: relevantAgents[index % Math.max(relevantAgents.length, 1)]?.color ?? '#7cffe0',
  }));

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title={page.metaTitle}
        description={page.metaDescription}
        canonicalPath={`/features/${page.slug}`}
        ogImage={page.ogImage}
        ogImageAlt={page.ogImageAlt}
      />
      <JsonLd
        id={`schema-webpage-feature-${page.slug}`}
        schema={buildWebPageSchema({
          name: page.metaTitle,
          description: page.metaDescription,
          path: `/features/${page.slug}`,
        })}
      />
      <JsonLd
        id={`schema-breadcrumbs-feature-${page.slug}`}
        schema={buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Features', path: '/features' },
          { name: page.title, path: `/features/${page.slug}` },
        ])}
      />
      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix={`feature-${page.slug}`} />
        <PageShell width="1160px">
          <div className="public-content-page">
            <div className="public-content-breadcrumbs">
              <Link to="/">Home</Link>
              <span>/</span>
              <Link to="/features">Features</Link>
              <span>/</span>
              <span>{page.title}</span>
            </div>

            <PremiumHero
              eyebrow="Feature module"
              title={page.title}
              description={page.intro}
              answerTitle={`What is ${page.title}?`}
              answer={page.answer}
              chips={page.useCaseChips}
              stats={[
                { label: 'Architecture role', value: page.architectureRole },
                { label: 'Relevant agents', value: String(relevantAgents.length) },
                { label: 'Trust posture', value: page.trustNote ? 'Visible' : 'Scoped' },
              ]}
              primaryCta={<Link to="/pricing" className="pm-btn pm-btn--primary">See pricing</Link>}
              secondaryCta={<Link to="/trust" className="pm-btn pm-btn--ghost">Trust and readiness</Link>}
              visual={(
                <div className="public-premium-summary-card">
                  <div className="public-section-block__eyebrow">Proof point</div>
                  <strong>{page.proofPoint}</strong>
                  <p>{page.trustNote}</p>
                  <div className="public-operating-card__chips">
                    {(page.useCaseChips ?? []).map((chip) => (
                      <span key={chip}>{chip}</span>
                    ))}
                  </div>
                </div>
              )}
            />

            <SectionBlock eyebrow="Relevant agents" title="The specialists most active in this lane">
              <AgentRail agents={relevantAgents} />
            </SectionBlock>

            <SectionBlock eyebrow="Benefits" title="Why teams use this layer">
              <BulletList items={page.benefits} />
            </SectionBlock>

            <SectionBlock eyebrow="Use cases" title="Where it fits in business execution">
              <SignalCards items={useCaseSignals} />
            </SectionBlock>

            <SectionBlock eyebrow="Operational shift" title="Before Prymal versus with Prymal">
              <BeforeAfterComparison
                beforeTitle="Before Prymal"
                afterTitle="With Prymal"
                before={page.beforeState}
                after={page.withState}
              />
            </SectionBlock>

            <SectionBlock eyebrow="Trust note" title="Why this layer is easier to govern">
              <div className="public-premium-note">
                <strong>Evidence and trust</strong>
                <p>{page.trustNote}</p>
              </div>
            </SectionBlock>

            <FAQSection
              title={`${page.title} FAQ`}
              items={page.faq}
              schemaId={`schema-feature-faq-${page.slug}`}
            />

            <ResourceCta
              title="Ready to see this in a real workspace?"
              description="Prymal is built for teams that need specialist agents working from shared business context, not just more disconnected prompt threads."
              primary={<Link to="/signup" className="pm-btn pm-btn--primary">Get early access</Link>}
              secondary={<Link to="/compare" className="pm-btn pm-btn--ghost">Compare categories</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix={`feature-${page.slug}`} />
      </div>
    </div>
  );
}

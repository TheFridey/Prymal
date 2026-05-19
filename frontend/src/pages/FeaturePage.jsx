import { Link, Navigate, useParams } from 'react-router-dom';
import { AGENT_LIBRARY } from '../lib/constants';
import { getFeaturePageBySlug } from '../lib/site-content';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  FAQSection,
  LinkCardGrid,
  PublicHero,
  SectionBlock,
  BulletList,
  ResourceCta,
  buildBreadcrumbSchema,
} from '../components/PublicContent';
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

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title={page.metaTitle}
        description={page.metaDescription}
        canonicalPath={`/features/${page.slug}`}
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
        <PageShell width="1100px">
          <div className="public-content-page">
            <div className="public-content-breadcrumbs">
              <Link to="/">Home</Link>
              <span>/</span>
              <Link to="/features">Features</Link>
              <span>/</span>
              <span>{page.title}</span>
            </div>

            <PublicHero
              eyebrow="Feature page"
              title={page.title}
              description={page.intro}
              answerTitle={`What is ${page.title}?`}
              answer={page.answer}
              primaryCta={<Link to="/pricing" className="pm-btn pm-btn--primary">See pricing</Link>}
              secondaryCta={<Link to="/trust" className="pm-btn pm-btn--ghost">Trust and readiness</Link>}
            />

            <SectionBlock eyebrow="Benefits" title="Why teams use this layer">
              <BulletList items={page.benefits} />
            </SectionBlock>

            <SectionBlock eyebrow="Use cases" title="Where it fits in business execution">
              <BulletList items={page.useCases} />
            </SectionBlock>

            <SectionBlock eyebrow="Relevant agents" title="Specialists involved">
              <div className="public-content-table">
                {relevantAgents.map((agent) => (
                  <div key={agent.id} className="public-content-table__card">
                    <strong>{agent.name}</strong>
                    <span>{agent.title}</span>
                    <p>{agent.description}</p>
                  </div>
                ))}
              </div>
            </SectionBlock>

            <FAQSection
              title={`${page.title} FAQ`}
              items={page.faq}
              schemaId={`schema-feature-faq-${page.slug}`}
            />

            <SectionBlock eyebrow="Keep exploring" title="Related paths">
              <LinkCardGrid
                items={[
                  {
                    to: '/blog',
                    title: 'Read practical guides',
                    description: 'See how business memory, workflow execution, and trust boundaries work in practice.',
                  },
                  {
                    to: '/compare',
                    title: 'Compare product categories',
                    description: 'Understand where Prymal fits against chat tools, agent platforms, and workflow products.',
                  },
                  {
                    to: '/trust',
                    title: 'Review the trust posture',
                    description: 'Explore deployment hardening, evidence preparation, and readiness language.',
                  },
                ]}
              />
            </SectionBlock>

            <ResourceCta
              title="Ready to see this in a real workspace?"
              description="Prymal is built for teams that need specialist agents working from shared business context, not just more disconnected prompt threads."
              primary={<Link to="/signup" className="pm-btn pm-btn--primary">Get early access</Link>}
              secondary={<Link to="/pricing" className="pm-btn pm-btn--ghost">View plans</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix={`feature-${page.slug}`} />
      </div>
    </div>
  );
}

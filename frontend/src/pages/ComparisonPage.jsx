import { Link, Navigate, useParams } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  ComparisonMatrix,
  FAQSection,
  PremiumHero,
  ResourceCta,
  Scoreboard,
  SectionBlock,
  SignalCards,
  buildBreadcrumbSchema,
} from '../components/PublicContent';
import { buildWebPageSchema } from '../lib/seo';
import { getComparisonPageBySlug } from '../lib/site-content';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function ComparisonPage() {
  const { slug } = useParams();
  const page = getComparisonPageBySlug(slug);

  if (!page) {
    return <Navigate to="/compare" replace />;
  }

  const scoreItems = [
    {
      label: 'Shared memory',
      score: page.slug.includes('workflow') ? 4 : 5,
      detail: 'Prymal is positioned around durable business context instead of only conversation history.',
    },
    {
      label: 'Workflow execution',
      score: 5,
      detail: 'The product story centres on repeatable execution, approvals, and cross-agent coordination.',
    },
    {
      label: 'Governance',
      score: 4,
      detail: 'Trust boundaries, evidence, approvals, and operator review stay visible in the buyer narrative.',
    },
    {
      label: 'Team execution',
      score: 5,
      detail: 'The comparison layer consistently frames Prymal as a multi-user business operating layer rather than a solo conversation surface.',
    },
  ];

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title={page.metaTitle}
        description={page.metaDescription}
        canonicalPath={`/compare/${page.slug}`}
        ogImage={page.ogImage}
        ogImageAlt={page.ogImageAlt}
      />
      <JsonLd
        id={`schema-webpage-compare-${page.slug}`}
        schema={buildWebPageSchema({
          name: page.metaTitle,
          description: page.metaDescription,
          path: `/compare/${page.slug}`,
        })}
      />
      <JsonLd
        id={`schema-breadcrumbs-compare-${page.slug}`}
        schema={buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Compare', path: '/compare' },
          { name: page.title, path: `/compare/${page.slug}` },
        ])}
      />
      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix={`compare-${page.slug}`} />
        <PageShell width="1120px">
          <div className="public-content-page">
            <div className="public-content-breadcrumbs">
              <Link to="/">Home</Link>
              <span>/</span>
              <Link to="/compare">Compare</Link>
              <span>/</span>
              <span>{page.title}</span>
            </div>

            <PremiumHero
              eyebrow="Comparison page"
              title={page.title}
              description={page.intro}
              answerTitle="Short answer"
              answer={page.answer}
              chips={['Fair comparison', 'Category fit', 'Business execution']}
              stats={[
                { label: 'Best used for', value: 'Decision clarity' },
                { label: 'Tone', value: 'Neutral' },
                { label: 'Positioning lens', value: 'Category-based' },
              ]}
              primaryCta={<Link to="/features" className="pm-btn pm-btn--primary">Explore features</Link>}
              secondaryCta={<Link to="/pricing" className="pm-btn pm-btn--ghost">View pricing</Link>}
              visual={(
                <div className="public-premium-summary-card">
                  <div className="public-section-block__eyebrow">Decision shortcut</div>
                  <strong>{page.whenPrymal}</strong>
                  <p>{page.whenGeneralEnough}</p>
                </div>
              )}
            />

            <SectionBlock eyebrow="Comparison matrix" title="How the categories differ in practice">
              <ComparisonMatrix
                columns={['Prymal', 'Alternative category']}
                rows={page.matrix ?? []}
              />
            </SectionBlock>

            <SectionBlock eyebrow="Maturity criteria" title="What matters beyond the demo">
              <Scoreboard items={scoreItems} />
            </SectionBlock>

            <SectionBlock eyebrow="Decision guide" title="Use this to choose more honestly">
              <SignalCards
                items={[
                  {
                    eyebrow: 'Choose Prymal if...',
                    title: 'You need continuity, operator control, and real execution',
                    body: page.whenPrymal,
                    chips: page.strengths.slice(0, 3),
                    accent: '#7cffe0',
                  },
                  {
                    eyebrow: 'A general tool may be enough if...',
                    title: 'The problem is lighter, earlier, or more exploratory',
                    body: page.whenGeneralEnough,
                    chips: page.limitations.slice(0, 2),
                    accent: '#4cc9f0',
                  },
                ]}
              />
            </SectionBlock>

            <SectionBlock eyebrow="Best for" title="Where each category fits">
              <div className="public-before-after">
                <article className="public-before-after__card public-before-after__card--accent">
                  <div className="public-section-block__eyebrow">Choose Prymal if...</div>
                  <ul className="public-bullet-list">
                    {page.bestFor.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </div>
            </SectionBlock>

            <FAQSection
              title={`${page.title} FAQ`}
              items={page.faq}
              schemaId={`schema-compare-faq-${page.slug}`}
            />

            <ResourceCta
              title="Need the product specifics?"
              description="The feature pages, trust page, and blog show how Prymal approaches business memory, workflows, evidence, and execution without exposing internal routing mechanics to end users."
              primary={<Link to="/trust" className="pm-btn pm-btn--primary">Trust and readiness</Link>}
              secondary={<Link to="/blog" className="pm-btn pm-btn--ghost">Read practical guides</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix={`compare-${page.slug}`} />
      </div>
    </div>
  );
}

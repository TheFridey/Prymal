import { Link, Navigate, useParams } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  FAQSection,
  PublicHero,
  SectionBlock,
  BulletList,
  ResourceCta,
  buildBreadcrumbSchema,
} from '../components/PublicContent';
import { getComparisonPageBySlug } from '../lib/site-content';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function ComparisonPage() {
  const { slug } = useParams();
  const page = getComparisonPageBySlug(slug);

  if (!page) {
    return <Navigate to="/compare" replace />;
  }

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title={page.metaTitle}
        description={page.metaDescription}
        canonicalPath={`/compare/${page.slug}`}
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
        <PageShell width="980px">
          <div className="public-content-page">
            <div className="public-content-breadcrumbs">
              <Link to="/">Home</Link>
              <span>/</span>
              <Link to="/compare">Compare</Link>
              <span>/</span>
              <span>{page.title}</span>
            </div>

            <PublicHero
              eyebrow="Comparison page"
              title={page.title}
              description={page.intro}
              answerTitle="Short answer"
              answer={page.answer}
              primaryCta={<Link to="/features" className="pm-btn pm-btn--primary">Explore features</Link>}
              secondaryCta={<Link to="/pricing" className="pm-btn pm-btn--ghost">View pricing</Link>}
            />

            <SectionBlock eyebrow="Best for" title="Where each category fits">
              <BulletList items={page.bestFor} />
            </SectionBlock>

            <SectionBlock eyebrow="Strengths" title="Where Prymal is designed to shine">
              <BulletList items={page.strengths} />
            </SectionBlock>

            <SectionBlock eyebrow="Limitations" title="Where you should stay realistic">
              <BulletList items={page.limitations} />
            </SectionBlock>

            <SectionBlock eyebrow="Decision guide" title="When to choose what">
              <div className="public-content-columns">
                <div className="public-content-table__card">
                  <strong>When to choose Prymal</strong>
                  <p>{page.whenPrymal}</p>
                </div>
                <div className="public-content-table__card">
                  <strong>When a general option may be enough</strong>
                  <p>{page.whenGeneralEnough}</p>
                </div>
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

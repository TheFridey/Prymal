import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  BulletList,
  FAQSection,
  LinkCardGrid,
  PremiumHero,
  ResourceCta,
  SectionBlock,
  SignalCards,
  buildBreadcrumbSchema,
} from '../components/PublicContent';
import {
  buildOrganizationSchema,
  buildSoftwareApplicationSchema,
  buildWebPageSchema,
  buildWebSiteSchema,
} from '../lib/seo';
import {
  getSeoPageByPath,
  getSeoUseCasePageBySlug,
} from '../lib/seo-growth-content';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

function resolvePage(pathname, slug) {
  if (slug) {
    return getSeoUseCasePageBySlug(slug);
  }
  return getSeoPageByPath(pathname);
}

function buildBreadcrumbs(page) {
  if (page.kind === 'use-case') {
    return [
      { name: 'Home', path: '/' },
      { name: 'Use cases', path: '/use-cases' },
      { name: page.title, path: page.path },
    ];
  }

  return [
    { name: 'Home', path: '/' },
    { name: page.title, path: page.path },
  ];
}

function SchemaBundle({ page }) {
  return (
    <>
      <JsonLd
        id={`schema-webpage-${page.slug}`}
        schema={buildWebPageSchema({
          name: page.metaTitle,
          description: page.metaDescription,
          path: page.path,
        })}
      />
      <JsonLd
        id={`schema-breadcrumbs-${page.slug}`}
        schema={buildBreadcrumbSchema(buildBreadcrumbs(page))}
      />
      <JsonLd id={`schema-org-${page.slug}`} schema={buildOrganizationSchema()} />
      <JsonLd id={`schema-website-${page.slug}`} schema={buildWebSiteSchema()} />
      <JsonLd
        id={`schema-software-${page.slug}`}
        schema={buildSoftwareApplicationSchema({
          description: 'Prymal is a governed business AI execution layer with specialist agents, shared business memory, workflow orchestration, and trust controls.',
          url: `https://prymal.io${page.path}`,
        })}
      />
    </>
  );
}

function GlossaryTerms({ terms = [] }) {
  if (!terms.length) return null;

  return (
    <SectionBlock eyebrow="Glossary terms" title="Definitions for governed business AI execution">
      <div className="public-link-grid public-link-grid--definitions">
        {terms.map((item) => (
          <article key={item.term} className="public-link-card public-definition-card">
            <div className="public-link-card__title">{item.term}</div>
            <p>{item.definition}</p>
          </article>
        ))}
      </div>
    </SectionBlock>
  );
}

export default function SeoGrowthPage() {
  const { slug } = useParams();
  const { pathname } = useLocation();
  const page = resolvePage(pathname, slug);

  if (!page) {
    return <Navigate to="/" replace />;
  }

  const breadcrumbs = buildBreadcrumbs(page);

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title={page.metaTitle}
        description={page.metaDescription}
        canonicalPath={page.path}
        ogImageAlt={`${page.title} | Prymal`}
      />
      <SchemaBundle page={page} />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix={`seo-${page.slug}`} />
        <PageShell width="1160px">
          <div className="public-content-page">
            <div className="public-content-breadcrumbs">
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.path}>
                  {index > 0 ? <span>/</span> : null}
                  {index === breadcrumbs.length - 1 ? (
                    <span>{crumb.name}</span>
                  ) : (
                    <Link to={crumb.path}>{crumb.name}</Link>
                  )}
                </span>
              ))}
            </div>

            <PremiumHero
              eyebrow={page.eyebrow}
              title={page.title}
              description={page.metaDescription}
              answerTitle="Short answer"
              answer={page.answer}
              chips={page.chips}
              stats={[
                { label: 'Category', value: page.kind === 'use-case' ? 'Use case' : 'SEO guide' },
                { label: 'Focus', value: 'Governed AI' },
                { label: 'Updated', value: page.updatedAt },
              ]}
              primaryCta={<Link to="/signup" className="pm-btn pm-btn--primary">Join beta</Link>}
              secondaryCta={<Link to="/trust" className="pm-btn pm-btn--ghost">Trust controls</Link>}
              visual={(
                <div className="public-premium-summary-card">
                  <div className="public-section-block__eyebrow">Execution lens</div>
                  <strong>Governed business AI execution</strong>
                  <p>{page.answer}</p>
                  <div className="public-operating-card__chips">
                    {page.chips.map((chip) => (
                      <span key={chip}>{chip}</span>
                    ))}
                  </div>
                </div>
              )}
            />

            {page.sections.map((section) => (
              <SectionBlock
                key={section.title}
                eyebrow={section.eyebrow}
                title={section.title}
              >
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="public-section-block__description">{paragraph}</p>
                ))}
                <BulletList items={section.bullets} />
              </SectionBlock>
            ))}

            <GlossaryTerms terms={page.terms} />

            {page.architectureCards.length ? (
              <SectionBlock eyebrow="Architecture callouts" title="How the operating layer stays governable">
                <SignalCards items={page.architectureCards} />
              </SectionBlock>
            ) : null}

            <SectionBlock eyebrow="Internal reading path" title="Continue through the topical cluster">
              <LinkCardGrid items={page.relatedPages} surface={`seo-${page.slug}`} />
            </SectionBlock>

            <FAQSection
              title={`${page.title} FAQ`}
              items={page.faq}
              schemaId={`schema-faq-${page.slug}`}
            />

            <ResourceCta
              title="Move from AI chat to controlled execution"
              description="Prymal is built for teams that want specialist agents, shared memory, workflow orchestration, and trust controls in one business execution layer."
              primary={<Link to="/signup" className="pm-btn pm-btn--primary">Join beta</Link>}
              secondary={<Link to="/compare" className="pm-btn pm-btn--ghost">Compare options</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix={`seo-${page.slug}`} />
      </div>
    </div>
  );
}

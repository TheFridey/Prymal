import { Link, Navigate, useParams } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  EducationExamples,
  EducationIllustration,
  EducationInternalLinks,
  EducationLongformSections,
  EducationReferences,
} from '../components/EducationContent';
import {
  EDUCATION_CONTENT_UPDATED_AT,
  EDUCATION_HUB_PATH,
  buildEducationPageSchema,
  getEducationPageBySlug,
  getEducationPath,
  getEducationWordCount,
} from '../content/education';
import {
  FAQSection,
  PageFreshness,
  PremiumHero,
  ResourceCta,
} from '../components/PublicContent';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function EducationPage() {
  const { slug } = useParams();
  const page = getEducationPageBySlug(slug);

  if (!page) {
    return <Navigate to={EDUCATION_HUB_PATH} replace />;
  }

  const wordCount = getEducationWordCount(page);

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title={page.metaTitle}
        description={page.metaDescription}
        canonicalPath={getEducationPath(page.slug)}
        ogType="article"
      />
      <JsonLd id={`schema-education-${page.slug}`} schema={buildEducationPageSchema(page)} />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix={`education-${page.slug}`} />
        <PageShell width="1160px">
          <div className="public-content-page">
            <div className="public-content-breadcrumbs">
              <Link to="/">Home</Link>
              <span>/</span>
              <Link to={EDUCATION_HUB_PATH}>What Is</Link>
              <span>/</span>
              <span>{page.term}</span>
            </div>

            <PageFreshness date={EDUCATION_CONTENT_UPDATED_AT} />

            <PremiumHero
              eyebrow={`${page.category} explainer`}
              title={page.title}
              description={page.shortDefinition}
              answerTitle={`What is ${page.term}?`}
              answer={page.practicalDefinition}
              chips={[page.category, 'Examples', 'References', 'FAQ', 'Schema']}
              stats={[
                { label: 'Word count', value: `${wordCount}+` },
                { label: 'References', value: String(page.references.length) },
                { label: 'Schema', value: 'Article + FAQ' },
              ]}
              primaryCta={<Link to="/signup" className="pm-btn pm-btn--primary">Start free</Link>}
              secondaryCta={<Link to="/what-is" className="pm-btn pm-btn--ghost">All explainers</Link>}
              visual={(
                <div className="public-premium-summary-card">
                  <div className="public-section-block__eyebrow">Plain-English definition</div>
                  <strong>{page.term}</strong>
                  <p>{page.shortDefinition}</p>
                </div>
              )}
            />

            <EducationIllustration page={page} />
            <EducationLongformSections page={page} />
            <EducationExamples page={page} />
            <FAQSection title={`${page.term} FAQ`} items={page.faq} />
            <EducationReferences page={page} />
            <EducationInternalLinks page={page} />

            <ResourceCta
              title={`Apply ${page.term.toLowerCase()} in Prymal`}
              description="Move from definition to execution by mapping the concept to a workflow, use case, industry page, or agent role."
              primary={<Link to="/use-cases" className="pm-btn pm-btn--primary">Use case library</Link>}
              secondary={<Link to="/content/entities" className="pm-btn pm-btn--ghost">Entity graph</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix={`education-${page.slug}`} />
      </div>
    </div>
  );
}

import { Link, useParams } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  UseCaseAgentRecommendations,
  UseCaseComparison,
  UseCaseInternalLinks,
  UseCaseLongformSections,
  UseCaseRoiExamples,
} from '../components/UseCaseContent';
import {
  USE_CASE_CONTENT_UPDATED_AT,
  USE_CASE_HUB_PATH,
  buildUseCasePageSchema,
  getUseCaseBySlug,
  getUseCasePath,
  getUseCaseWordCount,
} from '../content/use-cases';
import {
  FAQSection,
  PageFreshness,
  PremiumHero,
  ResourceCta,
} from '../components/PublicContent';
import SeoGrowthPage from './SeoGrowthPage';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function UseCasePage() {
  const { slug } = useParams();
  const useCase = getUseCaseBySlug(slug);

  if (!useCase) {
    return <SeoGrowthPage />;
  }

  const wordCount = getUseCaseWordCount(useCase);

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title={useCase.metaTitle}
        description={useCase.metaDescription}
        canonicalPath={getUseCasePath(useCase.slug)}
      />
      <JsonLd id={`schema-use-case-${useCase.slug}`} schema={buildUseCasePageSchema(useCase)} />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix={`use-case-${useCase.slug}`} />
        <PageShell width="1160px">
          <div className="public-content-page">
            <div className="public-content-breadcrumbs">
              <Link to="/">Home</Link>
              <span>/</span>
              <Link to={USE_CASE_HUB_PATH}>Use cases</Link>
              <span>/</span>
              <span>{useCase.name}</span>
            </div>

            <PageFreshness date={USE_CASE_CONTENT_UPDATED_AT} />

            <PremiumHero
              eyebrow={`${useCase.category} use case`}
              title={`${useCase.name} AI workflow`}
              description={useCase.summary}
              answerTitle={`How Prymal handles ${useCase.name}`}
              answer={`Prymal helps ${useCase.audience} run ${useCase.name.toLowerCase()} through shared memory, specialist agents, workflow orchestration, validation, and review by ${useCase.reviewOwner}.`}
              chips={[useCase.category, useCase.cadence, useCase.metric, 'FAQ', 'ROI']}
              stats={[
                { label: 'Template words', value: `${wordCount}+` },
                { label: 'Comparison', value: 'Included' },
                { label: 'Schema', value: 'FAQ + ROI' },
              ]}
              primaryCta={<Link to="/signup" className="pm-btn pm-btn--primary">Start free</Link>}
              secondaryCta={<Link to="/use-cases" className="pm-btn pm-btn--ghost">All use cases</Link>}
              visual={(
                <div className="public-premium-summary-card">
                  <div className="public-section-block__eyebrow">Workflow outcome</div>
                  <strong>{useCase.outcome}</strong>
                  <p>Use Prymal to keep the route repeatable, reviewable, and connected to business context.</p>
                </div>
              )}
            />

            <UseCaseLongformSections useCase={useCase} />
            <UseCaseAgentRecommendations useCase={useCase} />
            <UseCaseComparison useCase={useCase} />
            <UseCaseRoiExamples useCase={useCase} />
            <UseCaseInternalLinks useCase={useCase} />

            <FAQSection title={`${useCase.name} FAQ`} items={useCase.faq} />

            <ResourceCta
              title={`Build a ${useCase.name.toLowerCase()} workflow in Prymal`}
              description="Start with one narrow workflow, keep the review owner clear, and measure against the manual baseline before expanding."
              primary={<Link to="/signup" className="pm-btn pm-btn--primary">Start free</Link>}
              secondary={<Link to="/features/ai-workflow-automation" className="pm-btn pm-btn--ghost">Workflow automation</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix={`use-case-${useCase.slug}`} />
      </div>
    </div>
  );
}

import { Link, Navigate, useParams } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  IndustryAgentRecommendations,
  IndustryRelatedPages,
  IndustryReinforcement,
  IndustryRequirementSections,
  IndustryRoiEstimate,
  IndustryWorkflowExamples,
} from '../components/IndustryContent';
import {
  INDUSTRY_CONTENT_UPDATED_AT,
  INDUSTRY_HUB_PATH,
  buildIndustryPageSchema,
  getIndustryBySlug,
  getIndustryPath,
} from '../content/industries';
import {
  FAQSection,
  PageFreshness,
  PremiumHero,
  ResourceCta,
} from '../components/PublicContent';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function IndustryPage() {
  const { slug } = useParams();
  const industry = getIndustryBySlug(slug);

  if (!industry) {
    return <Navigate to={INDUSTRY_HUB_PATH} replace />;
  }

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title={industry.metaTitle}
        description={industry.metaDescription}
        canonicalPath={getIndustryPath(industry.slug)}
      />
      <JsonLd id={`schema-industry-${industry.slug}`} schema={buildIndustryPageSchema(industry)} />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix={`industry-${industry.slug}`} />
        <PageShell width="1160px">
          <div className="public-content-page">
            <div className="public-content-breadcrumbs">
              <Link to="/">Home</Link>
              <span>/</span>
              <Link to={INDUSTRY_HUB_PATH}>Industries</Link>
              <span>/</span>
              <span>{industry.name}</span>
            </div>

            <PageFreshness date={INDUSTRY_CONTENT_UPDATED_AT} />

            <PremiumHero
              eyebrow={`${industry.category} industry`}
              title={`${industry.name} AI operating system`}
              description={industry.summary}
              answerTitle={`How can ${industry.name} use Prymal?`}
              answer={`Prymal helps ${industry.audience} turn recurring, context-heavy work into governed AI workflows with shared memory, specialist agents, and human review where it matters.`}
              chips={['Pain points', 'AI opportunities', 'Use cases', 'Agents', 'Workflow examples']}
              stats={[
                { label: 'Recommended agents', value: String(industry.agentRecommendations.length) },
                { label: 'Workflow examples', value: String(industry.workflowExamples.length) },
                { label: 'Schema', value: 'FAQ + ItemList' },
              ]}
              primaryCta={<Link to="/signup" className="pm-btn pm-btn--primary">Start free</Link>}
              secondaryCta={<Link to="/features/ai-workflow-automation" className="pm-btn pm-btn--ghost">Workflow automation</Link>}
              visual={(
                <div className="public-premium-summary-card">
                  <div className="public-section-block__eyebrow">Operating pattern</div>
                  <strong>{`${industry.name} -> Prymal -> AI Operating System`}</strong>
                  <p>Shared memory, agent roles, workflow checkpoints, and review controls make the industry-specific work repeatable.</p>
                </div>
              )}
            />

            <IndustryReinforcement industry={industry} />
            <IndustryRequirementSections industry={industry} />
            <IndustryAgentRecommendations industry={industry} />
            <IndustryWorkflowExamples industry={industry} />
            <IndustryRoiEstimate industry={industry} />

            <FAQSection title={`${industry.name} FAQ`} items={industry.faq} />
            <IndustryRelatedPages industry={industry} />

            <ResourceCta
              title={`Build a ${industry.name.toLowerCase()} workflow in Prymal`}
              description="Start with one recurring workflow, define the review point, and let Prymal coordinate memory, agents, and execution steps around it."
              primary={<Link to="/signup" className="pm-btn pm-btn--primary">Start free</Link>}
              secondary={<Link to="/content/industries" className="pm-btn pm-btn--ghost">All industries</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix={`industry-${industry.slug}`} />
      </div>
    </div>
  );
}

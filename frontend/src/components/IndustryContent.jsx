import { Link } from 'react-router-dom';
import {
  INDUSTRIES,
  getIndustryPath,
  getRelatedIndustries,
} from '../content/industries';
import {
  BulletList,
  LinkCardGrid,
  SectionBlock,
} from './PublicContent';

export function IndustryCard({ industry }) {
  return (
    <Link to={getIndustryPath(industry.slug)} className="public-link-card">
      <div className="public-section-block__eyebrow">{industry.category}</div>
      <div className="public-link-card__title">{industry.name}</div>
      <p>{industry.summary}</p>
      <span>Open industry page -&gt;</span>
    </Link>
  );
}

export function IndustryCardGrid({ industries = INDUSTRIES }) {
  return (
    <div className="public-link-grid">
      {industries.map((industry) => (
        <IndustryCard key={industry.slug} industry={industry} />
      ))}
    </div>
  );
}

export function IndustryReinforcement({ industry }) {
  return (
    <section className="public-answer-block" aria-label="Prymal industry reinforcement">
      <div className="public-answer-block__eyebrow">Industry fit</div>
      <h2>{`Prymal -> AI Operating System for ${industry.name}`}</h2>
      <p>
        Prymal gives {industry.audience} a governed AI operating system: shared memory, specialist agents,
        workflow automation, and review controls for repeatable business execution.
      </p>
    </section>
  );
}

export function IndustryRequirementSections({ industry }) {
  return (
    <>
      <SectionBlock eyebrow="Pain points" title="Industry pain points">
        <BulletList items={industry.painPoints} />
      </SectionBlock>

      <SectionBlock eyebrow="AI opportunity" title="AI opportunities">
        <BulletList items={industry.aiOpportunities} />
      </SectionBlock>

      <SectionBlock eyebrow="Prymal use cases" title="Prymal use cases">
        <BulletList items={industry.prymalUseCases} />
      </SectionBlock>
    </>
  );
}

export function IndustryAgentRecommendations({ industry }) {
  return (
    <SectionBlock
      eyebrow="Agent recommendations"
      title={`Recommended Prymal agents for ${industry.name}`}
      description="Each recommendation is intended as an assisted workflow role with human review for sensitive or external work."
    >
      <div className="public-link-grid public-link-grid--definitions">
        {industry.agentRecommendations.map((agent) => (
          <article key={agent.id} className="public-link-card public-definition-card">
            <div className="public-section-block__eyebrow">{agent.role}</div>
            <div className="public-link-card__title">
              <Link to={`/agents/${agent.id}`}>{agent.name}</Link>
            </div>
            <p>{agent.reason}</p>
            <span>{agent.task}</span>
          </article>
        ))}
      </div>
    </SectionBlock>
  );
}

export function IndustryWorkflowExamples({ industry }) {
  return (
    <SectionBlock eyebrow="Workflow examples" title={`${industry.name} workflow examples`}>
      <div className="public-link-grid public-link-grid--definitions">
        {industry.workflowExamples.map((workflow) => (
          <article key={workflow.title} className="public-link-card public-definition-card">
            <div className="public-section-block__eyebrow">Workflow</div>
            <div className="public-link-card__title">{workflow.title}</div>
            <ol className="public-bullet-list">
              {workflow.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <span>{workflow.outcome}</span>
          </article>
        ))}
      </div>
    </SectionBlock>
  );
}

export function IndustryRoiEstimate({ industry }) {
  const rows = [
    { label: 'Setup time', value: industry.roiEstimate.setupTime },
    { label: 'Monthly hours', value: industry.roiEstimate.monthlyHours },
    { label: 'Review load', value: industry.roiEstimate.reviewLoad },
    { label: 'Payback signal', value: industry.roiEstimate.paybackSignal },
  ];

  return (
    <SectionBlock
      eyebrow="ROI estimates"
      title={`${industry.name} ROI estimates`}
      description="These are planning estimates, not guaranteed outcomes. Actual ROI depends on volume, review rules, data quality, and adoption."
    >
      <div className="public-comparison-matrix" role="table" aria-label={`${industry.name} ROI estimates`}>
        <div className="public-comparison-matrix__header" role="rowgroup">
          <div role="row" className="public-comparison-matrix__row public-comparison-matrix__row--header">
            <span role="columnheader">Signal</span>
            <span role="columnheader">Estimate</span>
          </div>
        </div>
        <div role="rowgroup">
          {rows.map((row) => (
            <div key={row.label} role="row" className="public-comparison-matrix__row">
              <strong role="rowheader">{row.label}</strong>
              <span>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </SectionBlock>
  );
}

export function IndustryRelatedPages({ industry }) {
  const relatedIndustries = getRelatedIndustries(industry);
  const items = [
    ...relatedIndustries.map((item) => ({
      title: item.name,
      to: getIndustryPath(item.slug),
      description: item.summary,
      cta: 'Open industry ->',
    })),
    ...industry.internalLinks,
  ];

  return (
    <SectionBlock eyebrow="Internal links" title="Related industry and product pages">
      <LinkCardGrid items={items} surface={`industry-${industry.slug}`} />
    </SectionBlock>
  );
}

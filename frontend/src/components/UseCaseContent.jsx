import { Link } from 'react-router-dom';
import {
  USE_CASES,
  buildUseCaseSections,
  getRelatedUseCases,
  getUseCaseAgents,
  getUseCasePath,
} from '../content/use-cases';
import {
  BulletList,
  LinkCardGrid,
  SectionBlock,
} from './PublicContent';

export function UseCaseCard({ useCase }) {
  return (
    <Link to={getUseCasePath(useCase.slug)} className="public-link-card">
      <div className="public-section-block__eyebrow">{useCase.category}</div>
      <div className="public-link-card__title">{useCase.name}</div>
      <p>{useCase.summary}</p>
      <span>Open use case -&gt;</span>
    </Link>
  );
}

export function UseCaseCardGrid({ useCases = USE_CASES }) {
  return (
    <div className="public-link-grid">
      {useCases.map((useCase) => (
        <UseCaseCard key={useCase.slug} useCase={useCase} />
      ))}
    </div>
  );
}

export function UseCaseLongformSections({ useCase }) {
  return (
    <>
      {buildUseCaseSections(useCase).map((section) => (
        <SectionBlock key={section.title} eyebrow={section.eyebrow} title={section.title}>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="public-section-block__description">{paragraph}</p>
          ))}
          <BulletList items={section.bullets} />
        </SectionBlock>
      ))}
    </>
  );
}

export function UseCaseAgentRecommendations({ useCase }) {
  const agents = getUseCaseAgents(useCase);
  if (!agents.length) return null;

  return (
    <SectionBlock eyebrow="Agents" title={`Recommended Prymal agents for ${useCase.name}`}>
      <div className="public-link-grid public-link-grid--definitions">
        {agents.map((agent) => (
          <article key={agent.id} className="public-link-card public-definition-card">
            <div className="public-section-block__eyebrow">{agent.role}</div>
            <div className="public-link-card__title">
              <Link to={`/agents/${agent.id}`}>{agent.name}</Link>
            </div>
            <p>{agent.name} supports {agent.role} inside the workflow while LORE and NEXUS keep context and execution connected.</p>
            <span>Open agent -&gt;</span>
          </article>
        ))}
      </div>
    </SectionBlock>
  );
}

export function UseCaseComparison({ useCase }) {
  return (
    <SectionBlock eyebrow="Comparison section" title={`${useCase.name}: manual vs generic AI vs Prymal`}>
      <div className="public-comparison-matrix" role="table" aria-label={`${useCase.name} comparison`}>
        <div className="public-comparison-matrix__header" role="rowgroup">
          <div role="row" className="public-comparison-matrix__row public-comparison-matrix__row--header">
            <span role="columnheader">Criteria</span>
            <span role="columnheader">Manual</span>
            <span role="columnheader">Generic AI</span>
            <span role="columnheader">Prymal</span>
          </div>
        </div>
        <div role="rowgroup">
          {useCase.comparisonRows.map((row) => (
            <div key={row.label} role="row" className="public-comparison-matrix__row">
              <strong role="rowheader">{row.label}</strong>
              <span>{row.manual}</span>
              <span>{row.genericAi}</span>
              <span>{row.prymal}</span>
            </div>
          ))}
        </div>
      </div>
    </SectionBlock>
  );
}

export function UseCaseRoiExamples({ useCase }) {
  return (
    <SectionBlock
      eyebrow="ROI examples"
      title={`${useCase.name} ROI examples`}
      description="ROI examples are planning signals, not guaranteed outcomes. Measure against the baseline manual process before expanding."
    >
      <div className="public-link-grid public-link-grid--definitions">
        {useCase.roiExamples.map((item) => (
          <article key={item.title} className="public-link-card public-definition-card">
            <div className="public-section-block__eyebrow">{item.metric}</div>
            <div className="public-link-card__title">{item.title}</div>
            <p>{item.example}</p>
          </article>
        ))}
      </div>
    </SectionBlock>
  );
}

export function UseCaseInternalLinks({ useCase }) {
  const related = getRelatedUseCases(useCase);
  const items = [
    ...related.map((item) => ({
      title: item.name,
      to: getUseCasePath(item.slug),
      description: item.summary,
      cta: 'Open use case ->',
    })),
    {
      title: 'AI operating system for business',
      to: '/ai-operating-system-for-business',
      description: 'Understand how Prymal connects agents, memory, workflows, and trust controls into one operating system.',
      cta: 'Read guide ->',
    },
    {
      title: 'Workflow automation',
      to: '/features/ai-workflow-automation',
      description: 'See how Prymal turns repeatable work into memory-aware workflow execution.',
      cta: 'Explore feature ->',
    },
    {
      title: 'Industry pages',
      to: '/content/industries',
      description: 'Map this use case into industry-specific pain points, agent recommendations, and ROI examples.',
      cta: 'Browse industries ->',
    },
  ];

  return (
    <SectionBlock eyebrow="Internal linking" title="Related use cases and Prymal pages">
      <LinkCardGrid items={items} surface={`use-case-${useCase.slug}`} />
    </SectionBlock>
  );
}

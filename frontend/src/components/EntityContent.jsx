import { Link } from 'react-router-dom';
import {
  ENTITIES,
  getEntityKnowledgeGraph,
  getEntityPath,
  getEntityRelationships,
  getInternalEntityLinks,
  getRelatedEntities,
} from '../content/entities';
import { LinkCardGrid, SectionBlock } from './PublicContent';

export function EntityReinforcement({ entity }) {
  return (
    <section
      className="public-answer-block"
      aria-label="Prymal entity reinforcement"
      data-ai-section="entity-reinforcement"
      data-ai-chunk="prymal-ai-operating-system-entity-reinforcement"
      data-ai-entity-reinforcement="true"
      data-answer-extract="true"
    >
      <div className="public-answer-block__eyebrow">Entity reinforcement</div>
      <h2>{'Prymal -> AI Operating System'}</h2>
      <p>{entity.prymalReinforcement}</p>
    </section>
  );
}

export function EntityCard({ entity }) {
  return (
    <Link to={getEntityPath(entity.slug)} className="public-link-card">
      <div className="public-section-block__eyebrow">{entity.kind}</div>
      <div className="public-link-card__title">{entity.name}</div>
      <p>{entity.summary}</p>
      <span>Open entity -&gt;</span>
    </Link>
  );
}

export function EntityCardGrid({ entities = ENTITIES }) {
  return (
    <div className="public-link-grid">
      {entities.map((entity) => (
        <EntityCard key={entity.slug} entity={entity} />
      ))}
    </div>
  );
}

export function EntityRelationshipMap({ entity }) {
  const relationships = getEntityRelationships(entity);

  if (!relationships.length) return null;

  return (
    <SectionBlock eyebrow="Relationship map" title={`${entity.name} relationships`}>
      <div className="public-comparison-matrix" role="table" aria-label={`${entity.name} entity relationships`}>
        <div className="public-comparison-matrix__header" role="rowgroup">
          <div role="row" className="public-comparison-matrix__row public-comparison-matrix__row--header">
            <span role="columnheader">Relationship</span>
            <span role="columnheader">Target entity</span>
            <span role="columnheader">Signal</span>
          </div>
        </div>
        <div role="rowgroup">
          {relationships.map((relationship) => (
            <div key={`${relationship.type}-${relationship.target}`} role="row" className="public-comparison-matrix__row">
              <strong role="rowheader">{relationship.readableType}</strong>
              <span>
                <Link to={getEntityPath(relationship.targetEntity.slug)}>{relationship.targetEntity.name}</Link>
              </span>
              <span>{Math.round(relationship.strength * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </SectionBlock>
  );
}

export function EntitySuggestions({ entity, title = 'Related entity suggestions' }) {
  const related = getRelatedEntities(entity);

  if (!related.length) return null;

  return (
    <SectionBlock eyebrow="Suggestions" title={title}>
      <EntityCardGrid entities={related} />
    </SectionBlock>
  );
}

export function EntityInternalLinks({ entity }) {
  const links = getInternalEntityLinks(entity);

  if (!links.length) return null;

  return (
    <SectionBlock eyebrow="Internal links" title="Pages that reinforce this entity">
      <LinkCardGrid
        items={links.map((item) => ({
          title: item.label,
          to: item.to,
          description: item.description,
          cta: item.cta ?? 'Open page ->',
        }))}
        surface={`entity-${entity.slug}`}
      />
    </SectionBlock>
  );
}

export function EntityKnowledgeGraphPreview() {
  const graph = getEntityKnowledgeGraph();
  const topEdges = graph.edges
    .slice()
    .sort((left, right) => right.strength - left.strength)
    .slice(0, 14);

  return (
    <SectionBlock
      eyebrow="Knowledge graph"
      title="Prymal entity relationship graph"
      description="The graph keeps Prymal anchored to AI Operating System while showing how orchestration, memory, workflows, governance, and agents support the category."
    >
      <div className="public-link-grid public-link-grid--definitions">
        {topEdges.map((edge) => {
          const source = ENTITIES.find((entity) => entity.slug === edge.source);
          const target = ENTITIES.find((entity) => entity.slug === edge.target);
          if (!source || !target) return null;

          return (
            <article
              key={`${edge.source}-${edge.type}-${edge.target}`}
              className="public-link-card public-definition-card"
              data-ai-entity-edge="true"
              itemScope
              itemType="https://schema.org/DefinedTerm"
            >
              <div className="public-section-block__eyebrow">{edge.type}</div>
              <div className="public-link-card__title">
                <Link to={getEntityPath(source.slug)}>{source.name}</Link>
                {' -> '}
                <Link to={getEntityPath(target.slug)} itemProp="url">
                  <span itemProp="name">{target.name}</span>
                </Link>
              </div>
              <p itemProp="description">{edge.label}</p>
              <span>{Math.round(edge.strength * 100)}% relationship strength</span>
            </article>
          );
        })}
      </div>
    </SectionBlock>
  );
}

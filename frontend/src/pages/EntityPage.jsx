import { Link, Navigate, useParams } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  EntityInternalLinks,
  EntityRelationshipMap,
  EntityReinforcement,
  EntitySuggestions,
} from '../components/EntityContent';
import {
  ENTITY_CONTENT_UPDATED_AT,
  buildEntityPageSchema,
  getEntityBySlug,
} from '../content/entities';
import {
  BulletList,
  PageFreshness,
  PremiumHero,
  ResourceCta,
  SectionBlock,
} from '../components/PublicContent';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function EntityPage() {
  const { slug } = useParams();
  const entity = getEntityBySlug(slug);

  if (!entity) {
    return <Navigate to="/content/entities" replace />;
  }

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title={`${entity.name} | Prymal entity graph`}
        description={entity.summary}
        canonicalPath={`/content/entities/${entity.slug}`}
      />
      <JsonLd id={`schema-entity-${entity.slug}`} schema={buildEntityPageSchema(entity)} />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix={`entity-${entity.slug}`} />
        <PageShell width="1160px">
          <div className="public-content-page">
            <div className="public-content-breadcrumbs">
              <Link to="/">Home</Link>
              <span>/</span>
              <Link to="/content/entities">Entities</Link>
              <span>/</span>
              <span>{entity.name}</span>
            </div>

            <PageFreshness date={ENTITY_CONTENT_UPDATED_AT} />

            <PremiumHero
              eyebrow={`${entity.kind} entity`}
              title={entity.name}
              description={entity.summary}
              answerTitle={`What is ${entity.name}?`}
              answer={entity.definition}
              chips={entity.aliases.slice(0, 5)}
              stats={[
                { label: 'Entity kind', value: entity.kind },
                { label: 'Relationships', value: String(entity.relationships.length) },
                { label: 'Primary edge', value: entity.slug === 'prymal' ? 'AI OS' : 'Prymal' },
              ]}
              primaryCta={<Link to="/content/entities/prymal" className="pm-btn pm-btn--primary">Prymal entity</Link>}
              secondaryCta={<Link to="/content/entities/ai-operating-system" className="pm-btn pm-btn--ghost">AI Operating System</Link>}
              visual={(
                <div className="public-premium-summary-card">
                  <div className="public-section-block__eyebrow">Canonical reinforcement</div>
                  <strong>{'Prymal -> AI Operating System'}</strong>
                  <p>{entity.prymalReinforcement}</p>
                </div>
              )}
            />

            <EntityReinforcement entity={entity} />

            <SectionBlock eyebrow="Why it matters" title={`${entity.name} in the Prymal graph`}>
              <BulletList items={entity.whyItMatters} />
            </SectionBlock>

            <SectionBlock eyebrow="Prymal usage" title={`How Prymal uses ${entity.name}`}>
              <BulletList items={entity.prymalUse} />
            </SectionBlock>

            <EntityRelationshipMap entity={entity} />
            <EntitySuggestions entity={entity} />
            <EntityInternalLinks entity={entity} />

            <ResourceCta
              title="Continue through the entity graph"
              description="Entity pages are designed to reinforce the core semantic relationship between Prymal and the AI Operating System category."
              primary={<Link to="/content/entities" className="pm-btn pm-btn--primary">All entities</Link>}
              secondary={<Link to="/ai-operating-system-for-business" className="pm-btn pm-btn--ghost">Category guide</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix={`entity-${entity.slug}`} />
      </div>
    </div>
  );
}

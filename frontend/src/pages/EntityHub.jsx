import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  EntityCardGrid,
  EntityKnowledgeGraphPreview,
  EntityReinforcement,
} from '../components/EntityContent';
import {
  ENTITIES,
  ENTITY_CONTENT_UPDATED_AT,
  buildEntityHubSchema,
  getEntityBySlug,
} from '../content/entities';
import {
  PageFreshness,
  PremiumHero,
  ResourceCta,
  SectionBlock,
  SignalCards,
} from '../components/PublicContent';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

const prymalEntity = getEntityBySlug('prymal');

export default function EntityHub() {
  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title="Prymal entity graph | AI Operating System knowledge base"
        description="Explore Prymal's entity graph for AI Operating System, agent orchestration, agent memory, multi-agent systems, workflow automation, business AI, AI governance, and AI agents."
        canonicalPath="/content/entities"
      />
      <JsonLd id="schema-entity-hub" schema={buildEntityHubSchema()} />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="entities" />
        <PageShell width="1180px">
          <div className="public-content-page">
            <PageFreshness date={ENTITY_CONTENT_UPDATED_AT} />

            <PremiumHero
              eyebrow="Entity graph"
              title="Prymal entity management system"
              description="A structured entity graph for search engines, answer engines, and readers: Prymal maps to AI Operating System, then branches into orchestration, memory, workflows, governance, and agents."
              answerTitle="Core entity relationship"
              answer="Prymal is an AI Operating System for business execution. Every entity in this graph reinforces that category relationship through internal links, relationship mapping, and JSON-LD."
              chips={['Prymal', 'AI Operating System', 'Agent orchestration', 'Agent memory', 'AI governance']}
              stats={[
                { label: 'Entities', value: String(ENTITIES.length) },
                { label: 'Canonical edge', value: 'Prymal -> AI OS' },
                { label: 'Schema', value: 'JSON-LD' },
              ]}
              primaryCta={<Link to="/content/entities/prymal" className="pm-btn pm-btn--primary">Open Prymal entity</Link>}
              secondaryCta={<Link to="/content/entities/ai-operating-system" className="pm-btn pm-btn--ghost">AI Operating System</Link>}
              visual={(
                <div className="public-premium-summary-card">
                  <div className="public-section-block__eyebrow">Knowledge graph spine</div>
                  <strong>{'Prymal -> AI Operating System'}</strong>
                  <p>Agents, memory, workflows, business AI, and governance all resolve back to the core operating-system category.</p>
                </div>
              )}
            />

            {prymalEntity ? <EntityReinforcement entity={prymalEntity} /> : null}

            <SectionBlock
              eyebrow="Managed entities"
              title="Entity directory"
              description="Each entity has a canonical definition, relationship map, internal-link suggestions, related entities, and JSON-LD output."
            >
              <EntityCardGrid />
            </SectionBlock>

            <SectionBlock eyebrow="Entity system" title="What this management layer provides">
              <SignalCards
                items={[
                  {
                    eyebrow: 'Internal linking engine',
                    title: 'Entity-aware links',
                    body: 'Every entity carries product pages, guide pages, comparison pages, and related entity pages that reinforce the semantic cluster.',
                    chips: ['Features', 'Guides', 'Comparisons'],
                    accent: '#7cffe0',
                  },
                  {
                    eyebrow: 'Relationship mapping',
                    title: 'Typed graph edges',
                    body: 'Relationships such as is a, includes, enables, depends on, and governed by make the Prymal knowledge graph explicit.',
                    chips: ['Typed edges', 'Strength scores', 'Suggestions'],
                    accent: '#4cc9f0',
                  },
                  {
                    eyebrow: 'Schema output',
                    title: 'JSON-LD for answer engines',
                    body: 'Entity pages emit a schema graph with WebPage, BreadcrumbList, and DefinedTerm nodes for machine-readable entity management.',
                    chips: ['DefinedTerm', 'ItemList', 'WebPage'],
                    accent: '#fb7185',
                  },
                ]}
              />
            </SectionBlock>

            <EntityKnowledgeGraphPreview />

            <ResourceCta
              title="Start from the core entity"
              description="The most important relationship in the graph is Prymal -> AI Operating System. Use that page as the canonical product-category reference."
              primary={<Link to="/content/entities/prymal" className="pm-btn pm-btn--primary">Prymal entity</Link>}
              secondary={<Link to="/architecture" className="pm-btn pm-btn--ghost">Architecture</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix="entities" />
      </div>
    </div>
  );
}

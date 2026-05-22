import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  FAQSection,
  PremiumHero,
  ResourceCta,
  SectionBlock,
  SignalCards,
  SystemDiagram,
  OperatingModuleGrid,
  buildCollectionSchema,
} from '../components/PublicContent';
import { FEATURE_PAGES, HOME_FAQ_ITEMS, PUBLIC_OG_DEFAULTS } from '../lib/site-content';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

const ARCHITECTURE_NODES = [
  { label: 'Agents', detail: 'Specialist execution lanes', glyph: 'AG', x: 18, y: 22, accent: '#7cffe0', highlight: true },
  { label: 'LORE', detail: 'Business memory and evidence', glyph: 'LO', x: 50, y: 12, accent: '#c77dff', highlight: true },
  { label: 'NEXUS', detail: 'Workflow orchestration', glyph: 'NX', x: 82, y: 24, accent: '#4cc9f0', highlight: true },
  { label: 'WARDEN', detail: 'Input and action screening', glyph: 'WD', x: 18, y: 70, accent: '#ffd166' },
  { label: 'Project Context', detail: 'Active initiative memory', glyph: 'PC', x: 50, y: 82, accent: '#80ffdb' },
  { label: 'SENTINEL', detail: 'Output validation and quality review', glyph: 'SE', x: 82, y: 70, accent: '#fb7185' },
];

const ARCHITECTURE_LINKS = [
  { from: 'Agents', to: 'LORE', fromX: 24, fromY: 32, toX: 46, toY: 22, accent: 'rgba(124,255,224,0.35)' },
  { from: 'LORE', to: 'NEXUS', fromX: 54, fromY: 22, toX: 76, toY: 32, accent: 'rgba(199,125,255,0.35)' },
  { from: 'WARDEN', to: 'Project Context', fromX: 24, fromY: 72, toX: 46, toY: 78, accent: 'rgba(255,209,102,0.35)' },
  { from: 'Project Context', to: 'SENTINEL', fromX: 54, fromY: 78, toX: 76, toY: 72, accent: 'rgba(128,255,219,0.35)' },
  { from: 'Agents', to: 'Project Context', fromX: 22, fromY: 34, toX: 48, toY: 74, accent: 'rgba(124,255,224,0.2)' },
  { from: 'NEXUS', to: 'SENTINEL', fromX: 80, fromY: 34, toX: 82, toY: 66, accent: 'rgba(76,201,240,0.2)' },
];

const FEATURE_SIGNALS = [
  {
    eyebrow: 'System coherence',
    title: 'How Prymal works as one system',
    body: 'Specialist agents do not live as disconnected bots. They inherit shared business memory, contribute inside workflow paths, and stay bounded by the same safety and trust layers.',
    chips: ['Shared context', 'Agent handoffs', 'Review-aware execution'],
    accent: '#7cffe0',
  },
  {
    eyebrow: 'Execution depth',
    title: 'Built for usable work, not just polished demos',
    body: 'The product story stays focused on outputs teams can actually use: campaigns, follow-up systems, reporting, decision support, workflow automation, and governed business actions.',
    chips: ['Content', 'Outreach', 'Reporting', 'Automation'],
    accent: '#4cc9f0',
  },
  {
    eyebrow: 'Trust boundary',
    title: 'Memory, workflows, and trust stay connected',
    body: 'The architecture keeps business memory, approvals, validation, and operational evidence close enough to execution that teams can move faster without losing control.',
    chips: ['WARDEN', 'SENTINEL', 'Evidence', 'Readiness'],
    accent: '#fb7185',
  },
];

export default function Features() {
  const moduleCards = FEATURE_PAGES.map((page) => ({
    title: page.title,
    glyph: page.glyph,
    description: page.answer,
    proof: page.proofPoint,
    chips: page.useCaseChips,
    metric: page.architectureRole,
    cta: <Link to={`/features/${page.slug}`}>Open module -&gt;</Link>,
  }));

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title={PUBLIC_OG_DEFAULTS.features.title}
        description={PUBLIC_OG_DEFAULTS.features.description}
        canonicalPath="/features"
        ogImage={PUBLIC_OG_DEFAULTS.features.image}
        ogImageAlt={PUBLIC_OG_DEFAULTS.features.imageAlt}
      />
      <JsonLd
        id="schema-features"
        schema={buildCollectionSchema({
          name: 'Prymal features',
          description: 'Feature pages covering agents, business memory, workflows, security, content, and reporting.',
          path: '/features',
        })}
      />
      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="features" />
        <PageShell width="1180px">
          <div className="public-content-page">
            <PremiumHero
              eyebrow="Feature operating map"
              title="Prymal features for execution, memory, workflows, and trust"
              description="Explore Prymal as one coordinated operating layer: specialist agents at the edge, LORE in the middle, workflow execution in motion, and trust boundaries wrapped around the whole system."
              answerTitle="What does Prymal include?"
              answer="Prymal combines specialist agents, shared business memory, workflow automation, evidence-aware outputs, and safety controls in one coordinated workspace."
              chips={['Specialist agents', 'LORE memory', 'NEXUS workflows', 'WARDEN + SENTINEL', 'Project Context']}
              stats={[
                { label: 'Specialist lanes', value: '14' },
                { label: 'Shared context layers', value: '3' },
                { label: 'Trust surfaces', value: 'Governed' },
              ]}
              primaryCta={<Link to="/pricing" className="pm-btn pm-btn--primary">View pricing</Link>}
              secondaryCta={<Link to="/trust" className="pm-btn pm-btn--ghost">Explore trust</Link>}
              visual={(
                <div className="public-hero-rail">
                  <SystemDiagram
                    title="System architecture"
                    nodes={ARCHITECTURE_NODES}
                    links={ARCHITECTURE_LINKS}
                    className="public-system-diagram--compact"
                  />
                  <div className="public-hero-rail__grid public-hero-rail__grid--duo">
                    <div className="public-premium-summary-card public-premium-summary-card--compact">
                      <div className="public-section-block__eyebrow">Execution loop</div>
                      <strong>Agents, memory, and workflows stay linked</strong>
                      <p>Execution lanes inherit shared context, move through NEXUS, and keep live initiatives visible through Project Context.</p>
                    </div>
                    <div className="public-premium-summary-card public-premium-summary-card--compact">
                      <div className="public-section-block__eyebrow">Trust loop</div>
                      <strong>Speed stays bounded by reviewable controls</strong>
                      <p>WARDEN and SENTINEL wrap risky paths so business execution can move faster without drifting into unreviewed automation.</p>
                    </div>
                  </div>
                </div>
              )}
            />

            <SectionBlock
              eyebrow="Operating modules"
              title="Six modules that make Prymal feel like one business operating system"
              description="Each module is opinionated enough to do real work, but connected enough to share memory, proofs, and execution paths with the rest of the workspace."
            >
              <OperatingModuleGrid items={moduleCards} />
            </SectionBlock>

            <SectionBlock
              eyebrow="System behaviour"
              title="How Prymal works as one system"
              description="The feature story is strongest when the layers are read together: memory improves continuity, workflows improve repeatability, and trust controls keep execution reviewable."
            >
              <SignalCards items={FEATURE_SIGNALS} />
            </SectionBlock>

            <FAQSection title="Feature FAQ" items={HOME_FAQ_ITEMS.slice(0, 4)} schemaId="schema-features-faq" />

            <ResourceCta
              title="Looking for detailed examples?"
              description="The blog and comparison hub show how Prymal fits real business workflows, shared context, and trust-sensitive execution."
              primary={<Link to="/blog" className="pm-btn pm-btn--primary">Browse the blog</Link>}
              secondary={<Link to="/compare" className="pm-btn pm-btn--ghost">See comparisons</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix="features" />
      </div>
    </div>
  );
}

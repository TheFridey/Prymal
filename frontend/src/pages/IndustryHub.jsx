import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { IndustryCardGrid } from '../components/IndustryContent';
import {
  INDUSTRIES,
  INDUSTRY_CONTENT_UPDATED_AT,
  INDUSTRY_HUB_PATH,
  buildIndustryHubSchema,
} from '../content/industries';
import {
  PageFreshness,
  PremiumHero,
  ResourceCta,
  SectionBlock,
  SignalCards,
} from '../components/PublicContent';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function IndustryHub() {
  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title="Prymal industry AI workflow library | AI Operating System"
        description="Explore Prymal industry pages for pain points, AI opportunities, use cases, agent recommendations, workflow examples, ROI estimates, FAQ, and structured data."
        canonicalPath={INDUSTRY_HUB_PATH}
      />
      <JsonLd id="schema-industry-hub" schema={buildIndustryHubSchema()} />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="industries" />
        <PageShell width="1180px">
          <div className="public-content-page">
            <PageFreshness date={INDUSTRY_CONTENT_UPDATED_AT} />

            <PremiumHero
              eyebrow="Industry framework"
              title="Dynamic industry pages for Prymal"
              description="A generated library of industry pages that maps business pain points to AI opportunities, Prymal use cases, recommended agents, workflow examples, ROI estimates, FAQ, and JSON-LD."
              answerTitle="What is this industry framework?"
              answer="Prymal is an AI operating system for business execution. These pages show how that system applies across industries using reusable content data, structured schema, and internal links."
              chips={['Pain points', 'AI opportunities', 'Agents', 'Workflows', 'ROI estimates']}
              stats={[
                { label: 'Industry pages', value: String(INDUSTRIES.length) },
                { label: 'Schema', value: 'JSON-LD' },
                { label: 'Core edge', value: 'Prymal -> AI OS' },
              ]}
              primaryCta={<Link to="/content/industries/agencies" className="pm-btn pm-btn--primary">Open agencies</Link>}
              secondaryCta={<Link to="/content/entities/prymal" className="pm-btn pm-btn--ghost">Prymal entity</Link>}
              visual={(
                <div className="public-premium-summary-card">
                  <div className="public-section-block__eyebrow">Generated page model</div>
                  <strong>Industry -&gt; workflow -&gt; agent -&gt; review</strong>
                  <p>Every industry page is generated from a typed content object and emits a schema graph for answer engines.</p>
                </div>
              )}
            />

            <SectionBlock
              eyebrow="Industry directory"
              title="Generated industry pages"
              description="Each page includes industry pain points, AI opportunities, Prymal use cases, agent recommendations, workflow examples, ROI estimates, FAQ, and structured data."
            >
              <IndustryCardGrid />
            </SectionBlock>

            <SectionBlock eyebrow="Framework" title="Reusable industry page system">
              <SignalCards
                items={[
                  {
                    eyebrow: 'Content model',
                    title: 'One data layer',
                    body: 'Industry pages are generated from reusable content objects so route discovery, sitemap generation, page rendering, and schema stay aligned.',
                    chips: ['Strong model', 'Generated routes', 'Reusable pages'],
                    accent: '#7cffe0',
                  },
                  {
                    eyebrow: 'Structured data',
                    title: 'Schema per industry',
                    body: 'Every detail page emits WebPage, BreadcrumbList, FAQPage, and ItemList schema for agent recommendations and workflow examples.',
                    chips: ['FAQPage', 'ItemList', 'Breadcrumbs'],
                    accent: '#4cc9f0',
                  },
                  {
                    eyebrow: 'Internal links',
                    title: 'Entity reinforcement',
                    body: 'Industry pages connect back to Prymal, the AI Operating System entity, workflows, agents, and related industry pages.',
                    chips: ['Prymal', 'AI Operating System', 'Workflows'],
                    accent: '#fb7185',
                  },
                ]}
              />
            </SectionBlock>

            <ResourceCta
              title="Start with the most relevant workflow"
              description="Pick an industry, identify the recurring workflow with the clearest review point, then use Prymal to turn it into repeatable business execution."
              primary={<Link to="/content/industries/smbs" className="pm-btn pm-btn--primary">SMB workflows</Link>}
              secondary={<Link to="/features/ai-workflow-automation" className="pm-btn pm-btn--ghost">Workflow automation</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix="industries" />
      </div>
    </div>
  );
}

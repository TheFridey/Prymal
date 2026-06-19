import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { UseCaseCardGrid } from '../components/UseCaseContent';
import {
  USE_CASES,
  USE_CASE_CONTENT_UPDATED_AT,
  USE_CASE_HUB_PATH,
  buildUseCaseHubSchema,
} from '../content/use-cases';
import {
  PageFreshness,
  PremiumHero,
  ResourceCta,
  SectionBlock,
  SignalCards,
} from '../components/PublicContent';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function UseCaseHub() {
  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title="Prymal AI use case library | 50 workflow templates"
        description="Explore 50 Prymal AI use case pages with long-form templates, FAQ, comparison sections, ROI examples, internal links, and structured data."
        canonicalPath={USE_CASE_HUB_PATH}
      />
      <JsonLd id="schema-use-case-hub" schema={buildUseCaseHubSchema()} />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="use-cases" />
        <PageShell width="1180px">
          <div className="public-content-page">
            <PageFreshness date={USE_CASE_CONTENT_UPDATED_AT} />

            <PremiumHero
              eyebrow="Use case library"
              title="50 AI workflow use case templates"
              description="A generated library of Prymal use cases covering sales, marketing, support, operations, finance, governance, leadership, customer success, and people workflows."
              answerTitle="What is the Prymal use case framework?"
              answer="Prymal turns recurring business work into governed AI workflows with shared memory, specialist agents, review gates, ROI measurement, and schema-rich public pages."
              chips={['50 pages', '1500+ words each', 'FAQ', 'Comparison', 'ROI examples']}
              stats={[
                { label: 'Use cases', value: String(USE_CASES.length) },
                { label: 'Template', value: 'Long-form' },
                { label: 'Schema', value: 'JSON-LD' },
              ]}
              primaryCta={<Link to="/use-cases/lead-generation" className="pm-btn pm-btn--primary">Lead generation</Link>}
              secondaryCta={<Link to="/content/industries" className="pm-btn pm-btn--ghost">Industries</Link>}
              visual={(
                <div className="public-premium-summary-card">
                  <div className="public-section-block__eyebrow">Page model</div>
                  <strong>Use case -&gt; workflow -&gt; agents -&gt; ROI</strong>
                  <p>Each page is generated from structured data and rendered through reusable templates with no one-off route files.</p>
                </div>
              )}
            />

            <SectionBlock
              eyebrow="Generated pages"
              title="Use case directory"
              description="Every page includes long-form guidance, FAQ, JSON-LD schema, comparison, ROI examples, and internal links."
            >
              <UseCaseCardGrid />
            </SectionBlock>

            <SectionBlock eyebrow="Framework" title="What every generated page includes">
              <SignalCards
                items={[
                  {
                    eyebrow: 'Template',
                    title: '1500+ word structure',
                    body: 'Each detail page expands the same strongly typed use-case model into overview, pain points, source context, workflow template, governance, comparison, ROI, and rollout guidance.',
                    chips: ['Long-form', 'Reusable', 'Generated'],
                    accent: '#7cffe0',
                  },
                  {
                    eyebrow: 'Schema',
                    title: 'Answer-engine ready',
                    body: 'Use case pages emit WebPage, BreadcrumbList, FAQPage, and ItemList schema for comparison and ROI examples.',
                    chips: ['FAQPage', 'ItemList', 'Breadcrumbs'],
                    accent: '#4cc9f0',
                  },
                  {
                    eyebrow: 'Links',
                    title: 'Internal topic graph',
                    body: 'Every page links to related use cases, agents, industry pages, the AI operating system guide, and workflow automation.',
                    chips: ['Use cases', 'Agents', 'Industries'],
                    accent: '#fb7185',
                  },
                ]}
              />
            </SectionBlock>

            <ResourceCta
              title="Start with one repeatable workflow"
              description="Pick the use case with the clearest inputs, output, review owner, and ROI metric. Then expand from a trusted first workflow."
              primary={<Link to="/signup" className="pm-btn pm-btn--primary">Start free</Link>}
              secondary={<Link to="/features/ai-workflow-automation" className="pm-btn pm-btn--ghost">Workflow automation</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix="use-cases" />
      </div>
    </div>
  );
}

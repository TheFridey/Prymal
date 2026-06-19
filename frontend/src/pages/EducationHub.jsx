import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { EducationCardGrid } from '../components/EducationContent';
import {
  EDUCATION_CONTENT_UPDATED_AT,
  EDUCATION_HUB_PATH,
  EDUCATION_PAGES,
  buildEducationHubSchema,
} from '../content/education';
import {
  PageFreshness,
  PremiumHero,
  ResourceCta,
  SectionBlock,
  SignalCards,
} from '../components/PublicContent';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function EducationHub() {
  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title="What Is AI? Prymal education hub"
        description="Explore Prymal What Is pages for AI operating systems, agent orchestration, memory, workflow automation, multi-agent AI, governance, RAG, collaboration, and AI workflow management."
        canonicalPath={EDUCATION_HUB_PATH}
      />
      <JsonLd id="schema-education-hub" schema={buildEducationHubSchema()} />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="education" />
        <PageShell width="1180px">
          <div className="public-content-page">
            <PageFreshness date={EDUCATION_CONTENT_UPDATED_AT} />

            <PremiumHero
              eyebrow="What Is education hub"
              title="Educational AI knowledge hub"
              description="Long-form explainers for the concepts behind Prymal: AI operating systems, agent orchestration, memory, workflow automation, multi-agent AI, governance, RAG, collaboration, and workflow management."
              answerTitle="What does this hub teach?"
              answer="This hub explains the vocabulary of business AI execution, then connects each concept to examples, references, illustrations, FAQs, schema, and internal reading paths."
              chips={['What Is pages', '2500+ words', 'Illustrations', 'References', 'FAQ schema']}
              stats={[
                { label: 'Pages', value: String(EDUCATION_PAGES.length) },
                { label: 'Format', value: 'Long-form' },
                { label: 'Schema', value: 'Article + FAQ' },
              ]}
              primaryCta={<Link to="/what-is/ai-operating-system" className="pm-btn pm-btn--primary">Start with AI OS</Link>}
              secondaryCta={<Link to="/content/entities" className="pm-btn pm-btn--ghost">Entity graph</Link>}
              visual={(
                <div className="public-premium-summary-card">
                  <div className="public-section-block__eyebrow">Learning path</div>
                  <strong>Definition -&gt; example -&gt; governance -&gt; workflow</strong>
                  <p>Every page moves from a plain-English definition to practical business execution.</p>
                </div>
              )}
            />

            <SectionBlock
              eyebrow="What Is pages"
              title="Generated education directory"
              description="Each page includes a 2500+ word explainer, illustration, examples, FAQs, references, schema, and internal links."
            >
              <EducationCardGrid />
            </SectionBlock>

            <SectionBlock eyebrow="Template" title="What every explainer includes">
              <SignalCards
                items={[
                  {
                    eyebrow: 'Depth',
                    title: 'Long-form education',
                    body: 'The template covers definition, components, examples, Prymal lens, governance, misconceptions, implementation, evaluation, and summary.',
                    chips: ['2500+ words', 'Examples', 'FAQ'],
                    accent: '#7cffe0',
                  },
                  {
                    eyebrow: 'Visuals',
                    title: 'Illustration support',
                    body: 'Every page has a structured diagram model that can render concept-specific illustrations from content data.',
                    chips: ['Diagrams', 'Reusable', 'Data-driven'],
                    accent: '#4cc9f0',
                  },
                  {
                    eyebrow: 'AEO/GEO',
                    title: 'References and schema',
                    body: 'Pages include reference lists and JSON-LD for Article, WebPage, BreadcrumbList, FAQPage, DefinedTerm, and reference ItemList.',
                    chips: ['Article', 'FAQPage', 'DefinedTerm'],
                    accent: '#fb7185',
                  },
                ]}
              />
            </SectionBlock>

            <ResourceCta
              title="Turn concepts into workflows"
              description="After learning the concept, map it to a practical AI workflow, industry page, comparison, or entity page."
              primary={<Link to="/use-cases" className="pm-btn pm-btn--primary">Use cases</Link>}
              secondary={<Link to="/content/industries" className="pm-btn pm-btn--ghost">Industries</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix="education" />
      </div>
    </div>
  );
}

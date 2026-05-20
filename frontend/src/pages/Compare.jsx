import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  ComparisonMatrix,
  OperatingModuleGrid,
  PremiumHero,
  ResourceCta,
  SectionBlock,
  SignalCards,
  buildCollectionSchema,
} from '../components/PublicContent';
import { COMPARISON_PAGES, PUBLIC_OG_DEFAULTS } from '../lib/site-content';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

const COMPARE_SIGNALS = [
  {
    eyebrow: 'Use this hub for category fit',
    title: 'Choose the right operating model',
    body: 'These pages are written to help buyers decide whether they need conversation, specialist execution, workflow automation, or a more configurable builder surface.',
    chips: ['Conversation', 'Execution', 'Automation', 'Governance'],
    accent: '#7cffe0',
  },
  {
    eyebrow: 'Neutral language',
    title: 'Fair comparisons, not cheap shots',
    body: 'The comparison layer stays respectful to adjacent product categories. The job is to clarify fit and limitations, not to score points through hostile copy.',
    chips: ['Category-based', 'Respectful tone', 'No negative attacks'],
    accent: '#4cc9f0',
  },
  {
    eyebrow: 'Business lens',
    title: 'Memory, workflow, and governance stay central',
    body: 'Prymal is consistently positioned around shared business context, specialist handoffs, repeatable execution, and trust-sensitive operator controls.',
    chips: ['Shared memory', 'Workflows', 'Operator visibility'],
    accent: '#fb7185',
  },
];

export default function Compare() {
  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title="Compare Prymal - Prymal"
        description="Compare Prymal with general chat tools, AI chatbots, agent platforms, and workflow automation categories for business use."
        canonicalPath="/compare"
        ogImage={PUBLIC_OG_DEFAULTS.compare.image}
        ogImageAlt={PUBLIC_OG_DEFAULTS.compare.imageAlt}
      />
      <JsonLd
        id="schema-compare-hub"
        schema={buildCollectionSchema({
          name: 'Prymal comparison hub',
          description: 'Fair comparison pages showing where Prymal fits across business AI categories.',
          path: '/compare',
        })}
      />
      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="compare" />
        <PageShell width="1180px">
          <div className="public-content-page">
            <PremiumHero
              eyebrow="Comparison hub"
              title="Compare Prymal with business AI categories fairly"
              description="Use the comparison hub to understand category fit without hostile language, inflated promises, or vague platform talk. The goal is practical buyer clarity for serious teams."
              answerTitle="How should you use this hub?"
              answer="Use these comparisons to decide whether you need a general chat tool, an execution-first AI workspace, a workflow automation product, or a more open-ended agent platform."
              chips={['Category fit', 'Neutral tone', 'Memory lens', 'Workflow lens', 'Governance lens']}
              stats={[
                { label: 'Comparison pages', value: String(COMPARISON_PAGES.length) },
                { label: 'Buyer stance', value: 'Fair' },
                { label: 'Positioning style', value: 'Category-led' },
              ]}
              primaryCta={<Link to="/features" className="pm-btn pm-btn--primary">See feature pages</Link>}
              secondaryCta={<Link to="/trust" className="pm-btn pm-btn--ghost">Review trust posture</Link>}
              visual={(
                <div className="public-hero-rail">
                  <div className="public-hero-rail__grid public-hero-rail__grid--duo">
                    <div className="public-premium-summary-card public-premium-summary-card--compact">
                      <div className="public-section-block__eyebrow">Choose Prymal if...</div>
                      <strong>The work needs memory, workflows, and reviewable execution</strong>
                      <p>Use Prymal when business context has to persist across agents, team members, and repeatable operating paths.</p>
                    </div>
                    <div className="public-premium-summary-card public-premium-summary-card--compact">
                      <div className="public-section-block__eyebrow">A lighter tool may be enough if...</div>
                      <strong>The need is mostly conversation or deterministic orchestration</strong>
                      <p>General chat or simpler automation can be enough when continuity, governance, and shared business state are not central.</p>
                    </div>
                  </div>
                  <ComparisonMatrix
                    className="public-comparison-matrix--compact"
                    columns={['Prymal', 'General category fit']}
                    rows={[
                      {
                        label: 'Shared memory',
                        prymal: 'Built into the operating layer',
                        other: 'Often lighter or chat-history-led',
                      },
                      {
                        label: 'Workflow depth',
                        prymal: 'Approval-aware execution paths',
                        other: 'Varies by category and use case',
                      },
                      {
                        label: 'Governance',
                        prymal: 'Operator-ready trust boundaries',
                        other: 'Usually narrower by default',
                      },
                    ]}
                  />
                </div>
              )}
            />

            <SectionBlock eyebrow="Comparison pages" title="Explore the most common buying questions">
              <OperatingModuleGrid
                items={COMPARISON_PAGES.map((page) => ({
                  title: page.title,
                  glyph: 'VS',
                  description: page.answer,
                  proof: page.intro,
                  chips: page.bestFor.slice(0, 2),
                  metric: 'Category comparison',
                  cta: <Link to={`/compare/${page.slug}`}>Read comparison -&gt;</Link>,
                }))}
              />
            </SectionBlock>

            <SectionBlock eyebrow="How to read these pages" title="Comparison criteria that stay commercially useful">
              <SignalCards items={COMPARE_SIGNALS} />
            </SectionBlock>

            <ResourceCta
              title="Need a more direct product view?"
              description="Feature pages, pricing, and the trust page are the best next steps once you understand the category fit."
              primary={<Link to="/pricing" className="pm-btn pm-btn--primary">View pricing</Link>}
              secondary={<Link to="/blog" className="pm-btn pm-btn--ghost">Read the blog</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix="compare" />
      </div>
    </div>
  );
}

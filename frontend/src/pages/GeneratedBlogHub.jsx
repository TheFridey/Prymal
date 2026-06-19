import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { GeneratedBlogGrid } from '../components/GeneratedBlogContent';
import {
  GENERATED_BLOG_ARTICLES,
  GENERATED_BLOG_CATEGORIES,
  GENERATED_BLOG_HUB_PATH,
  GENERATED_BLOG_UPDATED_AT,
  buildGeneratedBlogHubSchema,
  getGeneratedBlogArticlesByCategory,
} from '../content/blog';
import {
  PageFreshness,
  PremiumHero,
  ResourceCta,
  SectionBlock,
  SignalCards,
} from '../components/PublicContent';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function GeneratedBlogHub() {
  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title="Prymal generated AI operations blog | 100 articles"
        description="Explore 100 generated Prymal articles across AI operations, AI agents, workflow automation, business systems, agency growth, sales automation, knowledge management, and AI governance."
        canonicalPath={GENERATED_BLOG_HUB_PATH}
      />
      <JsonLd id="schema-generated-blog-hub" schema={buildGeneratedBlogHubSchema()} />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="generated-blog" />
        <PageShell width="1180px">
          <div className="public-content-page">
            <PageFreshness date={GENERATED_BLOG_UPDATED_AT} />

            <PremiumHero
              eyebrow="Generated blog system"
              title="100 AI operations articles"
              description="A generated content hub for AI operating systems, agent orchestration, business automation, sales, operations, content, governance, comparisons, and future-of-business AI topics."
              answerTitle="What is this blog system?"
              answer="This hub generates long-form articles from structured data, then expands each page with FAQs, citations, internal links, entity references, and Article schema."
              chips={['100 articles', '2000+ words', 'FAQs', 'Citations', 'Entity references']}
              stats={[
                { label: 'Articles', value: String(GENERATED_BLOG_ARTICLES.length) },
                { label: 'Categories', value: String(GENERATED_BLOG_CATEGORIES.length) },
                { label: 'Schema', value: 'Article + FAQ' },
              ]}
              primaryCta={<Link to="/content/blog/what-is-an-ai-operating-system" className="pm-btn pm-btn--primary">Start reading</Link>}
              secondaryCta={<Link to="/what-is" className="pm-btn pm-btn--ghost">What Is hub</Link>}
              visual={(
                <div className="public-premium-summary-card">
                  <div className="public-section-block__eyebrow">Editorial engine</div>
                  <strong>Topic -&gt; article -&gt; citations -&gt; entities</strong>
                  <p>Every article is generated from a structured content model and linked into the wider Prymal knowledge graph.</p>
                </div>
              )}
            />

            <SectionBlock eyebrow="Categories" title="Generated article categories">
              <SignalCards
                items={GENERATED_BLOG_CATEGORIES.map((category, index) => ({
                  eyebrow: 'Category',
                  title: category,
                  body: `${getGeneratedBlogArticlesByCategory(category).length} generated articles connected to Prymal's AI operating system knowledge graph.`,
                  chips: ['Articles', 'Schema', 'Internal links'],
                  accent: ['#7cffe0', '#4cc9f0', '#fb7185', '#facc15'][index % 4],
                }))}
              />
            </SectionBlock>

            <SectionBlock
              eyebrow="All articles"
              title="Generated article library"
              description="These are the 100 generated long-form article targets."
            >
              <GeneratedBlogGrid />
            </SectionBlock>

            <ResourceCta
              title="Move from article to workflow"
              description="Use the blog to understand strategy, then move into What Is explainers, use cases, industry pages, comparisons, and entity definitions."
              primary={<Link to="/use-cases" className="pm-btn pm-btn--primary">Use cases</Link>}
              secondary={<Link to="/content/entities" className="pm-btn pm-btn--ghost">Entity graph</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix="generated-blog" />
      </div>
    </div>
  );
}

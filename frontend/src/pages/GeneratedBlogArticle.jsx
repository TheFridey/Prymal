import { Link, Navigate, useParams } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  GeneratedBlogArticleSections,
  GeneratedBlogCitations,
  GeneratedBlogEntityReferences,
  GeneratedBlogInternalLinks,
} from '../components/GeneratedBlogContent';
import {
  GENERATED_BLOG_HUB_PATH,
  GENERATED_BLOG_UPDATED_AT,
  buildGeneratedBlogArticleSchema,
  getGeneratedBlogArticleBySlug,
  getGeneratedBlogFaq,
  getGeneratedBlogPath,
  getGeneratedBlogWordCount,
} from '../content/blog';
import {
  FAQSection,
  PageFreshness,
  PremiumHero,
  ResourceCta,
} from '../components/PublicContent';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function GeneratedBlogArticle() {
  const { slug } = useParams();
  const article = getGeneratedBlogArticleBySlug(slug);

  if (!article) {
    return <Navigate to={GENERATED_BLOG_HUB_PATH} replace />;
  }

  const wordCount = getGeneratedBlogWordCount(article);

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title={article.metaTitle}
        description={article.metaDescription}
        canonicalPath={getGeneratedBlogPath(article.slug)}
        ogType="article"
      />
      <JsonLd id={`schema-generated-blog-${article.slug}`} schema={buildGeneratedBlogArticleSchema(article)} />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix={`generated-blog-${article.slug}`} />
        <PageShell width="1160px">
          <div className="public-content-page">
            <div className="public-content-breadcrumbs">
              <Link to="/">Home</Link>
              <span>/</span>
              <Link to={GENERATED_BLOG_HUB_PATH}>Content blog</Link>
              <span>/</span>
              <span>{article.title}</span>
            </div>

            <PageFreshness date={GENERATED_BLOG_UPDATED_AT} />

            <PremiumHero
              eyebrow={`${article.category} article`}
              title={article.title}
              description={article.summary}
              answerTitle="Article thesis"
              answer={`Prymal treats ${article.title.toLowerCase()} as part of an AI operating system for business execution: agents, memory, workflows, governance, and review working together.`}
              chips={[article.category, article.cluster, 'FAQ', 'Citations', 'Entities']}
              stats={[
                { label: 'Word count', value: `${wordCount}+` },
                { label: 'Citations', value: String(article.citations.length) },
                { label: 'Entities', value: String(article.entityReferences.length) },
              ]}
              primaryCta={<Link to="/signup" className="pm-btn pm-btn--primary">Start free</Link>}
              secondaryCta={<Link to={GENERATED_BLOG_HUB_PATH} className="pm-btn pm-btn--ghost">All articles</Link>}
              visual={(
                <div className="public-premium-summary-card">
                  <div className="public-section-block__eyebrow">Knowledge graph</div>
                  <strong>{article.cluster}</strong>
                  <p>{article.entityReferences.map((entity) => entity.name).join(' -> ')}</p>
                </div>
              )}
            />

            <GeneratedBlogArticleSections article={article} />
            <FAQSection title={`${article.title} FAQ`} items={getGeneratedBlogFaq(article)} />
            <GeneratedBlogCitations article={article} />
            <GeneratedBlogEntityReferences article={article} />
            <GeneratedBlogInternalLinks article={article} />

            <ResourceCta
              title="Turn the article into an operating workflow"
              description="Use the article as strategy, then map it to a use case, industry page, entity definition, or Prymal workflow."
              primary={<Link to="/use-cases" className="pm-btn pm-btn--primary">Use cases</Link>}
              secondary={<Link to="/what-is" className="pm-btn pm-btn--ghost">What Is hub</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix={`generated-blog-${article.slug}`} />
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import {
  GENERATED_BLOG_ARTICLES,
  buildGeneratedBlogSections,
  getGeneratedBlogPath,
  getRelatedGeneratedBlogArticles,
} from '../content/blog';
import {
  BulletList,
  LinkCardGrid,
  SectionBlock,
} from './PublicContent';

export function GeneratedBlogCard({ article }) {
  return (
    <Link to={getGeneratedBlogPath(article.slug)} className="public-link-card">
      <div className="public-section-block__eyebrow">{article.category}</div>
      <div className="public-link-card__title">{article.title}</div>
      <p>{article.summary}</p>
      <span>Read article -&gt;</span>
    </Link>
  );
}

export function GeneratedBlogGrid({ articles = GENERATED_BLOG_ARTICLES }) {
  return (
    <div className="public-link-grid">
      {articles.map((article) => (
        <GeneratedBlogCard key={article.slug} article={article} />
      ))}
    </div>
  );
}

export function GeneratedBlogArticleSections({ article }) {
  return (
    <>
      {buildGeneratedBlogSections(article).map((section) => (
        <SectionBlock key={section.title} eyebrow={section.eyebrow} title={section.title}>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="public-section-block__description">{paragraph}</p>
          ))}
          <BulletList items={section.bullets} />
        </SectionBlock>
      ))}
    </>
  );
}

export function GeneratedBlogCitations({ article }) {
  return (
    <SectionBlock eyebrow="Citations section" title={`${article.title} citations`}>
      <div className="public-link-grid public-link-grid--definitions">
        {article.citations.map((citation) => (
          <article
            key={citation.href}
            className="public-link-card public-definition-card"
            data-ai-citation="true"
            itemScope
            itemType="https://schema.org/CreativeWork"
          >
            <div className="public-section-block__eyebrow" itemProp="publisher">{citation.publisher}</div>
            <div className="public-link-card__title">
              <a href={citation.href} target="_blank" rel="noreferrer" itemProp="url">
                <span itemProp="name">{citation.title}</span>
              </a>
            </div>
            <p itemProp="description">{citation.note}</p>
            <span>Open reference -&gt;</span>
          </article>
        ))}
      </div>
    </SectionBlock>
  );
}

export function GeneratedBlogEntityReferences({ article }) {
  return (
    <SectionBlock eyebrow="Entity references" title={`${article.title} entity references`}>
      <div className="public-link-grid public-link-grid--definitions">
        {article.entityReferences.map((entity) => (
          <article
            key={entity.slug}
            className="public-link-card public-definition-card"
            data-ai-entity-reference="true"
            itemScope
            itemType="https://schema.org/DefinedTerm"
          >
            <div className="public-section-block__eyebrow">Entity</div>
            <div className="public-link-card__title">
              <Link to={entity.path} itemProp="url">
                <span itemProp="name">{entity.name}</span>
              </Link>
            </div>
            <p itemProp="description">{entity.name} is part of the Prymal AI operating system knowledge graph.</p>
            <span>Open entity -&gt;</span>
          </article>
        ))}
      </div>
    </SectionBlock>
  );
}

export function GeneratedBlogInternalLinks({ article }) {
  const related = getRelatedGeneratedBlogArticles(article);
  const items = [
    ...related.map((item) => ({
      title: item.title,
      to: getGeneratedBlogPath(item.slug),
      description: item.summary,
      cta: 'Read related ->',
    })),
    {
      title: 'What Is hub',
      to: '/what-is',
      description: 'Read foundational explainers for AI operating systems, agent orchestration, memory, governance, and workflows.',
      cta: 'Open hub ->',
    },
    {
      title: 'Use case library',
      to: '/use-cases',
      description: 'Turn blog strategy into practical AI workflow templates.',
      cta: 'Browse use cases ->',
    },
    {
      title: 'Entity graph',
      to: '/content/entities',
      description: 'Explore canonical Prymal entity relationships.',
      cta: 'Open graph ->',
    },
  ];

  return (
    <SectionBlock eyebrow="Internal links" title="Related reading and internal links">
      <LinkCardGrid items={items} surface={`generated-blog-${article.slug}`} />
    </SectionBlock>
  );
}

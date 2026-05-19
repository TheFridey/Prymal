import { Link, Navigate, useParams } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  FAQSection,
  LinkCardGrid,
  PublicHero,
  SectionBlock,
  BulletList,
  ResourceCta,
  buildArticleSchema,
  buildBreadcrumbSchema,
} from '../components/PublicContent';
import {
  BLOG_POSTS,
  getBlogPostBySlug,
  getComparisonPageBySlug,
  getFeaturePageBySlug,
} from '../lib/site-content';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function BlogPost() {
  const { slug } = useParams();
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const relatedItems = [
    ...(post.relatedFeatures ?? []).map((featureSlug) => {
      const feature = getFeaturePageBySlug(featureSlug);
      return feature
        ? {
            to: `/features/${feature.slug}`,
            title: feature.title,
            description: feature.answer,
          }
        : null;
    }),
    ...(post.relatedComparisons ?? []).map((compareSlug) => {
      const comparison = getComparisonPageBySlug(compareSlug);
      return comparison
        ? {
            to: `/compare/${comparison.slug}`,
            title: comparison.title,
            description: comparison.answer,
          }
        : null;
    }),
  ].filter(Boolean);

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title={post.metaTitle}
        description={post.metaDescription}
        canonicalPath={`/blog/${post.slug}`}
        ogType="article"
      />
      <JsonLd
        id={`schema-blog-post-${post.slug}`}
        schema={buildArticleSchema({
          headline: post.title,
          description: post.metaDescription,
          path: `/blog/${post.slug}`,
          datePublished: '2026-05-19',
          keywords: post.tags,
        })}
      />
      <JsonLd
        id={`schema-breadcrumbs-blog-${post.slug}`}
        schema={buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />
      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix={`blog-${post.slug}`} />
        <PageShell width="980px">
          <div className="public-content-page">
            <div className="public-content-breadcrumbs">
              <Link to="/">Home</Link>
              <span>/</span>
              <Link to="/blog">Blog</Link>
              <span>/</span>
              <span>{post.title}</span>
            </div>

            <PublicHero
              eyebrow={`Blog · ${post.category}`}
              title={post.title}
              description={post.intro}
              answerTitle="Short answer"
              answer={post.answer}
              primaryCta={<Link to="/pricing" className="pm-btn pm-btn--primary">Join early access</Link>}
              secondaryCta={<Link to="/features" className="pm-btn pm-btn--ghost">Explore features</Link>}
            />

            <div className="public-content-meta-strip">
              {post.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>

            <article className="public-content-richtext">
              {post.sections.map((section) => (
                <SectionBlock key={section.heading} title={section.heading}>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.bullets?.length ? <BulletList items={section.bullets} /> : null}
                </SectionBlock>
              ))}
            </article>

            <FAQSection
              title={`${post.title} FAQ`}
              items={post.faq}
              schemaId={`schema-blog-faq-${post.slug}`}
            />

            {relatedItems.length ? (
              <SectionBlock eyebrow="Keep going" title="Related reading and product pages">
                <LinkCardGrid items={relatedItems} />
              </SectionBlock>
            ) : null}

            <ResourceCta
              title="Want to apply this inside a real workspace?"
              description="Prymal is designed for teams that need AI to work from shared business context, current initiatives, and reviewable execution paths."
              primary={<Link to="/signup" className="pm-btn pm-btn--primary">Get early access</Link>}
              secondary={<Link to="/compare" className="pm-btn pm-btn--ghost">Compare categories</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix={`blog-${post.slug}`} />
      </div>
    </div>
  );
}

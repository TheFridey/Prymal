import { Fragment } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  FAQSection,
  ResourceCta,
  buildArticleSchema,
  buildBreadcrumbSchema,
} from '../components/PublicContent';
import { getBlogPostBySlug } from '../lib/blog-posts';
import { BLOG_AUTHOR, getBlogConversionConfig } from '../lib/blog-conversion';
import { BlogConversionStrip } from '../features/marketing/blog/BlogCta';
import { BlogFounderNote } from '../features/marketing/blog/BlogFounderNote';
import { BlogInternalLinks } from '../features/marketing/blog/BlogInternalLinks';
import { BlogLeadMagnet } from '../features/marketing/blog/BlogLeadMagnet';
import { BlogNextAction } from '../features/marketing/blog/BlogNextAction';
import { BlogRelatedReading } from '../features/marketing/blog/BlogRelatedReading';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

function slugifyHeading(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function BlogVisual({ hero, image, title }) {
  const palette = hero?.palette ?? ['#7CFFCB', '#4CC9F0', '#C77DFF'];
  const background = `linear-gradient(145deg, ${palette[0]}22 0%, ${palette[1]}33 42%, ${palette[2]}20 100%)`;

  return (
    <div className="public-blog-visual public-blog-visual--feature" style={{ background }}>
      {image ? (
        <img
          src={image}
          alt={`Editorial illustration for ${title}`}
          className="public-blog-visual__image"
        />
      ) : null}
      <div className="public-blog-visual__overlay" />
      <div className="public-blog-visual__glow" style={{ background: palette[0] }} />
      <div className="public-blog-visual__glow public-blog-visual__glow--secondary" style={{ background: palette[1] }} />
      <div className="public-blog-visual__content">
        <div className="public-blog-visual__eyebrow">{hero?.eyebrow}</div>
        <strong>{hero?.visualTitle}</strong>
        <p>{hero?.visualCaption}</p>
        <div className="public-blog-visual__chips">
          {(hero?.highlights ?? []).map((highlight) => (
            <span key={highlight}>{highlight}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResourceLinks({ title, items = [], external = false }) {
  if (!items.length) return null;

  return (
    <section className="public-blog-resource-panel">
      <div className="public-section-block__eyebrow">{external ? 'Outbound references' : 'Inbound reading'}</div>
      <h3>{title}</h3>
      <div className="public-blog-resource-grid">
        {items.map((item) =>
          external ? (
            <a
              key={item.href}
              href={item.href}
              className="public-link-card"
              target="_blank"
              rel="noreferrer"
            >
              <div className="public-link-card__title">{item.label}</div>
              <p>{item.description}</p>
              <span>Open reference -&gt;</span>
            </a>
          ) : (
            <Link key={item.to} to={item.to} className="public-link-card">
              <div className="public-link-card__title">{item.label}</div>
              <p>{item.description}</p>
              <span>Explore page -&gt;</span>
            </Link>
          ),
        )}
      </div>
    </section>
  );
}

export default function BlogPost() {
  const { slug } = useParams();
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const conversion = getBlogConversionConfig(post);

  const sectionAnchors = post.sections.map((section) => ({
    id: slugifyHeading(section.heading),
    title: section.heading,
  }));

  const insertIndex = Math.max(1, Math.floor(post.sections.length * 0.35));

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title={post.metaTitle}
        description={post.metaDescription}
        canonicalPath={`/blog/${post.slug}`}
        ogType="article"
        ogImage={post.ogImage}
        ogImageAlt={post.ogImageAlt}
      />
      <JsonLd
        id={`schema-blog-post-${post.slug}`}
        schema={buildArticleSchema({
          headline: post.title,
          description: post.metaDescription,
          path: `/blog/${post.slug}`,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          keywords: post.tags,
          image: post.ogImage ?? post.heroImage,
          wordCount: post.wordCount,
          authorName: BLOG_AUTHOR.name,
          authorType: 'Person',
          authorJobTitle: BLOG_AUTHOR.jobTitle,
          authorUrl: BLOG_AUTHOR.url,
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
        <PageShell width="1180px">
          <div className="public-content-page">
            <div className="public-content-breadcrumbs">
              <Link to="/">Home</Link>
              <span>/</span>
              <Link to="/blog">Blog</Link>
              <span>/</span>
              <span>{post.title}</span>
            </div>

            <header className="public-blog-post-hero">
              <div className="public-blog-post-hero__content">
                <div className="public-section-block__eyebrow">{post.category} guide</div>
                <h1>{post.title}</h1>
                <p>{post.intro}</p>
                <div className="public-blog-meta-row">
                  <span>{post.readingTimeMinutes} min read</span>
                  <span>{post.wordCount.toLocaleString()} words</span>
                  <span>Updated {post.updatedAt}</span>
                </div>
                <div className="public-blog-answer-card">
                  <div className="public-answer-block__eyebrow">Short answer</div>
                  <p>{post.answer}</p>
                </div>
                <BlogConversionStrip slug={post.slug} conversion={conversion} />
              </div>
              <BlogVisual hero={post.hero} image={post.heroImage} title={post.title} />
            </header>

            <div className="public-content-meta-strip">
              {post.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>

            <section className="public-blog-takeaway-strip">
              {post.takeaways.map((takeaway) => (
                <article key={takeaway}>
                  <strong>Takeaway</strong>
                  <p>{takeaway}</p>
                </article>
              ))}
            </section>

            <BlogInternalLinks post={post} />

            <div className="public-blog-layout">
              <aside className="public-blog-sidebar">
                <section className="public-blog-sidebar__panel">
                  <div className="public-section-block__eyebrow">On this page</div>
                  <h2>Article map</h2>
                  <nav className="public-blog-toc">
                    {sectionAnchors.map((section) => (
                      <a key={section.id} href={`#${section.id}`}>
                        {section.title}
                      </a>
                    ))}
                  </nav>
                </section>

                <section className="public-blog-sidebar__panel">
                  <div className="public-section-block__eyebrow">Prymal lens</div>
                  <h2>Why this matters inside the product</h2>
                  <p>{post.prymalLens}</p>
                </section>

                <BlogLeadMagnet slug={post.slug} />
                <ResourceLinks title="Relevant Prymal pages" items={post.inboundLinks} />
                <ResourceLinks title="Neutral external references" items={post.outboundLinks} external />
              </aside>

              <article className="public-blog-article">
                {post.sections.map((section, index) => (
                  <Fragment key={section.heading}>
                    <section className="public-blog-article__section" id={slugifyHeading(section.heading)}>
                      <h2>{section.heading}</h2>
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                      {section.bullets?.length ? (
                        <ul className="public-bullet-list">
                          {section.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      ) : null}
                    </section>
                    {index === insertIndex ? (
                      <div className="public-blog-inline-cta">
                        <div className="public-section-block__eyebrow">Apply this live</div>
                        <strong>Move from category understanding into a working Prymal workspace.</strong>
                        <p>Use the feature pages, workflow templates, and trust layer to translate this guide into repeatable execution.</p>
                        <BlogConversionStrip slug={post.slug} conversion={conversion} compact />
                      </div>
                    ) : null}
                  </Fragment>
                ))}
              </article>
            </div>

            <BlogFounderNote
              note={conversion.founderNote}
              publishedAt={post.publishedAt}
              updatedAt={post.updatedAt}
            />

            <FAQSection
              title={`${post.title} FAQ`}
              items={post.faq}
              schemaId={`schema-blog-faq-${post.slug}`}
            />

            <BlogRelatedReading post={post} />
            <BlogNextAction slug={post.slug} conversion={conversion} />

            <ResourceCta
              title="Want to apply this inside a real workspace?"
              description="Prymal is designed for teams that need AI to work from shared business context, current initiatives, and reviewable execution paths instead of isolated prompt sessions."
              primary={<BlogConversionStrip slug={post.slug} conversion={conversion} compact />}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix={`blog-${post.slug}`} />
      </div>
    </div>
  );
}

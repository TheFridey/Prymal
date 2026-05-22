import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  PremiumHero,
  ReadingPathGrid,
  ResourceCta,
  SearchFilterBar,
  SectionBlock,
  buildCollectionSchema,
} from '../components/PublicContent';
import { BLOG_POSTS, getBlogCategories, getBlogReadingPaths } from '../lib/blog-posts';
import { PUBLIC_OG_DEFAULTS } from '../lib/site-content';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

function BlogVisual({ hero, image, title, compact = false }) {
  const palette = hero?.palette ?? ['#7CFFCB', '#4CC9F0', '#C77DFF'];
  const background = `linear-gradient(145deg, ${palette[0]}22 0%, ${palette[1]}33 42%, ${palette[2]}20 100%)`;

  return (
    <div className={`public-blog-visual${compact ? ' public-blog-visual--compact' : ''}`} style={{ background }}>
      {image ? (
        <img
          src={image}
          alt={`Editorial illustration for ${title}`}
          className="public-blog-visual__image"
          loading={compact ? 'lazy' : 'eager'}
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

function BlogMetaRow({ post }) {
  return (
    <div className="public-blog-meta-row">
      <span>{post.category}</span>
      <span>{post.readingTimeMinutes} min read</span>
      <span>{post.wordCount.toLocaleString()} words</span>
      <span>{post.publishedAt}</span>
    </div>
  );
}

export default function Blog() {
  const categories = getBlogCategories();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const deferredSearch = useDeferredValue(search);
  const featuredPost = BLOG_POSTS.find((post) => post.featured) ?? BLOG_POSTS[0];

  const filteredPosts = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return BLOG_POSTS.filter((post) => {
      const categoryMatch = category === 'All' || post.category === category;
      const textBlob = [post.title, post.answer, post.category, ...(post.tags ?? [])].join(' ').toLowerCase();
      const queryMatch = !query || textBlob.includes(query);
      return categoryMatch && queryMatch;
    });
  }, [category, deferredSearch]);

  const otherPosts = filteredPosts.filter((post) => post.slug !== featuredPost.slug);

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title={PUBLIC_OG_DEFAULTS.blog.title}
        description={PUBLIC_OG_DEFAULTS.blog.description}
        canonicalPath="/blog"
        ogImage={PUBLIC_OG_DEFAULTS.blog.image}
        ogImageAlt={PUBLIC_OG_DEFAULTS.blog.imageAlt}
      />
      <JsonLd
        id="schema-blog"
        schema={buildCollectionSchema({
          name: 'Prymal blog',
          description: 'Detailed, answer-first articles on AI agents, business memory, workflows, trust, and business execution.',
          path: '/blog',
        })}
      />
      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="blog" />
        <PageShell width="1180px">
          <div className="public-content-page">
            <PremiumHero
              eyebrow="Editorial hub"
              title="Editorial guides for teams using AI to get real business work done"
              description="The Prymal blog is a long-form category and operating library: practical guides, buyer education, trust-first implementation advice, and business-memory thinking that goes beyond generic AI commentary."
              answerTitle="What is the Prymal blog for?"
              answer="The Prymal blog helps teams understand how coordinated agents, shared business memory, workflows, trust controls, and operator visibility turn AI into a usable business execution layer."
              chips={['Long-form guides', 'Answer-first structure', 'Workflow thinking', 'Trust-aware adoption']}
              stats={[
                { label: 'Guides live', value: String(BLOG_POSTS.length) },
                { label: 'Average depth', value: 'Long-form' },
                { label: 'Editorial posture', value: 'Business-ready' },
              ]}
              primaryCta={<Link to="/features" className="pm-btn pm-btn--primary">Explore features</Link>}
              secondaryCta={<Link to="/compare" className="pm-btn pm-btn--ghost">View comparisons</Link>}
              visual={<ReadingPathGrid items={getBlogReadingPaths()} className="public-reading-path-grid--hero" />}
            />

            <section className="public-blog-featured">
              <div className="public-blog-featured__content">
                <div className="public-section-block__eyebrow">Featured guide</div>
                <h2>{featuredPost.title}</h2>
                <p>{featuredPost.intro}</p>
                <BlogMetaRow post={featuredPost} />
                <div className="public-blog-takeaways">
                  {featuredPost.takeaways.slice(0, 3).map((takeaway) => (
                    <article key={takeaway}>
                      <strong>Key takeaway</strong>
                      <p>{takeaway}</p>
                    </article>
                  ))}
                </div>
                <div className="public-content-hero__actions">
                  <Link to={`/blog/${featuredPost.slug}`} className="pm-btn pm-btn--primary">
                    Read the featured guide
                  </Link>
                  <Link to="/trust" className="pm-btn pm-btn--ghost">
                    Trust and readiness
                  </Link>
                </div>
              </div>
              <BlogVisual hero={featuredPost.hero} image={featuredPost.heroImage} title={featuredPost.title} />
            </section>

            <SectionBlock
              eyebrow="Find the right guide"
              title="Search by category, title, or theme"
              description="Filter the editorial library by what you are trying to learn right now: category fit, trust, memory, workflow automation, or agency-scale delivery."
            >
              <SearchFilterBar
                searchValue={search}
                onSearchChange={setSearch}
                filterValue={category}
                onFilterChange={setCategory}
                filterLabel="Category"
                options={categories.map((entry) => ({ label: entry, value: entry }))}
              />

              <div className="public-blog-card-grid">
                {otherPosts.map((post) => (
                  <Link key={post.slug} to={`/blog/${post.slug}`} className="public-blog-card">
                    <BlogVisual hero={post.hero} image={post.heroImage} title={post.title} compact />
                    <div className="public-blog-card__body">
                      <BlogMetaRow post={post} />
                      <div className="public-blog-card__title">{post.title}</div>
                      <p>{post.answer}</p>
                      <div className="public-blog-callout">
                        <strong>Key takeaway</strong>
                        <p>{post.keyTakeaway}</p>
                      </div>
                      <div className="public-blog-card__tags">
                        {post.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                      <div className="public-blog-card__footer">
                        <span>Detailed guide</span>
                        <span>Read article -&gt;</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </SectionBlock>

            <ResourceCta
              title="Want the product angle as well?"
              description="The blog explains the category in depth. The feature and comparison pages show how Prymal applies the same ideas to memory, workflows, trust, and operator-ready execution."
              primary={<Link to="/features" className="pm-btn pm-btn--primary">Feature pages</Link>}
              secondary={<Link to="/pricing" className="pm-btn pm-btn--ghost">Pricing</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix="blog" />
      </div>
    </div>
  );
}

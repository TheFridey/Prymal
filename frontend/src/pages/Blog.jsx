import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  ResourceCta,
  SearchFilterBar,
  buildAuthorSchema,
  buildBlogSchema,
  buildCollectionSchema,
} from '../components/PublicContent';
import {
  BLOG_POSTS,
  getBlogTopicFilters,
  getFeaturedBlogPost,
  getPopularCommercialGuides,
} from '../lib/blog-posts';
import { BLOG_AUTHOR } from '../lib/blog-conversion';
import { PUBLIC_OG_DEFAULTS } from '../lib/site-content';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

function BlogVisual({ hero, image, title, compact = false }) {
  const palette = hero?.palette ?? ['#7CFFCB', '#4CC9F0', '#C77DFF'];
  const background = `linear-gradient(145deg, ${palette[0]}18 0%, ${palette[1]}22 42%, ${palette[2]}14 100%)`;

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
      <div className="public-blog-visual__content">
        <div className="public-blog-visual__eyebrow">{hero?.eyebrow}</div>
        <strong>{hero?.visualTitle}</strong>
        <p>{hero?.visualCaption}</p>
      </div>
    </div>
  );
}

function BlogMetaRow({ post }) {
  return (
    <div className="public-blog-meta-row">
      <span>{post.category}</span>
      <span>{post.readingTimeMinutes} min read</span>
      <span>{post.publishedAt}</span>
    </div>
  );
}

function postMatchesBlogFilters(post, topic, query) {
  const topicMatch =
    topic === 'all' || (post.topics ?? []).includes(topic) || post.category.toLowerCase().includes(topic);
  const textBlob = [post.title, post.answer, post.category, ...(post.tags ?? []), ...(post.topics ?? [])]
    .join(' ')
    .toLowerCase();
  const queryMatch = !query || textBlob.includes(query);
  return topicMatch && queryMatch;
}

export default function Blog() {
  const topicFilters = getBlogTopicFilters();
  const featuredPost = getFeaturedBlogPost();
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('all');
  const deferredSearch = useDeferredValue(search);
  const query = deferredSearch.trim().toLowerCase();

  const filteredPosts = useMemo(
    () => BLOG_POSTS.filter((post) => postMatchesBlogFilters(post, topic, query)),
    [topic, query],
  );

  const popularGuides = useMemo(
    () => getPopularCommercialGuides().filter((post) => postMatchesBlogFilters(post, topic, query)),
    [topic, query],
  );

  const gridPosts = filteredPosts.filter((post) => post.slug !== featuredPost.slug);

  return (
    <div className="marketing-page prymal-marketing pm-page public-blog-hub">
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
      <JsonLd
        id="schema-blog-entity"
        schema={buildBlogSchema({
          description: 'Detailed, answer-first articles on AI agents, business memory, workflows, trust, and business execution.',
          posts: BLOG_POSTS,
        })}
      />
      <JsonLd
        id="schema-blog-author"
        schema={buildAuthorSchema({
          name: BLOG_AUTHOR.name,
          jobTitle: BLOG_AUTHOR.jobTitle,
          url: BLOG_AUTHOR.url,
          affiliation: BLOG_AUTHOR.affiliation,
        })}
      />
      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="blog" />
        <PageShell width="1180px">
          <div className="public-content-page">
            <header className="public-blog-hub-hero">
              <p className="public-section-block__eyebrow">Prymal blog</p>
              <h1>Guides for teams turning AI into repeatable business work</h1>
              <p>
                Practical buying guides, workflow playbooks, and trust-first implementation advice — without generic
                AI hype or provider gossip.
              </p>
              <div className="public-blog-hub-hero__stats">
                <span>{BLOG_POSTS.length} guides live</span>
                <span>Answer-first structure</span>
                <span>Business-ready tone</span>
              </div>
            </header>

            <div className="public-blog-hub-toolbar">
              <div className="public-blog-topics" role="toolbar" aria-label="Filter guides by topic">
                {topicFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className="public-blog-topics__pill"
                    aria-pressed={topic === filter.id}
                    onClick={() => setTopic(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <SearchFilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search guides" />
            </div>

            <section className="public-blog-featured public-blog-featured--hub">
              <div className="public-blog-featured__content">
                <div className="public-section-block__eyebrow">Featured guide</div>
                <h2>{featuredPost.title}</h2>
                <p>{featuredPost.answer}</p>
                <BlogMetaRow post={featuredPost} />
                <div className="public-content-hero__actions">
                  <Link to={`/blog/${featuredPost.slug}`} className="pm-btn pm-btn--primary">
                    Read guide
                  </Link>
                </div>
              </div>
              <BlogVisual hero={featuredPost.hero} image={featuredPost.heroImage} title={featuredPost.title} />
            </section>

            <section className="public-blog-hub-grid-section">
              <div className="public-blog-hub-grid-section__head">
                <h2>All guides</h2>
                <p>{gridPosts.length} guides match your filters</p>
              </div>
              <div className="public-blog-card-grid public-blog-card-grid--hub">
                {gridPosts.map((post) => (
                  <Link key={post.slug} to={`/blog/${post.slug}`} className="public-blog-card public-blog-card--hub">
                    <BlogVisual hero={post.hero} image={post.heroImage} title={post.title} compact />
                    <div className="public-blog-card__body">
                      <BlogMetaRow post={post} />
                      <div className="public-blog-card__title">{post.title}</div>
                      <p>{post.answer}</p>
                      <div className="public-blog-card__footer">
                        <span>{post.readingTimeMinutes} min read</span>
                        <span>Read guide -&gt;</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="public-blog-commercial">
              <div className="public-blog-commercial__head">
                <h2>Popular guides for growing teams</h2>
                <p>Agency delivery, service-business automation, workflows, and fair comparison guides.</p>
              </div>
              <div className="public-blog-commercial__grid">
                {popularGuides.map((post) => (
                  <Link key={post.slug} to={`/blog/${post.slug}`} className="public-blog-commercial__card">
                    <span className="public-blog-commercial__category">{post.category}</span>
                    <strong>{post.title}</strong>
                    <p>{post.answer}</p>
                    <span className="public-blog-commercial__meta">{post.readingTimeMinutes} min read</span>
                  </Link>
                ))}
              </div>
            </section>

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

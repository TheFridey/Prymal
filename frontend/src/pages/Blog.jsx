import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { BLOG_POSTS } from '../lib/blog-posts';
import { PublicHero, ResourceCta, SectionBlock, buildCollectionSchema } from '../components/PublicContent';
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
  const [featuredPost, ...otherPosts] = BLOG_POSTS;

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title="Blog - Prymal"
        description="Detailed guides on AI operating systems, business memory, AI agents, workflow automation, trust, and business-ready execution."
        canonicalPath="/blog"
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
        <PageShell width="1120px">
          <div className="public-content-page">
            <PublicHero
              eyebrow="Prymal blog"
              title="Editorial guides for teams using AI to get real business work done"
              description="The Prymal blog is now built as a long-form knowledge library: detailed category education, buyer guidance, trust-first implementation advice, and practical operating-system thinking for serious teams."
              answerTitle="What is the Prymal blog for?"
              answer="The Prymal blog helps teams understand how coordinated agents, shared business memory, workflows, trust controls, and operator visibility turn AI into a usable business execution layer."
              primaryCta={<Link to="/features" className="pm-btn pm-btn--primary">Explore features</Link>}
              secondaryCta={<Link to="/compare" className="pm-btn pm-btn--ghost">View comparisons</Link>}
            />

            <section className="public-blog-featured">
              <div className="public-blog-featured__content">
                <div className="public-section-block__eyebrow">Featured guide</div>
                <h2>{featuredPost.title}</h2>
                <p>{featuredPost.intro}</p>
                <BlogMetaRow post={featuredPost} />
                <div className="public-blog-takeaways">
                  {featuredPost.takeaways.map((takeaway) => (
                    <article key={takeaway}>
                      <strong>Key takeaway</strong>
                      <p>{takeaway}</p>
                    </article>
                  ))}
                </div>
                <div className="public-content-hero__actions">
                  <Link to={`/blog/${featuredPost.slug}`} className="pm-btn pm-btn--primary">
                    Read the full guide
                  </Link>
                  <Link to="/trust" className="pm-btn pm-btn--ghost">
                    Trust and readiness
                  </Link>
                </div>
              </div>
              <BlogVisual hero={featuredPost.hero} image={featuredPost.heroImage} title={featuredPost.title} />
            </section>

            <SectionBlock
              eyebrow="Library"
              title="Browse detailed business AI guides"
              description="Every article is structured for deeper reading with answer-first summaries, richer sections, internal product links, and neutral outbound references."
            >
              <div className="public-blog-card-grid">
                {otherPosts.map((post) => (
                  <Link key={post.slug} to={`/blog/${post.slug}`} className="public-blog-card">
                    <BlogVisual hero={post.hero} image={post.heroImage} title={post.title} compact />
                    <div className="public-blog-card__body">
                      <BlogMetaRow post={post} />
                      <div className="public-blog-card__title">{post.title}</div>
                      <p>{post.answer}</p>
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

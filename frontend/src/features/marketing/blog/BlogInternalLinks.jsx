import { PublicCtaLink } from '../../../components/PublicCta';
import { getBlogInternalLinkModules } from '../../../lib/blog-conversion';

const GROUP_LABELS = {
  feature: 'Feature pages',
  compare: 'Comparison pages',
  blog: 'Related guides',
};

function LinkGroup({ slug, kind, items }) {
  if (!items.length) return null;

  return (
    <section className="public-blog-internal-links__group">
      <h3>{GROUP_LABELS[kind] ?? 'Related pages'}</h3>
      <div className="public-blog-internal-links__grid">
        {items.map((item) => (
          <PublicCtaLink
            key={item.to}
            to={item.to}
            cta={`internal-${kind}`}
            surface={`blog-${slug}-internal-${kind}`}
            intent="learn"
            className="public-link-card"
          >
            <div className="public-link-card__title">{item.title ?? item.label}</div>
            <p>{item.description}</p>
            <span>Explore page -&gt;</span>
          </PublicCtaLink>
        ))}
      </div>
    </section>
  );
}

export function BlogInternalLinks({ post }) {
  const modules = getBlogInternalLinkModules(post);
  const featureItems = modules.features.length
    ? modules.features
    : modules.inbound.filter((item) => item.kind === 'feature').slice(0, 3);
  const comparisonItems = modules.comparisons.length
    ? modules.comparisons
    : modules.inbound.filter((item) => item.kind === 'compare').slice(0, 2);

  if (!featureItems.length && !comparisonItems.length && !modules.blogs.length) {
    return null;
  }

  return (
    <section className="public-blog-internal-links" aria-labelledby="blog-internal-links-heading">
      <div className="public-section-block__eyebrow">Internal reading paths</div>
      <h2 id="blog-internal-links-heading">Connect this guide to Prymal product pages</h2>
      <p className="public-blog-internal-links__lede">
        Move from category education into feature depth, fair comparisons, and the next long-form guide.
      </p>
      <LinkGroup slug={post.slug} kind="feature" items={featureItems} />
      <LinkGroup slug={post.slug} kind="compare" items={comparisonItems} />
      <LinkGroup slug={post.slug} kind="blog" items={modules.blogs} />
    </section>
  );
}

import { LinkCardGrid } from '../../../components/PublicContent';
import { getBlogInternalLinkModules, getBlogRelatedPosts } from '../../../lib/blog-conversion';

export function BlogRelatedReading({ post }) {
  const relatedPosts = getBlogRelatedPosts(post, 3);
  const modules = getBlogInternalLinkModules(post);

  const productItems = [
    ...modules.features.slice(0, 2).map((item) => ({
      to: item.to,
      title: item.title,
      description: item.description,
      cta: 'Open feature ->',
    })),
    ...modules.comparisons.slice(0, 1).map((item) => ({
      to: item.to,
      title: item.title,
      description: item.description,
      cta: 'Open comparison ->',
    })),
  ];

  return (
    <>
      {relatedPosts.length ? (
        <section className="public-blog-resource-panel">
          <div className="public-section-block__eyebrow">Related reading</div>
          <h2>More guides from the Prymal blog</h2>
          <LinkCardGrid items={relatedPosts} surface={`blog-${post.slug}-related-reading`} />
        </section>
      ) : null}

      {productItems.length ? (
        <section className="public-blog-resource-panel">
          <div className="public-section-block__eyebrow">Related reading</div>
          <h2>Product pages that match this topic</h2>
          <LinkCardGrid items={productItems} surface={`blog-${post.slug}-related-product`} />
        </section>
      ) : null}
    </>
  );
}

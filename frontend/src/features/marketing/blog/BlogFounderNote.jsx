import { BLOG_AUTHOR } from '../../../lib/blog-conversion';

export function BlogFounderNote({ note, publishedAt, updatedAt }) {
  const content = note ?? {};

  return (
    <section className="public-blog-founder-note" aria-labelledby="blog-founder-note-heading">
      <div className="public-blog-founder-note__meta">
        <span className="public-section-block__eyebrow">{content.eyebrow ?? 'Founder note'}</span>
        <div className="public-blog-founder-note__author">
          <strong>{BLOG_AUTHOR.name}</strong>
          <span>{BLOG_AUTHOR.jobTitle}</span>
        </div>
      </div>
      <h2 id="blog-founder-note-heading">{content.title ?? 'Why we publish these guides'}</h2>
      <p>{content.body}</p>
      <div className="public-blog-founder-note__dates">
        <span>Published {publishedAt}</span>
        <span>Updated {updatedAt}</span>
      </div>
    </section>
  );
}

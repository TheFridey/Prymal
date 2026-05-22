import {
  BlogBetaAccessCta,
  BlogFeatureCta,
  BlogPricingCta,
  BlogWorkflowTemplateCta,
} from './BlogCta';

export function BlogNextAction({ slug, conversion }) {
  const { nextAction, primaryFeature, workflowTemplate } = conversion;

  return (
    <section className="public-blog-next-action" aria-labelledby="blog-next-action-heading">
      <div className="public-section-block__eyebrow">Next action</div>
      <h2 id="blog-next-action-heading">{nextAction.title}</h2>
      <p>{nextAction.description}</p>
      <div className="public-content-hero__actions">
        {nextAction.primary === 'pricing' ? (
          <BlogPricingCta slug={slug} className="pm-btn pm-btn--primary" label="Review pricing" />
        ) : null}
        {nextAction.primary === 'feature' ? (
          <BlogFeatureCta
            slug={slug}
            feature={primaryFeature}
            className="pm-btn pm-btn--primary"
            label={primaryFeature ? `Open ${primaryFeature.title}` : 'Explore features'}
          />
        ) : null}
        {nextAction.primary === 'workflow' ? (
          <BlogWorkflowTemplateCta
            slug={slug}
            template={workflowTemplate}
            className="pm-btn pm-btn--primary"
          />
        ) : null}
        {nextAction.primary === 'beta' || !nextAction.primary ? (
          <BlogBetaAccessCta slug={slug} className="pm-btn pm-btn--primary" />
        ) : null}
        <BlogPricingCta slug={slug} />
        {nextAction.primary !== 'workflow' ? (
          <BlogWorkflowTemplateCta slug={slug} template={workflowTemplate} />
        ) : null}
        {nextAction.primary !== 'feature' ? (
          <BlogFeatureCta slug={slug} feature={primaryFeature} />
        ) : null}
      </div>
    </section>
  );
}

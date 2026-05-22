import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { PublicCtaLink } from '../../../components/PublicCta';

function blogSurface(slug, slot) {
  return slug ? `blog-${slug}-${slot}` : `blog-${slot}`;
}

export function BlogBetaAccessCta({ slug, className = 'pm-btn pm-btn--primary', label = 'Get early access' }) {
  return (
    <>
      <SignedOut>
        <PublicCtaLink
          to="/signup"
          cta="beta-access"
          surface={blogSurface(slug, 'beta')}
          intent="convert"
          className={className}
        >
          {label}
        </PublicCtaLink>
      </SignedOut>
      <SignedIn>
        <PublicCtaLink
          to="/app/dashboard"
          cta="open-workspace"
          surface={blogSurface(slug, 'beta-signed-in')}
          intent="retain"
          className={className}
        >
          Open workspace
        </PublicCtaLink>
      </SignedIn>
    </>
  );
}

export function BlogPricingCta({ slug, className = 'pm-btn pm-btn--ghost', label = 'See pricing' }) {
  return (
    <PublicCtaLink
      to="/pricing"
      cta="pricing"
      surface={blogSurface(slug, 'pricing')}
      intent="learn"
      className={className}
    >
      {label}
    </PublicCtaLink>
  );
}

export function BlogFeatureCta({ slug, feature, className = 'pm-btn pm-btn--ghost', label }) {
  if (!feature) return null;

  return (
    <PublicCtaLink
      to={`/features/${feature.slug}`}
      cta="feature"
      surface={blogSurface(slug, `feature-${feature.slug}`)}
      intent="learn"
      className={className}
    >
      {label ?? `Explore ${feature.title}`}
    </PublicCtaLink>
  );
}

export function BlogWorkflowTemplateCta({
  slug,
  template,
  className = 'pm-btn pm-btn--ghost',
  label,
}) {
  if (!template) return null;

  return (
    <>
      <SignedOut>
        <PublicCtaLink
          to="/signup"
          cta="workflow-template"
          surface={blogSurface(slug, `workflow-${template.slug}`)}
          intent="convert"
          className={className}
        >
          {label ?? `Start ${template.name}`}
        </PublicCtaLink>
      </SignedOut>
      <SignedIn>
        <PublicCtaLink
          to={`/app/workflows?view=builder&template=${encodeURIComponent(template.slug)}`}
          cta="workflow-template"
          surface={blogSurface(slug, `workflow-${template.slug}`)}
          intent="retain"
          className={className}
        >
          {label ?? `Open ${template.name}`}
        </PublicCtaLink>
      </SignedIn>
    </>
  );
}

export function BlogConversionStrip({ slug, conversion, compact = false }) {
  const { primaryFeature, workflowTemplate } = conversion;

  return (
    <div className={`public-blog-cta-strip${compact ? ' public-blog-cta-strip--compact' : ''}`}>
      <BlogBetaAccessCta slug={slug} />
      <BlogPricingCta slug={slug} />
      <BlogFeatureCta slug={slug} feature={primaryFeature} />
      <BlogWorkflowTemplateCta slug={slug} template={workflowTemplate} />
    </div>
  );
}

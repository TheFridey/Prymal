import { Link } from 'react-router-dom';
import {
  GENERATED_COMPARISON_PAGES,
  getGeneratedComparisonPath,
} from '../content/comparisons';
import {
  BulletList,
  LinkCardGrid,
  SectionBlock,
} from './PublicContent';

export function GeneratedComparisonCard({ page }) {
  return (
    <Link to={getGeneratedComparisonPath(page.slug)} className="public-link-card">
      <div className="public-section-block__eyebrow">{page.category}</div>
      <div className="public-link-card__title">{page.title}</div>
      <p>{page.answer}</p>
      <span>Read comparison -&gt;</span>
    </Link>
  );
}

export function GeneratedComparisonCardGrid({ pages = GENERATED_COMPARISON_PAGES }) {
  return (
    <div className="public-link-grid">
      {pages.map((page) => (
        <GeneratedComparisonCard key={page.slug} page={page} />
      ))}
    </div>
  );
}

export function GeneratedFeatureComparison({ page }) {
  return (
    <SectionBlock eyebrow="Feature comparison" title={`${page.title}: feature comparison`}>
      <div className="public-comparison-matrix" role="table" aria-label={`${page.title} feature comparison`}>
        <div className="public-comparison-matrix__header" role="rowgroup">
          <div role="row" className="public-comparison-matrix__row public-comparison-matrix__row--header">
            <span role="columnheader">Feature area</span>
            <span role="columnheader">Prymal</span>
            <span role="columnheader">{page.alternative}</span>
          </div>
        </div>
        <div role="rowgroup">
          {page.featureRows.map((row) => (
            <div key={row.label} role="row" className="public-comparison-matrix__row">
              <strong role="rowheader">{row.label}</strong>
              <span>{row.prymal}</span>
              <span>{row.alternative}</span>
            </div>
          ))}
        </div>
      </div>
    </SectionBlock>
  );
}

export function GeneratedPricingComparison({ page }) {
  return (
    <SectionBlock
      eyebrow="Pricing comparison"
      title={`${page.title}: pricing comparison`}
      description="Pricing changes often. Treat the linked official pricing page as the source of truth before making a buying decision."
    >
      <div className="public-comparison-matrix" role="table" aria-label={`${page.title} pricing comparison`}>
        <div className="public-comparison-matrix__header" role="rowgroup">
          <div role="row" className="public-comparison-matrix__row public-comparison-matrix__row--header">
            <span role="columnheader">Pricing area</span>
            <span role="columnheader">Prymal</span>
            <span role="columnheader">{page.alternative}</span>
          </div>
        </div>
        <div role="rowgroup">
          {page.pricingRows.map((row) => (
            <div key={row.label} role="row" className="public-comparison-matrix__row">
              <strong role="rowheader">{row.label}</strong>
              <span>{row.prymal}</span>
              <span>
                {row.alternative}{' '}
                {row.sourceUrl ? (
                  <a href={row.sourceUrl} target="_blank" rel="noreferrer">
                    Source
                  </a>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SectionBlock>
  );
}

export function GeneratedProsCons({ page }) {
  return (
    <SectionBlock eyebrow="Pros and cons" title={`${page.title}: pros and cons`}>
      <div className="public-before-after">
        <article className="public-before-after__card public-before-after__card--accent">
          <div className="public-section-block__eyebrow">Prymal pros</div>
          <h3>Where Prymal is stronger</h3>
          <BulletList items={page.prymalPros} />
        </article>
        <article className="public-before-after__card">
          <div className="public-section-block__eyebrow">Prymal cons</div>
          <h3>Where Prymal may be less ideal</h3>
          <BulletList items={page.prymalCons} />
        </article>
        <article className="public-before-after__card public-before-after__card--accent">
          <div className="public-section-block__eyebrow">{page.alternative} pros</div>
          <h3>Where {page.alternative} is stronger</h3>
          <BulletList items={page.alternativePros} />
        </article>
        <article className="public-before-after__card">
          <div className="public-section-block__eyebrow">{page.alternative} cons</div>
          <h3>Where {page.alternative} may be less ideal</h3>
          <BulletList items={page.alternativeCons} />
        </article>
      </div>
    </SectionBlock>
  );
}

export function GeneratedIdealCustomer({ page }) {
  return (
    <SectionBlock eyebrow="Ideal customer" title={`${page.title}: ideal customer`}>
      <div className="public-before-after">
        <article className="public-before-after__card public-before-after__card--accent">
          <div className="public-section-block__eyebrow">Prymal</div>
          <h3>Best fit</h3>
          <p>{page.idealPrymalCustomer}</p>
        </article>
        <article className="public-before-after__card">
          <div className="public-section-block__eyebrow">{page.alternative}</div>
          <h3>Best fit</h3>
          <p>{page.idealAlternativeCustomer}</p>
        </article>
      </div>
    </SectionBlock>
  );
}

export function GeneratedComparisonInternalLinks({ page }) {
  const items = [
    ...page.relatedLinks,
    {
      title: 'Pricing',
      to: '/pricing',
      description: 'Check current Prymal pricing, plan scope, and credit information.',
      cta: 'View pricing ->',
    },
    {
      title: 'Comparison hub',
      to: '/compare',
      description: 'Browse all Prymal comparison pages and category-fit guides.',
      cta: 'All comparisons ->',
    },
  ];

  return (
    <SectionBlock eyebrow="Internal links" title="Related comparison and buyer pages">
      <LinkCardGrid items={items} surface={`generated-compare-${page.slug}`} />
    </SectionBlock>
  );
}

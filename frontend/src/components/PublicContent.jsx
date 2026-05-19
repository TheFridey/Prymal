import { Link } from 'react-router-dom';
import { JsonLd } from './PublicPageChrome';

export function buildFaqPageSchema(items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function buildBreadcrumbSchema(items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `https://prymal.io${item.path}`,
    })),
  };
}

export function buildArticleSchema({
  headline,
  description,
  path,
  datePublished,
  dateModified,
  keywords = [],
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    datePublished,
    dateModified: dateModified ?? datePublished,
    mainEntityOfPage: `https://prymal.io${path}`,
    author: {
      '@type': 'Organization',
      name: 'Prymal',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Prymal',
    },
    keywords: keywords.join(', '),
  };
}

export function buildCollectionSchema({ name, description, path }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: `https://prymal.io${path}`,
  };
}

export function AnswerBlock({ title = 'Quick answer', answer }) {
  return (
    <section className="public-answer-block" aria-label={title}>
      <div className="public-answer-block__eyebrow">Answer first</div>
      <h2>{title}</h2>
      <p>{answer}</p>
    </section>
  );
}

export function PublicHero({
  eyebrow,
  title,
  description,
  answer,
  answerTitle,
  primaryCta,
  secondaryCta,
}) {
  return (
    <header className="public-content-hero">
      {eyebrow ? <div className="public-content-hero__eyebrow">{eyebrow}</div> : null}
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="public-content-hero__actions">
        {primaryCta}
        {secondaryCta}
      </div>
      {answer ? <AnswerBlock title={answerTitle} answer={answer} /> : null}
    </header>
  );
}

export function SectionBlock({ eyebrow, title, description, children }) {
  return (
    <section className="public-section-block">
      {eyebrow ? <div className="public-section-block__eyebrow">{eyebrow}</div> : null}
      {title ? <h2>{title}</h2> : null}
      {description ? <p className="public-section-block__description">{description}</p> : null}
      {children}
    </section>
  );
}

export function BulletList({ items = [] }) {
  return (
    <ul className="public-bullet-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function LinkCardGrid({ items = [] }) {
  return (
    <div className="public-link-grid">
      {items.map((item) => (
        <Link key={item.to} to={item.to} className="public-link-card">
          <div className="public-link-card__title">{item.title}</div>
          <p>{item.description}</p>
          <span>{item.cta ?? 'Read more ->'}</span>
        </Link>
      ))}
    </div>
  );
}

export function FAQSection({ title = 'Frequently asked questions', items = [], schemaId }) {
  if (!items.length) return null;

  return (
    <section className="public-faq-section">
      {schemaId ? <JsonLd id={schemaId} schema={buildFaqPageSchema(items)} /> : null}
      <div className="public-section-block__eyebrow">FAQ</div>
      <h2>{title}</h2>
      <div className="public-faq-section__items">
        {items.map((item) => (
          <article key={item.question} className="public-faq-item">
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ResourceCta({ title, description, primary, secondary }) {
  return (
    <section className="public-resource-cta">
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="public-content-hero__actions">
        {primary}
        {secondary}
      </div>
    </section>
  );
}

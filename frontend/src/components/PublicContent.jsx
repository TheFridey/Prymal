import { Link } from 'react-router-dom';
import { JsonLd } from './PublicPageChrome';
import { PublicCtaLink } from './PublicCta';
import {
  buildArticleSchema,
  buildAuthorSchema,
  buildBlogSchema,
  buildBreadcrumbSchema,
  buildCollectionSchema,
  buildFaqPageSchema,
} from '../lib/seo';
import { MotionCard, MotionList, MotionListItem, MotionPanel } from './motion';

export {
  buildArticleSchema,
  buildAuthorSchema,
  buildBlogSchema,
  buildBreadcrumbSchema,
  buildCollectionSchema,
  buildFaqPageSchema,
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function aiSlug(value = 'section') {
  return String(value || 'section')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section';
}

function sectionChunkId(title, eyebrow) {
  return aiSlug(`${eyebrow || ''} ${title || 'section'}`);
}

/** Format an ISO `YYYY-MM-DD` (or any Date-parseable) value as "Month YYYY". */
export function formatFreshness(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Visible page freshness signal, e.g. "Last updated: June 2026". */
export function PageFreshness({ date, prefix = 'Last updated' }) {
  const label = formatFreshness(date);
  if (!label) return null;
  return (
    <p className="public-content-freshness" style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '0 0 4px' }}>
      {prefix}: <time dateTime={String(date)}>{label}</time>
    </p>
  );
}

/**
 * Standardised entity definition so every public page states what Prymal is
 * within its first ~200 words — reinforcing the "AI operating system for
 * business execution" entity for search and AI answer engines.
 */
export function EntityDefinition({ lead }) {
  return (
    <p className="public-entity-definition" style={{ color: 'var(--muted)', lineHeight: 1.7, margin: '0 0 18px', maxWidth: '70ch' }}>
      <strong>Prymal is an AI operating system for business execution</strong>
      {' '}— specialist agents, shared business memory (LORE), workflow automation (NEXUS), and trust
      controls (WARDEN and SENTINEL) in one coordinated workspace.{lead ? ` ${lead}` : ''}
    </p>
  );
}

/**
 * Contextual internal links to build topic clusters. Accepts the link shape
 * used across the site ({ to, title, description, cta }) — e.g. the entries in
 * SEO_RELATED_LINKS — and renders a labelled grid (not footer-only links).
 */
export function RelatedResources({
  title = 'Continue exploring Prymal',
  eyebrow = 'Related',
  items = [],
  surface = 'related-resources',
}) {
  if (!items.length) return null;
  return (
    <SectionBlock eyebrow={eyebrow} title={title}>
      <LinkCardGrid items={items} surface={surface} />
    </SectionBlock>
  );
}

export function AnswerBlock({ title = 'Quick answer', answer }) {
  return (
    <section
      className="public-answer-block"
      aria-label={title}
      data-ai-section="answer"
      data-ai-chunk="answer-summary"
      data-answer-extract="true"
      itemScope
      itemType="https://schema.org/Question"
    >
      <div className="public-answer-block__eyebrow">Answer first</div>
      <h2 itemProp="name">{title}</h2>
      <div itemProp="acceptedAnswer" itemScope itemType="https://schema.org/Answer">
        <p itemProp="text">{answer}</p>
      </div>
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
    <header
      className="public-content-hero"
      data-ai-section="hero"
      data-ai-chunk="hero-introduction"
      data-answer-extract={answer ? 'true' : undefined}
    >
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
  const chunkId = sectionChunkId(title, eyebrow);
  const titleId = title ? `${chunkId}-title` : undefined;

  return (
    <section
      id={chunkId}
      className="public-section-block"
      aria-labelledby={titleId}
      data-ai-section={aiSlug(eyebrow || title || 'section')}
      data-ai-chunk={chunkId}
      data-retrieval-section="true"
    >
      {eyebrow ? <div className="public-section-block__eyebrow">{eyebrow}</div> : null}
      {title ? <h2 id={titleId}>{title}</h2> : null}
      {description ? <p className="public-section-block__description">{description}</p> : null}
      {children}
    </section>
  );
}

export function BulletList({ items = [] }) {
  return (
    <ul className="public-bullet-list" data-ai-list="true" data-ai-chunk="bullet-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function LinkCardGrid({ items = [], surface = 'content-hub' }) {
  return (
    <div
      className="public-link-grid"
      data-ai-section="internal-links"
      data-ai-chunk={sectionChunkId(surface, 'links')}
      data-internal-link-surface={surface}
    >
      {items.map((item) => (
        <PublicCtaLink
          key={item.to}
          to={item.to}
          cta={item.cta ?? 'explore'}
          surface={surface}
          intent="learn"
          className="public-link-card"
        >
          <div className="public-link-card__title">{item.title}</div>
          <p>{item.description}</p>
          <span>{item.cta ?? 'Read more ->'}</span>
        </PublicCtaLink>
      ))}
    </div>
  );
}

export function RelatedPages(props) {
  return <LinkCardGrid {...props} />;
}

export function FAQSection({ title = 'Frequently asked questions', items = [], schemaId }) {
  if (!items.length) return null;

  return (
    <section
      className="public-faq-section"
      data-ai-section="faq"
      data-ai-chunk="faq"
      data-ai-faq="true"
    >
      {schemaId ? <JsonLd id={schemaId} schema={buildFaqPageSchema(items)} /> : null}
      <div className="public-section-block__eyebrow">FAQ</div>
      <h2>{title}</h2>
      <div className="public-faq-section__items">
        {items.map((item) => (
          <article
            key={item.question}
            className="public-faq-item"
            data-ai-faq-item="true"
            itemScope
            itemType="https://schema.org/Question"
          >
            <h3 itemProp="name">{item.question}</h3>
            <div itemProp="acceptedAnswer" itemScope itemType="https://schema.org/Answer">
              <p itemProp="text">{item.answer}</p>
            </div>
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

export const ContentCTA = ResourceCta;

export function PremiumHero({
  eyebrow,
  title,
  description,
  answerTitle,
  answer,
  primaryCta,
  secondaryCta,
  chips = [],
  stats = [],
  visual,
}) {
  return (
    <section
      className="public-premium-hero"
      data-ai-section="hero"
      data-ai-chunk="hero-introduction"
      data-answer-extract={answer ? 'true' : undefined}
    >
      <div className="public-premium-hero__ambient" aria-hidden="true">
        <span className="public-premium-hero__orb public-premium-hero__orb--one" />
        <span className="public-premium-hero__orb public-premium-hero__orb--two" />
        <span className="public-premium-hero__grid" />
      </div>
      <div className="public-premium-hero__content" data-ai-summary="true">
        {eyebrow ? <div className="public-content-hero__eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        <p>{description}</p>
        {chips.length ? (
          <div className="public-content-meta-strip">
            {chips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
        ) : null}
        <div className="public-content-hero__actions">
          {primaryCta}
          {secondaryCta}
        </div>
        {answer ? <AnswerBlock title={answerTitle} answer={answer} /> : null}
        {stats.length ? (
          <div className="public-premium-hero__stats">
            {stats.map((stat) => (
              <article key={stat.label} className="public-premium-stat">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </article>
            ))}
          </div>
        ) : null}
      </div>
      <div className="public-premium-hero__visual">
        {visual}
      </div>
    </section>
  );
}

export function SEOHero(props) {
  return <PremiumHero {...props} />;
}

export function SystemDiagram({ title = 'Operating map', nodes = [], links = [], className = '' }) {
  return (
    <MotionPanel className={`public-system-diagram${className ? ` ${className}` : ''}`}>
      <div className="public-section-block__eyebrow">{title}</div>
      <div className="public-system-diagram__canvas" aria-label={title}>
        <svg className="public-system-diagram__links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {links.map((link, index) => (
            <line
              key={`${link.from}-${link.to}-${index}`}
              x1={link.fromX}
              y1={link.fromY}
              x2={link.toX}
              y2={link.toY}
              stroke={link.accent ?? 'rgba(124,255,224,0.35)'}
              strokeWidth="0.45"
              strokeDasharray="2 2"
            />
          ))}
        </svg>
        {nodes.map((node) => (
          <article
            key={node.label}
            className={`public-system-diagram__node${node.highlight ? ' is-highlight' : ''}`}
            style={{
              '--node-x': `${node.x}%`,
              '--node-y': `${node.y}%`,
              '--node-accent': node.accent ?? '#7cffe0',
            }}
          >
            <div className="public-system-diagram__glyph" aria-hidden="true">{node.glyph}</div>
            <strong>{node.label}</strong>
            <p>{node.detail}</p>
          </article>
        ))}
      </div>
    </MotionPanel>
  );
}

export function OperatingModuleGrid({ items = [], className = '' }) {
  return (
    <MotionList className={`public-operating-grid${className ? ` ${className}` : ''}`}>
      {items.map((item) => (
        <MotionListItem key={item.title}>
          <article className="public-operating-card">
            <div className="public-operating-card__header">
              <span className="public-operating-card__glyph" aria-hidden="true">{item.glyph}</span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
            </div>
            {item.proof ? <div className="public-operating-card__proof">{item.proof}</div> : null}
            {item.chips?.length ? (
              <div className="public-operating-card__chips">
                {item.chips.map((chip) => (
                  <span key={chip}>{chip}</span>
                ))}
              </div>
            ) : null}
            <div className="public-operating-card__footer">
              <span>{item.metric}</span>
              {item.cta}
            </div>
          </article>
        </MotionListItem>
      ))}
    </MotionList>
  );
}

export function SignalCards({ items = [], className = '' }) {
  return (
    <div className={`public-signal-grid${className ? ` ${className}` : ''}`}>
      {items.map((item) => (
        <MotionCard key={item.title} className="public-signal-card" accent={item.accent}>
          <div className="public-section-block__eyebrow">{item.eyebrow}</div>
          <strong>{item.title}</strong>
          <p>{item.body}</p>
          {item.chips?.length ? (
            <div className="public-operating-card__chips">
              {item.chips.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          ) : null}
        </MotionCard>
      ))}
    </div>
  );
}

export function BeforeAfterComparison({ beforeTitle = 'Before', afterTitle = 'With Prymal', before = [], after = [] }) {
  return (
    <section className="public-before-after">
      <article className="public-before-after__card">
        <div className="public-section-block__eyebrow">Before</div>
        <h3>{beforeTitle}</h3>
        <BulletList items={before} />
      </article>
      <article className="public-before-after__card public-before-after__card--accent">
        <div className="public-section-block__eyebrow">With Prymal</div>
        <h3>{afterTitle}</h3>
        <BulletList items={after} />
      </article>
    </section>
  );
}

export function AgentRail({ agents = [] }) {
  if (!agents.length) return null;

  return (
    <section className="public-agent-rail">
      {agents.map((agent) => (
        <article key={agent.id} className="public-agent-rail__card">
          <div className="public-agent-rail__glyph" style={{ '--agent-accent': agent.color ?? '#7cffe0' }}>
            {agent.glyph}
          </div>
          <strong>{agent.name}</strong>
          <span>{agent.title}</span>
        </article>
      ))}
    </section>
  );
}

export function SearchFilterBar({
  searchValue,
  onSearchChange,
  filterValue,
  onFilterChange,
  filterLabel = 'Filter',
  options = [],
  searchPlaceholder = 'Search guides, topics, or themes',
}) {
  const showFilter = options.length > 0 && typeof onFilterChange === 'function';

  return (
    <div className="public-filter-bar">
      <label className="public-filter-bar__search">
        <span>Search</span>
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
        />
      </label>
      {showFilter ? (
        <label className="public-filter-bar__select">
          <span>{filterLabel}</span>
          <select value={filterValue} onChange={(event) => onFilterChange(event.target.value)}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

export function ReadingPathGrid({ items = [], className = '' }) {
  return (
    <div className={`public-reading-path-grid${className ? ` ${className}` : ''}`}>
      {items.map((item) => (
        <article key={item.title} className="public-reading-path-card">
          <div className="public-section-block__eyebrow">{item.eyebrow}</div>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <div className="public-operating-card__chips">
            {item.chips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
          <Link to={item.to} className="public-reading-path-card__link">
            {item.cta ?? 'Open path ->'}
          </Link>
        </article>
      ))}
    </div>
  );
}

export function ComparisonMatrix({ rows = [], columns = [], className = '' }) {
  return (
    <div className={`public-comparison-matrix${className ? ` ${className}` : ''}`} role="table" aria-label="Comparison matrix">
      <div className="public-comparison-matrix__header" role="rowgroup">
        <div role="row" className="public-comparison-matrix__row public-comparison-matrix__row--header">
          <span role="columnheader">Criteria</span>
          {columns.map((column) => (
            <span key={column} role="columnheader">{column}</span>
          ))}
        </div>
      </div>
      <div role="rowgroup">
        {rows.map((row) => (
          <div key={row.label} role="row" className="public-comparison-matrix__row">
            <strong role="rowheader">{row.label}</strong>
            <span>{row.prymal}</span>
            <span>{row.other}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Scoreboard({ items = [], className = '' }) {
  return (
    <div className={`public-scoreboard${className ? ` ${className}` : ''}`}>
      {items.map((item) => (
        <article key={item.label} className="public-scoreboard__item">
          <div className="public-scoreboard__top">
            <strong>{item.label}</strong>
            <span>{item.score}/5</span>
          </div>
          <div className="public-scoreboard__track" aria-hidden="true">
            <span style={{ width: `${(item.score / 5) * 100}%` }} />
          </div>
          <p>{item.detail}</p>
        </article>
      ))}
    </div>
  );
}

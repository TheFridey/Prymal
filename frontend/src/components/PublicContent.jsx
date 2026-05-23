import { Link } from 'react-router-dom';
import { JsonLd } from './PublicPageChrome';
import { PublicCtaLink } from './PublicCta';
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
  buildCollectionSchema,
  buildFaqPageSchema,
} from '../lib/seo';
import { MotionCard, MotionList, MotionListItem, MotionPanel, MotionSection } from './motion';

export {
  buildArticleSchema,
  buildBreadcrumbSchema,
  buildCollectionSchema,
  buildFaqPageSchema,
};

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

export function LinkCardGrid({ items = [], surface = 'content-hub' }) {
  return (
    <div className="public-link-grid">
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
    <section className="public-premium-hero">
      <div className="public-premium-hero__ambient" aria-hidden="true">
        <span className="public-premium-hero__orb public-premium-hero__orb--one" />
        <span className="public-premium-hero__orb public-premium-hero__orb--two" />
        <span className="public-premium-hero__grid" />
      </div>
      <div className="public-premium-hero__content">
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

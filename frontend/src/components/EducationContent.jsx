import { Link } from 'react-router-dom';
import {
  EDUCATION_PAGES,
  buildEducationSections,
  getEducationPath,
  getRelatedEducationPages,
} from '../content/education';
import {
  BulletList,
  LinkCardGrid,
  SectionBlock,
  SystemDiagram,
} from './PublicContent';

export function EducationCard({ page }) {
  return (
    <Link to={getEducationPath(page.slug)} className="public-link-card">
      <div className="public-section-block__eyebrow">{page.category}</div>
      <div className="public-link-card__title">{page.title}</div>
      <p>{page.shortDefinition}</p>
      <span>Read explainer -&gt;</span>
    </Link>
  );
}

export function EducationCardGrid({ pages = EDUCATION_PAGES }) {
  return (
    <div className="public-link-grid">
      {pages.map((page) => (
        <EducationCard key={page.slug} page={page} />
      ))}
    </div>
  );
}

export function EducationIllustration({ page }) {
  return (
    <SectionBlock
      eyebrow="Illustration"
      title={`${page.term} visual model`}
      description="A simplified diagram for the operating pattern behind the concept."
    >
      <SystemDiagram
        title={page.illustration.title}
        nodes={page.illustration.nodes}
        links={page.illustration.links}
      />
    </SectionBlock>
  );
}

export function EducationLongformSections({ page }) {
  return (
    <>
      {buildEducationSections(page).map((section) => (
        <SectionBlock key={section.title} eyebrow={section.eyebrow} title={section.title}>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="public-section-block__description">{paragraph}</p>
          ))}
          <BulletList items={section.bullets} />
        </SectionBlock>
      ))}
    </>
  );
}

export function EducationExamples({ page }) {
  return (
    <SectionBlock eyebrow="Examples" title={`${page.term} examples`}>
      <div className="public-link-grid public-link-grid--definitions">
        {page.examples.map((item) => (
          <article key={item.title} className="public-link-card public-definition-card">
            <div className="public-section-block__eyebrow">Example</div>
            <div className="public-link-card__title">{item.title}</div>
            <p>{item.description}</p>
            <ol className="public-bullet-list">
              {item.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </SectionBlock>
  );
}

export function EducationReferences({ page }) {
  return (
    <SectionBlock eyebrow="References" title={`${page.term} references`}>
      <div className="public-link-grid public-link-grid--definitions">
        {page.references.map((reference) => (
          <article
            key={reference.href}
            className="public-link-card public-definition-card"
            data-ai-citation="true"
            itemScope
            itemType="https://schema.org/CreativeWork"
          >
            <div className="public-section-block__eyebrow" itemProp="publisher">{reference.publisher}</div>
            <div className="public-link-card__title">
              <a href={reference.href} target="_blank" rel="noreferrer" itemProp="url">
                <span itemProp="name">{reference.title}</span>
              </a>
            </div>
            <p itemProp="description">{reference.note}</p>
            <span>Reference source -&gt;</span>
          </article>
        ))}
      </div>
    </SectionBlock>
  );
}

export function EducationInternalLinks({ page }) {
  const related = getRelatedEducationPages(page);
  const items = [
    ...related.map((item) => ({
      title: item.title,
      to: getEducationPath(item.slug),
      description: item.shortDefinition,
      cta: 'Read next ->',
    })),
    {
      title: 'AI operating system for business',
      to: '/ai-operating-system-for-business',
      description: 'Read Prymal’s broader guide to the AI operating system category.',
      cta: 'Open guide ->',
    },
    {
      title: 'Prymal entity graph',
      to: '/content/entities',
      description: 'Explore the entity graph that connects Prymal, AI operating systems, agents, memory, workflows, and governance.',
      cta: 'Open graph ->',
    },
    {
      title: 'Use case library',
      to: '/use-cases',
      description: 'Map educational concepts to practical AI workflow use cases.',
      cta: 'Browse use cases ->',
    },
  ];

  return (
    <SectionBlock eyebrow="Internal links" title="Continue through the education path">
      <LinkCardGrid items={items} surface={`education-${page.slug}`} />
    </SectionBlock>
  );
}

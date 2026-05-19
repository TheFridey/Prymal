import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { BLOG_POSTS } from '../lib/site-content';
import { LinkCardGrid, PublicHero, ResourceCta, buildCollectionSchema } from '../components/PublicContent';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function Blog() {
  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title="Blog - Prymal"
        description="Practical guides on AI operating systems, business memory, AI agents, workflow automation, trust, and business-ready AI execution."
        canonicalPath="/blog"
      />
      <JsonLd
        id="schema-blog"
        schema={buildCollectionSchema({
          name: 'Prymal blog',
          description: 'Answer-first articles on AI agents, business memory, workflows, trust, and execution.',
          path: '/blog',
        })}
      />
      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="blog" />
        <PageShell width="1100px">
          <div className="public-content-page">
            <PublicHero
              eyebrow="Prymal blog"
              title="Guides for teams using AI to get business work done"
              description="This is the content foundation for Prymal: answer-first articles built around execution, memory, workflows, trust, and operator-friendly adoption."
              answerTitle="What is the Prymal blog about?"
              answer="The Prymal blog explains how businesses can use specialist agents, shared memory, workflow automation, and safety controls to produce usable work."
              primaryCta={<Link to="/features" className="pm-btn pm-btn--primary">Explore features</Link>}
              secondaryCta={<Link to="/compare" className="pm-btn pm-btn--ghost">View comparisons</Link>}
            />

            <LinkCardGrid
              items={BLOG_POSTS.map((post) => ({
                to: `/blog/${post.slug}`,
                title: post.title,
                description: post.answer,
                cta: 'Read article ->',
              }))}
            />

            <ResourceCta
              title="Want the product angle as well?"
              description="Feature pages and comparison pages help translate these concepts into real buying and implementation decisions."
              primary={<Link to="/features" className="pm-btn pm-btn--primary">Feature pages</Link>}
              secondary={<Link to="/pricing" className="pm-btn pm-btn--ghost">Pricing</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix="blog" />
      </div>
    </div>
  );
}

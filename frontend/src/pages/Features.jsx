import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { LinkCardGrid, PublicHero, ResourceCta, buildCollectionSchema } from '../components/PublicContent';
import { FEATURE_PAGES } from '../lib/site-content';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function Features() {
  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title="Features - Prymal"
        description="Explore Prymal features across AI agents, business memory, workflow automation, security, outreach, reporting, and strategy."
        canonicalPath="/features"
      />
      <JsonLd
        id="schema-features"
        schema={buildCollectionSchema({
          name: 'Prymal features',
          description: 'Feature pages covering agents, business memory, workflows, security, content, and reporting.',
          path: '/features',
        })}
      />
      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="features" />
        <PageShell width="1100px">
          <div className="public-content-page">
            <PublicHero
              eyebrow="Feature library"
              title="Prymal features for execution, memory, workflows, and trust"
              description="Every feature page is built to answer what Prymal does, how it works in practice, and where it fits for serious business use."
              answerTitle="What does Prymal include?"
              answer="Prymal combines specialist agents, shared business memory, workflow automation, evidence-aware outputs, and safety controls in one coordinated workspace."
              primaryCta={<Link to="/pricing" className="pm-btn pm-btn--primary">View pricing</Link>}
              secondaryCta={<Link to="/trust" className="pm-btn pm-btn--ghost">Explore trust</Link>}
            />

            <LinkCardGrid
              items={FEATURE_PAGES.map((page) => ({
                to: `/features/${page.slug}`,
                title: page.title,
                description: page.answer,
                cta: 'Open feature page ->',
              }))}
            />

            <ResourceCta
              title="Looking for detailed examples?"
              description="The blog and comparison hub show how Prymal fits real business workflows, shared context, and trust-sensitive execution."
              primary={<Link to="/blog" className="pm-btn pm-btn--primary">Browse the blog</Link>}
              secondary={<Link to="/compare" className="pm-btn pm-btn--ghost">See comparisons</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix="features" />
      </div>
    </div>
  );
}

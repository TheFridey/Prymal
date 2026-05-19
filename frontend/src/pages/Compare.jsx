import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { JsonLd, PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { COMPARISON_PAGES } from '../lib/site-content';
import { LinkCardGrid, PublicHero, ResourceCta, buildCollectionSchema } from '../components/PublicContent';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

export default function Compare() {
  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title="Compare Prymal - Prymal"
        description="Compare Prymal with general chat tools, AI chatbots, agent platforms, and workflow automation categories for business use."
        canonicalPath="/compare"
      />
      <JsonLd
        id="schema-compare-hub"
        schema={buildCollectionSchema({
          name: 'Prymal comparison hub',
          description: 'Fair comparison pages showing where Prymal fits across business AI categories.',
          path: '/compare',
        })}
      />
      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="compare" />
        <PageShell width="1100px">
          <div className="public-content-page">
            <PublicHero
              eyebrow="Comparison hub"
              title="Compare Prymal with business AI categories fairly"
              description="These pages are designed to help buyers understand product categories without cheap shots, hostile language, or overclaiming."
              answerTitle="How should you use this hub?"
              answer="Use these comparisons to decide whether you need a general chat tool, an execution-first AI workspace, a workflow automation product, or a more open-ended agent platform."
              primaryCta={<Link to="/features" className="pm-btn pm-btn--primary">See feature pages</Link>}
              secondaryCta={<Link to="/trust" className="pm-btn pm-btn--ghost">Review trust posture</Link>}
            />

            <LinkCardGrid
              items={COMPARISON_PAGES.map((page) => ({
                to: `/compare/${page.slug}`,
                title: page.title,
                description: page.answer,
                cta: 'Read comparison ->',
              }))}
            />

            <ResourceCta
              title="Need a more direct product view?"
              description="Feature pages, pricing, and the trust page are the best next steps once you understand the category fit."
              primary={<Link to="/pricing" className="pm-btn pm-btn--primary">View pricing</Link>}
              secondary={<Link to="/blog" className="pm-btn pm-btn--ghost">Read the blog</Link>}
            />
          </div>
        </PageShell>
        <PublicPageFooter sourcePrefix="compare" />
      </div>
    </div>
  );
}

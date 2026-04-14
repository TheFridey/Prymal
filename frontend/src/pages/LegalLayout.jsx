import { Link } from 'react-router-dom';
import { Button, PageHeader, PageShell, Reveal, SurfaceCard } from '../components/ui';
import { PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';

export default function LegalLayout({ eyebrow, title, description, sections, updated, pageTitle, canonicalPath }) {
  const trackSignup = () => {
    if (typeof window !== 'undefined' && typeof window.prymalTrack === 'function') {
      window.prymalTrack('signup_button_clicked', { source: 'legal-page' });
    }
  };

  return (
    <div className="marketing-page prymal-marketing prymal-use-case-page prymal-use-case-page--legal">
      {pageTitle && <PageMeta title={pageTitle} description={description} canonicalPath={canonicalPath} />}
      <div className="prymal-marketing__aura prymal-marketing__aura--one" />
      <div className="prymal-marketing__aura prymal-marketing__aura--two" />
      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="legal" onSignupClick={trackSignup} />

        <PageShell width="980px">
          <div style={{ display: 'grid', gap: '24px' }}>
            <PageHeader
              eyebrow={eyebrow}
              title={title}
              description={description}
              actions={
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className="mini-chip">Updated {updated}</div>
                  <Link to="/signup" onClick={trackSignup}>
                    <Button tone="accent">Start free</Button>
                  </Link>
                </div>
              }
            />

            <div style={{ display: 'grid', gap: '16px' }}>
              {sections.map((section, index) => (
                <Reveal key={section.heading} delay={index * 40}>
                  <SurfaceCard title={section.heading} accent="rgba(78, 205, 196, 0.4)">
                    <div style={{ display: 'grid', gap: '12px', color: 'var(--muted)', lineHeight: 1.8 }}>
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph} style={{ margin: 0 }}>
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </SurfaceCard>
                </Reveal>
              ))}
            </div>
          </div>
        </PageShell>

        <PublicPageFooter sourcePrefix="legal" onSignupClick={trackSignup} />
      </div>
    </div>
  );
}

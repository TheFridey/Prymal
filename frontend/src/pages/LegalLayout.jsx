import { Link } from 'react-router-dom';
import { Button, PageShell, Reveal } from '../components/ui';
import { usePrymalReducedMotion } from '../components/motion';
import { PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { MagicalCanvas } from '../features/marketing/MagicalCanvas';
import '../styles/landing-rebuild.css';

export default function LegalLayout({ eyebrow, title, description, sections, updated, pageTitle, canonicalPath }) {
  const reducedMotion = usePrymalReducedMotion();

  const trackSignup = () => {
    if (typeof window !== 'undefined' && typeof window.prymalTrack === 'function') {
      window.prymalTrack('signup_button_clicked', { source: 'legal-page' });
    }
  };

  return (
    <div className="marketing-page prymal-marketing pm-page">
      {pageTitle && <PageMeta title={pageTitle} description={description} canonicalPath={canonicalPath} />}
      <MagicalCanvas reducedMotion={reducedMotion} />
      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="legal" onSignupClick={trackSignup} />

        <PageShell width="980px">
          <div className="pm-page__inner" style={{ display: 'grid', gap: '24px' }}>
            <div className="pm-page-header" style={{ paddingBottom: 0 }}>
              <div className="pm-page-header__eyebrow">
                <span className="pm-hero__badge-dot" />
                {eyebrow}
              </div>
              <h1 className="pm-page-header__title">{title}</h1>
              <p className="pm-page-header__sub">{description}</p>
              <div className="pm-page-header__actions" style={{ gap: '10px' }}>
                <span className="pm-usecase-hero__chip">Updated {updated}</span>
                <Link to="/signup" className="pm-btn pm-btn--primary" onClick={trackSignup}>Start free →</Link>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '16px' }}>
              {sections.map((section, index) => (
                <Reveal key={section.heading} delay={index * 40}>
                  <div className="pm-legal-section">
                    <h3>{section.heading}</h3>
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
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

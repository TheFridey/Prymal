import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { MotionSection, usePrymalReducedMotion } from '../components/motion';
import { PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { MagicalCanvas } from '../features/marketing/MagicalCanvas';
import '../styles/landing-rebuild.css';

const TRUST_PILLARS = [
  {
    title: 'Tenant isolation',
    body: 'Workspace data is scoped by organisation and enforced server-side across conversations, memory, workflows, integrations, and admin operations.',
  },
  {
    title: 'WARDEN + SENTINEL',
    body: 'WARDEN filters unsafe input before it becomes instructions. SENTINEL reviews higher-risk outputs before they are shared back into the workspace.',
  },
  {
    title: 'Secure deployment controls',
    body: 'Production deployments use hardened environment validation, VPS security checks, HTTPS-only reverse proxying, strict headers, rate limits, and audited operational runbooks.',
  },
  {
    title: 'Dependency management',
    body: 'Production dependency audits, lockfile hygiene, and documented risk acceptance are part of the release process before public rollout.',
  },
  {
    title: 'Data handling boundaries',
    body: 'Prymal separates customer-facing outputs from internal diagnostics, redacts sensitive data in logs, and avoids exposing execution internals in normal workspace surfaces.',
  },
  {
    title: 'Compliance readiness',
    body: 'Prymal maintains evidence packs, policies, registers, and operational checklists for Cyber Essentials and ISO 27001 readiness. This is readiness work, not a certification claim.',
  },
];

export default function Trust() {
  const reducedMotion = usePrymalReducedMotion();

  const trackSignup = () => {
    if (typeof window !== 'undefined' && typeof window.prymalTrack === 'function') {
      window.prymalTrack('signup_button_clicked', { source: 'trust' });
    }
  };

  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title="Trust - Prymal"
        description="Learn how Prymal approaches tenant isolation, safety systems, secure deployment, dependency management, and compliance readiness."
        canonicalPath="/trust"
      />

      <MagicalCanvas reducedMotion={reducedMotion} />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="trust" onSignupClick={trackSignup} />

        <PageShell width="980px">
          <div className="pm-page__inner" style={{ display: 'grid', gap: '28px' }}>
            <MotionSection reveal={{ y: 24, blur: 10 }}>
              <header className="pm-changelog-hero" style={{ textAlign: 'left' }}>
                <div className="pm-page-header__eyebrow">
                  <span className="pm-hero__badge-dot" />
                  Trust and security
                </div>
                <h1 className="pm-changelog-hero__title">How Prymal handles trust in production</h1>
                <p className="pm-changelog-hero__sub">
                  Prymal is built to separate unsafe input from trusted instructions, keep workspace data scoped,
                  and support hardened deployments with repeatable operational evidence.
                </p>
                <div className="pm-changelog-hero__actions">
                  <Link to="/signup" className="pm-btn pm-btn--primary" onClick={trackSignup}>
                    Start free -&gt;
                  </Link>
                  <Link to="/privacy" className="pm-btn pm-btn--ghost">
                    Read privacy
                  </Link>
                </div>
              </header>
            </MotionSection>

            <MotionSection reveal={{ y: 20, blur: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {TRUST_PILLARS.map((pillar) => (
                  <article
                    key={pillar.title}
                    style={{
                      padding: '22px',
                      borderRadius: '24px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))',
                      display: 'grid',
                      gap: '10px',
                    }}
                  >
                    <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-strong)' }}>{pillar.title}</h2>
                    <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.75 }}>{pillar.body}</p>
                  </article>
                ))}
              </div>
            </MotionSection>

            <MotionSection reveal={{ y: 18, blur: 6 }}>
              <section
                style={{
                  padding: '24px',
                  borderRadius: '24px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                  display: 'grid',
                  gap: '12px',
                }}
              >
                <h2 style={{ margin: 0, fontSize: '22px', color: 'var(--text-strong)' }}>What this page does and does not claim</h2>
                <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.75 }}>
                  Prymal documents security controls, deployment hardening, and compliance readiness work in the repo.
                  We do not claim Cyber Essentials, Cyber Essentials Plus, or ISO/IEC 27001 certification unless and until
                  that certification is formally achieved.
                </p>
              </section>
            </MotionSection>
          </div>
        </PageShell>

        <PublicPageFooter sourcePrefix="trust" onSignupClick={trackSignup} />
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { MotionSection } from '../components/motion';
import { PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import {
  FAQSection,
  PremiumHero,
  ResourceCta,
  SectionBlock,
  SignalCards,
  SystemDiagram,
} from '../components/PublicContent';
import { PUBLIC_OG_DEFAULTS, TRUST_FAQ_ITEMS } from '../lib/site-content';
import '../styles/landing-rebuild.css';
import '../styles/public-content.css';

const TRUST_ARCHITECTURE_NODES = [
  { label: 'WARDEN', detail: 'Input and action screening', glyph: 'WD', x: 16, y: 26, accent: '#ffd166', highlight: true },
  { label: 'LORE', detail: 'Scoped business memory', glyph: 'LO', x: 50, y: 18, accent: '#c77dff', highlight: true },
  { label: 'SENTINEL', detail: 'Output validation and holds', glyph: 'SE', x: 84, y: 26, accent: '#fb7185', highlight: true },
  { label: 'Deployment controls', detail: 'Headers, env validation, rate limits', glyph: 'DP', x: 20, y: 72, accent: '#4cc9f0' },
  { label: 'Compliance evidence', detail: 'Policies, registers, runbooks, evidence', glyph: 'EV', x: 50, y: 82, accent: '#7cffe0' },
  { label: 'Data boundaries', detail: 'User-safe outputs and diagnostics separation', glyph: 'DB', x: 80, y: 72, accent: '#80ffdb' },
];

const TRUST_ARCHITECTURE_LINKS = [
  { fromX: 22, fromY: 32, toX: 46, toY: 24, accent: 'rgba(255,209,102,0.35)' },
  { fromX: 54, fromY: 24, toX: 78, toY: 32, accent: 'rgba(199,125,255,0.35)' },
  { fromX: 20, fromY: 68, toX: 46, toY: 76, accent: 'rgba(76,201,240,0.25)' },
  { fromX: 54, fromY: 76, toX: 76, toY: 68, accent: 'rgba(124,255,224,0.25)' },
  { fromX: 50, fromY: 24, toX: 50, toY: 76, accent: 'rgba(255,255,255,0.18)' },
];

const TRUST_SIGNALS = [
  {
    eyebrow: 'What Prymal protects against',
    title: 'Context drift and unsafe automation paths',
    body: 'Shared memory, contradiction handling, approvals, and validation reduce the chance that a workflow keeps acting on stale assumptions or unscreened outputs.',
    chips: ['Stale memory', 'Unchecked output', 'Drift reduction'],
    accent: '#7cffe0',
  },
  {
    eyebrow: 'What Prymal protects against',
    title: 'Blind action paths and hidden trust assumptions',
    body: 'The architecture is designed to keep risky steps reviewable through bounded execution, audit trails, rate limits, hardened configuration, and safer evidence collection.',
    chips: ['Approvals', 'Auditability', 'Hardened deploy'],
    accent: '#4cc9f0',
  },
  {
    eyebrow: 'Data boundaries',
    title: 'Public-safe outputs with private operator diagnostics',
    body: 'Normal users get clarity about evidence and confidence without seeing internal routing, provider, or cost details that belong in staff and operator surfaces only.',
    chips: ['Public-safe', 'Operator-only diagnostics', 'No routing leakage'],
    accent: '#fb7185',
  },
];

const READINESS_TIMELINE = [
  { eyebrow: 'Step 1', title: 'Code and deploy hardening', body: 'Production env validation, rate limits, media controls, secure logging, dependency audit cleanup, and VPS hardening guidance.' },
  { eyebrow: 'Step 2', title: 'Evidence preparation', body: 'Policies, registers, runbooks, evidence collection, and operator-ready security workflows are tracked in-repo for repeatable review.' },
  { eyebrow: 'Step 3', title: 'Operational validation', body: 'VPS evidence, backup restore tests, access reviews, dependency reviews, and trust runbooks support readiness conversations with serious buyers.' },
];

const CLAIM_BOUNDARIES = [
  {
    eyebrow: 'What we claim',
    title: 'Readiness, controls, and evidence preparation',
    body: 'Prymal documents trust boundaries, deployment controls, memory governance, and compliance evidence preparation openly.',
    chips: ['Readiness', 'Aligned controls', 'Evidence prep'],
    accent: '#7cffe0',
  },
  {
    eyebrow: 'What we do not claim',
    title: 'No premature certification language',
    body: 'Prymal does not claim Cyber Essentials, Cyber Essentials Plus, or ISO/IEC 27001 certification until those certifications are formally achieved.',
    chips: ['No overclaiming', 'Precise language', 'Formal status only'],
    accent: '#fb7185',
  },
];

const EVIDENCE_CHECKLIST = [
  'Deployment hardening runbook and production preflight output',
  'Security headers, rate-limit, and media-storage verification results',
  'Dependency audit summary and documented residual risk treatment',
  'Access review, backup restore, and incident drill evidence records',
];

export default function Trust() {
  return (
    <div className="marketing-page prymal-marketing pm-page">
      <PageMeta
        title="Trust - Prymal"
        description="Learn how Prymal approaches tenant isolation, safety systems, secure deployment, dependency management, and compliance readiness."
        canonicalPath="/trust"
        ogImage={PUBLIC_OG_DEFAULTS.trust.image}
        ogImageAlt={PUBLIC_OG_DEFAULTS.trust.imageAlt}
      />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="trust" />

        <PageShell width="1160px">
          <div className="public-content-page">
            <MotionSection>
              <PremiumHero
                eyebrow="Trust and security"
                title="How Prymal handles trust in production"
                description="Prymal is built to separate unsafe input from trusted instructions, keep workspace data scoped, and support hardened deployments with repeatable operational evidence."
                answerTitle="What should you expect from Prymal trust language?"
                answer="Prymal talks about readiness, evidence preparation, aligned controls, and operational boundaries. This is readiness work and evidence preparation, not a certification claim. Prymal does not claim Cyber Essentials or ISO 27001 certification unless that certification has been formally achieved."
                chips={['Tenant isolation', 'WARDEN + SENTINEL', 'Deployment controls', 'Evidence preparation']}
                stats={[
                  { label: 'Trust posture', value: 'Readiness-first' },
                  { label: 'Evidence style', value: 'Operational' },
                  { label: 'Certification language', value: 'Precise' },
                ]}
                primaryCta={<Link to="/signup" className="pm-btn pm-btn--primary">Start free</Link>}
                secondaryCta={<Link to="/privacy" className="pm-btn pm-btn--ghost">Read privacy</Link>}
                visual={(
                  <div className="public-hero-rail">
                    <SystemDiagram
                      title="Trust architecture"
                      nodes={TRUST_ARCHITECTURE_NODES}
                      links={TRUST_ARCHITECTURE_LINKS}
                      className="public-system-diagram--compact"
                    />
                    <div className="public-hero-rail__grid public-hero-rail__grid--duo">
                      <div className="public-premium-summary-card public-premium-summary-card--compact">
                        <div className="public-section-block__eyebrow">Claim boundary</div>
                        <strong>Readiness and evidence, not premature certification language</strong>
                        <p>Prymal talks about aligned controls, operational evidence, and readiness work without implying certifications that have not been formally achieved.</p>
                      </div>
                      <div className="public-premium-summary-card public-premium-summary-card--compact">
                        <div className="public-section-block__eyebrow">Operator review</div>
                        <strong>Serious teams can inspect the trust posture</strong>
                        <p>Deployment checks, evidence records, and safer memory controls give operators a reviewable trust surface instead of vague reassurance.</p>
                      </div>
                    </div>
                  </div>
                )}
              />
            </MotionSection>

            <MotionSection>
              <SectionBlock eyebrow="Trust architecture" title="What Prymal protects against">
                <SignalCards items={TRUST_SIGNALS} />
              </SectionBlock>
            </MotionSection>

            <MotionSection>
              <SectionBlock eyebrow="Clarity" title="What we claim and what we do not claim">
                <SignalCards items={CLAIM_BOUNDARIES} />
              </SectionBlock>
            </MotionSection>

            <MotionSection>
              <SectionBlock eyebrow="Readiness timeline" title="How the trust posture matures operationally">
                <SignalCards items={READINESS_TIMELINE.map((item) => ({ ...item, accent: '#4cc9f0' }))} />
              </SectionBlock>
            </MotionSection>

            <MotionSection>
              <SectionBlock eyebrow="Operational evidence" title="What serious buyers and internal operators can review">
                <ul className="public-bullet-list">
                  {EVIDENCE_CHECKLIST.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </SectionBlock>
            </MotionSection>

            <MotionSection>
              <SectionBlock eyebrow="Data boundaries" title="How Prymal keeps user-facing surfaces cleaner">
                <div className="public-premium-note">
                  <strong>Normal users see safe abstractions.</strong>
                  <p>
                    Workspace users can see confidence, evidence freshness, contradiction warnings, and whether an answer
                    used workspace knowledge or live research. Internal routing, provider, model, and cost diagnostics stay
                    on staff and operator surfaces instead of leaking into the public experience.
                  </p>
                </div>
              </SectionBlock>
            </MotionSection>

            <FAQSection title="Trust FAQ" items={TRUST_FAQ_ITEMS} schemaId="schema-trust-faq" />

            <ResourceCta
              title="Want the architectural view too?"
              description="The security feature page, comparison hub, and blog show how Prymal frames trust alongside memory, workflows, and operator-grade execution."
              primary={<Link to="/features/ai-security" className="pm-btn pm-btn--primary">Security feature page</Link>}
              secondary={<Link to="/compare" className="pm-btn pm-btn--ghost">Compare categories</Link>}
            />
          </div>
        </PageShell>

        <PublicPageFooter sourcePrefix="trust" />
      </div>
    </div>
  );
}

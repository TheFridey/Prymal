import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { MotionSection, usePrymalReducedMotion } from '../components/motion';
import { PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';
import { MagicalCanvas } from '../features/marketing/MagicalCanvas';
import '../styles/landing-rebuild.css';
import '../styles/changelog-premium.css';

const CHANGELOG = [
  {
    version: '1.0.7',
    date: '2026-05-12',
    tag: 'Reliability',
    badge: 'Routing',
    milestone: true,
    title: 'Routing Intelligence + Safety Explainability',
    impact: 'Prymal now makes smarter provider choices in production and gives operators clearer reasons when safety systems intervene.',
    entries: [
      'Model routing now uses a centralized capability matrix across OpenAI, Anthropic, and Gemini lanes instead of drift-prone one-off defaults.',
      'Provider routing weights now account for runtime health signals such as failure rate, timeout rate, fallback frequency, and held-response rate.',
      'Added a dedicated Gemini Flash-Lite lane for low-cost bulk work while keeping premium reasoning, grounded research, structured extraction, and multimodal lanes explicit.',
      'SENTINEL HOLD outcomes now expose a reason code, risk category, and confidence level for faster operator triage.',
      'OCR-derived image safety text is normalized and treated as explicit untrusted evidence before it can influence media generation or downstream execution.',
      'Admin runtime views now surface capability-matrix and provider-health diagnostics so routing changes are observable, not magical.',
    ],
  },
  {
    version: '1.0.6',
    date: '2026-05-06',
    tag: 'Automation',
    badge: 'Actions',
    milestone: true,
    title: 'Agent Action Runtime',
    impact: 'Prymal agents can now take real actions in the world — sending emails, writing to Google Drive, and posting to Slack — with a human-in-the-loop approval layer for any action that carries risk.',
    entries: [
      'Agents can now execute email sends, Google Drive writes and appends, and Slack posts directly from workflow nodes.',
      'Every action passes through a declarative policy engine before execution — bulk email and direct messages are blocked outright, external emails and public Slack posts require human approval.',
      'Added a 30-minute human-in-the-loop approval flow: actions pending approval appear in a live inbox in the NEXUS workspace with risk badge, content preview, and expiry countdown.',
      'NEXUS navigation badge shows the count of pending approvals waiting for your review.',
      'Approval tokens are HMAC-SHA256 signed and single-use — once consumed the action executes immediately without re-queuing.',
      'All action payloads pass through WARDEN before dispatch — blocked payloads never reach the integration layer.',
      'Plan gate enforced server-side: action runtime is available on Pro, Teams, and Agency plans.',
    ],
  },
  {
    version: '1.0.5',
    date: '2026-05-05',
    tag: 'Platform',
    badge: 'Core',
    milestone: true,
    title: 'Platform Hardening — TTS, LORE Intelligence, Contract Enforcement, Routing Feedback',
    impact: 'A set of foundational platform improvements that make Prymal workflows safer, smarter, and more observable as they scale.',
    entries: [
      'Added voice output (TTS) for agents via OpenAI — Teams and Agency plans automatically use the HD voice model. SENTINEL-held outputs are suppressed from TTS so users never hear a held response read aloud.',
      'LORE knowledge graph now tracks entities and relationships extracted from your documents, enabling richer cross-document reasoning and semantic entity search.',
      'LORE quality feedback loop surfaces low-quality documents — SENTINEL HOLD signals flag documents that repeatedly produce held outputs for review.',
      'Workflow DAG contract enforcement is now on by default for new workflows. Workflows validate their input/output schemas and policy constraints before every run, with violations surfaced inline in the builder.',
      'Legacy workflows show an amber "Legacy mode" badge and a voluntary "Enable contract enforcement" button — migration is always opt-in.',
      'Eval score feedback loop: agent routing weights now update using an exponential moving average of groundedness, citations, structured output, tool policy, and hallucination risk scores, with a hold-penalty term.',
      'Staff admin trace drilldown now shows a Routing Intelligence section — weight as a percentage bar, confidence badge, escalation indicator, and sample size.',
      'New staff admin Agent Performance page at /admin/agent-performance with filterable eval summary table, hold% highlighting, and CSV export.',
      'Automated migration runner (npm run migrate) tracks applied migrations in schema_migrations, skips already-applied files, and exits non-zero on failure — used by the VPS deploy script.',
      'Published the official @prymal/sdk TypeScript package with dual ESM/CJS output, typed resources for agents, workflows, and actions, and HMAC-verified webhook helpers.',
    ],
  },
  {
    version: '1.0.4',
    date: '2026-05-01',
    tag: 'Security',
    badge: 'WARDEN',
    milestone: true,
    title: 'WARDEN Input Safety Firewall',
    impact: 'Prymal now protects execution surfaces before unsafe or manipulative input can be treated as trusted instructions.',
    entries: [
      'Added WARDEN as an input-side firewall before LORE ingestion, media generation, workflows, and tool execution.',
      'External URLs, uploads, pasted content, OCR text, and retrieved LORE are now treated as untrusted evidence rather than instructions.',
      'Added deterministic detection for prompt injection, role spoofing, tool-abuse instructions, hidden prompt content, encoded payloads, and secret leakage.',
      'Media generation requests are scanned before provider calls, with clean refusals for blocked unsafe image or video prompts.',
      'Tool execution now checks source trust, action risk, confirmation needs, and org scope before allowing side-effect actions.',
      'Added WARDEN audit events so operators can investigate blocked input, sandboxed content, redactions, media refusals, and tool denials without storing unsafe raw content.',
    ],
  },
  {
    version: '1.0.3',
    date: '2026-04-30',
    tag: 'Update',
    badge: 'Workflows',
    milestone: true,
    title: 'Workflow Catalogue Foundation',
    impact: 'Prymal now has the foundation for curated workflow discovery, installation, and reviewed community submissions.',
    entries: [
      'Rebuilt the landing experience around business execution, workflows, memory, validation, and cost control.',
      'Added Simple Mode and Advanced Mode so new users can start with a guided task and grow into deeper workflows when ready.',
      'Introduced real example outputs that show how Prymal turns a request into structured, usable business work.',
      'Strengthened pricing and usage clarity around execution credits, AI video credits, add-on packs, and team-scale governance.',
      'Prepared production billing configuration for Founding Access and preferred usage packs while keeping plan limits server-enforced.',
      'Added Workflow Catalogue foundations for official workflows, free installs, creator drafts, submissions, and staff approval review.',
      'Expanded the official Workflow Catalogue with deeper coverage across content, marketing, sales, agencies, support, finance, automation, research, and strategy.',
      'Added Prymal-branded transactional emails for onboarding, invites, billing, usage alerts, Founder Access, and workflow installs.',
    ],
  },
  {
    version: '1.0.2',
    date: '2026-04-29',
    tag: 'Update',
    badge: 'Billing',
    milestone: true,
    title: 'Pricing + Entitlement Alignment',
    impact: 'Public pricing, billing docs, and Stripe setup now match the current enforced plan catalog.',
    entries: [
      'Aligned public pricing copy around Solo, Pro, Teams, and Agency with execution credits, AI video credits, seats, and concurrency limits.',
      'Documented Founding Access as a first-3-month subscription discount with standard usage limits and server-side eligibility enforcement.',
      'Clarified that usage packs add short-burst execution or AI video capacity without removing fair-use, plan, or concurrency controls.',
      'Updated Stripe setup notes for standard prices, Founding Access prices, credit-pack prices, Teams seat add-ons, and webhook events.',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-04-24',
    tag: 'Update',
    badge: 'Media',
    milestone: true,
    title: 'Guided Media Builders + Veo Standard',
    impact: 'Media generation is now structured, predictable, and production-ready inside the workspace.',
    entries: [
      'Introduced guided `/image` and `/video` builders with structured controls for prompt, quality, size, duration, aspect ratio, and output settings.',
      'Added dual render lanes: Fast Draft on Veo 3.1 Lite and Cinematic on Veo 3.1 Standard.',
      'Standard-mode renders now support up to three reference images on 8-second jobs for stronger visual direction.',
      'Media builders now show prompt-token and credit estimates before submission, with final checks remaining server-authoritative.',
      'Generated video cards now show render lane, duration, aspect ratio, resolution, and reference-image count directly in chat artifacts.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-04-17',
    tag: 'Milestone',
    badge: 'GA',
    milestone: true,
    title: 'Prymal 1.0 -  Platform Complete',
    impact: 'Prymal moved from build-phase platform into a paid-workspace product ready for live operators.',
    entries: [
      'Prymal is now generally available with 14 user-facing specialist agents, SENTINEL QA, hybrid RAG, workflows, and operator controls live.',
      'Billing tiers finalised across Free, Solo, Pro, Teams, and Agency with enforced seats, credits, and agent access boundaries.',
      'Voice input is available when OpenAI voice services are configured, with realtime WebRTC and recording fallback paths in the workspace.',
      'Public changelog, pricing, and waitlist pages are canonical, indexed, and supported by JSON-LD schema.',
      'The Prymal premium motion system now ships across all workspace surfaces with reduced-motion support.',
    ],
  },
  {
    version: '0.9.9',
    date: '2026-04-10',
    tag: 'Performance',
    badge: 'Speed',
    title: 'Performance Pass + Accessibility',
    impact: 'The product now feels faster, cleaner, and more trustworthy across core workspace interactions.',
    entries: [
      'Framer Motion was tree-shaken to LazyMotion with domAnimation, reducing initial JavaScript payload.',
      'GSAP ScrollTrigger now loads asynchronously and only runs when reduced-motion preference is inactive.',
      'Interactive elements now meet WCAG 2.1 AA contrast and focus-visible requirements.',
      'Keyboard navigation verified across the command palette, workflow builder, and agent sidebar.',
      'Bundle analysis added to CI with warnings for main chunk regressions over 15 kB.',
    ],
  },
  {
    version: '0.9.8',
    date: '2026-04-03',
    tag: 'Admin',
    badge: 'Trace',
    title: 'Admin Motion + Trace Drilldowns',
    impact: 'Operators can now understand system activity, failures, and retrieval quality with far less friction.',
    entries: [
      'Admin overview, billing, workflow ops, trace center, and audit drawer now use staggered motion primitives.',
      'Trace detail drawer now exposes retrieval diagnostics including similarity, score, freshness, authority, and stale warnings.',
      'Action receipt drawer now animates immutable log headers and before/after diff rows.',
      'Workspace command palette results now animate with a 40ms stagger.',
      'Failed workflow run items now reveal progressively to reduce cognitive load.',
    ],
  },
  {
    version: '0.9.7',
    date: '2026-03-28',
    tag: 'Motion',
    badge: 'Marketing',
    title: 'Landing Page GSAP + Marketing Motion',
    impact: 'The public site now communicates Prymal as a premium, cinematic AI operating system.',
    entries: [
      'GSAP ScrollTrigger parallax added to showcase visuals.',
      'Hero copy now enters with staggered cinematic timing.',
      'Scroll-driven narrative animation added.',
      'GSAP context cleanup prevents leaks.',
      'GSAP isolated to marketing pages only.',
    ],
  },
  {
    version: '0.9.6',
    date: '2026-03-21',
    tag: 'QoL',
    badge: 'Workspace',
    title: 'Agent Profile + Workspace Motion System',
    impact: 'Agent interactions now feel more alive, continuous, and connected to the Prymal brand system.',
    entries: [
      'Agent profile cinematic backgrounds added.',
      'Chat message animations improved.',
      'Streaming responses feel continuous.',
      'Composer + attachments animated.',
      'LORE + workflow UI unified.',
    ],
  },
  {
    version: '0.9.5',
    date: '2026-03-14',
    tag: 'Platform',
    badge: 'Motion',
    title: 'Premium Motion System Foundation',
    impact: 'Prymal gained a reusable motion language across all surfaces.',
    entries: [
      'Full motion system introduced.',
      'Centralised animation tokens.',
      'Reduced motion support added.',
      'Sidebar motion improvements.',
      'SENTINEL badge animations added.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-03-05',
    tag: 'Automation',
    badge: 'Workflows',
    milestone: true,
    title: 'Workflow Visual Builder + Admin Monitoring',
    impact: 'Prymal became more than chat — users can now build and operate workflows.',
    entries: [
      'Drag-and-drop workflow builder added.',
      'Admin monitoring tools introduced.',
      'Plan-based agent gating enforced.',
      'LORE metadata expanded.',
      'Changelog launched.',
    ],
  },
  {
    version: '0.8.2',
    date: '2026-02-18',
    tag: 'Fix',
    badge: 'Patch',
    title: 'Power-Up Studio Patch',
    impact: 'Power-Up system consistency restored.',
    entries: [
      'Fixed missing prompts.',
      'Synced templates frontend/backend.',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-02-01',
    tag: 'Update',
    badge: 'Reasoning',
    title: 'SAGE Extended Thinking',
    impact: 'Agents now produce deeper strategic outputs.',
    entries: [
      'Extended thinking added.',
      'CIPHER upgraded.',
      'Tests expanded.',
      'Atlas output improved.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-01-10',
    tag: 'Automation',
    badge: 'NEXUS',
    title: 'Workflow Engine',
    impact: 'Automation gained execution structure and observability.',
    entries: [
      'Trigger system added.',
      'Run queue introduced.',
      'Execution safety improved.',
      'Admin metrics added.',
    ],
  },
  {
    version: '0.6.0',
    date: '2025-12-20',
    tag: 'Knowledge',
    badge: 'LORE',
    title: 'Knowledge Base',
    impact: 'Agents gained memory and retrieval.',
    entries: [
      'LORE introduced.',
      'Semantic search added.',
      'Integrations expanded.',
      'Source attribution added.',
    ],
  },
  {
    version: '0.5.0',
    date: '2025-12-01',
    tag: 'Milestone',
    badge: 'Foundation',
    milestone: true,
    title: 'Initial Platform Release',
    impact: 'Core system launched.',
    entries: [
      'Agents introduced.',
      'Billing added.',
      'Teams system added.',
      'Credit system enforced.',
    ],
  },
];

const TAG_COLORS = {
  Milestone: '#A78BFA',
  Update: '#4CC9F0',
  QoL: '#22C55E',
  Performance: '#FACC15',
  Fix: '#F59E0B',
  Platform: '#38BDF8',
  Admin: '#FB7185',
  Motion: '#C084FC',
  Automation: '#2DD4BF',
  Knowledge: '#60A5FA',
};


export default function Changelog() {
  const reducedMotion = usePrymalReducedMotion();

  const trackSignup = () => {
    if (typeof window !== 'undefined' && typeof window.prymalTrack === 'function') {
      window.prymalTrack('signup_button_clicked', { source: 'changelog' });
    }
  };

  const sortedChangelog = [...CHANGELOG].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="marketing-page prymal-marketing pm-page pm-changelog-page">
      <PageMeta
        title="Changelog — Prymal"
        description="Follow Prymal's product evolution: agents, workflows, media generation, platform reliability, and AI workspace improvements."
        canonicalPath="/changelog"
      />

      <MagicalCanvas reducedMotion={reducedMotion} />

      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="changelog" onSignupClick={trackSignup} />

        <PageShell width="980px">
          <div className="pm-page__inner pm-changelog-shell">
            <MotionSection reveal={{ y: 24, blur: 10 }}>
              <header className="pm-changelog-hero">
                <div className="pm-page-header__eyebrow">
                  <span className="pm-hero__badge-dot" />
                  Product evolution
                </div>

                <h1 className="pm-changelog-hero__title">What’s new in Prymal</h1>

                <p className="pm-changelog-hero__sub">
                  A polished release timeline covering agents, workflows, media generation,
                  retrieval, motion, billing, and platform reliability.
                </p>

                <div className="pm-changelog-hero__actions">
                  <Link to="/signup" className="pm-btn pm-btn--primary" onClick={trackSignup}>
                    Start free →
                  </Link>
                  <Link to="/pricing" className="pm-btn pm-btn--ghost">
                    View pricing
                  </Link>
                </div>

                <div className="pm-changelog-stats">
                  <div>
                    <strong>{CHANGELOG.length}</strong>
                    <span>releases logged</span>
                  </div>
                  <div>
                    <strong>15</strong>
                    <span>specialist agents</span>
                  </div>
                  <div>
                    <strong>1.0</strong>
                    <span>general availability</span>
                  </div>
                </div>
              </header>
            </MotionSection>

            <MotionSection reveal={{ y: 20, blur: 8 }}>
              <div className="pm-changelog-timeline">
                {sortedChangelog.map((entry, index) => {
                  const accent = TAG_COLORS[entry.tag] ?? '#00FFD1';

                  return (
                    <article
                      key={entry.version}
                      className={`pm-changelog-card ${
                        entry.milestone ? 'pm-changelog-card--milestone' : ''
                      }`}
                      style={{ '--entry-accent': accent }}
                    >
                      <div className="pm-changelog-card__rail">
                        <span className="pm-changelog-card__node" />
                        {index !== sortedChangelog.length - 1 && (
                          <span className="pm-changelog-card__line" />
                        )}
                      </div>

                      <div className="pm-changelog-card__body">
                        <div className="pm-changelog-card__top">
                          <div className="pm-changelog-card__version">
                            <span>v{entry.version}</span>
                            <time dateTime={entry.date}>{entry.date}</time>
                          </div>

                          <div className="pm-changelog-card__badges">
                            <span className="pm-changelog-card__badge">{entry.badge}</span>
                            <span className="pm-changelog-card__tag">{entry.tag}</span>
                          </div>
                        </div>

                        <h2 className="pm-changelog-card__title">{entry.title}</h2>

                        <p className="pm-changelog-card__impact">{entry.impact}</p>

                        <ul className="pm-changelog-card__list">
                          {entry.entries.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </article>
                  );
                })}
              </div>
            </MotionSection>
          </div>
        </PageShell>

        <PublicPageFooter sourcePrefix="changelog" onSignupClick={trackSignup} />
      </div>
    </div>
  );
}

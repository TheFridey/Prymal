import { Link } from 'react-router-dom';
import { Button, PageHeader, PageShell, Reveal, SurfaceCard } from '../components/ui';
import { PageMeta, PublicPageFooter, PublicPageNavbar } from '../components/PublicPageChrome';

const CHANGELOG = [
  {
    version: '1.0.0',
    date: '2026-05-17',
    tag: 'Release',
    title: 'General Availability — Prymal 1.0',
    entries: [
      'Prymal is now generally available. All 15 specialist agents, hybrid RAG, SENTINEL QA, workflow orchestration, and the operator control plane are live for paid workspaces.',
      'Billing tiers finalised: Free, Solo, Pro, Teams, and Agency. Seat limits, credit caps, and agent access gates are fully enforced across all plan boundaries.',
      'Realtime voice is enabled on Pro and above. Push-to-talk and voice activity detection are routed through the ECHO agent with sub-300ms latency on supported browsers.',
      'Public-facing changelog, pricing page, and waitlist are indexed and canonical. JSON-LD schema is present on all marketing routes.',
      'All workspace surfaces ship with the Prymal premium motion system. Reduced-motion preference is honoured across every animated component.',
    ],
  },
  {
    version: '0.9.9',
    date: '2026-05-10',
    tag: 'Release',
    title: 'Performance Pass + Accessibility',
    entries: [
      'Framer Motion tree-shaken to LazyMotion with domAnimation feature set. Initial JS payload reduced by approximately 18 kB gzipped.',
      'GSAP ScrollTrigger imported asynchronously and only instantiated when reduced-motion preference is not active.',
      'All interactive elements pass WCAG 2.1 AA contrast and focus-visible requirements. Keyboard navigation verified across the command palette, workflow builder, and agent sidebar.',
      'Agent avatar fallback renders initials when no image URL is set, eliminating broken-image states in new workspaces.',
      'Bundle analysis added to CI. Any PR that increases the main chunk by more than 15 kB triggers a size-check warning.',
    ],
  },
  {
    version: '0.9.8',
    date: '2026-05-03',
    tag: 'Release',
    title: 'Admin Motion + Trace Drilldowns',
    entries: [
      'Admin overview, billing, workflow ops, trace center, and audit drawer surfaces now use MotionList and MotionListItem for staggered entrance animations.',
      'Trace detail drawer exposes retrieval diagnostics: per-source similarity, final score, freshness, authority, and stale warnings side by side.',
      'Action receipt drawer wraps the immutable log header in a reveal section and animates before/after diff rows on open.',
      'Workspace command palette results now animate in with MotionListItem stagger at 40ms intervals.',
      'Failed workflow run items in the ops tab stagger into view to reduce cognitive load when multiple failures surface at once.',
    ],
  },
  {
    version: '0.9.7',
    date: '2026-04-26',
    tag: 'Release',
    title: 'Landing Page GSAP + Marketing Motion',
    entries: [
      'GSAP ScrollTrigger parallax applied to showcase section visuals. Each product video column moves at a separate depth layer as the user scrolls.',
      'Hero copy children animate in with a staggered power3.out ease on page load. Forest layer parallax runs on three depth planes.',
      'Ivy stem growth animation tied to scroll position via scrub. Cards along the primal operating loop reveal as the stem reaches each node.',
      'GSAP context cleanup runs on component unmount, preventing ScrollTrigger leaks across hot-module reloads in development.',
      'All GSAP usage is scoped to marketing pages only. Workspace and admin surfaces use Framer Motion exclusively.',
    ],
  },
  {
    version: '0.9.6',
    date: '2026-04-19',
    tag: 'Release',
    title: 'Agent Profile + Workspace Motion System',
    entries: [
      'Agent profile pages render a CinematicHeroScene backdrop with layered depth and an ambient pulse tied to the agent colour token.',
      'Workspace chat messages animate in with MotionListItem. Streaming messages use a tighter reveal so the typing state feels continuous.',
      'MessageInput composer uses MotionPanel for a soft entrance. Attachment chips and voice status indicators mount and unmount with MotionPresence.',
      'Lore document inventory and search results use MotionList with a 40ms stagger. Empty states use MotionSection with a blur reveal.',
      'Webhook subscription rows, form expansion, and secret reveal blocks in the workflow panel are all gated behind MotionPresence.',
    ],
  },
  {
    version: '0.9.5',
    date: '2026-04-12',
    tag: 'Release',
    title: 'Premium Motion System Foundation',
    entries: [
      'Introduced the Prymal motion system: MotionProvider, MotionPage, MotionSection, MotionList, MotionListItem, MotionCard, MotionPanel, MotionStat, MotionTimelineItem, MotionDrawer, and MotionModal.',
      'All motion tokens (durations, easings, springs, staggers) centralised in motion.js. MOTION_STAGGERS provides dense (40ms), comfortable (75ms), and narrative (120ms) presets.',
      'usePrymalReducedMotion hook reads the OS preference and short-circuits all variants to instant when active.',
      'AgentSidebar now uses MotionPanel for the outer shell and MotionList for conversation history. Editing mode toggle animates with MotionPresence.',
      'Schema validation badges and SENTINEL review badges in the chat renderer reveal with a 150ms delay after the message content settles.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-04-05',
    tag: 'Release',
    title: 'Workflow Visual Builder + Admin Monitoring',
    entries: [
      'Added a drag-and-drop visual workflow builder powered by React Flow. Drag agents from the panel, connect steps, and save as a named workflow without writing JSON.',
      'Three new admin-only tabs: Audit Log viewer, Credit Usage monitor with per-org consumption bars, and Product Events feed.',
      'Extended thinking now gates to Pro, Teams, and Agency plans. Free and Solo workspaces route SAGE and CIPHER through standard Sonnet.',
      'LORE document cards now display word count and last-indexed timestamp. URL source type is visible in the document metadata.',
      'Public changelog page added at prymal.io/changelog.',
    ],
  },
  {
    version: '0.8.2',
    date: '2026-03-18',
    tag: 'Fix',
    title: 'Power-Up Studio Patch',
    entries: [
      'Fixed a disconnect where the Power-Up library in the workspace studio was missing the prompt field, causing empty drafts when navigating from the agent profile page.',
      'All eleven built-in Power-Ups now have correct prompt templates synced between the frontend library and the backend definition.',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-03-01',
    tag: 'Release',
    title: 'SAGE Extended Thinking + Entitlement Tests',
    entries: [
      'SAGE now uses Anthropic extended thinking via claude-opus-4-6 on qualifying plans, improving strategic analysis and SWOT output quality.',
      'CIPHER extended thinking budget increased from 8,000 to 12,000 tokens for deeper data analysis tasks.',
      'Expanded unit test coverage for entitlements (plan config, agent access gates, credit assertion) and billing (webhook signature validation).',
      'Atlas agent max response tokens increased to 12,000 to support longer cross-document synthesis.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-02-10',
    tag: 'Release',
    title: 'NEXUS Workflows and Run History',
    entries: [
      'Workflow definitions now support four trigger types: manual, schedule (cron), webhook, and event.',
      'Live run queue with per-node status, execution log, and token usage per step.',
      'Topological sort ensures nodes execute in dependency order. Cycle detection prevents invalid graphs from being saved.',
      'Admin overview includes document queue, workflow load, and active integration counts.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-01-20',
    tag: 'Release',
    title: 'LORE Knowledge Base + Integrations',
    entries: [
      'LORE knowledge base supports plain text, Markdown, and CSV document types. Text and URL sources can be ingested directly from the workspace.',
      'pgvector semantic search retrieves up to 6 relevant chunks per agent query with source attribution.',
      'Integration manager tracks connection state, last synced timestamp, and per-integration credentials.',
      'Agent responses that draw from LORE now include a sources panel showing the matched document titles.',
    ],
  },
  {
    version: '0.5.0',
    date: '2025-12-01',
    tag: 'Release',
    title: 'Multi-Agent Workspace + Billing',
    entries: [
      'Eleven specialist agents now available: CIPHER, HERALD, FORGE, ECHO, ORACLE, WREN, VANCE, LEDGER, SCOUT, SAGE, and LORE.',
      'Stripe billing integration with monthly, quarterly, and yearly intervals. Webhook handler applies plan changes in real time.',
      'Seat management and organisation invitations. Owners can invite members and control access to agent capabilities per plan.',
      'Credit system enforces monthly usage limits. Over-limit requests return a 402 with an upgrade prompt.',
    ],
  },
];

const TAG_COLORS = {
  Release: '#00FFD1',
  Fix: '#F59E0B',
  Beta: '#4CC9F0',
};

export default function Changelog() {
  const trackSignup = () => {
    if (typeof window !== 'undefined' && typeof window.prymalTrack === 'function') {
      window.prymalTrack('signup_button_clicked', { source: 'changelog' });
    }
  };

  return (
    <div className="marketing-page prymal-marketing prymal-use-case-page prymal-use-case-page--legal">
      <PageMeta
        title="Changelog — Prymal"
        description="A running log of what has shipped in Prymal: new agents, features, fixes, and platform improvements."
        canonicalPath="/changelog"
      />
      <div className="prymal-marketing__aura prymal-marketing__aura--one" />
      <div className="prymal-marketing__aura prymal-marketing__aura--two" />
      <div className="marketing-shell prymal-marketing__shell">
        <PublicPageNavbar sourcePrefix="changelog" onSignupClick={trackSignup} />

        <PageShell width="780px">
          <div style={{ display: 'grid', gap: '24px' }}>
            <PageHeader
              eyebrow="CHANGELOG"
              title="What has shipped"
              description="A running record of new features, improvements, and fixes across the Prymal platform."
              actions={
                <Link to="/signup" onClick={trackSignup}>
                  <Button tone="accent">Start free</Button>
                </Link>
              }
            />

            <div style={{ display: 'grid', gap: '16px' }}>
              {CHANGELOG.map((entry, index) => (
                <Reveal key={entry.version} delay={index * 40}>
                  <SurfaceCard
                    title={
                      <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>{entry.title}</span>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            border: `1px solid ${TAG_COLORS[entry.tag] ?? 'var(--line)'}44`,
                            color: TAG_COLORS[entry.tag] ?? 'var(--muted)',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {entry.tag}
                        </span>
                      </span>
                    }
                    subtitle={`v${entry.version} · ${entry.date}`}
                    accent={TAG_COLORS[entry.tag] ?? 'rgba(78, 205, 196, 0.4)'}
                  >
                    <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'grid', gap: '8px', color: 'var(--muted)', lineHeight: 1.8 }}>
                      {entry.entries.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </SurfaceCard>
                </Reveal>
              ))}
            </div>
          </div>
        </PageShell>

        <PublicPageFooter sourcePrefix="changelog" onSignupClick={trackSignup} />
      </div>
    </div>
  );
}

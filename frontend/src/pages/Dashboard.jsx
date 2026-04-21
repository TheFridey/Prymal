import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { AgentAvatar, Button, EmptyState, PageShell } from '../components/ui';
import { MotionSection, usePrymalReducedMotion } from '../components/motion';
import {
  AGENT_UI_LAYERS,
  getAgentMeta,
  getAgentUiLayerId,
  getRecommendedAgentsForWorkspaceProfile,
  getWorkspacePlanMeta,
  sortAgentsByUiHierarchy,
} from '../lib/constants';
import { api } from '../lib/api';
import '../styles/app-rebuild.css';

const FIRST_WIN_LIBRARY = {
  nexus: {
    summary: 'Sketch an orchestration that chains the right specialists with clear handoffs.',
    message: 'Help me design a simple workflow: pull context from LORE, draft with FORGE, then quality-check before send.',
  },
  cipher: {
    summary: 'Analyse a set of numbers, spot anomalies, and explain what changed.',
    message: 'Review this week\'s key business metrics and tell me what changed, what matters, and what I should do next.',
  },
  herald: {
    summary: 'Draft a strong outbound or follow-up email in your business tone.',
    message: 'Write a follow-up email I can send to a warm lead who has gone quiet after showing interest.',
  },
  forge: {
    summary: 'Turn a rough brief into polished content or landing-page copy.',
    message: 'Turn my service offer into a clear homepage section with headline, proof, and CTA.',
  },
  atlas: {
    summary: 'Translate messy tasks into a concrete operating plan with next steps.',
    message: 'Turn my current priorities into a simple project plan with owners, deadlines, and risks.',
  },
  wren: {
    summary: 'Draft calm, customer-friendly support replies you can send immediately.',
    message: 'Draft a helpful support response for a customer asking why their order is delayed and what happens next.',
  },
  oracle: {
    summary: 'Surface obvious SEO and search-intent opportunities from your site or offer.',
    message: 'Review my offer and tell me which search terms and landing-page angles I should prioritise first.',
  },
  ledger: {
    summary: 'Turn raw numbers into a report the business can actually act on.',
    message: 'Create a simple executive update from this week\'s revenue, costs, and pipeline activity.',
  },
  vance: {
    summary: 'Package work into a proposal or commercial next step.',
    message: 'Draft a concise proposal outline for a new client project based on the deliverables I provide.',
  },
  echo: {
    summary: 'Break one idea into channel-ready posts and campaign variants.',
    message: 'Turn one campaign idea into five social posts and a short launch sequence.',
  },
  lore: {
    summary: 'Anchor your next output in company context, notes, and uploaded knowledge.',
    message: 'Show me what business context or SOPs I should upload first so Prymal can produce better work.',
  },
};

function timeAgo(dateString) {
  if (!dateString) return 'No recent activity';
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function DashWorkflowPlate({ workflows, highlightAgentId }) {
  const wf = workflows.find((w) => w.isActive) ?? workflows[0];
  if (!wf?.nodes?.length) {
    return (
      <div className="pm-dash__flow-plate pm-dash__flow-plate--empty">
        <div>
          <div className="pm-dash__flow-empty-title">Active workflow</div>
          <p className="pm-dash__flow-empty-copy">Configure a graph in NEXUS to see agents light up here as the system runs.</p>
        </div>
        <Link to="/app/workflows" className="pm-dash__flow-empty-cta">Open NEXUS →</Link>
      </div>
    );
  }

  return (
    <div className="pm-dash__flow-plate">
      <div className="pm-dash__flow-head">
        <div>
          <div className="pm-dash__flow-eyebrow">Live graph</div>
          <div className="pm-dash__flow-title">{wf.name}</div>
        </div>
        <Link to="/app/workflows" className="pm-dash__card-link">Inspect →</Link>
      </div>
      <div className="pm-dash__flow-track" aria-label="Workflow nodes">
        {wf.nodes.map((node, i) => {
          const meta = getAgentMeta(node.agentId);
          const layer = getAgentUiLayerId(node.agentId) ?? 'other';
          const hot = Boolean(highlightAgentId && node.agentId === highlightAgentId);
          return (
            <div key={node.id ?? `${wf.id}-${i}`} className="pm-dash__flow-node-wrap">
              {i > 0 ? <span className="pm-dash__flow-edge" aria-hidden="true" /> : null}
              <div className={`pm-dash__flow-node pm-dash__flow-node--${layer}${hot ? ' is-hot' : ''}`}>
                <AgentAvatar agent={meta} size={40} active={hot} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function mergeUniqueAgents(agentLists, limit = 6) {
  const seen = new Set();
  const merged = [];
  for (const list of agentLists) {
    for (const agent of list) {
      if (!agent || seen.has(agent.id)) continue;
      seen.add(agent.id);
      merged.push(agent);
      if (merged.length >= limit) return merged;
    }
  }
  return merged;
}

export default function Dashboard() {
  const { viewer, agents } = useOutletContext();
  const location = useLocation();
  const navigate = useNavigate();

  const workspaceProfile = location.state?.onboardingWorkspaceProfile ?? viewer?.organisation?.metadata ?? {};
  const recommendedAgentIds =
    location.state?.recommendedAgentIds ??
    getRecommendedAgentsForWorkspaceProfile(workspaceProfile).map((agent) => agent.id);

  const recommendedAgents = useMemo(
    () => recommendedAgentIds.map((agentId) => getAgentMeta(agentId)).filter(Boolean).slice(0, 4),
    [recommendedAgentIds],
  );

  const recommendedFirstAgentId = location.state?.recommendedFirstAgentId ?? recommendedAgents[0]?.id ?? 'cipher';
  const conversationCount = Number(viewer?.stats?.conversationCount ?? 0);
  const currentPlan = viewer?.organisation?.plan ?? 'free';
  const planMeta = getWorkspacePlanMeta(currentPlan);
  const orgName = viewer?.organisation?.name ?? 'your workspace';
  const isStaff = Boolean(viewer?.staff?.isStaff);

  const conversationsQuery = useQuery({
    queryKey: ['dashboard-recent-conversations'],
    queryFn: () => api.get('/agents/conversations?limit=6'),
  });

  const workflowsQuery = useQuery({
    queryKey: ['dashboard-workflows'],
    queryFn: () => api.get('/workflows'),
  });

  const recentConversations = conversationsQuery.data?.conversations ?? [];
  const workflows = workflowsQuery.data?.workflows ?? [];
  const activeWorkflows = workflows.filter((workflow) => workflow.isActive);
  const latestConversation = recentConversations[0] ?? null;

  const recentConversationAgents = useMemo(
    () => recentConversations.map((conv) => getAgentMeta(conv.agentId)).filter(Boolean),
    [recentConversations],
  );

  const topAgents = useMemo(
    () => mergeUniqueAgents([recentConversationAgents, agents ?? [], recommendedAgents], 6),
    [agents, recentConversationAgents, recommendedAgents],
  );

  const missionAgents = conversationCount === 0 ? recommendedAgents : topAgents.slice(0, 3);

  const [commandDraft, setCommandDraft] = useState('');
  const [specialistsOpen, setSpecialistsOpen] = useState(false);

  const unlockedSorted = useMemo(
    () => (agents ?? []).filter((a) => !a.locked).sort(sortAgentsByUiHierarchy),
    [agents],
  );

  const coreLaneAgents = useMemo(
    () => AGENT_UI_LAYERS.core.map((id) => getAgentMeta(id)).filter(Boolean),
    [],
  );

  const secondaryAgents = useMemo(
    () => unlockedSorted.filter((a) => !AGENT_UI_LAYERS.core.includes(a.id)),
    [unlockedSorted],
  );

  const specialistAgents = useMemo(
    () => secondaryAgents.filter((a) => AGENT_UI_LAYERS.specialist.includes(a.id)),
    [secondaryAgents],
  );

  const nonSpecialistSecondary = useMemo(
    () => secondaryAgents.filter((a) => !AGENT_UI_LAYERS.specialist.includes(a.id)),
    [secondaryAgents],
  );

  const atlasThreads = useMemo(
    () => recentConversations.filter((c) => c.agentId === 'atlas').slice(0, 4),
    [recentConversations],
  );

  const handleNexusSubmit = useCallback(
    (event) => {
      event.preventDefault();
      const text = commandDraft.trim();
      if (text) {
        navigate(`/app/agents/nexus?new=1&draft=${encodeURIComponent(text)}`);
        return;
      }
      navigate('/app/workflows');
    },
    [commandDraft, navigate],
  );

  const heroPrimaryAction = latestConversation
    ? () => navigate(`/app/agents/${latestConversation.agentId}?cid=${latestConversation.id}`)
    : () => navigate(`/app/agents/${recommendedFirstAgentId}`);

  const heroPrimaryLabel = latestConversation ? 'Resume latest conversation' : `Open ${recommendedAgents[0]?.name ?? 'Prymal'}`;

  return (
    <PageShell width="1260px">
      <div className="pm-dash">

        {/* ── Command deck + workflow plate ── */}
        <section className="pm-dash__hero">
          <div className="pm-dash__hero-ambient" aria-hidden="true" />
          <div className="pm-dash__hero-content pm-dash__hero-content--stacked">
            <MotionSection delay={0.04} reveal={{ y: 16, blur: 8 }} className="pm-dash__identity-block">
              <div className="pm-dash__badge">
                <span className="pm-dash__badge-dot" />
                {planMeta?.name ?? currentPlan} plan · {conversationCount > 0 ? `${conversationCount} conversation${conversationCount === 1 ? '' : 's'}` : 'ready for first output'}
              </div>

              <h1 className="pm-dash__headline">
                {conversationCount === 0
                  ? <>Launch your first <span>operating lane.</span></>
                  : <>Mission control for <span>{orgName}.</span></>}
              </h1>

              <p className="pm-dash__sub">
                {conversationCount === 0
                  ? 'NEXUS orchestrates, ATLAS sequences work, LORE grounds context — everything else slots in as depth.'
                  : 'Command from NEXUS, track delivery in ATLAS, and watch the active graph highlight where attention is flowing.'}
              </p>

              <div className="pm-dash__actions">
                <button type="button" className="pm-btn pm-btn--primary" onClick={heroPrimaryAction}>
                  {heroPrimaryLabel} →
                </button>
                <button type="button" className="pm-btn pm-btn--ghost" onClick={() => navigate('/app/workflows')}>
                  Open NEXUS
                </button>
                <button type="button" className="pm-btn pm-btn--ghost" onClick={() => navigate('/app/lore')}>
                  LORE
                </button>
              </div>

              <div className="pm-dash__stats">
                <div className="pm-dash__stat"><span>Conversations</span><strong>{conversationCount}</strong></div>
                <div className="pm-dash__stat"><span>Workflows</span><strong>{workflows.length}</strong></div>
                <div className="pm-dash__stat"><span>Active</span><strong>{activeWorkflows.length}</strong></div>
                <div className="pm-dash__stat"><span>Plan</span><strong>{planMeta?.name ?? currentPlan}</strong></div>
              </div>

              <div className="pm-dash__trust">
                <span className="pm-dash__trust-chip">SENTINEL gated</span>
                <span className="pm-dash__trust-chip">LORE grounded</span>
                <span className="pm-dash__trust-chip">Voice ready</span>
                <span className="pm-dash__trust-chip">Webhook receipts</span>
              </div>
            </MotionSection>

            <div className="pm-dash__command-deck">
              <MotionSection delay={0.08} reveal={{ y: 18, blur: 8 }} className="pm-dash__nexus-panel">
                <div className="pm-dash__nexus-panel-head">
                  <span className="pm-dash__nexus-kicker">NEXUS</span>
                  <span className="pm-dash__nexus-caption">Primary command surface</span>
                </div>
                <form className="pm-dash__nexus-form" onSubmit={handleNexusSubmit}>
                  <label className="pm-dash__nexus-label" htmlFor="dash-nexus-command">
                    Describe the outcome or workflow move
                  </label>
                  <div className="pm-dash__nexus-field">
                    <input
                      id="dash-nexus-command"
                      className="pm-dash__nexus-input"
                      value={commandDraft}
                      onChange={(e) => setCommandDraft(e.target.value)}
                      placeholder="e.g. Weekly client report with metrics, narrative, and send-ready email…"
                      autoComplete="off"
                    />
                    <button type="submit" className="pm-dash__nexus-submit">
                      Run
                    </button>
                  </div>
                  <div className="pm-dash__nexus-meta">
                    <span>Empty submit opens the graph editor</span>
                    <button type="button" className="pm-dash__nexus-linkish" onClick={() => navigate('/app/agents/nexus?new=1')}>
                      New NEXUS thread
                    </button>
                  </div>
                </form>
              </MotionSection>

              <MotionSection delay={0.1} reveal={{ y: 18, blur: 8 }} className="pm-dash__atlas-panel">
                <div className="pm-dash__atlas-head">
                  <div>
                    <span className="pm-dash__atlas-kicker">ATLAS</span>
                    <span className="pm-dash__atlas-caption">Task lane</span>
                  </div>
                  <Link to="/app/agents/atlas" className="pm-dash__card-link">Open →</Link>
                </div>
                {atlasThreads.length === 0 ? (
                  <p className="pm-dash__atlas-empty">No ATLAS threads yet. Open ATLAS to turn ambiguity into milestones and owners.</p>
                ) : (
                  <ul className="pm-dash__atlas-list">
                    {atlasThreads.map((conversation) => (
                      <li key={conversation.id}>
                        <button
                          type="button"
                          className="pm-dash__atlas-row"
                          onClick={() => navigate(`/app/agents/atlas?cid=${conversation.id}`)}
                        >
                          <span className="pm-dash__atlas-title">{conversation.title ?? 'Planning thread'}</span>
                          <span className="pm-dash__atlas-time">{timeAgo(conversation.lastActiveAt)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </MotionSection>
            </div>

            <MotionSection delay={0.12} reveal={{ y: 20, blur: 8 }} className="pm-dash__flow-section">
              <DashWorkflowPlate workflows={workflows} highlightAgentId={latestConversation?.agentId} />
            </MotionSection>

            <MotionSection className="pm-dash__posture pm-dash__posture--wide" delay={0.14} reveal={{ y: 14, blur: 6 }}>
              <div className="pm-dash__posture-card">
                <strong>Workspace posture</strong>
                <span>
                  {conversationCount === 0
                    ? 'Ready for the first useful output. Start with the lane most likely to produce an immediate result.'
                    : 'Live context available. Resume conversations and push workflows forward.'}
                </span>
              </div>
              <div className="pm-dash__posture-card">
                <strong>Fast lanes</strong>
                <div className="pm-dash__posture-pills">
                  {missionAgents.map((agent) => (
                    <span key={agent.id} className="pm-dash__posture-pill">{agent.name}</span>
                  ))}
                </div>
              </div>
              <div className="pm-dash__posture-card">
                <strong>System signals</strong>
                <small>
                  {activeWorkflows.length} active workflow{activeWorkflows.length === 1 ? '' : 's'} · {recentConversations.length} recent thread{recentConversations.length === 1 ? '' : 's'} · {isStaff ? 'admin available' : 'operator mode'}
                </small>
              </div>
            </MotionSection>
          </div>
        </section>

        {/* ── Cards Grid ── */}
        <div className="pm-dash__grid">

          {/* Missions */}
          <div className="pm-dash__card pm-dash__card--full" style={{ '--card-accent': '#68f5d0' }}>
            <div className="pm-dash__card-header">
              <div>
                <div className="pm-dash__card-eyebrow">{conversationCount === 0 ? 'First wins' : 'Suggested missions'}</div>
                <h2 className="pm-dash__card-title">Start from a strong operating prompt.</h2>
              </div>
              <Link to={`/app/agents/${recommendedFirstAgentId}`} className="pm-dash__card-link">Open recommended lane →</Link>
            </div>
            <div className="pm-dash__mission-grid">
              {missionAgents.map((agent) => {
                const starter = FIRST_WIN_LIBRARY[agent.id] ?? FIRST_WIN_LIBRARY.cipher;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    className="pm-dash__mission"
                    style={{ '--agent-color': agent.color }}
                    onClick={() => navigate(`/app/agents/${agent.id}?new=1&draft=${encodeURIComponent(starter.message)}`)}
                  >
                    <div className="pm-dash__mission-top">
                      <AgentAvatar agent={agent} size={52} active />
                      <div>
                        <div className="pm-dash__mission-name">{agent.name}</div>
                        <div className="pm-dash__mission-role">{agent.title}</div>
                      </div>
                    </div>
                    <p>{starter.summary}</p>
                    <div className="pm-dash__mission-prompt">"{starter.message}"</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent conversations */}
          <div className="pm-dash__card" style={{ '--card-accent': '#7f8cff' }}>
            <div className="pm-dash__card-header">
              <div>
                <div className="pm-dash__card-eyebrow">Recent conversations</div>
                <h2 className="pm-dash__card-title">Pick up active threads.</h2>
              </div>
            </div>
            {recentConversations.length === 0 ? (
              <EmptyState title="No conversations yet" description="The first thread appears once you send a message." accent="#7f8cff" />
            ) : (
              <div className="pm-dash__conversations">
                {recentConversations.map((conversation) => {
                  const agent = getAgentMeta(conversation.agentId);
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      className="pm-dash__conv-item"
                      onClick={() => navigate(`/app/agents/${conversation.agentId}?cid=${conversation.id}`)}
                    >
                      <AgentAvatar agent={agent} size={36} />
                      <div style={{ minWidth: 0 }}>
                        <div className="pm-dash__conv-name">{agent?.name ?? conversation.agentId}</div>
                        <div className="pm-dash__conv-title">{conversation.title ?? 'Conversation'}</div>
                      </div>
                      <div className="pm-dash__conv-time">{timeAgo(conversation.lastActiveAt)}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Workflows */}
          <div className="pm-dash__card" style={{ '--card-accent': '#ff8e6a' }}>
            <div className="pm-dash__card-header">
              <div>
                <div className="pm-dash__card-eyebrow">Workflow posture</div>
                <h2 className="pm-dash__card-title">Automation lanes.</h2>
              </div>
              <Link to="/app/workflows" className="pm-dash__card-link">Open NEXUS →</Link>
            </div>
            {workflows.length === 0 ? (
              <EmptyState title="No workflows configured" description="Build the first orchestration graph." accent="#ff8e6a" />
            ) : (
              <div className="pm-dash__workflows">
                {workflows.slice(0, 4).map((workflow) => (
                  <div key={workflow.id} className="pm-dash__wf-item">
                    <div className="pm-dash__wf-row">
                      <strong>{workflow.name}</strong>
                      <span className={`pm-dash__wf-status${workflow.isActive ? ' pm-dash__wf-status--active' : ''}`}>
                        {workflow.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="pm-dash__wf-meta">
                      <span>{workflow.triggerType}</span>
                      <span>{workflow.nodes?.length ?? 0} nodes</span>
                      <span>{workflow.runCount ?? 0} runs</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent roster — hierarchy */}
          <div className="pm-dash__card pm-dash__card--full" style={{ '--card-accent': '#b8d7ff' }}>
            <div className="pm-dash__card-header">
              <div>
                <div className="pm-dash__card-eyebrow">Agent access</div>
                <h2 className="pm-dash__card-title">Core agents stay surfaced; depth stays one gesture away.</h2>
              </div>
            </div>
            <div className="pm-dash__agent-system">
              <div className="pm-dash__agent-system-label">Core</div>
              <div className="pm-dash__agent-core-row">
                {coreLaneAgents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    className={`pm-dash__agent-core${agent.id === 'nexus' ? ' pm-dash__agent-core--nexus' : ''}`}
                    style={{ '--agent-color': agent.color }}
                    onClick={() => navigate(`/app/agents/${agent.id}`)}
                  >
                    <span className="pm-dash__agent-core-glow" aria-hidden="true" />
                    <AgentAvatar agent={agent} size={agent.id === 'nexus' ? 56 : 48} active={agent.id === 'nexus'} />
                    <div>
                      <div className="pm-dash__agent-core-name">{agent.name}</div>
                      <div className="pm-dash__agent-core-title">{agent.title}</div>
                    </div>
                  </button>
                ))}
              </div>

              {nonSpecialistSecondary.length > 0 ? (
                <>
                  <div className="pm-dash__agent-system-label">Intelligence & execution</div>
                  <div className="pm-dash__agent-secondary-grid">
                    {nonSpecialistSecondary.map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        className={`pm-dash__agent-chip${agent.id === recommendedFirstAgentId ? ' pm-dash__agent-chip--hot' : ''}`}
                        style={{ '--agent-color': agent.color }}
                        onClick={() => navigate(`/app/agents/${agent.id}`)}
                      >
                        <AgentAvatar agent={agent} size={36} active={agent.id === recommendedFirstAgentId} />
                        <div>
                          <div className="pm-dash__agent-chip-name">{agent.name}</div>
                          <div className="pm-dash__agent-chip-title">{agent.title}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {specialistAgents.length > 0 ? (
                <div className="pm-dash__agent-special-wrap">
                  <button
                    type="button"
                    className="pm-dash__agent-special-toggle"
                    onClick={() => setSpecialistsOpen((o) => !o)}
                    aria-expanded={specialistsOpen}
                  >
                    <span className="pm-dash__agent-system-label" style={{ margin: 0 }}>Specialists</span>
                    <span className="pm-dash__agent-special-chevron">{specialistsOpen ? '▾' : '▸'}</span>
                  </button>
                  {specialistsOpen ? (
                    <div className="pm-dash__agent-special-grid">
                      {specialistAgents.map((agent) => (
                        <button
                          key={agent.id}
                          type="button"
                          className="pm-dash__agent-chip pm-dash__agent-chip--small"
                          style={{ '--agent-color': agent.color }}
                          onClick={() => navigate(`/app/agents/${agent.id}`)}
                        >
                          <AgentAvatar agent={agent} size={32} />
                          <div>
                            <div className="pm-dash__agent-chip-name">{agent.name}</div>
                            <div className="pm-dash__agent-chip-title">{agent.title}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {/* Control surfaces */}
          <div className="pm-dash__card pm-dash__card--full" style={{ '--card-accent': '#68f5d0' }}>
            <div className="pm-dash__card-header">
              <div>
                <div className="pm-dash__card-eyebrow">Control surfaces</div>
                <h2 className="pm-dash__card-title">Keep the system within reach.</h2>
              </div>
            </div>
            <div className="pm-dash__control-grid">
              <Link to="/app/lore" className="pm-dash__control-tile">
                <span>LORE</span>
                <strong>Knowledge + retrieval trust</strong>
                <small>Upload sources, inspect contradictions, and ground the next output.</small>
              </Link>
              <Link to="/app/integrations" className="pm-dash__control-tile">
                <span>Integrations</span>
                <strong>Wire inboxes, docs, and comms</strong>
                <small>Connect the real operating context agents should work from.</small>
              </Link>
              <Link to="/app/settings" className="pm-dash__control-tile">
                <span>Settings</span>
                <strong>Plan, seats, API, and org controls</strong>
                <small>Billing, entitlements, and environment settings.</small>
              </Link>
              {isStaff ? (
                <Link to="/app/admin" className="pm-dash__control-tile">
                  <span>Admin</span>
                  <strong>Operator console</strong>
                  <small>Traces, receipts, webhook health, runtime events.</small>
                </Link>
              ) : (
                <div className="pm-dash__control-tile is-passive">
                  <span>Plan posture</span>
                  <strong>{planMeta?.name ?? currentPlan}</strong>
                  <small>{planMeta?.description ?? 'Current operating tier.'}</small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

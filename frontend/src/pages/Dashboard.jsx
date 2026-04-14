import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { AgentAvatar, Button, EmptyState, PageShell } from '../components/ui';
import { MotionCard, MotionList, MotionListItem, MotionSection, usePrymalReducedMotion } from '../components/motion';
import { getAgentMeta, getRecommendedAgentsForWorkspaceProfile, getWorkspacePlanMeta } from '../lib/constants';
import { api } from '../lib/api';

const CinematicHeroScene = lazy(() => import('../features/marketing/CinematicHeroScene'));

const FIRST_WIN_LIBRARY = {
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

function mergeUniqueAgents(agentLists, limit = 6) {
  const seen = new Set();
  const merged = [];

  for (const list of agentLists) {
    for (const agent of list) {
      if (!agent || seen.has(agent.id)) {
        continue;
      }
      seen.add(agent.id);
      merged.push(agent);
      if (merged.length >= limit) {
        return merged;
      }
    }
  }

  return merged;
}

export default function Dashboard() {
  const { viewer, agents } = useOutletContext();
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = usePrymalReducedMotion();
  const [heroSceneReady, setHeroSceneReady] = useState(false);

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

  useEffect(() => {
    if (reducedMotion) {
      setHeroSceneReady(false);
      return undefined;
    }

    let active = true;
    let timeoutId = null;
    let idleId = null;

    const enable = () => {
      if (active) {
        setHeroSceneReady(true);
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(enable, { timeout: 900 });
    } else {
      timeoutId = window.setTimeout(enable, 260);
    }

    return () => {
      active = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (idleId && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [reducedMotion]);

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

  const heroAgents = useMemo(
    () => mergeUniqueAgents([recommendedAgents, recentConversationAgents, [getAgentMeta('nexus'), getAgentMeta('lore')]], 6),
    [recentConversationAgents, recommendedAgents],
  );

  const missionAgents = conversationCount === 0 ? recommendedAgents : topAgents.slice(0, 3);

  const heroTitle = conversationCount === 0
    ? 'Launch your first high-trust operating lane.'
    : `Mission control for ${orgName}.`;

  const heroDescription = conversationCount === 0
    ? 'Start with one agent, one real task, and one useful output. Prymal is strongest when the first move feels immediate, grounded, and valuable enough to reuse.'
    : 'Resume live conversations, move into workflows, and steer the workspace from one premium operating surface instead of jumping between disconnected tools.';

  const heroPrimaryAction = latestConversation
    ? () => navigate(`/app/agents/${latestConversation.agentId}?conversation=${latestConversation.id}`)
    : () => navigate(`/app/agents/${recommendedFirstAgentId}`);

  const heroPrimaryLabel = latestConversation ? 'Resume latest conversation' : `Open ${recommendedAgents[0]?.name ?? 'Prymal'}`;

  const heroStats = [
    { label: 'Conversations', value: conversationCount },
    { label: 'Configured workflows', value: workflows.length },
    { label: 'Active automations', value: activeWorkflows.length },
    { label: 'Plan', value: planMeta?.name ?? currentPlan },
  ];

  return (
    <PageShell width="1260px">
      <div className="prymal-dashboard">
        <section className="prymal-dashboard__hero">
          <MotionSection className="prymal-dashboard__hero-copy" delay={0.04} reveal={{ y: 24, blur: 10 }}>
            <div className="hero-pill prymal-dashboard__hero-pill">
              Mission control · {planMeta?.name ?? currentPlan} plan · {conversationCount > 0 ? `${conversationCount} conversation${conversationCount === 1 ? '' : 's'}` : 'ready for first output'}
            </div>
            <h1 className="prymal-dashboard__headline">{heroTitle}</h1>
            <p className="prymal-dashboard__subcopy">{heroDescription}</p>

            <div className="prymal-dashboard__actions">
              <Button tone="accent" onClick={heroPrimaryAction}>
                {heroPrimaryLabel}
              </Button>
              <Button tone="ghost" onClick={() => navigate('/app/workflows')}>
                Open workflows
              </Button>
              <Button tone="ghost" onClick={() => navigate('/app/lore')}>
                Open knowledge base
              </Button>
            </div>

            <div className="prymal-dashboard__metric-row">
              {heroStats.map((stat) => (
                <div key={stat.label} className="prymal-dashboard__metric">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>

            <div className="prymal-dashboard__trust">
              <span className="prymal-trust-chip">SENTINEL gated</span>
              <span className="prymal-trust-chip">LORE grounded</span>
              <span className="prymal-trust-chip">Realtime voice ready</span>
              <span className="prymal-trust-chip">Workflow receipts + webhooks</span>
            </div>
          </MotionSection>

          <MotionSection className="prymal-dashboard__hero-scene" delay={0.12} reveal={{ x: 24, y: 0, blur: 10 }}>
            <div className="prymal-cinematic-stage prymal-dashboard__scene-shell">
              {heroSceneReady ? (
                <Suspense
                  fallback={(
                    <div className="prymal-cinematic-stage__fallback">
                      <div className="prymal-cinematic-stage__fallback-core" />
                      <div className="prymal-cinematic-stage__fallback-ring prymal-cinematic-stage__fallback-ring--inner" />
                      <div className="prymal-cinematic-stage__fallback-ring prymal-cinematic-stage__fallback-ring--outer" />
                    </div>
                  )}
                >
                  <CinematicHeroScene agents={heroAgents} />
                </Suspense>
              ) : (
                <div className="prymal-cinematic-stage__fallback">
                  <div className="prymal-cinematic-stage__fallback-core" />
                  <div className="prymal-cinematic-stage__fallback-ring prymal-cinematic-stage__fallback-ring--inner" />
                  <div className="prymal-cinematic-stage__fallback-ring prymal-cinematic-stage__fallback-ring--outer" />
                  {heroAgents.map((agent) => (
                    <span
                      key={agent.id}
                      className="prymal-cinematic-stage__fallback-node"
                      style={{ '--node-accent': agent.color }}
                    >
                      {agent.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="prymal-cinematic-stage__hud">
                <div className="prymal-cinematic-stage__hud-card prymal-cinematic-stage__hud-card--top">
                  <strong>Workspace posture</strong>
                  <span>
                    {conversationCount === 0
                      ? 'The system is ready for the first useful output. Start with the lane most likely to produce an immediate business result.'
                      : 'The system already has live context. Resume conversations, push workflows forward, and keep the trust layer intact.'}
                  </span>
                </div>
                <div className="prymal-cinematic-stage__hud-card prymal-cinematic-stage__hud-card--left">
                  <strong>Fast lanes</strong>
                  <div className="prymal-cinematic-stage__hud-pills">
                    {missionAgents.map((agent) => (
                      <span key={agent.id} className="prymal-cinematic-stage__hud-pill">
                        {agent.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="prymal-cinematic-stage__hud-card prymal-cinematic-stage__hud-card--bottom">
                  <strong>System signals</strong>
                  <small>
                    {activeWorkflows.length} active workflow{activeWorkflows.length === 1 ? '' : 's'} · {recentConversations.length} recent thread{recentConversations.length === 1 ? '' : 's'} · {isStaff ? 'admin console available' : 'operator mode active'}
                  </small>
                </div>
              </div>
            </div>
          </MotionSection>
        </section>

        <div className="prymal-dashboard__grid">
          <MotionCard className="prymal-dashboard-card prymal-dashboard-card--missions" accent="#68f5d0">
            <div className="prymal-dashboard-card__header">
              <div>
                <div className="eyebrow" style={{ '--eyebrow-accent': '#68f5d0' }}>
                  {conversationCount === 0 ? 'First wins' : 'Suggested missions'}
                </div>
                <h2>Start from a strong operating prompt.</h2>
              </div>
              <Link to={`/app/agents/${recommendedFirstAgentId}`} className="prymal-usecase-link">
                Open recommended lane
              </Link>
            </div>

            <MotionList className="prymal-dashboard__mission-grid">
              {missionAgents.map((agent) => {
                const starter = FIRST_WIN_LIBRARY[agent.id] ?? FIRST_WIN_LIBRARY.cipher;
                return (
                  <MotionListItem key={agent.id}>
                    <button
                      type="button"
                      className="prymal-dashboard__mission-card"
                      onClick={() =>
                        navigate(`/app/agents/${agent.id}?new=1&draft=${encodeURIComponent(starter.message)}`)
                      }
                    >
                      <div className="prymal-dashboard__mission-top">
                        <AgentAvatar agent={agent} size={74} active />
                        <div>
                          <div className="prymal-dashboard__mission-name">{agent.name}</div>
                          <div className="prymal-dashboard__mission-role">{agent.title}</div>
                        </div>
                      </div>
                      <p>{starter.summary}</p>
                      <div className="prymal-dashboard__prompt-preview">“{starter.message}”</div>
                    </button>
                  </MotionListItem>
                );
              })}
            </MotionList>
          </MotionCard>

          <MotionCard className="prymal-dashboard-card" accent="#7f8cff">
            <div className="prymal-dashboard-card__header">
              <div>
                <div className="eyebrow" style={{ '--eyebrow-accent': '#7f8cff' }}>Recent conversations</div>
                <h2>Pick up the last active threads.</h2>
              </div>
            </div>

            {recentConversations.length === 0 ? (
              <EmptyState
                title="No conversations yet"
                description="The first live thread will appear here once you send a message in any agent workspace."
                accent="#7f8cff"
              />
            ) : (
              <MotionList className="prymal-dashboard__conversation-list">
                {recentConversations.map((conversation) => {
                  const agent = getAgentMeta(conversation.agentId);
                  return (
                    <MotionListItem key={conversation.id}>
                      <button
                        type="button"
                        className="prymal-dashboard__conversation-item"
                        onClick={() => navigate(`/app/agents/${conversation.agentId}?conversation=${conversation.id}`)}
                      >
                        <AgentAvatar agent={agent} size={48} />
                        <div>
                          <div className="prymal-dashboard__conversation-name">{agent?.name ?? conversation.agentId}</div>
                          <div className="prymal-dashboard__conversation-title">
                            {conversation.title ?? conversation.contextSummary ?? 'Conversation'}
                          </div>
                        </div>
                        <div className="prymal-dashboard__conversation-time">{timeAgo(conversation.lastActiveAt)}</div>
                      </button>
                    </MotionListItem>
                  );
                })}
              </MotionList>
            )}
          </MotionCard>

          <MotionCard className="prymal-dashboard-card" accent="#ff8e6a">
            <div className="prymal-dashboard-card__header">
              <div>
                <div className="eyebrow" style={{ '--eyebrow-accent': '#ff8e6a' }}>Workflow posture</div>
                <h2>Automation lanes worth watching.</h2>
              </div>
              <Link to="/app/workflows" className="prymal-usecase-link">
                Open NEXUS
              </Link>
            </div>

            {workflows.length === 0 ? (
              <EmptyState
                title="No workflows configured"
                description="Build the first orchestration graph and it will show up here with run posture and trigger state."
                accent="#ff8e6a"
              />
            ) : (
              <MotionList className="prymal-dashboard__workflow-list">
                {workflows.slice(0, 4).map((workflow) => (
                  <MotionListItem key={workflow.id}>
                    <div className="prymal-dashboard__workflow-item">
                      <div className="prymal-dashboard__workflow-row">
                        <strong>{workflow.name}</strong>
                        <span className={`prymal-dashboard__status-pill${workflow.isActive ? ' is-active' : ''}`}>
                          {workflow.isActive ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <div className="prymal-dashboard__workflow-meta">
                        <span>{workflow.triggerType}</span>
                        <span>{workflow.nodes?.length ?? 0} nodes</span>
                        <span>{workflow.runCount ?? 0} runs</span>
                      </div>
                    </div>
                  </MotionListItem>
                ))}
              </MotionList>
            )}
          </MotionCard>

          <MotionCard className="prymal-dashboard-card" accent="#b8d7ff">
            <div className="prymal-dashboard-card__header">
              <div>
                <div className="eyebrow" style={{ '--eyebrow-accent': '#b8d7ff' }}>Agent roster</div>
                <h2>Jump straight into the right specialist.</h2>
              </div>
            </div>

            <MotionList className="prymal-dashboard__agent-grid">
              {topAgents.map((agent) => (
                <MotionListItem key={agent.id}>
                  <button
                    type="button"
                    className={`prymal-dashboard__agent-card${agent.id === recommendedFirstAgentId ? ' is-featured' : ''}`}
                    onClick={() => navigate(`/app/agents/${agent.id}`)}
                  >
                    <AgentAvatar agent={agent} size={60} active={agent.id === recommendedFirstAgentId} />
                    <div>
                      <div className="prymal-dashboard__agent-name">{agent.name}</div>
                      <div className="prymal-dashboard__agent-title">{agent.title}</div>
                    </div>
                  </button>
                </MotionListItem>
              ))}
            </MotionList>
          </MotionCard>

          <MotionCard className="prymal-dashboard-card prymal-dashboard-card--control" accent="#68f5d0">
            <div className="prymal-dashboard-card__header">
              <div>
                <div className="eyebrow" style={{ '--eyebrow-accent': '#68f5d0' }}>Control surfaces</div>
                <h2>Keep the rest of the system within reach.</h2>
              </div>
            </div>

            <div className="prymal-dashboard__control-grid">
              <Link to="/app/lore" className="prymal-dashboard__control-tile">
                <span>LORE</span>
                <strong>Knowledge + retrieval trust</strong>
                <small>Upload sources, inspect contradictions, and ground the next output.</small>
              </Link>
              <Link to="/app/integrations" className="prymal-dashboard__control-tile">
                <span>Integrations</span>
                <strong>Wire inboxes, docs, and comms</strong>
                <small>Connect the real operating context that the agents should work from.</small>
              </Link>
              <Link to="/app/settings" className="prymal-dashboard__control-tile">
                <span>Settings</span>
                <strong>Plan, seats, API, and org controls</strong>
                <small>Billing, entitlements, and environment settings live here.</small>
              </Link>
              {isStaff ? (
                <Link to="/app/admin" className="prymal-dashboard__control-tile">
                  <span>Admin</span>
                  <strong>Operator console</strong>
                  <small>Investigate traces, action receipts, webhook health, and runtime events.</small>
                </Link>
              ) : (
                <div className="prymal-dashboard__control-tile is-passive">
                  <span>Plan posture</span>
                  <strong>{planMeta?.name ?? currentPlan}</strong>
                  <small>{planMeta?.description ?? 'Your current operating tier for the workspace.'}</small>
                </div>
              )}
            </div>
          </MotionCard>
        </div>
      </div>
    </PageShell>
  );
}

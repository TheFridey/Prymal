import { FIRST_RUN_OUTCOMES } from '../../lib/first-run-outcomes';
import { getWorkspacePlanMeta } from '../../lib/constants';

const UPGRADE_PLANS = new Set(['free', 'solo']);

/**
 * @param {object} params
 * @returns {{ recommendation_id: string, title: string, description: string, ctaLabel: string, route: string, plan_id?: string }}
 */
export function resolveDashboardRecommendation({
  hasMeaningfulProgress,
  conversationCount = 0,
  workflows = [],
  loreDocumentCount = 0,
  firstRunOutcomeId,
  recommendedFirstAgentId = 'nexus',
  currentPlan = 'free',
  recentConversations = [],
}) {
  const workflowRuns = workflows.reduce((sum, workflow) => sum + Number(workflow.runCount ?? 0), 0);

  if (!hasMeaningfulProgress) {
    const outcome =
      FIRST_RUN_OUTCOMES.find((entry) => entry.id === firstRunOutcomeId)
      ?? FIRST_RUN_OUTCOMES[0];

    return {
      recommendation_id: 'first_win',
      title: 'Start your first useful task',
      description: outcome.plainOutcome,
      ctaLabel: outcome.cta,
      route: outcome.route,
    };
  }

  if (firstRunOutcomeId) {
    const outcome = FIRST_RUN_OUTCOMES.find((entry) => entry.id === firstRunOutcomeId);
    if (outcome) {
      return {
        recommendation_id: `outcome_${outcome.id}`,
        title: `Continue your ${outcome.title.toLowerCase()} path`,
        description: outcome.recommendationReason,
        ctaLabel: outcome.cta,
        route: outcome.route,
      };
    }
  }

  if (workflowRuns > 0 && loreDocumentCount === 0) {
    return {
      recommendation_id: 'add_lore',
      title: 'Add business context',
      description: 'Business Memory helps specialists stay grounded in how your business actually works.',
      ctaLabel: 'Open Business Memory',
      route: '/app/lore',
    };
  }

  const contentAgents = new Set(['forge', 'echo', 'herald', 'nexus']);
  const usedContent = recentConversations.some((conversation) => contentAgents.has(conversation.agentId));
  if (usedContent || conversationCount >= 5) {
    return {
      recommendation_id: 'content_workflow',
      title: 'Turn output into a campaign workflow',
      description: 'Promote a strong content lane into a repeatable workflow your team can run each week.',
      ctaLabel: 'Browse workflow templates',
      route: '/app/workflows/catalogue',
    };
  }

  if (hasMeaningfulProgress && UPGRADE_PLANS.has(String(currentPlan).toLowerCase())) {
    const planMeta = getWorkspacePlanMeta(currentPlan);
    return {
      recommendation_id: 'upgrade_pro',
      title: 'Ready for more execution headroom?',
      description: `You are on ${planMeta.name}. Upgrade when you want higher limits and more specialist lanes.`,
      ctaLabel: 'View Pro plans',
      route: '/app/settings?tab=Billing',
      plan_id: 'pro',
    };
  }

  const latest = recentConversations[0];
  if (latest) {
    return {
      recommendation_id: 'resume_latest',
      title: 'Pick up your latest thread',
      description: 'Continue where you left off instead of starting from scratch.',
      ctaLabel: 'Continue',
      route: `/app/agents/${latest.agentId}?cid=${latest.id}`,
    };
  }

  return {
    recommendation_id: 'open_recommended_agent',
    title: 'Open a recommended specialist',
    description: 'Start with the lane most likely to produce a useful result today.',
    ctaLabel: 'Open workspace',
    route: `/app/agents/${recommendedFirstAgentId}?new=1`,
  };
}

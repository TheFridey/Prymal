import { getFeaturedWorkflowTemplates } from './workflow-templates';

/**
 * Three canonical first-win paths shown on the dashboard and referenced in onboarding.
 */

export const FIRST_WIN_PATHS = [
  {
    id: 'content_plan',
    title: 'Create a 7-day content plan',
    promise: 'Get a usable week of ideas: posts, optional outreach angles, and next steps.',
    recommendedAgents: ['forge', 'echo', 'herald'],
    starterPrompt:
      'Create a 7-day content plan for my business based on this offer: [describe offer]. Tailor hooks for LinkedIn/email where relevant.',
    expectedOutput: 'A structured week of content angles plus optional outreach language.',
    ctaAgentId: 'forge',
    ctaHref: '/app/agents/forge',
    draftQuery: '',
    microcopy: 'Best first lane when marketing needs momentum fast.',
  },
  {
    id: 'lore_qa',
    title: 'Ask LORE about your business',
    promise: 'Upload or paste a small piece of knowledge, then get a grounded, source-linked answer.',
    recommendedAgents: ['lore', 'sage', 'cipher'],
    starterPrompt:
      'Summarise what you know about my business from the uploaded knowledge and list gaps I should fix next.',
    expectedOutput: 'Source-backed recap plus contradiction or gap callouts.',
    ctaAgentId: 'lore',
    ctaHref: '/app/lore',
    loreFirst: true,
    microcopy: 'Ground Prymal before you ship high-stakes copy.',
  },
  {
    id: 'workflow',
    title: 'Build a simple workflow',
    promise: 'Start from a guided template and run agents in sequence.',
    recommendedAgents: ['nexus', 'atlas', 'herald'],
    starterPrompt:
      'Help me design a simple workflow: pull context from LORE, draft with FORGE, then review before send.',
    expectedOutput: 'A runnable graph outline you can tighten in NEXUS.',
    ctaAgentId: 'nexus',
    ctaHref: '/app/workflows',
    templateSlug: null,
    microcopy: 'Best when something needs to repeat every week.',
  },
];

/** Founder-facing demo narratives – reference real workflows; no fabricated integrations. */
export const DEMO_SCENARIOS = [
  {
    id: 'local-business-plan',
    label: 'Local business marketing plan',
    audience: 'Local service business',
    outcome: '7-day content plan, outreach email, social hooks',
    workflowSlug: 'weekly-client-report',
    promptBundle: [
      'Create a 7-day content plan for my local service business with daily post ideas.',
      'Write a 3-email outreach sequence for nearby homeowners about [offer].',
    ],
  },
  {
    id: 'agency-client',
    label: 'Agency client workflow',
    audience: 'Agency or freelancer',
    outcome: 'Client notes → content, proposal outline, follow-up',
    workflowSlug: 'lead-intake-to-proposal',
    promptBundle: [
      'Turn these client notes into a draft proposal outline and next actions.',
    ],
  },
  {
    id: 'founder-launch',
    label: 'Founder launch workflow',
    audience: 'Startup founder',
    outcome: 'Launch post, outreach email, ICP summary, action plan',
    workflowSlug: 'launch-campaign-war-room',
    promptBundle: [
      'Write a launch post for my product that feels premium, direct, and exciting.',
      'Turn this goal into a 30-day execution plan with milestones.',
    ],
  },
  {
    id: 'lore-knowledge',
    label: 'LORE business knowledge demo',
    audience: 'Anyone with a short company blurb',
    outcome: 'Source-backed answer, gaps, contradictions, doc suggestions',
    workflowSlug: null,
    promptBundle: [
      'Summarise what you know about my business from the uploaded knowledge.',
      'What gaps or contradictions exist in my current business information?',
    ],
  },
  {
    id: 'data-report',
    label: 'Data / report demo',
    audience: 'Operator with simple metrics',
    outcome: 'CIPHER summary, risks, actions, scorecard framing',
    workflowSlug: 'monthly-exec-operating-review',
    promptBundle: [
      'Analyse this business data and tell me the key trends, risks, and actions.',
      'Create a scorecard for this campaign from the numbers provided.',
    ],
  },
];

export function getDemoScenarioTemplateSlugs() {
  return [...new Set(DEMO_SCENARIOS.map((s) => s.workflowSlug).filter(Boolean))];
}

export function enrichFirstWinPathsWithTemplates() {
  const featured = getFeaturedWorkflowTemplates(20);
  return FIRST_WIN_PATHS.map((path) => {
    if (path.id !== 'workflow') return path;
    const pick = featured[0];
    return {
      ...path,
      templateSlug: pick?.slug ?? null,
      ctaHref: pick ? `/app/workflows?view=builder&template=${encodeURIComponent(pick.slug)}` : path.ctaHref,
    };
  });
}

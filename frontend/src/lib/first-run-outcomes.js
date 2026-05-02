export const FIRST_WIN_STATES = {
  NO_OUTCOME: 'no_outcome',
  OUTCOME_SELECTED: 'outcome_selected',
  PROMPT_STARTED: 'prompt_started',
  PROMPT_SUBMITTED: 'prompt_submitted',
  OUTPUT_COMPLETED: 'output_completed',
  LORE_SOURCE_ADDED: 'lore_source_added',
  WORKFLOW_DRAFT_CREATED: 'workflow_draft_created',
  BETA_SUCCESS: 'beta_success',
};

export const FIRST_RUN_OUTCOMES = [
  {
    id: 'create_content',
    title: 'Create content',
    plainOutcome: 'Turn a rough idea into a polished LinkedIn post, email, article, or landing page section.',
    timeToResult: '2-4 min',
    recommendedAgentId: 'forge',
    alternateAgentIds: ['echo', 'herald'],
    loreHelps: 'Helpful if you add brand voice, offer, or customer notes.',
    creditIntensity: 'Low',
    cta: 'Start with FORGE',
    route: '/app/agents/forge?new=1&outcome=create_content&composer=1',
    recommendationReason: 'FORGE is best at turning rough ideas into polished commercial content.',
    defaultValues: {
      goal: 'Write a LinkedIn post about...',
      audience: 'Small business owners, founders, or agencies',
      tone: 'Sharp, confident, not too salesy',
      context: '',
      output: 'One polished post with 3 hook options',
    },
    starterPrompts: [
      'Write a LinkedIn post about my offer with 3 hook options.',
      'Turn my rough idea into a landing page section with headline, proof, and CTA.',
      'Create a 7-day content plan for my business from this offer.',
    ],
  },
  {
    id: 'get_more_leads',
    title: 'Get more leads',
    plainOutcome: 'Create outreach, qualification, follow-up, or proposal assets that move prospects forward.',
    timeToResult: '3-5 min',
    recommendedAgentId: 'vance',
    alternateAgentIds: ['herald', 'atlas'],
    loreHelps: 'Helpful if you add ICP, offer, pricing, or case-study context.',
    creditIntensity: 'Low / Medium',
    cta: 'Start with VANCE',
    route: '/app/agents/vance?new=1&outcome=get_more_leads&composer=1',
    recommendationReason: 'VANCE is best at turning lead context into commercial next steps.',
    defaultValues: {
      goal: 'Write an outreach sequence for...',
      audience: 'Local businesses, SaaS founders, or agencies',
      tone: 'Confident, useful, specific',
      context: '',
      output: '3-message sequence plus follow-up',
    },
    starterPrompts: [
      'Write a 3-message outreach sequence for my offer.',
      'Score this lead and suggest the next best action.',
      'Draft a proposal outline for this prospect and project.',
    ],
  },
  {
    id: 'analyse_data',
    title: 'Analyse data',
    plainOutcome: 'Paste metrics or CSV text and get trends, anomalies, risks, and next actions.',
    timeToResult: '3-5 min',
    recommendedAgentId: 'cipher',
    alternateAgentIds: ['ledger', 'atlas'],
    loreHelps: 'Helpful if you add targets, definitions, or previous reporting notes.',
    creditIntensity: 'Low / Medium',
    cta: 'Start with CIPHER',
    route: '/app/agents/cipher?new=1&outcome=analyse_data&composer=1',
    recommendationReason: 'CIPHER is best at turning messy numbers into useful operating insight.',
    defaultValues: {
      goal: 'Find anomalies and trends in this data',
      audience: 'Founder, operator, or client stakeholder',
      tone: 'Clear, analytical, plain English',
      context: 'Paste CSV rows, metrics, or a short data description here.',
      output: 'Executive summary plus notable risks and actions',
    },
    starterPrompts: [
      'Analyse this business data and tell me the key trends, risks, and actions.',
      'Find anomalies or weak points in this report.',
      'Turn this CSV text into an executive-ready summary.',
    ],
  },
  {
    id: 'automate_task',
    title: 'Automate a task',
    plainOutcome: 'Sketch a repeatable workflow first, then decide whether to install or run it later.',
    timeToResult: '4-5 min',
    recommendedAgentId: 'nexus',
    alternateAgentIds: ['atlas', 'forge'],
    loreHelps: 'Helpful if the workflow should use SOPs, brand rules, or recurring reports.',
    creditIntensity: 'Medium',
    cta: 'Start with NEXUS',
    route: '/app/agents/nexus?new=1&outcome=automate_task&composer=1',
    recommendationReason: 'NEXUS is best at turning one useful task into a repeatable workflow blueprint.',
    defaultValues: {
      goal: 'Build a repeatable workflow for...',
      audience: 'My team or future me',
      tone: 'Practical and implementation-ready',
      context: '',
      output: 'Blueprint first, install or run later',
    },
    starterPrompts: [
      'Create a workflow blueprint for this recurring task.',
      'Turn this manual process into a repeatable Prymal workflow.',
      'Design a workflow that researches, drafts, reviews, and packages this output.',
    ],
  },
  {
    id: 'business_knowledge',
    title: 'Ask questions from my business knowledge',
    plainOutcome: 'Add a business document, note, or URL, then ask a source-backed question.',
    timeToResult: '4-5 min',
    recommendedAgentId: 'lore',
    alternateAgentIds: ['sage', 'cipher'],
    loreHelps: 'Required for the best result.',
    creditIntensity: 'Low',
    cta: 'Start with LORE',
    route: '/app/lore?outcome=business_knowledge',
    recommendationReason: 'LORE grounds answers in your workspace knowledge instead of generic memory.',
    defaultValues: {
      goal: 'Answer questions from uploaded business docs',
      audience: 'Internal team',
      tone: 'Evidence-first and clear about gaps',
      context: '',
      output: 'Source-backed answer plus gaps or contradictions',
    },
    starterPrompts: [
      'Summarise what you know about my business from the uploaded knowledge.',
      'What gaps or contradictions exist in my current business information?',
      'Answer this using only my saved knowledge: [question].',
    ],
  },
  {
    id: 'media_asset',
    title: 'Create an image/video asset',
    plainOutcome: 'Create a visual or video brief, then generate or refine the asset with clear cost expectations.',
    timeToResult: '3-5 min for image, longer for video',
    recommendedAgentId: 'pixel',
    alternateAgentIds: ['forge', 'echo'],
    loreHelps: 'Helpful if you add brand, campaign, or product context.',
    creditIntensity: 'High',
    cta: 'Start with PIXEL',
    route: '/app/agents/pixel?new=1&outcome=media_asset&composer=1',
    recommendationReason: 'PIXEL is best at turning creative intent into usable visual and video briefs.',
    defaultValues: {
      goal: 'Create a visual or video brief for...',
      audience: 'Prospects or customers seeing this campaign',
      tone: 'Premium, clear, brand-safe',
      context: '',
      output: 'A generation-ready brief with format, scene, and refinement notes',
    },
    starterPrompts: [
      'Create an image brief for a premium campaign asset.',
      'Create a short video brief with scene, movement, aspect ratio, and CTA.',
      'Turn this campaign idea into visual directions for PIXEL.',
    ],
  },
];

const OUTCOME_BY_ID = new Map(FIRST_RUN_OUTCOMES.map((outcome) => [outcome.id, outcome]));

export function getFirstRunOutcome(outcomeId) {
  return OUTCOME_BY_ID.get(String(outcomeId ?? '').trim()) ?? null;
}

export function getRecommendedAgentForOutcome(outcomeId) {
  return getFirstRunOutcome(outcomeId)?.recommendedAgentId ?? 'cipher';
}

export function getStarterPromptForOutcome(outcomeId) {
  return getFirstRunOutcome(outcomeId)?.starterPrompts?.[0] ?? '';
}

export function getStarterPromptsForOutcome(outcomeId) {
  return getFirstRunOutcome(outcomeId)?.starterPrompts ?? [];
}

export function getOutcomeCreditIntensity(outcomeId) {
  return getFirstRunOutcome(outcomeId)?.creditIntensity ?? 'Low';
}

export function getOutcomeRoute(outcomeId) {
  return getFirstRunOutcome(outcomeId)?.route ?? '/app/dashboard';
}

export function buildFirstWinPrompt(outcomeId, formValues = {}) {
  const outcome = getFirstRunOutcome(outcomeId) ?? FIRST_RUN_OUTCOMES[0];
  const defaults = outcome.defaultValues ?? {};
  const values = {
    goal: formValues.goal || defaults.goal || '',
    audience: formValues.audience || defaults.audience || '',
    tone: formValues.tone || defaults.tone || '',
    context: formValues.context || defaults.context || '',
    output: formValues.output || defaults.output || '',
  };

  const lines = [
    `First outcome: ${outcome.title}`,
    `Recommended agent: ${outcome.recommendedAgentId.toUpperCase()}`,
    '',
    `Goal: ${values.goal}`,
    `Audience / business context: ${values.audience}`,
    `Tone / format: ${values.tone}`,
    `Output required: ${values.output}`,
  ];

  if (values.context.trim()) {
    lines.push('', 'Source/context to use:', values.context.trim());
  }

  lines.push(
    '',
    'Please produce a useful first draft quickly. Be specific, structure the answer clearly, and call out where LORE/business context would improve the result.',
  );

  return lines.join('\n');
}

export function getFirstWinStorageKey(userId = 'local') {
  return `prymal:first-win-state:${userId || 'local'}`;
}

export function readFirstWinState(userId = 'local') {
  if (typeof window === 'undefined') {
    return { state: FIRST_WIN_STATES.NO_OUTCOME };
  }

  try {
    const raw = window.localStorage.getItem(getFirstWinStorageKey(userId));
    return raw ? JSON.parse(raw) : { state: FIRST_WIN_STATES.NO_OUTCOME };
  } catch {
    return { state: FIRST_WIN_STATES.NO_OUTCOME };
  }
}

export function writeFirstWinState(userId = 'local', patch = {}) {
  if (typeof window === 'undefined') {
    return { state: FIRST_WIN_STATES.NO_OUTCOME, ...patch };
  }

  const current = readFirstWinState(userId);
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(getFirstWinStorageKey(userId), JSON.stringify(next));
  } catch {
    // Non-fatal; product events still capture milestones.
  }

  return next;
}

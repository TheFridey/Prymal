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

// ─── Structured starter outcomes (shown in onboarding + recommended by profile) ──

export const STARTER_OUTCOMES = [
  {
    id: 'lead_audit',
    title: 'Lead Audit',
    plainOutcome: 'Score your current leads, surface the highest-priority actions, and get a follow-up plan.',
    timeToResult: '3-5 min',
    recommendedAgentId: 'vance',
    alternateAgentIds: ['cipher', 'atlas'],
    loreHelps: 'Add CRM notes, ICP definition, or lead-list context for sharper scoring.',
    creditIntensity: 'Low / Medium',
    cta: 'Run lead audit with VANCE',
    route: '/app/agents/vance?new=1&outcome=lead_audit&composer=1',
    recommendationReason: 'VANCE is built for lead qualification, scoring, and commercial next-step generation.',
    starterPrompts: [
      'Score these leads and rank by priority: [paste lead notes].',
      'Identify which leads to contact this week and draft a short follow-up for each.',
      'Summarise the pipeline state and recommend the three best next actions.',
    ],
    sourceOfTruthHint: 'Paste lead notes, a CRM export snippet, or a description of your ideal customer.',
    fitFor: {
      businessTypes: ['Marketing agency', 'Recruitment', 'Consultancy'],
      primaryGoals: ['Win and progress more leads'],
    },
  },
  {
    id: 'seo_aeo_brief',
    title: 'SEO / AEO Brief',
    plainOutcome: 'Build a research-backed content brief targeting search and AI-answer visibility.',
    timeToResult: '3-5 min',
    recommendedAgentId: 'forge',
    alternateAgentIds: ['echo', 'herald'],
    loreHelps: 'Add brand voice, existing content URLs, or audience notes for a tighter brief.',
    creditIntensity: 'Low',
    cta: 'Build brief with FORGE',
    route: '/app/agents/forge?new=1&outcome=seo_aeo_brief&composer=1',
    recommendationReason: 'FORGE turns topic and audience context into structured, conversion-aware content briefs.',
    starterPrompts: [
      'Write an SEO/AEO content brief for this topic: [topic]. Include angle, key questions, H2 structure, and proof points.',
      'Create a brief for a pillar page targeting [term] with cluster topics and answer-engine hooks.',
      'Turn this existing post into an updated SEO brief with fresh angles and AEO formatting.',
    ],
    sourceOfTruthHint: 'Paste a target keyword, an existing post URL, or a short topic summary.',
    fitFor: {
      businessTypes: ['Marketing agency', 'Creative studio', 'SaaS'],
      primaryGoals: ['Ship content faster'],
    },
  },
  {
    id: 'client_proposal',
    title: 'Client Proposal',
    plainOutcome: 'Turn a brief, notes, or a call summary into a structured proposal with scope and next steps.',
    timeToResult: '3-5 min',
    recommendedAgentId: 'herald',
    alternateAgentIds: ['vance', 'forge'],
    loreHelps: 'Add service description, pricing notes, or past proposal language to improve fit.',
    creditIntensity: 'Low',
    cta: 'Draft proposal with HERALD',
    route: '/app/agents/herald?new=1&outcome=client_proposal&composer=1',
    recommendationReason: 'HERALD is best at turning client context into polished, action-ready deliverables.',
    starterPrompts: [
      'Turn these client notes into a structured proposal outline with scope, deliverables, and next steps.',
      'Draft an introduction and scope section for a proposal based on this brief.',
      'Create a proposal summary and pricing framework from this client call transcript.',
    ],
    sourceOfTruthHint: 'Paste a client brief, call notes, or a short description of the project scope.',
    fitFor: {
      businessTypes: ['Marketing agency', 'Creative studio', 'Consultancy', 'Legal / professional services'],
      primaryGoals: ['Win and progress more leads', 'Handle support and client comms'],
    },
  },
  {
    id: 'support_knowledge_base',
    title: 'Support Knowledge Base',
    plainOutcome: 'Create structured KB articles, FAQs, or SOP docs from questions, calls, or existing materials.',
    timeToResult: '3-5 min',
    recommendedAgentId: 'atlas',
    alternateAgentIds: ['lore', 'cipher'],
    loreHelps: 'Required for the best result — add your existing docs, policies, or product notes.',
    creditIntensity: 'Low',
    cta: 'Build KB article with ATLAS',
    route: '/app/agents/atlas?new=1&outcome=support_knowledge_base&composer=1',
    recommendationReason: 'ATLAS is best at turning scattered knowledge into structured, searchable business docs.',
    starterPrompts: [
      'Write a clear KB article answering this support question: [question].',
      'Turn these product notes into a structured FAQ for customer support.',
      'Create a short SOP from this process description.',
    ],
    sourceOfTruthHint: 'Paste a support question, a product note, or a short policy description.',
    fitFor: {
      businessTypes: ['SaaS', 'Operational services'],
      primaryGoals: ['Handle support and client comms', 'Centralise knowledge and SOPs'],
    },
  },
  {
    id: 'weekly_business_report',
    title: 'Weekly Business Report',
    plainOutcome: 'Compile a structured weekly summary with trends, wins, risks, and actions from your data.',
    timeToResult: '3-5 min',
    recommendedAgentId: 'cipher',
    alternateAgentIds: ['ledger', 'atlas'],
    loreHelps: 'Helpful if you add targets, prior-week summaries, or team notes.',
    creditIntensity: 'Low / Medium',
    cta: 'Build report with CIPHER',
    route: '/app/agents/cipher?new=1&outcome=weekly_business_report&composer=1',
    recommendationReason: 'CIPHER turns numbers and notes into a clear, structured weekly operating review.',
    starterPrompts: [
      "Compile a weekly business report from this data: [paste metrics or notes].",
      "Summarise this week's performance, key risks, and recommended actions.",
      'Turn these weekly numbers into an exec-ready summary with highlights and actions.',
    ],
    sourceOfTruthHint: "Paste this week's metrics, notes, or a short description of your key KPIs.",
    fitFor: {
      businessTypes: ['Marketing agency', 'SaaS', 'Consultancy', 'Operational services'],
      primaryGoals: ['Run weekly reporting'],
    },
  },
];

const STARTER_OUTCOME_BY_ID = new Map(STARTER_OUTCOMES.map((o) => [o.id, o]));

export function getStarterOutcome(outcomeId) {
  return STARTER_OUTCOME_BY_ID.get(String(outcomeId ?? '').trim()) ?? null;
}

export function recommendStarterOutcome(businessType = '', primaryGoal = '') {
  const bt = (businessType ?? '').toLowerCase();
  const pg = (primaryGoal ?? '').toLowerCase();

  // Full match — business type AND goal both present
  for (const outcome of STARTER_OUTCOMES) {
    const bMatch = outcome.fitFor.businessTypes.some((b) => b.toLowerCase() === bt);
    const gMatch = outcome.fitFor.primaryGoals.some((g) => g.toLowerCase() === pg);
    if (bMatch && gMatch) return outcome;
  }

  // Goal match alone
  for (const outcome of STARTER_OUTCOMES) {
    if (outcome.fitFor.primaryGoals.some((g) => g.toLowerCase() === pg)) return outcome;
  }

  // Business-type match alone
  for (const outcome of STARTER_OUTCOMES) {
    if (outcome.fitFor.businessTypes.some((b) => b.toLowerCase() === bt)) return outcome;
  }

  return STARTER_OUTCOMES[0];
}

import {
  SITE_NAME,
  buildBreadcrumbSchema,
  buildCollectionSchema,
  buildFaqPageSchema,
  buildSchemaGraph,
  buildWebPageSchema,
  urlForPath,
} from '../../lib/seo.js';

export const INDUSTRY_HUB_PATH = '/content/industries';
export const INDUSTRY_CONTENT_UPDATED_AT = '2026-06-19';

/**
 * @typedef {{ id: string, name: string, role: string, reason: string, task: string }} IndustryAgentRecommendation
 * @typedef {{ title: string, steps: string[], outcome: string }} IndustryWorkflowExample
 * @typedef {{ setupTime: string, monthlyHours: string, reviewLoad: string, paybackSignal: string }} IndustryRoiEstimate
 * @typedef {{ question: string, answer: string }} IndustryFaq
 * @typedef {{
 *   slug: string,
 *   name: string,
 *   audience: string,
 *   category: string,
 *   summary: string,
 *   metaTitle: string,
 *   metaDescription: string,
 *   painPoints: string[],
 *   aiOpportunities: string[],
 *   prymalUseCases: string[],
 *   agentRecommendations: IndustryAgentRecommendation[],
 *   workflowExamples: IndustryWorkflowExample[],
 *   roiEstimate: IndustryRoiEstimate,
 *   faq: IndustryFaq[],
 *   relatedSlugs: string[],
 *   internalLinks: { title: string, to: string, description: string, cta?: string }[],
 * }} IndustryPage
 */

const AGENTS = {
  atlas: { id: 'atlas', name: 'ATLAS', role: 'planning and operations' },
  cipher: { id: 'cipher', name: 'CIPHER', role: 'risk and data handling' },
  echo: { id: 'echo', name: 'ECHO', role: 'support and response quality' },
  forge: { id: 'forge', name: 'FORGE', role: 'creative production' },
  herald: { id: 'herald', name: 'HERALD', role: 'outreach and communications' },
  ledger: { id: 'ledger', name: 'LEDGER', role: 'finance and commercial review' },
  lore: { id: 'lore', name: 'LORE', role: 'shared business memory' },
  nexus: { id: 'nexus', name: 'NEXUS', role: 'workflow automation' },
  oracle: { id: 'oracle', name: 'ORACLE', role: 'market and content research' },
  sage: { id: 'sage', name: 'SAGE', role: 'strategy and advisory work' },
  scout: { id: 'scout', name: 'SCOUT', role: 'research and prospecting' },
  sentinel: { id: 'sentinel', name: 'SENTINEL', role: 'output validation' },
  vance: { id: 'vance', name: 'VANCE', role: 'sales execution' },
  wren: { id: 'wren', name: 'WREN', role: 'admin and scheduling' },
};

function agent(id, reason, task) {
  const match = AGENTS[id];
  return { ...match, reason, task };
}

function workflow(title, steps, outcome) {
  return { title, steps, outcome };
}

function baseFaq(name, audience, workflowLabel) {
  return [
    {
      question: `How can ${name} use Prymal without replacing their team?`,
      answer: `Prymal gives ${audience} specialist agents, shared memory, workflow automation, and review controls for repeatable work. People still approve sensitive decisions, client-facing advice, and final delivery.`,
    },
    {
      question: `What should ${name} automate first?`,
      answer: `Start with a high-volume workflow that already has a checklist, such as ${workflowLabel}. Prymal works best when the desired inputs, review points, and outputs are explicit.`,
    },
    {
      question: `Does Prymal keep industry context available across workflows?`,
      answer: 'Yes. LORE shared business memory can hold approved company context, policies, examples, and project notes so agents can work from the same operating context.',
    },
  ];
}

function defaultInternalLinks(name) {
  return [
    {
      title: 'AI operating system for business',
      to: '/ai-operating-system-for-business',
      description: `${name} can use Prymal as an AI operating system rather than a loose set of disconnected tools.`,
      cta: 'Read the guide ->',
    },
    {
      title: 'Workflow automation',
      to: '/features/ai-workflow-automation',
      description: 'See how repeatable business workflows can move from manual checklists to governed agent execution.',
      cta: 'Explore workflows ->',
    },
    {
      title: 'Prymal entity graph',
      to: '/content/entities/prymal',
      description: 'Understand the core relationship: Prymal -> AI Operating System.',
      cta: 'Open entity ->',
    },
  ];
}

function buildIndustry({
  slug,
  name,
  audience,
  category,
  summary,
  painPoints,
  aiOpportunities,
  prymalUseCases,
  agentRecommendations,
  workflowExamples,
  roiEstimate,
  faq,
  relatedSlugs,
}) {
  return {
    slug,
    name,
    audience,
    category,
    summary,
    metaTitle: `${name} AI Operating System | Prymal industry workflows`,
    metaDescription: `${summary} Explore ${name.toLowerCase()} pain points, AI opportunities, Prymal use cases, agent recommendations, workflow examples, ROI estimates, and FAQ.`,
    painPoints,
    aiOpportunities,
    prymalUseCases,
    agentRecommendations,
    workflowExamples,
    roiEstimate,
    faq,
    relatedSlugs,
    internalLinks: defaultInternalLinks(name),
  };
}

export const INDUSTRIES = [
  buildIndustry({
    slug: 'agencies',
    name: 'Agencies',
    audience: 'agency teams',
    category: 'Professional services',
    summary: 'Prymal helps agencies coordinate strategy, content, reporting, client context, and delivery QA through a governed AI operating system.',
    painPoints: [
      'Client context is scattered across calls, briefs, decks, and project tools.',
      'Reporting and content production consume senior time that should be spent on strategy.',
      'Handoffs between account, creative, and delivery teams create avoidable rework.',
    ],
    aiOpportunities: [
      'Turn approved client context into reusable memory for every campaign workflow.',
      'Draft briefs, content angles, research notes, and reporting narratives from one shared source of truth.',
      'Use validation steps before client-facing work leaves the workspace.',
    ],
    prymalUseCases: [
      'Client onboarding memory packs for brand voice, offers, competitors, and approval rules.',
      'Monthly performance report drafting with human review before delivery.',
      'Campaign production workflows that coordinate research, creative, QA, and account updates.',
    ],
    agentRecommendations: [
      agent('lore', 'Keeps approved client context available across campaigns.', 'Store briefs, tone, offers, examples, and decision notes.'),
      agent('atlas', 'Turns deliverables into repeatable operating plans.', 'Plan weekly account actions and delivery checkpoints.'),
      agent('forge', 'Accelerates first-pass creative and campaign assets.', 'Draft content, ad angles, and creative variants.'),
      agent('sentinel', 'Adds a review layer before client-facing outputs.', 'Check brand fit, claims, missing context, and tone.'),
    ],
    workflowExamples: [
      workflow('Client onboarding pack', ['Capture brief and goals', 'Load approved context into LORE', 'Generate first 30-day action plan', 'Send plan for account lead review'], 'A reusable client memory layer and launch plan.'),
      workflow('Monthly client report', ['Pull notes and campaign metrics', 'Draft narrative summary', 'Flag risks and follow-ups', 'Hold for senior approval'], 'Faster report preparation with clearer next actions.'),
    ],
    roiEstimate: {
      setupTime: '2-4 hours to model the first client workflow.',
      monthlyHours: '10-30 hours recovered from reporting, briefing, and first-pass production.',
      reviewLoad: '20-40% fewer avoidable review cycles when client memory is maintained.',
      paybackSignal: 'One retained client workflow running weekly usually surfaces the first measurable time savings.',
    },
    faq: baseFaq('Agencies', 'agency teams', 'client onboarding or monthly reporting'),
    relatedSlugs: ['marketing-teams', 'consultants', 'smbs'],
  }),
  buildIndustry({
    slug: 'recruiters',
    name: 'Recruiters',
    audience: 'recruitment teams',
    category: 'Talent',
    summary: 'Prymal helps recruiters systemise role intake, candidate research, outreach, screening notes, and client communication with governed AI workflows.',
    painPoints: [
      'Role requirements change quickly and important context lives in recruiter notes.',
      'Candidate outreach and screening summaries are repetitive but quality-sensitive.',
      'Shortlists need clear evidence without exposing private or irrelevant information.',
    ],
    aiOpportunities: [
      'Convert role intake into structured search criteria and outreach variants.',
      'Summarise candidate notes against role requirements for recruiter review.',
      'Keep client and candidate communication consistent without removing human judgment.',
    ],
    prymalUseCases: [
      'Role intake memory for must-have criteria, salary bands, process stages, and client tone.',
      'Candidate outreach drafting with personalisation guidance and recruiter approval.',
      'Shortlist summary workflows that compare evidence to role criteria.',
    ],
    agentRecommendations: [
      agent('scout', 'Finds and organises role-specific research inputs.', 'Research target companies, role terminology, and talent pools.'),
      agent('herald', 'Drafts respectful candidate and client communications.', 'Create outreach, follow-ups, and process updates.'),
      agent('wren', 'Supports scheduling and admin-heavy handoffs.', 'Prepare interview packs and next-step reminders.'),
      agent('sentinel', 'Checks summaries for risky or unsupported statements.', 'Review candidate summaries before external sharing.'),
    ],
    workflowExamples: [
      workflow('Role intake to search plan', ['Capture client requirements', 'Structure criteria and exclusions', 'Generate sourcing angles', 'Review with lead recruiter'], 'A consistent search plan before outreach starts.'),
      workflow('Candidate shortlist pack', ['Summarise candidate notes', 'Map evidence to role requirements', 'Flag gaps and questions', 'Approve before client delivery'], 'Clearer shortlist narratives with recruiter control.'),
    ],
    roiEstimate: {
      setupTime: '1-3 hours for a role intake and shortlist template.',
      monthlyHours: '8-24 hours recovered from outreach drafting and candidate summarisation.',
      reviewLoad: '15-30% less rework on shortlist packs when criteria are structured early.',
      paybackSignal: 'The strongest signal is faster movement from role intake to first qualified outreach.',
    },
    faq: baseFaq('Recruiters', 'recruitment teams', 'role intake and candidate shortlist preparation'),
    relatedSlugs: ['sales-teams', 'consultants', 'smbs'],
  }),
  buildIndustry({
    slug: 'accountants',
    name: 'Accountants',
    audience: 'accounting teams',
    category: 'Professional services',
    summary: 'Prymal helps accounting firms organise client context, recurring checklists, finance admin, and review-ready communications without replacing professional oversight.',
    painPoints: [
      'Recurring client work depends on checklists, reminders, and context spread across inboxes.',
      'Client communications need to be accurate, careful, and easy to review.',
      'Internal knowledge about each client is often trapped with one team member.',
    ],
    aiOpportunities: [
      'Turn recurring client processes into memory-aware workflows.',
      'Draft client requests and summaries from approved context for accountant review.',
      'Use validation before any finance-sensitive message is sent.',
    ],
    prymalUseCases: [
      'Client year-end preparation checklists with reminders and context notes.',
      'Management-report commentary drafts that require accountant approval.',
      'Client query triage using approved firm guidance and engagement context.',
    ],
    agentRecommendations: [
      agent('ledger', 'Supports finance-sensitive review and commercial context.', 'Organise finance tasks, commentary, and client request drafts.'),
      agent('cipher', 'Helps protect sensitive client data handling.', 'Flag risky data exposure and privacy-sensitive workflows.'),
      agent('lore', 'Keeps client-specific context reusable.', 'Store engagement notes, deadlines, and approved explanation styles.'),
      agent('sentinel', 'Adds review before finance-related outputs are shared.', 'Check completeness, tone, and unsupported claims.'),
    ],
    workflowExamples: [
      workflow('Client information request', ['Load engagement requirements', 'Draft missing-information request', 'Check for sensitive details', 'Send to accountant for approval'], 'More consistent client chasers with less manual drafting.'),
      workflow('Monthly commentary draft', ['Gather approved notes', 'Draft plain-English commentary', 'Flag uncertainty', 'Review before client delivery'], 'Faster first-pass commentary while preserving professional review.'),
    ],
    roiEstimate: {
      setupTime: '2-5 hours for a recurring client-service workflow.',
      monthlyHours: '6-18 hours recovered from chasers, commentary drafting, and checklist admin.',
      reviewLoad: '10-25% fewer missing-context review loops when client memory is current.',
      paybackSignal: 'Payback appears when the same recurring checklist serves multiple clients.',
    },
    faq: baseFaq('Accountants', 'accounting teams', 'client information requests or monthly commentary drafting'),
    relatedSlugs: ['financial-advisors', 'law-firms', 'smbs'],
  }),
  buildIndustry({
    slug: 'consultants',
    name: 'Consultants',
    audience: 'consulting teams',
    category: 'Professional services',
    summary: 'Prymal helps consultants turn discovery, research, analysis, recommendations, and client follow-up into repeatable AI-assisted delivery workflows.',
    painPoints: [
      'Discovery notes, client context, and assumptions are hard to keep aligned.',
      'Research, synthesis, and deck narratives take significant non-billable time.',
      'Recommendations need consistent evidence and clear next actions.',
    ],
    aiOpportunities: [
      'Convert discovery into structured memory and reusable project context.',
      'Summarise research and produce first-pass recommendation narratives.',
      'Coordinate follow-up actions through workflow checkpoints.',
    ],
    prymalUseCases: [
      'Discovery-to-diagnosis workflows for client projects.',
      'Research synthesis with source notes, assumptions, and decision logs.',
      'Action-plan generation for workshops, reviews, and implementation sprints.',
    ],
    agentRecommendations: [
      agent('sage', 'Frames strategy and recommendations.', 'Turn findings into structured recommendations and next steps.'),
      agent('scout', 'Supports research-heavy discovery.', 'Collect market, customer, and operational context.'),
      agent('atlas', 'Converts recommendations into implementation plans.', 'Create workstreams, milestones, and owner prompts.'),
      agent('lore', 'Preserves project memory across engagements.', 'Store assumptions, workshop notes, and client context.'),
    ],
    workflowExamples: [
      workflow('Discovery synthesis', ['Ingest notes and briefs', 'Group themes and gaps', 'Draft diagnosis', 'Review assumptions with consultant'], 'A cleaner jump from discovery to recommendation.'),
      workflow('Implementation plan', ['Select recommendation', 'Break into workstreams', 'Create owner-ready actions', 'Schedule review checkpoints'], 'Advice becomes an executable plan.'),
    ],
    roiEstimate: {
      setupTime: '2-4 hours for discovery, synthesis, and action-plan templates.',
      monthlyHours: '12-28 hours recovered from research synthesis and first-pass documentation.',
      reviewLoad: '20-35% less rework when assumptions and evidence are visible.',
      paybackSignal: 'The first repeated engagement type usually becomes a reusable delivery asset.',
    },
    faq: baseFaq('Consultants', 'consulting teams', 'discovery synthesis or implementation planning'),
    relatedSlugs: ['agencies', 'coaches', 'enterprise-teams'],
  }),
  buildIndustry({
    slug: 'marketing-teams',
    name: 'Marketing Teams',
    audience: 'marketing teams',
    category: 'Go-to-market',
    summary: 'Prymal helps marketing teams coordinate research, campaign planning, content production, reporting, and brand-safe review in one AI operating system.',
    painPoints: [
      'Campaign context is split between strategy docs, analytics, briefs, and channel plans.',
      'Content production volume rises faster than review capacity.',
      'Brand voice and claims guidance are easy to lose in fast-moving workflows.',
    ],
    aiOpportunities: [
      'Make brand voice, ICP, offers, and campaign rules available to every agent.',
      'Generate content briefs, channel variants, and reporting narratives with review steps.',
      'Use output validation to catch risky claims or off-brand content before publishing.',
    ],
    prymalUseCases: [
      'Campaign brief generation from strategy and audience context.',
      'Content repurposing across email, social, blog, and sales enablement.',
      'Weekly marketing performance summaries with action recommendations.',
    ],
    agentRecommendations: [
      agent('oracle', 'Supports market and topic research.', 'Find themes, questions, and content angles.'),
      agent('forge', 'Creates first-pass campaign assets.', 'Draft content, creative variants, and briefs.'),
      agent('echo', 'Improves response quality and customer-facing language.', 'Review messaging for clarity and tone.'),
      agent('nexus', 'Turns campaign work into repeatable workflows.', 'Coordinate briefing, production, review, and publishing steps.'),
    ],
    workflowExamples: [
      workflow('Campaign launch workflow', ['Load strategy and audience memory', 'Generate channel plan', 'Draft assets', 'Route through review'], 'A repeatable launch process with fewer loose handoffs.'),
      workflow('Content repurposing workflow', ['Select source asset', 'Create channel variants', 'Check claims and tone', 'Prepare publishing pack'], 'More output from approved source material.'),
    ],
    roiEstimate: {
      setupTime: '2-4 hours for brand memory and campaign templates.',
      monthlyHours: '12-35 hours recovered from content drafting and campaign admin.',
      reviewLoad: '20-40% fewer avoidable edits when brand and claims rules are available.',
      paybackSignal: 'Payback is clearest when one campaign asset becomes many approved variants.',
    },
    faq: baseFaq('Marketing Teams', 'marketing teams', 'campaign launch or content repurposing'),
    relatedSlugs: ['agencies', 'ecommerce-brands', 'sales-teams'],
  }),
  buildIndustry({
    slug: 'sales-teams',
    name: 'Sales Teams',
    audience: 'sales teams',
    category: 'Go-to-market',
    summary: 'Prymal helps sales teams turn research, outreach, follow-up, call notes, and handoffs into repeatable AI-assisted sales workflows.',
    painPoints: [
      'Prospect research and personalised follow-up slow down pipeline motion.',
      'Call notes and next steps are inconsistent across reps.',
      'Marketing, sales, and delivery handoffs lose important customer context.',
    ],
    aiOpportunities: [
      'Create prospect-specific research briefs and outreach drafts.',
      'Turn call notes into follow-up actions, summaries, and CRM-ready fields.',
      'Preserve deal context for smoother handoffs after close.',
    ],
    prymalUseCases: [
      'Account research packs before discovery calls.',
      'Post-call summary and follow-up drafting with rep review.',
      'Sales-to-delivery handoff memory for closed-won accounts.',
    ],
    agentRecommendations: [
      agent('vance', 'Supports sales execution and follow-up.', 'Draft outreach, follow-ups, and account next steps.'),
      agent('scout', 'Prepares account and buyer research.', 'Gather public context and account hypotheses.'),
      agent('herald', 'Keeps outbound communication consistent.', 'Create polite, relevant email and message variants.'),
      agent('atlas', 'Turns deal notes into execution plans.', 'Create handoff checklists and implementation actions.'),
    ],
    workflowExamples: [
      workflow('Account research brief', ['Enter target account', 'Collect public context', 'Generate pain hypotheses', 'Review before outreach'], 'Better-prepared reps before first contact.'),
      workflow('Call notes to follow-up', ['Capture call notes', 'Extract commitments and questions', 'Draft follow-up', 'Route for rep approval'], 'Faster follow-up without losing nuance.'),
    ],
    roiEstimate: {
      setupTime: '1-3 hours for account research and follow-up templates.',
      monthlyHours: '8-26 hours recovered from research and post-call admin.',
      reviewLoad: '15-30% fewer follow-up rewrites when context is structured.',
      paybackSignal: 'Look for shorter time from meeting to approved follow-up.',
    },
    faq: baseFaq('Sales Teams', 'sales teams', 'account research or post-call follow-up'),
    relatedSlugs: ['marketing-teams', 'saas-companies', 'recruiters'],
  }),
  buildIndustry({
    slug: 'construction-firms',
    name: 'Construction Firms',
    audience: 'construction firms',
    category: 'Operations',
    summary: 'Prymal helps construction firms coordinate project admin, tender support, site updates, document context, and operational workflows with human review.',
    painPoints: [
      'Project information lives across emails, site notes, documents, and spreadsheets.',
      'Tender responses and project updates require consistent detail under time pressure.',
      'Operational handoffs between office and site teams create delays.',
    ],
    aiOpportunities: [
      'Create structured project memory for each job or tender.',
      'Draft updates, summaries, and response packs from approved context.',
      'Use workflow checkpoints for review before external or contractual communication.',
    ],
    prymalUseCases: [
      'Tender response preparation and requirement tracking.',
      'Weekly project update drafting from approved notes.',
      'Internal issue logs that convert site notes into office actions.',
    ],
    agentRecommendations: [
      agent('atlas', 'Coordinates operational plans and project actions.', 'Create project task maps and status summaries.'),
      agent('ledger', 'Supports commercial and cost-sensitive admin.', 'Organise cost notes, quote context, and invoice questions.'),
      agent('wren', 'Handles scheduling and admin-heavy follow-ups.', 'Prepare reminders, meeting packs, and action logs.'),
      agent('lore', 'Keeps tender and project context available.', 'Store requirements, site notes, and approved project facts.'),
    ],
    workflowExamples: [
      workflow('Tender response pack', ['Load tender requirements', 'Map required answers', 'Draft response sections', 'Route for commercial review'], 'A more complete first-pass tender pack.'),
      workflow('Site update to action log', ['Capture site notes', 'Summarise progress and blockers', 'Create actions', 'Share for project manager approval'], 'Clearer office-site coordination.'),
    ],
    roiEstimate: {
      setupTime: '2-5 hours for a tender or weekly project-update workflow.',
      monthlyHours: '8-22 hours recovered from admin, summaries, and response drafting.',
      reviewLoad: '15-30% fewer missing-detail review loops when project memory is maintained.',
      paybackSignal: 'Payback shows when tender packs or weekly reports reuse the same structure.',
    },
    faq: baseFaq('Construction Firms', 'construction teams', 'tender preparation or weekly project updates'),
    relatedSlugs: ['trades', 'manufacturing-companies', 'smbs'],
  }),
  buildIndustry({
    slug: 'trades',
    name: 'Trades',
    audience: 'trade businesses',
    category: 'Operations',
    summary: 'Prymal helps trades organise customer enquiries, quotes, scheduling, follow-ups, job notes, and repeatable admin without adding operational complexity.',
    painPoints: [
      'Customer enquiries, job details, and quote notes arrive through too many channels.',
      'Follow-ups and admin often happen after hours.',
      'Repeat jobs still require manual rewriting of similar messages and checklists.',
    ],
    aiOpportunities: [
      'Turn enquiry details into quote-ready notes and task lists.',
      'Draft customer updates, reminders, and aftercare messages.',
      'Store reusable service explanations, policies, and job templates.',
    ],
    prymalUseCases: [
      'Lead enquiry triage and quote-prep workflows.',
      'Job completion summaries and customer aftercare follow-up.',
      'Recurring service reminder workflows for existing customers.',
    ],
    agentRecommendations: [
      agent('wren', 'Reduces admin work around scheduling and reminders.', 'Prepare job notes, follow-ups, and appointment prompts.'),
      agent('atlas', 'Turns job details into practical plans.', 'Create task lists and handoff notes.'),
      agent('herald', 'Drafts clear customer communication.', 'Create quote chasers, confirmations, and updates.'),
      agent('ledger', 'Supports quote and payment-related admin.', 'Organise quote details and payment follow-up drafts.'),
    ],
    workflowExamples: [
      workflow('Enquiry to quote prep', ['Capture enquiry details', 'Ask for missing information', 'Create job checklist', 'Prepare quote notes'], 'Less admin between enquiry and response.'),
      workflow('Job completion follow-up', ['Record completed work', 'Draft customer summary', 'Prepare aftercare note', 'Set reminder'], 'More consistent customer follow-through.'),
    ],
    roiEstimate: {
      setupTime: '1-2 hours for enquiry and follow-up templates.',
      monthlyHours: '5-15 hours recovered from admin and customer messaging.',
      reviewLoad: '10-25% fewer missed follow-ups when reminders are workflow-driven.',
      paybackSignal: 'The first signal is faster response time to new enquiries.',
    },
    faq: baseFaq('Trades', 'trade businesses', 'enquiry triage or customer follow-up'),
    relatedSlugs: ['construction-firms', 'smbs', 'estate-agents'],
  }),
  buildIndustry({
    slug: 'estate-agents',
    name: 'Estate Agents',
    audience: 'estate agency teams',
    category: 'Sales and property',
    summary: 'Prymal helps estate agents manage property context, vendor updates, buyer communication, listing content, and operational follow-ups.',
    painPoints: [
      'Property, vendor, and buyer context changes quickly across multiple conversations.',
      'Listing copy, viewing follow-up, and vendor updates are repetitive but tone-sensitive.',
      'Negotiation and compliance-sensitive communication needs careful human oversight.',
    ],
    aiOpportunities: [
      'Keep approved property facts and vendor preferences in shared memory.',
      'Draft listing content and buyer follow-ups from accurate property context.',
      'Use review steps before sensitive or external communication.',
    ],
    prymalUseCases: [
      'Property listing content packs based on approved facts.',
      'Viewing follow-up workflows for buyers and vendors.',
      'Weekly vendor update summaries with next actions.',
    ],
    agentRecommendations: [
      agent('vance', 'Supports sales follow-up and opportunity progression.', 'Draft buyer and vendor next-step messages.'),
      agent('herald', 'Keeps property communication polished.', 'Create listing, viewing, and update messages.'),
      agent('forge', 'Creates first-pass listing and marketing assets.', 'Draft property descriptions and campaign variants.'),
      agent('lore', 'Stores approved property facts and preferences.', 'Maintain property, vendor, and buyer context.'),
    ],
    workflowExamples: [
      workflow('Listing pack creation', ['Load approved property facts', 'Draft listing copy', 'Create channel variants', 'Review before publishing'], 'Faster listing production with fewer fact errors.'),
      workflow('Viewing follow-up', ['Capture viewing notes', 'Draft buyer follow-up', 'Summarise vendor feedback', 'Set next action'], 'More consistent post-viewing communication.'),
    ],
    roiEstimate: {
      setupTime: '1-3 hours for listing and follow-up templates.',
      monthlyHours: '7-20 hours recovered from listing copy and follow-up admin.',
      reviewLoad: '15-30% fewer copy edits when approved property facts are reused.',
      paybackSignal: 'Look for faster movement from valuation or instruction to live listing.',
    },
    faq: baseFaq('Estate Agents', 'estate agency teams', 'listing pack creation or viewing follow-up'),
    relatedSlugs: ['sales-teams', 'trades', 'smbs'],
  }),
  buildIndustry({
    slug: 'law-firms',
    name: 'Law Firms',
    audience: 'legal teams',
    category: 'Professional services',
    summary: 'Prymal helps law firms organise matter context, internal checklists, client updates, and knowledge workflows while preserving lawyer review.',
    painPoints: [
      'Matter context is complex and changes across emails, calls, documents, and internal notes.',
      'Client updates and internal summaries are time-consuming but high-risk if inaccurate.',
      'Knowledge reuse is difficult when precedents and process guidance are scattered.',
    ],
    aiOpportunities: [
      'Create matter memory from approved, reviewable context.',
      'Draft internal summaries, client update outlines, and task lists for lawyer review.',
      'Apply validation and human approval before external or advice-sensitive outputs.',
    ],
    prymalUseCases: [
      'Matter onboarding memory and internal checklist generation.',
      'Client update drafts based on approved matter notes.',
      'Internal knowledge workflows for process guidance and precedent location notes.',
    ],
    agentRecommendations: [
      agent('lore', 'Keeps matter and client context structured.', 'Store approved notes, requirements, and chronology.'),
      agent('sentinel', 'Adds review support for sensitive outputs.', 'Flag missing context, unsupported statements, and tone risks.'),
      agent('wren', 'Supports admin-heavy matter workflows.', 'Prepare task lists, reminders, and meeting packs.'),
      agent('cipher', 'Helps protect sensitive information handling.', 'Flag privacy-sensitive or access-sensitive workflows.'),
    ],
    workflowExamples: [
      workflow('Matter onboarding summary', ['Capture approved matter notes', 'Structure chronology and open questions', 'Create internal checklist', 'Route to lawyer for review'], 'A clearer starting point for matter work.'),
      workflow('Client update draft', ['Select approved matter updates', 'Draft plain-English summary', 'Flag unresolved points', 'Hold for lawyer approval'], 'Faster update preparation without bypassing review.'),
    ],
    roiEstimate: {
      setupTime: '3-6 hours for a controlled matter workflow.',
      monthlyHours: '6-20 hours recovered from internal summaries, task lists, and update drafting.',
      reviewLoad: '10-25% fewer missing-context loops when matter memory is maintained.',
      paybackSignal: 'The clearest signal is reduced time preparing repeat matter updates.',
    },
    faq: [
      ...baseFaq('Law Firms', 'legal teams', 'matter onboarding or client update drafting'),
      {
        question: 'Does Prymal provide legal advice?',
        answer: 'No. Prymal can support drafting, organisation, and workflow review, but legal advice and client-facing legal judgment must remain with qualified professionals.',
      },
    ],
    relatedSlugs: ['accountants', 'financial-advisors', 'enterprise-teams'],
  }),
  buildIndustry({
    slug: 'financial-advisors',
    name: 'Financial Advisors',
    audience: 'financial advisory teams',
    category: 'Financial services',
    summary: 'Prymal helps financial advisors organise client context, review workflows, meeting preparation, and follow-up admin while keeping regulated advice under human control.',
    painPoints: [
      'Client context, meeting notes, and follow-up actions are difficult to keep current.',
      'Review-ready communications require care, consistency, and documented assumptions.',
      'Admin work can reduce time available for relationship management.',
    ],
    aiOpportunities: [
      'Prepare meeting packs and follow-up drafts from approved client context.',
      'Structure action lists, open questions, and evidence needed for review.',
      'Use validation before communications that may touch regulated topics.',
    ],
    prymalUseCases: [
      'Client meeting preparation workflows.',
      'Post-meeting follow-up and action list drafting.',
      'Internal review packs that organise notes, assumptions, and missing information.',
    ],
    agentRecommendations: [
      agent('ledger', 'Supports finance-sensitive organisation and review.', 'Prepare client action notes and commercial summaries.'),
      agent('sage', 'Helps frame planning discussions without replacing advice.', 'Organise objectives, options, and open questions.'),
      agent('sentinel', 'Checks advice-sensitive outputs before review.', 'Flag unsupported claims and missing caveats.'),
      agent('lore', 'Stores approved client context and meeting history.', 'Maintain reviewable client memory.'),
    ],
    workflowExamples: [
      workflow('Client review meeting pack', ['Load approved client context', 'Summarise last actions', 'List open questions', 'Prepare agenda for advisor review'], 'Better-prepared meetings with less admin time.'),
      workflow('Post-meeting action workflow', ['Capture notes', 'Extract actions and missing information', 'Draft follow-up', 'Hold for advisor approval'], 'Consistent follow-up with review gates.'),
    ],
    roiEstimate: {
      setupTime: '3-6 hours for a review-safe meeting workflow.',
      monthlyHours: '6-18 hours recovered from preparation and follow-up admin.',
      reviewLoad: '10-25% fewer missing-detail reviews when client memory is structured.',
      paybackSignal: 'Payback appears when recurring client reviews follow a repeatable process.',
    },
    faq: [
      ...baseFaq('Financial Advisors', 'financial advisory teams', 'client review meeting preparation'),
      {
        question: 'Does Prymal provide financial advice?',
        answer: 'No. Prymal can support organisation, drafting, and workflow review, but regulated financial advice and suitability decisions must remain with qualified professionals.',
      },
    ],
    relatedSlugs: ['accountants', 'law-firms', 'enterprise-teams'],
  }),
  buildIndustry({
    slug: 'coaches',
    name: 'Coaches',
    audience: 'coaches and advisory businesses',
    category: 'Advisory',
    summary: 'Prymal helps coaches organise client notes, programme assets, session preparation, follow-up, and content workflows in one AI operating system.',
    painPoints: [
      'Client goals, session notes, and programme resources are hard to reuse consistently.',
      'Follow-up content and accountability prompts consume time between sessions.',
      'Marketing content and client delivery often compete for the same founder time.',
    ],
    aiOpportunities: [
      'Turn client notes and programme frameworks into structured memory.',
      'Draft session agendas, follow-up prompts, and resource packs for review.',
      'Repurpose coaching ideas into marketing content without losing voice.',
    ],
    prymalUseCases: [
      'Client session preparation and follow-up workflows.',
      'Programme content library organisation in LORE.',
      'Thought-leadership content drafting from approved frameworks.',
    ],
    agentRecommendations: [
      agent('sage', 'Supports advisory framing and reflection prompts.', 'Draft session agendas and framework summaries.'),
      agent('forge', 'Creates content from approved coaching ideas.', 'Draft posts, emails, and programme materials.'),
      agent('herald', 'Keeps client communication warm and consistent.', 'Prepare reminders, follow-ups, and check-ins.'),
      agent('lore', 'Stores programme and client context.', 'Maintain frameworks, notes, and approved resources.'),
    ],
    workflowExamples: [
      workflow('Session preparation', ['Review client memory', 'Draft agenda', 'Suggest questions', 'Confirm with coach'], 'More prepared sessions with less pre-work.'),
      workflow('Framework to content', ['Select approved framework', 'Create content angles', 'Draft assets', 'Review voice and claims'], 'Marketing content that stays aligned with coaching IP.'),
    ],
    roiEstimate: {
      setupTime: '1-3 hours for programme memory and follow-up templates.',
      monthlyHours: '6-20 hours recovered from prep, follow-up, and content drafting.',
      reviewLoad: '15-30% fewer rewrites when voice and programme context are available.',
      paybackSignal: 'Payback appears when one framework produces both client resources and marketing assets.',
    },
    faq: baseFaq('Coaches', 'coaches and advisory businesses', 'session preparation or follow-up drafting'),
    relatedSlugs: ['consultants', 'startups', 'smbs'],
  }),
  buildIndustry({
    slug: 'health-clinics',
    name: 'Health Clinics',
    audience: 'health clinic teams',
    category: 'Healthcare operations',
    summary: 'Prymal helps health clinics organise admin workflows, patient communication drafts, policy knowledge, and operational follow-ups with clinical review where needed.',
    painPoints: [
      'Operational questions, appointment admin, and policy details create repetitive workload.',
      'Patient-facing communication needs accuracy, sensitivity, and review.',
      'Clinic knowledge is often split between staff, documents, and inboxes.',
    ],
    aiOpportunities: [
      'Use approved clinic policies and service information as shared memory.',
      'Draft admin communications and internal summaries for staff review.',
      'Coordinate operational follow-up workflows without replacing clinical judgment.',
    ],
    prymalUseCases: [
      'Appointment preparation and reminder workflows.',
      'Policy and service information retrieval for staff.',
      'Post-visit admin follow-up templates reviewed by the clinic team.',
    ],
    agentRecommendations: [
      agent('wren', 'Supports appointment and admin workflows.', 'Prepare reminders, follow-ups, and internal task lists.'),
      agent('lore', 'Keeps approved clinic information available.', 'Store policies, service details, and FAQs.'),
      agent('sentinel', 'Adds review for sensitive communication.', 'Flag clinical, privacy, or unsupported claims.'),
      agent('cipher', 'Supports privacy-conscious handling of sensitive context.', 'Flag workflows that need tighter access and review.'),
    ],
    workflowExamples: [
      workflow('Appointment admin workflow', ['Capture appointment context', 'Draft reminder or prep note', 'Check against clinic policy', 'Approve before sending'], 'More consistent patient admin communication.'),
      workflow('Clinic policy answer workflow', ['Load approved policy', 'Answer staff question', 'Show source context', 'Escalate uncertain items'], 'Faster internal answers from approved information.'),
    ],
    roiEstimate: {
      setupTime: '3-6 hours for approved policy memory and admin templates.',
      monthlyHours: '6-18 hours recovered from repetitive admin and internal questions.',
      reviewLoad: '10-25% fewer staff interruptions when approved information is easy to retrieve.',
      paybackSignal: 'The first signal is fewer repeated policy and appointment-prep questions.',
    },
    faq: [
      ...baseFaq('Health Clinics', 'health clinic teams', 'appointment admin or clinic policy retrieval'),
      {
        question: 'Does Prymal provide medical advice?',
        answer: 'No. Prymal can help with admin drafting and approved information retrieval, but medical advice, diagnosis, and clinical decisions must remain with qualified professionals.',
      },
    ],
    relatedSlugs: ['dentists', 'smbs', 'enterprise-teams'],
  }),
  buildIndustry({
    slug: 'dentists',
    name: 'Dentists',
    audience: 'dental practices',
    category: 'Healthcare operations',
    summary: 'Prymal helps dental practices organise appointment admin, treatment-plan communication drafts, patient follow-up, and practice knowledge with appropriate review.',
    painPoints: [
      'Reception, follow-up, and treatment-admin questions create repeated manual work.',
      'Patient communication must be clear, careful, and aligned with practice policy.',
      'Practice knowledge is often held by experienced staff instead of reusable systems.',
    ],
    aiOpportunities: [
      'Store approved practice policies, service information, and patient communication patterns.',
      'Draft appointment reminders, aftercare notes, and admin follow-ups for review.',
      'Coordinate recurring recall or treatment-admin workflows.',
    ],
    prymalUseCases: [
      'Recall and appointment reminder workflows.',
      'Aftercare communication drafts from approved practice guidance.',
      'Internal knowledge base for reception and operations staff.',
    ],
    agentRecommendations: [
      agent('wren', 'Supports reception and scheduling admin.', 'Prepare reminders, recall prompts, and follow-up tasks.'),
      agent('herald', 'Drafts clear patient communication.', 'Create appointment, aftercare, and admin messages.'),
      agent('lore', 'Stores approved practice guidance.', 'Maintain service details, policies, and message examples.'),
      agent('sentinel', 'Reviews sensitive communication before use.', 'Flag medical, privacy, or unsupported statements.'),
    ],
    workflowExamples: [
      workflow('Recall workflow', ['Identify recall context', 'Draft patient reminder', 'Check against practice policy', 'Queue for staff approval'], 'More consistent recall communication.'),
      workflow('Aftercare note drafting', ['Select treatment context', 'Use approved aftercare guidance', 'Draft patient note', 'Review before sending'], 'Faster patient communication with clinical oversight.'),
    ],
    roiEstimate: {
      setupTime: '2-5 hours for recall and approved aftercare templates.',
      monthlyHours: '5-16 hours recovered from reminders, follow-ups, and reception queries.',
      reviewLoad: '10-25% fewer repeated admin questions when practice knowledge is centralised.',
      paybackSignal: 'Payback shows when recall and aftercare workflows run every week.',
    },
    faq: [
      ...baseFaq('Dentists', 'dental practices', 'recall reminders or aftercare drafting'),
      {
        question: 'Does Prymal provide dental advice?',
        answer: 'No. Prymal can help with admin workflows and approved information drafts, but diagnosis, treatment decisions, and clinical advice must remain with dental professionals.',
      },
    ],
    relatedSlugs: ['health-clinics', 'smbs', 'coaches'],
  }),
  buildIndustry({
    slug: 'ecommerce-brands',
    name: 'Ecommerce Brands',
    audience: 'ecommerce teams',
    category: 'Commerce',
    summary: 'Prymal helps ecommerce brands coordinate product knowledge, customer support, merchandising, lifecycle content, and marketing workflows.',
    painPoints: [
      'Product details, offers, customer questions, and campaign plans change quickly.',
      'Support and marketing teams often answer from different context.',
      'Content volume across product pages, email, ads, and support can overwhelm small teams.',
    ],
    aiOpportunities: [
      'Centralise approved product, offer, and policy context in shared memory.',
      'Draft product copy, lifecycle messages, and support responses for review.',
      'Use workflows to connect merchandising, campaigns, and customer support.',
    ],
    prymalUseCases: [
      'Product launch content packs across PDP, email, social, and ads.',
      'Support response drafts grounded in approved policies.',
      'Promotion planning workflows with offer rules and review steps.',
    ],
    agentRecommendations: [
      agent('oracle', 'Researches market, customer, and product themes.', 'Identify product angles and customer questions.'),
      agent('echo', 'Improves support response consistency.', 'Draft and review customer replies.'),
      agent('forge', 'Creates first-pass ecommerce content.', 'Draft product copy, email, and ad variants.'),
      agent('vance', 'Supports conversion and sales communication.', 'Create offer messaging and follow-up sequences.'),
    ],
    workflowExamples: [
      workflow('Product launch pack', ['Load product facts and offer rules', 'Draft channel assets', 'Check claims and policy', 'Prepare launch pack'], 'Faster launch content from approved facts.'),
      workflow('Support answer workflow', ['Capture customer question', 'Retrieve policy and product context', 'Draft response', 'Escalate uncertain cases'], 'More consistent support without unsupported answers.'),
    ],
    roiEstimate: {
      setupTime: '2-4 hours for product memory and launch templates.',
      monthlyHours: '10-30 hours recovered from copy, support drafts, and campaign admin.',
      reviewLoad: '20-35% fewer content edits when product facts and policies are centralised.',
      paybackSignal: 'Payback appears when one product fact set powers multiple channels.',
    },
    faq: baseFaq('Ecommerce Brands', 'ecommerce teams', 'product launch packs or support response drafting'),
    relatedSlugs: ['marketing-teams', 'sales-teams', 'smbs'],
  }),
  buildIndustry({
    slug: 'manufacturing-companies',
    name: 'Manufacturing Companies',
    audience: 'manufacturing teams',
    category: 'Operations',
    summary: 'Prymal helps manufacturing companies organise operations knowledge, supplier communication, documentation, process workflows, and review-ready summaries.',
    painPoints: [
      'Operational knowledge is spread across documents, experienced staff, and systems.',
      'Supplier, quality, and process communication needs consistency and traceability.',
      'Manual summaries slow down improvement, reporting, and issue resolution.',
    ],
    aiOpportunities: [
      'Turn process guidance and approved documentation into reusable memory.',
      'Draft supplier messages, issue summaries, and improvement notes for review.',
      'Coordinate workflow steps across operations, finance, and quality teams.',
    ],
    prymalUseCases: [
      'Supplier query and follow-up workflows.',
      'Quality issue summary drafting from approved notes.',
      'Process knowledge retrieval for operations teams.',
    ],
    agentRecommendations: [
      agent('atlas', 'Coordinates operational planning and improvement workflows.', 'Create actions, owners, and update summaries.'),
      agent('ledger', 'Supports commercial and supplier admin.', 'Organise supplier cost and invoice questions.'),
      agent('cipher', 'Reviews sensitive operational data handling.', 'Flag access and confidentiality risks.'),
      agent('nexus', 'Turns repeated process steps into workflows.', 'Connect intake, review, action, and reporting stages.'),
    ],
    workflowExamples: [
      workflow('Supplier follow-up workflow', ['Capture supplier issue', 'Retrieve contract or policy context', 'Draft message', 'Route for approval'], 'Clearer supplier communication with less manual rewriting.'),
      workflow('Quality issue summary', ['Collect issue notes', 'Summarise cause and impact', 'Create action list', 'Prepare review pack'], 'Faster internal reporting for improvement work.'),
    ],
    roiEstimate: {
      setupTime: '3-6 hours for process memory and supplier workflow templates.',
      monthlyHours: '8-24 hours recovered from documentation, follow-up, and issue summaries.',
      reviewLoad: '15-30% fewer missing-context loops when process guidance is centralised.',
      paybackSignal: 'Payback is clearest when one repeated operations workflow spans multiple teams.',
    },
    faq: baseFaq('Manufacturing Companies', 'manufacturing teams', 'supplier follow-up or quality issue summaries'),
    relatedSlugs: ['construction-firms', 'enterprise-teams', 'smbs'],
  }),
  buildIndustry({
    slug: 'startups',
    name: 'Startups',
    audience: 'startup teams',
    category: 'Growth',
    summary: 'Prymal helps startups coordinate strategy, research, GTM experiments, investor materials, customer learning, and operating cadence.',
    painPoints: [
      'Founder context moves faster than the team can document it.',
      'Research, content, sales, support, and operations all compete for limited time.',
      'Experiments are hard to repeat when learnings are not captured.',
    ],
    aiOpportunities: [
      'Capture founder decisions and customer learning in shared memory.',
      'Create repeatable workflows for GTM experiments and weekly operating reviews.',
      'Generate first-pass assets for research, outreach, content, and planning.',
    ],
    prymalUseCases: [
      'Weekly operating review workflows.',
      'Customer discovery synthesis and next-step planning.',
      'GTM experiment planning with learning capture.',
    ],
    agentRecommendations: [
      agent('sage', 'Helps frame strategy and priority tradeoffs.', 'Turn messy inputs into focused operating decisions.'),
      agent('scout', 'Supports customer, competitor, and market research.', 'Prepare research briefs and discovery notes.'),
      agent('forge', 'Creates first-pass growth assets.', 'Draft landing copy, content, and launch assets.'),
      agent('atlas', 'Turns decisions into operating plans.', 'Create weekly priorities, owners, and checkpoints.'),
    ],
    workflowExamples: [
      workflow('Weekly operating review', ['Collect updates', 'Summarise blockers and decisions', 'Create priority list', 'Log decisions into memory'], 'A clearer cadence without heavy management overhead.'),
      workflow('Customer discovery synthesis', ['Load interview notes', 'Cluster themes', 'Extract pain and objections', 'Plan next experiment'], 'Faster learning from customer conversations.'),
    ],
    roiEstimate: {
      setupTime: '1-3 hours for operating cadence and discovery templates.',
      monthlyHours: '10-28 hours recovered from planning, research synthesis, and first-pass assets.',
      reviewLoad: '20-35% fewer repeated explanations when founder decisions are captured.',
      paybackSignal: 'Payback appears when weekly decisions stop disappearing between meetings.',
    },
    faq: baseFaq('Startups', 'startup teams', 'weekly operating reviews or customer discovery synthesis'),
    relatedSlugs: ['saas-companies', 'smbs', 'coaches'],
  }),
  buildIndustry({
    slug: 'saas-companies',
    name: 'SaaS Companies',
    audience: 'SaaS teams',
    category: 'Software',
    summary: 'Prymal helps SaaS companies coordinate product knowledge, sales enablement, support, customer success, and operating workflows.',
    painPoints: [
      'Product, sales, support, and success teams often use different versions of context.',
      'Release communication and enablement materials take repeated cross-functional effort.',
      'Customer feedback is hard to turn into reusable internal knowledge.',
    ],
    aiOpportunities: [
      'Create shared product and customer memory across GTM and support workflows.',
      'Draft enablement, release notes, support responses, and onboarding assets.',
      'Turn feedback and ticket patterns into review-ready summaries.',
    ],
    prymalUseCases: [
      'Release communication and enablement pack workflows.',
      'Customer feedback synthesis for product and success teams.',
      'Support-to-success escalation summaries.',
    ],
    agentRecommendations: [
      agent('wren', 'Supports customer success and admin workflows.', 'Prepare onboarding and follow-up tasks.'),
      agent('vance', 'Helps sales use product context in outreach.', 'Draft sales enablement and follow-up notes.'),
      agent('scout', 'Researches accounts, users, and market context.', 'Prepare account briefs and feedback themes.'),
      agent('nexus', 'Orchestrates cross-functional SaaS workflows.', 'Connect product, GTM, support, and success steps.'),
    ],
    workflowExamples: [
      workflow('Release enablement pack', ['Load release notes and positioning', 'Draft internal FAQ', 'Create customer messaging', 'Route for approval'], 'Faster release communication across teams.'),
      workflow('Feedback synthesis', ['Collect tickets and notes', 'Cluster themes', 'Flag impact and urgency', 'Prepare product review summary'], 'More useful customer signal for product planning.'),
    ],
    roiEstimate: {
      setupTime: '2-5 hours for product memory and release templates.',
      monthlyHours: '12-32 hours recovered from enablement, support summaries, and customer follow-up.',
      reviewLoad: '20-35% fewer cross-functional rewrites when product context is shared.',
      paybackSignal: 'Payback shows when one release pack serves sales, support, and success.',
    },
    faq: baseFaq('SaaS Companies', 'SaaS teams', 'release enablement or customer feedback synthesis'),
    relatedSlugs: ['startups', 'sales-teams', 'enterprise-teams'],
  }),
  buildIndustry({
    slug: 'smbs',
    name: 'SMBs',
    audience: 'small and medium-sized businesses',
    category: 'Business operations',
    summary: 'Prymal helps SMBs centralise operating knowledge, automate repeatable admin, coordinate sales and service, and reduce founder bottlenecks.',
    painPoints: [
      'Important context lives with owners or long-serving staff.',
      'Admin, customer communication, sales follow-up, and reporting compete for the same time.',
      'Processes are often known but not documented enough to automate.',
    ],
    aiOpportunities: [
      'Turn repeated work into simple, reviewable workflows.',
      'Capture business rules, customer context, and service knowledge in shared memory.',
      'Use specialist agents for admin, sales, reporting, and content without adding separate tools.',
    ],
    prymalUseCases: [
      'Owner-knowledge capture into LORE memory.',
      'Customer enquiry triage and follow-up workflows.',
      'Weekly business admin and reporting workflows.',
    ],
    agentRecommendations: [
      agent('atlas', 'Creates practical operating plans.', 'Turn goals and blockers into weekly actions.'),
      agent('wren', 'Reduces admin load.', 'Prepare reminders, customer notes, and task lists.'),
      agent('forge', 'Creates first-pass marketing and communication assets.', 'Draft emails, posts, and service explanations.'),
      agent('ledger', 'Supports finance and commercial admin.', 'Organise quote, invoice, and margin notes.'),
    ],
    workflowExamples: [
      workflow('Weekly admin workflow', ['Collect open tasks', 'Draft customer follow-ups', 'Prepare owner review list', 'Log decisions'], 'Less context switching for owners and managers.'),
      workflow('Customer enquiry workflow', ['Capture enquiry', 'Retrieve service context', 'Draft reply and next step', 'Approve before sending'], 'Faster customer response with consistent information.'),
    ],
    roiEstimate: {
      setupTime: '1-3 hours for the first admin or enquiry workflow.',
      monthlyHours: '8-24 hours recovered from repeated admin and customer communication.',
      reviewLoad: '15-30% fewer owner interruptions when business context is reusable.',
      paybackSignal: 'Payback appears when the same workflow runs several times per week.',
    },
    faq: baseFaq('SMBs', 'small and medium-sized businesses', 'weekly admin or customer enquiry workflows'),
    relatedSlugs: ['trades', 'agencies', 'startups'],
  }),
  buildIndustry({
    slug: 'enterprise-teams',
    name: 'Enterprise Teams',
    audience: 'enterprise teams',
    category: 'Enterprise operations',
    summary: 'Prymal helps enterprise teams coordinate controlled AI workflows, shared memory, approvals, governance, and cross-functional execution.',
    painPoints: [
      'Teams need useful AI while preserving access boundaries, review, and governance.',
      'Knowledge is fragmented across functions, systems, documents, and teams.',
      'Manual coordination slows down repeatable cross-functional processes.',
    ],
    aiOpportunities: [
      'Create governed workflows with review points and clear ownership.',
      'Use shared memory to keep approved context available without losing control.',
      'Coordinate specialist agents across research, operations, communication, and validation.',
    ],
    prymalUseCases: [
      'Cross-functional workflow orchestration with approval checkpoints.',
      'Department knowledge memory for policies, playbooks, and process guidance.',
      'AI governance workflows that validate inputs and outputs before action.',
    ],
    agentRecommendations: [
      agent('lore', 'Maintains approved shared memory across teams.', 'Store policies, playbooks, and operational context.'),
      agent('sentinel', 'Validates outputs before they move forward.', 'Review claims, completeness, and risk signals.'),
      agent('nexus', 'Coordinates workflow execution across teams.', 'Run multi-step workflows with approvals.'),
      agent('cipher', 'Supports safer handling of sensitive data.', 'Flag access, privacy, and security-sensitive work.'),
    ],
    workflowExamples: [
      workflow('Governed workflow intake', ['Capture request', 'Classify risk and owner', 'Route to specialist agents', 'Hold sensitive outputs for review'], 'Controlled AI execution rather than ad hoc tool use.'),
      workflow('Policy knowledge workflow', ['Load approved policy', 'Answer internal question', 'Show source context', 'Escalate ambiguity'], 'Faster internal guidance with governance visibility.'),
    ],
    roiEstimate: {
      setupTime: '4-8 hours for the first governed cross-functional workflow.',
      monthlyHours: '15-45 hours recovered from coordination, summaries, and repeated internal questions.',
      reviewLoad: '20-40% fewer governance review loops when risk and context are structured upfront.',
      paybackSignal: 'Payback is clearest when one controlled workflow replaces repeated ad hoc AI requests.',
    },
    faq: baseFaq('Enterprise Teams', 'enterprise teams', 'governed workflow intake or policy knowledge retrieval'),
    relatedSlugs: ['saas-companies', 'manufacturing-companies', 'law-firms'],
  }),
];

export function getIndustryPath(slug) {
  return `${INDUSTRY_HUB_PATH}/${slug}`;
}

export function getIndustryBySlug(slug) {
  return INDUSTRIES.find((industry) => industry.slug === slug);
}

export function getRelatedIndustries(industry) {
  return industry.relatedSlugs
    .map((slug) => getIndustryBySlug(slug))
    .filter(Boolean);
}

export function getIndustryRoutes() {
  return [
    {
      path: INDUSTRY_HUB_PATH,
      changefreq: 'weekly',
      priority: '0.84',
      lastmod: INDUSTRY_CONTENT_UPDATED_AT,
    },
    ...INDUSTRIES.map((industry) => ({
      path: getIndustryPath(industry.slug),
      changefreq: 'monthly',
      priority: '0.78',
      lastmod: INDUSTRY_CONTENT_UPDATED_AT,
      kind: 'industry',
      slug: industry.slug,
    })),
  ];
}

function buildItemListSchema({ id, name, description, path, items }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${urlForPath(path)}#${id}`,
    name,
    description,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item,
    })),
  };
}

export function buildIndustryPageSchema(industry) {
  const path = getIndustryPath(industry.slug);
  return buildSchemaGraph([
    buildWebPageSchema({
      name: industry.metaTitle,
      description: industry.metaDescription,
      path,
      datePublished: INDUSTRY_CONTENT_UPDATED_AT,
      dateModified: INDUSTRY_CONTENT_UPDATED_AT,
    }),
    buildBreadcrumbSchema([
      { name: SITE_NAME, path: '/' },
      { name: 'Industries', path: INDUSTRY_HUB_PATH },
      { name: industry.name, path },
    ]),
    buildFaqPageSchema(industry.faq),
    buildItemListSchema({
      id: 'recommended-agents',
      name: `${industry.name} Prymal agent recommendations`,
      description: `Recommended Prymal agents for ${industry.name.toLowerCase()}.`,
      path,
      items: industry.agentRecommendations.map((item) => ({
        '@type': 'SoftwareApplication',
        name: item.name,
        applicationCategory: 'BusinessApplication',
        description: `${item.role}: ${item.reason}`,
        url: urlForPath(`/agents/${item.id}`),
      })),
    }),
    buildItemListSchema({
      id: 'workflow-examples',
      name: `${industry.name} workflow examples`,
      description: `Repeatable AI workflow examples for ${industry.name.toLowerCase()}.`,
      path,
      items: industry.workflowExamples.map((item) => ({
        '@type': 'HowTo',
        name: item.title,
        description: item.outcome,
        step: item.steps.map((step) => ({ '@type': 'HowToStep', text: step })),
      })),
    }),
  ]);
}

export function buildIndustryHubSchema() {
  return buildSchemaGraph([
    buildCollectionSchema({
      name: 'Prymal industry AI workflow library',
      description: 'Industry pages for Prymal AI operating system use cases, workflows, agent recommendations, ROI estimates, and FAQ.',
      path: INDUSTRY_HUB_PATH,
    }),
    buildBreadcrumbSchema([
      { name: SITE_NAME, path: '/' },
      { name: 'Industries', path: INDUSTRY_HUB_PATH },
    ]),
    buildItemListSchema({
      id: 'industries',
      name: 'Prymal industry pages',
      description: 'Index of generated Prymal industry pages.',
      path: INDUSTRY_HUB_PATH,
      items: INDUSTRIES.map((industry) => ({
        '@type': 'WebPage',
        name: industry.name,
        description: industry.summary,
        url: urlForPath(getIndustryPath(industry.slug)),
      })),
    }),
  ]);
}

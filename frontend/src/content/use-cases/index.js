import {
  SITE_NAME,
  buildBreadcrumbSchema,
  buildCollectionSchema,
  buildFaqPageSchema,
  buildSchemaGraph,
  buildWebPageSchema,
  urlForPath,
} from '../../lib/seo.js';

export const USE_CASE_HUB_PATH = '/use-cases';
export const USE_CASE_CONTENT_UPDATED_AT = '2026-06-19';

/**
 * @typedef {{ label: string, manual: string, genericAi: string, prymal: string }} UseCaseComparisonRow
 * @typedef {{ title: string, example: string, metric: string }} UseCaseRoiExample
 * @typedef {{ question: string, answer: string }} UseCaseFaq
 * @typedef {{
 *   slug: string,
 *   name: string,
 *   category: string,
 *   audience: string,
 *   trigger: string,
 *   outcome: string,
 *   reviewOwner: string,
 *   metric: string,
 *   cadence: string,
 *   savingsRange: string,
 *   inputs: string[],
 *   outputs: string[],
 *   risks: string[],
 *   agentIds: string[],
 *   relatedSlugs: string[],
 *   summary: string,
 *   metaTitle: string,
 *   metaDescription: string,
 *   comparisonRows: UseCaseComparisonRow[],
 *   roiExamples: UseCaseRoiExample[],
 *   faq: UseCaseFaq[],
 * }} GeneratedUseCase
 */

const AGENTS = {
  atlas: { id: 'atlas', name: 'ATLAS', role: 'planning and operating cadence' },
  cipher: { id: 'cipher', name: 'CIPHER', role: 'risk and sensitive-data handling' },
  echo: { id: 'echo', name: 'ECHO', role: 'support and response quality' },
  forge: { id: 'forge', name: 'FORGE', role: 'content and asset production' },
  herald: { id: 'herald', name: 'HERALD', role: 'outreach and communication' },
  ledger: { id: 'ledger', name: 'LEDGER', role: 'finance and commercial review' },
  lore: { id: 'lore', name: 'LORE', role: 'shared business memory' },
  nexus: { id: 'nexus', name: 'NEXUS', role: 'workflow orchestration' },
  oracle: { id: 'oracle', name: 'ORACLE', role: 'market and research analysis' },
  sage: { id: 'sage', name: 'SAGE', role: 'strategy and judgment support' },
  scout: { id: 'scout', name: 'SCOUT', role: 'research and prospecting' },
  sentinel: { id: 'sentinel', name: 'SENTINEL', role: 'output validation' },
  vance: { id: 'vance', name: 'VANCE', role: 'sales execution' },
  wren: { id: 'wren', name: 'WREN', role: 'admin, notes, and scheduling' },
};

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildUseCase(definition) {
  const slug = definition.slug ?? slugify(definition.name);
  const summary = `Prymal helps ${definition.audience} run ${definition.name.toLowerCase()} as a governed AI workflow with shared memory, specialist agents, review steps, and measurable operating outcomes.`;

  return {
    ...definition,
    slug,
    summary,
    metaTitle: `${definition.name} AI Workflow | Prymal Use Case`,
    metaDescription: `${summary} Includes comparison, ROI examples, FAQ, structured data, and internal links.`,
    comparisonRows: [
      {
        label: 'Context handling',
        manual: 'Context sits in inboxes, documents, calls, and individual notes.',
        genericAi: 'The user has to paste context repeatedly and hope it is complete.',
        prymal: 'LORE keeps approved business context available to the workflow.',
      },
      {
        label: 'Execution path',
        manual: 'Work depends on ad hoc effort and inconsistent handoffs.',
        genericAi: 'A chat response helps one step but does not manage the process.',
        prymal: 'NEXUS coordinates the repeatable steps, owners, and review points.',
      },
      {
        label: 'Quality control',
        manual: 'Review happens late, often after time has already been spent.',
        genericAi: 'The output can sound confident while missing business rules.',
        prymal: 'SENTINEL-style validation checks outputs before sensitive use.',
      },
      {
        label: 'Measurement',
        manual: 'ROI is hard to see because setup and rework are not tracked.',
        genericAi: 'Savings are local to one prompt or one user session.',
        prymal: 'The workflow can be measured by cycle time, rework, review load, and throughput.',
      },
    ],
    roiExamples: [
      {
        title: 'Time recovered',
        example: `If ${definition.audience} run this workflow ${definition.cadence}, Prymal can reduce repeated setup, drafting, and handoff work by roughly ${definition.savingsRange} once the source context is maintained.`,
        metric: definition.metric,
      },
      {
        title: 'Review leverage',
        example: `${definition.reviewOwner} can review a structured draft, checklist, or summary instead of rebuilding the work from scratch. The gain usually appears as fewer missing-context edits and faster approval cycles.`,
        metric: 'Approval time and avoidable rework',
      },
      {
        title: 'Operating consistency',
        example: `The same workflow can be reused across teams, clients, accounts, projects, or campaigns. That turns ${definition.name.toLowerCase()} from a person-dependent habit into a repeatable operating motion.`,
        metric: 'Repeatable throughput',
      },
    ],
    faq: [
      {
        question: `What is the best first step for ${definition.name.toLowerCase()} in Prymal?`,
        answer: `Start by defining the source inputs, the desired output, and the review owner. For this use case, useful inputs include ${definition.inputs.slice(0, 3).join(', ')}.`,
      },
      {
        question: `Can Prymal fully automate ${definition.name.toLowerCase()}?`,
        answer: `Prymal is designed for governed execution, not blind automation. Sensitive decisions, external communication, commercial commitments, and regulated outputs should stay reviewable by ${definition.reviewOwner}.`,
      },
      {
        question: `How does Prymal measure ROI for ${definition.name.toLowerCase()}?`,
        answer: `Measure cycle time, manual setup time, review changes, output quality, and whether the workflow creates the intended outcome: ${definition.outcome}.`,
      },
      {
        question: `Which Prymal agents help with ${definition.name.toLowerCase()}?`,
        answer: `Recommended agents include ${definition.agentIds.map((id) => AGENTS[id]?.name).filter(Boolean).join(', ')}. LORE and NEXUS are common foundations because memory and orchestration make the workflow repeatable.`,
      },
    ],
  };
}

const DEFINITIONS = [
  { name: 'Lead Generation', category: 'Sales', audience: 'sales and marketing teams', trigger: 'a team needs a reliable list of relevant prospects before outreach starts', outcome: 'a qualified lead list with context, fit notes, and next actions', reviewOwner: 'a sales or growth lead', metric: 'Qualified leads created per research hour', cadence: 'weekly', savingsRange: '8-24 hours per month', inputs: ['ICP', 'offer positioning', 'target markets', 'exclusion rules'], outputs: ['lead segments', 'prospect notes', 'outreach priorities'], risks: ['poor targeting', 'duplicate records', 'unsupported assumptions'], agentIds: ['scout', 'vance', 'lore', 'sentinel'], relatedSlugs: ['lead-qualification', 'account-research', 'sales-follow-up'] },
  { name: 'Sales Follow-Up', category: 'Sales', audience: 'sales teams', trigger: 'a meeting, demo, enquiry, or proposal needs a timely next step', outcome: 'clear follow-up messages with commitments, objections, and next actions', reviewOwner: 'the account owner', metric: 'Time from meeting to approved follow-up', cadence: 'daily', savingsRange: '6-18 hours per month', inputs: ['call notes', 'CRM stage', 'buyer questions', 'proposal status'], outputs: ['follow-up email', 'CRM summary', 'next-step checklist'], risks: ['missed commitments', 'tone mismatch', 'incorrect pricing language'], agentIds: ['vance', 'herald', 'lore', 'sentinel'], relatedSlugs: ['meeting-notes', 'crm-management', 'proposal-generation'] },
  { name: 'CRM Management', category: 'Sales operations', audience: 'sales operations teams', trigger: 'pipeline records need clean summaries, next steps, and owner accountability', outcome: 'CRM records that reflect current deal context and follow-up actions', reviewOwner: 'sales operations or the deal owner', metric: 'CRM completeness and stale-opportunity reduction', cadence: 'weekly', savingsRange: '8-20 hours per month', inputs: ['deal notes', 'stage definitions', 'activity history', 'qualification criteria'], outputs: ['CRM field suggestions', 'stage notes', 'owner reminders'], risks: ['incorrect stage changes', 'privacy exposure', 'duplicate updates'], agentIds: ['vance', 'wren', 'lore', 'nexus'], relatedSlugs: ['sales-follow-up', 'pipeline-forecasting', 'lead-qualification'] },
  { name: 'Client Onboarding', category: 'Operations', audience: 'client-facing teams', trigger: 'a new client needs context captured, expectations set, and first actions scheduled', outcome: 'a reusable onboarding plan with responsibilities, access needs, and success criteria', reviewOwner: 'the account lead or project owner', metric: 'Time from signature to first productive workflow', cadence: 'per new client', savingsRange: '5-16 hours per month', inputs: ['sales handoff', 'contract scope', 'client goals', 'stakeholders'], outputs: ['onboarding checklist', 'welcome notes', 'project memory'], risks: ['lost sales context', 'unclear ownership', 'overpromised timelines'], agentIds: ['atlas', 'lore', 'wren', 'sentinel'], relatedSlugs: ['proposal-generation', 'customer-onboarding', 'knowledge-management'] },
  { name: 'Proposal Generation', category: 'Sales', audience: 'founders, agencies, consultants, and sales teams', trigger: 'a prospect requests a clear plan, scope, pricing narrative, or business case', outcome: 'a structured proposal draft ready for commercial and delivery review', reviewOwner: 'the commercial owner', metric: 'Proposal draft time and win-rate quality signals', cadence: 'weekly', savingsRange: '8-26 hours per month', inputs: ['discovery notes', 'scope options', 'case studies', 'pricing rules'], outputs: ['proposal outline', 'scope narrative', 'implementation plan'], risks: ['unsupported claims', 'scope creep', 'pricing inconsistency'], agentIds: ['sage', 'vance', 'forge', 'sentinel'], relatedSlugs: ['sales-follow-up', 'competitor-analysis', 'client-onboarding'] },
  { name: 'Content Marketing', category: 'Marketing', audience: 'marketing teams and agencies', trigger: 'campaign ideas need to become publishable content across channels', outcome: 'content briefs, drafts, and repurposed assets grounded in approved positioning', reviewOwner: 'the marketing lead', metric: 'Approved assets created per campaign brief', cadence: 'weekly', savingsRange: '12-35 hours per month', inputs: ['brand voice', 'ICP', 'campaign goals', 'approved claims'], outputs: ['content briefs', 'draft posts', 'channel variants'], risks: ['off-brand tone', 'thin content', 'claim risk'], agentIds: ['forge', 'oracle', 'lore', 'sentinel'], relatedSlugs: ['seo-research', 'content-repurposing', 'campaign-reporting'] },
  { name: 'SEO Research', category: 'Marketing', audience: 'SEO and content teams', trigger: 'a topic cluster needs search intent, entity coverage, and practical article angles', outcome: 'a research pack with search intent, FAQs, entities, and internal link opportunities', reviewOwner: 'the SEO lead', metric: 'Research packs completed per content sprint', cadence: 'weekly', savingsRange: '8-24 hours per month', inputs: ['target topic', 'existing pages', 'competitors', 'audience questions'], outputs: ['topic map', 'FAQ ideas', 'internal links'], risks: ['keyword stuffing', 'duplicated pages', 'weak search intent'], agentIds: ['oracle', 'scout', 'forge', 'lore'], relatedSlugs: ['competitor-analysis', 'blog-outline-generation', 'content-marketing'] },
  { name: 'Competitor Analysis', category: 'Strategy', audience: 'strategy, marketing, and sales teams', trigger: 'a team needs to understand alternatives, positioning gaps, and market claims', outcome: 'a comparison brief with evidence, differentiators, and sales-ready notes', reviewOwner: 'the strategy or marketing owner', metric: 'Useful competitor briefs per research cycle', cadence: 'monthly', savingsRange: '6-20 hours per month', inputs: ['competitor pages', 'customer objections', 'win-loss notes', 'feature matrix'], outputs: ['comparison matrix', 'positioning notes', 'objection handling'], risks: ['hostile language', 'stale claims', 'unsupported comparisons'], agentIds: ['scout', 'oracle', 'sage', 'sentinel'], relatedSlugs: ['seo-research', 'proposal-generation', 'market-research'] },
  { name: 'Meeting Notes', category: 'Operations', audience: 'operators, managers, and client-facing teams', trigger: 'calls and meetings need decisions, actions, risks, and follow-ups captured', outcome: 'structured notes that preserve context and create clear next actions', reviewOwner: 'the meeting owner', metric: 'Actions captured and completed after meetings', cadence: 'daily', savingsRange: '6-18 hours per month', inputs: ['transcript', 'agenda', 'project context', 'participants'], outputs: ['summary', 'decisions', 'action list'], risks: ['misheard commitments', 'missing nuance', 'privacy-sensitive details'], agentIds: ['wren', 'atlas', 'lore', 'sentinel'], relatedSlugs: ['project-status-reporting', 'sales-follow-up', 'executive-briefings'] },
  { name: 'Email Management', category: 'Admin', audience: 'busy founders, managers, and operations teams', trigger: 'inbox work needs triage, drafts, reminders, and escalation paths', outcome: 'prioritised email actions and draft responses based on approved context', reviewOwner: 'the mailbox owner', metric: 'Inbox processing time and response SLA', cadence: 'daily', savingsRange: '8-22 hours per month', inputs: ['email threads', 'customer context', 'response rules', 'priority labels'], outputs: ['priority queue', 'draft replies', 'follow-up reminders'], risks: ['sending without review', 'privacy exposure', 'wrong priority'], agentIds: ['wren', 'herald', 'lore', 'cipher'], relatedSlugs: ['customer-support', 'sales-follow-up', 'internal-communications'] },
  { name: 'Customer Support', category: 'Support', audience: 'support and success teams', trigger: 'customers need accurate replies from product, policy, and account context', outcome: 'reviewable support drafts and escalations grounded in approved knowledge', reviewOwner: 'the support lead', metric: 'First response time and escalation quality', cadence: 'daily', savingsRange: '10-30 hours per month', inputs: ['support ticket', 'product docs', 'policy notes', 'account history'], outputs: ['draft response', 'escalation summary', 'knowledge gaps'], risks: ['unsupported answers', 'policy mismatch', 'sensitive account data'], agentIds: ['echo', 'lore', 'wren', 'sentinel'], relatedSlugs: ['support-ticket-triage', 'faq-automation', 'knowledge-management'] },
  { name: 'Recruitment', category: 'Talent', audience: 'recruiters and hiring teams', trigger: 'roles need structured intake, outreach, screening, and candidate summaries', outcome: 'role-ready recruiting workflows with clear criteria and reviewable candidate notes', reviewOwner: 'the recruiter or hiring manager', metric: 'Qualified candidates advanced per role', cadence: 'per open role', savingsRange: '8-24 hours per month', inputs: ['role brief', 'scorecard', 'candidate notes', 'client requirements'], outputs: ['search plan', 'outreach drafts', 'shortlist summaries'], risks: ['bias', 'unsupported candidate claims', 'privacy-sensitive data'], agentIds: ['scout', 'herald', 'wren', 'sentinel'], relatedSlugs: ['hiring-scorecards', 'interview-scheduling', 'staff-training'] },
  { name: 'Staff Training', category: 'People operations', audience: 'managers, enablement teams, and operations leads', trigger: 'employees need repeatable guidance, onboarding paths, or process refreshers', outcome: 'training packs and knowledge checks built from approved company context', reviewOwner: 'the training owner', metric: 'Training assets created and completion quality', cadence: 'monthly', savingsRange: '8-20 hours per month', inputs: ['SOPs', 'policies', 'role expectations', 'examples'], outputs: ['training outline', 'quiz questions', 'manager notes'], risks: ['outdated policy', 'unclear accountability', 'role mismatch'], agentIds: ['sage', 'lore', 'forge', 'sentinel'], relatedSlugs: ['employee-onboarding', 'knowledge-management', 'sop-creation'] },
  { name: 'Knowledge Management', category: 'Operations', audience: 'teams with scattered process and customer knowledge', trigger: 'business knowledge needs to become searchable, reusable, and workflow-ready', outcome: 'approved knowledge that agents can retrieve and apply consistently', reviewOwner: 'the operations or knowledge owner', metric: 'Repeated questions reduced and knowledge freshness', cadence: 'weekly', savingsRange: '10-28 hours per month', inputs: ['docs', 'FAQs', 'SOPs', 'project notes'], outputs: ['knowledge map', 'memory entries', 'source gaps'], risks: ['stale information', 'unclear ownership', 'access leakage'], agentIds: ['lore', 'cipher', 'atlas', 'sentinel'], relatedSlugs: ['policy-q-and-a', 'sop-creation', 'client-onboarding'] },
  { name: 'Invoice Tracking', category: 'Finance operations', audience: 'finance and operations teams', trigger: 'invoices need status tracking, reminders, and context-rich follow-up', outcome: 'a clearer receivables workflow with draft reminders and exception notes', reviewOwner: 'the finance owner', metric: 'Overdue invoice follow-up time', cadence: 'weekly', savingsRange: '5-14 hours per month', inputs: ['invoice list', 'customer terms', 'payment notes', 'account owner'], outputs: ['status summary', 'reminder drafts', 'escalation list'], risks: ['wrong payment terms', 'tone risk', 'privacy exposure'], agentIds: ['ledger', 'wren', 'herald', 'cipher'], relatedSlugs: ['expense-review', 'vendor-management', 'crm-management'] },
  { name: 'Lead Qualification', category: 'Sales', audience: 'sales teams and growth teams', trigger: 'new leads need fit scoring before expensive sales time is spent', outcome: 'prioritised leads with fit reasons, missing data, and next actions', reviewOwner: 'the sales lead', metric: 'Qualified opportunities from inbound leads', cadence: 'daily', savingsRange: '6-18 hours per month', inputs: ['lead form', 'ICP rules', 'company context', 'engagement signals'], outputs: ['fit score', 'qualification notes', 'next step'], risks: ['bad fit logic', 'missing data', 'over-automation'], agentIds: ['vance', 'scout', 'lore', 'sentinel'], relatedSlugs: ['lead-generation', 'crm-management', 'sales-follow-up'] },
  { name: 'Account Research', category: 'Sales', audience: 'sales and customer success teams', trigger: 'an account needs context before outreach, renewal, onboarding, or review', outcome: 'an account brief with business context, possible needs, and useful conversation angles', reviewOwner: 'the account owner', metric: 'Research time before account conversations', cadence: 'weekly', savingsRange: '6-20 hours per month', inputs: ['account name', 'public context', 'CRM notes', 'product usage'], outputs: ['account brief', 'stakeholder notes', 'conversation angles'], risks: ['stale research', 'unsupported assumptions', 'privacy-sensitive data'], agentIds: ['scout', 'vance', 'lore', 'sentinel'], relatedSlugs: ['lead-generation', 'customer-success-qbrs', 'churn-risk-review'] },
  { name: 'Cold Email Personalization', category: 'Sales', audience: 'outbound sales teams', trigger: 'outbound messages need relevance without becoming slow or spammy', outcome: 'personalised draft emails with fit context and approval gates', reviewOwner: 'the outbound owner', metric: 'Approved outbound sequences created per rep', cadence: 'weekly', savingsRange: '8-24 hours per month', inputs: ['ICP', 'prospect research', 'offer', 'tone rules'], outputs: ['email variants', 'personalisation notes', 'follow-up sequence'], risks: ['spam tone', 'incorrect personalisation', 'unsupported claims'], agentIds: ['herald', 'scout', 'vance', 'sentinel'], relatedSlugs: ['lead-generation', 'account-research', 'sales-follow-up'] },
  { name: 'Pipeline Forecasting', category: 'Sales operations', audience: 'sales leaders and operations teams', trigger: 'pipeline needs a realistic view of risk, next steps, and forecast confidence', outcome: 'a forecast brief with deal risks, gaps, and owner actions', reviewOwner: 'the sales leader', metric: 'Forecast confidence and stale-deal reduction', cadence: 'weekly', savingsRange: '6-18 hours per month', inputs: ['CRM data', 'deal notes', 'stage definitions', 'close criteria'], outputs: ['forecast summary', 'risk list', 'owner actions'], risks: ['false precision', 'missing context', 'wrong stage assumptions'], agentIds: ['vance', 'ledger', 'atlas', 'sentinel'], relatedSlugs: ['crm-management', 'sales-follow-up', 'executive-briefings'] },
  { name: 'Customer Onboarding', category: 'Customer success', audience: 'customer success and implementation teams', trigger: 'new customers need a guided path from purchase to first value', outcome: 'an onboarding plan with milestones, context, owners, and follow-up messages', reviewOwner: 'the customer success owner', metric: 'Time to first value', cadence: 'per new customer', savingsRange: '8-22 hours per month', inputs: ['sales handoff', 'customer goals', 'product plan', 'stakeholders'], outputs: ['onboarding plan', 'welcome email', 'risk notes'], risks: ['lost sales context', 'unclear scope', 'delayed activation'], agentIds: ['wren', 'atlas', 'lore', 'sentinel'], relatedSlugs: ['client-onboarding', 'customer-success-qbrs', 'knowledge-management'] },
  { name: 'Support Ticket Triage', category: 'Support', audience: 'support teams', trigger: 'incoming tickets need priority, routing, and first-response context', outcome: 'triaged tickets with category, severity, draft response, and escalation path', reviewOwner: 'the support lead', metric: 'Triage time and escalation accuracy', cadence: 'daily', savingsRange: '10-28 hours per month', inputs: ['ticket text', 'customer tier', 'product area', 'policy notes'], outputs: ['priority label', 'draft reply', 'escalation summary'], risks: ['wrong severity', 'unsupported troubleshooting', 'sensitive data exposure'], agentIds: ['echo', 'wren', 'lore', 'sentinel'], relatedSlugs: ['customer-support', 'faq-automation', 'policy-q-and-a'] },
  { name: 'FAQ Automation', category: 'Support', audience: 'support, marketing, and operations teams', trigger: 'repeated questions need approved answers that can be reused across channels', outcome: 'an FAQ library grounded in product, policy, and customer context', reviewOwner: 'the knowledge owner', metric: 'Repeated questions reduced', cadence: 'monthly', savingsRange: '6-18 hours per month', inputs: ['tickets', 'sales questions', 'product docs', 'policy notes'], outputs: ['FAQ answers', 'source gaps', 'internal links'], risks: ['outdated answers', 'overbroad claims', 'missing caveats'], agentIds: ['echo', 'lore', 'forge', 'sentinel'], relatedSlugs: ['customer-support', 'knowledge-management', 'seo-research'] },
  { name: 'Review Management', category: 'Customer experience', audience: 'service, ecommerce, and local business teams', trigger: 'public reviews need monitoring, response drafts, and learning loops', outcome: 'review responses and insight summaries that protect tone and accuracy', reviewOwner: 'the customer experience owner', metric: 'Review response time and insight themes captured', cadence: 'weekly', savingsRange: '5-16 hours per month', inputs: ['review text', 'brand voice', 'policy rules', 'service notes'], outputs: ['response drafts', 'theme summary', 'escalation list'], risks: ['defensive tone', 'privacy exposure', 'unsupported promises'], agentIds: ['echo', 'herald', 'lore', 'sentinel'], relatedSlugs: ['customer-support', 'internal-communications', 'market-research'] },
  { name: 'Social Media Planning', category: 'Marketing', audience: 'marketing teams, creators, and agencies', trigger: 'brand ideas need a consistent social calendar and channel-specific drafts', outcome: 'a social plan with topics, copy variants, review notes, and publishing prompts', reviewOwner: 'the marketing owner', metric: 'Approved posts per planning cycle', cadence: 'weekly', savingsRange: '8-24 hours per month', inputs: ['campaign goals', 'brand voice', 'content pillars', 'approved claims'], outputs: ['calendar', 'post drafts', 'creative prompts'], risks: ['off-brand tone', 'claim risk', 'repetitive content'], agentIds: ['forge', 'oracle', 'herald', 'sentinel'], relatedSlugs: ['content-marketing', 'content-repurposing', 'campaign-reporting'] },
  { name: 'Blog Outline Generation', category: 'Marketing', audience: 'content and SEO teams', trigger: 'a topic needs a useful outline before drafting begins', outcome: 'an outline with search intent, entities, FAQs, and internal links', reviewOwner: 'the content lead', metric: 'Approved outlines per sprint', cadence: 'weekly', savingsRange: '6-20 hours per month', inputs: ['keyword theme', 'audience', 'existing pages', 'expert notes'], outputs: ['outline', 'FAQ ideas', 'source questions'], risks: ['thin outline', 'duplicate angle', 'weak expertise'], agentIds: ['oracle', 'forge', 'lore', 'sentinel'], relatedSlugs: ['seo-research', 'content-marketing', 'content-repurposing'] },
  { name: 'Content Repurposing', category: 'Marketing', audience: 'marketing teams and agencies', trigger: 'one approved asset needs to become multiple channel-ready pieces', outcome: 'channel variants that preserve message, claims, and brand voice', reviewOwner: 'the content owner', metric: 'Assets produced from one source piece', cadence: 'weekly', savingsRange: '10-30 hours per month', inputs: ['source asset', 'brand voice', 'channel rules', 'CTA'], outputs: ['email copy', 'social posts', 'sales snippets'], risks: ['message drift', 'unsupported claims', 'repetitive outputs'], agentIds: ['forge', 'herald', 'lore', 'sentinel'], relatedSlugs: ['content-marketing', 'social-media-planning', 'blog-outline-generation'] },
  { name: 'Campaign Reporting', category: 'Marketing operations', audience: 'marketing teams and agencies', trigger: 'campaign performance needs a clear narrative and next actions', outcome: 'a report draft with highlights, risks, learnings, and recommended actions', reviewOwner: 'the campaign owner', metric: 'Reporting time and action clarity', cadence: 'monthly', savingsRange: '8-24 hours per month', inputs: ['metrics', 'campaign goals', 'channel notes', 'previous reports'], outputs: ['report narrative', 'insight list', 'next actions'], risks: ['misread metrics', 'vanity reporting', 'missing caveats'], agentIds: ['oracle', 'atlas', 'forge', 'sentinel'], relatedSlugs: ['content-marketing', 'social-media-planning', 'executive-briefings'] },
  { name: 'Market Research', category: 'Strategy', audience: 'founders, product teams, and consultants', trigger: 'a business decision needs market context and customer signal', outcome: 'a research brief with themes, opportunities, risks, and open questions', reviewOwner: 'the strategy owner', metric: 'Decision-ready briefs per research cycle', cadence: 'monthly', savingsRange: '8-26 hours per month', inputs: ['market question', 'customer notes', 'competitors', 'industry sources'], outputs: ['research brief', 'theme map', 'decision questions'], risks: ['stale sources', 'confirmation bias', 'unsupported conclusions'], agentIds: ['scout', 'oracle', 'sage', 'sentinel'], relatedSlugs: ['competitor-analysis', 'product-launch-planning', 'executive-briefings'] },
  { name: 'Product Launch Planning', category: 'Product marketing', audience: 'product, marketing, and sales teams', trigger: 'a new feature, service, or offer needs a coordinated launch path', outcome: 'a launch plan with positioning, assets, owners, and review checkpoints', reviewOwner: 'the launch owner', metric: 'Launch assets completed by milestone', cadence: 'per launch', savingsRange: '10-30 hours per month', inputs: ['feature notes', 'positioning', 'audience', 'release timeline'], outputs: ['launch plan', 'enablement FAQ', 'content checklist'], risks: ['misaligned claims', 'missed owners', 'rushed enablement'], agentIds: ['atlas', 'forge', 'oracle', 'sentinel'], relatedSlugs: ['content-marketing', 'campaign-reporting', 'internal-communications'] },
  { name: 'SOP Creation', category: 'Operations', audience: 'operations teams and managers', trigger: 'repeatable work needs documentation that people can actually follow', outcome: 'a clear SOP with steps, ownership, exceptions, and review cadence', reviewOwner: 'the process owner', metric: 'Documented workflows and reduced repeated questions', cadence: 'monthly', savingsRange: '8-24 hours per month', inputs: ['process notes', 'examples', 'policy rules', 'owner feedback'], outputs: ['SOP draft', 'checklist', 'exception rules'], risks: ['outdated steps', 'unclear ownership', 'overcomplication'], agentIds: ['atlas', 'lore', 'wren', 'sentinel'], relatedSlugs: ['knowledge-management', 'staff-training', 'policy-q-and-a'] },
  { name: 'Project Status Reporting', category: 'Operations', audience: 'project managers and delivery teams', trigger: 'stakeholders need a clear view of progress, blockers, and decisions', outcome: 'a status update with progress, risks, actions, and owner accountability', reviewOwner: 'the project owner', metric: 'Reporting time and blocker resolution speed', cadence: 'weekly', savingsRange: '6-20 hours per month', inputs: ['task updates', 'meeting notes', 'risks', 'timeline'], outputs: ['status report', 'risk list', 'action plan'], risks: ['hidden blockers', 'overconfident status', 'missed dependencies'], agentIds: ['atlas', 'wren', 'lore', 'sentinel'], relatedSlugs: ['meeting-notes', 'executive-briefings', 'internal-communications'] },
  { name: 'Vendor Management', category: 'Operations', audience: 'operations and finance teams', trigger: 'vendor relationships need tracking, follow-up, and issue summaries', outcome: 'vendor notes, follow-up drafts, and exception lists in one workflow', reviewOwner: 'the vendor owner', metric: 'Vendor issue response time', cadence: 'weekly', savingsRange: '5-16 hours per month', inputs: ['vendor terms', 'issue notes', 'invoice status', 'service expectations'], outputs: ['vendor summary', 'follow-up draft', 'issue log'], risks: ['wrong terms', 'tone risk', 'missing commercial context'], agentIds: ['ledger', 'wren', 'herald', 'lore'], relatedSlugs: ['procurement-requests', 'invoice-tracking', 'expense-review'] },
  { name: 'Procurement Requests', category: 'Operations', audience: 'operations, finance, and procurement teams', trigger: 'purchase requests need business case, approvals, and supplier context', outcome: 'a procurement request pack with rationale, options, risks, and approval notes', reviewOwner: 'the procurement or finance owner', metric: 'Request cycle time and approval completeness', cadence: 'weekly', savingsRange: '5-18 hours per month', inputs: ['request details', 'budget rules', 'supplier notes', 'approval policy'], outputs: ['request summary', 'options matrix', 'approval checklist'], risks: ['missing budget context', 'vendor bias', 'approval gaps'], agentIds: ['ledger', 'atlas', 'cipher', 'sentinel'], relatedSlugs: ['vendor-management', 'expense-review', 'risk-assessment'] },
  { name: 'Expense Review', category: 'Finance operations', audience: 'finance and operations teams', trigger: 'expense claims need categorisation, policy checks, and exception notes', outcome: 'review-ready expense summaries with policy flags and owner questions', reviewOwner: 'the finance owner', metric: 'Expense review cycle time', cadence: 'weekly', savingsRange: '5-14 hours per month', inputs: ['expense records', 'policy rules', 'receipts', 'employee notes'], outputs: ['category suggestions', 'exception list', 'questions'], risks: ['policy mismatch', 'sensitive financial data', 'false flags'], agentIds: ['ledger', 'cipher', 'wren', 'sentinel'], relatedSlugs: ['invoice-tracking', 'procurement-requests', 'compliance-checklist-prep'] },
  { name: 'Contract Review Prep', category: 'Legal operations', audience: 'operations, sales, and legal-adjacent teams', trigger: 'a contract needs an organised summary before qualified review', outcome: 'a review-prep brief with clauses, obligations, questions, and risks to discuss', reviewOwner: 'a qualified reviewer or legal owner', metric: 'Review-prep time and question quality', cadence: 'per contract', savingsRange: '4-16 hours per month', inputs: ['contract draft', 'scope notes', 'policy guidance', 'commercial context'], outputs: ['clause summary', 'question list', 'obligation checklist'], risks: ['legal advice confusion', 'missed clause context', 'privacy-sensitive content'], agentIds: ['sage', 'cipher', 'lore', 'sentinel'], relatedSlugs: ['risk-assessment', 'compliance-checklist-prep', 'proposal-generation'] },
  { name: 'Compliance Checklist Prep', category: 'Governance', audience: 'regulated and review-heavy teams', trigger: 'a workflow needs evidence, ownership, and controls checked before action', outcome: 'a checklist pack with evidence notes, gaps, owners, and review status', reviewOwner: 'the compliance or operations owner', metric: 'Checklist completion time and gap reduction', cadence: 'monthly', savingsRange: '6-20 hours per month', inputs: ['policy requirements', 'evidence docs', 'owners', 'workflow notes'], outputs: ['checklist', 'gap list', 'evidence summary'], risks: ['certification overclaiming', 'missing evidence', 'unclear accountability'], agentIds: ['sentinel', 'cipher', 'atlas', 'lore'], relatedSlugs: ['risk-assessment', 'policy-q-and-a', 'contract-review-prep'] },
  { name: 'Risk Assessment', category: 'Governance', audience: 'operations, security, and leadership teams', trigger: 'a decision, workflow, vendor, or campaign needs risks made visible', outcome: 'a risk brief with likelihood, impact, mitigations, and review owners', reviewOwner: 'the risk or operations owner', metric: 'Risks identified before execution', cadence: 'monthly', savingsRange: '6-18 hours per month', inputs: ['decision context', 'workflow plan', 'policy notes', 'stakeholders'], outputs: ['risk register', 'mitigation list', 'owner prompts'], risks: ['false confidence', 'missing stakeholders', 'unsupported scoring'], agentIds: ['sage', 'sentinel', 'cipher', 'atlas'], relatedSlugs: ['compliance-checklist-prep', 'procurement-requests', 'executive-briefings'] },
  { name: 'Policy Q&A', category: 'Knowledge', audience: 'operations, HR, support, and compliance teams', trigger: 'employees need quick answers from approved policies and process guidance', outcome: 'policy-grounded answers with source context and escalation paths', reviewOwner: 'the policy owner', metric: 'Repeated policy questions reduced', cadence: 'daily', savingsRange: '8-24 hours per month', inputs: ['policy documents', 'SOPs', 'FAQ history', 'owner guidance'], outputs: ['answers', 'source links', 'escalations'], risks: ['outdated policy', 'overbroad answer', 'sensitive access'], agentIds: ['lore', 'cipher', 'echo', 'sentinel'], relatedSlugs: ['knowledge-management', 'sop-creation', 'compliance-checklist-prep'] },
  { name: 'Internal Communications', category: 'Operations', audience: 'leaders, managers, and people teams', trigger: 'teams need clear updates, announcements, or change messages', outcome: 'internal messages with context, tone, owner review, and follow-up prompts', reviewOwner: 'the communications owner', metric: 'Draft time and clarity feedback', cadence: 'weekly', savingsRange: '5-16 hours per month', inputs: ['announcement goal', 'audience', 'policy context', 'tone rules'], outputs: ['announcement draft', 'manager notes', 'FAQ prompts'], risks: ['unclear commitments', 'tone mismatch', 'sensitive details'], agentIds: ['herald', 'sage', 'lore', 'sentinel'], relatedSlugs: ['executive-briefings', 'project-status-reporting', 'staff-training'] },
  { name: 'Executive Briefings', category: 'Leadership', audience: 'leaders and operators', trigger: 'leaders need concise summaries of decisions, risks, performance, or plans', outcome: 'a briefing note with context, options, risks, and recommended next steps', reviewOwner: 'the executive owner', metric: 'Briefing preparation time and decision clarity', cadence: 'weekly', savingsRange: '6-20 hours per month', inputs: ['metrics', 'meeting notes', 'project updates', 'risks'], outputs: ['briefing note', 'decision options', 'action list'], risks: ['missing caveats', 'overcompression', 'unsupported recommendation'], agentIds: ['sage', 'atlas', 'lore', 'sentinel'], relatedSlugs: ['board-report-drafting', 'market-research', 'project-status-reporting'] },
  { name: 'Board Report Drafting', category: 'Leadership', audience: 'founders, finance teams, and leadership teams', trigger: 'board or leadership reporting needs a structured narrative and evidence pack', outcome: 'a board-report draft with performance, risks, decisions, and next actions', reviewOwner: 'the founder, CFO, or executive owner', metric: 'Report preparation time and review changes', cadence: 'monthly', savingsRange: '8-28 hours per month', inputs: ['KPIs', 'financial notes', 'strategic updates', 'risk register'], outputs: ['report draft', 'appendix notes', 'decision requests'], risks: ['incorrect numbers', 'overclaiming', 'missing risk context'], agentIds: ['ledger', 'sage', 'atlas', 'sentinel'], relatedSlugs: ['executive-briefings', 'pipeline-forecasting', 'campaign-reporting'] },
  { name: 'Churn Risk Review', category: 'Customer success', audience: 'customer success and account teams', trigger: 'accounts show weak engagement, complaints, or renewal risk', outcome: 'a churn-risk brief with signals, context, actions, and owner follow-up', reviewOwner: 'the customer success owner', metric: 'At-risk accounts reviewed and actioned', cadence: 'weekly', savingsRange: '6-18 hours per month', inputs: ['usage notes', 'support tickets', 'account history', 'renewal date'], outputs: ['risk brief', 'action plan', 'customer message draft'], risks: ['wrong risk signal', 'sensitive account details', 'overpromising'], agentIds: ['echo', 'vance', 'lore', 'sentinel'], relatedSlugs: ['customer-success-qbrs', 'account-research', 'customer-support'] },
  { name: 'Customer Success QBRs', category: 'Customer success', audience: 'customer success teams', trigger: 'a customer needs a periodic review of progress, value, and next actions', outcome: 'a QBR pack with usage, outcomes, risks, and strategic recommendations', reviewOwner: 'the customer success manager', metric: 'QBR prep time and customer action follow-through', cadence: 'quarterly', savingsRange: '6-20 hours per month', inputs: ['account goals', 'usage notes', 'support themes', 'commercial context'], outputs: ['QBR deck outline', 'value summary', 'next-step plan'], risks: ['unsupported value claims', 'missing stakeholder context', 'commercial sensitivity'], agentIds: ['sage', 'vance', 'lore', 'sentinel'], relatedSlugs: ['churn-risk-review', 'account-research', 'customer-onboarding'] },
  { name: 'Testimonial Collection', category: 'Marketing', audience: 'marketing, customer success, and founders', trigger: 'happy customers need a respectful path to share proof and outcomes', outcome: 'testimonial prompts, outreach drafts, and approved proof points', reviewOwner: 'the marketing or customer owner', metric: 'Approved testimonials collected per cycle', cadence: 'monthly', savingsRange: '4-12 hours per month', inputs: ['customer success notes', 'outcome data', 'permission rules', 'brand voice'], outputs: ['request email', 'question list', 'proof-point summary'], risks: ['permission gaps', 'overclaiming', 'customer fatigue'], agentIds: ['herald', 'forge', 'lore', 'sentinel'], relatedSlugs: ['customer-success-qbrs', 'content-marketing', 'review-management'] },
  { name: 'Webinar Planning', category: 'Marketing', audience: 'marketing and sales teams', trigger: 'a webinar needs topic, agenda, promotion, follow-up, and sales handoff', outcome: 'a webinar plan with content, promotion assets, and post-event workflows', reviewOwner: 'the event owner', metric: 'Event assets completed and follow-up speed', cadence: 'per event', savingsRange: '8-24 hours per month', inputs: ['topic', 'audience', 'speakers', 'offer'], outputs: ['agenda', 'promo copy', 'follow-up plan'], risks: ['weak audience fit', 'unsupported claims', 'missed follow-up'], agentIds: ['forge', 'oracle', 'herald', 'atlas'], relatedSlugs: ['event-follow-up', 'content-marketing', 'lead-generation'] },
  { name: 'Event Follow-Up', category: 'Sales and marketing', audience: 'event, sales, and marketing teams', trigger: 'attendees, prospects, or partners need timely follow-up after an event', outcome: 'segmented follow-up messages and handoff notes based on event context', reviewOwner: 'the event or sales owner', metric: 'Follow-up sent within target window', cadence: 'per event', savingsRange: '6-18 hours per month', inputs: ['attendee list', 'session notes', 'lead context', 'offer'], outputs: ['follow-up emails', 'lead segments', 'sales handoff notes'], risks: ['generic messaging', 'privacy-sensitive lists', 'wrong segment'], agentIds: ['herald', 'vance', 'scout', 'sentinel'], relatedSlugs: ['webinar-planning', 'lead-generation', 'sales-follow-up'] },
  { name: 'Hiring Scorecards', category: 'Talent', audience: 'recruiters and hiring managers', trigger: 'a role needs fairer, more consistent candidate evaluation criteria', outcome: 'a role scorecard with competencies, evidence prompts, and review guidance', reviewOwner: 'the hiring manager', metric: 'Candidate evaluation consistency', cadence: 'per open role', savingsRange: '4-14 hours per month', inputs: ['role brief', 'must-have criteria', 'interview plan', 'values'], outputs: ['scorecard', 'question prompts', 'evidence guide'], risks: ['bias', 'unclear criteria', 'unsupported candidate inference'], agentIds: ['sage', 'scout', 'sentinel', 'lore'], relatedSlugs: ['recruitment', 'interview-scheduling', 'performance-review-prep'] },
  { name: 'Interview Scheduling', category: 'Talent operations', audience: 'recruiting and people teams', trigger: 'candidates and interviewers need coordinated availability and preparation notes', outcome: 'scheduling messages, interview packs, and reminders ready for approval', reviewOwner: 'the recruiter or hiring coordinator', metric: 'Scheduling cycle time', cadence: 'daily', savingsRange: '5-16 hours per month', inputs: ['candidate stage', 'interviewer list', 'availability', 'role context'], outputs: ['schedule draft', 'interview pack', 'reminders'], risks: ['wrong stage', 'calendar confusion', 'privacy exposure'], agentIds: ['wren', 'herald', 'lore', 'sentinel'], relatedSlugs: ['recruitment', 'hiring-scorecards', 'employee-onboarding'] },
  { name: 'Employee Onboarding', category: 'People operations', audience: 'people teams and managers', trigger: 'new employees need role context, first-week tasks, and policy guidance', outcome: 'an onboarding plan with knowledge, tasks, introductions, and manager prompts', reviewOwner: 'the people or team manager', metric: 'Time to productive first tasks', cadence: 'per new hire', savingsRange: '6-20 hours per month', inputs: ['role expectations', 'policies', 'team context', 'first projects'], outputs: ['onboarding checklist', 'welcome messages', 'training path'], risks: ['outdated policy', 'missing access', 'role mismatch'], agentIds: ['wren', 'lore', 'atlas', 'sentinel'], relatedSlugs: ['staff-training', 'policy-q-and-a', 'sop-creation'] },
  { name: 'Performance Review Prep', category: 'People operations', audience: 'managers and people teams', trigger: 'reviews need evidence, feedback themes, and development actions prepared', outcome: 'review-prep notes with evidence, goals, strengths, and growth areas', reviewOwner: 'the manager or people owner', metric: 'Review prep time and evidence quality', cadence: 'quarterly', savingsRange: '5-16 hours per month', inputs: ['goals', 'feedback notes', 'project outcomes', 'role expectations'], outputs: ['review notes', 'question prompts', 'development actions'], risks: ['bias', 'unsupported claims', 'sensitive employee data'], agentIds: ['sage', 'lore', 'sentinel', 'cipher'], relatedSlugs: ['staff-training', 'hiring-scorecards', 'employee-onboarding'] },
];

export const USE_CASES = DEFINITIONS.map(buildUseCase);

export function getUseCasePath(slug) {
  return `${USE_CASE_HUB_PATH}/${slug}`;
}

export function getUseCaseBySlug(slug) {
  return USE_CASES.find((useCase) => useCase.slug === slug);
}

export function getRelatedUseCases(useCase) {
  return useCase.relatedSlugs.map((slug) => getUseCaseBySlug(slug)).filter(Boolean);
}

export function getUseCaseAgents(useCase) {
  return useCase.agentIds.map((id) => AGENTS[id]).filter(Boolean);
}

function paragraph(text) {
  return text.replace(/\s+/g, ' ').trim();
}

export function buildUseCaseSections(useCase) {
  const agents = getUseCaseAgents(useCase);
  const agentNames = agents.map((agent) => `${agent.name} for ${agent.role}`).join(', ');
  const inputs = useCase.inputs.join(', ');
  const outputs = useCase.outputs.join(', ');
  const risks = useCase.risks.join(', ');

  return [
    {
      eyebrow: 'Use case overview',
      title: `${useCase.name} as a governed AI workflow`,
      paragraphs: [
        paragraph(`${useCase.name} is valuable when ${useCase.trigger}. In many teams, this work starts as a familiar manual routine: someone collects context, checks a few systems, writes a draft, asks for review, and then repeats the same setup again the next time. The problem is not that the task is impossible. The problem is that the context, rules, examples, and review expectations are rarely available in one place at the moment the work begins.`),
        paragraph(`Prymal turns ${useCase.name.toLowerCase()} into a workflow rather than a one-off prompt. LORE keeps the approved source context available, NEXUS coordinates the steps, specialist agents handle research, drafting, administration, or validation, and ${useCase.reviewOwner} stays responsible for decisions that require judgment. The intended outcome is ${useCase.outcome}, created through a repeatable path that can be measured and improved over time.`),
      ],
      bullets: [`Best audience: ${useCase.audience}.`, `Primary cadence: ${useCase.cadence}.`, `Core metric: ${useCase.metric}.`],
    },
    {
      eyebrow: 'Pain points',
      title: 'Why teams struggle with the manual version',
      paragraphs: [
        paragraph(`The manual version of ${useCase.name.toLowerCase()} usually breaks down because the work depends on memory, inbox archaeology, and individual habits. One person knows where the latest notes are, another knows the right tone, and a third understands the exception rules. When the task is urgent, the team either moves too slowly or skips context that would have prevented rework.`),
        paragraph(`Generic AI chat can help with a fragment of the task, but it often creates another context-transfer job. A user still has to paste background, define the format, explain the audience, check every claim, and repeat that setup during the next cycle. For ${useCase.audience}, the stronger pattern is a maintained workflow where source context, business rules, review ownership, and output structure are already defined.`),
      ],
      bullets: useCase.risks.map((risk) => `Manual and generic AI workflows can create ${risk}.`),
    },
    {
      eyebrow: 'Source context',
      title: 'Inputs the workflow should remember',
      paragraphs: [
        paragraph(`A strong ${useCase.name.toLowerCase()} workflow starts with approved inputs. For this page, the most important inputs are ${inputs}. Those inputs should be reviewed, named clearly, and kept fresh enough that agents are not forced to guess. If the source information is uncertain, the workflow should surface that uncertainty instead of hiding it inside a polished output.`),
        paragraph(`LORE is the memory layer that makes this practical. Instead of asking every user to rebuild the prompt from scratch, Prymal can keep approved company context, project notes, policies, examples, and previous decisions available to the workflow. That memory does not remove review. It reduces repeated setup so ${useCase.reviewOwner} can spend more time checking judgment, fit, and risk.`),
      ],
      bullets: useCase.inputs.map((input) => `Maintain approved context for ${input}.`),
    },
    {
      eyebrow: 'Template',
      title: 'Prymal workflow template',
      paragraphs: [
        paragraph(`The reusable template for ${useCase.name.toLowerCase()} has five stages: intake, context retrieval, specialist-agent work, validation, and approval. Intake captures the current request and required output. Retrieval pulls relevant memory and source context. Agents prepare the draft, summary, analysis, checklist, or next action. Validation checks completeness, tone, unsupported claims, sensitive data, and missing caveats. The final step keeps ${useCase.reviewOwner} in control before external delivery or operational action.`),
        paragraph(`The outputs from this template should be concrete rather than vague. For ${useCase.name.toLowerCase()}, useful outputs include ${outputs}. Each output should have an owner, a destination, and a review rule. That is what separates an operating workflow from a helpful but disposable AI answer.`),
      ],
      bullets: useCase.outputs.map((output) => `Generate ${output} with an explicit review rule.`),
    },
    {
      eyebrow: 'Agent orchestration',
      title: 'Recommended Prymal agents',
      paragraphs: [
        paragraph(`The recommended agent mix for ${useCase.name.toLowerCase()} is ${agentNames}. The point is not to make every agent autonomous. The point is to divide the work into clear roles so research, drafting, planning, communication, administration, and validation do not blur into one unreviewable response.`),
        paragraph(`This is where Prymal differs from a simple chatbot. The workflow can use one agent for research, another for communication, another for operating structure, and another for checks. When the output is ready, the review owner sees a structured result with source assumptions and risks. That makes the work easier to approve, repair, or reject.`),
      ],
      bullets: agents.map((agent) => `${agent.name}: ${agent.role}.`),
    },
    {
      eyebrow: 'Governance',
      title: 'Review rules and risk controls',
      paragraphs: [
        paragraph(`${useCase.name} should be automated carefully because the visible output may affect customers, employees, revenue, operations, or compliance. The main risks to watch are ${risks}. Prymal should therefore be configured so sensitive outputs are held for review, risky assumptions are flagged, and source gaps are visible before the work moves forward.`),
        paragraph(`A practical control model is simple: low-risk internal drafts can move quickly, external messages require owner approval, commercial or regulated claims require stricter review, and uncertain outputs should be escalated rather than disguised. Prymal supports that operating posture by combining memory, workflow steps, and validation instead of treating AI output as inherently ready to use.`),
      ],
      bullets: [`Review owner: ${useCase.reviewOwner}.`, 'Hold sensitive external outputs before delivery.', 'Escalate missing context instead of guessing.'],
    },
    {
      eyebrow: 'Comparison',
      title: 'Manual work vs generic AI vs Prymal',
      paragraphs: [
        paragraph(`The comparison for ${useCase.name.toLowerCase()} is not simply about speed. Manual work can be accurate but slow and inconsistent. Generic AI can be fast but disconnected from source context and review rules. Prymal is designed to combine speed with an operating structure: memory, agents, workflow routing, validation, and human accountability.`),
        paragraph(`That structure matters when ${useCase.audience} need the same use case to run more than once. A single prompt may help one person today, but a workflow helps the team tomorrow because it preserves the route, the context, the owner, and the measurement approach.`),
      ],
      bullets: useCase.comparisonRows.map((row) => `${row.label}: Prymal keeps the work structured and reviewable.`),
    },
    {
      eyebrow: 'ROI',
      title: 'ROI examples and measurement',
      paragraphs: [
        paragraph(`The first ROI signal for ${useCase.name.toLowerCase()} is usually time recovered from repeated setup. If the team runs this workflow ${useCase.cadence}, Prymal can reduce the time spent gathering context, drafting from scratch, rebuilding checklists, and asking the same clarification questions. A realistic planning range for this use case is ${useCase.savingsRange}, assuming the source memory is maintained and the workflow is used consistently.`),
        paragraph(`The second signal is review leverage. A reviewer should receive a structured draft or summary with assumptions and gaps, not a blank page. Measure ${useCase.metric}, but also track review changes, cycle time, escalations, and whether the workflow leads to ${useCase.outcome}. Those measures keep ROI grounded in business execution rather than vague AI productivity claims.`),
      ],
      bullets: useCase.roiExamples.map((item) => `${item.title}: ${item.metric}.`),
    },
    {
      eyebrow: 'Implementation',
      title: 'How to launch the workflow',
      paragraphs: [
        paragraph(`Start with one narrow version of ${useCase.name.toLowerCase()}. Choose the common request type, define the required inputs, decide what output format is useful, and name the person responsible for approval. Then run the workflow on a recent real example and compare the result against the manual process. This first run is not only about the output; it reveals missing memory, unclear rules, and review expectations.`),
        paragraph(`After the first run, improve the memory pack and workflow instructions. Add examples of good outputs, examples of unacceptable outputs, policy notes, tone rules, and known exceptions. Once the workflow is stable, expand it to more teams, clients, accounts, or projects. That staged rollout prevents the team from turning a promising use case into a broad automation that nobody trusts.`),
      ],
      bullets: ['Start with one repeatable request.', 'Define inputs, outputs, owner, and review gate.', 'Measure before expanding.'],
    },
    {
      eyebrow: 'Internal linking',
      title: 'Where this use case fits in the Prymal system',
      paragraphs: [
        paragraph(`${useCase.name} connects to the larger Prymal operating model. The core entity relationship is Prymal -> AI Operating System: a business execution layer built from shared memory, specialist agents, workflow automation, and trust controls. This use case should link to adjacent use cases, the AI operating system guide, workflow automation, agents, and industry pages so readers and answer engines can understand the surrounding topic cluster.`),
        paragraph(`Internal links also help teams design a better operating path. For example, ${useCase.name.toLowerCase()} may depend on upstream context from another workflow and may produce outputs that feed follow-up, reporting, onboarding, support, or knowledge management. The best implementation treats those dependencies as part of a connected system rather than isolated automation islands.`),
      ],
      bullets: getRelatedUseCases(useCase).map((related) => `Related use case: ${related.name}.`),
    },
  ];
}

export function getUseCaseWordCount(useCase) {
  const sections = buildUseCaseSections(useCase);
  const text = [
    useCase.summary,
    ...sections.flatMap((section) => [...section.paragraphs, ...section.bullets]),
    ...useCase.comparisonRows.flatMap((row) => [row.manual, row.genericAi, row.prymal]),
    ...useCase.roiExamples.flatMap((item) => [item.example, item.metric]),
    ...useCase.faq.flatMap((item) => [item.question, item.answer]),
  ].join(' ');
  return text.split(/\s+/).filter(Boolean).length;
}

export function getUseCaseRoutes() {
  return USE_CASES.map((useCase) => ({
    path: getUseCasePath(useCase.slug),
    changefreq: 'monthly',
    priority: '0.78',
    lastmod: USE_CASE_CONTENT_UPDATED_AT,
    kind: 'generated-use-case',
    slug: useCase.slug,
  }));
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

export function buildUseCasePageSchema(useCase) {
  const path = getUseCasePath(useCase.slug);
  return buildSchemaGraph([
    buildWebPageSchema({
      name: useCase.metaTitle,
      description: useCase.metaDescription,
      path,
      datePublished: USE_CASE_CONTENT_UPDATED_AT,
      dateModified: USE_CASE_CONTENT_UPDATED_AT,
    }),
    buildBreadcrumbSchema([
      { name: SITE_NAME, path: '/' },
      { name: 'Use cases', path: USE_CASE_HUB_PATH },
      { name: useCase.name, path },
    ]),
    buildFaqPageSchema(useCase.faq),
    buildItemListSchema({
      id: 'comparison',
      name: `${useCase.name} comparison`,
      description: `Comparison of manual work, generic AI, and Prymal for ${useCase.name.toLowerCase()}.`,
      path,
      items: useCase.comparisonRows.map((row) => ({
        '@type': 'Thing',
        name: row.label,
        description: `Manual: ${row.manual} Generic AI: ${row.genericAi} Prymal: ${row.prymal}`,
      })),
    }),
    buildItemListSchema({
      id: 'roi-examples',
      name: `${useCase.name} ROI examples`,
      description: `ROI examples for ${useCase.name.toLowerCase()} in Prymal.`,
      path,
      items: useCase.roiExamples.map((item) => ({
        '@type': 'Thing',
        name: item.title,
        description: `${item.example} Metric: ${item.metric}`,
      })),
    }),
  ]);
}

export function buildUseCaseHubSchema() {
  return buildSchemaGraph([
    buildCollectionSchema({
      name: 'Prymal AI use case library',
      description: 'Generated Prymal use case pages with long-form templates, FAQ, comparison sections, ROI examples, internal links, and JSON-LD.',
      path: USE_CASE_HUB_PATH,
    }),
    buildBreadcrumbSchema([
      { name: SITE_NAME, path: '/' },
      { name: 'Use cases', path: USE_CASE_HUB_PATH },
    ]),
    buildItemListSchema({
      id: 'use-cases',
      name: 'Prymal generated use cases',
      description: 'Index of generated AI workflow use cases for Prymal.',
      path: USE_CASE_HUB_PATH,
      items: USE_CASES.map((useCase) => ({
        '@type': 'WebPage',
        name: useCase.name,
        description: useCase.summary,
        url: urlForPath(getUseCasePath(useCase.slug)),
      })),
    }),
  ]);
}

import {
  SITE_NAME,
  buildArticleSchema,
  buildBreadcrumbSchema,
  buildCollectionSchema,
  buildFaqPageSchema,
  buildSchemaGraph,
  buildWebPageSchema,
  urlForPath,
} from '../../lib/seo.js';

export const EDUCATION_HUB_PATH = '/what-is';
export const EDUCATION_CONTENT_UPDATED_AT = '2026-06-19';

/**
 * @typedef {{ question: string, answer: string }} EducationFaq
 * @typedef {{ title: string, description: string, steps: string[] }} EducationExample
 * @typedef {{ title: string, href: string, publisher: string, note: string }} EducationReference
 * @typedef {{
 *   slug: string,
 *   term: string,
 *   category: string,
 *   shortDefinition: string,
 *   practicalDefinition: string,
 *   whyItMatters: string,
 *   components: string[],
 *   examples: EducationExample[],
 *   misconceptions: string[],
 *   prymalLens: string,
 *   agentRoles: string[],
 *   governanceNotes: string[],
 *   illustration: { title: string, nodes: { label: string, detail: string, glyph: string, x: number, y: number, accent?: string, highlight?: boolean }[], links: { from: string, to: string, fromX: number, fromY: number, toX: number, toY: number, accent?: string }[] },
 *   faq: EducationFaq[],
 *   references: EducationReference[],
 *   relatedSlugs: string[],
 * }} EducationPage
 */

const refs = {
  nistAiRmf: {
    title: 'AI Risk Management Framework',
    href: 'https://www.nist.gov/itl/ai-risk-management-framework',
    publisher: 'NIST',
    note: 'Authoritative framework for managing AI risks and trustworthiness considerations.',
  },
  nistAirc: {
    title: 'AI RMF resources',
    href: 'https://airc.nist.gov/airmf-resources/airmf/',
    publisher: 'NIST AI Resource Center',
    note: 'NIST resource hub for AI RMF usage and trustworthiness guidance.',
  },
  ragPaper: {
    title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
    href: 'https://arxiv.org/abs/2005.11401',
    publisher: 'arXiv / NeurIPS',
    note: 'Original RAG paper introducing retrieval-augmented generation with parametric and non-parametric memory.',
  },
  metaRag: {
    title: 'Retrieval-Augmented Generation research publication',
    href: 'https://ai.meta.com/research/publications/retrieval-augmented-generation-for-knowledge-intensive-nlp-tasks/',
    publisher: 'Meta AI',
    note: 'Research summary for retrieval-augmented generation and explicit non-parametric memory.',
  },
  googleMultiAgent: {
    title: 'Multi-agent AI system reference architecture',
    href: 'https://docs.cloud.google.com/architecture/multiagent-ai-system',
    publisher: 'Google Cloud Architecture Center',
    note: 'Reference architecture for robust multi-agent AI systems.',
  },
  googleScalingAgents: {
    title: 'Towards a Science of Scaling Agent Systems',
    href: 'https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/',
    publisher: 'Google Research',
    note: 'Research discussion on when multi-agent architectures help or hurt.',
  },
  langGraph: {
    title: 'LangGraph agent orchestration framework',
    href: 'https://www.langchain.com/langgraph',
    publisher: 'LangChain',
    note: 'Framework overview covering state, memory, human-in-the-loop, and agent orchestration concepts.',
  },
  autogen: {
    title: 'AutoGen documentation',
    href: 'https://microsoft.github.io/autogen/stable//index.html',
    publisher: 'Microsoft',
    note: 'Developer documentation for building agentic and multi-agent applications.',
  },
};

function node(label, detail, glyph, x, y, accent = '#7cffe0', highlight = false) {
  return { label, detail, glyph, x, y, accent, highlight };
}

function link(from, to, fromX, fromY, toX, toY, accent = 'rgba(124,255,224,0.45)') {
  return { from, to, fromX, fromY, toX, toY, accent };
}

function illustration(title, center, left, right, bottom) {
  return {
    title,
    nodes: [
      node(center.label, center.detail, center.glyph, 50, 34, '#7cffe0', true),
      node(left.label, left.detail, left.glyph, 18, 66, '#4cc9f0'),
      node(right.label, right.detail, right.glyph, 82, 66, '#fb7185'),
      node(bottom.label, bottom.detail, bottom.glyph, 50, 82, '#facc15'),
    ],
    links: [
      link(center.label, left.label, 50, 42, 18, 58),
      link(center.label, right.label, 50, 42, 82, 58),
      link(left.label, bottom.label, 24, 70, 50, 78),
      link(right.label, bottom.label, 76, 70, 50, 78),
    ],
  };
}

function example(title, description, steps) {
  return { title, description, steps };
}

function buildPage(definition) {
  return {
    ...definition,
    title: `What Is ${definition.term}?`,
    metaTitle: `What Is ${definition.term}? | Prymal AI education hub`,
    metaDescription: `Learn what ${definition.term.toLowerCase()} means, how it works, business examples, FAQs, references, internal links, and how Prymal applies it in an AI operating system.`,
  };
}

export const EDUCATION_PAGES = [
  buildPage({
    slug: 'ai-operating-system',
    term: 'An AI Operating System',
    category: 'Foundations',
    shortDefinition: 'An AI operating system is a coordinated layer for business execution that combines agents, memory, workflows, governance, and human review.',
    practicalDefinition: 'In business terms, an AI operating system is not just a chat window. It is a workspace where AI agents can access approved context, hand work to one another, follow repeatable workflows, and keep people in control of sensitive decisions.',
    whyItMatters: 'The category matters because teams quickly outgrow scattered prompts. They need continuity, shared memory, approvals, and measurable execution rather than isolated conversations.',
    components: ['Specialist agents', 'Shared memory', 'Workflow orchestration', 'Governance controls', 'Human review', 'Measurement loops'],
    examples: [
      example('Agency delivery system', 'Client context, campaign briefs, content drafts, reporting, and approval notes live in one AI operating layer.', ['Load client context', 'Assign research and content agents', 'Validate output', 'Route to account lead']),
      example('SMB operating cadence', 'A small business uses agents for customer enquiries, quote prep, follow-up, and weekly owner summaries.', ['Capture repeated tasks', 'Store approved context', 'Run weekly workflow', 'Review metrics']),
    ],
    misconceptions: ['It is not the same as a general chatbot.', 'It does not remove the need for accountable human owners.', 'It is not valuable unless recurring workflows are defined.'],
    prymalLens: 'Prymal positions itself as an AI operating system for business execution: agents, LORE memory, NEXUS workflows, and review controls in one coordinated workspace.',
    agentRoles: ['LORE stores approved business memory.', 'NEXUS coordinates repeatable workflows.', 'SENTINEL validates risky outputs.', 'Specialist agents produce role-specific work.'],
    governanceNotes: ['Define review owners for external outputs.', 'Keep memory scoped to approved business context.', 'Measure cycle time, rework, and throughput.'],
    illustration: illustration('AI operating system map', { label: 'AI OS', detail: 'Execution layer', glyph: 'OS' }, { label: 'Agents', detail: 'Specialist roles', glyph: 'A' }, { label: 'Memory', detail: 'Shared context', glyph: 'M' }, { label: 'Workflows', detail: 'Reviewable execution', glyph: 'W' }),
    faq: [
      { question: 'Is an AI operating system the same as ChatGPT?', answer: 'No. A chat tool is one surface for interaction. An AI operating system coordinates agents, memory, workflows, governance, and review across recurring business work.' },
      { question: 'Who needs an AI operating system?', answer: 'Teams that repeat context-heavy work across sales, marketing, operations, support, research, reporting, or client delivery are the best fit.' },
      { question: 'Does an AI operating system replace people?', answer: 'No. It should reduce repeated setup and drafting while keeping people responsible for review, judgment, sensitive decisions, and final delivery.' },
      { question: 'What makes Prymal an AI operating system?', answer: 'Prymal combines specialist agents, shared business memory, workflow automation, and trust controls for repeatable business execution.' },
    ],
    references: [refs.googleMultiAgent, refs.nistAiRmf, refs.langGraph],
    relatedSlugs: ['agent-orchestration', 'agent-memory', 'ai-workflow-management'],
  }),
  buildPage({
    slug: 'agent-orchestration',
    term: 'Agent Orchestration',
    category: 'Agent systems',
    shortDefinition: 'Agent orchestration is the coordination of AI agents, tools, memory, tasks, and review checkpoints so work moves through a reliable process.',
    practicalDefinition: 'In practice, orchestration decides which agent should do what, what context it receives, when a tool should be used, when another agent should continue, and when a human should review the output.',
    whyItMatters: 'Without orchestration, multi-agent systems become noisy and unpredictable. With orchestration, teams can create repeatable paths for research, drafting, checking, approval, and delivery.',
    components: ['Task routing', 'State management', 'Tool access', 'Agent handoffs', 'Human-in-the-loop checkpoints', 'Failure handling'],
    examples: [
      example('Proposal workflow', 'A research agent gathers context, a strategy agent creates the plan, a writing agent drafts the proposal, and a validation agent checks claims.', ['Intake discovery notes', 'Route research', 'Draft proposal', 'Validate and approve']),
      example('Support escalation', 'A support agent drafts an answer, a policy agent checks the response, and a human handles unresolved or sensitive cases.', ['Classify ticket', 'Retrieve policy', 'Draft response', 'Escalate uncertainty']),
    ],
    misconceptions: ['More agents do not automatically mean better results.', 'Orchestration is not only tool calling.', 'Human review remains part of strong orchestration.'],
    prymalLens: 'Prymal uses orchestration as an operating layer for specialist agents, shared memory, and reviewable workflows rather than unstructured multi-agent chatter.',
    agentRoles: ['SCOUT can research inputs.', 'SAGE can structure strategy.', 'FORGE can draft assets.', 'SENTINEL can validate outputs.'],
    governanceNotes: ['Keep task boundaries explicit.', 'Avoid agent chains that nobody can inspect.', 'Use review gates before risky outputs move forward.'],
    illustration: illustration('Agent orchestration map', { label: 'Router', detail: 'Assigns tasks', glyph: 'R' }, { label: 'Agents', detail: 'Specialists', glyph: 'A' }, { label: 'Tools', detail: 'Actions', glyph: 'T' }, { label: 'Review', detail: 'Human gate', glyph: 'H' }),
    faq: [
      { question: 'What does agent orchestration do?', answer: 'It coordinates agents, context, tools, state, and review steps so multi-step AI work follows a reliable path.' },
      { question: 'Is agent orchestration only for developers?', answer: 'No. Developers can build orchestration frameworks, but business teams also need productized orchestration for repeatable workflows.' },
      { question: 'Can orchestration reduce AI risk?', answer: 'Yes, when it makes task boundaries, source context, validation, and human review explicit.' },
      { question: 'How does Prymal use orchestration?', answer: 'Prymal coordinates specialist agents around LORE memory, NEXUS workflows, and review controls for business execution.' },
    ],
    references: [refs.langGraph, refs.googleMultiAgent, refs.googleScalingAgents],
    relatedSlugs: ['multi-agent-ai', 'agent-collaboration', 'ai-workflow-management'],
  }),
  buildPage({
    slug: 'agent-memory',
    term: 'Agent Memory',
    category: 'Agent systems',
    shortDefinition: 'Agent memory is the stored context an AI agent can retrieve and use across tasks, sessions, workflows, or projects.',
    practicalDefinition: 'Agent memory can include facts, user preferences, project notes, examples, policies, decisions, and retrieved documents. Business-grade memory must be scoped, reviewable, fresh, and tied to source context.',
    whyItMatters: 'Memory is what turns isolated prompts into continuous work. Without memory, teams repeatedly paste the same context and risk inconsistent outputs.',
    components: ['Source documents', 'Embeddings and retrieval', 'Project context', 'User or team preferences', 'Freshness rules', 'Access boundaries'],
    examples: [
      example('Client memory', 'An agency stores approved brand voice, offers, competitors, reporting preferences, and campaign decisions.', ['Capture onboarding context', 'Approve source notes', 'Retrieve during workflows', 'Refresh after decisions']),
      example('Operations memory', 'An SMB stores service rules, quote templates, follow-up language, and customer handling policies.', ['Load policy documents', 'Tag workflow context', 'Generate draft', 'Validate against source']),
    ],
    misconceptions: ['Memory is not always accurate just because it is stored.', 'More memory can hurt if retrieval is noisy.', 'Business memory needs ownership and freshness rules.'],
    prymalLens: 'Prymal calls its shared business memory LORE: a layer for approved organisation, project, and agent context that supports repeatable work.',
    agentRoles: ['LORE retrieves approved context.', 'CIPHER helps flag sensitive data handling.', 'SENTINEL checks outputs against source assumptions.', 'NEXUS uses memory inside workflows.'],
    governanceNotes: ['Name who owns each memory source.', 'Expire or refresh stale context.', 'Do not expose sensitive memory to workflows that do not need it.'],
    illustration: illustration('Agent memory map', { label: 'Memory', detail: 'Stored context', glyph: 'M' }, { label: 'Sources', detail: 'Docs and notes', glyph: 'S' }, { label: 'Retrieval', detail: 'Relevant context', glyph: 'R' }, { label: 'Output', detail: 'Grounded work', glyph: 'O' }),
    faq: [
      { question: 'What is agent memory?', answer: 'Agent memory is stored context an AI agent can use later, such as policies, examples, project facts, user preferences, and previous decisions.' },
      { question: 'Is agent memory the same as RAG?', answer: 'Not exactly. RAG is a retrieval pattern. Agent memory is a broader product and system concept that may use retrieval, databases, summaries, or scoped context stores.' },
      { question: 'Why does business memory need governance?', answer: 'Because stored context can become stale, sensitive, or wrong. Teams need ownership, access control, source tracking, and review.' },
      { question: 'How does Prymal handle agent memory?', answer: 'Prymal uses LORE as shared business memory so agents can work from approved context across workflows.' },
    ],
    references: [refs.ragPaper, refs.metaRag, refs.langGraph],
    relatedSlugs: ['retrieval-augmented-generation', 'ai-operating-system', 'ai-governance'],
  }),
  buildPage({
    slug: 'workflow-automation',
    term: 'Workflow Automation',
    category: 'Operations',
    shortDefinition: 'Workflow automation is the use of systems to move repeatable work through defined steps with less manual coordination.',
    practicalDefinition: 'Traditional automation often connects triggers and actions. AI workflow automation adds reasoning, drafting, retrieval, summarisation, classification, and human review to those steps.',
    whyItMatters: 'Most teams do not need AI for everything. They need recurring work to move faster, with fewer handoff errors and clearer review points.',
    components: ['Triggers', 'Inputs', 'Business rules', 'AI tasks', 'Approvals', 'Outputs', 'Measurement'],
    examples: [
      example('Sales follow-up', 'Meeting notes become a CRM summary, follow-up draft, risk note, and next-step reminder.', ['Capture notes', 'Retrieve account context', 'Draft follow-up', 'Approve and log']),
      example('Monthly reporting', 'Metrics, project notes, and decisions become a report narrative with action recommendations.', ['Collect metrics', 'Summarise trends', 'Draft narrative', 'Review actions']),
    ],
    misconceptions: ['Automation is not only integrations.', 'AI automation should not bypass approvals.', 'The best first workflow is narrow and measurable.'],
    prymalLens: 'Prymal treats workflow automation as memory-aware business execution: agents do useful work inside repeatable paths with review gates.',
    agentRoles: ['NEXUS coordinates workflow steps.', 'ATLAS structures operating plans.', 'WREN handles admin steps.', 'SENTINEL validates outputs.'],
    governanceNotes: ['Define the trigger and stop conditions.', 'Measure manual baseline before automation.', 'Hold external outputs for review.'],
    illustration: illustration('Workflow automation map', { label: 'Workflow', detail: 'Repeatable path', glyph: 'W' }, { label: 'Input', detail: 'Request context', glyph: 'I' }, { label: 'AI task', detail: 'Draft or decide', glyph: 'AI' }, { label: 'Approval', detail: 'Human review', glyph: 'OK' }),
    faq: [
      { question: 'What is workflow automation?', answer: 'Workflow automation moves repeatable work through defined steps, reducing manual coordination and helping teams produce consistent outcomes.' },
      { question: 'How is AI workflow automation different?', answer: 'AI workflow automation can draft, classify, retrieve, summarise, and reason inside the workflow, while still keeping review controls.' },
      { question: 'What should teams automate first?', answer: 'Start with frequent, context-heavy work that has clear inputs, outputs, and a review owner.' },
      { question: 'How does Prymal support workflow automation?', answer: 'Prymal uses NEXUS workflows, LORE memory, specialist agents, and validation to automate repeatable business work safely.' },
    ],
    references: [refs.langGraph, refs.googleMultiAgent, refs.nistAiRmf],
    relatedSlugs: ['ai-workflow-management', 'agent-orchestration', 'ai-operating-system'],
  }),
  buildPage({
    slug: 'multi-agent-ai',
    term: 'Multi-Agent AI',
    category: 'Agent systems',
    shortDefinition: 'Multi-agent AI uses multiple AI agents, often with different roles or tools, to complete work that benefits from division of labor.',
    practicalDefinition: 'A multi-agent system might use one agent to research, another to plan, another to draft, and another to validate. The agents may collaborate sequentially, in parallel, or under a supervisor.',
    whyItMatters: 'Multi-agent AI is useful when work has separable parts, different skill requirements, or review stages. It can be harmful when extra agents add coordination overhead without improving the result.',
    components: ['Specialist roles', 'Shared state', 'Communication protocol', 'Supervisor or router', 'Tool permissions', 'Review logic'],
    examples: [
      example('Campaign production', 'Research, strategy, creative, and QA agents collaborate on a campaign pack.', ['Research audience', 'Plan campaign', 'Draft assets', 'Validate claims']),
      example('Operations review', 'Agents summarise metrics, risks, support themes, and finance notes before a leader reviews.', ['Gather signals', 'Split analysis', 'Merge summary', 'Escalate decisions']),
    ],
    misconceptions: ['More agents are not always better.', 'Multi-agent AI is not automatically autonomous.', 'A shared memory layer matters as much as agent count.'],
    prymalLens: 'Prymal uses multi-agent patterns through specialist agents coordinated around business memory and workflow review.',
    agentRoles: ['SCOUT researches.', 'SAGE reasons about strategy.', 'FORGE drafts assets.', 'SENTINEL validates quality and risk.'],
    governanceNotes: ['Use multiple agents when tasks are parallelisable or role-specific.', 'Avoid circular agent chatter.', 'Log decisions and handoffs.'],
    illustration: illustration('Multi-agent AI map', { label: 'Supervisor', detail: 'Coordinates roles', glyph: 'S' }, { label: 'Research', detail: 'Finds context', glyph: 'R' }, { label: 'Drafting', detail: 'Creates output', glyph: 'D' }, { label: 'Validation', detail: 'Checks result', glyph: 'V' }),
    faq: [
      { question: 'What is multi-agent AI?', answer: 'Multi-agent AI uses more than one agent to complete work, often by splitting research, planning, drafting, execution, and validation.' },
      { question: 'When does multi-agent AI help?', answer: 'It helps when the task can be split into meaningful roles or parallel work. It can hurt when coordination overhead is larger than the benefit.' },
      { question: 'Does multi-agent AI require code?', answer: 'Developer frameworks often require code, but productized systems can expose multi-agent workflows through a business UI.' },
      { question: 'How does Prymal use multi-agent AI?', answer: 'Prymal uses specialist agents coordinated by workflows and grounded in shared business memory.' },
    ],
    references: [refs.googleMultiAgent, refs.googleScalingAgents, refs.autogen],
    relatedSlugs: ['agent-orchestration', 'agent-collaboration', 'ai-operating-system'],
  }),
  buildPage({
    slug: 'ai-governance',
    term: 'AI Governance',
    category: 'Governance',
    shortDefinition: 'AI governance is the set of policies, controls, roles, and review practices used to manage AI use responsibly.',
    practicalDefinition: 'In a business AI system, governance covers what data agents can access, who approves outputs, what risks are checked, how decisions are logged, and how teams prevent unsupported or unsafe use.',
    whyItMatters: 'AI governance matters because speed without accountability creates risk. Teams need clarity around ownership, access, quality, safety, and review.',
    components: ['Policies', 'Access control', 'Risk assessment', 'Output validation', 'Human review', 'Audit records', 'Training'],
    examples: [
      example('External communication review', 'Customer-facing AI drafts are checked for policy fit, tone, claims, and missing context before sending.', ['Draft message', 'Check policy', 'Flag risk', 'Approve send']),
      example('Knowledge access governance', 'Agents retrieve only the sources needed for a workflow and escalate when information is missing.', ['Classify request', 'Retrieve scoped sources', 'Answer with caveats', 'Log gaps']),
    ],
    misconceptions: ['Governance is not only compliance paperwork.', 'Governance should not block all AI use.', 'Human review must be attached to real workflow steps.'],
    prymalLens: 'Prymal frames governance as practical operating controls: WARDEN-style screening, SENTINEL validation, scoped memory, approvals, and reviewable workflows.',
    agentRoles: ['CIPHER flags sensitive data handling.', 'SENTINEL validates outputs.', 'LORE keeps source context visible.', 'NEXUS routes approval steps.'],
    governanceNotes: ['Separate low-risk drafts from high-risk actions.', 'Document review owners.', 'Avoid claiming certifications or capabilities that are not implemented.'],
    illustration: illustration('AI governance map', { label: 'Governance', detail: 'Controls and owners', glyph: 'G' }, { label: 'Access', detail: 'Who can use what', glyph: 'A' }, { label: 'Review', detail: 'Human approval', glyph: 'R' }, { label: 'Audit', detail: 'Evidence trail', glyph: 'E' }),
    faq: [
      { question: 'What is AI governance?', answer: 'AI governance is the operating system of policies, roles, reviews, controls, and records that help organisations use AI responsibly.' },
      { question: 'Is AI governance only for regulated industries?', answer: 'No. Regulated teams need it most visibly, but any team using AI for customers, employees, finance, data, or decisions benefits from governance.' },
      { question: 'What is a practical first AI governance step?', answer: 'Name the high-risk workflows, decide who owns approval, and define what data agents may access.' },
      { question: 'How does Prymal support governance?', answer: 'Prymal supports governance through scoped memory, workflow approvals, input screening, and output validation language.' },
    ],
    references: [refs.nistAiRmf, refs.nistAirc, refs.googleMultiAgent],
    relatedSlugs: ['ai-operating-system', 'agent-memory', 'ai-workflow-management'],
  }),
  buildPage({
    slug: 'retrieval-augmented-generation',
    term: 'Retrieval Augmented Generation',
    category: 'Retrieval',
    shortDefinition: 'Retrieval augmented generation, or RAG, is a pattern where an AI system retrieves relevant external information before generating an answer.',
    practicalDefinition: 'RAG combines a language model with a retrieval system. Instead of relying only on the model parameters, the system searches documents, passages, or memory stores and gives relevant context to the model.',
    whyItMatters: 'RAG matters because business AI often needs current, source-grounded information. It can improve specificity and reduce repeated manual context transfer, but it still needs source quality and review.',
    components: ['Document ingestion', 'Chunking', 'Embeddings', 'Vector search', 'Retriever ranking', 'Generation prompt', 'Citation and review'],
    examples: [
      example('Policy question answering', 'An employee asks a policy question and the system retrieves approved policy passages before drafting an answer.', ['Ingest policy', 'Retrieve passages', 'Draft answer', 'Show source']),
      example('Client knowledge workflow', 'An agent retrieves approved client notes before drafting a report or follow-up.', ['Store notes', 'Search context', 'Draft output', 'Validate facts']),
    ],
    misconceptions: ['RAG does not guarantee truth.', 'Poor retrieval creates poor answers.', 'RAG is not the same as long context alone.'],
    prymalLens: 'Prymal uses retrieval concepts through LORE memory so agents can work from approved business context instead of generic prompts.',
    agentRoles: ['LORE retrieves context.', 'SENTINEL checks source alignment.', 'CIPHER helps protect sensitive sources.', 'NEXUS applies retrieval inside workflows.'],
    governanceNotes: ['Track source ownership.', 'Refresh stale documents.', 'Show uncertainty when retrieval is weak.'],
    illustration: illustration('RAG map', { label: 'Question', detail: 'User need', glyph: '?' }, { label: 'Retriever', detail: 'Finds sources', glyph: 'R' }, { label: 'Generator', detail: 'Drafts answer', glyph: 'G' }, { label: 'Sources', detail: 'Evidence', glyph: 'S' }),
    faq: [
      { question: 'What is retrieval augmented generation?', answer: 'RAG is a pattern where an AI system retrieves relevant external information, then uses that information when generating an answer.' },
      { question: 'Does RAG stop hallucinations?', answer: 'It can reduce unsupported answers, but it does not eliminate risk. Retrieval quality, prompt design, source freshness, and review still matter.' },
      { question: 'Is RAG the same as agent memory?', answer: 'RAG is one technical pattern for retrieval. Agent memory is broader and may include retrieval, summaries, preferences, state, and workflow context.' },
      { question: 'How does Prymal use RAG-like ideas?', answer: 'Prymal uses LORE shared memory so agents can retrieve approved business context during workflows.' },
    ],
    references: [refs.ragPaper, refs.metaRag, refs.langGraph],
    relatedSlugs: ['agent-memory', 'knowledge-management', 'ai-governance'],
  }),
  buildPage({
    slug: 'agent-collaboration',
    term: 'Agent Collaboration',
    category: 'Agent systems',
    shortDefinition: 'Agent collaboration is the process of multiple agents sharing context, outputs, and responsibilities to complete work together.',
    practicalDefinition: 'Collaboration can be sequential, parallel, supervised, or peer-to-peer. A strong collaboration pattern defines what each agent owns, what information it receives, and how outputs are merged or reviewed.',
    whyItMatters: 'Collaboration matters because business work is rarely a single skill. Research, planning, drafting, checking, and delivery often require different roles.',
    components: ['Role boundaries', 'Shared context', 'Structured handoffs', 'Conflict resolution', 'Output merging', 'Review checkpoints'],
    examples: [
      example('Research to content collaboration', 'A research agent gathers evidence, a strategist selects angles, a writer drafts, and a validator checks claims.', ['Research', 'Select angle', 'Draft', 'Validate']),
      example('Customer issue collaboration', 'A support agent summarises the case, a policy agent checks rules, and an operations agent prepares next steps.', ['Summarise', 'Check policy', 'Plan action', 'Approve']),
    ],
    misconceptions: ['Collaboration is not a free-for-all conversation.', 'Agents need clear handoff formats.', 'Human review should resolve conflicts or uncertainty.'],
    prymalLens: 'Prymal treats collaboration as specialist agents working through a shared operating layer rather than agents improvising without business context.',
    agentRoles: ['SCOUT finds information.', 'SAGE interprets tradeoffs.', 'FORGE produces drafts.', 'SENTINEL validates final outputs.'],
    governanceNotes: ['Use structured outputs between agents.', 'Log which agent contributed what.', 'Escalate contradictions to a human owner.'],
    illustration: illustration('Agent collaboration map', { label: 'Shared task', detail: 'Common goal', glyph: 'T' }, { label: 'Agent 1', detail: 'Research', glyph: '1' }, { label: 'Agent 2', detail: 'Draft', glyph: '2' }, { label: 'Merged output', detail: 'Reviewed result', glyph: 'M' }),
    faq: [
      { question: 'What is agent collaboration?', answer: 'Agent collaboration is the coordination of multiple agents that share context, intermediate outputs, and responsibilities to complete a task.' },
      { question: 'How is collaboration different from orchestration?', answer: 'Collaboration describes how agents work together. Orchestration describes the broader control system that routes tasks, tools, state, and review.' },
      { question: 'What can go wrong in agent collaboration?', answer: 'Agents can duplicate work, contradict one another, amplify mistakes, or create outputs nobody owns unless roles and review gates are clear.' },
      { question: 'How does Prymal support collaboration?', answer: 'Prymal gives specialist agents shared memory and workflow paths so collaboration stays tied to business context.' },
    ],
    references: [refs.googleMultiAgent, refs.googleScalingAgents, refs.autogen],
    relatedSlugs: ['agent-orchestration', 'multi-agent-ai', 'ai-operating-system'],
  }),
  buildPage({
    slug: 'ai-workflow-management',
    term: 'AI Workflow Management',
    category: 'Operations',
    shortDefinition: 'AI workflow management is the practice of designing, running, reviewing, and improving workflows that include AI agents or AI-generated outputs.',
    practicalDefinition: 'It brings workflow design, agent orchestration, memory management, approvals, monitoring, and ROI measurement together so AI-assisted work can be trusted and improved.',
    whyItMatters: 'AI workflow management matters because most business value comes from repeatable execution, not isolated prompts. Teams need to know what runs, who reviews it, and whether it improves outcomes.',
    components: ['Workflow design', 'Agent assignment', 'Memory inputs', 'Approval gates', 'Run history', 'Metrics', 'Continuous improvement'],
    examples: [
      example('Weekly operating review', 'Agents summarise sales, support, finance, and project updates before a manager reviews decisions.', ['Collect updates', 'Summarise by role', 'Flag risks', 'Approve actions']),
      example('Client delivery workflow', 'A workflow moves from brief intake to research, draft, QA, client update, and decision logging.', ['Intake brief', 'Assign agents', 'Validate work', 'Log decision']),
    ],
    misconceptions: ['It is not just automation software.', 'It is not valuable without metrics.', 'It should include humans rather than hide them.'],
    prymalLens: 'Prymal uses AI workflow management to connect LORE memory, NEXUS workflow orchestration, specialist agents, and review controls into one operating system.',
    agentRoles: ['NEXUS runs workflow paths.', 'ATLAS plans operating steps.', 'LORE supplies source context.', 'SENTINEL checks outputs.'],
    governanceNotes: ['Define run ownership.', 'Measure saved setup time and review quality.', 'Keep an audit trail for sensitive work.'],
    illustration: illustration('AI workflow management map', { label: 'Manage', detail: 'Design and run', glyph: 'M' }, { label: 'Agents', detail: 'Do work', glyph: 'A' }, { label: 'Memory', detail: 'Grounds work', glyph: 'L' }, { label: 'Metrics', detail: 'Improve', glyph: 'K' }),
    faq: [
      { question: 'What is AI workflow management?', answer: 'AI workflow management is the design and operation of workflows that use AI agents or AI outputs while keeping context, review, and measurement visible.' },
      { question: 'How is it different from workflow automation?', answer: 'Workflow automation focuses on moving work through steps. AI workflow management also covers agent roles, memory quality, validation, approvals, and improvement over time.' },
      { question: 'What should teams measure?', answer: 'Measure cycle time, manual setup time, review changes, quality issues, escalations, and whether the workflow produces the intended business outcome.' },
      { question: 'How does Prymal support AI workflow management?', answer: 'Prymal combines NEXUS workflows, LORE memory, specialist agents, validation, and review controls for repeatable business execution.' },
    ],
    references: [refs.langGraph, refs.googleMultiAgent, refs.nistAiRmf],
    relatedSlugs: ['workflow-automation', 'agent-orchestration', 'ai-operating-system'],
  }),
];

export function getEducationPath(slug) {
  return `${EDUCATION_HUB_PATH}/${slug}`;
}

export function getEducationPageBySlug(slug) {
  return EDUCATION_PAGES.find((page) => page.slug === slug) ?? null;
}

export function getRelatedEducationPages(page) {
  return page.relatedSlugs.map((slug) => getEducationPageBySlug(slug)).filter(Boolean);
}

export function getEducationRoutes() {
  return [
    {
      path: EDUCATION_HUB_PATH,
      changefreq: 'weekly',
      priority: '0.86',
      lastmod: EDUCATION_CONTENT_UPDATED_AT,
      kind: 'education-hub',
    },
    ...EDUCATION_PAGES.map((page) => ({
      path: getEducationPath(page.slug),
      changefreq: 'monthly',
      priority: '0.82',
      lastmod: EDUCATION_CONTENT_UPDATED_AT,
      kind: 'what-is',
      slug: page.slug,
    })),
  ];
}

function paragraph(value) {
  return value.replace(/\s+/g, ' ').trim();
}

export function buildEducationSections(page) {
  const componentText = page.components.join(', ');
  const roleText = page.agentRoles.join(' ');
  const governanceText = page.governanceNotes.join(' ');
  const examplesText = page.examples.map((item) => `${item.title}: ${item.description}`).join(' ');

  return [
    {
      eyebrow: 'Definition',
      title: `${page.term}: plain-English definition`,
      paragraphs: [
        paragraph(`${page.shortDefinition} The important detail is that the concept should be understood as an operating pattern, not only as a technical phrase. When a business asks "what is ${page.term.toLowerCase()}?", the useful answer must explain what changes in day-to-day work: who has context, how work moves, where review happens, and how a result becomes repeatable.`),
        paragraph(`${page.practicalDefinition} That practical definition matters because teams adopt AI inside existing responsibilities. A definition that only describes models or algorithms is incomplete for operators. A better definition connects the concept to tasks, source context, accountability, and the point where a human should approve, repair, or reject the output.`),
      ],
      bullets: [`Short definition: ${page.shortDefinition}`, `Practical definition: ${page.practicalDefinition}`, `Category: ${page.category}`],
    },
    {
      eyebrow: 'Why it matters',
      title: `Why ${page.term.toLowerCase()} matters for business teams`,
      paragraphs: [
        paragraph(`${page.whyItMatters} The reason this matters now is that AI adoption usually begins with individual experimentation and then runs into team-level friction. Someone gets a useful answer in a chat window, but the answer is not connected to approved memory, workflow state, review ownership, or a reusable process. The team sees speed but not yet an operating system.`),
        paragraph(`For business teams, ${page.term.toLowerCase()} becomes valuable when it reduces repeated setup and improves the quality of work that people already need to do. It should help teams preserve context, make work easier to inspect, and create a route from request to output. If the concept cannot be tied to a real workflow, it is probably still educational rather than operational.`),
      ],
      bullets: ['It reduces repeated context setup.', 'It makes AI work easier to review.', 'It supports repeatable operating outcomes.'],
    },
    {
      eyebrow: 'Core components',
      title: `The core components of ${page.term.toLowerCase()}`,
      paragraphs: [
        paragraph(`The core components are ${componentText}. These pieces work together. If one is missing, the concept can still be useful, but it becomes less reliable. For example, a system can generate text without governance, but it will be harder to trust. A workflow can run without memory, but users will keep pasting context. Agents can collaborate without clear roles, but the output may become harder to inspect.`),
        paragraph(`The component model is also a buying checklist. Teams should ask whether a product exposes the component, hides it, or requires the team to build it. A developer framework may provide primitives but require engineering. A business product may provide fewer low-level controls but make the operating path easier for non-technical teams. The right choice depends on whether the team needs custom infrastructure or usable execution.`),
      ],
      bullets: page.components.map((component) => `${component} should have a clear owner, purpose, and review rule.`),
    },
    {
      eyebrow: 'How it works',
      title: `How ${page.term.toLowerCase()} works in a real workflow`,
      paragraphs: [
        paragraph(`A real workflow begins with a request and a desired outcome. The system gathers the relevant source context, applies the right roles or tools, creates an intermediate output, checks the result, and then routes it to the appropriate person or destination. This is where ${page.term.toLowerCase()} becomes more than vocabulary: it defines the path from intent to reviewed work.`),
        paragraph(`In strong implementations, the workflow also remembers what happened. Inputs, assumptions, approvals, rejected outputs, source gaps, and final decisions should improve the next run. The goal is not to make AI mysterious. The goal is to make AI work inspectable enough that teams can improve it. That is why memory, orchestration, validation, and governance often appear together in mature AI systems.`),
      ],
      bullets: ['Capture the request.', 'Retrieve or load approved context.', 'Assign the right agent or workflow role.', 'Validate and review the result.', 'Record improvements for the next run.'],
    },
    {
      eyebrow: 'Examples',
      title: `Examples of ${page.term.toLowerCase()}`,
      paragraphs: [
        paragraph(`The most useful examples are ordinary business workflows rather than abstract demos. ${examplesText} These examples show the same pattern: source context enters the system, specialist work happens, risk is checked, and a human keeps responsibility for sensitive decisions.`),
        paragraph(`A good example should be narrow enough to measure. Instead of saying "use AI for operations", define the exact workflow: weekly project status reporting, support ticket triage, client onboarding, proposal generation, policy Q&A, or sales follow-up. Narrow examples teach teams where the concept creates leverage and where it needs review.`),
      ],
      bullets: page.examples.flatMap((item) => item.steps.map((step) => `${item.title}: ${step}`)),
    },
    {
      eyebrow: 'Prymal lens',
      title: `How Prymal applies ${page.term.toLowerCase()}`,
      paragraphs: [
        paragraph(`${page.prymalLens} Prymal's public positioning is intentionally business-oriented. The product is not described as raw model access, a research notebook, or a pure integration tool. It is an AI operating system for business execution, which means the concept has to serve repeatable work rather than only produce clever answers.`),
        paragraph(`Inside that lens, the important roles are clear. ${roleText} Those roles matter because business users need understandable responsibility boundaries. If an agent researches, call it research. If an agent drafts, call it drafting. If an agent validates, show what it checked. Clear roles help users trust the workflow without pretending the system is infallible.`),
      ],
      bullets: page.agentRoles,
    },
    {
      eyebrow: 'Governance',
      title: `Governance considerations for ${page.term.toLowerCase()}`,
      paragraphs: [
        paragraph(`Governance should be built into the concept from the start. ${governanceText} These notes are practical rather than ornamental. They determine whether the workflow can be used with customers, employees, sensitive information, commercial claims, or regulated context. A team that ignores governance may get a faster draft but a weaker operating system.`),
        paragraph(`The safest approach is to classify workflows by risk. Internal brainstorming can move quickly. Customer-facing messages need review. Finance, legal, medical, regulated, or employment-related outputs need stricter ownership. Any workflow that uses sensitive sources should have access boundaries. Governance is not a tax on AI work; it is what makes AI work usable in a real organisation.`),
      ],
      bullets: page.governanceNotes,
    },
    {
      eyebrow: 'Misconceptions',
      title: `Common misconceptions about ${page.term.toLowerCase()}`,
      paragraphs: [
        paragraph(`The most common misconceptions are: ${page.misconceptions.join(' ')} These misconceptions usually appear when teams evaluate AI through demos rather than operating conditions. A demo can hide missing memory, missing ownership, weak source quality, or review gaps because the example is short and controlled.`),
        paragraph(`A better evaluation asks what happens on the tenth run. Does the system remember approved context? Can it handle exceptions? Can a reviewer see the assumptions? Can the team change the workflow without breaking it? Does the output improve over time? These questions reveal whether the concept is production-ready for business use or only impressive in isolation.`),
      ],
      bullets: page.misconceptions,
    },
    {
      eyebrow: 'Implementation',
      title: `How to implement ${page.term.toLowerCase()} carefully`,
      paragraphs: [
        paragraph(`Start with a single workflow that repeats often enough to measure. Define the request, required inputs, source context, agent role, output format, review owner, and success metric. Run the workflow on a recent real example and compare it to the manual process. The first implementation should teach the team where memory is missing, where instructions are unclear, and where review needs to be stricter.`),
        paragraph(`After the first run, improve the source context and workflow design. Add examples of good outputs, unacceptable outputs, policy notes, tone rules, and exception handling. Keep the workflow narrow until the team trusts it. Expanding too early is a common failure mode: the system seems powerful but becomes difficult to review because the scope is too broad.`),
        paragraph(`A useful implementation also names what the system should not do. If ${page.term.toLowerCase()} is being used for customer communication, define which promises are off limits. If it touches internal knowledge, define which sources are authoritative. If it affects operations, define who can pause or override the workflow. Clear negative boundaries make the positive workflow safer and easier to adopt.`),
      ],
      bullets: ['Choose one repeated workflow.', 'Name the source context and owner.', 'Define the review gate.', 'Measure baseline and improvement.', 'Expand only after trust is earned.'],
    },
    {
      eyebrow: 'Evaluation',
      title: `How to evaluate ${page.term.toLowerCase()} tools`,
      paragraphs: [
        paragraph(`Evaluation should combine product fit and operating fit. Product fit asks whether the tool supports the components the team needs. Operating fit asks whether people can actually use it without creating new bottlenecks. A technically powerful system can fail if business users cannot inspect, approve, or improve the work. A simple tool can succeed if it maps cleanly to a repeated workflow.`),
        paragraph(`Useful evaluation criteria include context quality, retrieval accuracy, role clarity, workflow visibility, approval controls, source freshness, error handling, and measurement. Pricing should be evaluated by outcome rather than seat cost alone. The real cost includes setup, review time, rework, training, and the risk of sending outputs that should have been checked.`),
      ],
      bullets: ['Can the team inspect sources and assumptions?', 'Can review owners approve or repair outputs?', 'Does the workflow improve repeatable work?', 'Can riskier work be held for review?', 'Can the team measure ROI?'],
    },
    {
      eyebrow: 'Maturity model',
      title: `A maturity model for ${page.term.toLowerCase()}`,
      paragraphs: [
        paragraph(`Teams usually mature through four stages. The first stage is experimentation, where individuals try prompts and learn what the concept can do. The second stage is repeatability, where the team chooses a narrow workflow and defines source context, output format, and review ownership. The third stage is governance, where access, approvals, validation, and measurement become explicit. The fourth stage is operating leverage, where the workflow runs often enough that saved setup time, reduced rework, and better handoffs become visible.`),
        paragraph(`This maturity model prevents overbuying and under-designing at the same time. A team does not need a complex platform before it knows the workflow. It also should not scale a useful demo before it knows the review rules. For ${page.term.toLowerCase()}, maturity means the system is not only capable of producing an answer; it can produce useful work repeatedly, inside boundaries the business understands.`),
      ],
      bullets: ['Stage 1: experiment with real tasks.', 'Stage 2: make one workflow repeatable.', 'Stage 3: add governance and review rules.', 'Stage 4: measure leverage and expand carefully.'],
    },
    {
      eyebrow: 'Buyer checklist',
      title: `Questions to ask before adopting ${page.term.toLowerCase()}`,
      paragraphs: [
        paragraph(`Before adopting a tool or process around ${page.term.toLowerCase()}, buyers should ask concrete operating questions. What business workflow will this improve? What source context does the system need? Who owns the quality of that context? What happens when the system is uncertain? Which outputs can move automatically, and which must be reviewed? What evidence will show that the workflow is better than the manual baseline?`),
        paragraph(`The answers should be written down before rollout. This does not need to become heavy bureaucracy, but it should be clear enough that a new team member can understand how the workflow works. Good AI adoption is less about one perfect prompt and more about a repeatable operating loop: context, task, output, validation, approval, measurement, and improvement. That loop is what turns the concept into business value.`),
      ],
      bullets: ['What workflow is being improved?', 'What context is approved?', 'Who reviews sensitive outputs?', 'How is uncertainty escalated?', 'What metric proves improvement?'],
    },
    {
      eyebrow: 'Internal links',
      title: `Where ${page.term.toLowerCase()} fits in the Prymal knowledge graph`,
      paragraphs: [
        paragraph(`${page.term} connects to the broader Prymal knowledge graph. The core relationship is Prymal -> AI Operating System. From there, concepts like agent orchestration, memory, governance, workflow automation, collaboration, and retrieval all describe parts of the operating layer. Internal links help readers and answer engines understand that these are not isolated definitions; they are connected components of business AI execution.`),
        paragraph(`The related education pages below should be read as a path. Start with the broad category, then move into the specific mechanism, then look at use cases, industry pages, and comparisons. This is how the educational hub supports SEO, AEO, GEO, and human learning at the same time: it gives a clear definition, examples, source references, and the next concept to read.`),
      ],
      bullets: page.relatedSlugs.map((slug) => `Related concept: ${getEducationPageBySlug(slug)?.term ?? slug}.`),
    },
    {
      eyebrow: 'Summary',
      title: `The short version`,
      paragraphs: [
        paragraph(`${page.term} is best understood through business execution. The concept matters when it helps a team move from isolated AI use to repeatable, reviewable work. It should improve context continuity, reduce manual setup, and make outputs easier to approve. It should not hide uncertainty, bypass sensitive decisions, or create an automation path nobody owns.`),
        paragraph(`For Prymal, the educational point is consistent: business AI needs agents, memory, workflows, and governance in one operating layer. Each "What Is" page in this hub reinforces that model while giving readers examples, references, FAQs, and internal links they can use to keep learning.`),
        paragraph(`The final test is practical adoption. If a reader can leave the page and name one workflow, one source of truth, one review owner, and one metric, then the concept has become useful. That is the purpose of the hub: not only to define AI terminology, but to help teams translate the terminology into safer, clearer, and more repeatable work.`),
      ],
      bullets: ['Define the concept clearly.', 'Tie it to a workflow.', 'Keep source context visible.', 'Preserve human review.', 'Measure operating improvement.'],
    },
  ];
}

export function getEducationWordCount(page) {
  const sections = buildEducationSections(page);
  const text = [
    page.shortDefinition,
    page.practicalDefinition,
    page.whyItMatters,
    ...sections.flatMap((section) => [...section.paragraphs, ...section.bullets]),
    ...page.examples.flatMap((item) => [item.title, item.description, ...item.steps]),
    ...page.faq.flatMap((item) => [item.question, item.answer]),
    ...page.references.flatMap((item) => [item.title, item.publisher, item.note]),
  ].join(' ');
  return text.split(/\s+/).filter(Boolean).length;
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

export function buildEducationHubSchema() {
  return buildSchemaGraph([
    buildCollectionSchema({
      name: 'Prymal What Is education hub',
      description: 'Educational What Is pages for AI operating systems, agent orchestration, agent memory, workflow automation, multi-agent AI, AI governance, RAG, agent collaboration, and AI workflow management.',
      path: EDUCATION_HUB_PATH,
    }),
    buildBreadcrumbSchema([
      { name: SITE_NAME, path: '/' },
      { name: 'What Is', path: EDUCATION_HUB_PATH },
    ]),
    buildItemListSchema({
      id: 'education-pages',
      name: 'Prymal What Is pages',
      description: 'Generated educational definitions and explainers.',
      path: EDUCATION_HUB_PATH,
      items: EDUCATION_PAGES.map((page) => ({
        '@type': 'Article',
        headline: page.title,
        description: page.metaDescription,
        url: urlForPath(getEducationPath(page.slug)),
      })),
    }),
  ]);
}

export function buildEducationPageSchema(page) {
  const path = getEducationPath(page.slug);
  return buildSchemaGraph([
    buildWebPageSchema({
      name: page.metaTitle,
      description: page.metaDescription,
      path,
      datePublished: EDUCATION_CONTENT_UPDATED_AT,
      dateModified: EDUCATION_CONTENT_UPDATED_AT,
    }),
    buildArticleSchema({
      headline: page.title,
      description: page.metaDescription,
      path,
      datePublished: EDUCATION_CONTENT_UPDATED_AT,
      dateModified: EDUCATION_CONTENT_UPDATED_AT,
      keywords: [page.term, page.category, 'AI operating system', 'business AI', 'Prymal'],
      wordCount: getEducationWordCount(page),
      authorName: SITE_NAME,
      authorType: 'Organization',
    }),
    buildBreadcrumbSchema([
      { name: SITE_NAME, path: '/' },
      { name: 'What Is', path: EDUCATION_HUB_PATH },
      { name: page.title, path },
    ]),
    buildFaqPageSchema(page.faq),
    {
      '@context': 'https://schema.org',
      '@type': 'DefinedTerm',
      '@id': `${urlForPath(path)}#term`,
      name: page.term,
      description: page.shortDefinition,
      inDefinedTermSet: {
        '@type': 'DefinedTermSet',
        name: 'Prymal AI education glossary',
        url: urlForPath(EDUCATION_HUB_PATH),
      },
    },
    buildItemListSchema({
      id: 'references',
      name: `${page.term} references`,
      description: `References used for ${page.title}.`,
      path,
      items: page.references.map((reference) => ({
        '@type': 'CreativeWork',
        name: reference.title,
        url: reference.href,
        publisher: reference.publisher,
        description: reference.note,
      })),
    }),
  ]);
}

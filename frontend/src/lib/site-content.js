import { BLOG_POSTS } from './blog-posts';

export const HOME_FAQ_ITEMS = [
  {
    question: 'What is Prymal?',
    answer: 'Prymal is an AI operating system for business execution that combines specialist agents, shared business memory, workflow automation, and safety controls in one workspace.',
  },
  {
    question: 'How is Prymal different from ChatGPT?',
    answer: 'General chat tools are great for open-ended conversations. Prymal is designed for coordinated business execution across agents, memory, workflows, approvals, and governance.',
  },
  {
    question: 'Does Prymal remember my business context?',
    answer: 'Yes. Prymal can retain shared business context through Global Context, Agent Context, and Project Context so agents can work from durable knowledge instead of starting from scratch each time.',
  },
  {
    question: 'Can Prymal automate workflows?',
    answer: 'Yes. Prymal supports workflow automation with approvals, replay paths, event handling, and memory-aware execution so multi-step business work can be repeated safely.',
  },
  {
    question: 'Is Prymal secure?',
    answer: 'Prymal is built with WARDEN, SENTINEL, environment hardening, rate limits, safe logging, and deployment controls. Prymal focuses on readiness and evidence preparation rather than unearned certification claims.',
  },
];

export const PRICING_FAQ_ITEMS = [
  {
    question: 'How does Prymal pricing work?',
    answer: 'Prymal pricing is structured around workspace plans, execution capacity, and the depth of business memory, workflows, and collaboration controls your team needs.',
  },
  {
    question: 'What is Founding Access?',
    answer: 'Founding Access is Prymal’s early-adopter offer for teams joining before wider launch. It is intended for serious operators who want early leverage and direct product feedback loops.',
  },
  {
    question: 'Can teams use Prymal together?',
    answer: 'Yes. Prymal is built for shared business context, team workflows, operator oversight, and repeatable execution rather than single-user prompt sessions.',
  },
  {
    question: 'Can Prymal generate images or videos?',
    answer: 'Yes. Prymal supports guided media generation inside the workspace so teams can produce campaign visuals and video outputs without exposing routing internals on the surface.',
  },
];

export const TRUST_FAQ_ITEMS = [
  {
    question: 'Is Prymal Cyber Essentials certified?',
    answer: 'Prymal is preparing for Cyber Essentials readiness and evidence preparation. Certification should not be claimed until it is formally achieved.',
  },
  {
    question: 'Is Prymal ISO 27001 certified?',
    answer: 'Prymal is preparing for ISO 27001 readiness and aligned controls. Certification should not be claimed until it is formally achieved.',
  },
  {
    question: 'Does Prymal use my data to train public models?',
    answer: 'Prymal does not position customer workspace content as training data for public consumer systems. Product, legal, and privacy disclosures remain the source of truth for processing boundaries.',
  },
  {
    question: 'Can I delete my memory or context?',
    answer: 'Yes. Prymal’s memory controls are designed to let users review, lock, adjust, and delete workspace context rather than treating it as an opaque black box.',
  },
];

const commonFaqs = {
  memory: {
    question: 'Does Prymal remember my business context?',
    answer: 'Yes. Prymal uses shared business memory so agents can work from durable context, current initiatives, and approved preferences instead of relying on one-off prompts alone.',
  },
  lore: {
    question: 'What is LORE?',
    answer: 'LORE is Prymal’s business memory and evidence layer. It helps agents retrieve grounded context from workspace knowledge, uploaded files, and live research when needed.',
  },
  warden: {
    question: 'What is WARDEN?',
    answer: 'WARDEN is Prymal’s safety and content-governance layer for screening risky inputs, uploads, and workflow actions before they become harmful outputs.',
  },
  sentinel: {
    question: 'What is SENTINEL?',
    answer: 'SENTINEL is Prymal’s output validation and quality gate. It helps hold, repair, or flag risky outputs before they flow into downstream business actions.',
  },
  teams: {
    question: 'Can teams use Prymal together?',
    answer: 'Yes. Prymal is built for teams that need shared memory, governed workflows, reusable context, and operator oversight around business-critical AI work.',
  },
};

export const FEATURE_PAGES = [
  {
    slug: 'ai-agents',
    title: 'AI agents for business execution',
    metaTitle: 'Prymal AI Agents | Specialist agents for business execution',
    metaDescription: 'Explore Prymal’s specialist AI agents, shared business memory, and coordinated handoffs for real business execution.',
    answer: 'Prymal’s AI agents are specialist operators that work from shared business context so the workspace can produce usable work across sales, content, research, support, reporting, and workflows.',
    intro: 'Prymal is designed around specialist agents working from shared business context, not one general chatbot trying to remember everything at once.',
    benefits: [
      'Fourteen specialist agents with clearer job boundaries and better handoffs.',
      'Shared Global Context, Agent Context, and Project Context across the workspace.',
      'Evidence, confidence, and workflow safety controls wrapped around execution.',
    ],
    useCases: [
      'Launch campaigns with FORGE, HERALD, ECHO, and VANCE working from the same commercial context.',
      'Turn research into strategy with ORACLE, SCOUT, SAGE, and LEDGER.',
      'Keep support, policy, and escalation work aligned with WREN and shared business memory.',
    ],
    agentIds: ['herald', 'forge', 'echo', 'vance', 'oracle', 'scout', 'sage'],
    faq: [
      {
        question: 'What are AI agents in Prymal?',
        answer: 'In Prymal, agents are specialist AI workers with defined responsibilities, memory boundaries, and workflow behavior rather than interchangeable chat personas.',
      },
      {
        question: 'How do Prymal agents work together?',
        answer: 'They work from shared business context, use relevant evidence, and hand off work through workflows, content assets, and memory-aware execution paths.',
      },
      commonFaqs.memory,
    ],
  },
  {
    slug: 'lore-business-memory',
    title: 'Business memory and evidence',
    metaTitle: 'Prymal LORE | Business memory, evidence, and context control',
    metaDescription: 'See how Prymal uses LORE, Global Context, Agent Context, and Project Context to make AI work from grounded business memory.',
    answer: 'LORE is Prymal’s business memory and evidence layer. It helps agents work from grounded context, provenance, and current initiative memory rather than fragile prompt fragments.',
    intro: 'Business execution breaks down when AI forgets the real state of your offer, audience, projects, and operating constraints.',
    benefits: [
      'Global Context for durable business facts and preferences.',
      'Agent Context for specialist working memory without raw transcript dumping.',
      'Project Context for launches, campaigns, client delivery, and strategic initiatives.',
    ],
    useCases: [
      'Maintain brand voice and offer context across content and outreach work.',
      'Track launch objectives, milestones, and risks without building a second project-management app.',
      'Review, delete, or lock business memory instead of trusting a hidden black box.',
    ],
    agentIds: ['lore', 'forge', 'herald', 'sage'],
    faq: [
      commonFaqs.memory,
      commonFaqs.lore,
      {
        question: 'Can I delete memory or context?',
        answer: 'Yes. Prymal includes memory controls so teams can inspect, adjust, lock, archive, or delete business context as needed.',
      },
    ],
  },
  {
    slug: 'ai-workflow-automation',
    title: 'AI workflow automation',
    metaTitle: 'Prymal Workflow Automation | AI workflows with approvals and memory',
    metaDescription: 'Automate repeatable business execution with Prymal workflows, approvals, replay paths, and shared memory.',
    answer: 'Prymal workflow automation combines specialist agents, shared memory, approvals, and replay paths so teams can automate useful business work without losing control.',
    intro: 'Automation matters most when work crosses people, systems, approvals, and changing business context.',
    benefits: [
      'Workflow execution with memory-aware agents and bounded tool behavior.',
      'Approvals and review paths for sensitive steps.',
      'Replay and audit visibility for repeatable business operations.',
    ],
    useCases: [
      'Run repeatable lead nurture and follow-up workflows.',
      'Coordinate reporting, content, or onboarding sequences across agents.',
      'Keep higher-risk actions behind governance and review.',
    ],
    agentIds: ['nexus', 'atlas', 'herald', 'wren'],
    faq: [
      {
        question: 'Can Prymal automate workflows?',
        answer: 'Yes. Prymal can coordinate multi-step business workflows with agent handoffs, approvals, memory, and traceability.',
      },
      commonFaqs.sentinel,
      commonFaqs.teams,
    ],
  },
  {
    slug: 'ai-security',
    title: 'AI security and governance',
    metaTitle: 'Prymal AI Security | Safety, validation, and deployment controls',
    metaDescription: 'Learn how Prymal approaches AI safety, validation, deployment hardening, and compliance readiness for business use.',
    answer: 'Prymal is built with safety layers, deployment hardening, evidence handling, and operator controls so AI can be used for serious business work with clearer boundaries.',
    intro: 'Trust in business AI comes from boundaries, validation, and operational evidence, not marketing promises alone.',
    benefits: [
      'WARDEN for risky input, upload, and action screening.',
      'SENTINEL for output validation and quality gating.',
      'Deployment hardening, evidence preparation, and operator visibility for serious teams.',
    ],
    useCases: [
      'Keep business memory, uploads, and workflows inside governed execution paths.',
      'Prepare evidence for security reviews and deployment controls.',
      'Give operators better visibility into trust boundaries without exposing internals to customers.',
    ],
    agentIds: ['sentinel', 'nexus', 'wren'],
    faq: [
      commonFaqs.warden,
      commonFaqs.sentinel,
      {
        question: 'Is Prymal certified?',
        answer: 'Prymal talks about readiness, evidence preparation, and aligned controls. Certification should only be claimed once it has been formally achieved.',
      },
    ],
  },
  {
    slug: 'ai-content-and-outreach',
    title: 'AI content and outreach',
    metaTitle: 'Prymal Content and Outreach | AI for content, sales, and nurture work',
    metaDescription: 'Use Prymal for content systems, outreach, social execution, and lead nurture built on shared business memory.',
    answer: 'Prymal helps teams execute content and outreach through specialist agents that share context about brand voice, ICP, offers, campaigns, and current priorities.',
    intro: 'Business content and outreach fail when context drifts between strategy, writing, follow-up, and execution.',
    benefits: [
      'Specialist agents for writing, outreach, social adaptation, and commercial follow-through.',
      'Shared context across brand voice, offers, objections, and current campaigns.',
      'Outputs designed for usable work rather than prompt theatre.',
    ],
    useCases: [
      'Build campaign assets and follow-up systems from one shared brief.',
      'Keep sales outreach and content strategy aligned to the same offer.',
      'Scale founder-led messaging without losing tone control.',
    ],
    agentIds: ['forge', 'herald', 'echo', 'vance'],
    faq: [
      {
        question: 'Can Prymal help with outreach?',
        answer: 'Yes. Prymal can support messaging, follow-up logic, social adaptation, and sales-friendly content while keeping shared business context intact.',
      },
      commonFaqs.memory,
      commonFaqs.teams,
    ],
  },
  {
    slug: 'ai-reporting-and-strategy',
    title: 'AI reporting and strategy',
    metaTitle: 'Prymal Reporting and Strategy | AI for reporting, SEO, research, and decisions',
    metaDescription: 'Use Prymal for SEO, research, reporting, and strategic synthesis with shared business context and evidence-aware outputs.',
    answer: 'Prymal supports reporting and strategic work through specialist agents for analysis, SEO, research, and decision support that operate from shared business context and evidence.',
    intro: 'Strategy gets brittle when reporting, research, and decision support all happen in disconnected prompt threads.',
    benefits: [
      'SEO, reporting, commercial, and strategic agents working from one shared context base.',
      'Evidence-aware outputs with contradiction and confidence signals.',
      'Better continuity between research, reporting, and action.',
    ],
    useCases: [
      'Build SEO strategy from site priorities, market signals, and business goals.',
      'Turn research into recommendations and operator-ready next steps.',
      'Keep reporting grounded in current projects and commercial reality.',
    ],
    agentIds: ['cipher', 'ledger', 'oracle', 'scout', 'sage'],
    faq: [
      {
        question: 'Can Prymal support SEO and research work?',
        answer: 'Yes. Prymal includes specialist agents for SEO audits, market research, reporting, and strategic synthesis built around evidence-aware business execution.',
      },
      commonFaqs.lore,
      commonFaqs.memory,
    ],
  },
];

export const COMPARISON_PAGES = [
  {
    slug: 'prymal-vs-chatgpt-for-business',
    title: 'Prymal vs ChatGPT for business',
    metaTitle: 'Prymal vs ChatGPT for Business | Compare business AI approaches',
    metaDescription: 'Compare Prymal and ChatGPT for business use, team execution, shared memory, workflows, and governance.',
    answer: 'ChatGPT is excellent for general-purpose AI conversations. Prymal is built for business execution across coordinated agents, memory, workflows, and governance.',
    intro: 'Both products can be useful. The right choice depends on whether you mainly need conversation or an execution layer for ongoing business work.',
    bestFor: [
      'Choose Prymal when you need specialist agents, shared business memory, and workflow execution.',
      'Choose a general chatbot when you mainly need ad hoc ideation, drafting, or personal exploration.',
    ],
    strengths: [
      'Shared business memory and active initiative context.',
      'Specialist agents with clearer roles and handoffs.',
      'Workflow automation, approvals, and operator visibility.',
    ],
    limitations: [
      'Prymal is more opinionated because it is designed around business execution rather than open-ended general chat alone.',
      'Teams still need to define the right business context and review boundaries.',
    ],
    whenPrymal: 'Choose Prymal when the work needs continuity, governance, and specialist execution across the business.',
    whenGeneralEnough: 'A general chatbot may be enough when the need is lightweight drafting or individual brainstorming without shared workflows.',
    faq: [
      { question: 'How is Prymal different from ChatGPT?', answer: 'ChatGPT is a strong general conversation tool. Prymal is designed around coordinated agents, memory, workflows, and governance for business execution.' },
      commonFaqs.memory,
      commonFaqs.teams,
    ],
  },
  {
    slug: 'prymal-vs-ai-chatbots',
    title: 'Prymal vs AI chatbots',
    metaTitle: 'Prymal vs AI Chatbots | Compare business execution vs chat-first AI',
    metaDescription: 'Compare Prymal with chatbot-style AI tools for business execution, memory, workflows, and operator control.',
    answer: 'AI chatbots are useful conversation tools. Prymal is designed as a coordinated workspace for business memory, workflows, and specialist execution.',
    intro: 'This comparison is less about one product and more about product categories: chat-first AI versus execution-first AI.',
    bestFor: [
      'Choose Prymal for multi-step business work that needs continuity and oversight.',
      'Choose a chatbot when you mostly want quick answers, light drafting, or solo experimentation.',
    ],
    strengths: [
      'Shared memory across agents and projects.',
      'Evidence, confidence, and review-aware outputs.',
      'Workflow execution rather than one-off prompt sessions.',
    ],
    limitations: [
      'Execution-first systems require stronger setup than lightweight chat use.',
      'Teams still need to define the context they want the system to retain.',
    ],
    whenPrymal: 'Choose Prymal when the work needs repeatability, handoffs, and operational control.',
    whenGeneralEnough: 'Choose a chatbot when the work is mostly exploratory or conversational and does not need shared memory.',
    faq: [
      { question: 'Are AI chatbots and AI agents the same?', answer: 'Not exactly. Chatbots center on conversation. Agents add more structure around roles, context, tools, and execution.' },
      commonFaqs.memory,
      commonFaqs.teams,
    ],
  },
  {
    slug: 'prymal-vs-ai-agent-platforms',
    title: 'Prymal vs AI agent platforms',
    metaTitle: 'Prymal vs AI Agent Platforms | Compare business operator AI categories',
    metaDescription: 'Compare Prymal with broader AI agent platforms across shared memory, business execution, workflows, and governance.',
    answer: 'Many AI agent platforms focus on flexibility and builder control. Prymal is positioned around business execution, shared context, and governed operator workflows.',
    intro: 'Some teams want a highly extensible agent platform. Others want a productized operating layer for business execution.',
    bestFor: [
      'Choose Prymal when you want a more opinionated operating layer for repeatable business work.',
      'Choose a broader agent platform when your priority is low-level experimentation or heavy custom builder workflows.',
    ],
    strengths: [
      'Shared business memory and current initiative context built into the product story.',
      'Clearer positioning around operators, teams, and execution.',
      'Public-facing trust and workflow governance surfaces.',
    ],
    limitations: [
      'An opinionated execution layer may expose fewer low-level controls on the customer-facing surface.',
      'Highly custom engineering teams may want deeper platform primitives.',
    ],
    whenPrymal: 'Choose Prymal when the business wants coordinated AI execution with strong context continuity.',
    whenGeneralEnough: 'Choose a broader platform when the core goal is experimentation with custom agent infrastructure rather than ready-to-use business workflows.',
    faq: [
      { question: 'What makes Prymal different from many AI agent platforms?', answer: 'Prymal is positioned around business execution, shared context, workflows, and operator governance rather than just low-level agent assembly.' },
      commonFaqs.memory,
      commonFaqs.teams,
    ],
  },
  {
    slug: 'prymal-vs-workflow-automation-tools',
    title: 'Prymal vs workflow automation tools',
    metaTitle: 'Prymal vs Workflow Automation Tools | Compare AI workflow approaches',
    metaDescription: 'Compare Prymal with workflow automation tools across memory-aware execution, approvals, and specialist AI work.',
    answer: 'Workflow automation tools are strong for system-to-system logic. Prymal adds specialist AI execution, shared context, and business-memory-aware workflows on top of automation patterns.',
    intro: 'Automation tools solve orchestration well. The difference is whether the automation also needs business memory, specialist reasoning, and governed AI outputs.',
    bestFor: [
      'Choose Prymal when workflows depend on specialist AI work and changing business context.',
      'Choose a pure automation tool when the problem is mostly deterministic app orchestration.',
    ],
    strengths: [
      'Workflow steps can use specialist agents and shared business memory.',
      'Approvals, replay, and context-aware execution paths.',
      'Better fit for mixed human plus AI business work.',
    ],
    limitations: [
      'Purely deterministic integration pipelines may still belong in a classic automation tool.',
      'AI workflow layers need stronger review boundaries around sensitive work.',
    ],
    whenPrymal: 'Choose Prymal when the workflow requires AI outputs that stay aligned to shared context and operator controls.',
    whenGeneralEnough: 'Choose a traditional automation tool when the workflow is mostly fixed logic between systems.',
    faq: [
      { question: 'Can Prymal replace every workflow tool?', answer: 'Not necessarily. Prymal is strongest where workflows need business memory, specialist AI work, and governed execution.' },
      commonFaqs.memory,
      commonFaqs.sentinel,
    ],
  },
  {
    slug: 'best-ai-agents-for-business',
    title: 'Best AI agents for business',
    metaTitle: 'Best AI Agents for Business | What to look for in serious business AI',
    metaDescription: 'See what to look for when evaluating the best AI agents for business, from memory and workflows to governance and team fit.',
    answer: 'The best AI agents for business are not only clever. They can work from shared context, support real workflows, and stay inside clear trust boundaries.',
    intro: 'If you are evaluating business AI seriously, the useful questions are about context, repeatability, governance, and team fit.',
    bestFor: [
      'Use this guide when comparing business AI options for agencies, operator-led companies, and growing teams.',
    ],
    strengths: [
      'Shared business memory.',
      'Specialist roles with clear boundaries.',
      'Workflow support and approvals.',
      'Trust, evidence, and operator visibility.',
    ],
    limitations: [
      'No system removes the need for judgment and review on sensitive business work.',
      'The best tool depends on whether you need execution, exploration, or deterministic orchestration.',
    ],
    whenPrymal: 'Choose Prymal when you want an AI operating system for business execution rather than a single chat surface.',
    whenGeneralEnough: 'Choose a general tool when your needs are lightweight, individual, and not yet workflow-heavy.',
    faq: [
      { question: 'What should I look for in AI agents for business?', answer: 'Look for shared context, workflow support, governance, team usability, and whether the system produces work you can actually use.' },
      commonFaqs.memory,
      commonFaqs.teams,
    ],
  },
];

export const HOME_AEO_BLOCK = {
  title: 'What is Prymal?',
  answer: 'Prymal is an AI operating system for business execution that combines specialist agents, shared business memory, workflow automation, and safety controls in one workspace.',
};

export function getFeaturePageBySlug(slug) {
  return FEATURE_PAGES.find((entry) => entry.slug === slug) ?? null;
}

export function getBlogPostBySlug(slug) {
  return BLOG_POSTS.find((entry) => entry.slug === slug) ?? null;
}

export function getComparisonPageBySlug(slug) {
  return COMPARISON_PAGES.find((entry) => entry.slug === slug) ?? null;
}

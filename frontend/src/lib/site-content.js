import { BLOG_POSTS } from './blog-posts';

export const PUBLIC_OG_DEFAULTS = {
  home: {
    title: 'Prymal | AI operating system for business execution',
    description: 'Specialist agents, shared business memory, workflow automation, and trust controls in one coordinated workspace.',
    image: BLOG_POSTS[0]?.heroImage ?? null,
    imageAlt: 'Prymal editorial cover for business execution, memory, workflows, and trust.',
  },
  features: {
    title: 'Prymal features | Execution, memory, workflows, and trust',
    description: 'Explore coordinated agents, LORE business memory, workflow automation, and security layers.',
    image: BLOG_POSTS[2]?.heroImage ?? BLOG_POSTS[0]?.heroImage ?? null,
    imageAlt: 'Prymal features editorial cover showing shared context and connected execution modules.',
  },
  blog: {
    title: 'Prymal blog | Long-form business AI guides',
    description: 'Detailed guides on business memory, AI agents, secure automation, and execution-first AI.',
    image: BLOG_POSTS[0]?.heroImage ?? null,
    imageAlt: 'Prymal blog editorial cover.',
  },
  trust: {
    title: 'Prymal Trust Centre | Safety, data boundaries, and readiness',
    description: 'Review what Prymal stores, how WARDEN and SENTINEL protect your workspace, LORE memory controls, model processing boundaries, and our certification readiness roadmap.',
    image: BLOG_POSTS[7]?.heroImage ?? BLOG_POSTS[3]?.heroImage ?? null,
    imageAlt: 'Prymal Trust Centre editorial cover focused on safety and operational readiness.',
  },
  compare: {
    title: 'Compare Prymal | Business AI categories explained fairly',
    description: 'Compare Prymal with chat tools, agent platforms, and workflow automation categories.',
    image: BLOG_POSTS[5]?.heroImage ?? BLOG_POSTS[0]?.heroImage ?? null,
    imageAlt: 'Prymal comparison editorial cover for business AI categories.',
  },
  pricing: {
    title: 'Prymal pricing | Plans for AI workflows, memory, and execution control',
    description: 'Review Prymal workspace plans, execution credits, and AI video credits for teams and agencies.',
    image: BLOG_POSTS[0]?.heroImage ?? null,
    imageAlt: 'Prymal pricing overview for business execution plans.',
  },
  changelog: {
    title: 'Prymal changelog | Product evolution and release notes',
    description: 'Track Prymal releases across memory, workflows, trust readiness, media generation, and platform reliability.',
    image: BLOG_POSTS[7]?.heroImage ?? BLOG_POSTS[0]?.heroImage ?? null,
    imageAlt: 'Prymal changelog editorial cover.',
  },
  forAgencies: {
    title: 'Prymal for agencies | AI pod for outreach, content, and delivery',
    description: 'Give agencies a coordinated AI pod for outreach, content, proposals, delivery planning, and client comms.',
    image: BLOG_POSTS[6]?.heroImage ?? BLOG_POSTS[0]?.heroImage ?? null,
    imageAlt: 'Prymal for agencies editorial cover.',
  },
  forSmallBusiness: {
    title: 'Prymal for small business | Practical AI execution without prompt chaos',
    description: 'Help small teams turn AI into repeatable business execution with memory, workflows, and specialist agents.',
    image: BLOG_POSTS[1]?.heroImage ?? BLOG_POSTS[0]?.heroImage ?? null,
    imageAlt: 'Prymal for small business editorial cover.',
  },
  legal: {
    title: 'Prymal legal and policy pages',
    description: 'Privacy, terms, and cookie policies for Prymal.',
    image: null,
    imageAlt: 'Prymal — AI operating system for business execution.',
  },
};

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
    question: 'What does Prymal store in my workspace?',
    answer: 'Prymal stores account and organisation data, agent conversations, LORE documents and memory, workflow definitions and run logs, billing metadata, and security audit events needed to operate the service. Full detail is in the Trust Centre and Privacy Policy.',
  },
  {
    question: 'Does Prymal claim Cyber Essentials or ISO 27001 certification today?',
    answer: 'No. Prymal documents readiness work, aligned controls, and evidence preparation. We do not claim Cyber Essentials, Cyber Essentials Plus, or ISO/IEC 27001 certification until those certifications are formally achieved.',
  },
  {
    question: 'What is WARDEN?',
    answer: 'WARDEN is Prymal’s input safety layer. It screens prompts, uploads, URLs, and risky workflow actions before they become harmful outputs or unintended automation.',
  },
  {
    question: 'What is SENTINEL?',
    answer: 'SENTINEL is Prymal’s output validation layer. It reviews agent and workflow outputs and can pass, repair, or hold results before they reach your team or downstream actions.',
  },
  {
    question: 'Can I delete LORE memory or workspace context?',
    answer: 'Yes. LORE supports review, lock, adjust, and delete controls so business memory is governable rather than hidden. You can also request broader workspace deletion through privacy@prymal.io.',
  },
  {
    question: 'Does Prymal use my data to train public AI models?',
    answer: 'No. Prymal does not use customer workspace content to train public consumer models. Prompts and documents are sent to LLM API providers only to generate responses under their API data terms. See the Privacy Policy for processor details.',
  },
  {
    question: 'How do I report a security concern or incident?',
    answer: 'Email privacy@prymal.io with the subject line "Security Report". Include what you observed, when it happened, and any affected workspace identifiers. We triage reports promptly and will follow breach notification obligations where applicable.',
  },
  {
    question: 'Is a Data Processing Agreement available?',
    answer: 'Yes. Business customers can request a DPA covering workspace processing, sub-processors, and UK GDPR obligations at privacy@prymal.io.',
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
  integrations: {
    question: 'Does Prymal connect to external tools?',
    answer: 'Yes. Prymal supports integrations with tools like Google Workspace, Notion, Slack, LinkedIn, and others so agents can pull context and push outputs through connected systems.',
  },
  governance: {
    question: 'How does Prymal handle AI governance?',
    answer: 'Prymal includes WARDEN for input safety screening, SENTINEL for output validation, approval gates for sensitive workflow actions, and audit logs operators can review.',
  },
  cost: {
    question: 'How is Prymal priced?',
    answer: 'Prymal is priced by plan tier with included monthly execution credits and AI video credits. Usage is metered in real time and credits do not roll over between billing periods.',
  },
};

// Fallback freshness date for marketing pages that do not carry a per-page
// `updatedAt`. Surfaced in the UI ("Last updated: …") and in WebPage schema.
export const PUBLIC_CONTENT_UPDATED_AT = '2026-06-11';

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
  {
    slug: 'prymal-vs-lindy',
    title: 'Prymal vs Lindy',
    metaTitle: 'Prymal vs Lindy | AI Business Execution vs AI Assistants',
    metaDescription: 'Compare Prymal and Lindy for AI assistants, governed business execution, shared memory, WARDEN controls, LORE context, workflows, and trust posture.',
    answer: 'Lindy is known for AI assistant and agent automation use cases. Prymal is designed for governed business execution with shared memory, trust controls, specialist agents, and workflow orchestration.',
    intro: 'This is a fit-based comparison for buyers deciding between assistant-style automation and a governed execution layer for recurring business work.',
    bestFor: [
      'Choose Prymal when you need shared business memory, trust controls, auditability, and governed workflow execution.',
      'An assistant automation product may be enough when the work is lighter, personal, or mostly task-assistant driven.',
    ],
    strengths: [
      'Designed around governed business execution rather than only assistant productivity.',
      'LORE-style shared memory and retrieval keep business context central.',
      'WARDEN-style safety controls, approvals, and audit trails support more controlled workflows.',
    ],
    limitations: [
      'Teams looking only for lightweight personal assistants may prefer a simpler assistant-first tool.',
      'Governed execution requires teams to define context, review points, and workflow ownership.',
    ],
    whenPrymal: 'Choose Prymal when the buying job is controlled business execution across agents, memory, workflows, approvals, and trust controls.',
    whenGeneralEnough: 'A lighter assistant platform may be enough when the need is mainly personal task support or simple automations.',
    matrix: [
      { label: 'Primary lens', prymal: 'Governed business execution layer', other: 'AI assistant and agent automation category' },
      { label: 'Memory and context', prymal: 'Shared business memory through LORE-style context', other: 'Varies by assistant workflow and setup' },
      { label: 'Trust controls', prymal: 'WARDEN-style safety, approvals, and auditability', other: 'Evaluate based on the specific assistant workflow' },
      { label: 'Workflow execution', prymal: 'Specialist agents inside reviewable business workflows', other: 'Often optimized for task assistance and automation convenience' },
    ],
    faq: [
      { question: 'Is Prymal a Lindy alternative?', answer: 'It can be for teams that want governed business execution, shared memory, workflows, and trust controls rather than primarily assistant-style automation.' },
      { question: 'Does Prymal claim Lindy cannot support business workflows?', answer: 'No. This page compares category fit and Prymal positioning without making unsupported claims about another product.' },
      commonFaqs.memory,
      commonFaqs.warden,
    ],
  },
  {
    slug: 'prymal-vs-sintra',
    title: 'Prymal vs Sintra',
    metaTitle: 'Prymal vs Sintra | Specialist AI Agents for Business Execution',
    metaDescription: 'Compare Prymal and Sintra for specialist AI agents, business execution infrastructure, shared memory, workflows, approvals, and trust controls.',
    answer: 'Sintra is commonly associated with specialist AI helpers. Prymal is designed as deeper business execution infrastructure with specialist agents, shared memory, workflows, and governance.',
    intro: 'The fair question is whether the buyer needs approachable AI helpers or a governed operating layer for repeatable business work.',
    bestFor: [
      'Choose Prymal when agent work needs shared business memory, workflow execution, approvals, and auditability.',
      'A helper-led product may be enough when the team wants simple task support with less process design.',
    ],
    strengths: [
      'Specialist agents are framed as part of one governed execution layer.',
      'Business memory and workflow orchestration are central to the product story.',
      'Trust controls and review points are part of how Prymal should be evaluated.',
    ],
    limitations: [
      'A deeper execution layer can be more structured than teams need for casual AI help.',
      'Teams still need to configure useful context and choose the right workflow pilots.',
    ],
    whenPrymal: 'Choose Prymal when you need specialist agents connected by memory, workflows, trust controls, and audit-ready execution.',
    whenGeneralEnough: 'A simpler helper experience may be enough for occasional drafting, ideation, and lightweight task support.',
    matrix: [
      { label: 'Agent model', prymal: 'Specialists inside a business execution layer', other: 'Specialist helper category' },
      { label: 'Execution depth', prymal: 'Workflow orchestration, approvals, and audit history', other: 'Evaluate based on use case and setup' },
      { label: 'Memory', prymal: 'LORE-style shared business memory', other: 'May be more assistant or persona oriented' },
      { label: 'Governance', prymal: 'Trust controls are part of the core category', other: 'Governance depth depends on product configuration' },
    ],
    faq: [
      { question: 'How is Prymal different from Sintra?', answer: 'Prymal positions specialist agents as part of a governed business execution system with memory, workflows, approvals, and trust controls.' },
      { question: 'When might Sintra-style helpers be enough?', answer: 'They may be enough when the team wants approachable task assistance without deeper workflow governance.' },
      commonFaqs.memory,
      commonFaqs.teams,
    ],
  },
  {
    slug: 'prymal-vs-zapier-ai',
    title: 'Prymal vs Zapier AI',
    metaTitle: 'Prymal vs Zapier AI | AI Agents vs Workflow Automation',
    metaDescription: 'Compare Prymal and Zapier AI across deterministic workflow automation, adaptive AI execution, shared memory, approvals, integrations, and governance.',
    answer: 'Zapier is widely associated with workflow automation and integrations. Prymal is designed for adaptive, governed AI execution where specialist agents, memory, and approvals matter alongside automation.',
    intro: 'This comparison explains deterministic automation versus adaptive AI execution without dismissing the value of integration platforms.',
    bestFor: [
      'Choose Prymal when the workflow depends on business context, AI outputs, specialist roles, and review gates.',
      'Choose a traditional automation or integration tool when the workflow is mostly fixed app-to-app logic.',
    ],
    strengths: [
      'Business-memory-aware AI execution rather than only trigger-action automation.',
      'Specialist agents can contribute to multi-step workflows.',
      'Governance and approval points are central when outputs affect customers or operations.',
    ],
    limitations: [
      'Pure integration pipelines may still be better handled by a dedicated automation platform.',
      'Adaptive AI execution needs stronger review and policy boundaries than simple deterministic workflows.',
    ],
    whenPrymal: 'Choose Prymal when the automation needs judgment, context, memory, and human review around AI-generated work.',
    whenGeneralEnough: 'A workflow automation tool may be enough when the logic is deterministic and does not require shared business memory or AI reasoning.',
    matrix: [
      { label: 'Automation type', prymal: 'Adaptive AI execution with governance', other: 'Deterministic workflow and integration automation category' },
      { label: 'Context', prymal: 'Shared memory available to agents and workflows', other: 'Typically passed through fields, triggers, or connected apps' },
      { label: 'Approvals', prymal: 'Review gates for sensitive AI work', other: 'Strong for general workflow control; AI governance varies by setup' },
      { label: 'Best fit', prymal: 'Human plus AI business processes', other: 'Fixed system-to-system automation' },
    ],
    faq: [
      { question: 'Is Prymal a Zapier replacement?', answer: 'Not universally. Prymal is strongest where AI work needs shared memory, specialist agents, and governed execution. Deterministic integration pipelines may still fit automation tools.' },
      { question: 'What is the difference between AI agents and workflow automation?', answer: 'Workflow automation follows defined logic. AI agents can interpret context and produce work, which makes governance, approvals, and memory more important.' },
      commonFaqs.integrations,
      commonFaqs.sentinel,
    ],
  },
  {
    slug: 'prymal-vs-traditional-automation',
    title: 'Prymal vs Traditional Automation Tools',
    metaTitle: 'Prymal vs Traditional Automation Tools | From Workflows to AI Execution',
    metaDescription: 'Compare Prymal with traditional automation categories such as RPA, workflow builders, and integration platforms for governed AI business execution.',
    answer: 'Traditional automation tools are strong for repeatable rules, RPA, workflow builders, and integrations. Prymal is designed for governed AI execution when workflows need business memory, specialist reasoning, and review.',
    intro: 'This page compares product categories rather than attacking any one automation vendor.',
    bestFor: [
      'Choose Prymal when workflows depend on changing business context, AI-generated outputs, and human review.',
      'Choose traditional automation when the process is stable, rule-based, and mostly system-to-system.',
    ],
    strengths: [
      'Specialist agents can handle context-heavy work inside a workflow.',
      'Shared business memory reduces repeated setup across recurring tasks.',
      'Trust controls, approvals, and audit trails fit sensitive AI workflows.',
    ],
    limitations: [
      'RPA, workflow builders, and integration platforms remain useful for stable deterministic processes.',
      'AI execution requires careful governance and should not be treated as set-and-forget automation.',
    ],
    whenPrymal: 'Choose Prymal when the business process includes interpretation, drafting, synthesis, context retrieval, or policy-sensitive review.',
    whenGeneralEnough: 'Traditional automation may be enough when the workflow is predictable, high-volume, and rule-based.',
    matrix: [
      { label: 'Core strength', prymal: 'Governed AI business execution', other: 'RPA, workflow builders, and integration platforms' },
      { label: 'Context handling', prymal: 'LORE-style shared business memory', other: 'Usually fields, scripts, records, or external systems' },
      { label: 'Human review', prymal: 'Designed for approval-aware AI workflows', other: 'Often strong workflow gates, but not always AI-specific' },
      { label: 'Best fit', prymal: 'Adaptive work with controlled AI outputs', other: 'Stable and repeatable rules-based work' },
    ],
    faq: [
      { question: 'How is Prymal different from RPA?', answer: 'RPA is best for repeatable interface or rules-based tasks. Prymal is designed for AI-assisted work that needs shared context, specialist reasoning, approvals, and auditability.' },
      { question: 'Should businesses replace all traditional automation with AI agents?', answer: 'No. Stable deterministic workflows can remain in traditional automation tools. AI agents are most useful where context and judgment are part of the work.' },
      commonFaqs.governance,
      commonFaqs.cost,
    ],
  },
  {
    slug: 'best-ai-agent-platforms-for-business',
    title: 'Best AI Agent Platforms for Business Execution in 2026',
    metaTitle: 'Best AI Agent Platforms for Business Execution in 2026',
    metaDescription: 'A Prymal-owned guide to evaluating the best AI agent platforms for business execution in 2026 across memory, workflows, trust controls, integrations, and ROI.',
    answer: 'The best AI agent platform for business depends on the job: chat, assistant automation, deterministic workflows, or governed business AI execution. Prymal is designed for the governed execution category.',
    intro: 'This is a Prymal-owned guide, so it is not pretending to be a neutral analyst report. It explains evaluation criteria and where Prymal believes it fits.',
    bestFor: [
      'Use this guide if you are comparing AI agent platforms for business execution, workflow automation, memory, and governance.',
      'Choose based on the operating job, not on the largest feature list.',
    ],
    strengths: [
      'Shared business memory and source-grounded context.',
      'Specialist agents connected through workflows.',
      'Governance, approvals, auditability, and trust controls.',
      'Fit for teams moving beyond isolated chat toward controlled execution.',
    ],
    limitations: [
      'This guide is published by Prymal and should be read as a transparent product-owned evaluation framework.',
      'Different tools may fit better for pure chat, low-level engineering customization, or deterministic integrations.',
    ],
    whenPrymal: 'Choose Prymal when you need governed business AI execution with memory, workflows, specialist agents, and trust controls.',
    whenGeneralEnough: 'Choose another category when the main job is broad chat, low-level agent building, or fixed automation between apps.',
    matrix: [
      { label: 'Evaluation criterion', prymal: 'Memory, governance, workflows, execution', other: 'Should be judged by the buyer use case' },
      { label: 'Best category fit', prymal: 'Governed business AI execution', other: 'Chat, assistant, builder, or automation categories may fit different jobs' },
      { label: 'Risk controls', prymal: 'WARDEN, approvals, audit-ready workflow language', other: 'Varies widely by vendor and configuration' },
      { label: 'Buyer test', prymal: 'Pilot one recurring governed workflow', other: 'Compare on the same real process' },
    ],
    faq: [
      { question: 'What is the best AI agent platform for business?', answer: 'The best platform depends on whether the business needs chat, assistant automation, builder flexibility, deterministic workflows, or governed AI execution.' },
      { question: 'Why is this guide transparent about being Prymal-owned?', answer: 'Because buyers should know the source of a recommendation. Prymal can explain its category fit without pretending to be an independent analyst.' },
      commonFaqs.memory,
      commonFaqs.governance,
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

const FEATURE_PAGE_ENHANCEMENTS = {
  'ai-agents': {
    glyph: 'AG',
    proofPoint: '14 specialist agents sharing context without forcing every workflow through one generic prompt thread.',
    useCaseChips: ['Sales follow-up', 'Content systems', 'Support handoffs', 'Launch execution'],
    architectureRole: 'Specialist execution',
    trustNote: 'Public outputs stay provider-agnostic while staff and operators retain deeper diagnostics privately.',
    beforeState: [
      'One general chat thread trying to hold every role at once',
      'Context restated repeatedly across sales, content, and support work',
      'Weak handoffs between analysis, drafting, and execution',
    ],
    withState: [
      'Specialist agents work from shared business context',
      'Relevant context follows the work without transcript dumping',
      'Execution paths feel coordinated instead of improvised',
    ],
  },
  'lore-business-memory': {
    glyph: 'LO',
    proofPoint: 'Global Context, Agent Context, and Project Context keep durable business state reviewable instead of opaque.',
    useCaseChips: ['Brand voice', 'Offer memory', 'Launch context', 'Deletion controls'],
    architectureRole: 'Memory and evidence',
    trustNote: 'Context can be reviewed, deleted, locked, decayed, or superseded instead of persisting as an invisible side effect.',
    beforeState: [
      'Important context buried in prompts, docs, and scattered chats',
      'Agents forget active initiatives or use stale assumptions',
      'No clear provenance for where a fact came from',
    ],
    withState: [
      'Shared memory stays structured, bounded, and provenance-aware',
      'Active projects remain visible without polluting permanent context',
      'Confidence, staleness, and contradiction signals improve trust',
    ],
  },
  'ai-workflow-automation': {
    glyph: 'NX',
    proofPoint: 'Memory-aware workflows combine specialist execution, approvals, replay, and operator review.',
    useCaseChips: ['Approvals', 'Replay paths', 'Lead nurture', 'Operational cadence'],
    architectureRole: 'Orchestration',
    trustNote: 'Sensitive actions can stay behind approval and audit boundaries rather than becoming blind automation.',
    beforeState: [
      'Every repeated task rebuilt manually from scratch',
      'Human handoffs depend on memory and goodwill',
      'Automation lacks current business context',
    ],
    withState: [
      'Repeatable paths carry context between steps',
      'Approvals and replay make automation governable',
      'Specialists contribute inside the workflow, not beside it',
    ],
  },
  'ai-security': {
    glyph: 'TR',
    proofPoint: 'WARDEN, SENTINEL, env hardening, rate limits, and evidence prep turn trust into an operating layer.',
    useCaseChips: ['Input screening', 'Output validation', 'Evidence prep', 'Deployment controls'],
    architectureRole: 'Trust boundary',
    trustNote: 'Prymal speaks in readiness and evidence language, not premature certification claims.',
    beforeState: [
      'Security treated as after-the-fact reassurance',
      'Unsafe input and risky output paths stay too implicit',
      'Operational evidence is hard to collect consistently',
    ],
    withState: [
      'Trust boundaries are explicit at product and deployment level',
      'Risky paths can be screened, validated, and reviewed',
      'Evidence collection supports serious buyer conversations',
    ],
  },
  'ai-content-and-outreach': {
    glyph: 'CM',
    proofPoint: 'Content, outreach, social, and pipeline specialists work from the same brand and offer context.',
    useCaseChips: ['Campaign systems', 'Founder messaging', 'Lead nurture', 'Social adaptation'],
    architectureRole: 'Commercial execution',
    trustNote: 'The public surface stays Prymal-native while the internal operator layer retains richer execution insight.',
    beforeState: [
      'Messaging drifts between strategy, writing, and follow-up',
      'Founders repeat the same brief in every tool',
      'Social and outreach feel disconnected from the real offer',
    ],
    withState: [
      'Shared context keeps offer, tone, and objections aligned',
      'Specialist agents translate one brief into multiple lanes',
      'Outputs feel more usable and less like prompt theatre',
    ],
  },
  'ai-reporting-and-strategy': {
    glyph: 'IN',
    proofPoint: 'Reporting, SEO, research, and strategy stay grounded in current priorities and evidence-aware context.',
    useCaseChips: ['SEO strategy', 'Market research', 'Reporting rhythm', 'Decision support'],
    architectureRole: 'Intelligence',
    trustNote: 'Confidence, contradiction, and evidence signals help strategic work stay calibrated.',
    beforeState: [
      'Research and reporting live in disconnected prompt sessions',
      'Recommendations drift away from current initiatives',
      'Strategic outputs look polished but lack evidence cues',
    ],
    withState: [
      'Intelligence work stays linked to current business context',
      'Specialists can move from research into recommendation faster',
      'Teams see clearer confidence and evidence boundaries',
    ],
  },
};

FEATURE_PAGES.forEach((page) => {
  const enhancement = FEATURE_PAGE_ENHANCEMENTS[page.slug] ?? {};
  Object.assign(page, enhancement, {
    ogImage: enhancement.ogImage ?? PUBLIC_OG_DEFAULTS.features.image,
    ogImageAlt: enhancement.ogImageAlt ?? `${page.title} editorial cover for Prymal.`,
  });
});

const COMPARISON_PAGE_ENHANCEMENTS = {
  'prymal-vs-chatgpt-for-business': {
    matrix: [
      { label: 'Shared business memory', prymal: 'Built around durable shared context', other: 'Mostly conversation-centric memory patterns' },
      { label: 'Workflow execution', prymal: 'Multi-step execution with approvals and replay', other: 'Best for direct conversation and drafting' },
      { label: 'Governance', prymal: 'Operator-facing review boundaries', other: 'Usually lighter workflow governance' },
      { label: 'Team operating model', prymal: 'Designed for shared business execution', other: 'Strong for individual or lightweight team use' },
    ],
  },
  'prymal-vs-ai-chatbots': {
    matrix: [
      { label: 'Role structure', prymal: 'Specialist execution lanes', other: 'Usually one surface for everything' },
      { label: 'Context continuity', prymal: 'Global, Agent, and Project Context', other: 'Often chat-history-led' },
      { label: 'Workflow depth', prymal: 'Repeatable execution paths', other: 'Great for ad hoc conversation' },
      { label: 'Operator oversight', prymal: 'Review-aware by design', other: 'Usually limited governance tooling' },
    ],
  },
  'prymal-vs-ai-agent-platforms': {
    matrix: [
      { label: 'Product posture', prymal: 'Opinionated business operating layer', other: 'More builder-flexible platform posture' },
      { label: 'Memory model', prymal: 'Business-memory-first narrative', other: 'Varies by platform and implementation' },
      { label: 'Workflow posture', prymal: 'Execution-first with operator controls', other: 'Often lower-level orchestration primitives' },
      { label: 'Team adoption path', prymal: 'Faster for operator-led teams', other: 'Often stronger for engineering-heavy experimentation' },
    ],
  },
  'prymal-vs-workflow-automation-tools': {
    matrix: [
      { label: 'AI depth', prymal: 'Specialist AI work inside the flow', other: 'Often deterministic app orchestration' },
      { label: 'Memory awareness', prymal: 'Shared business context available at runtime', other: 'Usually external or manual' },
      { label: 'Approvals', prymal: 'Designed for sensitive AI-assisted steps', other: 'Strong for general workflow gating' },
      { label: 'Best fit', prymal: 'Mixed human and AI business execution', other: 'Fixed logic between tools and systems' },
    ],
  },
  'best-ai-agents-for-business': {
    matrix: [
      { label: 'Memory depth', prymal: 'Core buying criterion', other: 'Often under-developed' },
      { label: 'Governance', prymal: 'Operator and trust boundaries matter', other: 'Frequently treated as secondary' },
      { label: 'Workflow fitness', prymal: 'Critical for repeatable value', other: 'Sometimes not central' },
      { label: 'Team usability', prymal: 'Shared context and collaboration are key', other: 'Can be overly solo-user oriented' },
    ],
  },
};

COMPARISON_PAGES.forEach((page) => {
  const enhancement = COMPARISON_PAGE_ENHANCEMENTS[page.slug] ?? {};
  Object.assign(page, enhancement, {
    ogImage: enhancement.ogImage ?? PUBLIC_OG_DEFAULTS.compare.image,
    ogImageAlt: enhancement.ogImageAlt ?? `${page.title} editorial comparison cover for Prymal.`,
  });
});

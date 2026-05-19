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

export const BLOG_POSTS = [
  {
    slug: 'what-is-an-ai-operating-system-for-business',
    title: 'What Is an AI Operating System for Business?',
    category: 'Category',
    tags: ['AI operating system for business', 'business AI', 'AI agents'],
    metaTitle: 'What Is an AI Operating System for Business? | Prymal Blog',
    metaDescription: 'Learn what an AI operating system for business is, why it is different from a chatbot, and why execution needs memory, workflows, and governance.',
    answer: 'An AI operating system for business is a coordinated layer that combines specialist agents, shared memory, workflows, and governance so AI can produce usable work across the company.',
    intro: 'Most businesses do not need more prompt experiments. They need AI that can help execute recurring work without forgetting context or breaking trust.',
    sections: [
      {
        heading: 'Why chat alone is not enough',
        paragraphs: [
          'A general chatbot can be excellent for exploration, brainstorming, and one-off drafting. Business execution becomes harder when work needs continuity, shared memory, approvals, and repeatability.',
          'The moment teams need AI to support launches, sales follow-up, reporting, or support operations, context and coordination start to matter more than raw novelty.',
        ],
      },
      {
        heading: 'What the operating-system layer adds',
        paragraphs: [
          'An AI operating system adds specialist roles, shared business context, workflow structure, and safety controls. Instead of one generic conversation thread, the business gets a working layer built around execution.',
        ],
        bullets: [
          'Specialist agents with defined jobs.',
          'Shared business memory and current initiative context.',
          'Workflow orchestration and approvals.',
          'Evidence, confidence, and governance signals.',
        ],
      },
      {
        heading: 'Why serious teams care',
        paragraphs: [
          'Teams care because useful AI is not only about faster words. It is about whether the system can work from the right facts, produce reusable outputs, and stay inside trusted boundaries.',
        ],
      },
    ],
    faq: [
      { question: 'What is an AI operating system for business?', answer: 'It is a coordinated layer for specialist agents, business memory, workflows, and governance rather than a single open-ended chatbot surface.' },
      { question: 'How is that different from a chatbot?', answer: 'A chatbot is mainly a conversation interface. An AI operating system is built for continuity, handoffs, repeatability, and business execution.' },
      commonFaqs.memory,
    ],
    relatedFeatures: ['ai-agents', 'ai-workflow-automation', 'lore-business-memory'],
    relatedComparisons: ['prymal-vs-chatgpt-for-business'],
  },
  {
    slug: 'ai-agents-for-small-businesses-what-they-can-actually-do',
    title: 'AI Agents for Small Businesses: What They Can Actually Do',
    category: 'Use cases',
    tags: ['AI agents for small business', 'small business AI', 'AI automation'],
    metaTitle: 'AI Agents for Small Businesses: What They Can Actually Do | Prymal Blog',
    metaDescription: 'Practical examples of what AI agents can do for small businesses across sales, support, content, reporting, and workflow execution.',
    answer: 'AI agents for small businesses can help with outreach, content, support, reporting, and workflow follow-through when they work from shared context instead of isolated prompt threads.',
    intro: 'Small businesses do not need an AI science project. They need leverage where execution bottlenecks show up every week.',
    sections: [
      {
        heading: 'Where AI agents create leverage',
        paragraphs: [
          'The strongest use cases are usually the messy middle of the business: follow-up, content, admin-heavy delivery, research, and recurring reporting.',
        ],
        bullets: [
          'Sales follow-up and nurture.',
          'Campaign and content production.',
          'Support and FAQ response drafting.',
          'Reporting and decision preparation.',
        ],
      },
      {
        heading: 'What makes the difference',
        paragraphs: [
          'The difference is not whether AI can write a sentence. It is whether the system can work from your offer, audience, current priorities, and business constraints without being re-briefed every time.',
        ],
      },
      {
        heading: 'When a simple chatbot is still enough',
        paragraphs: [
          'If you only need occasional drafting or quick ideation, a general tool may be enough. If you need continuity, shared memory, and repeatable execution, specialist agents become more valuable.',
        ],
      },
    ],
    faq: [
      { question: 'What can AI agents do for a small business?', answer: 'They can help with recurring sales, content, support, reporting, and coordination work when they have the right context and controls.' },
      commonFaqs.teams,
      commonFaqs.memory,
    ],
    relatedFeatures: ['ai-agents', 'ai-content-and-outreach', 'ai-reporting-and-strategy'],
    relatedComparisons: ['best-ai-agents-for-business'],
  },
  {
    slug: 'why-business-ai-needs-memory-not-just-prompts',
    title: 'Why Business AI Needs Memory, Not Just Prompts',
    category: 'Memory',
    tags: ['AI memory for business', 'business memory', 'shared context'],
    metaTitle: 'Why Business AI Needs Memory, Not Just Prompts | Prymal Blog',
    metaDescription: 'See why business AI needs shared memory, Global Context, Agent Context, and Project Context rather than prompt-only workflows.',
    answer: 'Business AI needs memory because prompts alone cannot reliably carry durable facts, changing projects, and shared business preferences across teams and workflows.',
    intro: 'Prompting is useful, but prompt-only systems reset too easily for real business operations.',
    sections: [
      {
        heading: 'Global Context',
        paragraphs: [
          'Global Context captures durable business facts like your offer, target customers, pricing, tone, and operating constraints so every specialist starts from the same core understanding.',
        ],
      },
      {
        heading: 'Agent Context',
        paragraphs: [
          'Agent Context keeps specialist preferences close to the work. Outreach tone, support boundaries, research priorities, and reporting habits do not all belong in one giant shared note.',
        ],
      },
      {
        heading: 'Project Context',
        paragraphs: [
          'Project Context keeps active initiatives visible across agents. Launches, campaigns, client delivery, and strategic pushes need their own objective, milestones, risks, and open questions.',
        ],
      },
    ],
    faq: [
      commonFaqs.memory,
      commonFaqs.lore,
      { question: 'Can I delete shared memory?', answer: 'Yes. Prymal is designed so users can review and control memory rather than treat it as uneditable hidden state.' },
    ],
    relatedFeatures: ['lore-business-memory', 'ai-agents'],
    relatedComparisons: ['prymal-vs-ai-chatbots'],
  },
  {
    slug: 'how-to-use-ai-safely-in-a-business',
    title: 'How to Use AI Safely in a Business',
    category: 'Security',
    tags: ['secure AI for business', 'AI safety', 'business governance'],
    metaTitle: 'How to Use AI Safely in a Business | Prymal Blog',
    metaDescription: 'A practical guide to using AI safely in a business with boundaries, validation, approvals, and compliance-ready controls.',
    answer: 'Safe business AI depends on boundaries, validation, approvals, logging, and operational evidence rather than blind trust in raw outputs.',
    intro: 'The goal is not to remove all risk. The goal is to make AI useful while keeping the business inside clear trust boundaries.',
    sections: [
      {
        heading: 'Start with bounded use cases',
        paragraphs: [
          'Begin with use cases where you can define what good looks like, what evidence matters, and where human review belongs.',
        ],
      },
      {
        heading: 'Use layered controls',
        paragraphs: [
          'Layered controls matter because risk can enter through prompts, uploads, tools, memory, or workflow execution. Screening and validation should not depend on a single gate.',
        ],
        bullets: [
          'Input and upload screening.',
          'Output validation and quality review.',
          'Approvals for sensitive actions.',
          'Deployment and logging hygiene.',
        ],
      },
      {
        heading: 'Treat readiness honestly',
        paragraphs: [
          'If your company is preparing for security frameworks, say readiness, evidence preparation, or aligned controls until certification is formally achieved.',
        ],
      },
    ],
    faq: [
      commonFaqs.warden,
      commonFaqs.sentinel,
      { question: 'Is Prymal certified?', answer: 'Prymal talks about readiness and evidence preparation, not certification unless it has been formally achieved.' },
    ],
    relatedFeatures: ['ai-security', 'ai-workflow-automation'],
    relatedComparisons: ['prymal-vs-workflow-automation-tools'],
  },
  {
    slug: 'ai-workflow-automation-a-practical-guide-for-growing-teams',
    title: 'AI Workflow Automation: A Practical Guide for Growing Teams',
    category: 'Workflows',
    tags: ['AI workflow automation', 'workflow execution', 'growing teams'],
    metaTitle: 'AI Workflow Automation: A Practical Guide for Growing Teams | Prymal Blog',
    metaDescription: 'Learn how AI workflow automation works when teams combine specialist agents, shared context, approvals, and audit visibility.',
    answer: 'AI workflow automation works best when it combines specialist agents, shared memory, approvals, and auditability instead of trying to automate everything inside one prompt.',
    intro: 'Growing teams usually hit the same problem: work repeats, context drifts, and the handoff cost starts to dominate the week.',
    sections: [
      {
        heading: 'What belongs in a workflow',
        paragraphs: [
          'A workflow is strongest when the business can define the steps, required inputs, approvals, and expected outputs with reasonable clarity.',
        ],
      },
      {
        heading: 'Why memory matters in automation',
        paragraphs: [
          'Workflows get more useful when the agents inside them can read current business context, active project memory, and approved operating constraints.',
        ],
      },
      {
        heading: 'What to keep under approval',
        paragraphs: [
          'The rule is simple: the more sensitive the action, the clearer the review boundary should be.',
        ],
      },
    ],
    faq: [
      { question: 'Can Prymal automate workflows?', answer: 'Yes. Prymal supports workflow automation with approvals, replay paths, shared context, and operator visibility.' },
      commonFaqs.memory,
      commonFaqs.sentinel,
    ],
    relatedFeatures: ['ai-workflow-automation', 'lore-business-memory'],
    relatedComparisons: ['prymal-vs-workflow-automation-tools'],
  },
  {
    slug: 'the-difference-between-ai-chatbots-and-ai-agents',
    title: 'The Difference Between AI Chatbots and AI Agents',
    category: 'Category',
    tags: ['AI chatbot vs AI agent', 'AI agents', 'business AI'],
    metaTitle: 'The Difference Between AI Chatbots and AI Agents | Prymal Blog',
    metaDescription: 'Understand the difference between AI chatbots and AI agents across context, tools, workflows, and business outcomes.',
    answer: 'AI chatbots are conversation interfaces. AI agents are task-focused specialists that can work from memory, tools, and workflows to help produce outcomes.',
    intro: 'The market often blurs chatbots and agents together, but the difference becomes obvious once teams need AI to support real operating work.',
    sections: [
      {
        heading: 'A chatbot is a surface',
        paragraphs: [
          'Chatbots excel at natural-language interaction. They are often the easiest way to start using AI, but the conversation surface alone does not solve coordination or continuity.',
        ],
      },
      {
        heading: 'An agent is a role with boundaries',
        paragraphs: [
          'An AI agent becomes more useful when it has a defined job, access to relevant memory, and the right workflow or tool boundaries for the task.',
        ],
      },
      {
        heading: 'What businesses should actually ask',
        paragraphs: [
          'The practical question is not which label sounds more advanced. It is whether the system can produce reliable, reviewable work inside your operating context.',
        ],
      },
    ],
    faq: [
      { question: 'What is the difference between a chatbot and an AI agent?', answer: 'A chatbot is mainly a conversation interface. An agent is a role-oriented worker that can use context, memory, and workflow structure to pursue an outcome.' },
      commonFaqs.memory,
      commonFaqs.teams,
    ],
    relatedFeatures: ['ai-agents', 'lore-business-memory'],
    relatedComparisons: ['prymal-vs-ai-chatbots', 'prymal-vs-chatgpt-for-business'],
  },
  {
    slug: 'how-agencies-can-use-ai-agents-to-scale-client-delivery',
    title: 'How Agencies Can Use AI Agents to Scale Client Delivery',
    category: 'Agencies',
    tags: ['AI agents for agencies', 'agency AI', 'client delivery'],
    metaTitle: 'How Agencies Can Use AI Agents to Scale Client Delivery | Prymal Blog',
    metaDescription: 'See how agencies can use AI agents for content, reporting, SEO, onboarding, outreach, and delivery coordination.',
    answer: 'Agencies can use AI agents to scale content, reporting, research, outreach, and delivery operations when the system works from shared client context instead of isolated prompts.',
    intro: 'Agencies rarely lose margin on one dramatic mistake. They lose it across repeated context-switching, follow-up, revisions, and operational drag.',
    sections: [
      {
        heading: 'Where agencies gain leverage',
        paragraphs: [
          'The highest-leverage gains usually come from content systems, client communications, SEO support, reporting, onboarding, and internal delivery handoffs.',
        ],
      },
      {
        heading: 'Why shared client context matters',
        paragraphs: [
          'Without shared business context, every agent or team member has to rebuild the client brief from scratch. Shared memory reduces drift and wasted re-briefing.',
        ],
      },
      {
        heading: 'What to keep human-led',
        paragraphs: [
          'Creative direction, sensitive client escalation, and critical commercial decisions still benefit from clear human ownership. AI should strengthen agency throughput, not remove judgment.',
        ],
      },
    ],
    faq: [
      { question: 'Is Prymal suitable for agencies?', answer: 'Yes. Prymal is designed for agencies that need coordinated content, outreach, research, and delivery work across a shared client context.' },
      commonFaqs.memory,
      commonFaqs.teams,
    ],
    relatedFeatures: ['ai-content-and-outreach', 'ai-reporting-and-strategy', 'lore-business-memory'],
    relatedComparisons: ['best-ai-agents-for-business'],
  },
  {
    slug: 'building-trust-in-ai-automation',
    title: 'Building Trust in AI Automation',
    category: 'Trust',
    tags: ['AI automation security', 'trust in AI', 'AI governance'],
    metaTitle: 'Building Trust in AI Automation | Prymal Blog',
    metaDescription: 'What makes AI automation trustworthy for business use: memory controls, approvals, validation, evidence, and operator visibility.',
    answer: 'Trust in AI automation comes from memory controls, validation, approvals, evidence, and operator visibility rather than opaque promise-driven automation.',
    intro: 'Businesses adopt automation faster when the system makes trust visible instead of asking everyone to assume it.',
    sections: [
      {
        heading: 'Trust is operational',
        paragraphs: [
          'Trust is not one feature. It is the sum of context boundaries, evidence handling, approvals, validation, and whether people can understand why the system acted the way it did.',
        ],
      },
      {
        heading: 'Why memory and evidence matter',
        paragraphs: [
          'Automation becomes more trustworthy when the system can show what context it used, how current that context is, and whether the evidence is strong enough to support the next action.',
        ],
      },
      {
        heading: 'Why honest readiness language matters',
        paragraphs: [
          'Security and compliance language should stay precise. Readiness, evidence preparation, and aligned controls build more trust than premature certification claims.',
        ],
      },
    ],
    faq: [
      commonFaqs.warden,
      commonFaqs.sentinel,
      { question: 'Does Prymal overclaim certification?', answer: 'No. Prymal should talk about readiness, evidence preparation, and aligned controls until formal certification exists.' },
    ],
    relatedFeatures: ['ai-security', 'lore-business-memory'],
    relatedComparisons: ['prymal-vs-ai-agent-platforms'],
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

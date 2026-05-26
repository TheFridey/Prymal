const updatedAt = '2026-05-26';

const link = (title, to, description, cta = 'Open page ->') => ({ title, to, description, cta });

export const SEO_RELATED_LINKS = {
  home: link('Prymal home', '/', 'Start from the core Prymal positioning for governed business AI execution.'),
  pricing: link('Pricing', '/pricing', 'Review public plan language for workspace capacity, execution, and controls.'),
  trust: link('Trust Centre', '/trust', 'See Prymal safety, data boundary, WARDEN, SENTINEL, and readiness language.'),
  agents: link('AI agent orchestration', '/ai-agent-orchestration', 'Understand how specialist agents fit into governed workflow execution.'),
  memory: link('Shared business memory', '/shared-business-memory-ai', 'Explore why AI agents need persistent, source-grounded business context.'),
  governed: link('Governed AI agents', '/governed-ai-agents', 'Learn how permission-aware execution, approvals, and audit trails protect AI work.'),
  workflows: link('Secure AI workflows', '/secure-ai-workflows', 'See how secure workflow automation handles injection risk, review, and policy boundaries.'),
  operating: link('AI operating system for business', '/ai-operating-system-for-business', 'Read the category definition for controlled AI business execution.'),
  lindy: link('Prymal vs Lindy', '/compare/prymal-vs-lindy', 'Compare AI assistant automation with a governed business execution layer.'),
  zapier: link('Prymal vs Zapier AI', '/compare/prymal-vs-zapier-ai', 'Compare deterministic workflow automation with adaptive AI execution.'),
  traditional: link('Prymal vs traditional automation', '/compare/prymal-vs-traditional-automation', 'Compare RPA, workflow builders, integration platforms, and Prymal.'),
  regulated: link('AI for regulated industries', '/use-cases/ai-for-regulated-industries', 'Map governed AI execution to review-heavy and policy-sensitive teams.'),
  agencies: link('AI for marketing agencies', '/use-cases/ai-for-marketing-agencies', 'See agency workflows for content, reporting, client context, and approvals.'),
  operations: link('AI for operations teams', '/use-cases/ai-for-operations-teams', 'Apply governed AI to recurring operating rhythms and cross-functional work.'),
};

const commonFaqs = {
  chatbot: {
    question: 'How is Prymal different from a chatbot?',
    answer: 'A chatbot is mainly a conversation surface. Prymal is designed as a business execution layer with specialist agents, shared business memory, workflow orchestration, review boundaries, and trust controls.',
  },
  memory: {
    question: 'What is shared business memory?',
    answer: 'Shared business memory is durable, reviewable context that AI agents can use across tasks, projects, and workflows. In Prymal, LORE-style retrieval and memory help agents work from grounded business context instead of isolated prompt history.',
  },
  governance: {
    question: 'Why do AI agents need governance?',
    answer: 'AI agents need governance because they can touch sensitive data, produce customer-facing work, and influence business actions. Access controls, approvals, audit trails, and safety checks make that execution more accountable.',
  },
  regulated: {
    question: 'Is Prymal suitable for regulated industries?',
    answer: 'Prymal is designed for controlled, reviewable AI workflows with memory, approvals, and audit-ready operating patterns. Regulated teams should still validate their own legal, compliance, security, and procurement requirements before production use.',
  },
  integrations: {
    question: 'How do AI agents integrate with existing business software?',
    answer: 'A governed AI workflow should connect to business systems through scoped integrations, approval gates, and server-side controls. Prymal frames integrations as controlled workflow execution rather than unrestricted autonomous access.',
  },
  cost: {
    question: 'What is the cost of AI business process automation?',
    answer: 'The cost depends on workflow volume, memory depth, human review needs, integration complexity, and the value of the work being automated. Prymal encourages teams to model cost against recurring execution, not one impressive demo.',
  },
};

function buildCategoryPage({
  slug,
  title,
  metaTitle,
  metaDescription,
  eyebrow,
  answer,
  focus,
  contrast,
  pillars,
  workflows,
  risks,
  relatedPages,
  faqs,
}) {
  const path = `/${slug}`;
  return {
    kind: 'category',
    slug,
    path,
    title,
    metaTitle,
    metaDescription,
    updatedAt,
    eyebrow,
    answer,
    chips: pillars.slice(0, 5),
    sections: [
      {
        eyebrow: 'Category definition',
        title: `What ${focus} means in practice`,
        paragraphs: [
          `${focus} is the move from isolated AI conversations into a controlled execution layer for real business work. The system has to understand the business context, route work to the right specialist, preserve useful memory, and keep sensitive actions inside reviewable boundaries.`,
          `For Prymal, the category is governed business AI execution. That means specialist agents, LORE-style memory and retrieval, WARDEN safety controls, workflow orchestration, permissions, model routing, and auditability are treated as one operating model rather than disconnected features.`,
        ],
        bullets: pillars,
      },
      {
        eyebrow: 'Why chat alone is not enough',
        title: contrast,
        paragraphs: [
          'Chat-first tools are valuable for drafting, ideation, and quick research. They become weaker when a team needs durable context, repeatable handoffs, policy-aware action, or a record of what happened across a workflow.',
          'Basic workflow automation solves deterministic app-to-app logic well, but many AI workflows depend on changing context, judgment, evidence, and human approval. Prymal is designed for the work between those categories: adaptive AI execution with business controls.',
        ],
        bullets: [
          'Context should persist without forcing teams to re-prompt from scratch.',
          'Specialist work should be routed by role and task, not squeezed through one generic assistant.',
          'Sensitive steps should pause for review instead of becoming blind autonomous action.',
        ],
      },
      {
        eyebrow: 'Prymal architecture',
        title: 'How Prymal turns the category into an operating layer',
        paragraphs: [
          'Prymal combines specialist agents with shared business memory, workflow execution, trust controls, and model routing at a conceptual level. Users see useful workspace behavior; operators get clearer boundaries around context, approvals, and risk.',
          'LORE helps agents retrieve and maintain grounded context. WARDEN screens risky inputs, uploads, URLs, and workflow actions before they become harmful outputs. Workflow rails and audit trails make execution easier to inspect and improve.',
        ],
        bullets: workflows,
      },
      {
        eyebrow: 'Trust model',
        title: 'Why governance belongs inside AI execution from the start',
        paragraphs: [
          'Business AI becomes risky when it can remember, decide, and act without clear controls. Governance is not a decorative compliance layer; it is part of how the product earns trust during daily operation.',
          'A governed execution layer should define who can access which context, which actions require approval, what evidence supports an output, and how the business can review or reverse a risky decision path.',
        ],
        bullets: risks,
      },
    ],
    architectureCards: [
      { eyebrow: 'Memory', title: 'LORE retrieval and context', body: 'Shared context helps agents work from current business knowledge instead of private prompt fragments.', chips: ['Source grounding', 'Freshness', 'Continuity'], accent: '#7cffe0' },
      { eyebrow: 'Safety', title: 'WARDEN trust controls', body: 'Input and action checks reduce prompt injection, unsafe automation, and policy drift before work moves downstream.', chips: ['Prompt risk', 'Uploads', 'Actions'], accent: '#fb7185' },
      { eyebrow: 'Execution', title: 'Workflow orchestration', body: 'Specialist agents can contribute inside multi-step workflows with approvals, replay paths, and audit-ready history.', chips: ['Handoffs', 'Approvals', 'Auditability'], accent: '#4cc9f0' },
    ],
    relatedPages,
    faq: faqs,
  };
}

export const SEO_CATEGORY_PAGES = [
  buildCategoryPage({
    slug: 'ai-operating-system-for-business',
    title: 'AI Operating System for Business Execution',
    metaTitle: 'AI Operating System for Business Execution | Prymal',
    metaDescription: 'Learn how Prymal defines the AI operating system for business: specialist agents, shared memory, workflow execution, governance, WARDEN, LORE, and auditability.',
    eyebrow: 'Core category',
    answer: 'Prymal is an AI operating system for business execution. It combines specialist AI agents, shared business memory, workflow orchestration, trust controls, and safety layers so businesses can move from isolated AI chat to governed execution.',
    focus: 'An AI operating system for business',
    contrast: 'The difference from chatbots and basic workflow automation',
    pillars: ['Specialist AI agents for defined business work', 'Shared business memory that carries context forward', 'Workflow execution for repeatable multi-step processes', 'Trust controls, approvals, and audit trails', 'A controlled execution layer for teams'],
    workflows: ['Route research, writing, operations, and support work to specialist agents.', 'Use LORE-style memory to keep context available across projects and workflows.', 'Use WARDEN-style controls to screen risky inputs and actions.', 'Keep human approval points visible for sensitive work.'],
    risks: ['Unscoped memory can preserve stale or sensitive context.', 'Unreviewed autonomous actions can create operational and reputational risk.', 'Disconnected AI tools make auditability and ownership harder.', 'Model routing should be governed by task, policy, and cost context.'],
    relatedPages: [SEO_RELATED_LINKS.agents, SEO_RELATED_LINKS.memory, SEO_RELATED_LINKS.governed, SEO_RELATED_LINKS.traditional, SEO_RELATED_LINKS.operations, SEO_RELATED_LINKS.home],
    faqs: [
      { question: 'What is an AI operating system for business?', answer: 'It is a coordinated layer for business AI execution: agents, memory, workflows, access controls, approvals, and auditability working together so AI can support real operating processes.' },
      commonFaqs.chatbot,
      commonFaqs.memory,
      commonFaqs.governance,
    ],
  }),
  buildCategoryPage({
    slug: 'ai-agent-orchestration',
    title: 'AI Agent Orchestration for Business Workflows',
    metaTitle: 'AI Agent Orchestration for Business Workflows | Prymal',
    metaDescription: 'Explore AI agent orchestration for business workflows, specialist routing, model selection, LORE memory, WARDEN controls, and governed automation.',
    eyebrow: 'Agent orchestration',
    answer: 'AI agent orchestration coordinates specialist agents, shared context, workflow stages, approvals, and model routing so multi-step business work can move safely beyond one generic chatbot.',
    focus: 'AI agent orchestration',
    contrast: 'Why orchestration beats one generic chatbot',
    pillars: ['Task routing by specialist role', 'Conceptual model selection by job and risk', 'Shared memory for continuity between agents', 'Workflow stages with review points', 'Evidence and audit history for handoffs'],
    workflows: ['Route a campaign from research to strategy, copy, outreach, and review.', 'Send policy-sensitive work through WARDEN before execution.', 'Use LORE context so every agent starts from the same approved facts.', 'Keep model choice behind a governed routing layer rather than exposing raw provider mechanics.'],
    risks: ['Generic assistants can miss role-specific constraints.', 'Agent handoffs can drift without shared context.', 'Unsafe tool use needs policy enforcement and review.', 'A routing layer should remain explainable enough for operator trust.'],
    relatedPages: [SEO_RELATED_LINKS.operating, SEO_RELATED_LINKS.memory, SEO_RELATED_LINKS.workflows, SEO_RELATED_LINKS.lindy, SEO_RELATED_LINKS.zapier, SEO_RELATED_LINKS.home],
    faqs: [
      { question: 'What is AI agent orchestration?', answer: 'AI agent orchestration is the coordination of specialist agents, shared context, workflow steps, approvals, and model routing so business tasks can move through a controlled process.' },
      { question: 'How does model routing work conceptually?', answer: 'A governed platform can route work based on task type, risk, cost, context needs, and output requirements. The buyer does not need raw provider internals to benefit from smarter routing.' },
      commonFaqs.memory,
      commonFaqs.governance,
    ],
  }),
  buildCategoryPage({
    slug: 'shared-business-memory-ai',
    title: 'Shared Business Memory for AI Agents',
    metaTitle: 'Shared Business Memory for AI Agents | Prymal',
    metaDescription: 'Learn why AI agents need shared business memory, LORE-style retrieval, source grounding, freshness controls, and auditability for business execution.',
    eyebrow: 'Business memory',
    answer: 'Shared business memory gives AI agents persistent, reviewable context about the company, projects, preferences, sources, and operating constraints so work does not restart from zero in every chat.',
    focus: 'Shared business memory for AI',
    contrast: 'The risk of disconnected AI tools and private prompt history',
    pillars: ['Persistent context across agents and workflows', 'Source-grounded retrieval through LORE-style memory', 'Freshness, contradiction, and review signals', 'Use-case continuity across operations, sales, support, marketing, and knowledge work', 'Auditability around what context influenced outputs'],
    workflows: ['Keep brand, offer, customer, and project context available to relevant agents.', 'Ground support or sales drafts in approved documents and current policies.', 'Track project memory without polluting permanent company context.', 'Review, update, or remove stale context when the business changes.'],
    risks: ['Private chat history traps knowledge with individuals.', 'Stale context can produce confident but wrong work.', 'Ungoverned memory may retain sensitive or irrelevant material.', 'Source grounding and review controls are essential for trust.'],
    relatedPages: [SEO_RELATED_LINKS.operating, SEO_RELATED_LINKS.agents, SEO_RELATED_LINKS.governed, SEO_RELATED_LINKS.agencies, SEO_RELATED_LINKS.operations, SEO_RELATED_LINKS.home],
    faqs: [
      commonFaqs.memory,
      { question: 'Why do AI agents need persistent business context?', answer: 'Agents need persistent context so they can understand current offers, policies, projects, customer needs, and operating constraints without every user re-explaining the business each time.' },
      { question: 'How does LORE-style memory improve continuity?', answer: 'LORE-style memory combines retrieval and structured business context so agents can ground outputs in relevant, current knowledge instead of relying only on the latest prompt.' },
      commonFaqs.governance,
    ],
  }),
  buildCategoryPage({
    slug: 'governed-ai-agents',
    title: 'Governed AI Agents for Business Execution',
    metaTitle: 'Governed AI Agents for Business Execution | Prymal',
    metaDescription: 'Prymal explains governed AI agents: access controls, permission-aware execution, WARDEN safety, audit trails, guardrails, and human approvals.',
    eyebrow: 'Governed agents',
    answer: 'Governed AI agents are specialist agents that operate with access controls, permission-aware execution, guardrails, human approval points, audit trails, and safety checks before they affect sensitive business work.',
    focus: 'Governed AI agents',
    contrast: 'The difference between governed agents and loose AI automations',
    pillars: ['Access controls around workspace context', 'Permission-aware execution for business actions', 'Guardrails and approval gates for sensitive steps', 'WARDEN-style safety screening', 'Audit trails for review and accountability'],
    workflows: ['Require approval before customer-facing or high-impact actions.', 'Limit each agent to the context and tools needed for its role.', 'Record workflow runs, memory use, and review outcomes.', 'Use safety layers before inputs become outputs or actions.'],
    risks: ['Loose automations can act without enough context or approval.', 'Access boundaries can blur if every agent sees everything.', 'Audit gaps make incident review harder.', 'Human judgment should remain explicit in high-risk workflows.'],
    relatedPages: [SEO_RELATED_LINKS.workflows, SEO_RELATED_LINKS.trust, SEO_RELATED_LINKS.regulated, SEO_RELATED_LINKS.lindy, SEO_RELATED_LINKS.memory, SEO_RELATED_LINKS.home],
    faqs: [
      { question: 'What are governed AI agents?', answer: 'Governed AI agents are AI workers that operate inside clear controls: scoped access, policy enforcement, approvals, safety checks, and audit history.' },
      { question: 'How do businesses control what AI agents can access?', answer: 'Businesses should use server-side permissions, scoped integrations, role-based context, approval gates, and audit logs rather than trusting prompt instructions alone.' },
      commonFaqs.governance,
      commonFaqs.regulated,
    ],
  }),
  buildCategoryPage({
    slug: 'secure-ai-workflows',
    title: 'Secure AI Workflow Automation for Businesses',
    metaTitle: 'Secure AI Workflow Automation for Businesses | Prymal',
    metaDescription: 'Explore secure AI workflow automation for prompt injection, data leakage, unsafe autonomous actions, policy enforcement, output review, and admin visibility.',
    eyebrow: 'Secure workflows',
    answer: 'Secure AI workflow automation combines AI-assisted execution with prompt injection defenses, data boundary controls, policy enforcement, output review, admin visibility, and human approvals for sensitive actions.',
    focus: 'Secure AI workflow automation',
    contrast: 'Why security must be built into AI execution from the start',
    pillars: ['Prompt injection and upload safety controls', 'Data leakage reduction through scoped context', 'Policy enforcement around risky actions', 'Output review and validation before delivery', 'Admin visibility across workflow execution'],
    workflows: ['Screen URLs, uploads, and prompts before they feed an agent.', 'Hold sensitive outputs for human review.', 'Use scoped integrations instead of unrestricted tool access.', 'Preserve run logs and audit context for investigation.'],
    risks: ['Prompt injection can manipulate tools or retrieved context.', 'Data leakage can happen when context is overshared.', 'Unsafe autonomous actions can affect customers, money, or reputation.', 'Security has to cover input, retrieval, generation, and execution together.'],
    relatedPages: [SEO_RELATED_LINKS.governed, SEO_RELATED_LINKS.trust, SEO_RELATED_LINKS.regulated, SEO_RELATED_LINKS.zapier, SEO_RELATED_LINKS.operating, SEO_RELATED_LINKS.home],
    faqs: [
      { question: 'What makes an AI workflow secure?', answer: 'A secure AI workflow scopes data access, screens risky inputs, enforces policy, validates outputs, keeps approvals for sensitive actions, and records enough activity for review.' },
      { question: 'What is prompt injection risk?', answer: 'Prompt injection is when malicious or untrusted instructions try to override the intended behavior of an AI system, especially through user input, files, web pages, or retrieved content.' },
      commonFaqs.integrations,
      commonFaqs.regulated,
    ],
  }),
];

function buildUseCasePage({
  slug,
  title,
  metaTitle,
  metaDescription,
  answer,
  audience,
  problem,
  genericRisk,
  help,
  workflows,
  governance,
  roi,
  relatedPages,
}) {
  return {
    kind: 'use-case',
    slug,
    path: `/use-cases/${slug}`,
    title,
    metaTitle,
    metaDescription,
    updatedAt,
    eyebrow: `Use case for ${audience}`,
    answer,
    chips: ['Business problem', 'Governance', 'Example workflows', 'ROI lens'],
    sections: [
      { eyebrow: 'Business problem', title: `Why ${audience} need more than isolated AI chat`, paragraphs: [problem, genericRisk], bullets: ['Context changes between tasks and people.', 'Customer-facing work needs review and source grounding.', 'Recurring workflows need repeatable operating paths, not fresh prompts every time.'] },
      { eyebrow: 'How Prymal helps', title: 'Governed business AI execution for this operating lane', paragraphs: [help], bullets: ['Specialist agents work from shared business memory.', 'LORE-style context improves continuity across projects.', 'WARDEN-style controls and approvals keep sensitive actions bounded.'] },
      { eyebrow: 'Example workflows', title: 'Workflows a team can pilot first', paragraphs: ['The best pilot is narrow, recurring, and easy to review. Pick one workflow where context is expensive to rebuild and where a human approval point can protect quality while the team learns.'], bullets: workflows },
      { eyebrow: 'Governance and safety', title: 'Controls that keep the workflow credible', paragraphs: [governance], bullets: ['Use permission-aware access to context and systems.', 'Hold high-impact outputs for review.', 'Keep audit history for workflow runs, approvals, and source context.'] },
      { eyebrow: 'ROI angle', title: 'How to think about return without fake statistics', paragraphs: [roi], bullets: ['Measure repeated setup time removed.', 'Track cycle-time reduction on one workflow.', 'Compare output quality and review load before expanding.'] },
    ],
    architectureCards: [
      { eyebrow: 'Workflow', title: workflows[0], body: 'Start with a narrow path that has clear inputs, outputs, and approval criteria.', chips: ['Pilot', 'Review', 'Repeat'], accent: '#7cffe0' },
      { eyebrow: 'Governance', title: 'Permission-aware execution', body: 'Keep the agent close to the relevant context and hold sensitive actions before delivery.', chips: ['Access', 'Approval', 'Audit'], accent: '#fb7185' },
      { eyebrow: 'Memory', title: 'Shared context continuity', body: 'Use durable business memory so the next run starts from current facts rather than stale prompt fragments.', chips: ['LORE', 'Sources', 'Freshness'], accent: '#4cc9f0' },
    ],
    relatedPages,
    faq: [
      { question: `How can ${audience} use AI agents safely?`, answer: `${audience} should start with scoped workflows, source-grounded context, human approval points, and clear access controls before allowing AI into higher-risk actions.` },
      commonFaqs.chatbot,
      commonFaqs.memory,
      commonFaqs.cost,
    ],
  };
}

export const SEO_USE_CASE_PAGES = [
  buildUseCasePage({
    slug: 'ai-for-recruitment-agencies',
    title: 'AI for Recruitment Agencies',
    metaTitle: 'AI for Recruitment Agencies | Governed Agent Workflows | Prymal',
    metaDescription: 'Use Prymal for recruitment agency AI workflows: candidate outreach prep, client briefs, role intake, screening support, compliance review, and governed automation.',
    answer: 'Prymal helps recruitment agencies use AI for role intake, candidate outreach preparation, client updates, shortlist summaries, and governed workflow execution without turning sensitive hiring work into unchecked automation.',
    audience: 'recruitment agencies',
    problem: 'Recruitment teams run on changing role requirements, candidate context, client preferences, compliance expectations, and fast follow-up. That context often lives across inboxes, notes, ATS records, and private prompts.',
    genericRisk: 'Generic AI tools can help draft messages, but they rarely provide shared business memory, approval gates, audit history, or permission-aware execution around sensitive candidate and client information.',
    help: 'Prymal is designed to coordinate specialist agents around shared context while keeping human review at the point where judgment, fairness, or client trust matters.',
    workflows: ['Role intake summary from approved notes and client criteria.', 'Candidate outreach draft held for recruiter approval.', 'Shortlist briefing with source notes and uncertainty flags.', 'Client update cadence for open roles and pipeline blockers.'],
    governance: 'Recruitment AI should avoid hidden screening decisions, preserve human accountability, and keep sensitive candidate data inside scoped, reviewable workflows.',
    roi: 'The return comes from less repeated briefing, faster client communication, and cleaner recruiter preparation while keeping final candidate judgment human-owned.',
    relatedPages: [SEO_RELATED_LINKS.governed, SEO_RELATED_LINKS.memory, SEO_RELATED_LINKS.workflows, SEO_RELATED_LINKS.traditional, SEO_RELATED_LINKS.home],
  }),
  buildUseCasePage({
    slug: 'ai-for-marketing-agencies',
    title: 'AI for Marketing Agencies',
    metaTitle: 'AI for Marketing Agencies | Shared Memory and Workflows | Prymal',
    metaDescription: 'Prymal for marketing agencies: governed AI agents for client context, content systems, reporting, campaign workflows, approvals, and delivery operations.',
    answer: 'Prymal helps marketing agencies coordinate AI agents across client memory, campaign planning, content production, reporting, outreach, approvals, and delivery workflows.',
    audience: 'marketing agencies',
    problem: 'Agency margin is often lost in repeated setup: client briefs, brand voice, reporting narratives, content repurposing, approvals, and follow-up. The same context gets rebuilt across teams and tools.',
    genericRisk: 'Generic AI can write drafts, but private prompt threads do not create a client delivery system. Without shared memory and approvals, quality drifts as volume rises.',
    help: 'Prymal gives agencies a governed execution layer where specialist agents use shared client context and workflow stages to prepare work that humans can review and ship.',
    workflows: ['Client content brief to multi-channel draft pack.', 'Monthly reporting narrative with next-step recommendations.', 'Campaign launch workflow across research, copy, social, and client update.', 'Approval-ready client communication drafts.'],
    governance: 'Agencies should keep client-facing outputs reviewable, preserve source context, and avoid letting automation flatten strategy, taste, or relationship ownership.',
    roi: 'The ROI lens is recovered senior time, less rework, and more consistent delivery across retained clients without claiming that AI replaces creative judgment.',
    relatedPages: [SEO_RELATED_LINKS.agencies, SEO_RELATED_LINKS.memory, SEO_RELATED_LINKS.agents, SEO_RELATED_LINKS.lindy, SEO_RELATED_LINKS.home],
  }),
  buildUseCasePage({
    slug: 'ai-for-operations-teams',
    title: 'AI for Operations Teams',
    metaTitle: 'AI for Operations Teams | Governed Workflow Execution | Prymal',
    metaDescription: 'Use Prymal for operations team AI workflows: recurring reports, SOP support, cross-functional handoffs, approvals, memory, and secure workflow automation.',
    answer: 'Prymal helps operations teams turn recurring coordination, reporting, SOP support, and cross-functional follow-through into governed AI workflows with memory, approvals, and auditability.',
    audience: 'operations teams',
    problem: 'Operations teams absorb ambiguity from every function: status updates, handoffs, SOPs, reporting, vendor notes, and exceptions. AI only helps if it can preserve context across recurring work.',
    genericRisk: 'A generic assistant may create a summary, but it cannot reliably govern who sees what, what gets approved, or how a recurring process should be reviewed and improved.',
    help: 'Prymal lets operators design narrow workflow lanes where specialist agents prepare the work, LORE carries context, and approvals protect sensitive or policy-heavy actions.',
    workflows: ['Weekly operating review assembled from approved inputs.', 'SOP draft and update workflow with owner approval.', 'Cross-functional dependency tracker summary.', 'Vendor or customer issue briefing before escalation.'],
    governance: 'Operations AI should keep ownership visible, preserve run history, and separate low-risk drafting from actions that change commitments or policy.',
    roi: 'Return is best measured as reduced coordination drag, faster preparation for operating meetings, and fewer repeated status-gathering cycles.',
    relatedPages: [SEO_RELATED_LINKS.operating, SEO_RELATED_LINKS.workflows, SEO_RELATED_LINKS.governed, SEO_RELATED_LINKS.traditional, SEO_RELATED_LINKS.home],
  }),
  buildUseCasePage({
    slug: 'ai-for-professional-services',
    title: 'AI for Professional Services',
    metaTitle: 'AI for Professional Services | Governed Business AI | Prymal',
    metaDescription: 'Prymal for professional services teams: shared client memory, research preparation, proposal workflows, reporting, review boundaries, and governed AI execution.',
    answer: 'Prymal helps professional services teams prepare research, proposals, client updates, delivery summaries, and internal workflows from shared context while keeping expert review in control.',
    audience: 'professional services teams',
    problem: 'Consultancies, advisors, and service firms depend on trust, context, and judgment. Work often requires assembling prior notes, client preferences, deliverables, risks, and next steps before any useful output can be drafted.',
    genericRisk: 'Generic AI tools can produce polished text but may lack grounded client memory, evidence handling, permissions, and approval paths for sensitive professional work.',
    help: 'Prymal supports governed preparation: agents retrieve relevant context, structure the work, and hold outputs for human review before they become client-facing.',
    workflows: ['Proposal skeleton from approved service and client context.', 'Client meeting preparation with source-grounded notes.', 'Delivery recap and next-step summary.', 'Knowledge base update reviewed by a practice lead.'],
    governance: 'Professional services AI should assist preparation without pretending to replace expert advice, professional judgment, or regulated obligations.',
    roi: 'The practical return is faster preparation, more consistent client communication, and less repeated knowledge retrieval across engagements.',
    relatedPages: [SEO_RELATED_LINKS.memory, SEO_RELATED_LINKS.governed, SEO_RELATED_LINKS.regulated, SEO_RELATED_LINKS.operating, SEO_RELATED_LINKS.home],
  }),
  buildUseCasePage({
    slug: 'ai-for-regulated-industries',
    title: 'AI for Regulated Industries',
    metaTitle: 'AI for Regulated Industries | Governed AI Workflows | Prymal',
    metaDescription: 'Explore governed AI workflows for regulated industries: access controls, audit trails, approvals, source grounding, WARDEN safety, and secure AI operations.',
    answer: 'Prymal is designed for teams that need AI workflows with access controls, audit trails, source grounding, human approvals, WARDEN-style safety checks, and careful readiness language.',
    audience: 'regulated industries',
    problem: 'Regulated teams cannot adopt AI on enthusiasm alone. They need clarity around data access, review obligations, policy boundaries, audit history, and where human accountability remains.',
    genericRisk: 'Loose AI automations can create unacceptable ambiguity: who approved an output, what source was used, what context was exposed, and whether a risky action should have been blocked.',
    help: 'Prymal positions AI as a controlled execution layer, with memory, workflows, safety checks, approvals, and audit-ready operating patterns rather than unchecked autonomous behavior.',
    workflows: ['Policy-grounded draft with evidence notes and human review.', 'Controlled knowledge retrieval for internal support.', 'Exception briefing before escalation.', 'Workflow run log reviewed by an operator or compliance owner.'],
    governance: 'Regulated teams should validate their own requirements, keep sensitive steps behind approvals, and avoid vendor claims that outpace actual certifications or controls.',
    roi: 'The return is not only speed. It is controlled throughput: fewer manual context hunts, better review preparation, and a clearer operating record.',
    relatedPages: [SEO_RELATED_LINKS.governed, SEO_RELATED_LINKS.workflows, SEO_RELATED_LINKS.trust, SEO_RELATED_LINKS.memory, SEO_RELATED_LINKS.home],
  }),
  buildUseCasePage({
    slug: 'ai-for-smes',
    title: 'AI for SMEs',
    metaTitle: 'AI for SMEs | AI Automation Platform for Small Business | Prymal',
    metaDescription: 'Prymal helps SMEs use governed AI agents for operations, sales, marketing, support, knowledge, workflows, shared memory, and secure automation.',
    answer: 'Prymal helps SMEs move beyond scattered AI prompts by giving small teams specialist agents, shared business memory, workflow automation, and trust controls in one governed workspace.',
    audience: 'SMEs',
    problem: 'Small and medium-sized businesses need leverage without building an internal AI engineering team. The challenge is turning AI into repeatable sales, marketing, operations, support, and admin workflows.',
    genericRisk: 'Generic tools often create prompt sprawl. Context sits with individuals, outputs vary by user, and recurring work still depends on manual setup.',
    help: 'Prymal gives SMEs a clearer operating layer: shared memory, role-based agents, workflow paths, and controls that fit practical business execution.',
    workflows: ['Lead follow-up and nurture draft workflow.', 'Weekly owner summary from current projects and notes.', 'Support reply preparation from approved knowledge.', 'Content and outreach workflow from one shared business brief.'],
    governance: 'SMEs still need careful boundaries: customer-facing sends, pricing promises, financial decisions, and policy changes should remain reviewable.',
    roi: 'The ROI angle is time recovered from repeated setup, better follow-through, and fewer dropped tasks across a lean team.',
    relatedPages: [SEO_RELATED_LINKS.operating, SEO_RELATED_LINKS.agents, SEO_RELATED_LINKS.memory, SEO_RELATED_LINKS.zapier, SEO_RELATED_LINKS.home],
  }),
];

export const SEO_USE_CASE_HUB_PAGE = {
  kind: 'use-case-hub',
  slug: 'use-cases',
  path: '/use-cases',
  title: 'AI Use Cases for Governed Business Execution',
  metaTitle: 'AI Use Cases for Business Execution | Prymal',
  metaDescription: 'Explore Prymal use cases for recruitment agencies, marketing agencies, operations teams, professional services, regulated industries, and SMEs.',
  updatedAt,
  eyebrow: 'Use cases',
  answer: 'Prymal use cases focus on governed business AI execution: specialist agents, shared business memory, secure workflows, approvals, and audit-ready operating patterns for real teams.',
  chips: ['Recruitment', 'Agencies', 'Operations', 'Professional services', 'Regulated teams', 'SMEs'],
  sections: [
    { eyebrow: 'Selection guide', title: 'Start where context repeats and review matters', paragraphs: ['The best Prymal use case is recurring, context-heavy, and easy to review. Teams should start with one workflow where shared memory reduces repeated setup and approval gates protect customer-facing or sensitive work.'], bullets: ['Pick a narrow workflow.', 'Define source context and approval ownership.', 'Measure saved setup time and review quality before expanding.'] },
  ],
  architectureCards: [],
  relatedPages: [
    link('AI for recruitment agencies', '/use-cases/ai-for-recruitment-agencies', 'Role intake, outreach prep, shortlist summaries, and client updates.'),
    link('AI for marketing agencies', '/use-cases/ai-for-marketing-agencies', 'Client memory, campaign workflows, reporting, content, and approvals.'),
    link('AI for operations teams', '/use-cases/ai-for-operations-teams', 'Recurring reports, SOP support, handoffs, and operating reviews.'),
    link('AI for professional services', '/use-cases/ai-for-professional-services', 'Research prep, proposals, client updates, and knowledge workflows.'),
    link('AI for regulated industries', '/use-cases/ai-for-regulated-industries', 'Access controls, audit trails, approvals, and source-grounded AI work.'),
    link('AI for SMEs', '/use-cases/ai-for-smes', 'Small-business execution across sales, marketing, support, admin, and operations.'),
  ],
  faq: [commonFaqs.chatbot, commonFaqs.memory, commonFaqs.governance, commonFaqs.cost],
};

export const SEO_ARCHITECTURE_PAGE = {
  kind: 'architecture',
  slug: 'architecture',
  path: '/architecture',
  title: 'Prymal Architecture',
  metaTitle: 'Prymal Architecture | LORE, WARDEN, Agents, Workflows, and Routing',
  metaDescription: 'A public architecture overview of Prymal: LORE business memory, WARDEN safety controls, specialist agents, workflow rails, model routing, approvals, and auditability.',
  updatedAt,
  eyebrow: 'Architecture',
  answer: 'Prymal combines LORE business memory, WARDEN safety controls, specialist agents, workflow rails, model routing, approvals, and auditability to create a governed business AI execution layer.',
  chips: ['LORE', 'WARDEN', 'Specialist agents', 'Workflow rails', 'Model routing'],
  sections: [
    { eyebrow: 'System view', title: 'The governed execution layer', paragraphs: ['Prymal is designed around controlled AI execution rather than one chat surface. The architecture combines memory, agents, workflows, routing, and safety controls so business work can move through repeatable paths.'], bullets: ['LORE grounds work in shared business context.', 'WARDEN screens risky inputs, uploads, URLs, and actions.', 'Workflow rails keep handoffs, approvals, and audit history visible.'] },
    { eyebrow: 'Routing', title: 'Model routing stays a governed product concern', paragraphs: ['At a conceptual level, model routing should match task, risk, cost, and output requirements. Prymal can explain this as product behavior without exposing internal provider mechanics or implying arbitrary provider guarantees.'], bullets: ['Route by work type and risk.', 'Keep sensitive steps behind policy and approval.', 'Expose useful confidence signals without leaking internals.'] },
  ],
  architectureCards: [
    { eyebrow: 'LORE', title: 'Business memory and retrieval', body: 'Context, evidence, and source grounding help agents work from the real state of the business.', chips: ['Memory', 'Sources', 'Freshness'], accent: '#7cffe0' },
    { eyebrow: 'WARDEN', title: 'Input and action safety', body: 'Risk checks help prevent unsafe instructions and automation from flowing into downstream work.', chips: ['Injection', 'Uploads', 'Actions'], accent: '#fb7185' },
    { eyebrow: 'Execution', title: 'Workflow rails', body: 'Approvals, replay paths, and audit history help teams govern repeatable business workflows.', chips: ['Approvals', 'Audit', 'Replay'], accent: '#4cc9f0' },
  ],
  relatedPages: [SEO_RELATED_LINKS.operating, SEO_RELATED_LINKS.agents, SEO_RELATED_LINKS.memory, SEO_RELATED_LINKS.governed, SEO_RELATED_LINKS.trust],
  faq: [commonFaqs.memory, commonFaqs.governance, commonFaqs.integrations],
};

export const SEO_GLOSSARY_PAGE = {
  kind: 'glossary',
  slug: 'glossary',
  path: '/glossary',
  title: 'Business AI Glossary',
  metaTitle: 'Business AI Glossary | Prymal',
  metaDescription: 'Definitions for AI agent orchestration, shared business memory, governed AI agents, workflow execution, prompt injection, AI access controls, retrieval trust, and business AI operating systems.',
  updatedAt,
  eyebrow: 'Glossary',
  answer: 'This glossary defines the core language of governed business AI execution: orchestration, shared memory, governed agents, workflow execution, prompt injection, access controls, retrieval trust, and AI operating systems.',
  chips: ['Definitions', 'Answer engine friendly', 'Business AI'],
  terms: [
    { term: 'AI agent orchestration', definition: 'The coordination of specialist agents, context, workflow stages, approvals, and routing so a business task moves through a controlled process.' },
    { term: 'Shared business memory', definition: 'Persistent, reviewable context that AI agents use across sessions, projects, and workflows.' },
    { term: 'Governed AI agents', definition: 'AI agents that operate with access controls, approval gates, safety checks, and audit history.' },
    { term: 'Workflow execution', definition: 'The process of moving work through defined steps, handoffs, approvals, and outputs rather than relying on one-off prompts.' },
    { term: 'Prompt injection', definition: 'An attack or failure mode where untrusted instructions try to override the intended behavior of an AI system.' },
    { term: 'AI access controls', definition: 'Policies and permissions that determine what context, tools, workflows, and actions an AI agent can use.' },
    { term: 'Retrieval trust', definition: 'The confidence that retrieved context is relevant, current, source-grounded, and appropriate for the task.' },
    { term: 'Business AI operating system', definition: 'A coordinated execution layer that combines AI agents, memory, workflows, governance, and auditability for business work.' },
  ],
  sections: [],
  architectureCards: [],
  relatedPages: [SEO_RELATED_LINKS.operating, SEO_RELATED_LINKS.agents, SEO_RELATED_LINKS.memory, SEO_RELATED_LINKS.governed, SEO_RELATED_LINKS.workflows],
  faq: [commonFaqs.chatbot, commonFaqs.memory, commonFaqs.governance],
};

export const SEO_GROWTH_PAGES = [
  ...SEO_CATEGORY_PAGES,
  SEO_USE_CASE_HUB_PAGE,
  ...SEO_USE_CASE_PAGES,
  SEO_ARCHITECTURE_PAGE,
  SEO_GLOSSARY_PAGE,
];

export function getSeoCategoryPageBySlug(slug) {
  return SEO_CATEGORY_PAGES.find((page) => page.slug === slug) ?? null;
}

export function getSeoPageByPath(path) {
  return SEO_GROWTH_PAGES.find((page) => page.path === path) ?? null;
}

export function getSeoUseCasePageBySlug(slug) {
  return SEO_USE_CASE_PAGES.find((page) => page.slug === slug) ?? null;
}

export function getSeoGrowthRoutes() {
  return SEO_GROWTH_PAGES.map((page) => ({
    path: page.path,
    changefreq: page.kind === 'glossary' ? 'monthly' : 'weekly',
    priority: page.kind === 'use-case' ? '0.82' : '0.86',
    lastmod: page.updatedAt,
  }));
}

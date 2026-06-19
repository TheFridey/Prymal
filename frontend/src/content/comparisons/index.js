import {
  SITE_NAME,
  buildBreadcrumbSchema,
  buildFaqPageSchema,
  buildSchemaGraph,
  buildWebPageSchema,
  urlForPath,
} from '../../lib/seo.js';

export const COMPARISON_CONTENT_UPDATED_AT = '2026-06-19';
export const COMPARISON_HUB_PATH = '/compare';

/**
 * @typedef {{ label: string, prymal: string, alternative: string }} GeneratedComparisonRow
 * @typedef {{ label: string, prymal: string, alternative: string, sourceUrl?: string }} GeneratedPricingRow
 * @typedef {{ question: string, answer: string }} GeneratedComparisonFaq
 * @typedef {{
 *   slug: string,
 *   alternative: string,
 *   category: string,
 *   sourceUrl: string,
 *   sourceLabel: string,
 *   title: string,
 *   metaTitle: string,
 *   metaDescription: string,
 *   intro: string,
 *   answer: string,
 *   idealPrymalCustomer: string,
 *   idealAlternativeCustomer: string,
 *   featureRows: GeneratedComparisonRow[],
 *   pricingRows: GeneratedPricingRow[],
 *   prymalPros: string[],
 *   prymalCons: string[],
 *   alternativePros: string[],
 *   alternativeCons: string[],
 *   faq: GeneratedComparisonFaq[],
 *   relatedLinks: { title: string, to: string, description: string, cta?: string }[],
 * }} GeneratedComparisonPage
 */

const COMMON_RELATED_LINKS = [
  {
    title: 'AI operating system for business',
    to: '/ai-operating-system-for-business',
    description: 'Understand the Prymal category: agents, memory, workflows, and trust controls in one operating layer.',
    cta: 'Read guide ->',
  },
  {
    title: 'Workflow automation',
    to: '/features/ai-workflow-automation',
    description: 'See how Prymal turns recurring work into governed, memory-aware workflow execution.',
    cta: 'Explore feature ->',
  },
  {
    title: 'Trust Centre',
    to: '/trust',
    description: 'Review Prymal readiness language, trust posture, and product honesty boundaries.',
    cta: 'Review trust ->',
  },
];

const BASE_FEATURES = {
  memory: {
    label: 'Shared business memory',
    prymal: 'LORE is positioned as shared business memory for approved organisation, project, and agent context.',
  },
  workflow: {
    label: 'Workflow execution',
    prymal: 'Prymal is built around repeatable workflows, specialist agents, review steps, and operating handoffs.',
  },
  governance: {
    label: 'Governance and review',
    prymal: 'Prymal keeps approvals, validation, and trust-sensitive review visible for business workflows.',
  },
  audience: {
    label: 'Primary buyer',
    prymal: 'Business operators, founders, agencies, and teams that need governed execution rather than one-off AI answers.',
  },
  setup: {
    label: 'Implementation style',
    prymal: 'Productized workspace with guided agents, memory, and workflow templates.',
  },
};

function row(key, alternative) {
  return { ...BASE_FEATURES[key], alternative };
}

function pricingRow(label, alternative, sourceUrl) {
  return {
    label,
    prymal: 'Prymal pricing should be checked on the Prymal pricing page because plans, credits, and launch offers may change.',
    alternative,
    sourceUrl,
  };
}

function faqFor(alternative, category) {
  return [
    {
      question: `Is Prymal a ${alternative} alternative?`,
      answer: `Prymal can be an alternative when the buying job is governed business execution. ${alternative} may be a better fit when the team mainly needs the specific ${category.toLowerCase()} workflow it is known for.`,
    },
    {
      question: `What is the biggest difference between Prymal and ${alternative}?`,
      answer: 'Prymal is positioned around shared business memory, specialist agents, workflow execution, and trust controls. The alternative category may focus more on chat, docs, automation, CRM, or developer infrastructure.',
    },
    {
      question: 'How should pricing be compared?',
      answer: 'Compare pricing by workflow outcome, not only by seat cost. Include user seats, credits, task volume, model/API usage, implementation time, review effort, and whether the tool replaces multiple separate systems.',
    },
    {
      question: 'Does Prymal remove the need for human review?',
      answer: 'No. Prymal is designed for reviewable execution. Sensitive outputs, external communications, commercial claims, and regulated work should keep a clear human owner.',
    },
  ];
}

function buildComparison(definition) {
  return {
    ...definition,
    title: `Prymal vs ${definition.alternative}`,
    metaTitle: `Prymal vs ${definition.alternative} | AI workflow comparison`,
    metaDescription: `Compare Prymal and ${definition.alternative} across features, pricing model, pros, cons, ideal customer, FAQ, structured data, and business AI workflow fit.`,
    intro: `This generated comparison helps buyers evaluate Prymal against ${definition.alternative} without hostile claims. Use it to compare category fit, feature coverage, pricing model, strengths, limitations, and the type of customer each option serves best.`,
    answer: `Choose Prymal when you need an AI operating system for business execution: shared memory, specialist agents, repeatable workflows, and review controls. Choose ${definition.alternative} when its ${definition.category.toLowerCase()} focus is closer to the job you need done.`,
    faq: faqFor(definition.alternative, definition.category),
    relatedLinks: COMMON_RELATED_LINKS,
  };
}

export const GENERATED_COMPARISON_PAGES = [
  buildComparison({
    slug: 'prymal-vs-chatgpt',
    alternative: 'ChatGPT',
    category: 'General AI chat and productivity',
    sourceUrl: 'https://chatgpt.com/pricing/',
    sourceLabel: 'ChatGPT pricing',
    idealPrymalCustomer: 'Teams that want AI work to persist across projects, agents, memory, workflows, and approvals.',
    idealAlternativeCustomer: 'Individuals or teams that mainly need broad conversational AI, drafting, analysis, and exploratory reasoning.',
    featureRows: [
      row('memory', 'ChatGPT includes conversation and memory features, but the buyer should evaluate whether they map to shared, workflow-level business memory.'),
      row('workflow', 'ChatGPT is strongest as a general AI workspace; repeatable business workflows usually require additional process design.'),
      row('governance', 'Business and enterprise controls vary by plan; review requirements should be checked against current OpenAI documentation.'),
      row('audience', 'Knowledge workers and teams that want a broad AI assistant for writing, analysis, coding, and research.'),
      row('setup', 'Fast to start as a chat product, with additional configuration needed for repeatable business operating workflows.'),
    ],
    pricingRows: [
      pricingRow('Pricing model', 'ChatGPT publishes individual, business, and enterprise plans with per-user plan structures and enterprise options.', 'https://chatgpt.com/pricing/'),
      pricingRow('Cost driver', 'Cost is typically driven by plan tier, seats, usage limits, and enterprise requirements.', 'https://openai.com/business/chatgpt-pricing/'),
    ],
    prymalPros: ['Business workflow orientation.', 'Shared memory and specialist agents in one workspace.', 'Review-first positioning for recurring work.'],
    prymalCons: ['Less ideal for casual one-off chat.', 'Requires teams to define workflows and review owners.'],
    alternativePros: ['Very broad general-purpose AI assistant.', 'Fast individual adoption.', 'Strong drafting, analysis, and coding use cases.'],
    alternativeCons: ['May need extra process tooling for governed repeatable workflows.', 'Shared operating memory and approvals may not match Prymal-style workflow needs.'],
  }),
  buildComparison({
    slug: 'prymal-vs-claude',
    alternative: 'Claude',
    category: 'AI assistant and reasoning workspace',
    sourceUrl: 'https://claude.com/pricing',
    sourceLabel: 'Claude pricing',
    idealPrymalCustomer: 'Teams that want AI outputs connected to operating context, recurring workflows, and review gates.',
    idealAlternativeCustomer: 'Users who value a strong assistant for writing, analysis, coding, long-context work, and conversational reasoning.',
    featureRows: [
      row('memory', 'Claude is a powerful assistant experience; teams should assess how project context maps to shared organisation-wide workflow memory.'),
      row('workflow', 'Claude can support work inside conversation and projects, while Prymal focuses on repeatable business execution paths.'),
      row('governance', 'Claude offers plan-dependent controls; Prymal keeps governance language attached to workflow execution and output review.'),
      row('audience', 'Individuals and teams that need high-quality AI assistance for thinking, writing, and analysis.'),
      row('setup', 'Quick assistant adoption with additional operational design required for repeated cross-team workflows.'),
    ],
    pricingRows: [
      pricingRow('Pricing model', 'Claude publishes Free, Pro, Max, Team, Enterprise, and API-oriented pricing information.', 'https://claude.com/pricing'),
      pricingRow('Cost driver', 'Cost depends on plan tier, seats, capacity, and API/model usage where relevant.', 'https://support.claude.com/en/articles/11049762-choose-a-claude-plan'),
    ],
    prymalPros: ['Built for repeatable business workflows.', 'Keeps specialist agents, memory, and validation together.', 'Clearer fit for operator-led execution.'],
    prymalCons: ['Not intended to be only a broad individual assistant.', 'Workflow value depends on process definition.'],
    alternativePros: ['Strong general assistant quality.', 'Good fit for writing, analysis, coding, and long-context tasks.', 'Fast to adopt for individual productivity.'],
    alternativeCons: ['May require additional systems for business workflow orchestration.', 'Operating memory and approvals need careful evaluation by plan and setup.'],
  }),
  buildComparison({
    slug: 'prymal-vs-gemini',
    alternative: 'Gemini',
    category: 'Google AI assistant and ecosystem',
    sourceUrl: 'https://gemini.google/subscriptions/',
    sourceLabel: 'Gemini subscriptions',
    idealPrymalCustomer: 'Teams that want business AI workflows independent of a single productivity-suite assistant surface.',
    idealAlternativeCustomer: 'Teams already deep in Google apps that want Gemini features across Google products and Gemini subscriptions.',
    featureRows: [
      row('memory', 'Gemini can connect with Google ecosystem context depending on product and plan; Prymal focuses on approved business memory for workflows.'),
      row('workflow', 'Gemini is strong inside Google AI experiences; Prymal is centered on business workflow execution with specialist agents.'),
      row('governance', 'Google plans and enterprise controls should be reviewed directly; Prymal frames governance around workflow review and validation.'),
      row('audience', 'Google Workspace and Gemini users who want assistant capabilities inside Google tools.'),
      row('setup', 'Best when the existing work already lives inside Google surfaces; Prymal is broader as an operating workspace.'),
    ],
    pricingRows: [
      pricingRow('Pricing model', 'Gemini pricing can include Google AI subscription plans and separate developer API pricing depending on use case.', 'https://gemini.google/subscriptions/'),
      pricingRow('Cost driver', 'Cost may depend on subscription tier, Workspace setup, API usage, grounding, and model choices.', 'https://ai.google.dev/gemini-api/docs/pricing'),
    ],
    prymalPros: ['Business operating layer not limited to Google surfaces.', 'Reusable workflows with agent roles and review gates.', 'Clear positioning for shared business memory.'],
    prymalCons: ['Not a replacement for native Google app AI features.', 'May add another workspace if the team only wants Google-native assistance.'],
    alternativePros: ['Strong fit for Google ecosystem users.', 'Broad assistant and multimodal capabilities.', 'Developer API options for custom builds.'],
    alternativeCons: ['May require separate workflow tooling for cross-system business execution.', 'Pricing and capabilities can differ across consumer, Workspace, and API surfaces.'],
  }),
  buildComparison({
    slug: 'prymal-vs-notion-ai',
    alternative: 'Notion AI',
    category: 'Workspace AI and knowledge docs',
    sourceUrl: 'https://www.notion.com/pricing',
    sourceLabel: 'Notion pricing',
    idealPrymalCustomer: 'Teams that need AI agents to execute workflows across business functions, not only assist inside docs and databases.',
    idealAlternativeCustomer: 'Teams that live in Notion and want AI assistance for documents, databases, notes, and workspace knowledge.',
    featureRows: [
      row('memory', 'Notion AI works around Notion workspace knowledge; Prymal focuses on LORE memory for agent workflows and business execution.'),
      row('workflow', 'Notion is strong for docs and structured workspace content; Prymal focuses on agents and workflow execution.'),
      row('governance', 'Notion workspace permissions matter; Prymal positions review and validation around outputs and workflows.'),
      row('audience', 'Teams using Notion as their workspace, wiki, project docs, and knowledge base.'),
      row('setup', 'Best when the source of truth is already in Notion; Prymal is built as a dedicated AI operating system.'),
    ],
    pricingRows: [
      pricingRow('Pricing model', 'Notion pricing includes workspace plans and AI/agent credit-based options that should be checked on the current pricing page.', 'https://www.notion.com/pricing'),
      pricingRow('Cost driver', 'Cost depends on workspace plan, seats, AI capabilities, and credit usage for agent features.', 'https://www.notion.com/product/ai'),
    ],
    prymalPros: ['Better fit for cross-functional AI execution.', 'Specialist agents and workflows are central.', 'Review controls are explicit in the buyer story.'],
    prymalCons: ['Not a general replacement for Notion docs/databases.', 'Requires separate operating setup if Notion is already the full workspace.'],
    alternativePros: ['Excellent fit for Notion-native documentation and knowledge.', 'AI sits close to notes, pages, and databases.', 'Strong workspace adoption path.'],
    alternativeCons: ['May be less suited to multi-agent execution outside the Notion workspace.', 'Workflow governance beyond docs may require additional tools.'],
  }),
  buildComparison({
    slug: 'prymal-vs-clickup-ai',
    alternative: 'ClickUp AI',
    category: 'Work management AI',
    sourceUrl: 'https://clickup.com/brain/pricing',
    sourceLabel: 'ClickUp Brain pricing',
    idealPrymalCustomer: 'Teams that want AI execution across agents, memory, content, sales, support, and workflows beyond task management.',
    idealAlternativeCustomer: 'Teams already using ClickUp for tasks, docs, projects, and work management who want AI inside that system.',
    featureRows: [
      row('memory', 'ClickUp Brain can use ClickUp workspace context; Prymal focuses on approved business memory across AI workflow execution.'),
      row('workflow', 'ClickUp is project/work management first; Prymal is AI operating system first.'),
      row('governance', 'ClickUp controls map to its workspace and add-ons; Prymal frames governance around agent outputs and workflow review.'),
      row('audience', 'Teams that run work inside ClickUp and want AI over tasks, docs, and projects.'),
      row('setup', 'Best when ClickUp is already the operational system; Prymal is a dedicated AI execution layer.'),
    ],
    pricingRows: [
      pricingRow('Pricing model', 'ClickUp Brain pricing is published as AI add-on/plan pricing and should be checked directly.', 'https://clickup.com/brain/pricing'),
      pricingRow('Cost driver', 'Cost may depend on seats, AI plan choice, credits, and ClickUp workspace plan.', 'https://clickup.com/pricing'),
    ],
    prymalPros: ['AI execution is the core product lens.', 'Useful when work spans sales, content, support, and operations.', 'Shared memory and validation are not limited to task objects.'],
    prymalCons: ['Does not replace a mature task/project management system.', 'Teams must connect Prymal workflows to their operating habits.'],
    alternativePros: ['Strong for ClickUp-native tasks, docs, and project work.', 'AI close to project management context.', 'Good fit for existing ClickUp teams.'],
    alternativeCons: ['May be less compelling if the team does not run work in ClickUp.', 'AI execution beyond work management may need separate tools.'],
  }),
  buildComparison({
    slug: 'prymal-vs-sintra',
    alternative: 'Sintra',
    category: 'AI helpers for business tasks',
    sourceUrl: 'https://sintra.ai/pricing',
    sourceLabel: 'Sintra pricing',
    idealPrymalCustomer: 'Teams that want a governed AI operating system with memory, workflows, validation, and specialist agents.',
    idealAlternativeCustomer: 'Small teams that want approachable AI helpers for clear business tasks and a helper-based experience.',
    featureRows: [
      row('memory', 'Sintra is helper-oriented; buyers should evaluate how helper memory compares with shared business memory and workflow context.'),
      row('workflow', 'Sintra emphasizes AI helpers; Prymal emphasizes governed workflow execution across agents and review points.'),
      row('governance', 'Prymal positions trust controls, validation, and approvals as central to business execution.'),
      row('audience', 'Small businesses seeking packaged AI helpers for common tasks.'),
      row('setup', 'Sintra may feel simpler for helper-style adoption; Prymal asks teams to define repeatable workflows.'),
    ],
    pricingRows: [
      pricingRow('Pricing model', 'Sintra publishes plans around AI helpers, credits, integrations, and support; check the current pricing page.', 'https://sintra.ai/pricing'),
      pricingRow('Cost driver', 'Cost depends on plan, credits, helper usage, and business workflow volume.', 'https://sintra.ai/pricing'),
    ],
    prymalPros: ['Governed execution layer with shared memory.', 'Better fit for approval-heavy workflows.', 'Clearer positioning around agents plus workflow orchestration.'],
    prymalCons: ['May be more structured than teams wanting simple helper experimentation need.', 'Workflow setup requires more operating thought.'],
    alternativePros: ['Accessible helper-based framing.', 'Good for teams wanting packaged assistants.', 'Can be approachable for small businesses.'],
    alternativeCons: ['Buyers should evaluate depth of governance, memory, and workflow controls.', 'May be less suited to complex review-heavy operating systems.'],
  }),
  buildComparison({
    slug: 'prymal-vs-agentforce',
    alternative: 'Agentforce',
    category: 'Enterprise CRM agent platform',
    sourceUrl: 'https://www.salesforce.com/agentforce/pricing/',
    sourceLabel: 'Agentforce pricing',
    idealPrymalCustomer: 'Teams that want an AI operating system outside a Salesforce-first enterprise architecture.',
    idealAlternativeCustomer: 'Salesforce-centric enterprises that want AI agents deeply connected to Salesforce clouds, CRM data, and enterprise deployment patterns.',
    featureRows: [
      row('memory', 'Agentforce is strongest when Salesforce data and Customer 360 context are the operating centre; Prymal is broader as a standalone AI workspace.'),
      row('workflow', 'Agentforce targets enterprise digital labor and CRM-connected agent workflows; Prymal targets operator-friendly business execution.'),
      row('governance', 'Salesforce offers enterprise controls; Prymal is lighter-weight and focused on reviewable workflows for growing teams.'),
      row('audience', 'Enterprise Salesforce customers scaling AI agents across service, sales, and CRM workflows.'),
      row('setup', 'Usually an enterprise Salesforce implementation motion; Prymal is a hosted SaaS AI operating workspace.'),
    ],
    pricingRows: [
      pricingRow('Pricing model', 'Agentforce pricing is presented through consumption-based pricing, conversations, flex credits, and per-user licensing options.', 'https://www.salesforce.com/agentforce/pricing/'),
      pricingRow('Cost driver', 'Cost can depend on Salesforce estate, conversations, flex credits, agent actions, users, and enterprise configuration.', 'https://help.salesforce.com/s/articleView?id=004811240&language=en_US&type=1'),
    ],
    prymalPros: ['More approachable for non-Salesforce-first teams.', 'Business execution workspace with specialist agents and LORE memory.', 'Clear fit for SMB, agency, and operator workflows.'],
    prymalCons: ['Not a replacement for Salesforce-native enterprise CRM architecture.', 'Less suitable when procurement requires Salesforce ecosystem depth.'],
    alternativePros: ['Deep Salesforce ecosystem integration.', 'Enterprise deployment and CRM data alignment.', 'Strong fit for Salesforce customers.'],
    alternativeCons: ['May be heavy for smaller teams or non-Salesforce workflows.', 'Pricing and implementation can be more complex to evaluate.'],
  }),
  buildComparison({
    slug: 'prymal-vs-crewai',
    alternative: 'CrewAI',
    category: 'Agent development and deployment platform',
    sourceUrl: 'https://crewai.com/pricing',
    sourceLabel: 'CrewAI pricing',
    idealPrymalCustomer: 'Business teams that want ready-to-use AI execution without building agent infrastructure from scratch.',
    idealAlternativeCustomer: 'Technical teams building, deploying, and managing custom agentic AI systems.',
    featureRows: [
      row('memory', 'CrewAI can support custom agent architectures; memory design depends on how the team builds the system.'),
      row('workflow', 'CrewAI is builder/deployment oriented; Prymal packages workflow execution for business operators.'),
      row('governance', 'CrewAI can support enterprise controls through implementation; Prymal exposes a productized review-first workflow story.'),
      row('audience', 'Developers and AI builders creating custom multi-agent systems.'),
      row('setup', 'Requires more technical design and agent configuration; Prymal is more opinionated and productized.'),
    ],
    pricingRows: [
      pricingRow('Pricing model', 'CrewAI publishes pricing for agent adoption and enterprise/custom deployment options.', 'https://crewai.com/pricing'),
      pricingRow('Cost driver', 'Cost depends on plan, deployment model, development time, infrastructure, model usage, and support needs.', 'https://crewai.com/'),
    ],
    prymalPros: ['Lower-code business operator experience.', 'Built-in positioning around workflows, memory, and review.', 'Faster for teams that do not want to engineer agents.'],
    prymalCons: ['Less flexible than building a custom agent platform.', 'Not designed for low-level framework control.'],
    alternativePros: ['Strong builder orientation for custom agents.', 'Useful for technical teams and agent developers.', 'Can be adapted to complex custom architectures.'],
    alternativeCons: ['Requires more implementation skill.', 'Business operators may need engineering support to get production value.'],
  }),
  buildComparison({
    slug: 'prymal-vs-autogen',
    alternative: 'AutoGen',
    category: 'Open-source multi-agent framework',
    sourceUrl: 'https://github.com/microsoft/autogen',
    sourceLabel: 'AutoGen GitHub',
    idealPrymalCustomer: 'Teams that want a hosted AI operating system for business workflows rather than an open-source framework.',
    idealAlternativeCustomer: 'Developers and researchers building custom multi-agent applications with code-level control.',
    featureRows: [
      row('memory', 'AutoGen is a framework; memory and persistence are design choices the development team must implement.'),
      row('workflow', 'AutoGen supports custom multi-agent workflows through code; Prymal productizes business workflows.'),
      row('governance', 'Governance, access, validation, and approvals must be designed around the framework implementation.'),
      row('audience', 'Developers, researchers, and technical teams building agentic applications.'),
      row('setup', 'Requires engineering, hosting, model selection, monitoring, and maintenance decisions.'),
    ],
    pricingRows: [
      pricingRow('Pricing model', 'AutoGen is open source; there is no simple SaaS seat price for the framework itself.', 'https://github.com/microsoft/autogen'),
      pricingRow('Cost driver', 'Costs come from engineering time, hosting, models/API usage, monitoring, security, and maintenance.', 'https://microsoft.github.io/autogen/stable//index.html'),
    ],
    prymalPros: ['Hosted business product instead of framework assembly.', 'Reusable business workflows and agent roles.', 'Better fit for non-engineering operators.'],
    prymalCons: ['Less low-level flexibility than a framework.', 'Not ideal for research teams that want code-first agent experiments.'],
    alternativePros: ['Open-source and developer-controlled.', 'Good for custom multi-agent research and applications.', 'Flexible architecture choices.'],
    alternativeCons: ['Requires engineering and operational ownership.', 'Business UX, governance, and persistence must be built or integrated.'],
  }),
  buildComparison({
    slug: 'prymal-vs-langgraph',
    alternative: 'LangGraph',
    category: 'Agent orchestration framework and platform',
    sourceUrl: 'https://www.langchain.com/langgraph',
    sourceLabel: 'LangGraph overview',
    idealPrymalCustomer: 'Business teams that want agent workflows packaged as a usable operating system.',
    idealAlternativeCustomer: 'Developers building reliable agentic workflows with state, control flow, human-in-the-loop, and deployment tooling.',
    featureRows: [
      row('memory', 'LangGraph gives developers primitives for state and memory patterns; implementation choices remain with the builder.'),
      row('workflow', 'LangGraph is excellent for developer-defined agent graphs; Prymal is a productized workflow workspace.'),
      row('governance', 'Human-in-the-loop and reliability can be built with LangGraph; Prymal exposes business review flows by product design.'),
      row('audience', 'Engineering teams building custom agent systems and deployments.'),
      row('setup', 'Requires development work, deployment decisions, observability, and integration design.'),
    ],
    pricingRows: [
      pricingRow('Pricing model', 'LangGraph framework usage and LangChain/LangSmith platform pricing should be evaluated through current LangChain pricing.', 'https://www.langchain.com/pricing'),
      pricingRow('Cost driver', 'Cost depends on seats, traces, platform usage, deployments, model calls, hosting, and engineering time.', 'https://www.langchain.com/langgraph'),
    ],
    prymalPros: ['Business-ready workflow interface.', 'Less engineering required for common operating workflows.', 'Shared memory, agents, and review in one product.'],
    prymalCons: ['Less suitable for teams that need custom graph-level control.', 'Opinionated product boundaries may limit advanced builders.'],
    alternativePros: ['Powerful framework for reliable agent graphs.', 'Strong developer control over state and flow.', 'Good fit for custom AI products.'],
    alternativeCons: ['Requires engineering resources.', 'Business operator UX and governance must be designed around the implementation.'],
  }),
  buildComparison({
    slug: 'prymal-vs-zapier-ai',
    alternative: 'Zapier AI',
    category: 'Automation and AI workflow platform',
    sourceUrl: 'https://zapier.com/pricing',
    sourceLabel: 'Zapier pricing',
    idealPrymalCustomer: 'Teams whose workflows need AI reasoning, shared memory, content, decisions, and review beyond event-triggered automations.',
    idealAlternativeCustomer: 'Teams that need app-to-app automation, triggers, actions, and integration breadth across thousands of apps.',
    featureRows: [
      row('memory', 'Zapier connects apps and automations; memory depth depends on connected systems and AI setup.'),
      row('workflow', 'Zapier is strong for deterministic integration workflows; Prymal is stronger where AI work and reviewable outputs are central.'),
      row('governance', 'Zapier automation controls are important for app actions; Prymal frames governance around AI outputs and human review.'),
      row('audience', 'Operations teams automating app workflows and integration-heavy processes.'),
      row('setup', 'Best for trigger/action automation; Prymal is better for memory-aware agent workflows.'),
    ],
    pricingRows: [
      pricingRow('Pricing model', 'Zapier pricing is based on plans, task tiers, automation needs, and enterprise options.', 'https://zapier.com/pricing'),
      pricingRow('Cost driver', 'Cost depends on task volume, premium apps, team features, AI usage, and workflow complexity.', 'https://zapier.com/'),
    ],
    prymalPros: ['Better fit for AI-generated work that needs context and review.', 'Specialist agents and memory are central.', 'Useful for content, sales, support, and knowledge workflows.'],
    prymalCons: ['Not a replacement for every app-to-app integration.', 'Deterministic trigger/action automations may be simpler in Zapier.'],
    alternativePros: ['Huge integration catalogue.', 'Excellent trigger/action automation model.', 'Strong fit for no-code operations automation.'],
    alternativeCons: ['AI workflow memory and output review may require additional design.', 'Task-based pricing needs monitoring as automation volume grows.'],
  }),
];

export function getGeneratedComparisonPath(slug) {
  return `${COMPARISON_HUB_PATH}/${slug}`;
}

export function getGeneratedComparisonBySlug(slug) {
  return GENERATED_COMPARISON_PAGES.find((page) => page.slug === slug) ?? null;
}

export function getGeneratedComparisonRoutes() {
  return GENERATED_COMPARISON_PAGES.map((page) => ({
    path: getGeneratedComparisonPath(page.slug),
    changefreq: 'monthly',
    priority: '0.8',
    lastmod: COMPARISON_CONTENT_UPDATED_AT,
    kind: 'generated-comparison',
    slug: page.slug,
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

export function buildGeneratedComparisonPageSchema(page) {
  const path = getGeneratedComparisonPath(page.slug);
  return buildSchemaGraph([
    buildWebPageSchema({
      name: page.metaTitle,
      description: page.metaDescription,
      path,
      datePublished: COMPARISON_CONTENT_UPDATED_AT,
      dateModified: COMPARISON_CONTENT_UPDATED_AT,
    }),
    buildBreadcrumbSchema([
      { name: SITE_NAME, path: '/' },
      { name: 'Compare', path: COMPARISON_HUB_PATH },
      { name: page.title, path },
    ]),
    buildFaqPageSchema(page.faq),
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': `${urlForPath(path)}#prymal`,
      name: 'Prymal',
      applicationCategory: 'BusinessApplication',
      description: 'AI operating system for business execution with specialist agents, shared memory, workflow automation, and trust controls.',
      url: urlForPath('/'),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': `${urlForPath(path)}#alternative`,
      name: page.alternative,
      applicationCategory: 'BusinessApplication',
      description: `${page.alternative} is compared here as a ${page.category.toLowerCase()} option.`,
      url: page.sourceUrl,
    },
    buildItemListSchema({
      id: 'feature-comparison',
      name: `${page.title} feature comparison`,
      description: `Feature comparison between Prymal and ${page.alternative}.`,
      path,
      items: page.featureRows.map((row) => ({
        '@type': 'Thing',
        name: row.label,
        description: `Prymal: ${row.prymal} ${page.alternative}: ${row.alternative}`,
      })),
    }),
    buildItemListSchema({
      id: 'pricing-comparison',
      name: `${page.title} pricing comparison`,
      description: `Pricing-model comparison between Prymal and ${page.alternative}.`,
      path,
      items: page.pricingRows.map((row) => ({
        '@type': 'Thing',
        name: row.label,
        description: `Prymal: ${row.prymal} ${page.alternative}: ${row.alternative}`,
        url: row.sourceUrl,
      })),
    }),
  ]);
}

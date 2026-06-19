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

export const GENERATED_BLOG_HUB_PATH = '/content/blog';
export const GENERATED_BLOG_UPDATED_AT = '2026-06-19';

const CATEGORIES = [
  'AI Operations',
  'AI Agents',
  'Workflow Automation',
  'Business Systems',
  'Agency Growth',
  'Sales Automation',
  'Knowledge Management',
  'AI Governance',
];

const REFERENCES = {
  nist: {
    title: 'AI Risk Management Framework',
    href: 'https://www.nist.gov/itl/ai-risk-management-framework',
    publisher: 'NIST',
    note: 'Reference for AI governance, risk, accountability, and trustworthiness practices.',
  },
  googleMultiAgent: {
    title: 'Multi-agent AI system reference architecture',
    href: 'https://docs.cloud.google.com/architecture/multiagent-ai-system',
    publisher: 'Google Cloud Architecture Center',
    note: 'Reference architecture for robust multi-agent AI systems.',
  },
  googleScaling: {
    title: 'Towards a Science of Scaling Agent Systems',
    href: 'https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/',
    publisher: 'Google Research',
    note: 'Research discussion on when agent systems work and where added agents create overhead.',
  },
  ragPaper: {
    title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
    href: 'https://arxiv.org/abs/2005.11401',
    publisher: 'arXiv / NeurIPS',
    note: 'Foundational paper for retrieval-augmented generation and non-parametric memory.',
  },
  langGraph: {
    title: 'LangGraph overview',
    href: 'https://www.langchain.com/langgraph',
    publisher: 'LangChain',
    note: 'Reference for agent orchestration, state, memory, and human-in-the-loop workflow concepts.',
  },
  autogen: {
    title: 'AutoGen documentation',
    href: 'https://microsoft.github.io/autogen/stable//index.html',
    publisher: 'Microsoft',
    note: 'Developer documentation for agentic and multi-agent application patterns.',
  },
};

const ENTITY_REFERENCES = {
  aiOperatingSystem: { name: 'AI Operating System', slug: 'ai-operating-system', path: '/content/entities/ai-operating-system' },
  agentOrchestration: { name: 'Agent Orchestration', slug: 'agent-orchestration', path: '/content/entities/agent-orchestration' },
  agentMemory: { name: 'Agent Memory', slug: 'agent-memory', path: '/content/entities/agent-memory' },
  multiAgentSystems: { name: 'Multi-Agent Systems', slug: 'multi-agent-systems', path: '/content/entities/multi-agent-systems' },
  workflowAutomation: { name: 'Workflow Automation', slug: 'workflow-automation', path: '/content/entities/workflow-automation' },
  businessAi: { name: 'Business AI', slug: 'business-ai', path: '/content/entities/business-ai' },
  aiGovernance: { name: 'AI Governance', slug: 'ai-governance', path: '/content/entities/ai-governance' },
  aiAgents: { name: 'AI Agents', slug: 'ai-agents', path: '/content/entities/ai-agents' },
  prymal: { name: 'Prymal', slug: 'prymal', path: '/content/entities/prymal' },
};

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const TARGET_TITLES = [
  ...[
    'What Is An AI Operating System',
    'AI Operating System vs AI Assistant',
    'Why Businesses Need AI Operating Systems',
    'AI Operating Systems Explained',
    'Best AI Operating Systems In 2026',
    'Future Of AI Operating Systems',
    'AI Operating System Architecture',
    'Benefits Of AI Operating Systems',
    'Common AI Operating System Mistakes',
    'How To Choose An AI Operating System',
  ].map((title) => ({ title, category: 'AI Operations', cluster: 'AI Operating Systems' })),
  ...[
    'What Is Agent Orchestration',
    'Agent Orchestration Explained',
    'Multi-Agent Systems Guide',
    'Agent Coordination Strategies',
    'Agent Collaboration Models',
    'Building Multi-Agent Workflows',
    'Agent Routing Techniques',
    'Agent Memory Systems',
    'Agent Delegation Patterns',
    'Agent Governance',
  ].map((title) => ({ title, category: 'AI Agents', cluster: 'Agent Orchestration' })),
  ...[
    'AI For Agencies',
    'AI For Recruiters',
    'AI For Accountants',
    'AI For Consultants',
    'AI For Sales Teams',
    'AI For Marketing Teams',
    'AI For SMEs',
    'AI For Startups',
    'AI For Ecommerce',
    'AI For Construction',
  ].map((title) => ({ title, category: 'Agency Growth', cluster: 'Business Automation' })),
  ...[
    'AI Sales Automation',
    'Lead Qualification With AI',
    'AI Prospect Research',
    'AI Outreach Workflows',
    'AI Proposal Generation',
    'AI CRM Automation',
    'AI Follow Up Systems',
    'AI Pipeline Management',
    'AI Revenue Operations',
    'AI Sales Agents',
  ].map((title) => ({ title, category: 'Sales Automation', cluster: 'Sales' })),
  ...[
    'AI Knowledge Management',
    'AI SOP Management',
    'AI Internal Documentation',
    'AI Team Collaboration',
    'AI Task Management',
    'AI Workflow Automation',
    'AI Process Optimisation',
    'AI Decision Support',
    'AI Meeting Intelligence',
    'AI Operations Stack',
  ].map((title) => ({ title, category: 'AI Operations', cluster: 'Operations' })),
  ...[
    'AI Content Operations',
    'AI Content Planning',
    'AI Blog Workflows',
    'AI SEO Workflows',
    'AI GEO Workflows',
    'AI AEO Workflows',
    'AI Publishing Systems',
    'AI Research Pipelines',
    'AI Content Governance',
    'AI Editorial Automation',
  ].map((title) => ({ title, category: 'Workflow Automation', cluster: 'Content' })),
  ...[
    'AI Governance Frameworks',
    'AI Compliance Workflows',
    'AI Security For Agents',
    'AI Access Controls',
    'AI Audit Trails',
    'AI Agent Permissions',
    'AI Risk Management',
    'AI Business Security',
    'AI Data Governance',
    'AI Trust Systems',
  ].map((title) => ({ title, category: 'AI Governance', cluster: 'Governance' })),
  ...[
    'Prymal vs ChatGPT For Business',
    'Prymal vs Claude For Business',
    'Prymal vs Gemini For Business',
    'Prymal vs Notion AI',
    'Prymal vs ClickUp AI',
    'Prymal vs Sintra',
    'Prymal vs Agentforce',
    'Prymal vs CrewAI',
    'Prymal vs AutoGen',
    'Prymal vs LangGraph',
    'Prymal vs Zapier AI',
    'Prymal vs Microsoft Copilot',
    'Prymal vs Perplexity Enterprise',
    'Prymal vs Glean',
    'Prymal vs HubSpot AI',
    'Prymal vs Salesforce Einstein',
    'Prymal vs Make AI',
    'Prymal vs n8n AI',
    'Prymal vs Asana AI',
    'Prymal vs Monday AI',
  ].map((title) => ({ title, category: 'Business Systems', cluster: 'Comparisons' })),
  ...[
    'Future Of Agentic Search',
    'Future Of AI Agents',
    'Future Of Business Automation',
    'Future Of Multi-Agent Systems',
    'Future Of AI Governance',
    'Future Of AI Operations',
    'Future Of Knowledge Systems',
    'Future Of Autonomous Workflows',
    'Future Of AI Teams',
    'Future Of Business Operating Systems',
  ].map((title) => ({ title, category: 'Business Systems', cluster: 'Future' })),
];

function referencesFor(category, cluster, title) {
  const base = [REFERENCES.nist, REFERENCES.googleMultiAgent, REFERENCES.langGraph];
  if (category === 'Knowledge Management' || /knowledge|memory|rag|research/i.test(title)) {
    return [REFERENCES.ragPaper, REFERENCES.langGraph, REFERENCES.nist];
  }
  if (category === 'AI Governance' || cluster === 'Governance') {
    return [REFERENCES.nist, REFERENCES.googleMultiAgent, REFERENCES.langGraph];
  }
  if (category === 'AI Agents' || /agent|multi-agent|orchestration/i.test(title)) {
    return [REFERENCES.googleMultiAgent, REFERENCES.googleScaling, REFERENCES.autogen, REFERENCES.langGraph];
  }
  return base;
}

function entitiesFor(category, cluster, title) {
  const entities = [ENTITY_REFERENCES.prymal, ENTITY_REFERENCES.aiOperatingSystem, ENTITY_REFERENCES.businessAi];
  if (category === 'AI Agents' || /agent|multi-agent|orchestration/i.test(title)) {
    entities.push(ENTITY_REFERENCES.aiAgents, ENTITY_REFERENCES.agentOrchestration, ENTITY_REFERENCES.multiAgentSystems);
  }
  if (/memory|knowledge|rag|documentation|research/i.test(title)) {
    entities.push(ENTITY_REFERENCES.agentMemory);
  }
  if (/workflow|automation|operations|process|sop|task|publishing/i.test(title) || category === 'Workflow Automation') {
    entities.push(ENTITY_REFERENCES.workflowAutomation);
  }
  if (category === 'AI Governance' || cluster === 'Governance' || /governance|security|risk|trust|audit|access|permissions|compliance/i.test(title)) {
    entities.push(ENTITY_REFERENCES.aiGovernance);
  }
  return [...new Map(entities.map((entity) => [entity.slug, entity])).values()].slice(0, 6);
}

function buildArticle(definition, index) {
  const slug = slugify(definition.title);
  const focus = definition.title.toLowerCase();
  return {
    ...definition,
    slug,
    index: index + 1,
    title: definition.title,
    metaTitle: `${definition.title} | Prymal generated AI operations guide`,
    metaDescription: `A 2000+ word Prymal guide to ${focus}, with FAQs, citations, internal links, entity references, and practical business AI workflow guidance.`,
    summary: `${definition.title} explains how ${focus} fits into business AI execution, AI operating systems, agents, memory, workflows, and governance.`,
    citations: referencesFor(definition.category, definition.cluster, definition.title),
    entityReferences: entitiesFor(definition.category, definition.cluster, definition.title),
  };
}

export const GENERATED_BLOG_ARTICLES = TARGET_TITLES.map(buildArticle);
export const GENERATED_BLOG_CATEGORIES = CATEGORIES;

export function getGeneratedBlogPath(slug) {
  return `${GENERATED_BLOG_HUB_PATH}/${slug}`;
}

export function getGeneratedBlogArticleBySlug(slug) {
  return GENERATED_BLOG_ARTICLES.find((article) => article.slug === slug) ?? null;
}

export function getGeneratedBlogArticlesByCategory(category) {
  return GENERATED_BLOG_ARTICLES.filter((article) => article.category === category);
}

export function getRelatedGeneratedBlogArticles(article) {
  return GENERATED_BLOG_ARTICLES
    .filter((candidate) => candidate.slug !== article.slug)
    .filter((candidate) => candidate.category === article.category || candidate.cluster === article.cluster)
    .slice(0, 6);
}

function paragraph(value) {
  return value.replace(/\s+/g, ' ').trim();
}

export function buildGeneratedBlogSections(article) {
  const entityNames = article.entityReferences.map((entity) => entity.name).join(', ');
  const citations = article.citations.map((citation) => `${citation.publisher} on ${citation.title}`).join('; ');
  const related = getRelatedGeneratedBlogArticles(article).map((item) => item.title).join(', ');

  return [
    {
      eyebrow: 'Executive summary',
      title: `${article.title}: the short version`,
      paragraphs: [
        paragraph(`${article.title} is part of Prymal's generated AI operations blog system. The article explains the topic through the lens of business execution rather than abstract AI hype. In practice, that means asking how the idea changes recurring work, who owns the review step, what memory or source context is required, and how the result becomes repeatable across a team.`),
        paragraph(`The central argument is that ${article.title.toLowerCase()} should be evaluated as part of an operating system. Prymal frames the operating system as specialist agents, shared business memory, workflow orchestration, governance, and human review. A useful article on this topic should therefore connect the concept to workflows, entity references, citations, and practical next steps rather than treating it as a standalone trend.`),
      ],
      bullets: [`Category: ${article.category}.`, `Cluster: ${article.cluster}.`, `Related entities: ${entityNames}.`],
    },
    {
      eyebrow: 'Business context',
      title: `Why ${article.title.toLowerCase()} matters now`,
      paragraphs: [
        paragraph(`Most businesses are no longer asking whether AI can produce a useful draft. They are asking whether AI can help a team run better work. That shift is why ${article.title.toLowerCase()} matters. The challenge is moving from individual prompting to repeatable execution: a workflow that knows the context, uses the right agent role, creates a useful output, and keeps the right person responsible for review.`),
        paragraph(`The risk is that teams buy or build AI tools without designing the operating layer around them. The result is prompt sprawl, duplicated context, inconsistent quality, and unclear accountability. A stronger approach starts with the workflow and then decides which agents, memory sources, governance controls, and measurements are required. This is the difference between AI activity and AI operations.`),
      ],
      bullets: ['Teams need repeatable execution, not only clever answers.', 'Shared memory reduces repeated setup.', 'Governance turns AI output into reviewable business work.'],
    },
    {
      eyebrow: 'Definitions',
      title: `How to define ${article.title.toLowerCase()} clearly`,
      paragraphs: [
        paragraph(`A clear definition should name the job being done. If the topic is strategic, the definition should explain how decisions become operating plans. If it is agent-related, it should explain how roles, routing, memory, and handoffs work. If it is governance-related, it should explain how risk, access, review, and auditability are handled. If it is a comparison, the definition should explain the buying job rather than attacking another product category.`),
        paragraph(`For Prymal, the definition always comes back to business execution. The question is not simply whether AI can write, answer, classify, or summarise. The question is whether the system helps the business preserve context, coordinate work, validate outputs, and improve the next run. That operating definition is more useful than a technical label because it helps teams decide what to implement first.`),
      ],
      bullets: ['Name the business workflow.', 'Name the source context.', 'Name the review owner.', 'Name the output and success metric.'],
    },
    {
      eyebrow: 'Operating model',
      title: `The operating model behind ${article.title.toLowerCase()}`,
      paragraphs: [
        paragraph(`A practical operating model has six pieces: intake, memory, agent role, workflow path, validation, and measurement. Intake captures the request. Memory supplies approved business context. The agent role defines what kind of work should happen. The workflow path controls the sequence. Validation checks quality, risk, and missing assumptions. Measurement shows whether the work is faster, clearer, safer, or more repeatable than the manual baseline.`),
        paragraph(`This model is intentionally simple because adoption fails when the operating system is too vague. A team should be able to point to the current request, the source of truth, the expected output, the approval owner, and the metric. If any of those are missing, the workflow is still immature. That does not mean it is useless; it means the team should keep the first implementation narrow.`),
      ],
      bullets: ['Intake: capture the request.', 'Memory: retrieve approved context.', 'Agent: assign the role.', 'Workflow: move through steps.', 'Validation: check before use.', 'Measurement: compare to baseline.'],
    },
    {
      eyebrow: 'Prymal view',
      title: `How Prymal approaches ${article.title.toLowerCase()}`,
      paragraphs: [
        paragraph(`Prymal approaches ${article.title.toLowerCase()} as part of an AI operating system for business execution. That means the topic is connected to LORE shared memory, NEXUS workflow automation, specialist agents, and trust controls. The point is not to create a larger library of prompts. The point is to make recurring work easier to run, inspect, approve, and improve.`),
        paragraph(`This also keeps the product language honest. Prymal should not claim that AI removes professional judgment, replaces regulated advice, or makes governance automatic. The stronger claim is more practical: when source context is maintained and review rules are explicit, AI-assisted work can become faster and more consistent without hiding accountability.`),
      ],
      bullets: ['LORE supplies shared context.', 'NEXUS coordinates workflow steps.', 'Specialist agents divide work by role.', 'Validation and review protect sensitive outputs.'],
    },
    {
      eyebrow: 'Examples',
      title: `Examples of ${article.title.toLowerCase()} in practice`,
      paragraphs: [
        paragraph(`One example is a client-facing workflow. A team captures context from a brief, retrieves approved memory, assigns research and drafting agents, validates claims, and sends the result to an account owner for approval. This pattern applies to proposals, reporting, support replies, onboarding plans, and campaign assets. The details change, but the operating loop stays stable.`),
        paragraph(`A second example is an internal operating workflow. A manager needs a weekly summary of sales, support, project, and finance notes. Instead of rebuilding the summary manually, the workflow retrieves current context, asks specialist agents to summarise each area, flags risks, and produces an executive brief. The manager still owns the decisions, but the preparation work becomes repeatable.`),
      ],
      bullets: ['Client delivery: brief to reviewed output.', 'Sales: meeting notes to follow-up and CRM summary.', 'Operations: scattered updates to weekly operating brief.', 'Knowledge: policy documents to source-grounded answers.'],
    },
    {
      eyebrow: 'Mistakes',
      title: `Common mistakes with ${article.title.toLowerCase()}`,
      paragraphs: [
        paragraph(`The first mistake is starting too broadly. Teams try to automate an entire function instead of one workflow. The second mistake is forgetting source ownership. If nobody owns the memory, the output quality will decay. The third mistake is treating a generated draft as a finished decision. The fourth mistake is measuring excitement instead of operating outcomes.`),
        paragraph(`A better pattern is to pick one repeated task, define the source context, define the output, name the review owner, and measure cycle time and rework. When that path works, expand to adjacent workflows. This approach is slower than a demo but faster than cleaning up a broad rollout that nobody trusts.`),
      ],
      bullets: ['Starting with a function instead of a workflow.', 'Letting memory become stale.', 'Skipping review for external outputs.', 'Failing to measure baseline and improvement.'],
    },
    {
      eyebrow: 'Governance',
      title: `Governance considerations for ${article.title.toLowerCase()}`,
      paragraphs: [
        paragraph(`Governance should be proportional to risk. Internal brainstorming can move quickly. Customer-facing messages require review. Finance, legal, healthcare, HR, security, and regulated outputs need stricter ownership and escalation rules. A good workflow should make those boundaries visible instead of relying on every user to remember them.`),
        paragraph(`The citations for this article point to broader AI risk, retrieval, and agent-system references: ${citations}. These sources do not replace product-specific evaluation, but they help ground the operating model in recognised concerns: source quality, risk management, human oversight, system design, and the tradeoffs of multi-agent architectures.`),
      ],
      bullets: ['Classify workflow risk.', 'Restrict sensitive source access.', 'Hold risky outputs for review.', 'Log decisions and improvement notes.'],
    },
    {
      eyebrow: 'Entity references',
      title: `Entity references for ${article.title.toLowerCase()}`,
      paragraphs: [
        paragraph(`This article references the following Prymal entity cluster: ${entityNames}. Entity references matter for SEO, AEO, and GEO because they make the conceptual graph explicit. The article is not only about a keyword; it is about how the keyword relates to an AI operating system, agent orchestration, memory, workflow automation, business AI, and governance.`),
        paragraph(`Readers should use the entity links to move from editorial guidance into canonical definitions. That is especially useful for answer engines, which need stable entity relationships rather than isolated blog posts. For Prymal, the most important relationship remains Prymal -> AI Operating System, with agents, memory, workflows, and governance as supporting concepts.`),
      ],
      bullets: article.entityReferences.map((entity) => `${entity.name}: ${entity.path}`),
    },
    {
      eyebrow: 'Implementation',
      title: `How to implement ideas from ${article.title.toLowerCase()}`,
      paragraphs: [
        paragraph(`Start by choosing one narrow workflow connected to the topic. For example, if the article is about sales automation, begin with meeting follow-up or lead qualification. If it is about governance, begin with output review for one external communication workflow. If it is about knowledge management, begin with a policy Q&A workflow using approved sources.`),
        paragraph(`Then document five items: source context, agent role, output format, review owner, and metric. Run the workflow on a real example, compare it to the manual baseline, and improve the prompt, memory, or review gate. This turns the article from content into an implementation checklist.`),
      ],
      bullets: ['Choose one repeated workflow.', 'Document source context.', 'Assign agent roles.', 'Define review and escalation.', 'Measure saved time and quality.'],
    },
    {
      eyebrow: 'Measurement',
      title: `How to measure progress on ${article.title.toLowerCase()}`,
      paragraphs: [
        paragraph(`Measurement should start before the workflow is automated. Capture the manual baseline: how long the work takes, how much context has to be gathered, how often review catches missing information, and how many handoffs are required. Then compare the AI-assisted workflow against that baseline. The goal is not to prove that AI is impressive. The goal is to prove that the operating process is clearer, faster, or more reliable.`),
        paragraph(`Useful metrics include saved setup time, cycle time, review changes, escalation rate, output acceptance, and whether the workflow creates the intended downstream action. For ${article.title.toLowerCase()}, the best metric will depend on the category, but the measurement habit is the same: define the business outcome, run a narrow workflow, review the result, and improve the system before scaling it.`),
      ],
      bullets: ['Track manual baseline.', 'Measure cycle time and review changes.', 'Watch escalation and rejection rates.', 'Tie results to a business outcome.'],
    },
    {
      eyebrow: 'Rollout plan',
      title: `A practical rollout plan for ${article.title.toLowerCase()}`,
      paragraphs: [
        paragraph(`A practical rollout has three stages. First, run the workflow with one owner and one real use case. Second, add memory, examples, and review rules until the output is consistently useful. Third, expand the workflow to adjacent teams or related tasks. This staged approach protects the team from scaling unclear instructions, stale memory, or review gaps.`),
        paragraph(`The rollout should also include a stop rule. If the workflow starts producing outputs that are hard to review, if users cannot tell which sources were used, or if sensitive work is moving without approval, pause and narrow the scope. Responsible AI operations are not only about acceleration. They are about knowing when a workflow is ready to move faster and when it needs a tighter boundary.`),
      ],
      bullets: ['Pilot one workflow.', 'Improve memory and examples.', 'Expand only after review quality is stable.', 'Pause if source clarity or approval breaks down.'],
    },
    {
      eyebrow: 'Internal links',
      title: `Internal links related to ${article.title.toLowerCase()}`,
      paragraphs: [
        paragraph(`The best next reading path depends on intent. If the reader wants a definition, start with the What Is hub. If they want implementation, use the use case library. If they want industry fit, use the industry pages. If they are comparing vendors, use the comparison hub. If they need canonical concepts, use the entity graph.`),
        paragraph(`Related generated articles in this cluster include ${related || 'other Prymal generated AI operations guides'}. Internal links help the site behave like a knowledge graph rather than a pile of posts. They also help readers build a more complete mental model before evaluating software.`),
      ],
      bullets: ['What Is hub: /what-is.', 'Use case library: /use-cases.', 'Industry pages: /content/industries.', 'Entity graph: /content/entities.', 'Comparison hub: /compare.'],
    },
    {
      eyebrow: 'Conclusion',
      title: `The takeaway on ${article.title.toLowerCase()}`,
      paragraphs: [
        paragraph(`${article.title} is useful when it helps a team design better business execution. The article should not be read as a promise that AI can remove people from the loop. It should be read as a framework for deciding where AI can reduce repeated setup, improve consistency, and make review easier.`),
        paragraph(`Prymal's point of view is that serious business AI needs an operating layer. That layer includes agents, memory, workflows, governance, citations, internal links, and entity clarity. When those pieces are present, AI moves from a single impressive answer to a repeatable system for work.`),
      ],
      bullets: ['Keep the workflow narrow.', 'Keep memory fresh.', 'Keep review visible.', 'Keep measurement practical.', 'Expand only after the first workflow works.'],
    },
  ];
}

export function getGeneratedBlogWordCount(article) {
  const text = [
    article.title,
    article.summary,
    ...buildGeneratedBlogSections(article).flatMap((section) => [section.title, ...section.paragraphs, ...section.bullets]),
    ...article.citations.flatMap((citation) => [citation.title, citation.publisher, citation.note]),
    ...article.entityReferences.flatMap((entity) => [entity.name, entity.path]),
    ...getGeneratedBlogFaq(article).flatMap((item) => [item.question, item.answer]),
  ].join(' ');
  return text.split(/\s+/).filter(Boolean).length;
}

export function getGeneratedBlogFaq(article) {
  return [
    {
      question: `What is the main point of ${article.title}?`,
      answer: `${article.title} explains the topic as part of business AI execution: agents, shared memory, workflows, governance, review, and measurable operating outcomes.`,
    },
    {
      question: `How does ${article.title.toLowerCase()} connect to Prymal?`,
      answer: 'Prymal is positioned as an AI operating system for business execution, so the topic is connected to LORE memory, NEXUS workflows, specialist agents, and trust controls.',
    },
    {
      question: 'What should teams implement first?',
      answer: 'Start with one narrow recurring workflow, define source context and review ownership, then measure cycle time, rework, quality, and throughput before expanding.',
    },
    {
      question: 'Does this remove the need for human review?',
      answer: 'No. Sensitive decisions, customer-facing outputs, regulated work, commercial claims, and high-impact actions should stay reviewable by an accountable person.',
    },
  ];
}

export function getGeneratedBlogRoutes() {
  return [
    {
      path: GENERATED_BLOG_HUB_PATH,
      changefreq: 'weekly',
      priority: '0.86',
      lastmod: GENERATED_BLOG_UPDATED_AT,
      kind: 'generated-blog-hub',
    },
    ...GENERATED_BLOG_ARTICLES.map((article) => ({
      path: getGeneratedBlogPath(article.slug),
      changefreq: 'monthly',
      priority: '0.78',
      lastmod: GENERATED_BLOG_UPDATED_AT,
      kind: 'generated-blog',
      slug: article.slug,
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

export function buildGeneratedBlogHubSchema() {
  return buildSchemaGraph([
    buildCollectionSchema({
      name: 'Prymal generated AI operations blog',
      description: 'A generated blog hub with 100 long-form AI operations, AI agents, workflow automation, business systems, agency growth, sales automation, knowledge management, and AI governance articles.',
      path: GENERATED_BLOG_HUB_PATH,
    }),
    buildBreadcrumbSchema([
      { name: SITE_NAME, path: '/' },
      { name: 'Content blog', path: GENERATED_BLOG_HUB_PATH },
    ]),
    buildItemListSchema({
      id: 'articles',
      name: 'Generated Prymal blog articles',
      description: 'All generated Prymal blog articles.',
      path: GENERATED_BLOG_HUB_PATH,
      items: GENERATED_BLOG_ARTICLES.map((article) => ({
        '@type': 'Article',
        headline: article.title,
        url: urlForPath(getGeneratedBlogPath(article.slug)),
        description: article.metaDescription,
      })),
    }),
  ]);
}

export function buildGeneratedBlogArticleSchema(article) {
  const path = getGeneratedBlogPath(article.slug);
  return buildSchemaGraph([
    buildWebPageSchema({
      name: article.metaTitle,
      description: article.metaDescription,
      path,
      datePublished: GENERATED_BLOG_UPDATED_AT,
      dateModified: GENERATED_BLOG_UPDATED_AT,
    }),
    buildArticleSchema({
      headline: article.title,
      description: article.metaDescription,
      path,
      datePublished: GENERATED_BLOG_UPDATED_AT,
      dateModified: GENERATED_BLOG_UPDATED_AT,
      keywords: [article.category, article.cluster, ...article.entityReferences.map((entity) => entity.name)],
      wordCount: getGeneratedBlogWordCount(article),
      authorName: SITE_NAME,
      authorType: 'Organization',
    }),
    buildBreadcrumbSchema([
      { name: SITE_NAME, path: '/' },
      { name: 'Content blog', path: GENERATED_BLOG_HUB_PATH },
      { name: article.title, path },
    ]),
    buildFaqPageSchema(getGeneratedBlogFaq(article)),
    buildItemListSchema({
      id: 'citations',
      name: `${article.title} citations`,
      description: `Citations for ${article.title}.`,
      path,
      items: article.citations.map((citation) => ({
        '@type': 'CreativeWork',
        name: citation.title,
        url: citation.href,
        publisher: citation.publisher,
        description: citation.note,
      })),
    }),
    buildItemListSchema({
      id: 'entity-references',
      name: `${article.title} entity references`,
      description: `Entity references for ${article.title}.`,
      path,
      items: article.entityReferences.map((entity) => ({
        '@type': 'DefinedTerm',
        name: entity.name,
        url: urlForPath(entity.path),
      })),
    }),
  ]);
}

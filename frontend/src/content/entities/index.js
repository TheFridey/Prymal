import {
  SITE_NAME,
  SITE_URL,
  buildBreadcrumbSchema,
  buildSchemaGraph,
  buildWebPageSchema,
  urlForPath,
} from '../../lib/seo.js';

export const ENTITY_CONTENT_UPDATED_AT = '2026-06-19';
export const ENTITY_HUB_PATH = '/content/entities';

/**
 * @typedef {'core'|'category'|'capability'|'architecture'|'governance'} EntityKind
 * @typedef {{ type: string, target: string, label: string, strength: number }} EntityRelationship
 * @typedef {{ label: string, to: string, description: string, cta?: string }} InternalEntityLink
 * @typedef {{
 *   slug: string,
 *   name: string,
 *   kind: EntityKind,
 *   aliases: string[],
 *   summary: string,
 *   definition: string,
 *   prymalReinforcement: string,
 *   whyItMatters: string[],
 *   prymalUse: string[],
 *   relatedPages: InternalEntityLink[],
 *   relationships: EntityRelationship[],
 *   sameAs?: string[],
 * }} Entity
 */

const link = (label, to, description, cta = 'Open page ->') => ({
  label,
  to,
  description,
  cta,
});

const CORE_LINKS = {
  home: link('Prymal home', '/', 'The canonical product page for Prymal as an AI operating system for business execution.'),
  architecture: link('Prymal architecture', '/architecture', 'How LORE, WARDEN, specialist agents, workflows, and routing fit together.'),
  trust: link('Trust Centre', '/trust', 'Safety, data boundaries, governance, and readiness language for serious AI adoption.'),
  features: link('Feature hub', '/features', 'Explore Prymal features across agents, business memory, workflows, and trust controls.'),
  pricing: link('Pricing', '/pricing', 'Workspace plan and execution-credit context for evaluating Prymal.'),
  aiOperatingSystem: link('AI operating system guide', '/ai-operating-system-for-business', 'The primary category explanation for Prymal as an AI operating system.'),
  orchestration: link('AI agent orchestration guide', '/ai-agent-orchestration', 'How specialist agents coordinate through context, workflows, and approvals.'),
  memory: link('Shared business memory guide', '/shared-business-memory-ai', 'Why durable, reviewable memory matters for business AI execution.'),
  governedAgents: link('Governed AI agents guide', '/governed-ai-agents', 'Access controls, approvals, safety checks, and auditability for agents.'),
  secureWorkflows: link('Secure AI workflows guide', '/secure-ai-workflows', 'How secure workflow automation handles risk, review, and policy boundaries.'),
  blogOperatingSystem: link('What is an AI operating system?', '/blog/what-is-an-ai-operating-system-for-business', 'Long-form category guide for AI operating systems in business.'),
  blogMemory: link('Why business AI needs memory', '/blog/why-business-ai-needs-memory-not-just-prompts', 'Long-form article on memory as business AI infrastructure.'),
  compareChatgpt: link('Prymal vs ChatGPT for business', '/compare/prymal-vs-chatgpt-for-business', 'A fair comparison between general chat and execution-first business AI.'),
};

export const ENTITY_RELATIONSHIP_TYPES = {
  isA: 'is a',
  includes: 'includes',
  enables: 'enables',
  governedBy: 'is governed by',
  dependsOn: 'depends on',
  powers: 'powers',
  reinforces: 'reinforces',
};

/** @type {Entity[]} */
export const ENTITIES = [
  {
    slug: 'prymal',
    name: 'Prymal',
    kind: 'core',
    aliases: ['Prymal AI', 'Prymal operating system', 'Prymal business AI'],
    summary: 'Prymal is an AI operating system for business execution.',
    definition:
      'Prymal is a governed business AI execution layer that combines specialist agents, shared business memory, workflow automation, and trust controls in one workspace.',
    prymalReinforcement:
      'Prymal should be understood first as an AI Operating System: the product coordinates agents, memory, workflows, and governance instead of behaving like a single chatbot.',
    whyItMatters: [
      'It gives answer engines a canonical entity for the product and category.',
      'It ties feature language back to one durable concept: AI operating system for business execution.',
      'It prevents Prymal from being misclassified as only a chatbot, automation tool, or agent directory.',
    ],
    prymalUse: [
      'Prymal uses specialist agents for role-specific execution.',
      'Prymal uses LORE-style memory so work can start from shared business context.',
      'Prymal uses workflows and trust controls so repeated work stays reviewable.',
    ],
    relatedPages: [
      CORE_LINKS.home,
      CORE_LINKS.aiOperatingSystem,
      CORE_LINKS.architecture,
      CORE_LINKS.features,
      CORE_LINKS.trust,
    ],
    relationships: [
      { type: 'isA', target: 'ai-operating-system', label: 'Prymal is an AI Operating System', strength: 1 },
      { type: 'includes', target: 'agent-orchestration', label: 'Prymal includes agent orchestration', strength: 0.95 },
      { type: 'includes', target: 'agent-memory', label: 'Prymal includes shared agent memory', strength: 0.95 },
      { type: 'includes', target: 'workflow-automation', label: 'Prymal includes workflow automation', strength: 0.9 },
      { type: 'governedBy', target: 'ai-governance', label: 'Prymal is governed by AI governance controls', strength: 0.88 },
    ],
    sameAs: [SITE_URL],
  },
  {
    slug: 'ai-operating-system',
    name: 'AI Operating System',
    kind: 'category',
    aliases: ['AI operating system for business', 'business AI operating layer', 'AI execution operating system'],
    summary: 'An AI Operating System coordinates agents, memory, workflows, and governance for repeatable business execution.',
    definition:
      'An AI Operating System is a coordinated business layer where AI agents, shared memory, workflow automation, and governance controls work together across recurring business processes.',
    prymalReinforcement:
      'Prymal reinforces this entity by making AI Operating System the parent category for the product, with every capability mapped back to business execution.',
    whyItMatters: [
      'It differentiates Prymal from chat-first AI tools.',
      'It gives search systems a category-level entity for memory, workflows, orchestration, and governance.',
      'It clarifies why Prymal connects multiple agents rather than exposing one generic assistant.',
    ],
    prymalUse: [
      'Prymal presents the AI Operating System as the product spine.',
      'Prymal maps agents, memory, workflows, and governance into one operating model.',
      'Prymal uses this category to explain repeatable execution, not novelty prompts.',
    ],
    relatedPages: [
      CORE_LINKS.aiOperatingSystem,
      CORE_LINKS.blogOperatingSystem,
      CORE_LINKS.architecture,
      CORE_LINKS.features,
      CORE_LINKS.compareChatgpt,
    ],
    relationships: [
      { type: 'includes', target: 'agent-orchestration', label: 'AI Operating Systems include agent orchestration', strength: 0.95 },
      { type: 'includes', target: 'agent-memory', label: 'AI Operating Systems include agent memory', strength: 0.9 },
      { type: 'includes', target: 'workflow-automation', label: 'AI Operating Systems include workflow automation', strength: 0.88 },
      { type: 'governedBy', target: 'ai-governance', label: 'AI Operating Systems require governance', strength: 0.86 },
      { type: 'reinforces', target: 'prymal', label: 'AI Operating System is the category Prymal reinforces', strength: 1 },
    ],
  },
  {
    slug: 'agent-orchestration',
    name: 'Agent Orchestration',
    kind: 'capability',
    aliases: ['AI agent orchestration', 'multi-agent orchestration', 'agent routing'],
    summary: 'Agent orchestration coordinates specialist agents, shared context, workflow stages, and review points.',
    definition:
      'Agent Orchestration is the system behavior that routes work between specialist AI agents, carries context between steps, and keeps approvals or review points visible.',
    prymalReinforcement:
      'Prymal uses Agent Orchestration as a capability inside its AI Operating System, so agents work together through memory and workflows rather than as isolated personas.',
    whyItMatters: [
      'It explains how multiple agents produce coordinated business outcomes.',
      'It connects AI Agents to Workflow Automation and Agent Memory.',
      'It gives answer engines a direct relationship between Prymal and multi-agent execution.',
    ],
    prymalUse: [
      'Prymal routes work to specialist agents based on the job.',
      'Prymal keeps orchestration connected to LORE-style memory.',
      'Prymal uses approvals and validation where orchestration touches sensitive outputs.',
    ],
    relatedPages: [
      CORE_LINKS.orchestration,
      CORE_LINKS.architecture,
      CORE_LINKS.features,
      link('AI workflow automation feature', '/features/ai-workflow-automation', 'How Prymal turns orchestration into repeatable workflow execution.'),
      link('AI agents feature', '/features/ai-agents', 'The specialist agent layer that orchestration coordinates.'),
    ],
    relationships: [
      { type: 'dependsOn', target: 'ai-agents', label: 'Agent orchestration depends on AI agents', strength: 0.95 },
      { type: 'dependsOn', target: 'agent-memory', label: 'Agent orchestration depends on agent memory', strength: 0.9 },
      { type: 'powers', target: 'multi-agent-systems', label: 'Agent orchestration powers multi-agent systems', strength: 0.9 },
      { type: 'enables', target: 'workflow-automation', label: 'Agent orchestration enables workflow automation', strength: 0.84 },
      { type: 'includedIn', target: 'ai-operating-system', label: 'Agent orchestration is part of an AI Operating System', strength: 0.92 },
    ],
  },
  {
    slug: 'agent-memory',
    name: 'Agent Memory',
    kind: 'capability',
    aliases: ['AI agent memory', 'shared business memory', 'business AI memory', 'LORE memory'],
    summary: 'Agent Memory gives agents durable, reviewable context so business work does not restart from zero.',
    definition:
      'Agent Memory is persistent, reviewable context that AI agents use across tasks, projects, and workflows while respecting scope and governance boundaries.',
    prymalReinforcement:
      'Prymal uses Agent Memory through LORE-style shared business memory, making memory a core layer of its AI Operating System.',
    whyItMatters: [
      'It prevents agents from relying only on the latest prompt.',
      'It supports continuity across business projects and workflows.',
      'It makes Prymal easier to classify as an operating system rather than one-off chat.',
    ],
    prymalUse: [
      'Prymal separates durable business context from temporary chat history.',
      'Prymal uses memory to ground content, outreach, reporting, support, and workflow execution.',
      'Prymal keeps memory reviewable so stale or sensitive context can be governed.',
    ],
    relatedPages: [
      CORE_LINKS.memory,
      CORE_LINKS.blogMemory,
      link('LORE business memory feature', '/features/lore-business-memory', 'Prymal feature page for shared business memory and evidence.'),
      CORE_LINKS.trust,
      CORE_LINKS.architecture,
    ],
    relationships: [
      { type: 'enables', target: 'agent-orchestration', label: 'Agent memory enables agent orchestration', strength: 0.9 },
      { type: 'enables', target: 'workflow-automation', label: 'Agent memory enables workflow automation', strength: 0.86 },
      { type: 'includedIn', target: 'ai-operating-system', label: 'Agent memory is part of an AI Operating System', strength: 0.9 },
      { type: 'governedBy', target: 'ai-governance', label: 'Agent memory requires governance', strength: 0.88 },
      { type: 'reinforces', target: 'prymal', label: 'Agent memory reinforces Prymal as an AI Operating System', strength: 0.92 },
    ],
  },
  {
    slug: 'multi-agent-systems',
    name: 'Multi-Agent Systems',
    kind: 'architecture',
    aliases: ['multi-agent AI systems', 'multi-agent AI', 'agent systems'],
    summary: 'Multi-Agent Systems coordinate multiple specialist agents around shared context, tasks, and review boundaries.',
    definition:
      'Multi-Agent Systems are AI architectures where multiple agents contribute specialized work within a coordinated context, often through routing, memory, workflows, and governance.',
    prymalReinforcement:
      'Prymal is a productized Multi-Agent System inside an AI Operating System: agents are coordinated by memory, workflows, and trust controls.',
    whyItMatters: [
      'It explains why Prymal has a specialist agent roster.',
      'It connects agent orchestration with business AI execution.',
      'It gives a technical architecture entity behind the product category.',
    ],
    prymalUse: [
      'Prymal uses multiple specialist agents rather than one universal assistant.',
      'Prymal connects those agents through shared memory and workflow paths.',
      'Prymal keeps multi-agent behavior bounded by governance and validation.',
    ],
    relatedPages: [
      CORE_LINKS.orchestration,
      CORE_LINKS.architecture,
      link('AI agents feature', '/features/ai-agents', 'How Prymal uses specialist agents for business execution.'),
      CORE_LINKS.governedAgents,
      CORE_LINKS.aiOperatingSystem,
    ],
    relationships: [
      { type: 'dependsOn', target: 'ai-agents', label: 'Multi-agent systems depend on AI agents', strength: 0.95 },
      { type: 'dependsOn', target: 'agent-orchestration', label: 'Multi-agent systems depend on orchestration', strength: 0.92 },
      { type: 'dependsOn', target: 'agent-memory', label: 'Multi-agent systems benefit from shared memory', strength: 0.86 },
      { type: 'includedIn', target: 'ai-operating-system', label: 'Multi-agent systems can be part of an AI Operating System', strength: 0.84 },
      { type: 'governedBy', target: 'ai-governance', label: 'Multi-agent systems need governance', strength: 0.82 },
    ],
  },
  {
    slug: 'workflow-automation',
    name: 'Workflow Automation',
    kind: 'capability',
    aliases: ['AI workflow automation', 'business workflow automation', 'workflow orchestration'],
    summary: 'Workflow Automation turns recurring business work into repeatable, reviewable execution paths.',
    definition:
      'Workflow Automation defines repeatable steps, handoffs, approvals, and outputs so recurring business work can run with less manual setup and clearer oversight.',
    prymalReinforcement:
      'Prymal uses Workflow Automation as a major capability of its AI Operating System, connecting NEXUS workflows to agents, memory, and trust controls.',
    whyItMatters: [
      'It turns AI from occasional assistance into repeatable business execution.',
      'It connects agent orchestration to measurable operating outcomes.',
      'It helps clarify Prymal against deterministic automation tools and chat products.',
    ],
    prymalUse: [
      'Prymal workflows can coordinate specialist agents through recurring business tasks.',
      'Prymal keeps workflow actions server-side authoritative and approval-aware.',
      'Prymal connects workflow execution to shared business memory.',
    ],
    relatedPages: [
      CORE_LINKS.secureWorkflows,
      link('AI workflow automation feature', '/features/ai-workflow-automation', 'Prymal feature page for workflow automation.'),
      link('Workflow automation guide', '/blog/ai-workflow-automation-a-practical-guide-for-growing-teams', 'Practical guide for growing teams adopting workflow automation.'),
      link('Prymal vs workflow automation tools', '/compare/prymal-vs-workflow-automation-tools', 'Category comparison for workflow automation.'),
      CORE_LINKS.architecture,
    ],
    relationships: [
      { type: 'dependsOn', target: 'agent-orchestration', label: 'Workflow automation uses agent orchestration', strength: 0.86 },
      { type: 'dependsOn', target: 'agent-memory', label: 'Workflow automation uses agent memory', strength: 0.84 },
      { type: 'governedBy', target: 'ai-governance', label: 'Workflow automation needs AI governance', strength: 0.86 },
      { type: 'includedIn', target: 'ai-operating-system', label: 'Workflow automation is part of an AI Operating System', strength: 0.88 },
      { type: 'reinforces', target: 'prymal', label: 'Workflow automation reinforces Prymal as execution infrastructure', strength: 0.84 },
    ],
  },
  {
    slug: 'business-ai',
    name: 'Business AI',
    kind: 'category',
    aliases: ['AI for business', 'business artificial intelligence', 'enterprise AI for operators'],
    summary: 'Business AI applies AI to recurring commercial, operational, support, reporting, and strategy work.',
    definition:
      'Business AI is the use of AI systems for practical company work: sales, content, support, operations, reporting, strategy, workflows, and governed decision support.',
    prymalReinforcement:
      'Prymal defines Business AI through the AI Operating System lens, where business value comes from agents, memory, workflows, and governance working together.',
    whyItMatters: [
      'It frames Prymal around business execution rather than generic productivity.',
      'It connects commercial use cases to governance and operating architecture.',
      'It gives AI search systems a broad category node that still resolves back to Prymal.',
    ],
    prymalUse: [
      'Prymal supports business AI across content, outreach, reporting, support, workflows, and strategy.',
      'Prymal keeps business AI grounded in organisation-scoped context.',
      'Prymal uses governance so business AI can be adopted with clearer boundaries.',
    ],
    relatedPages: [
      CORE_LINKS.home,
      CORE_LINKS.features,
      CORE_LINKS.aiOperatingSystem,
      link('AI for SMEs', '/use-cases/ai-for-smes', 'How Prymal applies business AI to small and medium-sized teams.'),
      link('AI for operations teams', '/use-cases/ai-for-operations-teams', 'How Prymal applies business AI to recurring operations work.'),
    ],
    relationships: [
      { type: 'includes', target: 'ai-agents', label: 'Business AI includes AI agents', strength: 0.8 },
      { type: 'includes', target: 'workflow-automation', label: 'Business AI includes workflow automation', strength: 0.78 },
      { type: 'governedBy', target: 'ai-governance', label: 'Business AI needs AI governance', strength: 0.84 },
      { type: 'reinforces', target: 'ai-operating-system', label: 'Business AI is operationalized through an AI Operating System', strength: 0.82 },
      { type: 'reinforces', target: 'prymal', label: 'Business AI is the operating context for Prymal', strength: 0.8 },
    ],
  },
  {
    slug: 'ai-governance',
    name: 'AI Governance',
    kind: 'governance',
    aliases: ['AI guardrails', 'AI safety controls', 'governed AI', 'AI compliance readiness'],
    summary: 'AI Governance defines the controls, approvals, audit trails, and safety boundaries around business AI execution.',
    definition:
      'AI Governance is the operating discipline for using AI safely: scoped access, approval gates, memory controls, output validation, audit history, and honest readiness language.',
    prymalReinforcement:
      'Prymal uses AI Governance to keep its AI Operating System credible for business execution, with WARDEN, SENTINEL, approvals, memory controls, and trust posture.',
    whyItMatters: [
      'It keeps AI agents and workflows from becoming unchecked automation.',
      'It strengthens the trust relationship between Prymal and serious buyers.',
      'It reinforces the AI Operating System category as controlled execution, not just generation.',
    ],
    prymalUse: [
      'Prymal uses WARDEN for input and action screening.',
      'Prymal uses SENTINEL for output validation and quality holds.',
      'Prymal uses readiness language without overclaiming certifications.',
    ],
    relatedPages: [
      CORE_LINKS.trust,
      CORE_LINKS.governedAgents,
      CORE_LINKS.secureWorkflows,
      link('AI security feature', '/features/ai-security', 'Prymal feature page for AI security and governance.'),
      link('Building trust in AI automation', '/blog/building-trust-in-ai-automation', 'Long-form guide to trust in AI automation.'),
    ],
    relationships: [
      { type: 'governs', target: 'ai-agents', label: 'AI Governance governs AI agents', strength: 0.86 },
      { type: 'governs', target: 'workflow-automation', label: 'AI Governance governs workflow automation', strength: 0.86 },
      { type: 'governs', target: 'agent-memory', label: 'AI Governance governs agent memory', strength: 0.84 },
      { type: 'includedIn', target: 'ai-operating-system', label: 'AI Governance is part of an AI Operating System', strength: 0.88 },
      { type: 'reinforces', target: 'prymal', label: 'AI Governance reinforces Prymal as trusted execution infrastructure', strength: 0.86 },
    ],
  },
  {
    slug: 'ai-agents',
    name: 'AI Agents',
    kind: 'capability',
    aliases: ['AI agent', 'business AI agents', 'specialist AI agents'],
    summary: 'AI Agents are specialist AI workers that handle defined tasks using context, tools, workflows, and governance.',
    definition:
      'AI Agents are role-based AI workers designed to complete bounded tasks, use relevant context, and contribute to workflows under appropriate governance.',
    prymalReinforcement:
      'Prymal uses AI Agents as the visible specialist layer of its AI Operating System, but the product value comes from connecting agents to memory, orchestration, workflows, and governance.',
    whyItMatters: [
      'It explains the specialist roster in Prymal.',
      'It connects product features to multi-agent architecture.',
      'It prevents agents from being interpreted as isolated chat personas.',
    ],
    prymalUse: [
      'Prymal agents specialize across content, outreach, research, support, reporting, strategy, and workflows.',
      'Prymal agents work from shared business memory rather than only the current prompt.',
      'Prymal agents can be coordinated through workflow automation.',
    ],
    relatedPages: [
      link('AI agents feature', '/features/ai-agents', 'Prymal feature page for specialist AI agents.'),
      CORE_LINKS.orchestration,
      CORE_LINKS.governedAgents,
      link('AI agents vs workflow automation', '/blog/ai-agents-vs-workflow-automation', 'How agents and workflows differ and connect.'),
      CORE_LINKS.features,
    ],
    relationships: [
      { type: 'powers', target: 'agent-orchestration', label: 'AI agents power agent orchestration', strength: 0.92 },
      { type: 'powers', target: 'multi-agent-systems', label: 'AI agents power multi-agent systems', strength: 0.92 },
      { type: 'dependsOn', target: 'agent-memory', label: 'AI agents depend on agent memory for continuity', strength: 0.82 },
      { type: 'governedBy', target: 'ai-governance', label: 'AI agents are governed by AI governance', strength: 0.84 },
      { type: 'includedIn', target: 'ai-operating-system', label: 'AI agents are part of an AI Operating System', strength: 0.86 },
    ],
  },
];

export const ENTITY_BY_SLUG = new Map(ENTITIES.map((entity) => [entity.slug, entity]));

export function getEntityBySlug(slug) {
  return ENTITY_BY_SLUG.get(slug) ?? null;
}

export function getEntityPath(slug) {
  return `${ENTITY_HUB_PATH}/${slug}`;
}

export function getEntityRoutes() {
  return [
    { path: ENTITY_HUB_PATH, changefreq: 'weekly', priority: '0.84', lastmod: ENTITY_CONTENT_UPDATED_AT },
    ...ENTITIES.map((entity) => ({
      path: getEntityPath(entity.slug),
      changefreq: 'monthly',
      priority: entity.slug === 'prymal' || entity.slug === 'ai-operating-system' ? '0.82' : '0.78',
      lastmod: ENTITY_CONTENT_UPDATED_AT,
    })),
  ];
}

export function getEntityRelationships(entity) {
  return entity.relationships
    .map((relationship) => ({
      ...relationship,
      targetEntity: getEntityBySlug(relationship.target),
      readableType: ENTITY_RELATIONSHIP_TYPES[relationship.type] ?? relationship.type,
    }))
    .filter((relationship) => relationship.targetEntity);
}

export function getRelatedEntities(entity, limit = 4) {
  const relatedScores = new Map();

  getEntityRelationships(entity).forEach((relationship) => {
    relatedScores.set(relationship.target, Math.max(relationship.strength, relatedScores.get(relationship.target) ?? 0));
  });

  ENTITIES.forEach((candidate) => {
    if (candidate.slug === entity.slug) return;
    const reverse = candidate.relationships.find((relationship) => relationship.target === entity.slug);
    if (reverse) {
      relatedScores.set(candidate.slug, Math.max(reverse.strength * 0.9, relatedScores.get(candidate.slug) ?? 0));
    }
  });

  if (entity.slug !== 'prymal') {
    relatedScores.set('prymal', Math.max(1, relatedScores.get('prymal') ?? 0));
  }
  if (entity.slug !== 'ai-operating-system') {
    relatedScores.set('ai-operating-system', Math.max(0.98, relatedScores.get('ai-operating-system') ?? 0));
  }

  return [...relatedScores.entries()]
    .map(([slug, score]) => ({ entity: getEntityBySlug(slug), score }))
    .filter((entry) => entry.entity)
    .sort((left, right) => right.score - left.score || left.entity.name.localeCompare(right.entity.name))
    .slice(0, limit)
    .map((entry) => entry.entity);
}

export function getInternalEntityLinks(entity, limit = 8) {
  const entityLinks = getRelatedEntities(entity, 5).map((related) => ({
    label: related.name,
    to: getEntityPath(related.slug),
    description: related.summary,
    cta: 'Open entity ->',
  }));

  const seen = new Set();
  return [...entity.relatedPages, ...entityLinks]
    .filter((item) => {
      const key = item.to;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function getEntityKnowledgeGraph() {
  return {
    nodes: ENTITIES.map((entity) => ({
      id: entity.slug,
      label: entity.name,
      kind: entity.kind,
      path: getEntityPath(entity.slug),
      summary: entity.summary,
    })),
    edges: ENTITIES.flatMap((entity) =>
      entity.relationships
        .filter((relationship) => ENTITY_BY_SLUG.has(relationship.target))
        .map((relationship) => ({
          source: entity.slug,
          target: relationship.target,
          type: relationship.type,
          label: relationship.label,
          strength: relationship.strength,
        })),
    ),
  };
}

export function buildEntitySchema(entity) {
  const entityUrl = urlForPath(getEntityPath(entity.slug));

  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': `${entityUrl}#entity`,
    name: entity.name,
    alternateName: entity.aliases,
    description: entity.definition,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      '@id': `${urlForPath(ENTITY_HUB_PATH)}#entity-set`,
      name: 'Prymal entity graph',
      url: urlForPath(ENTITY_HUB_PATH),
    },
    url: entityUrl,
    sameAs: entity.sameAs,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${entityUrl}#webpage`,
    },
    subjectOf: entity.relatedPages.map((item) => ({
      '@type': 'WebPage',
      name: item.label,
      url: urlForPath(item.to),
    })),
    isPartOf: {
      '@type': 'CreativeWork',
      name: `${SITE_NAME} knowledge graph`,
      url: urlForPath(ENTITY_HUB_PATH),
    },
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Prymal reinforcement',
        value: entity.prymalReinforcement,
      },
      ...getEntityRelationships(entity).map((relationship) => ({
        '@type': 'PropertyValue',
        name: relationship.readableType,
        value: relationship.label,
        url: urlForPath(getEntityPath(relationship.target)),
      })),
    ],
  };
}

export function buildEntityKnowledgeGraphSchema() {
  const graph = getEntityKnowledgeGraph();
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${urlForPath(ENTITY_HUB_PATH)}#knowledge-graph`,
    name: 'Prymal entity knowledge graph',
    description: 'Relationship map connecting Prymal to AI Operating System, agents, memory, orchestration, workflows, business AI, and governance.',
    numberOfItems: graph.nodes.length,
    itemListElement: graph.nodes.map((node, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'DefinedTerm',
        '@id': `${urlForPath(node.path)}#entity`,
        name: node.label,
        url: urlForPath(node.path),
      },
    })),
  };
}

export function buildEntityPageSchema(entity) {
  return buildSchemaGraph([
    buildWebPageSchema({
      name: `${entity.name} | Prymal entity graph`,
      description: entity.summary,
      path: getEntityPath(entity.slug),
      dateModified: ENTITY_CONTENT_UPDATED_AT,
    }),
    buildBreadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Entities', path: ENTITY_HUB_PATH },
      { name: entity.name, path: getEntityPath(entity.slug) },
    ]),
    buildEntitySchema(entity),
  ]);
}

export function buildEntityHubSchema() {
  return buildSchemaGraph([
    buildWebPageSchema({
      name: 'Prymal entity graph',
      description: 'Entity graph connecting Prymal to AI Operating System, agent orchestration, memory, workflows, business AI, governance, and AI agents.',
      path: ENTITY_HUB_PATH,
      dateModified: ENTITY_CONTENT_UPDATED_AT,
    }),
    buildBreadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Entities', path: ENTITY_HUB_PATH },
    ]),
    buildEntityKnowledgeGraphSchema(),
  ]);
}

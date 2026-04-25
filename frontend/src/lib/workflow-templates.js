function workflowNode(id, agentId, outputVar, label, prompt, position, conditions) {
  return {
    id,
    agentId,
    outputVar,
    label,
    prompt,
    position,
    ...(conditions?.length ? { conditions } : {}),
  };
}

function workflowEdge(from, to, condition) {
  return {
    from,
    to,
    ...(condition ? { condition } : {}),
  };
}

function pos(col, row = 0) {
  return {
    x: 64 + (col * 228),
    y: 44 + (row * 154),
  };
}

function withDerivedTemplateMeta(template) {
  const agentIds = [...new Set(template.nodes.map((node) => node.agentId))];
  const positions = template.nodes.map((node) => node.position ?? { x: 0, y: 0 });
  const maxX = Math.max(...positions.map((position) => position.x), 0);
  const maxY = Math.max(...positions.map((position) => position.y), 0);

  return {
    ...template,
    agentIds,
    stepCount: template.nodes.length,
    branchCount: template.edges.length > Math.max(template.nodes.length - 1, 0)
      ? template.edges.length - Math.max(template.nodes.length - 1, 0)
      : 0,
    diagramSize: {
      width: maxX + 240,
      height: maxY + 132,
    },
  };
}

const RAW_WORKFLOW_TEMPLATES = [
  {
    slug: 'weekly-client-report',
    category: 'Reporting',
    featured: true,
    difficulty: 'Easy',
    setupTime: '10 min',
    name: 'Weekly Client Report',
    description: 'Turn raw client metrics into a polished weekly email without rebuilding the narrative each Monday.',
    outcome: 'A send-ready weekly client update with numbers, interpretation, and delivery copy.',
    bestFor: 'Agencies and service teams running recurring reporting.',
    triggerSummary: 'Runs every Monday morning.',
    triggerType: 'schedule',
    triggerConfig: { cron: '0 8 * * 1' },
    nodes: [
      workflowNode(
        'cipher_metrics',
        'cipher',
        'metrics_summary',
        'Analyse metrics',
        'Analyse the latest weekly metrics and produce an executive summary with highlights, risks, and unusual changes.',
        pos(0, 0),
      ),
      workflowNode(
        'ledger_report',
        'ledger',
        'report_narrative',
        'Write report',
        'Turn the metrics summary into a client-ready plain-English weekly report with clear performance movement, wins, and watchouts.',
        pos(1, 0),
      ),
      workflowNode(
        'herald_delivery',
        'herald',
        'delivery_email',
        'Format delivery',
        'Format the weekly report as a polished stakeholder email with a sharp subject line, clean structure, and a clear next-step CTA.',
        pos(2, 0),
      ),
    ],
    edges: [
      workflowEdge('cipher_metrics', 'ledger_report'),
      workflowEdge('ledger_report', 'herald_delivery'),
    ],
  },
  {
    slug: 'content-signal-to-campaign',
    category: 'Growth',
    featured: true,
    difficulty: 'Medium',
    setupTime: '15 min',
    name: 'Content Signal to Campaign',
    description: 'Spot a market opening, shape the search angle, draft the asset, then turn it into a multi-channel campaign.',
    outcome: 'One research-led content opportunity converted into article, social, and creative directions.',
    bestFor: 'Founder-led brands, agencies, and content teams.',
    triggerSummary: 'Run manually whenever you need a fresh campaign lane.',
    triggerType: 'manual',
    triggerConfig: {},
    nodes: [
      workflowNode(
        'scout_signal',
        'scout',
        'market_signal',
        'Find opening',
        'Identify one strong content opportunity in our niche and explain why it matters now, who cares, and what angle feels underused.',
        pos(0, 0),
      ),
      workflowNode(
        'oracle_brief',
        'oracle',
        'seo_brief',
        'Shape search brief',
        'Build a concise SEO brief from the market signal with target keyword, intent, opportunity, and required content sections.',
        pos(1, 0),
      ),
      workflowNode(
        'forge_draft',
        'forge',
        'article_draft',
        'Draft anchor asset',
        'Write a premium B2B SaaS first draft based on the SEO brief with strong structure, sharp positioning, and useful detail.',
        pos(2, 0),
      ),
      workflowNode(
        'echo_campaign',
        'echo',
        'social_pack',
        'Repurpose campaign',
        'Repurpose the anchor asset into platform-native social posts with distinct hooks, angles, and CTAs.',
        pos(3, 0),
      ),
      workflowNode(
        'pixel_creative',
        'pixel',
        'creative_direction',
        'Creative direction',
        'Turn the campaign into visual creative directions for social graphics or short promo scenes, including mood, layout, and CTA guidance.',
        pos(4, 0),
      ),
    ],
    edges: [
      workflowEdge('scout_signal', 'oracle_brief'),
      workflowEdge('oracle_brief', 'forge_draft'),
      workflowEdge('forge_draft', 'echo_campaign'),
      workflowEdge('echo_campaign', 'pixel_creative'),
    ],
  },
  {
    slug: 'lead-intake-to-proposal',
    category: 'Sales',
    featured: true,
    difficulty: 'Medium',
    setupTime: '12 min',
    name: 'Lead Intake to Proposal',
    description: 'Score a new lead, pressure-test the fit, scope the delivery path, and draft the first commercial response.',
    outcome: 'A qualified lead summary, delivery posture, and send-ready proposal or follow-up email.',
    bestFor: 'Agencies, consultancies, and high-touch service businesses.',
    triggerSummary: 'Listens for new lead events from CRM or form capture.',
    triggerType: 'event',
    triggerConfig: { eventType: 'crm.lead.created' },
    nodes: [
      workflowNode(
        'vance_score',
        'vance',
        'lead_score',
        'Score lead',
        'Score the incoming lead against our ICP and summarise urgency, budget signals, fit, and the strongest buying signals.',
        pos(0, 0),
      ),
      workflowNode(
        'sage_posture',
        'sage',
        'deal_posture',
        'Assess posture',
        'Review the scored opportunity and explain strategic upside, delivery risk, and recommended deal posture.',
        pos(1, 0),
      ),
      workflowNode(
        'atlas_scope',
        'atlas',
        'delivery_scope',
        'Map delivery scope',
        'Translate the opportunity into a practical delivery outline with milestones, dependencies, and likely effort.',
        pos(2, 0),
      ),
      workflowNode(
        'herald_reply',
        'herald',
        'proposal_email',
        'Draft reply',
        'Draft a confident follow-up or proposal email that advances the conversation using the recommended deal posture and scope.',
        pos(3, 0),
      ),
    ],
    edges: [
      workflowEdge('vance_score', 'sage_posture'),
      workflowEdge('sage_posture', 'atlas_scope'),
      workflowEdge('atlas_scope', 'herald_reply'),
    ],
  },
  {
    slug: 'support-triage-and-response',
    category: 'Support',
    difficulty: 'Medium',
    setupTime: '15 min',
    name: 'Support Triage and Response',
    description: 'Classify the issue, pull the right knowledge, branch to escalation when needed, then QA the final response.',
    outcome: 'A grounded customer reply with escalation support only when the ticket truly needs it.',
    bestFor: 'Support teams, client success, and service operations.',
    triggerSummary: 'Responds to new support-ticket events.',
    triggerType: 'event',
    triggerConfig: { eventType: 'support.ticket.created' },
    nodes: [
      workflowNode(
        'wren_triage',
        'wren',
        'ticket_assessment',
        'Assess ticket',
        'Summarise the customer issue, likely urgency, customer sentiment, and whether the case should be escalated.',
        pos(0, 0),
      ),
      workflowNode(
        'lore_lookup',
        'lore',
        'knowledge_context',
        'Retrieve knowledge',
        'Pull the most relevant SOPs, FAQ entries, and policy details that help resolve the ticket accurately.',
        pos(1, 0),
      ),
      workflowNode(
        'atlas_escalation',
        'atlas',
        'escalation_plan',
        'Escalation path',
        'If escalation is needed, outline the fastest internal resolution path, owner, and dependencies.',
        pos(1, 1),
        [{ field: 'ticket_assessment', operator: 'contains', value: 'escalate' }],
      ),
      workflowNode(
        'wren_reply',
        'wren',
        'customer_reply',
        'Draft response',
        'Draft a calm, useful customer response using the knowledge context and any escalation plan that was produced.',
        pos(2, 0),
      ),
      workflowNode(
        'sentinel_review',
        'sentinel',
        'qa_verdict',
        'Review before send',
        'Review the support response for tone, unsupported claims, risky promises, or missing resolution details before delivery.',
        pos(3, 0),
      ),
    ],
    edges: [
      workflowEdge('wren_triage', 'lore_lookup'),
      workflowEdge('wren_triage', 'atlas_escalation', 'Escalate if needed'),
      workflowEdge('lore_lookup', 'wren_reply'),
      workflowEdge('atlas_escalation', 'wren_reply'),
      workflowEdge('wren_reply', 'sentinel_review'),
    ],
  },
  {
    slug: 'monthly-exec-operating-review',
    category: 'Operations',
    difficulty: 'Medium',
    setupTime: '15 min',
    name: 'Monthly Executive Operating Review',
    description: 'Turn the month into a leadership review that combines numbers, narrative, strategic judgment, and action items.',
    outcome: 'A board-style review with performance movement, implications, and execution priorities.',
    bestFor: 'Founders, operators, and agency leadership teams.',
    triggerSummary: 'Runs automatically on the first day of each month.',
    triggerType: 'schedule',
    triggerConfig: { cron: '0 7 1 * *' },
    nodes: [
      workflowNode(
        'cipher_analysis',
        'cipher',
        'performance_analysis',
        'Analyse movement',
        'Review the latest monthly metrics and isolate the most important changes, anomalies, and performance drivers.',
        pos(0, 0),
      ),
      workflowNode(
        'ledger_summary',
        'ledger',
        'finance_summary',
        'Translate finances',
        'Turn the operating movement into a plain-English financial summary that leaders can read quickly.',
        pos(1, 0),
      ),
      workflowNode(
        'sage_implications',
        'sage',
        'strategic_implications',
        'Stress-test implications',
        'Interpret the performance summary and recommend the strategic implications, trade-offs, and priorities for the next month.',
        pos(2, 0),
      ),
      workflowNode(
        'atlas_actions',
        'atlas',
        'action_plan',
        'Convert to action',
        'Turn the strategic implications into a practical operating plan with owners, milestones, and key risks.',
        pos(3, 0),
      ),
    ],
    edges: [
      workflowEdge('cipher_analysis', 'ledger_summary'),
      workflowEdge('ledger_summary', 'sage_implications'),
      workflowEdge('sage_implications', 'atlas_actions'),
    ],
  },
  {
    slug: 'competitor-watch-to-positioning-alert',
    category: 'Strategy',
    difficulty: 'Easy',
    setupTime: '10 min',
    name: 'Competitor Watch to Positioning Alert',
    description: 'Track market movement and convert competitor changes into a crisp internal positioning note.',
    outcome: 'A research-backed alert that explains what changed, why it matters, and how to respond.',
    bestFor: 'Strategy, growth, and agency leadership teams.',
    triggerSummary: 'Runs weekly to keep positioning fresh.',
    triggerType: 'schedule',
    triggerConfig: { cron: '0 9 * * 1-5' },
    nodes: [
      workflowNode(
        'scout_competitors',
        'scout',
        'competitor_changes',
        'Scan competitors',
        'Summarise the most relevant competitor moves, positioning changes, launches, and market signals from the last cycle.',
        pos(0, 0),
      ),
      workflowNode(
        'sage_response',
        'sage',
        'strategic_response',
        'Interpret move',
        'Explain what the competitor movement means for our positioning, risk, and opportunity.',
        pos(1, 0),
      ),
      workflowNode(
        'forge_alert',
        'forge',
        'internal_memo',
        'Draft memo',
        'Turn the strategic response into an internal memo with concise narrative, implications, and recommended action.',
        pos(2, 0),
      ),
      workflowNode(
        'herald_distribution',
        'herald',
        'alert_email',
        'Format alert',
        'Format the memo as a crisp internal alert for founders or account leads with clear next steps.',
        pos(3, 0),
      ),
    ],
    edges: [
      workflowEdge('scout_competitors', 'sage_response'),
      workflowEdge('sage_response', 'forge_alert'),
      workflowEdge('forge_alert', 'herald_distribution'),
    ],
  },
  {
    slug: 'onboarding-kickoff-and-sop-pack',
    category: 'Client delivery',
    difficulty: 'Medium',
    setupTime: '15 min',
    name: 'Onboarding Kickoff and SOP Pack',
    description: 'Take a new client brief, align the delivery plan, surface relevant SOPs, and package the kickoff materials.',
    outcome: 'A cleaner onboarding motion with a plan, source-backed context, and client-facing kickoff assets.',
    bestFor: 'Agencies and operational service teams.',
    triggerSummary: 'Run when a new client or project is won.',
    triggerType: 'manual',
    triggerConfig: {},
    nodes: [
      workflowNode(
        'atlas_plan',
        'atlas',
        'kickoff_plan',
        'Build plan',
        'Turn the new client brief into a phased onboarding plan with milestones, owners, dependencies, and early risks.',
        pos(0, 0),
      ),
      workflowNode(
        'lore_sops',
        'lore',
        'sop_pack',
        'Surface SOPs',
        'Retrieve the SOPs, checklists, and past examples most relevant to this onboarding plan.',
        pos(1, 0),
      ),
      workflowNode(
        'forge_materials',
        'forge',
        'kickoff_doc',
        'Create kickoff doc',
        'Write a polished kickoff summary that combines the onboarding plan with the relevant SOP context.',
        pos(2, 0),
      ),
      workflowNode(
        'herald_client_send',
        'herald',
        'kickoff_email',
        'Draft kickoff email',
        'Draft a client-facing kickoff email that sets expectations, timeline, and next steps clearly.',
        pos(3, 0),
      ),
    ],
    edges: [
      workflowEdge('atlas_plan', 'lore_sops'),
      workflowEdge('lore_sops', 'forge_materials'),
      workflowEdge('forge_materials', 'herald_client_send'),
    ],
  },
  {
    slug: 'seo-brief-to-publish-pack',
    category: 'Content ops',
    difficulty: 'Easy',
    setupTime: '12 min',
    name: 'SEO Brief to Publish Pack',
    description: 'Turn one topic into a publish-ready pack: SEO brief, article, social cut-downs, and visual direction.',
    outcome: 'A multi-format publishing bundle from one search-led starting point.',
    bestFor: 'Content teams, agencies, and founder-led brands.',
    triggerSummary: 'Manual workflow for each priority topic.',
    triggerType: 'manual',
    triggerConfig: {},
    nodes: [
      workflowNode(
        'oracle_topic',
        'oracle',
        'seo_brief',
        'Create SEO brief',
        'Create an SEO brief with keyword target, search intent, angle, and outline for the chosen topic.',
        pos(0, 0),
      ),
      workflowNode(
        'forge_article',
        'forge',
        'article_draft',
        'Write article',
        'Write a polished article draft from the SEO brief with strong narrative, clarity, and useful specificity.',
        pos(1, 0),
      ),
      workflowNode(
        'echo_snippets',
        'echo',
        'social_snippets',
        'Break into snippets',
        'Convert the article into short-form social posts, hooks, and promotion snippets.',
        pos(2, 0),
      ),
      workflowNode(
        'pixel_visuals',
        'pixel',
        'visual_pack',
        'Visual pack',
        'Create visual directions for cover art, supporting graphics, and carousel concepts that suit the content pack.',
        pos(3, 0),
      ),
    ],
    edges: [
      workflowEdge('oracle_topic', 'forge_article'),
      workflowEdge('forge_article', 'echo_snippets'),
      workflowEdge('echo_snippets', 'pixel_visuals'),
    ],
  },
  {
    slug: 'renewal-risk-recovery',
    category: 'Revenue retention',
    difficulty: 'Medium',
    setupTime: '12 min',
    name: 'Renewal Risk Recovery',
    description: 'Flag accounts at risk, decide the right posture, and prepare both the commercial and communication response.',
    outcome: 'A recovery plan for at-risk clients before renewal conversations drift.',
    bestFor: 'Agencies, account teams, and recurring-revenue businesses.',
    triggerSummary: 'Run weekly against health or renewal signals.',
    triggerType: 'schedule',
    triggerConfig: { cron: '0 9 * * 1' },
    nodes: [
      workflowNode(
        'cipher_health',
        'cipher',
        'account_health',
        'Analyse account health',
        'Analyse account performance and service signals to identify churn or renewal risk.',
        pos(0, 0),
      ),
      workflowNode(
        'sage_strategy',
        'sage',
        'retention_strategy',
        'Choose posture',
        'Recommend the smartest retention posture based on account health, risk, and upside.',
        pos(1, 0),
      ),
      workflowNode(
        'herald_message',
        'herald',
        'client_message',
        'Draft client message',
        'Draft the client-facing recovery or renewal email using the recommended posture and supporting context.',
        pos(2, 0),
      ),
      workflowNode(
        'vance_offer',
        'vance',
        'commercial_move',
        'Commercial move',
        'Shape the commercial recovery plan, negotiation angle, or renewal offer that gives the account the best chance of retention.',
        pos(3, 0),
      ),
    ],
    edges: [
      workflowEdge('cipher_health', 'sage_strategy'),
      workflowEdge('sage_strategy', 'herald_message'),
      workflowEdge('herald_message', 'vance_offer'),
    ],
  },
  {
    slug: 'launch-campaign-war-room',
    category: 'Launch',
    featured: true,
    difficulty: 'Advanced',
    setupTime: '20 min',
    name: 'Launch Campaign War Room',
    description: 'Research the market, shape the SEO and message angle, write the campaign core, then QA the creative lane before publish.',
    outcome: 'A premium launch lane with strategy, narrative, repurposing, and a quality gate.',
    bestFor: 'Serious product launches, campaigns, and agency delivery sprints.',
    triggerSummary: 'Manual launch workflow for high-stakes campaigns.',
    triggerType: 'manual',
    triggerConfig: {},
    nodes: [
      workflowNode(
        'scout_market',
        'scout',
        'launch_signal',
        'Research launch angle',
        'Summarise the market conversation, whitespace, and competitor framing relevant to this launch.',
        pos(0, 0),
      ),
      workflowNode(
        'oracle_search',
        'oracle',
        'search_strategy',
        'Search strategy',
        'Define the search-intent angle, keyword cluster, and discoverability strategy for this launch.',
        pos(1, 0),
      ),
      workflowNode(
        'forge_core',
        'forge',
        'launch_narrative',
        'Write campaign core',
        'Write the core launch narrative with headline, key proof, value proposition, and CTA structure.',
        pos(2, 0),
      ),
      workflowNode(
        'echo_channel_pack',
        'echo',
        'channel_pack',
        'Channel rollout',
        'Break the launch narrative into channel-specific social and announcement assets.',
        pos(3, 0),
      ),
      workflowNode(
        'pixel_direction',
        'pixel',
        'visual_direction',
        'Visual direction',
        'Create a clear visual direction for launch creative, including hero art, social panels, or promo scene ideas.',
        pos(4, 0),
      ),
      workflowNode(
        'sentinel_gate',
        'sentinel',
        'launch_review',
        'Quality gate',
        'Review the assembled launch pack for unsupported claims, weak logic, or quality issues before the team publishes it.',
        pos(5, 0),
      ),
    ],
    edges: [
      workflowEdge('scout_market', 'oracle_search'),
      workflowEdge('oracle_search', 'forge_core'),
      workflowEdge('forge_core', 'echo_channel_pack'),
      workflowEdge('echo_channel_pack', 'pixel_direction'),
      workflowEdge('pixel_direction', 'sentinel_gate'),
    ],
  },
];

export const WORKFLOW_TEMPLATES = RAW_WORKFLOW_TEMPLATES.map(withDerivedTemplateMeta);

export const FEATURED_WORKFLOW_TEMPLATE_SLUGS = WORKFLOW_TEMPLATES
  .filter((template) => template.featured)
  .map((template) => template.slug);

export function getFeaturedWorkflowTemplates(limit = 4) {
  return WORKFLOW_TEMPLATES.filter((template) => template.featured).slice(0, limit);
}

export function findWorkflowTemplate(identifier) {
  const normalized = String(identifier ?? '').trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return WORKFLOW_TEMPLATES.find((template) => (
    template.slug === normalized || template.name.toLowerCase() === normalized
  )) ?? null;
}

export function createWorkflowTemplatePayload(templateInput) {
  const template = typeof templateInput === 'string' ? findWorkflowTemplate(templateInput) : templateInput;

  if (!template) {
    return null;
  }

  return {
    name: template.name,
    description: template.description,
    triggerType: template.triggerType,
    triggerConfig: template.triggerConfig,
    nodes: template.nodes.map((node) => ({
      id: node.id,
      agentId: node.agentId,
      outputVar: node.outputVar,
      label: node.label,
      prompt: node.prompt,
      ...(node.conditions?.length ? { conditions: node.conditions } : {}),
    })),
    edges: template.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      ...(edge.condition ? { condition: edge.condition } : {}),
    })),
  };
}

export function getRecommendedWorkflowTemplateForProfile({ primaryGoal = '', workspaceFocus = '' } = {}) {
  const goal = String(primaryGoal).toLowerCase();
  const focus = String(workspaceFocus).toLowerCase();

  if (goal.includes('support')) {
    return findWorkflowTemplate('support-triage-and-response');
  }

  if (goal.includes('report') || goal.includes('data')) {
    return findWorkflowTemplate('weekly-client-report');
  }

  if (goal.includes('workflow') || goal.includes('automate')) {
    return findWorkflowTemplate('launch-campaign-war-room');
  }

  if (goal.includes('lead') || goal.includes('proposal')) {
    return findWorkflowTemplate('lead-intake-to-proposal');
  }

  if (goal.includes('content')) {
    return findWorkflowTemplate('content-signal-to-campaign');
  }

  return focus === 'agency'
    ? findWorkflowTemplate('content-signal-to-campaign')
    : findWorkflowTemplate('weekly-client-report');
}

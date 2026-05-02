const WORKFLOW_READY_AGENTS = new Set(['forge', 'herald', 'echo', 'cipher', 'oracle', 'wren', 'nexus']);

const WORKFLOW_PATTERNS = [
  /content plan|content calendar|post(s)?|brief|campaign/i,
  /outreach|sequence|follow[- ]?up|lead/i,
  /report|dashboard|weekly|monthly|analysis|anomal/i,
  /support response|reply pattern|template/i,
  /seo|keyword|landing page/i,
  /workflow|repeat|recurring|process|system/i,
];

function trimForPrompt(value, limit = 900) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function workflowNode(id, agentId, outputVar, label, prompt, x) {
  return {
    id,
    agentId,
    outputVar,
    label,
    prompt,
    position: { x, y: 64 },
  };
}

export function isWorkflowCandidate({ agentId, content }) {
  const text = String(content ?? '').trim();
  if (!WORKFLOW_READY_AGENTS.has(agentId) || text.length < 160) {
    return false;
  }
  return WORKFLOW_PATTERNS.some((pattern) => pattern.test(text));
}

export function createWorkflowDraftFromChat({ agentId, content }) {
  const seed = trimForPrompt(content);
  const isReporting = /report|analysis|metric|anomal|data/i.test(seed);
  const isLead = /outreach|lead|sequence|proposal|follow/i.test(seed);
  const isContent = /content|post|campaign|brief|seo|landing/i.test(seed);

  const nodes = [];
  if (isReporting) {
    nodes.push(
      workflowNode('cipher_review', 'cipher', 'analysis_summary', 'Analyse latest input', `Use the latest pasted report or metrics and produce trends, anomalies, risks, and actions.\n\nReference result:\n${seed}`, 64),
      workflowNode('sentinel_review', 'sentinel', 'qa_review', 'Review evidence', 'Check the analysis for unsupported claims, missing evidence, and risky recommendations. Return safe edits only.', 292),
      workflowNode('herald_delivery', 'herald', 'stakeholder_update', 'Package update', 'Format the reviewed analysis as a concise stakeholder update with clear next actions.', 520),
    );
  } else if (isLead) {
    nodes.push(
      workflowNode('vance_strategy', 'vance', 'lead_plan', 'Plan lead motion', `Turn this successful lead output into a repeatable outreach system.\n\nReference result:\n${seed}`, 64),
      workflowNode('herald_sequence', 'herald', 'outreach_sequence', 'Draft sequence', 'Create the email or message sequence from the lead plan with follow-up timing.', 292),
      workflowNode('sentinel_review', 'sentinel', 'safety_review', 'Review before use', 'Check the sequence for risky claims, privacy issues, and unsupported promises.', 520),
    );
  } else {
    nodes.push(
      workflowNode('oracle_context', 'oracle', 'topic_context', 'Gather context', `Collect or summarise the key context needed to repeat this result.\n\nReference result:\n${seed}`, 64),
      workflowNode('forge_draft', isContent ? 'forge' : agentId, 'draft_output', 'Draft output', 'Create the repeatable first draft using the gathered context and the saved successful result as style guidance.', 292),
      workflowNode('sentinel_review', 'sentinel', 'qa_review', 'Review quality', 'Check the draft for unsupported claims, gaps, and unsafe assumptions before delivery.', 520),
      workflowNode('echo_format', 'echo', 'channel_ready_asset', 'Format for channel', 'Turn the reviewed draft into a channel-ready asset with headline, CTA, and formatting.', 748),
    );
  }

  return {
    slug: `chat-draft-${Date.now()}`,
    category: 'Draft',
    difficulty: 'Easy',
    setupTime: '5 min',
    name: 'Reusable process from chat',
    description: 'Drafted from a useful chat result. Review the steps, then save it inactive until you are ready to run it.',
    outcome: 'A repeatable workflow blueprint based on the chat result.',
    bestFor: 'Repeating a useful Prymal answer without rebuilding the prompt every time.',
    triggerSummary: 'Manual trigger. You can add a schedule later if Trigger.dev is configured.',
    triggerType: 'manual',
    triggerConfig: {},
    nodes,
    edges: nodes.slice(1).map((node, index) => ({
      from: nodes[index].id,
      to: node.id,
    })),
  };
}

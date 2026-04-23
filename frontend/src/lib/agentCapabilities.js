// ---------------------------------------------------------------------------
// frontend/src/lib/agentCapabilities.js
// Editorial capability boundaries per agent. Mirrors the backend contracts
// (allowedTools, schemaEnforced, useLore) but renders them in plain language
// so users know which agent fits before they send a prompt.
// ---------------------------------------------------------------------------

const CAPABILITIES = {
  cipher: {
    notIdealFor: ['Creative copy', 'Brand voice work', 'Image generation'],
    capabilities: ['Uses LORE', 'Structured output', 'Schema-enforced'],
  },
  herald: {
    notIdealFor: ['Long-form research', 'Numerical analysis', 'Operational planning'],
    capabilities: ['Uses LORE', 'Structured output', 'Sends email', 'Schema-enforced'],
  },
  lore: {
    notIdealFor: ['Net-new writing', 'Creative ideation', 'Forecasting'],
    capabilities: ['Source-backed answers', 'Trust scoring', 'Knowledge gap detection'],
  },
  forge: {
    notIdealFor: ['Hard data analysis', 'Operations planning', 'Live web research'],
    capabilities: ['Uses LORE', 'Structured output', 'Schema-enforced'],
  },
  atlas: {
    notIdealFor: ['Creative copy', 'Visual design', 'Net-new research'],
    capabilities: ['Uses LORE', 'Structured output', 'Schema-enforced', 'Strict runtime'],
  },
  echo: {
    notIdealFor: ['Quantitative analysis', 'Long-form research', 'Operations planning'],
    capabilities: ['Uses LORE', 'Brand-voice tuned'],
  },
  pixel: {
    notIdealFor: ['Numerical work', 'Outbound writing', 'Process planning'],
    capabilities: ['Generates images', 'Creative briefs'],
  },
  oracle: {
    notIdealFor: ['Creative copy', 'Image work', 'Operational planning'],
    capabilities: ['Live web research', 'Uses LORE', 'Structured output', 'Strict runtime'],
  },
  vance: {
    notIdealFor: ['Casual chat', 'Creative copy', 'Brand voice work'],
    capabilities: ['Uses LORE', 'Structured output', 'Schema-enforced', 'Strict runtime'],
  },
  wren: {
    notIdealFor: ['Marketing copy', 'Visual work', 'Quantitative analysis'],
    capabilities: ['Uses LORE', 'Escalation aware', 'Strict runtime'],
  },
  ledger: {
    notIdealFor: ['Creative copy', 'Brand voice', 'Free-form chat'],
    capabilities: ['Uses LORE', 'Structured output', 'Citation required', 'Schema-enforced'],
  },
  nexus: {
    notIdealFor: ['Creative writing', 'One-off chat answers', 'Visual work'],
    capabilities: ['Workflow orchestration', 'Structured output', 'Schema-enforced', 'Strict runtime'],
  },
  scout: {
    notIdealFor: ['Long-form drafting', 'Image work', 'Operational planning'],
    capabilities: ['Live web research', 'Uses LORE', 'Structured output', 'Strict runtime'],
  },
  sage: {
    notIdealFor: ['Live web breaking news', 'Image work', 'Outbound writing'],
    capabilities: ['Uses LORE', 'Structured output', 'Strict runtime'],
  },
  sentinel: {
    notIdealFor: ['Direct chat answers', 'Drafting', 'Research'],
    capabilities: ['Reviews other agents', 'PASS/REPAIR/HOLD verdicts'],
  },
};

const EMPTY_CAPABILITIES = { notIdealFor: [], capabilities: [] };

export function getAgentCapabilities(agentId) {
  return CAPABILITIES[agentId] ?? EMPTY_CAPABILITIES;
}

const CAPABILITY_TONE = {
  'Uses LORE': 'lore',
  'Source-backed answers': 'lore',
  'Trust scoring': 'lore',
  'Knowledge gap detection': 'lore',
  'Structured output': 'structure',
  'Schema-enforced': 'structure',
  'Citation required': 'structure',
  'Strict runtime': 'strict',
  'Live web research': 'live',
  'Sends email': 'side_effect',
  'Workflow orchestration': 'side_effect',
  'Generates images': 'side_effect',
  'Reviews other agents': 'oversight',
  'PASS/REPAIR/HOLD verdicts': 'oversight',
  'Escalation aware': 'oversight',
  'Brand-voice tuned': 'voice',
  'Creative briefs': 'voice',
};

export function getCapabilityTone(label) {
  return CAPABILITY_TONE[label] ?? 'default';
}

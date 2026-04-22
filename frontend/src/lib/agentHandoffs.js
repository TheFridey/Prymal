// ---------------------------------------------------------------------------
// frontend/src/lib/agentHandoffs.js
// Handoff suggestion map. Mirrors the contracts.js escalationRules in plain
// language so users can move work to the right specialist with one click.
// Each entry: { to, label, when } — `when` is a short trigger hint shown to
// the user, `label` is the action button copy.
// ---------------------------------------------------------------------------

const HANDOFFS = {
  cipher: [
    { to: 'ledger', label: 'Send to LEDGER for accounting interpretation', when: 'finance nuance matters' },
    { to: 'forge', label: 'Send to FORGE to write the narrative', when: 'numbers need a story' },
  ],
  herald: [
    { to: 'vance', label: 'Send to VANCE for deal qualification', when: 'lead context is strategic' },
    { to: 'forge', label: 'Send to FORGE to refine voice', when: 'copy needs more polish' },
  ],
  lore: [
    { to: 'forge', label: 'Send to FORGE to write from this evidence', when: 'evidence is ready to draft' },
    { to: 'oracle', label: 'Send to ORACLE for live web context', when: 'knowledge base is incomplete' },
  ],
  forge: [
    { to: 'echo', label: 'Send to ECHO for social repurposing', when: 'long-form is ready to break apart' },
    { to: 'herald', label: 'Send to HERALD for outbound delivery', when: 'copy is ready to ship as email' },
  ],
  atlas: [
    { to: 'nexus', label: 'Send to NEXUS to automate this plan', when: 'execution should become repeatable' },
    { to: 'ledger', label: 'Send to LEDGER for budget impact', when: 'plan needs financial framing' },
  ],
  echo: [
    { to: 'forge', label: 'Send to FORGE for the long-form source', when: 'base content is missing' },
    { to: 'pixel', label: 'Send to PIXEL for matching visuals', when: 'social needs imagery' },
  ],
  pixel: [
    { to: 'forge', label: 'Send to FORGE for matching copy', when: 'visuals need supporting language' },
  ],
  oracle: [
    { to: 'forge', label: 'Send to FORGE to write from research', when: 'research is ready to operationalise' },
    { to: 'sage', label: 'Send to SAGE for strategic synthesis', when: 'findings need decision framing' },
  ],
  vance: [
    { to: 'herald', label: 'Send to HERALD for sequencing', when: 'qualified lead needs outreach' },
    { to: 'nexus', label: 'Send to NEXUS to automate the workflow', when: 'sales motion should be systematised' },
  ],
  wren: [
    { to: 'sage', label: 'Send to SAGE for policy framing', when: 'response needs strategic context' },
  ],
  ledger: [
    { to: 'cipher', label: 'Send to CIPHER for variance analysis', when: 'numbers need anomaly review' },
    { to: 'atlas', label: 'Send to ATLAS for execution planning', when: 'finance plan needs operational steps' },
  ],
  nexus: [
    { to: 'atlas', label: 'Send to ATLAS for human execution plan', when: 'workflow needs human owners and milestones' },
    { to: 'sentinel', label: 'Ask SENTINEL to review safety', when: 'workflow has risky side effects' },
  ],
  scout: [
    { to: 'sage', label: 'Send to SAGE for strategic synthesis', when: 'scan needs decision framing' },
    { to: 'forge', label: 'Send to FORGE to write from findings', when: 'research is ready to publish' },
  ],
  sage: [
    { to: 'atlas', label: 'Send to ATLAS to operationalise', when: 'strategy is set and needs execution' },
    { to: 'nexus', label: 'Send to NEXUS to automate', when: 'recurring strategy can be workflowed' },
  ],
  sentinel: [],
};

const EMPTY = [];

export function getAgentHandoffs(agentId) {
  return HANDOFFS[agentId] ?? EMPTY;
}

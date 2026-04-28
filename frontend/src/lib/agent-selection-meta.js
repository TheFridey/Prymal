/** Cold-start UX: “Best for”, when to pick this agent, and example output hints. */

export const AGENT_SELECTION_META = {
  forge: {
    bestFor: 'Content, landing pages, launch posts',
    useWhen: 'You need words that turn ideas into polished business assets.',
    exampleOutputChips: ['Content plan', 'Landing section', 'Launch post'],
    recommendedStarter: true,
  },
  herald: {
    bestFor: 'Email, outreach sequences, stakeholder updates',
    useWhen: 'You want clear outbound and follow-ups that advance the conversation.',
    exampleOutputChips: ['3-email sequence', 'Follow-up draft', 'Newsletter tighten'],
    recommendedStarter: true,
  },
  echo: {
    bestFor: 'Social repurposing and campaign-ready formats',
    useWhen: 'You want one core idea reshaped into platform-native posts.',
    exampleOutputChips: ['LinkedIn hooks', 'Weekly social pack', 'Campaign angles'],
    recommendedStarter: true,
  },
  lore: {
    bestFor: 'Business knowledge and source-backed answers',
    useWhen: 'You want Prymal to quote your own documents and cite sources.',
    exampleOutputChips: ['Evidence summary', 'Gap map', 'Grounded Q&A'],
    recommendedStarter: true,
  },
  nexus: {
    bestFor: 'Repeatable multi-agent workflows',
    useWhen: 'You want several agents chained into one dependable process.',
    exampleOutputChips: ['Validated graph', 'Run steps', 'Branch logic'],
    recommendedStarter: true,
  },
  atlas: {
    bestFor: 'Milestones, ops plans, and delivery sequencing',
    useWhen: 'You want ambiguity turned into accountable plans and timelines.',
    exampleOutputChips: ['Launch plan', 'Risk map', 'Milestone list'],
    recommendedStarter: false,
  },
  cipher: {
    bestFor: 'Metrics and operational data',
    useWhen: 'You want trends, anomalies, and scorecards from real numbers.',
    exampleOutputChips: ['Executive readout', 'Anomalies', 'Action list'],
    recommendedStarter: false,
  },
  oracle: {
    bestFor: 'Search intent and SEO briefs',
    useWhen: 'You care what buyers search for and how to shape pages for it.',
    exampleOutputChips: ['SEO brief', 'Keyword cluster', 'Page audit notes'],
    recommendedStarter: false,
  },
  vance: {
    bestFor: 'Pipeline qualification and proposals',
    useWhen: 'You want crisp next-commercial-steps for leads and deals.',
    exampleOutputChips: ['ICP scoring', 'Proposal outline', 'Advance email'],
    recommendedStarter: false,
  },
  wren: {
    bestFor: 'Support tone and customer-safe replies',
    useWhen: 'You need calm resolution writing with clear ownership.',
    exampleOutputChips: ['Support reply', 'FAQ block', 'Recovery email'],
    recommendedStarter: false,
  },
  ledger: {
    bestFor: 'Finance narration and stakeholder reporting',
    useWhen: 'You need leadership-ready commentary on money movement.',
    exampleOutputChips: ['P&L story', 'Investor update', 'Variance read'],
    recommendedStarter: false,
  },
  scout: {
    bestFor: 'Competitor and market scans',
    useWhen: 'You want positioning whitespace and comparative notes.',
    exampleOutputChips: ['Landscape memo', 'Gap list', 'Positioning deltas'],
    recommendedStarter: false,
  },
  sage: {
    bestFor: 'Strategic trade-offs and prioritisation',
    useWhen: 'You want an exec-level judgement call with coherent reasoning.',
    exampleOutputChips: ['Decision memo', 'Scenario compare', 'Next focus'],
    recommendedStarter: false,
  },
  pixel: {
    bestFor: 'Image prompts, briefs, and visual direction',
    useWhen: 'You want campaign-ready visuals or designer-grade briefs.',
    exampleOutputChips: ['Image brief', 'Mood palette', 'Layout notes'],
    recommendedStarter: false,
  },
  sentinel: {
    bestFor: 'Quality review before delivery',
    useWhen: 'You need PASS/HOLD scrutiny on sensitive or contractual output.',
    exampleOutputChips: ['Risk flags', 'Repair plan', 'Verdict summary'],
    recommendedStarter: false,
  },
};

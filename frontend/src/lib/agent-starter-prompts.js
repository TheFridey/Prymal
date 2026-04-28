/**
 * Canonical starter prompts for agent chat (“Try this” / empty-state suggestions).
 * Aligned with pre-launch first-win onboarding.
 */
export const AGENT_STARTER_PROMPTS = {
  forge: [
    'Create a 7-day content plan for my business based on this offer: [describe offer].',
    'Turn this rough idea into a landing page section with headline, benefits, proof points, and CTA.',
    'Write a launch post for my product that feels premium, direct, and exciting.',
  ],
  herald: [
    'Write a 3-email outreach sequence for [target customer] about [offer].',
    'Create a follow-up email for someone who showed interest but has not replied.',
    'Rewrite this email so it sounds clearer, more confident, and more likely to convert.',
  ],
  echo: [
    'Turn this update into 5 LinkedIn posts with different hooks.',
    'Create a week of social content for [business type] targeting [audience].',
    'Make this announcement sound exciting but not too salesy.',
  ],
  lore: [
    'Summarise what you know about my business from the uploaded knowledge.',
    'What gaps or contradictions exist in my current business information?',
    'Answer this using only my saved knowledge: [question].',
  ],
  nexus: [
    'Build a simple workflow that turns a business idea into content, outreach, and next actions.',
    'Create a workflow for weekly marketing planning.',
    'Create a workflow that researches a topic, drafts content, and prepares a follow-up email.',
  ],
  atlas: [
    'Turn this goal into a 30-day execution plan.',
    'Break this project into milestones, dependencies, and risks.',
    'Create a launch checklist for [product/business].',
  ],
  vance: [
    'Create a simple sales plan for getting the first 10 customers.',
    'Score this lead and suggest the next best action.',
    'Write a proposal outline for [client type].',
  ],
  cipher: [
    'Analyse this business data and tell me the key trends, risks, and actions.',
    'Create a scorecard for this campaign.',
    'Find anomalies or weak points in this report.',
  ],
  oracle: [
    'Create an SEO content plan for [business type].',
    'Audit this page for SEO issues: [URL].',
    'Find search opportunities for [topic/service].',
  ],
  wren: [
    'Write a calm, helpful support reply to this customer issue.',
    'Create an FAQ section for [product/service].',
    'Rewrite this response so it sounds clear, human, and helpful.',
  ],
  sage: [
    'Give me a strategic decision memo for this situation: [describe situation].',
    'Compare these options and recommend the best path.',
    'What should I focus on next and why?',
  ],
  scout: [
    'Research competitors for [business/product] and summarise positioning gaps.',
    'Compare my offer against these competitors: [list].',
    'Find market opportunities for [business type].',
  ],
  ledger: [
    'Summarise this financial information in plain English.',
    'Create a monthly business finance update from these numbers.',
    'Explain the key risks in this cashflow view.',
  ],
  pixel: [
    'Create an image brief for a premium launch banner for [product].',
    'Generate visual concepts for a social campaign about [topic].',
    'Create a product-style visual direction for [brand].',
  ],
  sentinel: [
    'Review this response for factual, compliance, or schema risk.',
    'Explain whether this answer should pass, repair, or hold.',
    'Summarise the reason this output was held by SENTINEL.',
  ],
};

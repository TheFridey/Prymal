/** Public pricing conversion copy — does not alter billing logic or plan definitions. */

export const RECOMMENDED_STARTER_PLAN_ID = 'pro';

export const PLAN_DECISION_HELPERS = {
  solo: {
    bestFor: 'Individuals testing their first repeatable AI workflow',
    replaces: 'Scattered chat tabs and one-off prompts',
    firstWin: 'One polished draft, reply, or outreach sequence',
    expectedUsage: 'Light weekly runs — single-lane execution and shallow LORE',
    recommendedStarter: false,
  },
  pro: {
    bestFor: 'Serious operators and small businesses shipping weekly work',
    replaces: 'Multiple AI tools plus manual copy-paste between steps',
    firstWin: 'A content, reporting, or follow-up rhythm that ships reliably',
    expectedUsage: 'Daily agent use, 2–3 workflows, medium LORE depth',
    recommendedStarter: true,
  },
  teams: {
    bestFor: 'Teams sharing context, workflows, and operator oversight',
    replaces: 'Shared docs, ad hoc prompts, and duplicated setup work',
    firstWin: 'One coordinated workflow the whole team can rerun',
    expectedUsage: 'Collaborative execution, deeper memory, multiple concurrent runs',
    recommendedStarter: false,
  },
  agency: {
    bestFor: 'Agencies and client-delivery pods at scale',
    replaces: 'Per-client tool sprawl and fragile handoff notes',
    firstWin: 'A client-ready delivery chain from brief to reviewed output',
    expectedUsage: 'High-volume execution, priority lanes, multi-workspace control',
    recommendedStarter: false,
  },
};

export const PRICING_OBJECTION_CARDS = [
  {
    id: 'chatgpt',
    title: 'Why not ChatGPT?',
    answer:
      'General chat is strong for open-ended drafting. Prymal is built for coordinated business execution: specialist agents, shared LORE memory, workflow automation, and SENTINEL validation in one workspace.',
  },
  {
    id: 'credits',
    title: 'What happens if credits run out?',
    answer:
      'New credit-consuming runs pause until your monthly reset or a top-up. Usage is visible in your workspace in real time, with alerts and upgrade paths before work stalls unexpectedly.',
  },
  {
    id: 'data-safe',
    title: 'Is my data safe?',
    answer:
      'Workspace data stays tenant-scoped with WARDEN input screening and SENTINEL output validation. Prymal uses readiness language and operational controls — not unearned certification claims.',
  },
  {
    id: 'cancel',
    title: 'Can I cancel?',
    answer:
      'Yes. Subscriptions are managed through your billing portal. You can cancel plan changes according to the terms shown at checkout and in your account settings.',
  },
  {
    id: 'which-plan',
    title: 'What plan should I choose?',
    answer:
      'Start on Free to test the first win, move to Solo for light solo use, or choose Pro as the recommended starter for production weekly work. Teams and Agency fit shared and client-scale execution.',
  },
];

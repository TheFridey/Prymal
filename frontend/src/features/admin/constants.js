export const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'organisations', label: 'Organisations' },
  { id: 'users', label: 'Users' },
  { id: 'billing', label: 'Billing' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'referrals', label: 'Referrals' },
  { id: 'model-usage', label: 'Model Usage' },
  { id: 'scorecards', label: 'Scorecards' },
  { id: 'model-policy', label: 'Model Policy' },
  { id: 'traces', label: 'Traces' },
  { id: 'evals', label: 'Evals' },
  { id: 'workflow-ops', label: 'Workflow Ops' },
  { id: 'activity', label: 'Activity' },
  { id: 'audit-logs', label: 'Audit Logs' },
  { id: 'credit-usage', label: 'Credit Usage' },
  { id: 'product-events', label: 'Product Events' },
  { id: 'waitlist', label: 'Waitlist' },
  { id: 'email-queue', label: 'Email Queue' },
  { id: 'powerups', label: 'Power-Ups' },
  { id: 'growth', label: 'Growth' },
];

export const PLAN_OPTIONS = ['all', 'free', 'solo', 'pro', 'teams', 'agency'];
export const ROLE_OPTIONS = ['all', 'owner', 'admin', 'member'];
export const RUN_STATUS_OPTIONS = ['all', 'running', 'queued', 'failed', 'completed'];
export const ACTIVITY_KIND_OPTIONS = ['all', 'audit', 'event'];
export const PLAN_CHART_COLORS = ['#68f5d0', '#69bcff', '#b293ff', '#ffc46f', '#ff8cab'];

export const EMPTY_DASHBOARD = {
  summary: {
    organisations: 0,
    users: 0,
    activeUsers7d: 0,
    workflows: 0,
    workflowRuns24h: 0,
    documentsIndexed: 0,
    openInvites: 0,
    activeIntegrations: 0,
    totalCreditsUsed: 0,
  },
  lifecycle: {
    onboardingCompleted30d: 0,
    usefulOutputs30d: 0,
    invitationsSent30d: 0,
    seatActivations30d: 0,
  },
  pipeline: {
    docsPending: 0,
    workflowRunsQueued: 0,
    integrationsOffline: 0,
    failedRuns: 0,
  },
  planDistribution: [],
  activitySeries: [],
  organisations: [],
  users: [],
  recentRuns: [],
  documentQueue: [],
  billing: {
    configured: false,
    invoices: [],
    subscriptions: [],
  },
  recentActivity: [],
};

export const AGENT_ID_OPTIONS = ['cipher', 'herald', 'lore', 'forge', 'atlas', 'echo', 'oracle', 'vance', 'wren', 'ledger', 'nexus', 'scout', 'sage'];
export const EMPTY_POWERUP = { agentId: 'cipher', slug: '', name: '', prompt: '' };

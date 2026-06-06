export const RATE_LIMIT_CONFIGS = {
  agentsChat: {
    keyPrefix: 'agents-chat',
    windowMs: 60_000,
    free: 10,
    solo: 30,
    pro: 60,
    teams: 100,
    agency: null,
  },
  agentsMedia: {
    keyPrefix: 'agents-media',
    windowMs: 15 * 60_000,
    free: 4,
    solo: 8,
    pro: 16,
    teams: 40,
    agency: 120,
  },
  agentsTranscribe: {
    keyPrefix: 'agents-transcribe',
    windowMs: 5 * 60_000,
    free: 10,
    solo: 30,
    pro: 60,
    teams: 120,
    agency: 240,
  },
  agentsRealtimeToken: {
    keyPrefix: 'agents-realtime-token',
    windowMs: 10 * 60_000,
    free: 5,
    solo: 15,
    pro: 30,
    teams: 60,
    agency: 120,
  },
  agentsEmailSend: {
    keyPrefix: 'agents-email-send',
    windowMs: 60_000,
    free: 2,
    solo: 10,
    pro: 30,
    teams: 60,
    agency: 120,
  },
  loreIngest: {
    keyPrefix: 'lore-ingest',
    windowMs: 15 * 60_000,
    free: 5,
    solo: 20,
    pro: 50,
    teams: 100,
    agency: 200,
  },
  loreSearch: {
    keyPrefix: 'lore-search',
    windowMs: 60_000,
    free: 20,
    solo: 60,
    pro: 120,
    teams: 240,
    agency: 400,
  },
  loreReindex: {
    keyPrefix: 'lore-reindex',
    windowMs: 15 * 60_000,
    free: 2,
    solo: 5,
    pro: 10,
    teams: 20,
    agency: 40,
  },
  workflowRun: {
    keyPrefix: 'workflow-run',
    windowMs: 60_000,
    free: 3,
    solo: 10,
    pro: 30,
    teams: 60,
    agency: null,
  },
  workflowRerun: {
    keyPrefix: 'workflow-rerun',
    windowMs: 5 * 60_000,
    free: 2,
    solo: 5,
    pro: 15,
    teams: 30,
    agency: 60,
  },
  workflowWebhookTrigger: {
    keyPrefix: 'workflow-webhook-trigger',
    windowMs: 60_000,
    max: 30,
    message: 'Too many workflow webhook requests. Please try again shortly.',
  },
  billingMutations: {
    keyPrefix: 'billing-mutations',
    windowMs: 10 * 60_000,
    free: 5,
    solo: 10,
    pro: 20,
    teams: 40,
    agency: 80,
  },
  integrationsConnectAndCallback: {
    keyPrefix: 'integrations-connect-callback',
    windowMs: 10 * 60_000,
    max: 20,
    message: 'Too many integration authentication requests. Please try again shortly.',
  },
  integrationsWrite: {
    keyPrefix: 'integrations-write',
    windowMs: 10 * 60_000,
    free: 5,
    solo: 10,
    pro: 20,
    teams: 40,
    agency: 80,
  },
  adminWrite: {
    keyPrefix: 'admin-write',
    windowMs: 15 * 60_000,
    max: 30,
    message: 'Too many admin write requests. Please try again shortly.',
  },
  adminSensitiveWrite: {
    keyPrefix: 'admin-sensitive-write',
    windowMs: 15 * 60_000,
    max: 10,
    message: 'Too many sensitive admin write requests. Please try again shortly.',
  },
};

export function getRateLimitConfig(name) {
  const config = RATE_LIMIT_CONFIGS[name];

  if (!config) {
    throw new Error(`Unknown rate limit config: ${name}`);
  }

  return config;
}

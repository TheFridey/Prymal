import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

import { loadBackendEnv } from '../env/parse.js';
import { sanitizeStructuredData } from '../services/security/redaction.js';

const SENSITIVE_EXTRA_KEYS = [
  'ANTHROPIC_API_KEY',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SECRET',
  'ENCRYPTION_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_CLIENT_SECRET',
  'INTEGRATION_STATE_SECRET',
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'SENTRY_AUTH_TOKEN',
  'SLACK_CLIENT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'UPSTASH_REDIS_REST_TOKEN',
];

let initialized = false;

export function initSentry() {
  loadBackendEnv();

  if (!process.env.SENTRY_DSN || initialized) return;

  initialized = true;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
    release: process.env.SENTRY_RELEASE || process.env.npm_package_version,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 0.1,
    beforeSend(event) {
      if (event.request?.data) {
        event.request.data = sanitizeStructuredData(event.request.data);
      }

      if (event.request?.headers) {
        event.request.headers = sanitizeStructuredData(event.request.headers, { stripContent: false });
      }

      if (event.extra) {
        event.extra = stripSensitiveExtras(sanitizeStructuredData(event.extra));
      }

      return event;
    },
  });
}

export function captureException(err, context = {}) {
  Sentry.captureException(err, { extra: stripSensitiveExtras(sanitizeStructuredData(context)) });
}

export function captureProviderError(err, {
  provider,
  policyClass,
  orgId,
  userId = null,
  agentId,
  model = null,
  route = null,
  fallbackActivated = false,
  fallbackTargetProvider = null,
  errorCode = null,
  failureClass = null,
} = {}) {
  Sentry.captureException(err, {
    tags: {
      provider: provider ?? 'unknown',
      policy_class: policyClass ?? 'unknown',
      agent_id: agentId ?? 'unknown',
      fallback_activated: String(Boolean(fallbackActivated)),
      error_code: errorCode ?? err?.code ?? 'unknown',
      failure_class: failureClass ?? 'unknown',
    },
    extra: stripSensitiveExtras(sanitizeStructuredData({
      org_id: orgId ?? null,
      user_id: userId ?? null,
      model,
      route,
      fallback_target_provider: fallbackTargetProvider,
    })),
    level: 'error',
  });
}

export function captureProviderFallback({
  provider,
  fallbackProvider,
  policyClass,
  orgId,
  userId = null,
  agentId,
  model = null,
  fallbackModel = null,
  errorCode = null,
  failureClass = null,
} = {}) {
  Sentry.captureMessage('LLM provider fallback activated', {
    level: 'warning',
    tags: {
      provider: provider ?? 'unknown',
      fallback_provider: fallbackProvider ?? 'unknown',
      policy_class: policyClass ?? 'unknown',
      agent_id: agentId ?? 'unknown',
      error_code: errorCode ?? 'unknown',
      failure_class: failureClass ?? 'unknown',
    },
    extra: stripSensitiveExtras(sanitizeStructuredData({
      org_id: orgId ?? null,
      user_id: userId ?? null,
      model,
      fallback_model: fallbackModel,
    })),
  });
}

function stripSensitiveExtras(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const next = Array.isArray(value) ? [...value] : { ...value };

  for (const key of SENSITIVE_EXTRA_KEYS) {
    delete next[key];
  }

  return next;
}

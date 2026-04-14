import { getEnvironmentMode, loadBackendEnv } from './parse.js';

const REQUIRED_IN_ALL_ENVIRONMENTS = ['DATABASE_URL'];
const REQUIRED_IN_PRODUCTION = [
  'CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'FRONTEND_URL',
  'API_URL',
];
const CORE_PLACEHOLDER_GUARDED_KEYS = [
  'CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
];
const DEFAULT_MEMORY_SESSION_TTL_HOURS = 24;

let lastBootstrapResult = null;

export function isPlaceholderEnvValue(value) {
  return /xxxx|your_|placeholder/i.test(String(value ?? '').trim());
}

export function hasConfiguredEnvValue(value) {
  const normalized = String(value ?? '').trim();
  return Boolean(normalized) && !isPlaceholderEnvValue(normalized);
}

export function hasValidEncryptionKey(value) {
  return /^[a-fA-F0-9]{64}$/.test(String(value ?? '').trim());
}

export function hasValidSentryDsn(value) {
  return /^https?:\/\/.+@.+\/\d+/.test(String(value ?? '').trim());
}

export function getMemorySessionTtlHours(env = process.env) {
  const parsed = Number.parseInt(String(env.MEMORY_SESSION_TTL_HOURS ?? ''), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MEMORY_SESSION_TTL_HOURS;
  }

  return parsed;
}

export function hasConfiguredStripe(env = process.env) {
  return hasConfiguredEnvValue(env.STRIPE_SECRET_KEY);
}

export function hasConfiguredStripeWebhook(env = process.env) {
  return hasConfiguredStripe(env) && hasConfiguredEnvValue(env.STRIPE_WEBHOOK_SECRET);
}

export function hasConfiguredEmailDelivery(env = process.env) {
  return hasConfiguredEnvValue(env.RESEND_API_KEY) && Boolean(env.EMAIL_FROM?.trim());
}

export function hasConfiguredIntegrationProvider(env = process.env) {
  const providerPairs = [
    ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    ['NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET'],
    ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET'],
  ];

  return providerPairs.some(([clientIdKey, clientSecretKey]) => (
    hasConfiguredEnvValue(env[clientIdKey]) && hasConfiguredEnvValue(env[clientSecretKey])
  ));
}

export function isStrictRuntimeValidationEnabled(mode = getEnvironmentMode()) {
  return mode === 'development' || mode === 'production';
}

export function validateRuntimeEnv(env = process.env, { mode = getEnvironmentMode(env.NODE_ENV), strict = isStrictRuntimeValidationEnabled(mode) } = {}) {
  const errors = [];
  const warnings = [];

  for (const name of REQUIRED_IN_ALL_ENVIRONMENTS) {
    if (!env[name]?.trim()) {
      errors.push(`${name} must be set in backend/.env before starting the API.`);
    }
  }

  if (mode === 'production') {
    for (const name of REQUIRED_IN_PRODUCTION) {
      if (!env[name]?.trim()) {
        errors.push(`${name} must be set in backend/.env before starting the API.`);
      }
    }
  }

  for (const name of CORE_PLACEHOLDER_GUARDED_KEYS) {
    const value = env[name];

    if (!value) {
      continue;
    }

    if (/xxxx|your_|placeholder/i.test(value)) {
      errors.push(
        `${name} is still using a placeholder value in backend/.env. Replace it with a real value before starting the API.`,
      );
    }
  }

  if (env.STRIPE_SECRET_KEY?.trim() && !hasConfiguredStripe(env)) {
    warnings.push('Stripe billing is disabled because STRIPE_SECRET_KEY is still a placeholder.');
  }

  if (!env.STRIPE_PRICE_SEAT_ADDON?.trim() || isPlaceholderEnvValue(env.STRIPE_PRICE_SEAT_ADDON)) {
    warnings.push('STRIPE_PRICE_SEAT_ADDON is not configured — Teams seat add-ons will return 503.');
  }

  if (!env.WREN_ESCALATION_EMAIL?.trim()) {
    warnings.push('WREN_ESCALATION_EMAIL is not set — WREN will silently skip escalation dispatch.');
  }

  if (env.STRIPE_WEBHOOK_SECRET?.trim() && !hasConfiguredStripeWebhook(env)) {
    warnings.push('Stripe webhook verification is disabled because STRIPE_WEBHOOK_SECRET is still a placeholder.');
  }

  if (env.RESEND_API_KEY?.trim() && !hasConfiguredEmailDelivery(env)) {
    warnings.push('Invitation email delivery is disabled because RESEND_API_KEY is still a placeholder.');
  }

  if (
    env.MEMORY_SESSION_TTL_HOURS?.trim() &&
    (!Number.isFinite(Number.parseInt(env.MEMORY_SESSION_TTL_HOURS, 10)) || Number.parseInt(env.MEMORY_SESSION_TTL_HOURS, 10) <= 0)
  ) {
    warnings.push(
      `MEMORY_SESSION_TTL_HOURS must be a positive integer. Falling back to ${DEFAULT_MEMORY_SESSION_TTL_HOURS} hours.`,
    );
  }

  if (hasConfiguredIntegrationProvider(env) && !hasValidEncryptionKey(env.ENCRYPTION_KEY)) {
    errors.push(
      'ENCRYPTION_KEY must be a real 64-character hex key before enabling OAuth integrations.',
    );
  } else if (env.ENCRYPTION_KEY?.trim() && !hasValidEncryptionKey(env.ENCRYPTION_KEY)) {
    warnings.push('OAuth integrations stay disabled until ENCRYPTION_KEY is replaced with a real 64-character hex key.');
  }

  if (!env.INTEGRATION_STATE_SECRET?.trim()) {
    warnings.push('OAuth callback state will be weaker without INTEGRATION_STATE_SECRET.');
  } else if (isPlaceholderEnvValue(env.INTEGRATION_STATE_SECRET)) {
    warnings.push('OAuth callback state signing is disabled because INTEGRATION_STATE_SECRET is still a placeholder.');
  }

  if (env.SENTRY_DSN?.trim() && !hasValidSentryDsn(env.SENTRY_DSN)) {
    warnings.push('SENTRY_DSN is set but does not look like a valid Sentry DSN. Error tracking will stay disabled until it is corrected.');
  }

  if (
    !env.STAFF_SUPERADMIN_EMAILS?.trim() &&
    !env.STAFF_SUPERADMIN_USER_IDS?.trim() &&
    !env.STAFF_EMAILS?.trim() &&
    !env.STAFF_USER_IDS?.trim()
  ) {
    warnings.push('Staff access is easier to misconfigure without explicit STAFF_* role lists.');
  }

  return {
    mode,
    strict,
    errors,
    warnings,
    valid: errors.length === 0,
  };
}

export function formatEnvValidationErrors(errors) {
  return errors.join('\n');
}

export function bootstrapRuntimeEnv({
  mode = getEnvironmentMode(),
  strict = isStrictRuntimeValidationEnabled(mode),
  override = false,
  force = false,
} = {}) {
  if (lastBootstrapResult && !force) {
    return lastBootstrapResult;
  }

  const parseResult = loadBackendEnv({ mode, override, force });
  const validationResult = validateRuntimeEnv(process.env, { mode, strict });
  process.env.MEMORY_SESSION_TTL_HOURS = String(getMemorySessionTtlHours(process.env));

  if (strict) {
    for (const warning of validationResult.warnings) {
      console.warn(`[ENV] ${warning}`);
    }
  }

  if (strict && validationResult.errors.length > 0) {
    throw new Error(formatEnvValidationErrors(validationResult.errors));
  }

  lastBootstrapResult = {
    ...parseResult,
    ...validationResult,
  };

  return lastBootstrapResult;
}

export function resetRuntimeEnvBootstrapForTests() {
  lastBootstrapResult = null;
}

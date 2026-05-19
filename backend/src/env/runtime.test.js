import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyClerkKeyMode,
  classifyStripeSecretMode,
  isLocalLikeUrl,
  isStrictRuntimeValidationEnabled,
  validateRuntimeEnv,
} from './runtime.js';
import { getEnvironmentMode } from './parse.js';

function buildLiveLikeEnv(overrides = {}) {
  return {
    NODE_ENV: 'staging',
    DATABASE_URL: 'postgresql://db.example/prymal',
    CLERK_PUBLISHABLE_KEY: 'pk_test_example',
    CLERK_SECRET_KEY: 'sk_test_example',
    CLERK_WEBHOOK_SECRET: 'whsec_123',
    FRONTEND_URL: 'https://staging.prymal.io',
    API_URL: 'https://staging-api.prymal.io',
    APP_URL: 'https://staging.prymal.io',
    ANTHROPIC_API_KEY: 'sk-ant-real-key',
    OPENAI_API_KEY: 'sk-real-openai-key',
    ENCRYPTION_KEY: 'a'.repeat(64),
    INTEGRATION_STATE_SECRET: 'integration-state-secret',
    RESEND_API_KEY: 're_real_key',
    RESEND_FROM_EMAIL: 'Prymal <ops@prymal.io>',
    EMAIL_FROM: 'Prymal <ops@prymal.io>',
    MEDIA_STORAGE_DRIVER: 'cloudinary',
    CLOUDINARY_CLOUD_NAME: 'prymal',
    CLOUDINARY_API_KEY: 'cloudinary-key',
    CLOUDINARY_API_SECRET: 'cloudinary-secret',
    CLOUDINARY_FOLDER: 'prymal-staging',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_123',
    STRIPE_PRICE_SOLO: 'price_1',
    STRIPE_PRICE_SOLO_QUARTERLY: 'price_2',
    STRIPE_PRICE_SOLO_YEARLY: 'price_3',
    STRIPE_PRICE_PRO: 'price_4',
    STRIPE_PRICE_PRO_QUARTERLY: 'price_5',
    STRIPE_PRICE_PRO_YEARLY: 'price_6',
    STRIPE_PRICE_TEAMS: 'price_7',
    STRIPE_PRICE_TEAMS_QUARTERLY: 'price_8',
    STRIPE_PRICE_TEAMS_YEARLY: 'price_9',
    STRIPE_PRICE_AGENCY: 'price_10',
    STRIPE_PRICE_AGENCY_QUARTERLY: 'price_11',
    STRIPE_PRICE_AGENCY_YEARLY: 'price_12',
    STRIPE_PRICE_FOUNDING_SOLO: 'price_13',
    STRIPE_PRICE_FOUNDING_SOLO_QUARTERLY: 'price_14',
    STRIPE_PRICE_FOUNDING_SOLO_YEARLY: 'price_15',
    STRIPE_PRICE_FOUNDING_PRO: 'price_16',
    STRIPE_PRICE_FOUNDING_PRO_QUARTERLY: 'price_17',
    STRIPE_PRICE_FOUNDING_PRO_YEARLY: 'price_18',
    STRIPE_PRICE_FOUNDING_TEAMS: 'price_19',
    STRIPE_PRICE_FOUNDING_TEAMS_QUARTERLY: 'price_20',
    STRIPE_PRICE_FOUNDING_TEAMS_YEARLY: 'price_21',
    STRIPE_PRICE_FOUNDING_AGENCY: 'price_22',
    STRIPE_PRICE_FOUNDING_AGENCY_QUARTERLY: 'price_23',
    STRIPE_PRICE_FOUNDING_AGENCY_YEARLY: 'price_24',
    STRIPE_PRICE_EXEC_BOOST_1000: 'price_25',
    STRIPE_PRICE_VIDEO_PACK_SMALL: 'price_26',
    STRIPE_PRICE_VIDEO_PACK_PRO: 'price_27',
    STRIPE_PRICE_SEAT_ADDON: 'price_28',
    WREN_ESCALATION_EMAIL: 'support@prymal.io',
    ...overrides,
  };
}

function buildProductionEnv(overrides = {}) {
  return buildLiveLikeEnv({
    NODE_ENV: 'production',
    CLERK_PUBLISHABLE_KEY: 'pk_live_example',
    CLERK_SECRET_KEY: 'sk_live_example',
    STRIPE_SECRET_KEY: 'sk_live_123',
    FRONTEND_URL: 'https://app.prymal.io',
    FRONTEND_URLS: 'https://app.prymal.io',
    API_URL: 'https://api.prymal.io',
    APP_URL: 'https://app.prymal.io',
    CLOUDINARY_FOLDER: 'prymal-production',
    STAFF_SUPERADMIN_EMAILS: 'security@example.com',
    ...overrides,
  });
}

test('getEnvironmentMode recognizes staging', () => {
  assert.equal(getEnvironmentMode('staging'), 'staging');
  assert.equal(isStrictRuntimeValidationEnabled('staging'), true);
});

test('runtime helpers classify env modes correctly', () => {
  assert.equal(classifyClerkKeyMode('pk_test_abc'), 'test');
  assert.equal(classifyClerkKeyMode('sk_live_abc'), 'live');
  assert.equal(classifyStripeSecretMode('sk_test_abc'), 'test');
  assert.equal(classifyStripeSecretMode('sk_live_abc'), 'live');
  assert.equal(isLocalLikeUrl('http://localhost:3001'), true);
  assert.equal(isLocalLikeUrl('https://staging.prymal.io'), false);
});

test('staging validation rejects localhost URLs and live Stripe keys', () => {
  const result = validateRuntimeEnv(
    buildLiveLikeEnv({
      FRONTEND_URL: 'http://localhost:5173',
      FRONTEND_URLS: 'https://staging.prymal.io,http://localhost:4173',
      STRIPE_SECRET_KEY: 'sk_live_123',
    }),
    { mode: 'staging', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /FRONTEND_URL cannot point at localhost in staging/i);
  assert.match(result.errors.join('\n'), /FRONTEND_URLS cannot include localhost origins in staging/i);
  assert.match(result.errors.join('\n'), /STRIPE_SECRET_KEY must use Stripe test mode in staging/i);
  assert.match(result.errors.join('\n'), /Live Stripe credentials cannot be paired with localhost/i);
});

test('production validation rejects test Clerk keys', () => {
  const result = validateRuntimeEnv(
    buildProductionEnv({
      CLERK_PUBLISHABLE_KEY: 'pk_test_frontend',
      CLERK_SECRET_KEY: 'sk_test_backend',
    }),
    { mode: 'production', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /CLERK_PUBLISHABLE_KEY must use live mode in production/i);
  assert.match(result.errors.join('\n'), /CLERK_SECRET_KEY must use live mode in production/i);
});

test('well-formed staging env passes runtime validation', () => {
  const result = validateRuntimeEnv(buildLiveLikeEnv(), { mode: 'staging', strict: true });
  assert.equal(result.valid, true);
});

test('production validation rejects unrecognised NODE_ENV values', () => {
  const result = validateRuntimeEnv(
    buildProductionEnv({
      NODE_ENV: 'preview',
    }),
    { mode: 'production', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /NODE_ENV must be one of development, staging, production, test/i);
});

test('production validation requires CLERK_WEBHOOK_SECRET', () => {
  const result = validateRuntimeEnv(
    buildProductionEnv({
      CLERK_WEBHOOK_SECRET: '',
    }),
    { mode: 'production', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /CLERK_WEBHOOK_SECRET must be set/i);
});

test('production validation requires STRIPE_WEBHOOK_SECRET when Stripe is enabled', () => {
  const result = validateRuntimeEnv(
    buildProductionEnv({
      STRIPE_WEBHOOK_SECRET: '',
    }),
    { mode: 'production', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /STRIPE_WEBHOOK_SECRET must be configured when Stripe billing is enabled in production/i);
});

test('production validation requires INTEGRATION_STATE_SECRET', () => {
  const result = validateRuntimeEnv(
    buildProductionEnv({
      INTEGRATION_STATE_SECRET: '',
    }),
    { mode: 'production', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /INTEGRATION_STATE_SECRET must be configured in production/i);
});

test('production validation requires a valid encryption key', () => {
  const result = validateRuntimeEnv(
    buildProductionEnv({
      ENCRYPTION_KEY: 'short',
    }),
    { mode: 'production', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /ENCRYPTION_KEY must be a 64-character hex string in production/i);
});

test('production validation requires explicit superadmin identity config', () => {
  const result = validateRuntimeEnv(
    buildProductionEnv({
      STAFF_SUPERADMIN_EMAILS: '',
      STAFF_SUPERADMIN_USER_IDS: '',
    }),
    { mode: 'production', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /At least one of STAFF_SUPERADMIN_EMAILS or STAFF_SUPERADMIN_USER_IDS must be configured in production/i);
});

test('production validation requires Cloudinary media storage', () => {
  const result = validateRuntimeEnv(
    buildProductionEnv({
      MEDIA_STORAGE_DRIVER: 'local',
    }),
    { mode: 'production', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /MEDIA_STORAGE_DRIVER must be set to "cloudinary" in production/i);
});

test('production validation rejects ALLOW_LOCAL_MEDIA_STORAGE_IN_PRODUCTION=true', () => {
  const result = validateRuntimeEnv(
    buildProductionEnv({
      ALLOW_LOCAL_MEDIA_STORAGE_IN_PRODUCTION: 'true',
    }),
    { mode: 'production', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /ALLOW_LOCAL_MEDIA_STORAGE_IN_PRODUCTION must remain false in production/i);
});

test('production validation requires Upstash when using more than one process', () => {
  const result = validateRuntimeEnv(
    buildProductionEnv({
      WEB_CONCURRENCY: '2',
      UPSTASH_REDIS_REST_URL: '',
      UPSTASH_REDIS_REST_TOKEN: '',
    }),
    { mode: 'production', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must both be configured/i);
});

test('live-like validation rejects inline scheduler fan-out without Trigger.dev', () => {
  const result = validateRuntimeEnv(
    buildProductionEnv({
      WEB_CONCURRENCY: '2',
      UPSTASH_REDIS_REST_URL: 'https://upstash.example.com',
      UPSTASH_REDIS_REST_TOKEN: 'upstash-token',
      TRIGGER_API_KEY: '',
      INLINE_SCHEDULER_ENABLED: 'true',
    }),
    { mode: 'production', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /INLINE_SCHEDULER_ENABLED must be false when WEB_CONCURRENCY is greater than 1 and Trigger.dev is not configured/i);
});

test('runtime validation rejects FRONTEND_URL values outside the explicit CORS allowlist', () => {
  const result = validateRuntimeEnv(
    buildLiveLikeEnv({
      FRONTEND_URLS: 'https://preview.prymal.io,https://staging.prymal.io',
      FRONTEND_URL: 'https://app.prymal.io',
    }),
    { mode: 'staging', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /FRONTEND_URL is not included in FRONTEND_URLS/i);
});

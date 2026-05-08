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
    DATABASE_URL: 'postgresql://db.example/prymal',
    CLERK_PUBLISHABLE_KEY: 'pk_test_example',
    CLERK_SECRET_KEY: 'sk_test_example',
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
      STRIPE_SECRET_KEY: 'sk_live_123',
    }),
    { mode: 'staging', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /FRONTEND_URL cannot point at localhost in staging/i);
  assert.match(result.errors.join('\n'), /STRIPE_SECRET_KEY must use Stripe test mode in staging/i);
  assert.match(result.errors.join('\n'), /Live Stripe credentials cannot be paired with localhost/i);
});

test('production validation rejects test Clerk keys', () => {
  const result = validateRuntimeEnv(
    buildLiveLikeEnv({
      CLERK_PUBLISHABLE_KEY: 'pk_test_frontend',
      CLERK_SECRET_KEY: 'sk_test_backend',
      STRIPE_SECRET_KEY: 'sk_live_123',
      FRONTEND_URL: 'https://app.prymal.io',
      API_URL: 'https://api.prymal.io',
      APP_URL: 'https://app.prymal.io',
      CLOUDINARY_FOLDER: 'prymal-production',
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

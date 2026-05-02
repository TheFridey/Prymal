import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootstrapRuntimeEnv,
  getMemorySessionTtlHours,
  loadBackendEnv,
  resetEnvLoaderForTests,
  resetRuntimeEnvBootstrapForTests,
  shouldLoadEnvFile,
  validateRuntimeEnv,
} from './env.js';

const originalEnv = { ...process.env };

test.afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
  resetEnvLoaderForTests();
  resetRuntimeEnvBootstrapForTests();
});

test('shouldLoadEnvFile skips backend .env loading in test mode', () => {
  assert.equal(shouldLoadEnvFile('test'), false);
  assert.equal(shouldLoadEnvFile('development'), true);
});

test('loadBackendEnv does not load backend .env automatically during tests', () => {
  const result = loadBackendEnv({ mode: 'test', force: true });

  assert.equal(result.loaded, false);
  assert.equal(result.mode, 'test');
});

test('bootstrapRuntimeEnv allows placeholder values in test mode without throwing', () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/prymal';
  process.env.OPENAI_API_KEY = 'your_openai_key_here';

  assert.doesNotThrow(() => bootstrapRuntimeEnv({ mode: 'test', force: true }));
});

test('validateRuntimeEnv enforces placeholder protection in strict runtime modes', () => {
  const result = validateRuntimeEnv(
    {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/prymal',
      OPENAI_API_KEY: 'your_openai_key_here',
    },
    { mode: 'development', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /OPENAI_API_KEY is still using a placeholder value/i);
});

test('validateRuntimeEnv allows optional placeholder Stripe and encryption values in development', () => {
  const result = validateRuntimeEnv(
    {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/prymal',
      OPENAI_API_KEY: 'sk-real-ish-openai-key',
      ANTHROPIC_API_KEY: 'sk-ant-real-ish-key',
      STRIPE_SECRET_KEY: 'sk_test_xxxx',
      STRIPE_WEBHOOK_SECRET: 'whsec_xxxx',
      ENCRYPTION_KEY: 'your_64_char_hex_string_here',
    },
    { mode: 'development', strict: true },
  );

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.match(result.warnings.join('\n'), /Stripe billing is disabled/i);
  assert.match(result.warnings.join('\n'), /OAuth integrations stay disabled/i);
});

test('validateRuntimeEnv warns when SENTRY_DSN is configured with an invalid value', () => {
  const result = validateRuntimeEnv(
    {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/prymal',
      OPENAI_API_KEY: 'sk-real-ish-openai-key',
      ANTHROPIC_API_KEY: 'sk-ant-real-ish-key',
      SENTRY_DSN: 'not-a-real-dsn',
    },
    { mode: 'development', strict: true },
  );

  assert.equal(result.valid, true);
  assert.match(result.warnings.join('\n'), /SENTRY_DSN is set but does not look like a valid Sentry DSN/i);
});

test('getMemorySessionTtlHours falls back to 24 hours when unset or invalid', () => {
  assert.equal(getMemorySessionTtlHours({}), 24);
  assert.equal(getMemorySessionTtlHours({ MEMORY_SESSION_TTL_HOURS: '0' }), 24);
  assert.equal(getMemorySessionTtlHours({ MEMORY_SESSION_TTL_HOURS: '48' }), 48);
});

test('validateRuntimeEnv requires a real encryption key when OAuth integrations are configured', () => {
  const result = validateRuntimeEnv(
    {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/prymal',
      OPENAI_API_KEY: 'sk-real-ish-openai-key',
      ANTHROPIC_API_KEY: 'sk-ant-real-ish-key',
      GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'google-secret-value',
      ENCRYPTION_KEY: 'your_64_char_hex_string_here',
    },
    { mode: 'development', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /ENCRYPTION_KEY must be a real 64-character hex key/i);
});

test('validateRuntimeEnv blocks live video environments from using local media storage without override', () => {
  const result = validateRuntimeEnv(
    {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/prymal',
      CLERK_PUBLISHABLE_KEY: 'pk_test_prymaltestkey',
      CLERK_SECRET_KEY: 'sk_test_prymaltestkey',
      FRONTEND_URL: 'http://localhost:5173',
      API_URL: 'http://localhost:3001',
      NODE_ENV: 'production',
      OPENAI_API_KEY: 'sk-real-ish-openai-key',
      ANTHROPIC_API_KEY: 'sk-ant-real-ish-key',
      GEMINI_API_KEY: 'AIza-real-ish-key',
      MEDIA_STORAGE_DRIVER: 'local',
    },
    { mode: 'production', strict: true },
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /Local media storage is not allowed/i);
});

test('bootstrapRuntimeEnv blocks production startup when local media storage is configured', () => {
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/prymal';
  process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_prymaltestkey';
  process.env.CLERK_SECRET_KEY = 'sk_test_prymaltestkey';
  process.env.FRONTEND_URL = 'https://staging.prymal.io';
  process.env.API_URL = 'https://prymal-staging-api.up.railway.app/api';
  process.env.OPENAI_API_KEY = 'sk-real-ish-openai-key';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-real-ish-key';
  process.env.MEDIA_STORAGE_DRIVER = 'local';
  process.env.ALLOW_LOCAL_MEDIA_STORAGE_IN_PRODUCTION = 'false';

  assert.throws(
    () => bootstrapRuntimeEnv({ mode: 'production', force: true }),
    /MEDIA_STORAGE_DRIVER must be set to "cloudinary"|Local media storage is not allowed/i,
  );
});

test('bootstrapRuntimeEnv allows production startup with Cloudinary media storage configured', () => {
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/prymal';
  process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_prymaltestkey';
  process.env.CLERK_SECRET_KEY = 'sk_test_prymaltestkey';
  process.env.FRONTEND_URL = 'https://staging.prymal.io';
  process.env.API_URL = 'https://prymal-staging-api.up.railway.app/api';
  process.env.OPENAI_API_KEY = 'sk-real-ish-openai-key';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-real-ish-key';
  process.env.MEDIA_STORAGE_DRIVER = 'cloudinary';
  process.env.CLOUDINARY_CLOUD_NAME = 'demo';
  process.env.CLOUDINARY_API_KEY = '123456';
  process.env.CLOUDINARY_API_SECRET = 'secret';
  process.env.CLOUDINARY_FOLDER = 'prymal-test';

  assert.doesNotThrow(() => bootstrapRuntimeEnv({ mode: 'production', force: true }));
});

test('bootstrapRuntimeEnv throws in development when strict validation fails', () => {
  process.env.NODE_ENV = 'development';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/prymal';
  process.env.OPENAI_API_KEY = 'placeholder-openai-key';

  assert.throws(
    () => bootstrapRuntimeEnv({ mode: 'development', force: true }),
    /placeholder value/i,
  );
});

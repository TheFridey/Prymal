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
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/axiom';
  process.env.OPENAI_API_KEY = 'your_openai_key_here';

  assert.doesNotThrow(() => bootstrapRuntimeEnv({ mode: 'test', force: true }));
});

test('validateRuntimeEnv enforces placeholder protection in strict runtime modes', () => {
  const result = validateRuntimeEnv(
    {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/axiom',
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
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/axiom',
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
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/axiom',
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
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/axiom',
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

test('bootstrapRuntimeEnv throws in development when strict validation fails', () => {
  process.env.NODE_ENV = 'development';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/axiom';
  process.env.OPENAI_API_KEY = 'placeholder-openai-key';

  assert.throws(
    () => bootstrapRuntimeEnv({ mode: 'development', force: true }),
    /placeholder value/i,
  );
});

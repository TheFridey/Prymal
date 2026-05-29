import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  hasUsableAnthropicKey,
  hasUsableOpenAIKey,
  hasUsableGeminiKey,
} = await import('./model-policy.js');

const {
  hasConfiguredEnvValue,
  isPlaceholderEnvValue,
  hasValidEncryptionKey,
  hasValidSentryDsn,
  classifyClerkKeyMode,
  classifyStripeSecretMode,
  hasConfiguredStripe,
  hasConfiguredEmailDelivery,
} = await import('../env/runtime.js');

// ─── Provider key detection ────────────────────────────────────────────────

test('hasUsableAnthropicKey returns false when key is missing', () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(hasUsableAnthropicKey(), false);
  process.env.ANTHROPIC_API_KEY = saved;
});

test('hasUsableAnthropicKey returns false when key is a placeholder', () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-your_key_here';
  assert.equal(hasUsableAnthropicKey(), false);
  process.env.ANTHROPIC_API_KEY = saved;
});

test('hasUsableAnthropicKey returns false for malformed key (wrong prefix)', () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-realkey12345';
  assert.equal(hasUsableAnthropicKey(), false);
  process.env.ANTHROPIC_API_KEY = saved;
});

test('hasUsableAnthropicKey returns true for a valid-looking key', () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-realkey1234567890abcdef';
  assert.equal(hasUsableAnthropicKey(), true);
  process.env.ANTHROPIC_API_KEY = saved;
});

test('hasUsableOpenAIKey returns false when key is missing', () => {
  const saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  assert.equal(hasUsableOpenAIKey(), false);
  process.env.OPENAI_API_KEY = saved;
});

test('hasUsableOpenAIKey returns false when key is a placeholder', () => {
  const saved = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-xxxx1234567890';
  assert.equal(hasUsableOpenAIKey(), false);
  process.env.OPENAI_API_KEY = saved;
});

test('hasUsableOpenAIKey returns false for wrong prefix', () => {
  const saved = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'pk-realkey1234567';
  assert.equal(hasUsableOpenAIKey(), false);
  process.env.OPENAI_API_KEY = saved;
});

test('hasUsableGeminiKey returns false when key is missing', () => {
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  assert.equal(hasUsableGeminiKey(), false);
  process.env.GEMINI_API_KEY = saved;
});

test('hasUsableGeminiKey returns false when key is a placeholder', () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'AIplaceholder';
  assert.equal(hasUsableGeminiKey(), false);
  process.env.GEMINI_API_KEY = saved;
});

// ─── Env value helpers ────────────────────────────────────────────────────

test('isPlaceholderEnvValue detects xxxx patterns', () => {
  assert.equal(isPlaceholderEnvValue('sk-xxxx1234'), true);
  assert.equal(isPlaceholderEnvValue('your_api_key'), true);
  assert.equal(isPlaceholderEnvValue('placeholder_value'), true);
  assert.equal(isPlaceholderEnvValue('sk-ant-api03-realkey'), false);
});

test('hasConfiguredEnvValue returns false for empty or placeholder values', () => {
  assert.equal(hasConfiguredEnvValue(''), false);
  assert.equal(hasConfiguredEnvValue(undefined), false);
  assert.equal(hasConfiguredEnvValue(null), false);
  assert.equal(hasConfiguredEnvValue('your_key_here'), false);
  assert.equal(hasConfiguredEnvValue('sk-ant-realkey123'), true);
});

test('hasValidEncryptionKey accepts 64-char hex', () => {
  assert.equal(hasValidEncryptionKey('0'.repeat(64)), true);
  assert.equal(hasValidEncryptionKey('a1b2c3d4'.repeat(8)), true);
  assert.equal(hasValidEncryptionKey('short'), false);
  assert.equal(hasValidEncryptionKey('z'.repeat(64)), false);
});

test('hasValidSentryDsn accepts valid DSN format', () => {
  assert.equal(hasValidSentryDsn('https://abc123@sentry.io/123456'), true);
  assert.equal(hasValidSentryDsn('http://token@o123456.ingest.sentry.io/789'), true);
  assert.equal(hasValidSentryDsn('not-a-dsn'), false);
  assert.equal(hasValidSentryDsn(''), false);
});

test('classifyClerkKeyMode identifies test and live keys', () => {
  assert.equal(classifyClerkKeyMode('pk_test_abc123'), 'test');
  assert.equal(classifyClerkKeyMode('pk_live_abc123'), 'live');
  assert.equal(classifyClerkKeyMode('sk_test_abc123'), 'test');
  assert.equal(classifyClerkKeyMode('invalid'), null);
  assert.equal(classifyClerkKeyMode(''), null);
});

test('classifyStripeSecretMode identifies test and live keys', () => {
  assert.equal(classifyStripeSecretMode('sk_test_abc123'), 'test');
  assert.equal(classifyStripeSecretMode('sk_live_abc123'), 'live');
  assert.equal(classifyStripeSecretMode('pk_test_abc'), null);
  assert.equal(classifyStripeSecretMode(''), null);
});

// ─── Degraded-mode service detection ────────────────────────────────────

test('hasConfiguredStripe returns false when STRIPE_SECRET_KEY is absent', () => {
  const saved = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  assert.equal(hasConfiguredStripe(), false);
  process.env.STRIPE_SECRET_KEY = saved;
});

test('hasConfiguredStripe returns false when STRIPE_SECRET_KEY is a placeholder', () => {
  const saved = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'sk_test_xxxx';
  assert.equal(hasConfiguredStripe(), false);
  process.env.STRIPE_SECRET_KEY = saved;
});

test('hasConfiguredEmailDelivery returns false when RESEND_API_KEY is absent', () => {
  const savedKey = process.env.RESEND_API_KEY;
  const savedFrom = process.env.RESEND_FROM_EMAIL;
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
  assert.equal(hasConfiguredEmailDelivery(), false);
  if (savedKey !== undefined) process.env.RESEND_API_KEY = savedKey;
  if (savedFrom !== undefined) process.env.RESEND_FROM_EMAIL = savedFrom;
});

test('hasConfiguredEmailDelivery requires both key and from address', () => {
  const savedKey = process.env.RESEND_API_KEY;
  const savedFrom = process.env.RESEND_FROM_EMAIL;
  const savedEmailFrom = process.env.EMAIL_FROM;

  process.env.RESEND_API_KEY = 're_realkey123';
  delete process.env.RESEND_FROM_EMAIL;
  delete process.env.EMAIL_FROM;
  assert.equal(hasConfiguredEmailDelivery(), false);

  process.env.RESEND_FROM_EMAIL = 'noreply@prymal.io';
  assert.equal(hasConfiguredEmailDelivery(), true);

  if (savedKey !== undefined) process.env.RESEND_API_KEY = savedKey;
  else delete process.env.RESEND_API_KEY;
  if (savedFrom !== undefined) process.env.RESEND_FROM_EMAIL = savedFrom;
  else delete process.env.RESEND_FROM_EMAIL;
  if (savedEmailFrom !== undefined) process.env.EMAIL_FROM = savedEmailFrom;
  else delete process.env.EMAIL_FROM;
});

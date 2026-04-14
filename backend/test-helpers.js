export function setupTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5433/axiom';
  process.env.CLERK_PUBLISHABLE_KEY ??= 'pk_test_prymaltestkey';
  process.env.CLERK_SECRET_KEY ??= 'sk_test_prymaltestkey';
  process.env.CLERK_WEBHOOK_SECRET ??= 'whsec_prymal';
  process.env.ANTHROPIC_API_KEY ??= 'sk-ant-test-prymal';
  process.env.OPENAI_API_KEY ??= 'sk-test-prymal';
  process.env.STRIPE_SECRET_KEY ??= 'sk_test_prymal';
  process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_prymal';
  process.env.ENCRYPTION_KEY ??= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.INTEGRATION_STATE_SECRET ??= 'prymal_test_integration_state_secret';
}

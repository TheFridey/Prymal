import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { MemoryRateLimitStore, createRateLimiter, planAwareRateLimit } from './rateLimit.js';

test('createRateLimiter allows requests until the fixed window limit is exceeded', async () => {
  const app = new Hono();
  app.use(
    '*',
    createRateLimiter({
      max: 2,
      windowMs: 60_000,
      keyPrefix: 'test',
      store: new MemoryRateLimitStore(),
      identifier: () => '127.0.0.1',
    }),
  );
  app.get('/', (context) => context.json({ ok: true }));

  const first = await app.request('/');
  const second = await app.request('/');
  const third = await app.request('/');

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(third.status, 429);
  assert.equal(third.headers.get('x-ratelimit-limit'), '2');
  assert.equal(third.headers.get('x-ratelimit-remaining'), '0');
});

test('MemoryRateLimitStore resets counts after the window expires', async () => {
  const store = new MemoryRateLimitStore();

  const first = await store.increment('demo', 5);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const second = await store.increment('demo', 5);

  assert.equal(first.count, 1);
  assert.equal(second.count, 1);
});

function buildPlanAwareApp({ plan = 'free', middleware }) {
  const app = new Hono();
  app.use('*', async (context, next) => {
    context.set('org', {
      orgId: `org-${plan}`,
      orgPlan: plan,
    });
    await next();
  });
  app.use('*', middleware);
  app.get('/', (context) => context.json({ ok: true }));
  return app;
}

test('planAwareRateLimit allows unlimited requests for agency plan', async () => {
  const app = buildPlanAwareApp({
    plan: 'agency',
    middleware: planAwareRateLimit({
      free: 1,
      solo: 1,
      pro: 1,
      teams: 1,
      agency: null,
      store: new MemoryRateLimitStore(),
    }),
  });

  const first = await app.request('/');
  const second = await app.request('/');
  const third = await app.request('/');

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(third.status, 200);
  assert.equal(first.headers.get('x-ratelimit-limit'), null);
});

test('planAwareRateLimit enforces the free plan limit', async () => {
  const app = buildPlanAwareApp({
    plan: 'free',
    middleware: planAwareRateLimit({
      free: 2,
      solo: 4,
      pro: 6,
      teams: 8,
      agency: null,
      store: new MemoryRateLimitStore(),
    }),
  });

  const first = await app.request('/');
  const second = await app.request('/');
  const third = await app.request('/');

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(third.status, 429);
});

test('planAwareRateLimit returns rate limit headers when a plan limit is applied', async () => {
  const app = buildPlanAwareApp({
    plan: 'free',
    middleware: planAwareRateLimit({
      free: 2,
      store: new MemoryRateLimitStore(),
    }),
  });

  const response = await app.request('/');

  assert.equal(response.headers.get('x-ratelimit-limit'), '2');
  assert.equal(response.headers.get('x-ratelimit-remaining'), '1');
  assert.match(response.headers.get('x-ratelimit-reset') ?? '', /^\d+$/);
});

test('planAwareRateLimit 429 response includes upgrade metadata', async () => {
  const app = buildPlanAwareApp({
    plan: 'free',
    middleware: planAwareRateLimit({
      free: 1,
      store: new MemoryRateLimitStore(),
    }),
  });

  await app.request('/');
  const response = await app.request('/');
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(body.code, 'RATE_LIMITED');
  assert.equal(body.upgrade, true);
  assert.equal(body.error, 'Rate limit exceeded. Upgrade your plan for higher limits.');
  assert.equal(body.retryAfter, 60);
});

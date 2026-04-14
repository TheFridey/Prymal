import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { requestContext } from './request-context.js';
import { securityHeaders } from './security-headers.js';

test('requestContext preserves a valid forwarded request id', async () => {
  const app = new Hono();
  app.use('*', requestContext());
  app.get('/', (context) => context.json({ requestId: context.get('requestId') }));

  const response = await app.request('/', {
    headers: {
      'x-request-id': 'req.staff.console-12345',
    },
  });

  const body = await response.json();
  assert.equal(response.headers.get('x-request-id'), 'req.staff.console-12345');
  assert.equal(body.requestId, 'req.staff.console-12345');
});

test('requestContext generates a request id when the header is invalid', async () => {
  const app = new Hono();
  app.use('*', requestContext());
  app.get('/', (context) => context.json({ requestId: context.get('requestId') }));

  const response = await app.request('/', {
    headers: {
      'x-request-id': 'bad id with spaces',
    },
  });

  const body = await response.json();
  assert.ok(typeof body.requestId === 'string');
  assert.ok(body.requestId.length >= 8);
  assert.equal(response.headers.get('x-request-id'), body.requestId);
});

test('securityHeaders adds default hardening headers', async () => {
  const app = new Hono();
  app.use('*', securityHeaders());
  app.get('/', (context) => context.text('ok'));

  const response = await app.request('/');

  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
});

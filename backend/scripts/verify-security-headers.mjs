#!/usr/bin/env node

import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { DEFAULT_SECURITY_HEADERS, securityHeaders } from '../src/middleware/security-headers.js';

const app = new Hono();
app.use('*', securityHeaders());
app.get('/', (context) => context.text('ok'));

const response = await app.request('https://api.prymal.io/');

for (const [header, expected] of Object.entries(DEFAULT_SECURITY_HEADERS)) {
  assert.equal(response.headers.get(header), expected, `${header} must be set to ${expected}`);
}

assert.equal(
  response.headers.get('Strict-Transport-Security'),
  'max-age=31536000; includeSubDomains',
  'Strict-Transport-Security must be present on HTTPS requests.',
);

console.log('[ok] Security headers are configured with the expected production values.');

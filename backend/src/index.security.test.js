import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setupTestEnv } from '../test-helpers.js';

setupTestEnv();

process.env.FRONTEND_URL ??= 'http://localhost:5173';
process.env.API_URL ??= 'http://localhost:3001';
process.env.APP_URL ??= 'http://localhost:5173';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const { default: app } = await import('./index.js');

test('Clerk webhook route is not throttled by the auth wildcard limiter', async () => {
  const statuses = [];

  for (let index = 0; index < 25; index += 1) {
    const response = await app.request('/api/auth/webhook/clerk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    statuses.push(response.status);
  }

  assert.equal(statuses.includes(429), false);
  assert.equal(statuses.every((status) => status === 400 || status === 500), true);
});

test('verify-security-headers script passes', () => {
  const result = spawnSync(process.execPath, ['scripts/verify-security-headers.mjs'], {
    cwd: backendRoot,
    encoding: 'utf8',
    env: process.env,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[ok\] Security headers are configured/i);
});

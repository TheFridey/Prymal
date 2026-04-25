import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { requireOrg } = await import('../middleware/auth.js');

test('learning signals endpoint is wired through org authentication', async () => {
  const source = fs.readFileSync(new URL('./org.js', import.meta.url), 'utf8');
  assert.match(source, /router\.get\('\/learning-signals', requireOrg,/);
});

test('org authentication blocks unauthenticated learning signal requests before route handlers run', async () => {
  let nextCalled = false;
  let response = null;
  const context = {
    get: () => () => undefined,
    json: (payload, status) => {
      response = { payload, status };
      return response;
    },
  };

  await requireOrg(context, async () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.status, 401);
  assert.equal(response.payload.error, 'Unauthorised');
});

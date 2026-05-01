import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { setupTestEnv } from '../../../test-helpers.js';
import securityRouter, { stripUnsafeMetadataForSecurityResponse } from './security.js';

setupTestEnv();

test('admin security endpoints are mounted behind staff auth', async () => {
  const app = new Hono();
  app.use('*', async (context, next) => {
    context.set('clerkAuth', () => ({ userId: null }));
    await next();
  });
  app.route('/', securityRouter);

  const response = await app.request('/security/classifier-metrics');
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error, 'Unauthorised');
});

test('admin security metadata sanitizer removes raw unsafe content recursively', () => {
  const sanitized = stripUnsafeMetadataForSecurityResponse({
    content: 'raw unsafe content',
    nested: {
      prompt: 'hidden prompt',
      keep: 'safe hash',
      array: [
        { html: '<div>raw</div>', contentHash: 'abc123' },
        { text: 'raw text', category: 'prompt_injection' },
      ],
    },
    modelClassifier: {
      finalVerdict: 'BLOCK',
    },
  });

  assert.equal(sanitized.content, undefined);
  assert.equal(sanitized.nested.prompt, undefined);
  assert.equal(sanitized.nested.keep, 'safe hash');
  assert.equal(sanitized.nested.array[0].html, undefined);
  assert.equal(sanitized.nested.array[0].contentHash, 'abc123');
  assert.equal(sanitized.nested.array[1].text, undefined);
  assert.equal(sanitized.nested.array[1].category, 'prompt_injection');
  assert.deepEqual(sanitized.modelClassifier, { finalVerdict: 'BLOCK' });
});

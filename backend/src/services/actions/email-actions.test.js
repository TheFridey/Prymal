import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../../test-helpers.js';

setupTestEnv();

const { buildRawMessage } = await import('./email-actions.js');

test('buildRawMessage normalizes recipients and strips header newlines', () => {
  const raw = buildRawMessage({
    to: 'first@example.com; second@example.com',
    subject: 'Launch update\r\nBcc: hidden@example.com',
    body: 'Hello from Prymal.',
    cc: ['copy@example.com'],
    replyTo: 'owner@example.com\r\nX-Bad: yes',
  });

  const decoded = Buffer.from(raw, 'base64url').toString('utf8');

  assert.match(decoded, /^To: first@example\.com, second@example\.com/m);
  assert.match(decoded, /^Cc: copy@example\.com/m);
  assert.match(decoded, /^Reply-To: owner@example\.com X-Bad: yes/m);
  assert.match(decoded, /^Subject: Launch update Bcc: hidden@example\.com/m);
  assert.doesNotMatch(decoded, /^Bcc:/m);
});

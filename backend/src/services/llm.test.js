import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { sanitizeAgentOutputText } = await import('./llm.js');

test('sanitizeAgentOutputText removes em dashes from generated agent output', () => {
  const emDash = String.fromCharCode(8212);
  const output = `Headline${emDash}subhead\nJSON value: {"summary":"A${emDash}B"}`;

  const sanitized = sanitizeAgentOutputText(output);

  assert.equal(sanitized.includes(emDash), false);
  assert.equal(sanitized, 'Headline-subhead\nJSON value: {"summary":"A-B"}');
});

test('sanitizeAgentOutputText leaves non-string values untouched', () => {
  assert.equal(sanitizeAgentOutputText(null), null);
  assert.deepEqual(sanitizeAgentOutputText({ text: 'ok' }), { text: 'ok' });
});

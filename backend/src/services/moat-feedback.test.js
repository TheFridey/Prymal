import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSuccessfulPatternsPrompt } from './moat-feedback-patterns.js';

test('buildSuccessfulPatternsPrompt returns null without history', () => {
  assert.equal(buildSuccessfulPatternsPrompt([]), null);
});

test('buildSuccessfulPatternsPrompt keeps historical outcomes as weak priors', () => {
  const prompt = buildSuccessfulPatternsPrompt([
    {
      contentType: 'email',
      metric: 'open_rate',
      notes: 'Short subject line won.',
      body: 'A concise customer email that performed well.',
    },
  ]);

  assert.match(prompt, /weak weighted priors/i);
  assert.match(prompt, /open_rate/);
  assert.match(prompt, /Short subject line won/);
  assert.match(prompt, /do not copy blindly/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVeoVideoPrompt, getVeoVideoModel } from './veo-video-provider.js';

test('getVeoVideoModel selects the standard lane when requested', () => {
  assert.equal(getVeoVideoModel('standard'), 'veo-3.1-generate-preview');
  assert.equal(getVeoVideoModel('unknown-mode'), 'veo-3.1-lite-generate-preview');
});

test('buildVeoVideoPrompt adds legibility guardrails for text-heavy briefs', () => {
  const prompt = buildVeoVideoPrompt(
    'Create a 10-second promo spot. On-screen copy: "Your agency\'s AI team." then "Specialist agents. One workflow."',
  );

  assert.match(prompt, /title-safe framing/i);
  assert.match(prompt, /one short headline at a time/i);
  assert.match(prompt, /each phrase as its own separate title card scene/i);
  assert.match(prompt, /Creative brief:/);
});

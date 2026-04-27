import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VEO_NEGATIVE_PROMPT,
  VeoVideoProvider,
  buildVeoVideoPrompt,
  getVeoVideoModel,
} from './veo-video-provider.js';

function createCapturingProvider() {
  const provider = new VeoVideoProvider({ apiKey: 'AI-test-key-for-unit-tests' });
  const calls = [];
  provider.client = {
    models: {
      generateVideos: async (args) => {
        calls.push(args);
        return { name: 'operations/test', done: true, response: null };
      },
    },
  };
  return { provider, calls };
}

test('getVeoVideoModel selects the standard lane when requested', () => {
  assert.equal(getVeoVideoModel('standard'), 'veo-3.1-generate-preview');
  assert.equal(getVeoVideoModel('unknown-mode'), 'veo-3.1-lite-generate-preview');
});

test('startJob includes the default negative prompt for text-only renders', async () => {
  const { provider, calls } = createCapturingProvider();
  await provider.startJob({
    prompt: 'A polished promo.',
    durationSeconds: 8,
    resolution: '1080p',
    aspectRatio: '16:9',
    mode: 'lite',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].config.negativePrompt, DEFAULT_VEO_NEGATIVE_PROMPT);
  assert.equal(calls[0].config.referenceImages, undefined);
});

test('startJob omits the negative prompt when reference images are attached', async () => {
  const { provider, calls } = createCapturingProvider();
  await provider.startJob({
    prompt: 'A polished promo.',
    durationSeconds: 8,
    resolution: '1080p',
    aspectRatio: '16:9',
    mode: 'standard',
    referenceImages: [{ image: { imageBytes: 'base64', mimeType: 'image/webp' } }],
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].config.negativePrompt, undefined);
  assert.equal(calls[0].config.referenceImages.length, 1);
});

test('startJob omits the negative prompt when useNegativePrompt is false', async () => {
  const { provider, calls } = createCapturingProvider();
  await provider.startJob({
    prompt: 'A polished promo.',
    durationSeconds: 8,
    resolution: '1080p',
    aspectRatio: '16:9',
    mode: 'lite',
    useNegativePrompt: false,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].config.negativePrompt, undefined);
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

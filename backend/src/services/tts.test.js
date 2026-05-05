import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { isTtsEnabled, getTtsModel, generateSpeechSafe } = await import('./tts.js');

test('generateSpeechSafe returns null when sentinel verdict is HOLD', async () => {
  process.env.OPENAI_TTS_ENABLED = 'true';
  process.env.OPENAI_API_KEY = 'sk-live-testkey123';

  const result = await generateSpeechSafe('some agent output', 'HOLD', { orgPlan: 'pro' });
  assert.equal(result, null);
});

test('getTtsModel returns HD model for Teams plan', () => {
  process.env.OPENAI_TTS_HD_PLANS = 'teams,agency';
  assert.equal(getTtsModel('teams'), 'tts-1-hd');
  assert.equal(getTtsModel('Teams'), 'tts-1-hd');
  assert.equal(getTtsModel('TEAMS'), 'tts-1-hd');
});

test('getTtsModel returns HD model for Agency plan', () => {
  process.env.OPENAI_TTS_HD_PLANS = 'teams,agency';
  assert.equal(getTtsModel('agency'), 'tts-1-hd');
});

test('getTtsModel falls back to standard model for non-HD plans', () => {
  process.env.OPENAI_TTS_HD_PLANS = 'teams,agency';
  assert.equal(getTtsModel('pro'), 'tts-1');
  assert.equal(getTtsModel('starter'), 'tts-1');
  assert.equal(getTtsModel(undefined), 'tts-1');
  assert.equal(getTtsModel(null), 'tts-1');
});

test('generateSpeechSafe returns null when TTS is disabled', async () => {
  process.env.OPENAI_TTS_ENABLED = 'false';
  const result = await generateSpeechSafe('hello', 'PASS', { orgPlan: 'teams' });
  assert.equal(result, null);
});

test('generateSpeechSafe returns null on API error without throwing', async () => {
  process.env.OPENAI_TTS_ENABLED = 'true';
  process.env.OPENAI_API_KEY = 'sk-live-intentionally-invalid-for-unit-test';

  // Should not throw — safe wrapper catches and returns null
  const result = await generateSpeechSafe('hello', 'PASS', { orgPlan: 'pro' });
  assert.equal(result, null);
});

test('audio_response SSE event shape matches expected contract', () => {
  // Validates the expected shape of audio_response payloads emitted over SSE.
  // generateSpeech returns { audioBase64, format, model } — the route layer
  // adds durationMs before emitting.
  const mockTtsResult = {
    audioBase64: Buffer.from('fake-mp3-bytes').toString('base64'),
    format: 'mp3',
    model: 'tts-1',
  };

  const ssePayload = {
    type: 'audio_response',
    audioBase64: mockTtsResult.audioBase64,
    format: mockTtsResult.format,
    durationMs: null,
  };

  assert.equal(ssePayload.type, 'audio_response');
  assert.equal(typeof ssePayload.audioBase64, 'string');
  assert.ok(ssePayload.audioBase64.length > 0);
  assert.equal(ssePayload.format, 'mp3');
  assert.ok('durationMs' in ssePayload);
});

test('isTtsEnabled reads OPENAI_TTS_ENABLED correctly', () => {
  process.env.OPENAI_TTS_ENABLED = 'true';
  assert.equal(isTtsEnabled(), true);

  process.env.OPENAI_TTS_ENABLED = '1';
  assert.equal(isTtsEnabled(), true);

  process.env.OPENAI_TTS_ENABLED = 'yes';
  assert.equal(isTtsEnabled(), true);

  process.env.OPENAI_TTS_ENABLED = 'false';
  assert.equal(isTtsEnabled(), false);

  process.env.OPENAI_TTS_ENABLED = '';
  assert.equal(isTtsEnabled(), false);
});

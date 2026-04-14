import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  OPENAI_REALTIME_MODEL,
  createRealtimeSessionToken,
} = await import('./openai-realtime.js');

test('createRealtimeSessionToken returns the ephemeral client secret and expiry', async () => {
  const calls = [];

  const result = await createRealtimeSessionToken({
    apiKey: 'sk-test-prymal-realtime',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          client_secret: {
            value: 'rt_secret_123',
            expires_at: 1_775_651_234,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    },
  });

  assert.equal(result.token, 'rt_secret_123');
  assert.equal(result.expiresAt, 1_775_651_234);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/realtime/sessions');
  assert.equal(calls[0].init.method, 'POST');

  const requestBody = JSON.parse(calls[0].init.body);
  assert.equal(requestBody.model, OPENAI_REALTIME_MODEL);
  assert.deepEqual(requestBody.input_audio_transcription, { model: 'whisper-1' });
  assert.deepEqual(requestBody.turn_detection, { type: 'server_vad', silence_duration_ms: 600 });
});

test('createRealtimeSessionToken throws a configured error when OpenAI rejects the request', async () => {
  await assert.rejects(
    () =>
      createRealtimeSessionToken({
        apiKey: 'sk-test-prymal-realtime',
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              error: { message: 'Rate limit exceeded.' },
            }),
            {
              status: 429,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
      }),
    (error) => {
      assert.equal(error.code, 'REALTIME_RATE_LIMITED');
      assert.equal(error.status, 429);
      assert.match(error.message, /Rate limit exceeded/i);
      return true;
    },
  );
});

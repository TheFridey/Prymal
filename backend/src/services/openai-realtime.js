export const OPENAI_REALTIME_MODEL = 'gpt-4o-realtime-preview-2024-12-17';

export async function createRealtimeSessionToken({
  apiKey = process.env.OPENAI_API_KEY?.trim(),
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey || /xxxx|your_|placeholder/i.test(apiKey) || !apiKey.startsWith('sk-')) {
    const error = new Error('OPENAI_API_KEY is required for OpenAI Realtime sessions.');
    error.status = 503;
    error.code = 'REALTIME_NOT_CONFIGURED';
    throw error;
  }

  if (typeof fetchImpl !== 'function') {
    const error = new Error('Fetch is unavailable for OpenAI Realtime session creation.');
    error.status = 500;
    error.code = 'REALTIME_FETCH_UNAVAILABLE';
    throw error;
  }

  const response = await fetchImpl('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_REALTIME_MODEL,
      voice: 'alloy',
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: { type: 'server_vad', silence_duration_ms: 600 },
    }),
  });

  const responseText = await response.text();
  const payload = tryParseJson(responseText);

  if (!response.ok) {
    const error = new Error(
      payload?.error?.message ||
      payload?.message ||
      responseText ||
      'OpenAI Realtime session creation failed.',
    );
    error.status = response.status;
    error.code =
      response.status === 401
        ? 'REALTIME_AUTH_FAILED'
        : response.status === 429
          ? 'REALTIME_RATE_LIMITED'
          : 'REALTIME_SESSION_FAILED';
    error.data = payload ?? null;
    throw error;
  }

  const token = payload?.client_secret?.value;
  const expiresAt = payload?.client_secret?.expires_at;

  if (!token || expiresAt == null) {
    const error = new Error('OpenAI Realtime session response did not include a client secret.');
    error.status = 502;
    error.code = 'REALTIME_SESSION_INVALID';
    error.data = payload ?? null;
    throw error;
  }

  return {
    token,
    expiresAt,
    session: payload,
  };
}

function tryParseJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

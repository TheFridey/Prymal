import OpenAI from 'openai';

const TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || 'gpt-4o-transcribe';

export async function transcribeAudioFile(file, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is required for voice transcription.');
    error.status = 503;
    error.code = 'TRANSCRIPTION_NOT_CONFIGURED';
    throw error;
  }

  if (/xxxx|your_|placeholder/i.test(apiKey) || !apiKey.startsWith('sk-')) {
    const error = new Error(
      'OPENAI_API_KEY in backend/.env is invalid. Add a real OpenAI API key for voice transcription and restart the backend.',
    );
    error.status = 503;
    error.code = 'TRANSCRIPTION_AUTH_INVALID';
    throw error;
  }

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.audio.transcriptions.create({
      file,
      model: TRANSCRIPTION_MODEL,
      language: options.language ?? 'en',
      prompt: options.prompt,
    });

    return response.text?.trim() ?? '';
  } catch (error) {
    throw normalizeTranscriptionError(error);
  }
}

function normalizeTranscriptionError(error) {
  if (!error) {
    const normalized = new Error('Prymal could not transcribe the audio sample.');
    normalized.status = 503;
    normalized.code = 'TRANSCRIPTION_FAILED';
    return normalized;
  }

  if (['TRANSCRIPTION_NOT_CONFIGURED', 'TRANSCRIPTION_AUTH_INVALID'].includes(error.code)) {
    return error;
  }

  const rawMessage = [error.message, error.error?.message, error.body?.error?.message]
    .filter(Boolean)
    .join(' ');

  const normalized = new Error('Prymal could not transcribe the audio sample.');
  normalized.status = error.status ?? error.statusCode ?? 503;
  normalized.code = error.code ?? 'TRANSCRIPTION_FAILED';

  if (/invalid api key|authentication|unauthorized|401/i.test(rawMessage)) {
    normalized.message =
      'OPENAI_API_KEY was rejected by OpenAI. Update backend/.env with a valid key for voice transcription and restart the backend.';
    normalized.status = 503;
    normalized.code = 'TRANSCRIPTION_AUTH_INVALID';
    return normalized;
  }

  if (/model .* not found|not_found|invalid model/i.test(rawMessage)) {
    normalized.message =
      'The configured transcription model is unavailable. Update OPENAI_TRANSCRIPTION_MODEL in backend/.env and restart the backend.';
    normalized.status = 503;
    normalized.code = 'TRANSCRIPTION_MODEL_INVALID';
    return normalized;
  }

  if (/rate.?limit|429/i.test(rawMessage)) {
    normalized.message = 'OpenAI rate limited the transcription request. Please try again in a moment.';
    normalized.status = 429;
    normalized.code = 'TRANSCRIPTION_RATE_LIMITED';
    return normalized;
  }

  if (rawMessage) {
    normalized.message = rawMessage;
  }

  return normalized;
}

/**
 * Text-to-Speech service for agent voice output.
 * Uses OpenAI TTS API (/v1/audio/speech).
 * HD model is available for Teams and Agency plans.
 * SENTINEL HOLD verdicts must suppress TTS — never call this for held outputs.
 */
import * as Sentry from '@sentry/node';

const TTS_STANDARD_MODEL = 'tts-1';
const TTS_HD_MODEL = 'tts-1-hd';
const DEFAULT_VOICE = 'alloy';
const HD_PLANS = new Set(
  (process.env.OPENAI_TTS_HD_PLANS ?? 'teams,agency')
    .split(',')
    .map((plan) => plan.trim().toLowerCase())
    .filter(Boolean),
);

export function isTtsEnabled() {
  const flag = String(process.env.OPENAI_TTS_ENABLED ?? '').trim().toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

export function getTtsModel(orgPlan) {
  if (HD_PLANS.has((orgPlan ?? '').toLowerCase())) {
    return TTS_HD_MODEL;
  }
  return TTS_STANDARD_MODEL;
}

/**
 * Generate speech audio from text using OpenAI TTS.
 * Returns base64-encoded MP3 audio.
 *
 * Must NOT be called when SENTINEL verdict is HOLD.
 *
 * @param {string} text - The text to synthesise
 * @param {{ orgPlan?: string, voice?: string }} options
 * @returns {{ audioBase64: string, format: 'mp3', model: string }}
 */
export async function generateSpeech(text, { orgPlan, voice = DEFAULT_VOICE } = {}) {
  if (!isTtsEnabled()) {
    const error = new Error('TTS is not enabled. Set OPENAI_TTS_ENABLED=true to activate voice output.');
    error.code = 'TTS_NOT_ENABLED';
    throw error;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith('sk-test') || /xxxx|placeholder/i.test(apiKey)) {
    const error = new Error('OPENAI_API_KEY is not configured for TTS.');
    error.code = 'TTS_NOT_CONFIGURED';
    throw error;
  }

  const model = getTtsModel(orgPlan);
  const truncatedText = text.length > 4096 ? `${text.slice(0, 4093)}…` : text;

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: truncatedText,
      voice,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const error = new Error(`OpenAI TTS API error ${response.status}: ${errorText}`);
    error.code = 'TTS_API_ERROR';
    error.status = response.status;
    throw error;
  }

  const buffer = await response.arrayBuffer();
  const audioBase64 = Buffer.from(buffer).toString('base64');

  return { audioBase64, format: 'mp3', model };
}

/**
 * Safe TTS wrapper — logs to Sentry on failure, never throws.
 * Returns null if TTS fails or is not enabled.
 *
 * @param {string} text
 * @param {string} sentinelVerdict - Must be 'PASS' or 'REPAIR' — never call for 'HOLD'
 * @param {{ orgPlan?: string }} context
 * @returns {{ audioBase64: string, format: 'mp3', model: string } | null}
 */
export async function generateSpeechSafe(text, sentinelVerdict, { orgPlan } = {}) {
  if (sentinelVerdict === 'HOLD') {
    return null;
  }

  if (!isTtsEnabled()) {
    return null;
  }

  try {
    return await generateSpeech(text, { orgPlan });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'tts', verdict: sentinelVerdict },
    });
    return null;
  }
}

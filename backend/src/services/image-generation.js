import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-1.5';
const GENERATED_IMAGE_DIR = path.resolve(process.cwd(), 'storage', 'generated-images');
const ALLOWED_FORMATS = new Set(['png', 'webp', 'jpeg']);

export async function generateImageAsset({
  prompt,
  agent = null,
  size = '1024x1024',
  quality = 'medium',
  outputFormat = 'webp',
  background = 'auto',
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is required for image generation.');
    error.status = 503;
    error.code = 'IMAGE_NOT_CONFIGURED';
    throw error;
  }

  if (/xxxx|your_|placeholder/i.test(apiKey) || !apiKey.startsWith('sk-')) {
    const error = new Error(
      'OPENAI_API_KEY in backend/.env is invalid. Add a real OpenAI API key for image generation and restart the backend.',
    );
    error.status = 503;
    error.code = 'IMAGE_AUTH_INVALID';
    throw error;
  }

  const normalizedFormat = ALLOWED_FORMATS.has(outputFormat) ? outputFormat : 'webp';
  const client = new OpenAI({ apiKey });
  const finalPrompt = buildImagePrompt({ prompt, agent });

  try {
    const response = await client.images.generate({
      model: IMAGE_MODEL,
      prompt: finalPrompt,
      size,
      quality,
      background,
      output_format: normalizedFormat,
    });

    const base64 = response.data?.[0]?.b64_json;

    if (!base64) {
      const error = new Error('OpenAI did not return image data.');
      error.status = 502;
      error.code = 'IMAGE_EMPTY';
      throw error;
    }

    await mkdir(GENERATED_IMAGE_DIR, { recursive: true });
    const fileName = `${Date.now()}-${randomUUID()}.${normalizedFormat}`;
    const filePath = path.join(GENERATED_IMAGE_DIR, fileName);
    await writeFile(filePath, Buffer.from(base64, 'base64'));

    return {
      prompt,
      revisedPrompt: response.data?.[0]?.revised_prompt ?? null,
      model: IMAGE_MODEL,
      size,
      quality,
      outputFormat: normalizedFormat,
      background,
      url: `/generated-assets/${fileName}`,
      fileName,
    };
  } catch (error) {
    throw normalizeImageError(error);
  }
}

export async function readGeneratedImageAsset(fileName) {
  const safeName = path.basename(fileName);

  if (!safeName || safeName !== fileName) {
    const error = new Error('Invalid asset path.');
    error.status = 400;
    error.code = 'IMAGE_ASSET_INVALID';
    throw error;
  }

  return readFile(path.join(GENERATED_IMAGE_DIR, safeName));
}

function buildImagePrompt({ prompt, agent }) {
  const lines = [
    'Create a polished production-ready marketing or product-support image that feels premium, clean, and useful.',
    'Avoid adding any watermark or UI chrome unless explicitly requested.',
    prompt.trim(),
  ];

  if (agent?.name && agent?.title) {
    lines.unshift(
      `The request is coming from ${agent.name}, a ${agent.title}. Lean into that specialist perspective if it helps the output.`,
    );
  }

  return lines.join('\n\n');
}

function normalizeImageError(error) {
  if (!error) {
    const normalized = new Error('Prymal could not generate the image.');
    normalized.status = 503;
    normalized.code = 'IMAGE_GENERATION_FAILED';
    return normalized;
  }

  if (['IMAGE_NOT_CONFIGURED', 'IMAGE_AUTH_INVALID', 'IMAGE_EMPTY'].includes(error.code)) {
    return error;
  }

  const rawMessage = [error.message, error.error?.message, error.body?.error?.message]
    .filter(Boolean)
    .join(' ');

  const normalized = new Error('Prymal could not generate the image.');
  normalized.status = error.status ?? error.statusCode ?? 503;
  normalized.code = error.code ?? 'IMAGE_GENERATION_FAILED';

  if (/invalid api key|authentication|unauthorized|401/i.test(rawMessage)) {
    normalized.message =
      'OPENAI_API_KEY was rejected by OpenAI. Update backend/.env with a valid key for image generation and restart the backend.';
    normalized.status = 503;
    normalized.code = 'IMAGE_AUTH_INVALID';
    return normalized;
  }

  if (/model .* not found|not_found|invalid model/i.test(rawMessage)) {
    normalized.message =
      'The configured image model is unavailable. Update OPENAI_IMAGE_MODEL in backend/.env and restart the backend.';
    normalized.status = 503;
    normalized.code = 'IMAGE_MODEL_INVALID';
    return normalized;
  }

  if (/rate.?limit|429/i.test(rawMessage)) {
    normalized.message = 'OpenAI rate limited the image request. Please try again in a moment.';
    normalized.status = 429;
    normalized.code = 'IMAGE_RATE_LIMITED';
    return normalized;
  }

  if (rawMessage) {
    normalized.message = rawMessage;
  }

  return normalized;
}

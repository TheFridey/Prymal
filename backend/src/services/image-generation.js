import OpenAI from 'openai';
import { getMediaStorage } from './media-storage/index.js';
import { recordWardenAuditEvent } from './warden/index.js';

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-1.5';
const REQUIRED_IMAGE_FORMAT = 'webp';

export async function generateImageAsset({
  prompt,
  agent = null,
  size = '1024x1024',
  quality = 'medium',
  background = 'auto',
  orgId = null,
  conversationId = null,
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

  const client = new OpenAI({ apiKey });
  const finalPrompt = buildImagePrompt({ prompt, agent });

  try {
    const response = await client.images.generate({
      model: IMAGE_MODEL,
      prompt: finalPrompt,
      size,
      quality,
      background,
      output_format: REQUIRED_IMAGE_FORMAT,
    });

    const base64 = response.data?.[0]?.b64_json;

    if (!base64) {
      const error = new Error('OpenAI did not return image data.');
      error.status = 502;
      error.code = 'IMAGE_EMPTY';
      throw error;
    }

    const fileBuffer = Buffer.from(base64, 'base64');
    const mediaStorage = getMediaStorage();
    const storedAsset = await mediaStorage.uploadGeneratedImage({
      buffer: fileBuffer,
      outputFormat: REQUIRED_IMAGE_FORMAT,
      mimeType: 'image/webp',
      orgId,
      conversationId,
      metadata: {
        prompt,
        model: IMAGE_MODEL,
        agentId: agent?.id ?? null,
      },
    });

    return {
      prompt,
      revisedPrompt: response.data?.[0]?.revised_prompt ?? null,
      model: IMAGE_MODEL,
      size,
      quality,
      outputFormat: REQUIRED_IMAGE_FORMAT,
      background,
      url: storedAsset.deliveryUrl ?? storedAsset.secureUrl ?? null,
      fileName: storedAsset.fileName ?? storedAsset.publicId ?? null,
      storageProvider: storedAsset.storageProvider ?? 'local',
      publicId: storedAsset.publicId ?? null,
      resourceType: storedAsset.resourceType ?? 'image',
      secureUrl: storedAsset.secureUrl ?? null,
      deliveryUrl: storedAsset.deliveryUrl ?? storedAsset.secureUrl ?? null,
      bytes: storedAsset.bytes ?? fileBuffer.length,
      width: storedAsset.width ?? null,
      height: storedAsset.height ?? null,
      format: storedAsset.format ?? REQUIRED_IMAGE_FORMAT,
      cleanupStatus: storedAsset.cleanupStatus ?? 'retained',
    };
  } catch (error) {
    const normalized = normalizeImageError(error);
    if (normalized.code === 'IMAGE_PROVIDER_SAFETY_REJECTED') {
      await recordWardenAuditEvent({
        orgId,
        surface: 'media_generation',
        sourceType: 'USER',
        action: 'provider_rejected_image',
        verdict: 'BLOCK',
        riskLevel: 'HIGH',
        categories: ['provider_safety_rejection'],
        reasons: ['Image provider rejected the content request.'],
        provider: 'openai',
        metadata: { model: IMAGE_MODEL, size, quality },
      });
    }
    throw normalized;
  }
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

  if (/safety|policy|moderation|content/i.test(rawMessage)) {
    normalized.message = "I can't help create that image.";
    normalized.status = 400;
    normalized.code = 'IMAGE_PROVIDER_SAFETY_REJECTED';
    return normalized;
  }

  if (rawMessage) {
    normalized.message = 'Prymal could not generate the image.';
  }

  return normalized;
}

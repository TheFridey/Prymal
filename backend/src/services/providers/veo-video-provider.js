import { GoogleGenAI } from '@google/genai';
import { VideoProvider } from './video-provider.js';

const VEO_MODELS = {
  lite: process.env.GEMINI_MODEL_VEO?.trim() || 'veo-3.1-lite-generate-preview',
  standard: process.env.GEMINI_MODEL_VEO_STANDARD?.trim() || 'veo-3.1-generate-preview',
};
const DEFAULT_VEO_NEGATIVE_PROMPT = [
  'dense typography',
  'tiny unreadable text',
  'garbled lettering',
  'misspelled UI labels',
  'cluttered interface',
  'stock footage',
  'mascots',
  'glitch effects',
  'crypto aesthetics',
  'cartoon visuals',
].join(', ');

export class VeoVideoProvider extends VideoProvider {
  constructor({ apiKey }) {
    super({ providerId: 'google' });

    if (!apiKey) {
      const error = new Error('GEMINI_API_KEY is required for Veo video generation.');
      error.status = 503;
      error.code = 'VIDEO_NOT_CONFIGURED';
      throw error;
    }

    if (/xxxx|your_|placeholder/i.test(apiKey) || !apiKey.startsWith('AI')) {
      const error = new Error(
        'GEMINI_API_KEY in backend/.env is invalid. Add a real Google AI API key and restart the backend.',
      );
      error.status = 503;
      error.code = 'VIDEO_AUTH_INVALID';
      throw error;
    }

    this.client = new GoogleGenAI({ apiKey });
  }

  async startJob({
    prompt,
    durationSeconds,
    resolution,
    aspectRatio,
    mode = 'lite',
    referenceImages = [],
  }) {
    const model = getVeoVideoModel(mode);
    const finalPrompt = buildVeoVideoPrompt(prompt);
    const config = {
      durationSeconds,
      resolution,
      aspectRatio,
      numberOfVideos: 1,
      negativePrompt: DEFAULT_VEO_NEGATIVE_PROMPT,
    };

    if (Array.isArray(referenceImages) && referenceImages.length > 0) {
      config.referenceImages = referenceImages;
    }

    const operation = await this.client.models.generateVideos({
      model,
      prompt: finalPrompt,
      config,
    });

    return normalizeOperation(operation);
  }

  async pollJob(operation) {
    const polled = await this.client.operations.getVideosOperation({
      operation,
    });

    return normalizeOperation(polled);
  }

  async downloadAsset({ file, downloadPath }) {
    await this.client.files.download({
      file,
      downloadPath,
    });
  }
}

export function getVeoVideoModel(mode = 'lite') {
  return VEO_MODELS[mode] ?? VEO_MODELS.lite;
}

export function buildVeoVideoPrompt(prompt) {
  const normalizedPrompt = String(prompt ?? '').trim();

  if (!normalizedPrompt) {
    return '';
  }

  const sections = [
    'Create a polished, premium product video with clean composition, controlled motion, and legible title-safe framing.',
    'Typography guidance: if text appears on screen, keep it large, sparse, high-contrast, and limited to one short headline at a time.',
    'Avoid dense UI microcopy, tiny dashboard labels, paragraphs, or repeated text across panels.',
    'If exact wording cannot be rendered cleanly, prefer abstract dashboard cards or blank title-safe areas instead of misspelled text.',
  ];

  if (/(?:on[-\s]?screen copy|title card|headline)/i.test(normalizedPrompt)) {
    sections.push('When explicit on-screen copy is requested, present each phrase as its own separate title card scene.');
  }

  sections.push(`Creative brief:\n${normalizedPrompt}`);

  return sections.join('\n\n');
}

function normalizeOperation(operation) {
  return {
    name: operation?.name ?? null,
    done: Boolean(operation?.done),
    response: operation?.response ?? null,
    error: operation?.error ?? null,
    generatedVideo: operation?.response?.generatedVideos?.[0] ?? null,
    raw: operation,
  };
}

let defaultProvider = null;

export function getVeoVideoProvider() {
  if (!defaultProvider) {
    defaultProvider = new VeoVideoProvider({
      apiKey: process.env.GEMINI_API_KEY?.trim(),
    });
  }

  return defaultProvider;
}

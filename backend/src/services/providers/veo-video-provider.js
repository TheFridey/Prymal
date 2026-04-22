import { GoogleGenAI } from '@google/genai';
import { VideoProvider } from './video-provider.js';

const DEFAULT_VEO_MODEL = 'veo-3.1-lite-generate-preview';
const VEO_MODEL = process.env.GEMINI_MODEL_VEO?.trim() || DEFAULT_VEO_MODEL;

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

  async startJob({ prompt, durationSeconds, resolution, aspectRatio }) {
    const operation = await this.client.models.generateVideos({
      model: VEO_MODEL,
      prompt,
      config: {
        durationSeconds,
        resolution,
        aspectRatio,
        numberOfVideos: 1,
      },
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

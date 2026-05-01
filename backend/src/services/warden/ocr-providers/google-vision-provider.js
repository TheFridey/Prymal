import { OCR_PROVIDER_NAMES } from './index.js';

export function createGoogleVisionOcrProvider({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const apiKey = env.GOOGLE_VISION_API_KEY ?? env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    return null;
  }

  return {
    name: OCR_PROVIDER_NAMES.GOOGLE_VISION,
    async extractText(image) {
      const requestBody = buildRequest(image);
      if (!requestBody) {
        return '';
      }

      const url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`;
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requests: [requestBody] }),
      });

      if (!response?.ok) {
        const status = response?.status ?? 'unknown';
        throw new Error(`Google Vision OCR failed with status ${status}`);
      }

      const payload = await response.json();
      const text = payload?.responses?.[0]?.fullTextAnnotation?.text
        ?? payload?.responses?.[0]?.textAnnotations?.[0]?.description
        ?? '';
      return String(text ?? '').slice(0, 32_000);
    },
  };
}

function buildRequest(image) {
  const features = [{ type: 'TEXT_DETECTION', maxResults: 1 }];
  if (image?.contentBase64) {
    return { image: { content: image.contentBase64 }, features };
  }
  if (image?.url && /^https?:\/\//i.test(image.url)) {
    return { image: { source: { imageUri: image.url } }, features };
  }
  if (image?.gcsUri && /^gs:\/\//i.test(image.gcsUri)) {
    return { image: { source: { gcsImageUri: image.gcsUri } }, features };
  }
  return null;
}

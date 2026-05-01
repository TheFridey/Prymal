import { OCR_PROVIDER_NAMES } from './index.js';

export function createCloudinaryOcrProvider({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return {
    name: OCR_PROVIDER_NAMES.CLOUDINARY,
    async extractText(image) {
      const publicId = image?.publicId ?? image?.cloudinaryPublicId ?? image?.assetId;
      if (!publicId) {
        return '';
      }

      const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/image/upload/${encodeURIComponent(publicId)}?ocr=adv_ocr`;
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { Authorization: `Basic ${auth}` },
      });

      if (!response?.ok) {
        const status = response?.status ?? 'unknown';
        throw new Error(`Cloudinary OCR failed with status ${status}`);
      }

      const payload = await response.json();
      return collectCloudinaryText(payload);
    },
  };
}

function collectCloudinaryText(payload) {
  const ocr = payload?.info?.ocr?.adv_ocr ?? payload?.ocr?.adv_ocr ?? null;
  if (!ocr) {
    return '';
  }
  const data = ocr?.data ?? [];
  if (!Array.isArray(data)) {
    return '';
  }

  const parts = [];
  for (const block of data) {
    const text = block?.fullTextAnnotation?.text;
    if (typeof text === 'string' && text.trim()) {
      parts.push(text.trim());
    }
  }
  return parts.join('\n').slice(0, 32_000);
}

import { OCR_PROVIDER_NAMES } from './index.js';

export function createTesseractOcrProvider({ env = process.env, loadModule = defaultLoader } = {}) {
  if (String(env.WARDEN_OCR_TESSERACT_ENABLED ?? 'false').toLowerCase() !== 'true') {
    return null;
  }

  let workerPromise = null;

  return {
    name: OCR_PROVIDER_NAMES.TESSERACT,
    async extractText(image) {
      const buffer = resolveBufferOrUrl(image);
      if (!buffer) {
        return '';
      }

      const tesseract = await loadModule().catch(() => null);
      if (!tesseract || typeof tesseract.recognize !== 'function') {
        return '';
      }

      if (!workerPromise && typeof tesseract.createWorker === 'function') {
        workerPromise = tesseract.createWorker(env.WARDEN_OCR_TESSERACT_LANG ?? 'eng');
      }

      const worker = workerPromise ? await workerPromise : null;
      const result = worker
        ? await worker.recognize(buffer)
        : await tesseract.recognize(buffer, env.WARDEN_OCR_TESSERACT_LANG ?? 'eng');

      const text = result?.data?.text ?? '';
      return String(text ?? '').slice(0, 32_000);
    },
  };
}

function resolveBufferOrUrl(image) {
  if (!image) return null;
  if (image.buffer) return image.buffer;
  if (image.contentBase64) {
    try {
      return Buffer.from(image.contentBase64, 'base64');
    } catch {
      return null;
    }
  }
  if (image.url) return image.url;
  if (image.path) return image.path;
  return null;
}

async function defaultLoader() {
  try {
    return await import('tesseract.js');
  } catch {
    return null;
  }
}

import { hashContent } from '../prompt-injection-detector.js';
import { createCloudinaryOcrProvider } from './cloudinary-ocr-provider.js';
import { createGoogleVisionOcrProvider } from './google-vision-provider.js';
import { createTesseractOcrProvider } from './tesseract-provider.js';

const OCR_CACHE = new Map();

export const OCR_PROVIDER_NAMES = Object.freeze({
  NONE: 'none',
  CLOUDINARY: 'cloudinary',
  GOOGLE_VISION: 'google_vision',
  TESSERACT: 'tesseract',
});

export function getOcrConfig(env = process.env) {
  const enabled = String(env.WARDEN_OCR_ENABLED ?? 'false').toLowerCase() === 'true';
  const provider = String(env.WARDEN_OCR_PROVIDER ?? OCR_PROVIDER_NAMES.NONE).toLowerCase();
  return {
    enabled,
    provider,
    timeoutMs: Math.max(500, Number(env.WARDEN_OCR_TIMEOUT_MS ?? 3000)),
    maxImages: Math.max(1, Number(env.WARDEN_OCR_MAX_IMAGES ?? 4)),
    cacheTtlSeconds: Math.max(60, Number(env.WARDEN_OCR_CACHE_TTL_SECONDS ?? 900)),
    maxCacheEntries: Math.max(8, Number(env.WARDEN_OCR_CACHE_MAX ?? env.WARDEN_OCR_CACHE_MAX_ENTRIES ?? 500)),
  };
}

export function getPlanAwareOcrConfig({ orgPlan = 'free', isStaff = false, env = process.env } = {}) {
  const config = getOcrConfig(env);
  const planEnabled = ['agency', 'teams'].includes(String(orgPlan ?? '').toLowerCase());
  const enabled = config.enabled || planEnabled || Boolean(isStaff);

  return {
    ...config,
    enabled,
    provider: enabled && config.provider === OCR_PROVIDER_NAMES.NONE
      ? OCR_PROVIDER_NAMES.CLOUDINARY
      : config.provider,
  };
}

export function isOcrProviderActive(config = getOcrConfig()) {
  return Boolean(config.enabled) && config.provider !== OCR_PROVIDER_NAMES.NONE;
}

export function buildOcrProvider({ config = getOcrConfig(), env = process.env } = {}) {
  if (!isOcrProviderActive(config)) {
    return null;
  }

  for (const providerName of buildProviderPriority(config.provider)) {
    const provider = createProviderByName(providerName, env);
    if (provider) {
      return provider;
    }
  }

  return null;
}

export async function runProviderOcr({
  images = [],
  provider = buildOcrProvider(),
  config = getOcrConfig(),
  cache = OCR_CACHE,
  now = () => Date.now(),
} = {}) {
  const summary = createSummary({ provider, config });
  if (!provider) {
    return summary;
  }

  const sliced = images.slice(0, config.maxImages);
  for (const [index, image] of sliced.entries()) {
    const identifier = buildImageHash(image);
    if (!identifier) {
      summary.skipped += 1;
      continue;
    }

    const cached = readCache(cache, identifier, config, now);
    if (cached) {
      summary.cacheHits += 1;
      summary.results.push({ index, fromCache: true, ...cached });
      continue;
    }

    summary.attempted += 1;
    try {
      const text = await withTimeout(provider.extractText(image, { config }), config.timeoutMs);
      const safeText = String(text ?? '').slice(0, 32_000);
      const result = {
        textHash: hashContent(safeText),
        textLength: safeText.length,
        text: safeText,
      };
      writeCache(cache, identifier, result, config, now);
      summary.results.push({ index, fromCache: false, ...result });
      summary.succeeded += 1;
    } catch (error) {
      const message = String(error?.message ?? error ?? 'OCR provider failed');
      if (/timeout|timed out/i.test(message)) {
        summary.timedOut += 1;
      } else {
        summary.failed += 1;
      }
      summary.errors.push({ index, message });
    }
  }

  summary.aggregateText = summary.results
    .map((entry) => entry.text)
    .filter(Boolean)
    .join('\n\n');
  summary.aggregateHash = summary.aggregateText
    ? hashContent(summary.aggregateText)
    : null;

  return summary;
}

export function buildOcrAuditMetadata(summary) {
  if (!summary) {
    return {
      ocrAttempted: false,
      ocrAvailable: false,
      ocrProvider: OCR_PROVIDER_NAMES.NONE,
      ocr_provider_used: OCR_PROVIDER_NAMES.NONE,
      ocrSourceCount: 0,
      ocrTimedOut: false,
      ocrTextHash: null,
      ocr_result_flagged: false,
    };
  }
  return {
    ocrAttempted: summary.attempted > 0 || summary.cacheHits > 0,
    ocrAvailable: Boolean(summary.providerAvailable),
    ocrProvider: summary.provider,
    ocr_provider_used: summary.provider,
    ocrSourceCount: summary.results.length,
    ocrTimedOut: summary.timedOut > 0,
    ocrTextHash: summary.aggregateHash,
    ocrCacheHits: summary.cacheHits,
    ocrFailed: summary.failed,
    ocr_result_flagged: false,
  };
}

export function clearOcrCacheForTests() {
  OCR_CACHE.clear();
}

function buildProviderPriority(provider) {
  const defaultPriority = [
    OCR_PROVIDER_NAMES.CLOUDINARY,
    OCR_PROVIDER_NAMES.GOOGLE_VISION,
    OCR_PROVIDER_NAMES.TESSERACT,
  ];
  if (!provider || provider === OCR_PROVIDER_NAMES.NONE) {
    return [];
  }
  if (!defaultPriority.includes(provider)) {
    return [provider];
  }
  return [provider, ...defaultPriority.filter((entry) => entry !== provider)];
}

function createProviderByName(providerName, env) {
  switch (providerName) {
    case OCR_PROVIDER_NAMES.CLOUDINARY:
      return createCloudinaryOcrProvider({ env });
    case OCR_PROVIDER_NAMES.GOOGLE_VISION:
      return createGoogleVisionOcrProvider({ env });
    case OCR_PROVIDER_NAMES.TESSERACT:
      return createTesseractOcrProvider({ env });
    default:
      return null;
  }
}

function createSummary({ provider, config }) {
  return {
    provider: provider?.name ?? config.provider ?? OCR_PROVIDER_NAMES.NONE,
    providerAvailable: Boolean(provider),
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    timedOut: 0,
    cacheHits: 0,
    results: [],
    errors: [],
    aggregateText: '',
    aggregateHash: null,
  };
}

function buildImageHash(image) {
  if (!image || typeof image !== 'object') return null;
  if (image.contentHash) return String(image.contentHash);
  if (image.fileId) return `file:${image.fileId}`;
  if (image.url) return `url:${image.url}`;
  if (image.dataHash) return `data:${image.dataHash}`;
  if (image.id) return `id:${image.id}`;
  return null;
}

function readCache(cache, key, config, now) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (now() - entry.createdAt > config.cacheTtlSeconds * 1000) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(cache, key, value, config, now) {
  if (cache.size >= config.maxCacheEntries) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { value, createdAt: now() });
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('OCR provider timed out')), timeoutMs);
    }),
  ]);
}

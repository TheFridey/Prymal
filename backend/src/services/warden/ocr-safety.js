import {
  buildOcrAuditMetadata,
  buildOcrProvider,
  getOcrConfig,
  getPlanAwareOcrConfig,
  isOcrProviderActive,
  OCR_PROVIDER_NAMES,
  runProviderOcr,
} from './ocr-providers/index.js';

export {
  buildOcrAuditMetadata,
  buildOcrProvider,
  getOcrConfig,
  getPlanAwareOcrConfig,
  isOcrProviderActive,
  OCR_PROVIDER_NAMES,
  runProviderOcr,
};

export async function extractSafetyTextFromImages(images = [], options = {}) {
  const normalizedImages = Array.isArray(images) ? images : [];
  const sources = [];
  const textParts = [];

  for (const [index, image] of normalizedImages.entries()) {
    collectTextSource({ image, index, key: 'ocrText', sources, textParts });
    collectTextSource({ image, index, key: 'extractedText', sources, textParts });
    collectTextSource({ image, index, key: 'altText', sources, textParts });
    collectTextSource({ image, index, key: 'caption', sources, textParts });
    collectTextSource({ image, index, key: 'name', sources, textParts, sourceName: 'filename' });
    collectNestedMetadataText({ image, index, sources, textParts });
  }

  let providerSummary = null;
  const config = options.ocrConfig ?? getOcrConfig();
  const provider = options.ocrProvider ?? (isOcrProviderActive(config) ? buildOcrProvider({ config }) : null);

  if (provider) {
    providerSummary = await runProviderOcr({ images: normalizedImages, provider, config });
    for (const result of providerSummary.results) {
      const safeText = normalizeOcrSafetyText(result.text ?? '');
      if (!safeText) continue;
      sources.push({
        index: result.index,
        source: 'provider_ocr',
        length: safeText.length,
        provider: providerSummary.provider,
        fromCache: Boolean(result.fromCache),
        textHash: result.textHash,
        trustBoundary: 'UNTRUSTED_OCR_EVIDENCE',
        normalized: true,
      });
      textParts.push(`[image:${result.index}:provider_ocr]\n${safeText}`);
    }
  }

  return {
    text: textParts.join('\n\n'),
    sources,
    ocrAvailable: Boolean(provider),
    provider: provider?.name ?? options.providerName ?? null,
    providerSummary,
    auditMetadata: buildOcrAuditMetadata(providerSummary),
  };
}

export async function extractTextFromImages(images = [], options = {}) {
  const result = await extractSafetyTextFromImages(images, options);
  return result.text;
}

function collectTextSource({ image, index, key, sources, textParts, sourceName = key }) {
  const value = String(image?.[key] ?? '').trim();
  if (!value) return;

  sources.push({ index, source: sourceName, length: value.length });
  textParts.push(`[image:${index}:${sourceName}]\n${value}`);
}

function collectNestedMetadataText({ image, index, sources, textParts }) {
  const metadataText = String(image?.metadata?.text ?? image?.metadata?.ocrText ?? '').trim();
  if (!metadataText) return;

  sources.push({ index, source: 'metadata.text', length: metadataText.length });
  textParts.push(`[image:${index}:metadata.text]\n${metadataText}`);
}

function normalizeOcrSafetyText(input = '') {
  return String(input)
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

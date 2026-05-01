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

  return {
    text: textParts.join('\n\n'),
    sources,
    ocrAvailable: Boolean(options.ocrProvider),
    provider: options.ocrProvider ?? null,
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

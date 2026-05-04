const BASE_VIDEO_CREDIT_USD = 0.25;
export const IMAGE_GENERATION_REQUEST_TIMEOUT_MS = 180_000;
const STANDARD_VIDEO_PRICING_USD_PER_SECOND = {
  '720p': 0.4,
  '1080p': 0.4,
};

export const IMAGE_QUALITY_OPTIONS = [
  { value: 'low', label: 'Low', credits: 2 },
  { value: 'medium', label: 'Medium', credits: 4 },
  { value: 'high', label: 'High', credits: 8 },
];

export const IMAGE_SIZE_OPTIONS = [
  { value: '1024x1024', label: 'Square 1024 x 1024' },
  { value: '1536x1024', label: 'Landscape 1536 x 1024' },
  { value: '1024x1536', label: 'Portrait 1024 x 1536' },
  { value: 'auto', label: 'Auto' },
];

export const IMAGE_OUTPUT_FORMAT_OPTIONS = [
  { value: 'webp', label: 'WEBP' },
];

export const IMAGE_BACKGROUND_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'opaque', label: 'Opaque' },
  { value: 'transparent', label: 'Transparent' },
];

export const VIDEO_MODE_OPTIONS = {
  lite: {
    id: 'lite',
    label: 'Lite',
    providerLabel: 'Veo 3.1 Lite',
    description: 'Lower-credit, faster renders for drafts, simple promos, and quick iteration.',
    supportedDurations: [4, 6, 8],
    supportedResolutions: ['720p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16'],
    supportsReferenceImages: false,
    referenceImagesRequireDuration: null,
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    providerLabel: 'Veo 3.1 Standard',
    description: 'Higher-quality renders with a heavier credit burn. Best for polished campaign visuals.',
    supportedDurations: [4, 6, 8],
    supportedResolutions: ['720p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16'],
    supportsReferenceImages: true,
    referenceImagesRequireDuration: 8,
  },
};

export function estimatePromptTokens(text) {
  return Math.ceil((String(text ?? '').trim().length || 0) / 4);
}

export function estimateImageExecutionCredits({ quality = 'medium' } = {}) {
  if (quality === 'high') {
    return 8;
  }

  if (quality === 'low') {
    return 2;
  }

  return 4;
}

export function getVideoModeConfig(mode = 'lite') {
  return VIDEO_MODE_OPTIONS[mode] ?? VIDEO_MODE_OPTIONS.lite;
}

export function estimateVideoCredits({
  mode = 'lite',
  durationSeconds = 4,
  resolution = '720p',
} = {}) {
  const normalizedDuration = Math.max(Number(durationSeconds) || 0, 0);
  const baseCredits = Math.ceil(normalizedDuration / 5);
  const resolutionSurcharge = resolution === '1080p' ? 1 : 0;

  if (mode === 'standard') {
    const unitPrice = STANDARD_VIDEO_PRICING_USD_PER_SECOND[resolution] ?? STANDARD_VIDEO_PRICING_USD_PER_SECOND['720p'];
    return Math.ceil((normalizedDuration * unitPrice) / BASE_VIDEO_CREDIT_USD);
  }

  return Math.ceil(baseCredits + resolutionSurcharge);
}

export const VIDEO_CONFIRM_CREDIT_THRESHOLD = 5;

export function shouldConfirmVideoRender({
  mode = 'lite',
  resolution = '720p',
  estimatedCredits = 0,
} = {}) {
  if (mode === 'standard') {
    return true;
  }

  if (resolution === '1080p') {
    return true;
  }

  return Number(estimatedCredits) >= VIDEO_CONFIRM_CREDIT_THRESHOLD;
}

export function buildVideoConfirmCopy({
  mode = 'lite',
  durationSeconds = 4,
  resolution = '720p',
  referenceImageCount = 0,
  estimatedCredits = 0,
} = {}) {
  const modeLabel = mode === 'standard' ? 'Standard' : 'Lite';
  const creditWord = Number(estimatedCredits) === 1 ? 'credit' : 'credits';
  const referenceSuffix = Number(referenceImageCount) > 0
    ? ` using ${referenceImageCount} reference image${referenceImageCount === 1 ? '' : 's'}`
    : '';

  return {
    headline: `This ${modeLabel} render will use ${estimatedCredits} video ${creditWord}. Continue?`,
    detail: `${modeLabel} ${durationSeconds}s at ${resolution}${referenceSuffix}. Final credit burn is confirmed server-side once the render queues.`,
  };
}

export function createImageGenerationDraft(overrides = {}) {
  return {
    prompt: '',
    size: '1024x1024',
    quality: 'medium',
    outputFormat: 'webp',
    background: 'auto',
    ...overrides,
  };
}

export function createVideoGenerationDraft(overrides = {}) {
  const mode = overrides.mode ?? 'lite';
  const config = getVideoModeConfig(mode);
  const durationSeconds = config.supportedDurations.includes(Number(overrides.durationSeconds))
    ? Number(overrides.durationSeconds)
    : config.supportedDurations[0];
  const resolution = config.supportedResolutions.includes(overrides.resolution)
    ? overrides.resolution
    : config.supportedResolutions[0];
  const aspectRatio = config.supportedAspectRatios.includes(overrides.aspectRatio)
    ? overrides.aspectRatio
    : config.supportedAspectRatios[0];
  const referenceImages = config.supportsReferenceImages
    ? Array.isArray(overrides.referenceImages)
      ? overrides.referenceImages.slice(0, 3)
      : []
    : [];
  const useNegativePrompt = referenceImages.length > 0
    ? false
    : overrides.useNegativePrompt !== false;

  return {
    ...overrides,
    prompt: String(overrides.prompt ?? ''),
    mode,
    durationSeconds,
    resolution,
    aspectRatio,
    referenceImages,
    useNegativePrompt,
  };
}

import {
  getMediaStorage,
  getVideoReferenceAssetRetention,
} from './media-storage/index.js';

const ALLOWED_REFERENCE_IMAGE_TYPES = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);
const MAX_REFERENCE_IMAGES = 3;
const MAX_REFERENCE_IMAGE_BYTES = 2 * 1024 * 1024;

export async function persistVideoReferenceImages(
  jobId,
  referenceImages = [],
  { orgId = null, userId = null, conversationId = null, storage = getMediaStorage() } = {},
) {
  const normalizedImages = Array.isArray(referenceImages) ? referenceImages : [];

  if (normalizedImages.length === 0) {
    return [];
  }

  if (normalizedImages.length > MAX_REFERENCE_IMAGES) {
    const error = new Error(`A render can include up to ${MAX_REFERENCE_IMAGES} reference images.`);
    error.status = 400;
    error.code = 'VIDEO_REFERENCE_IMAGES_LIMIT';
    throw error;
  }

  const persisted = [];

  for (const [index, referenceImage] of normalizedImages.entries()) {
    const mimeType = String(referenceImage?.mimeType ?? '').trim().toLowerCase();
    const extension = ALLOWED_REFERENCE_IMAGE_TYPES.get(mimeType);

    if (!extension) {
      const error = new Error('Reference images must be PNG, JPEG, or WEBP files.');
      error.status = 400;
      error.code = 'VIDEO_REFERENCE_IMAGE_INVALID_TYPE';
      throw error;
    }

    const buffer = Buffer.from(String(referenceImage?.base64 ?? ''), 'base64');

    if (!buffer.length || buffer.length > MAX_REFERENCE_IMAGE_BYTES) {
      const error = new Error('Each reference image must be under 2 MB.');
      error.status = 400;
      error.code = 'VIDEO_REFERENCE_IMAGE_TOO_LARGE';
      throw error;
    }

    const uploaded = await storage.uploadVideoReferenceImage({
      buffer,
      mimeType,
      originalName: String(referenceImage?.name ?? `reference-${index + 1}.${extension}`).trim(),
      orgId,
      videoJobId: jobId,
      index,
      metadata: {
        userId,
        conversationId,
      },
    });

    persisted.push({
      name: uploaded.originalName ?? (String(referenceImage?.name ?? '').trim() || uploaded.fileName),
      originalName: uploaded.originalName ?? (String(referenceImage?.name ?? '').trim() || null),
      mimeType,
      referenceType: 'ASSET',
      storageProvider: uploaded.storageProvider,
      publicId: uploaded.publicId ?? null,
      secureUrl: uploaded.secureUrl ?? null,
      deliveryUrl: uploaded.deliveryUrl ?? null,
      resourceType: uploaded.resourceType ?? 'image',
      relativePath: uploaded.relativePath ?? null,
      localPath: uploaded.localPath ?? null,
      bytes: uploaded.bytes ?? buffer.length,
      format: uploaded.format ?? extension,
      uploadedAt: uploaded.uploadedAt ?? new Date().toISOString(),
      cleanupStatus: uploaded.cleanupStatus ?? 'pending',
    });
  }

  return persisted;
}

export async function loadVideoReferenceImages(
  referenceAssets = [],
  { storage = getMediaStorage() } = {},
) {
  const normalizedAssets = Array.isArray(referenceAssets) ? referenceAssets : [];

  return Promise.all(
    normalizedAssets.map(async (asset) => {
      const buffer = await storage.loadAssetBuffer(asset);

      return {
        image: {
          imageBytes: buffer.toString('base64'),
          mimeType: asset.mimeType,
        },
        referenceType: asset.referenceType ?? 'ASSET',
      };
    }),
  );
}

export async function cleanupVideoReferenceImages(
  referenceAssets = [],
  {
    storage = getMediaStorage(),
    retention = getVideoReferenceAssetRetention(),
  } = {},
) {
  const normalizedAssets = Array.isArray(referenceAssets) ? referenceAssets : [];

  if (normalizedAssets.length === 0) {
    return [];
  }

  if (retention === 'keep_for_audit') {
    return normalizedAssets.map((asset) => ({
      ...asset,
      cleanupStatus: 'retained_for_audit',
    }));
  }

  return Promise.all(
    normalizedAssets.map(async (asset) => {
      try {
        const result = await storage.deleteAsset({
          asset,
          publicId: asset.publicId ?? null,
          resourceType: asset.resourceType ?? 'image',
          relativePath: asset.relativePath ?? asset.localPath ?? null,
        });

        return {
          ...asset,
          cleanupStatus: result.deleted ? 'deleted_after_job' : result.missing ? 'already_removed' : 'delete_skipped',
        };
      } catch {
        return {
          ...asset,
          cleanupStatus: 'delete_failed',
        };
      }
    }),
  );
}

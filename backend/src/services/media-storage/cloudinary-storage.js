import { randomUUID } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

export class CloudinaryStorage {
  constructor({
    cloudName,
    apiKey,
    apiSecret,
    folder = 'prymal',
    client = cloudinary,
  } = {}) {
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary media storage requires cloudName, apiKey, and apiSecret.');
    }

    this.folder = String(folder ?? 'prymal').trim() || 'prymal';
    this.client = client;
    this.client.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  async uploadGeneratedImage({
    filePath,
    buffer,
    base64,
    mimeType = 'image/webp',
    orgId = null,
    conversationId = null,
    messageId = null,
    metadata = {},
  }) {
    const uploadTarget = resolveUploadSource({ filePath, buffer, base64, mimeType });
    const result = await this.client.uploader.upload(uploadTarget, {
      resource_type: 'image',
      folder: `${this.folder}/generated-images/${sanitizePathSegment(orgId || 'public')}`,
      public_id: buildPublicId(conversationId || messageId || 'image'),
      format: 'webp',
      quality: 'auto',
      tags: buildAssetTags({ orgId, conversationId, messageId, kind: 'generated-image' }),
      context: buildCloudinaryContext({
        orgId,
        conversationId,
        messageId,
        ...metadata,
      }),
    });

    return normalizeCloudinaryAsset(result);
  }

  async uploadGeneratedVideo({
    filePath,
    buffer,
    orgId = null,
    conversationId = null,
    videoJobId = null,
    metadata = {},
  }) {
    const uploadTarget = resolveUploadSource({ filePath, buffer });
    const result = await this.client.uploader.upload(uploadTarget, {
      resource_type: 'video',
      folder: `${this.folder}/generated-videos/${sanitizePathSegment(orgId || 'public')}`,
      public_id: buildPublicId(videoJobId || conversationId || 'video'),
      tags: buildAssetTags({ orgId, conversationId, videoJobId, kind: 'generated-video' }),
      context: buildCloudinaryContext({
        orgId,
        conversationId,
        videoJobId,
        ...metadata,
      }),
    });

    return normalizeCloudinaryAsset(result);
  }

  async uploadVideoReferenceImage({
    buffer,
    base64,
    mimeType,
    originalName,
    orgId = null,
    videoJobId = null,
    index = 0,
    metadata = {},
  }) {
    const uploadTarget = resolveUploadSource({ buffer, base64, mimeType });
    const result = await this.client.uploader.upload(uploadTarget, {
      resource_type: 'image',
      folder: `${this.folder}/video-reference-images/${sanitizePathSegment(orgId || 'public')}/${sanitizePathSegment(videoJobId || 'job')}`,
      public_id: buildPublicId(`${index + 1}-${originalName || 'reference'}`),
      format: 'webp',
      quality: 'auto',
      tags: buildAssetTags({ orgId, videoJobId, kind: 'video-reference-image' }),
      context: buildCloudinaryContext({
        orgId,
        videoJobId,
        originalName,
        ...metadata,
      }),
    });

    return {
      ...normalizeCloudinaryAsset(result),
      mimeType: 'image/webp',
      originalName: String(originalName ?? '').trim() || null,
      cleanupStatus: 'pending',
    };
  }

  async deleteAsset({ asset = {}, publicId = null, resourceType = null } = {}) {
    const resolvedPublicId = publicId ?? asset.publicId;

    if (!resolvedPublicId) {
      return { deleted: false };
    }

    const result = await this.client.uploader.destroy(resolvedPublicId, {
      resource_type: resourceType ?? asset.resourceType ?? 'image',
      invalidate: true,
    });

    return {
      deleted: result?.result === 'ok',
      missing: result?.result === 'not found',
      raw: result,
    };
  }

  async loadAssetBuffer(asset = {}) {
    const deliveryUrl = this.getDeliveryUrl(asset);

    if (!deliveryUrl) {
      throw new Error('Cloudinary asset does not have a delivery URL.');
    }

    const response = await fetch(deliveryUrl);

    if (!response.ok) {
      const error = new Error(`Cloudinary asset download failed with status ${response.status}.`);
      error.status = 502;
      error.code = 'MEDIA_ASSET_DOWNLOAD_FAILED';
      throw error;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  getDeliveryUrl(asset = {}) {
    if (asset.deliveryUrl) {
      return asset.deliveryUrl;
    }

    if (asset.publicId) {
      return this.client.url(asset.publicId, {
        secure: true,
        resource_type: asset.resourceType ?? 'image',
      });
    }

    return asset.secureUrl ?? null;
  }
}

function resolveUploadSource({ filePath, buffer, base64, mimeType = 'application/octet-stream' } = {}) {
  if (filePath) {
    return filePath;
  }

  if (Buffer.isBuffer(buffer)) {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  const normalizedBase64 = String(base64 ?? '').trim();

  if (normalizedBase64) {
    return `data:${mimeType};base64,${normalizedBase64}`;
  }

  throw new Error('Cloudinary uploads require a file path, buffer, or base64 payload.');
}

function normalizeCloudinaryAsset(result) {
  return {
    storageProvider: 'cloudinary',
    publicId: result.public_id ?? null,
    resourceType: result.resource_type ?? 'image',
    secureUrl: result.secure_url ?? null,
    deliveryUrl: result.secure_url ?? null,
    bytes: result.bytes ?? null,
    duration: result.duration ?? null,
    format: result.format ?? null,
    width: result.width ?? null,
    height: result.height ?? null,
    fileName: result.original_filename ? `${result.original_filename}.${result.format}` : null,
    uploadedAt: result.created_at ?? new Date().toISOString(),
    cleanupStatus: 'retained',
    metadata: {
      version: result.version ?? null,
      assetId: result.asset_id ?? null,
    },
  };
}

function buildPublicId(seed) {
  const safeSeed = sanitizePathSegment(seed || 'asset');
  return `${safeSeed}-${randomUUID()}`;
}

function buildAssetTags({ orgId, conversationId = null, messageId = null, videoJobId = null, kind }) {
  return [
    'prymal',
    kind,
    orgId ? `org:${sanitizePathSegment(orgId)}` : 'org:unknown',
    conversationId ? `conversation:${sanitizePathSegment(conversationId)}` : null,
    messageId ? `message:${sanitizePathSegment(messageId)}` : null,
    videoJobId ? `video_job:${sanitizePathSegment(videoJobId)}` : null,
  ].filter(Boolean);
}

function buildCloudinaryContext(metadata = {}) {
  const pairs = Object.entries(metadata)
    .filter(([, value]) => value != null && String(value).trim() !== '')
    .map(([key, value]) => `${sanitizePathSegment(key)}=${sanitizeContextValue(value)}`);

  return pairs.length > 0 ? pairs.join('|') : undefined;
}

function sanitizePathSegment(value) {
  const sanitized = String(value ?? '')
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return sanitized || 'asset';
}

function sanitizeContextValue(value) {
  return String(value)
    .trim()
    .replace(/[|=]/g, '-')
    .slice(0, 255);
}

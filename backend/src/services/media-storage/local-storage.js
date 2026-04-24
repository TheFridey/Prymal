import { randomUUID } from 'crypto';
import { copyFile, mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';

const GENERATED_IMAGE_ROUTE = '/generated-assets';
const GENERATED_VIDEO_ROUTE = '/generated-video-assets';

const IMAGE_MIME_EXTENSIONS = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);

export class LocalMediaStorage {
  constructor({
    baseDir = path.resolve(process.cwd(), 'storage'),
    apiUrl = '',
  } = {}) {
    this.baseDir = baseDir;
    this.apiOrigin = String(apiUrl ?? '').trim().replace(/\/api\/?$/, '');
    this.generatedImagesDir = path.join(baseDir, 'generated-images');
    this.generatedVideosDir = path.join(baseDir, 'generated-videos');
    this.referenceImagesDir = path.join(baseDir, 'video-reference-images');
  }

  async uploadGeneratedImage({
    buffer,
    base64,
    outputFormat = 'webp',
    orgId = null,
    conversationId = null,
    messageId = null,
    metadata = {},
  }) {
    const extension = sanitizeExtension(outputFormat || metadata.format || 'webp', 'webp');
    const fileBuffer = resolveBufferInput({ buffer, base64 });
    await mkdir(this.generatedImagesDir, { recursive: true });

    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const filePath = path.join(this.generatedImagesDir, fileName);
    await writeFile(filePath, fileBuffer);

    return buildLocalAssetRecord({
      storageProvider: 'local',
      baseDir: this.baseDir,
      resourceType: 'image',
      fileName,
      filePath,
      routeBase: GENERATED_IMAGE_ROUTE,
      format: extension,
      bytes: fileBuffer.length,
      orgId,
      conversationId,
      messageId,
      metadata,
    });
  }

  async uploadGeneratedVideo({
    filePath,
    buffer,
    orgId = null,
    conversationId = null,
    videoJobId = null,
    metadata = {},
  }) {
    await mkdir(this.generatedVideosDir, { recursive: true });
    const extension = sanitizeExtension(
      metadata.format || path.extname(String(filePath ?? '')).replace(/^\./, '') || 'mp4',
      'mp4',
    );
    const finalFileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const finalPath = path.join(this.generatedVideosDir, finalFileName);

    if (filePath) {
      await copyFile(filePath, finalPath);
    } else {
      const fileBuffer = resolveBufferInput({ buffer });
      await writeFile(finalPath, fileBuffer);
    }

    const statsBuffer = await readFile(finalPath);

    return buildLocalAssetRecord({
      storageProvider: 'local',
      baseDir: this.baseDir,
      resourceType: 'video',
      fileName: finalFileName,
      filePath: finalPath,
      routeBase: GENERATED_VIDEO_ROUTE,
      format: extension,
      bytes: statsBuffer.length,
      duration: metadata.duration ?? null,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      orgId,
      conversationId,
      videoJobId,
      metadata,
    });
  }

  async uploadVideoReferenceImage({
    buffer,
    base64,
    mimeType,
    originalName,
    orgId = null,
    videoJobId,
    index = 0,
    metadata = {},
  }) {
    if (!videoJobId) {
      throw new Error('videoJobId is required when persisting a reference image.');
    }

    const extension = IMAGE_MIME_EXTENSIONS.get(String(mimeType ?? '').trim().toLowerCase());

    if (!extension) {
      const error = new Error('Reference images must be PNG, JPEG, or WEBP files.');
      error.status = 400;
      error.code = 'VIDEO_REFERENCE_IMAGE_INVALID_TYPE';
      throw error;
    }

    const fileBuffer = resolveBufferInput({ buffer, base64 });
    const jobDir = path.join(this.referenceImagesDir, String(videoJobId));
    await mkdir(jobDir, { recursive: true });

    const safeBaseName = sanitizeBaseName(originalName || `reference-${index + 1}`);
    const fileName = `${String(index + 1).padStart(2, '0')}-${safeBaseName}.${extension}`;
    const filePath = path.join(jobDir, fileName);
    await writeFile(filePath, fileBuffer);

    return {
      storageProvider: 'local',
      resourceType: 'image',
      mimeType,
      originalName: String(originalName ?? fileName).trim() || fileName,
      fileName,
      relativePath: normalizeRelativePath(path.relative(this.baseDir, filePath)),
      localPath: filePath,
      publicId: null,
      secureUrl: null,
      deliveryUrl: null,
      bytes: fileBuffer.length,
      width: null,
      height: null,
      duration: null,
      format: extension,
      uploadedAt: new Date().toISOString(),
      cleanupStatus: 'pending',
      metadata: {
        ...metadata,
        orgId,
        videoJobId,
      },
    };
  }

  async deleteAsset({ asset = {}, publicId = null, relativePath = null } = {}) {
    const candidatePath = asset.localPath ?? relativePath ?? asset.relativePath ?? publicId;

    if (!candidatePath) {
      return { deleted: false };
    }

    const absolutePath = resolveLocalStoragePath(this.baseDir, candidatePath);

    try {
      await unlink(absolutePath);
      return { deleted: true };
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return { deleted: false, missing: true };
      }

      throw error;
    }
  }

  async loadAssetBuffer(asset = {}) {
    const absolutePath = resolveLocalStoragePath(
      this.baseDir,
      asset.localPath ?? asset.relativePath,
    );
    return readFile(absolutePath);
  }

  getDeliveryUrl(asset = {}) {
    if (asset.deliveryUrl) {
      return buildAbsoluteUrl(this.apiOrigin, asset.deliveryUrl);
    }

    if (asset.resourceType === 'video' && asset.fileName) {
      return buildAbsoluteUrl(this.apiOrigin, `${GENERATED_VIDEO_ROUTE}/${asset.fileName}`);
    }

    if (asset.fileName) {
      return buildAbsoluteUrl(this.apiOrigin, `${GENERATED_IMAGE_ROUTE}/${asset.fileName}`);
    }

    return null;
  }
}

export async function readLocalGeneratedImageAsset(fileName, baseDir = path.resolve(process.cwd(), 'storage')) {
  return readFile(resolveAssetFilePath(path.join(baseDir, 'generated-images'), fileName));
}

export async function readLocalGeneratedVideoAsset(fileName, baseDir = path.resolve(process.cwd(), 'storage')) {
  return readFile(resolveAssetFilePath(path.join(baseDir, 'generated-videos'), fileName));
}

function buildLocalAssetRecord({
  storageProvider,
  baseDir,
  resourceType,
  fileName,
  filePath,
  routeBase,
  format,
  bytes,
  width = null,
  height = null,
  duration = null,
  orgId = null,
  conversationId = null,
  messageId = null,
  videoJobId = null,
  metadata = {},
}) {
  return {
    storageProvider,
    resourceType,
    fileName,
    localPath: filePath,
    relativePath: normalizeRelativePath(path.relative(baseDir, filePath)),
    publicId: null,
    secureUrl: null,
    deliveryUrl: `${routeBase}/${fileName}`,
    bytes,
    format,
    width,
    height,
    duration,
    uploadedAt: new Date().toISOString(),
    cleanupStatus: 'retained',
    metadata: {
      ...metadata,
      orgId,
      conversationId,
      messageId,
      videoJobId,
    },
  };
}

function resolveBufferInput({ buffer, base64 } = {}) {
  if (Buffer.isBuffer(buffer)) {
    return buffer;
  }

  const normalizedBase64 = String(base64 ?? '').trim();

  if (normalizedBase64) {
    return Buffer.from(normalizedBase64, 'base64');
  }

  const error = new Error('A media buffer or base64 payload is required.');
  error.status = 400;
  error.code = 'MEDIA_BUFFER_REQUIRED';
  throw error;
}

function sanitizeExtension(value, fallback) {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  return normalized || fallback;
}

function sanitizeBaseName(value) {
  const safe = path
    .basename(String(value ?? 'asset').trim(), path.extname(String(value ?? 'asset')))
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return safe || 'asset';
}

function normalizeRelativePath(value) {
  return String(value ?? '').replace(/\\/g, '/');
}

function resolveLocalStoragePath(baseDir, candidatePath) {
  const candidate = String(candidatePath ?? '').trim();

  if (!candidate) {
    const error = new Error('Media asset path is required.');
    error.status = 400;
    error.code = 'MEDIA_ASSET_PATH_REQUIRED';
    throw error;
  }

  const absolutePath = path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(baseDir, candidate);
  const normalizedBase = path.resolve(baseDir);
  const normalizedBasePrefix = normalizedBase.endsWith(path.sep) ? normalizedBase : `${normalizedBase}${path.sep}`;

  if (absolutePath !== normalizedBase && !absolutePath.startsWith(normalizedBasePrefix)) {
    const error = new Error('Invalid media asset path.');
    error.status = 400;
    error.code = 'MEDIA_ASSET_PATH_INVALID';
    throw error;
  }

  return absolutePath;
}

function resolveAssetFilePath(directory, fileName) {
  const safeName = path.basename(String(fileName ?? ''));

  if (!safeName || safeName !== fileName) {
    const error = new Error('Invalid asset path.');
    error.status = 400;
    error.code = 'MEDIA_ASSET_INVALID';
    throw error;
  }

  return path.join(directory, safeName);
}

function buildAbsoluteUrl(origin, pathName) {
  const normalizedPath = String(pathName ?? '').trim();

  if (!normalizedPath) {
    return null;
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  if (!origin) {
    return normalizedPath;
  }

  return new URL(normalizedPath, origin.endsWith('/') ? origin : `${origin}/`).toString();
}

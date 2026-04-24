import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';

const VIDEO_REFERENCE_IMAGE_DIR = path.resolve(process.cwd(), 'storage', 'video-reference-images');
const ALLOWED_REFERENCE_IMAGE_TYPES = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);
const MAX_REFERENCE_IMAGES = 3;
const MAX_REFERENCE_IMAGE_BYTES = 2 * 1024 * 1024;

export async function persistVideoReferenceImages(jobId, referenceImages = []) {
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

  const jobDirectory = path.join(VIDEO_REFERENCE_IMAGE_DIR, String(jobId));
  await mkdir(jobDirectory, { recursive: true });
  const writtenPaths = [];

  try {
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

      const fileName = `${String(index + 1).padStart(2, '0')}-${sanitizeReferenceImageName(referenceImage?.name)}.${extension}`;
      const filePath = path.join(jobDirectory, fileName);
      await writeFile(filePath, buffer);
      writtenPaths.push(filePath);

      persisted.push({
        name: String(referenceImage?.name ?? fileName).trim() || fileName,
        mimeType,
        referenceType: 'ASSET',
        relativePath: path.relative(VIDEO_REFERENCE_IMAGE_DIR, filePath),
      });
    }

    return persisted;
  } catch (error) {
    await Promise.all(
      writtenPaths.map(async (filePath) => {
        try {
          await unlink(filePath);
        } catch {
          // Best-effort cleanup for partially written reference assets.
        }
      }),
    );
    throw error;
  }
}

export async function loadVideoReferenceImages(referenceAssets = []) {
  const normalizedAssets = Array.isArray(referenceAssets) ? referenceAssets : [];

  return Promise.all(
    normalizedAssets.map(async (asset) => {
      const absolutePath = resolveReferenceImagePath(asset?.relativePath);
      const buffer = await readFile(absolutePath);

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

export async function cleanupVideoReferenceImages(referenceAssets = []) {
  const normalizedAssets = Array.isArray(referenceAssets) ? referenceAssets : [];

  await Promise.all(
    normalizedAssets.map(async (asset) => {
      try {
        const absolutePath = resolveReferenceImagePath(asset?.relativePath);
        await unlink(absolutePath);
      } catch {
        // Reference-image cleanup is best-effort and should not fail the job lifecycle.
      }
    }),
  );
}

function resolveReferenceImagePath(relativePath) {
  const absolutePath = path.resolve(VIDEO_REFERENCE_IMAGE_DIR, String(relativePath ?? ''));

  if (!absolutePath.startsWith(VIDEO_REFERENCE_IMAGE_DIR)) {
    const error = new Error('Invalid reference image path.');
    error.status = 400;
    error.code = 'VIDEO_REFERENCE_IMAGE_PATH_INVALID';
    throw error;
  }

  return absolutePath;
}

function sanitizeReferenceImageName(value) {
  const baseName = path.basename(String(value ?? 'reference').trim(), path.extname(String(value ?? 'reference')));
  const sanitized = baseName
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return sanitized || 'reference';
}

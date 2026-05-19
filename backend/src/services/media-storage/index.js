import path from 'path';
import { getEnvironmentMode } from '../../env/parse.js';
import { CloudinaryStorage } from './cloudinary-storage.js';
import {
  LocalMediaStorage,
  readLocalGeneratedImageAsset,
  readLocalGeneratedVideoAsset,
} from './local-storage.js';

export const MEDIA_STORAGE_DRIVERS = {
  local: 'local',
  cloudinary: 'cloudinary',
};

export const VIDEO_REFERENCE_RETENTION = {
  deleteAfterJob: 'delete_after_job',
  keepForAudit: 'keep_for_audit',
};

const DEFAULT_CLOUDINARY_FOLDER = 'prymal';
const DEFAULT_MEDIA_ASSET_RETENTION_DAYS = 30;
const DEFAULT_FAILED_MEDIA_ASSET_RETENTION_DAYS = 7;
const DEFAULT_VIDEO_JOB_TIMEOUT_MS = 900_000;
const DEFAULT_VIDEO_JOB_POLL_INTERVAL_MS = 10_000;

let cachedStorage = null;

export function hasConfiguredValue(value) {
  const normalized = String(value ?? '').trim();
  return Boolean(normalized) && !/xxxx|placeholder|your_/i.test(normalized);
}

export function parseBooleanEnv(value, fallback = false) {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function getMediaDeploymentMode(env = process.env) {
  const raw = String(env.APP_ENV ?? env.DEPLOY_ENV ?? env.NODE_ENV ?? '').trim().toLowerCase();

  if (raw === 'production' || raw === 'staging' || raw === 'test') {
    return raw;
  }

  return getEnvironmentMode(env.NODE_ENV);
}

export function isLiveLikeMediaEnvironment(env = process.env) {
  const mode = getMediaDeploymentMode(env);
  return mode === 'production' || mode === 'staging';
}

export function hasCloudinaryConfiguration(env = process.env) {
  return [
    env.CLOUDINARY_CLOUD_NAME,
    env.CLOUDINARY_API_KEY,
    env.CLOUDINARY_API_SECRET,
  ].every((value) => hasConfiguredValue(value));
}

export function isVideoGenerationConfigured(env = process.env) {
  return hasConfiguredValue(env.GEMINI_API_KEY);
}

export function resolveMediaStorageDriver(env = process.env) {
  const explicitDriver = String(env.MEDIA_STORAGE_DRIVER ?? '').trim().toLowerCase();

  if (explicitDriver === MEDIA_STORAGE_DRIVERS.local || explicitDriver === MEDIA_STORAGE_DRIVERS.cloudinary) {
    return explicitDriver;
  }

  return hasCloudinaryConfiguration(env)
    ? MEDIA_STORAGE_DRIVERS.cloudinary
    : MEDIA_STORAGE_DRIVERS.local;
}

export function getCloudinaryFolder(env = process.env) {
  return String(env.CLOUDINARY_FOLDER ?? DEFAULT_CLOUDINARY_FOLDER).trim() || DEFAULT_CLOUDINARY_FOLDER;
}

export function getVideoReferenceAssetRetention(env = process.env) {
  const explicit = String(env.VIDEO_REFERENCE_ASSET_RETENTION ?? '').trim().toLowerCase();

  if (explicit === VIDEO_REFERENCE_RETENTION.deleteAfterJob || explicit === VIDEO_REFERENCE_RETENTION.keepForAudit) {
    return explicit;
  }

  return isLiveLikeMediaEnvironment(env)
    ? VIDEO_REFERENCE_RETENTION.keepForAudit
    : VIDEO_REFERENCE_RETENTION.deleteAfterJob;
}

export function getMediaAssetRetentionConfig(env = process.env) {
  const successDays = Number.parseInt(String(env.MEDIA_ASSET_RETENTION_DAYS ?? ''), 10);
  const failedDays = Number.parseInt(String(env.FAILED_MEDIA_ASSET_RETENTION_DAYS ?? ''), 10);

  return {
    successDays: Number.isFinite(successDays) && successDays > 0
      ? successDays
      : DEFAULT_MEDIA_ASSET_RETENTION_DAYS,
    failedDays: Number.isFinite(failedDays) && failedDays > 0
      ? failedDays
      : DEFAULT_FAILED_MEDIA_ASSET_RETENTION_DAYS,
  };
}

export function getVideoJobTimingConfig(env = process.env) {
  const timeoutMs = Number.parseInt(String(env.VIDEO_JOB_TIMEOUT_MS ?? ''), 10);
  const pollIntervalMs = Number.parseInt(
    String(env.VIDEO_JOB_POLL_INTERVAL_MS ?? env.VIDEO_QUEUE_POLL_INTERVAL_MS ?? ''),
    10,
  );

  return {
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_VIDEO_JOB_TIMEOUT_MS,
    pollIntervalMs: Number.isFinite(pollIntervalMs) && pollIntervalMs > 0
      ? pollIntervalMs
      : DEFAULT_VIDEO_JOB_POLL_INTERVAL_MS,
  };
}

export function getMediaStorageConfig(env = process.env) {
  return {
    mode: getMediaDeploymentMode(env),
    driver: resolveMediaStorageDriver(env),
    cloudinaryConfigured: hasCloudinaryConfiguration(env),
    cloudinaryFolder: getCloudinaryFolder(env),
    localOverrideAllowed: parseBooleanEnv(env.ALLOW_LOCAL_MEDIA_STORAGE_IN_PRODUCTION, false),
    videoGenerationConfigured: isVideoGenerationConfigured(env),
    referenceAssetRetention: getVideoReferenceAssetRetention(env),
    retention: getMediaAssetRetentionConfig(env),
    timing: getVideoJobTimingConfig(env),
  };
}

export function validateMediaStorageConfiguration(env = process.env) {
  const config = getMediaStorageConfig(env);
  const errors = [];
  const warnings = [];
  const explicitDriver = String(env.MEDIA_STORAGE_DRIVER ?? '').trim().toLowerCase();

  if (
    explicitDriver
    && explicitDriver !== MEDIA_STORAGE_DRIVERS.local
    && explicitDriver !== MEDIA_STORAGE_DRIVERS.cloudinary
  ) {
    errors.push('MEDIA_STORAGE_DRIVER must be either "local" or "cloudinary".');
  }

  if (config.mode === 'production' && explicitDriver !== MEDIA_STORAGE_DRIVERS.cloudinary) {
    errors.push(
      'MEDIA_STORAGE_DRIVER must be set to "cloudinary" in production. Local media storage is a development fallback only.',
    );
  }

  if (config.mode === 'production' && config.localOverrideAllowed) {
    errors.push(
      'ALLOW_LOCAL_MEDIA_STORAGE_IN_PRODUCTION must remain false in production. Local media storage is not permitted for the live VPS deployment.',
    );
  }

  if (config.driver === MEDIA_STORAGE_DRIVERS.cloudinary && !config.cloudinaryConfigured) {
    errors.push(
      'Cloudinary media storage is enabled, but CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are not all configured.',
    );
  }

  if (config.driver === MEDIA_STORAGE_DRIVERS.cloudinary && !hasConfiguredValue(env.CLOUDINARY_FOLDER)) {
    errors.push('Cloudinary media storage is enabled, but CLOUDINARY_FOLDER is not configured.');
  }

  if (
    isLiveLikeMediaEnvironment(env)
    && config.driver === MEDIA_STORAGE_DRIVERS.local
    && !config.localOverrideAllowed
  ) {
    errors.push(
      'Local media storage is not allowed in staging/production. Configure Cloudinary or set ALLOW_LOCAL_MEDIA_STORAGE_IN_PRODUCTION=true explicitly.',
    );
  }

  if (
    isLiveLikeMediaEnvironment(env)
    && config.driver === MEDIA_STORAGE_DRIVERS.local
    && config.localOverrideAllowed
  ) {
    if (config.mode === 'production') {
      errors.push(
        'Local media storage override is active in production. Generated media must not rely on backend-local disk in the live VPS deployment.',
      );
    } else {
      warnings.push(
        'Local media storage override is active in a live-like environment. Generated media will not survive instance replacement.',
      );
    }
  }

  return {
    ...config,
    errors,
    warnings,
    valid: errors.length === 0,
  };
}

export function createMediaStorage({ env = process.env } = {}) {
  const validation = validateMediaStorageConfiguration(env);
  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'));
  }

  const config = getMediaStorageConfig(env);

  if (config.driver === MEDIA_STORAGE_DRIVERS.cloudinary) {
    if (!config.cloudinaryConfigured) {
      throw new Error(
        'Cloudinary media storage was requested, but Cloudinary credentials are incomplete.',
      );
    }

    return new CloudinaryStorage({
      folder: config.cloudinaryFolder,
      cloudName: env.CLOUDINARY_CLOUD_NAME?.trim(),
      apiKey: env.CLOUDINARY_API_KEY?.trim(),
      apiSecret: env.CLOUDINARY_API_SECRET?.trim(),
    });
  }

  return new LocalMediaStorage({
    baseDir: path.resolve(process.cwd(), 'storage'),
    apiUrl: env.API_URL?.trim() || '',
  });
}

export function getMediaStorage({ env = process.env, reset = false } = {}) {
  if (!cachedStorage || reset) {
    cachedStorage = createMediaStorage({ env });
  }

  return cachedStorage;
}

export function resetMediaStorageForTests() {
  cachedStorage = null;
}

export {
  readLocalGeneratedImageAsset as readGeneratedImageAsset,
  readLocalGeneratedVideoAsset as readGeneratedVideoAsset,
};

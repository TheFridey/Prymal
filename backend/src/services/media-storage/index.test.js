import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEDIA_STORAGE_DRIVERS,
  VIDEO_REFERENCE_RETENTION,
  createMediaStorage,
  getMediaStorageConfig,
  getVideoJobTimingConfig,
  resolveMediaStorageDriver,
  validateMediaStorageConfiguration,
} from './index.js';

test('media storage defaults to local in development when Cloudinary is absent', () => {
  const env = {
    NODE_ENV: 'development',
    API_URL: 'http://localhost:3001',
  };

  assert.equal(resolveMediaStorageDriver(env), MEDIA_STORAGE_DRIVERS.local);
  const config = getMediaStorageConfig(env);
  assert.equal(config.driver, MEDIA_STORAGE_DRIVERS.local);
  assert.equal(config.referenceAssetRetention, VIDEO_REFERENCE_RETENTION.deleteAfterJob);
  const storage = createMediaStorage({ env });
  assert.equal(storage.constructor.name, 'LocalMediaStorage');
});

test('media storage chooses Cloudinary when explicitly configured', () => {
  const env = {
    NODE_ENV: 'development',
    MEDIA_STORAGE_DRIVER: 'cloudinary',
    CLOUDINARY_CLOUD_NAME: 'demo',
    CLOUDINARY_API_KEY: '123456',
    CLOUDINARY_API_SECRET: 'secret',
  };

  assert.equal(resolveMediaStorageDriver(env), MEDIA_STORAGE_DRIVERS.cloudinary);
  const config = getMediaStorageConfig(env);
  assert.equal(config.driver, MEDIA_STORAGE_DRIVERS.cloudinary);
  assert.equal(config.cloudinaryConfigured, true);
});

test('production local media storage is rejected by default', () => {
  const result = validateMediaStorageConfiguration({
    NODE_ENV: 'production',
    MEDIA_STORAGE_DRIVER: 'local',
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /Local media storage is not allowed/i);
});

test('cloudinary mode requires cloud name, API key, and API secret', () => {
  const result = validateMediaStorageConfiguration({
    NODE_ENV: 'production',
    MEDIA_STORAGE_DRIVER: 'cloudinary',
    CLOUDINARY_CLOUD_NAME: 'demo',
    CLOUDINARY_API_KEY: '',
    CLOUDINARY_API_SECRET: 'secret',
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /Cloudinary media storage is enabled/i);
});

test('video job timing config respects new timeout and poll env vars', () => {
  const timing = getVideoJobTimingConfig({
    VIDEO_JOB_TIMEOUT_MS: '120000',
    VIDEO_JOB_POLL_INTERVAL_MS: '5000',
  });

  assert.equal(timing.timeoutMs, 120000);
  assert.equal(timing.pollIntervalMs, 5000);
});

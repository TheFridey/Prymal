import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudinaryStorage } from './cloudinary-storage.js';

test('Cloudinary storage uploads generated videos with the expected payload', async () => {
  const uploads = [];
  let configured = null;
  const client = {
    config: (config) => {
      configured = config;
    },
    uploader: {
      upload: async (source, options) => {
        uploads.push({ source, options });
        return {
          public_id: 'prymal/generated-videos/org_1/job_1',
          resource_type: 'video',
          secure_url: 'https://res.cloudinary.com/demo/video/upload/v1/prymal/generated-videos/org_1/job_1.mp4',
          bytes: 123456,
          duration: 8,
          format: 'mp4',
          width: 1280,
          height: 720,
          original_filename: 'job_1',
          created_at: '2026-04-24T12:00:00Z',
        };
      },
      destroy: async () => ({ result: 'ok' }),
    },
    url: (publicId, options) => `https://cdn.example.com/${options.resource_type}/${publicId}`,
  };

  const storage = new CloudinaryStorage({
    cloudName: 'demo',
    apiKey: '123456',
    apiSecret: 'secret',
    folder: 'prymal',
    client,
  });

  const asset = await storage.uploadGeneratedVideo({
    buffer: Buffer.from('video-bytes'),
    orgId: 'org_1',
    conversationId: 'conv_1',
    videoJobId: 'job_1',
    metadata: {
      resolution: '1080p',
    },
  });

  assert.equal(configured.cloud_name, 'demo');
  assert.equal(uploads.length, 1);
  assert.match(uploads[0].source, /^data:application\/octet-stream;base64,/);
  assert.equal(uploads[0].options.resource_type, 'video');
  assert.match(uploads[0].options.folder, /generated-videos\/org_1$/);
  assert.ok(Array.isArray(uploads[0].options.tags));
  assert.match(String(uploads[0].options.context), /conversationId=conv_1/);
  assert.equal(asset.storageProvider, 'cloudinary');
  assert.equal(asset.publicId, 'prymal/generated-videos/org_1/job_1');
  assert.equal(asset.deliveryUrl, asset.secureUrl);
});

test('Cloudinary storage converts generated images to WEBP', async () => {
  const uploads = [];
  const client = {
    config: () => {},
    uploader: {
      upload: async (source, options) => {
        uploads.push({ source, options });
        return {
          public_id: 'prymal/generated-images/org_1/image_1',
          resource_type: 'image',
          secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/prymal/generated-images/org_1/image_1.webp',
          bytes: 1234,
          format: 'webp',
          width: 1024,
          height: 1024,
          original_filename: 'image_1',
          created_at: '2026-04-24T12:00:00Z',
        };
      },
      destroy: async () => ({ result: 'ok' }),
    },
  };

  const storage = new CloudinaryStorage({
    cloudName: 'demo',
    apiKey: '123456',
    apiSecret: 'secret',
    folder: 'prymal',
    client,
  });

  const asset = await storage.uploadGeneratedImage({
    buffer: Buffer.from('image-bytes'),
    mimeType: 'image/png',
    orgId: 'org_1',
    conversationId: 'conv_1',
  });

  assert.equal(uploads[0].options.resource_type, 'image');
  assert.equal(uploads[0].options.format, 'webp');
  assert.equal(uploads[0].options.quality, 'auto');
  assert.match(uploads[0].options.folder, /generated-images\/org_1$/);
  assert.equal(asset.format, 'webp');
  assert.equal(asset.storageProvider, 'cloudinary');
});

test('Cloudinary storage converts video reference images to WEBP', async () => {
  const uploads = [];
  const client = {
    config: () => {},
    uploader: {
      upload: async (source, options) => {
        uploads.push({ source, options });
        return {
          public_id: 'prymal/video-reference-images/org_1/job_1/reference_1',
          resource_type: 'image',
          secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/prymal/video-reference-images/org_1/job_1/reference_1.webp',
          bytes: 1234,
          format: 'webp',
          width: 1024,
          height: 1024,
          original_filename: 'reference_1',
          created_at: '2026-04-24T12:00:00Z',
        };
      },
      destroy: async () => ({ result: 'ok' }),
    },
  };

  const storage = new CloudinaryStorage({
    cloudName: 'demo',
    apiKey: '123456',
    apiSecret: 'secret',
    folder: 'prymal',
    client,
  });

  const asset = await storage.uploadVideoReferenceImage({
    buffer: Buffer.from('image-bytes'),
    mimeType: 'image/png',
    originalName: 'brief.png',
    orgId: 'org_1',
    videoJobId: 'job_1',
  });

  assert.equal(uploads[0].options.format, 'webp');
  assert.equal(uploads[0].options.quality, 'auto');
  assert.match(uploads[0].options.folder, /video-reference-images\/org_1\/job_1$/);
  assert.equal(asset.mimeType, 'image/webp');
  assert.equal(asset.format, 'webp');
});

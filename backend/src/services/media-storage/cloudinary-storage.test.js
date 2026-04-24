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

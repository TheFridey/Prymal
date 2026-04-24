import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { buildGeneratedVideoArtifact, processQueuedVideoJob } = await import('./video-generation.js');

function createBaseJob(overrides = {}) {
  return {
    id: 'job_123',
    orgId: 'org_123',
    userId: 'user_123',
    conversationId: null,
    status: 'queued',
    provider: 'google',
    model: 'veo-3.1-lite-generate-preview',
    prompt: 'Create a polished launch video.',
    durationSeconds: 8,
    resolution: '1080p',
    aspectRatio: '16:9',
    creditsRequested: 3,
    creditsReserved: 3,
    creditsCommitted: 0,
    retryCount: 0,
    maxRetries: 2,
    providerJobId: null,
    outputUrl: null,
    outputFileName: null,
    failureCode: null,
    failureMessage: null,
    providerMetadata: {
      mode: 'standard',
      providerLabel: 'Veo 3.1 Standard',
      referenceImageCount: 1,
      referenceImages: [],
    },
    createdAt: new Date('2026-04-24T12:00:00Z'),
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

test('video auth failures release credits without scheduling retries', async () => {
  const job = createBaseJob();
  let releasedArgs = null;
  let retryCount = 0;
  const events = [];

  await processQueuedVideoJob(job.id, {
    db: {
      query: {
        videoGenerationEvents: {
          findFirst: async () => job,
        },
      },
    },
    providerFactory: () => ({
      startJob: async () => {
        const error = new Error('Invalid API key');
        error.code = 'VIDEO_AUTH_INVALID';
        error.status = 503;
        throw error;
      },
    }),
    applyVideoJobThrottle: async () => {},
    loadReferenceImages: async () => [],
    cleanupReferenceImages: async () => [],
    releaseVideoJob: async (args) => {
      releasedArgs = args;
      return {
        job: {
          ...job,
          status: args.status,
          failureCode: args.failureCode,
          failureMessage: args.failureMessage,
          providerMetadata: {
            ...job.providerMetadata,
            ...(args.providerMetadata ?? {}),
          },
        },
      };
    },
    incrementVideoJobRetry: async () => {
      retryCount += 1;
      return { retryCount };
    },
    recordProductEvent: async (event) => {
      events.push(event);
    },
    sleep: async () => {},
  });

  assert.equal(releasedArgs.failureCode, 'VIDEO_AUTH_INVALID');
  assert.equal(retryCount, 0);
  assert.ok(events.some((event) => event.eventName === 'video.job_failed'));
  assert.ok(events.some((event) => event.eventName === 'video.credits_released'));
});

test('video timeout releases credits with a timeout failure code', async () => {
  const job = createBaseJob();
  let releasedArgs = null;
  const nowValues = [0, 5000];

  await processQueuedVideoJob(job.id, {
    db: {
      query: {
        videoGenerationEvents: {
          findFirst: async () => job,
        },
      },
    },
    providerFactory: () => ({
      startJob: async () => ({
        name: 'op_timeout',
        done: false,
        raw: { name: 'op_timeout' },
      }),
      pollJob: async () => ({
        name: 'op_timeout',
        done: false,
        raw: { name: 'op_timeout' },
      }),
    }),
    applyVideoJobThrottle: async () => {},
    loadReferenceImages: async () => [],
    cleanupReferenceImages: async () => [],
    markVideoJobProcessing: async () => job,
    releaseVideoJob: async (args) => {
      releasedArgs = args;
      return {
        job: {
          ...job,
          status: args.status,
          failureCode: args.failureCode,
          failureMessage: args.failureMessage,
          providerMetadata: {
            ...job.providerMetadata,
            ...(args.providerMetadata ?? {}),
          },
        },
      };
    },
    recordProductEvent: async () => {},
    sleep: async () => {},
    now: () => nowValues.shift() ?? 6000,
    timeoutMs: 1000,
  });

  assert.equal(releasedArgs.failureCode, 'VIDEO_JOB_TIMEOUT');
  assert.match(releasedArgs.failureMessage, /timeout/i);
});

test('successful uploads persist Cloudinary metadata into the committed video job', async () => {
  const job = createBaseJob();
  let commitArgs = null;

  await processQueuedVideoJob(job.id, {
    db: {
      query: {
        videoGenerationEvents: {
          findFirst: async () => job,
        },
      },
    },
    providerFactory: () => ({
      startJob: async () => ({
        name: 'op_complete',
        done: true,
        raw: { name: 'op_complete' },
        generatedVideo: { video: { uri: 'gs://video' } },
      }),
      downloadAsset: async () => {},
    }),
    mediaStorage: {
      uploadGeneratedVideo: async () => ({
        storageProvider: 'cloudinary',
        publicId: 'prymal/generated-videos/org_123/job_123',
        secureUrl: 'https://res.cloudinary.com/demo/video/upload/v1/prymal/generated-videos/org_123/job_123.mp4',
        deliveryUrl: 'https://res.cloudinary.com/demo/video/upload/v1/prymal/generated-videos/org_123/job_123.mp4',
        resourceType: 'video',
        bytes: 321000,
        duration: 8,
        format: 'mp4',
        cleanupStatus: 'retained',
        fileName: 'job_123.mp4',
      }),
    },
    applyVideoJobThrottle: async () => {},
    loadReferenceImages: async () => [],
    cleanupReferenceImages: async () => [],
    markVideoJobProcessing: async () => job,
    commitVideoJob: async (args) => {
      commitArgs = args;
      return {
        job: {
          ...job,
          conversationId: null,
          providerMetadata: {
            ...job.providerMetadata,
            ...(args.providerMetadata ?? {}),
          },
        },
      };
    },
    recordProductEvent: async () => {},
  });

  assert.equal(commitArgs.providerMetadata.storageProvider, 'cloudinary');
  assert.equal(commitArgs.providerMetadata.outputAsset.publicId, 'prymal/generated-videos/org_123/job_123');
  assert.equal(commitArgs.providerMetadata.outputAsset.bytes, 321000);
});

test('generated video artifacts include Cloudinary delivery metadata for chat messages', () => {
  const artifact = buildGeneratedVideoArtifact(
    createBaseJob(),
    {
      storageProvider: 'cloudinary',
      publicId: 'prymal/generated-videos/org_123/job_123',
      secureUrl: 'https://res.cloudinary.com/demo/video/upload/v1/prymal/generated-videos/org_123/job_123.mp4',
      deliveryUrl: 'https://res.cloudinary.com/demo/video/upload/v1/prymal/generated-videos/org_123/job_123.mp4',
      resourceType: 'video',
      bytes: 123456,
      duration: 8,
      format: 'mp4',
      cleanupStatus: 'retained',
    },
    {
      outputUrl: 'https://res.cloudinary.com/demo/video/upload/v1/prymal/generated-videos/org_123/job_123.mp4',
      outputFileName: 'job_123.mp4',
      providerOperation: 'op_complete',
      mode: 'standard',
      providerLabel: 'Veo 3.1 Standard',
    },
  );

  assert.equal(artifact.storageProvider, 'cloudinary');
  assert.equal(artifact.publicId, 'prymal/generated-videos/org_123/job_123');
  assert.equal(artifact.deliveryUrl, artifact.url);
  assert.equal(artifact.providerOperation, 'op_complete');
});

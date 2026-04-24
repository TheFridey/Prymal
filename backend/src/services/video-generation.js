import { mkdir, unlink } from 'fs/promises';
import os from 'os';
import path from 'path';
import { and, eq, lt, or } from 'drizzle-orm';
import { getAgent } from '../agents/config.js';
import { db } from '../db/index.js';
import { conversations, messages, videoGenerationEvents } from '../db/schema.js';
import {
  claimQueuedVideoJob,
  commitVideoJob,
  incrementVideoJobRetry,
  listQueuedVideoJobs,
  listStuckProcessingVideoJobs,
  markVideoJobProcessing,
  releaseVideoJob,
} from './billing-engine.js';
import { applyVideoJobThrottle } from './billing-throttle.js';
import {
  getMediaStorage,
  getVideoJobTimingConfig,
} from './media-storage/index.js';
import { getVeoVideoProvider } from './providers/veo-video-provider.js';
import {
  cleanupVideoReferenceImages,
  loadVideoReferenceImages,
} from './video-reference-images.js';
import { recordProductEvent } from './telemetry.js';

const PROCESSING_JOBS = new Set();
const TEMP_VIDEO_DIR = path.join(os.tmpdir(), 'prymal-video-jobs');

export function getVideoGenerationConfig(env = process.env) {
  return getVideoJobTimingConfig(env);
}

export function isVideoWorkerEnabled(env = process.env) {
  return String(env.VIDEO_WORKER_ENABLED ?? '').toLowerCase() === 'true';
}

export function logVideoJobEvent(event, job = {}, extras = {}) {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    jobId: job.id ?? extras.jobId ?? null,
    orgId: job.orgId ?? extras.orgId ?? null,
    userId: job.userId ?? extras.userId ?? null,
    mode: job.providerMetadata?.mode ?? extras.mode ?? null,
    provider: job.provider ?? extras.provider ?? null,
    model: job.model ?? extras.model ?? null,
    resolution: job.resolution ?? extras.resolution ?? null,
    durationSeconds: job.durationSeconds ?? extras.durationSeconds ?? null,
    creditsReserved: job.creditsReserved ?? extras.creditsReserved ?? null,
    attempt: extras.attempt ?? (job.retryCount ?? null),
    status: extras.status ?? job.status ?? null,
    durationSecondsElapsed: extras.durationSecondsElapsed ?? null,
    failureCode: extras.failureCode ?? job.failureCode ?? null,
    failureCategory: extras.failureCategory ?? null,
    ...extras.extra,
  };

  const isFailure = Boolean(extras.failureCode || extras.failure || extras.level === 'error');
  const line = JSON.stringify(payload);

  if (isFailure) {
    console.error('[VIDEO_JOB]', line);
  } else {
    console.log('[VIDEO_JOB]', line);
  }
}

export function classifyVideoJobFailure(error) {
  const rawMessage = String(error?.message ?? '').trim() || 'Video generation failed before render completion.';
  const normalizedCode = String(error?.code ?? '').trim() || 'VIDEO_GENERATION_FAILED';
  const normalizedStatus = Number(error?.status ?? 503);
  const errorType = String(error?.errorType ?? error?.name ?? 'VideoProviderError').trim() || 'VideoProviderError';

  if (normalizedCode === 'VIDEO_JOB_TIMEOUT') {
    return {
      code: normalizedCode,
      message: rawMessage,
      status: normalizedStatus || 504,
      provider: error?.provider ?? 'google',
      errorType,
      category: 'timeout',
      retryable: false,
    };
  }

  if (
    ['VIDEO_AUTH_INVALID', 'VIDEO_NOT_CONFIGURED'].includes(normalizedCode)
    || normalizedStatus === 401
    || normalizedStatus === 403
    || /invalid api key|authentication|unauthori[sz]ed|permission/i.test(rawMessage)
  ) {
    return {
      code: normalizedCode || 'VIDEO_AUTH_INVALID',
      message: rawMessage,
      status: normalizedStatus || 503,
      provider: error?.provider ?? 'google',
      errorType,
      category: 'auth',
      retryable: false,
    };
  }

  if (
    ['VIDEO_DURATION_UNSUPPORTED', 'VIDEO_RESOLUTION_UNSUPPORTED', 'VIDEO_ASPECT_RATIO_UNSUPPORTED', 'VIDEO_REFERENCE_IMAGES_UNSUPPORTED', 'VIDEO_REFERENCE_IMAGES_DURATION_INVALID', 'VIDEO_REFERENCE_IMAGE_INVALID_TYPE', 'VIDEO_REFERENCE_IMAGE_TOO_LARGE', 'VIDEO_MODE_UNSUPPORTED', 'VIDEO_RESOLUTION_DURATION_INVALID', 'VIDEO_RETRY_LIMIT_REACHED'].includes(normalizedCode)
    || normalizedStatus === 400
  ) {
    return {
      code: normalizedCode,
      message: rawMessage,
      status: normalizedStatus || 400,
      provider: error?.provider ?? 'google',
      errorType,
      category: 'validation',
      retryable: false,
    };
  }

  if (normalizedStatus === 429 || /rate.?limit/i.test(rawMessage)) {
    return {
      code: normalizedCode,
      message: rawMessage,
      status: normalizedStatus || 429,
      provider: error?.provider ?? 'google',
      errorType,
      category: 'rate_limit',
      retryable: true,
    };
  }

  if (normalizedStatus >= 500 || /temporar|unavailable|network|timeout/i.test(rawMessage)) {
    return {
      code: normalizedCode,
      message: rawMessage,
      status: normalizedStatus || 503,
      provider: error?.provider ?? 'google',
      errorType,
      category: 'provider_unavailable',
      retryable: true,
    };
  }

  return {
    code: normalizedCode,
    message: rawMessage,
    status: normalizedStatus || 503,
    provider: error?.provider ?? 'google',
    errorType,
    category: 'provider_error',
    retryable: false,
  };
}

export async function enqueueVideoGenerationJob(jobId, options = {}) {
  if (!jobId) {
    return { dispatchMode: 'noop' };
  }

  const env = options.env ?? process.env;

  if (isVideoWorkerEnabled(env)) {
    logVideoJobEvent('job_enqueued', { id: jobId }, {
      extra: { dispatchMode: 'worker' },
    });
    return { dispatchMode: 'worker' };
  }

  if (PROCESSING_JOBS.has(jobId)) {
    return { dispatchMode: 'inline', alreadyProcessing: true };
  }

  logVideoJobEvent('job_enqueued', { id: jobId }, {
    extra: { dispatchMode: 'inline' },
  });

  queueMicrotask(() => {
    processQueuedVideoJob(jobId, options).catch((error) => {
      console.error('[VIDEO] Job processing failed:', error.message);
    });
  });

  return { dispatchMode: 'inline' };
}

export async function processQueuedVideoJobs(limit = 5, options = {}) {
  const deps = buildVideoGenerationDeps(options);
  await sweepTimedOutVideoJobs(deps);
  const jobs = await deps.listQueuedVideoJobs(limit);

  for (const job of jobs) {
    await processQueuedVideoJob(job.id, options);
  }
}

export async function claimAndProcessNextVideoJobs(options = {}) {
  const deps = buildVideoGenerationDeps(options);
  const batchSize = Math.max(
    1,
    Math.min(Number(options.batchSize ?? deps.batchSize) || 3, 25),
  );

  await sweepTimedOutVideoJobs(deps);

  const candidates = await deps.listQueuedVideoJobs(batchSize);
  let claimed = 0;

  for (const candidate of candidates) {
    const reserved = await deps.claimQueuedVideoJob(candidate.id);

    if (!reserved) {
      continue;
    }

    claimed += 1;
    logVideoJobEvent('job_claimed', reserved, {
      status: reserved.status,
      extra: { claimSource: 'worker' },
    });

    try {
      await processQueuedVideoJob(reserved.id, options);
    } catch (error) {
      console.error('[VIDEO_WORKER] processQueuedVideoJob failed for', reserved.id, error?.message ?? error);
    }
  }

  return { candidates: candidates.length, claimed };
}

export async function processQueuedVideoJob(jobId, options = {}) {
  if (!jobId || PROCESSING_JOBS.has(jobId)) {
    return;
  }

  const deps = buildVideoGenerationDeps(options);
  PROCESSING_JOBS.add(jobId);

  try {
    const job = await deps.db.query.videoGenerationEvents.findFirst({
      where: eq(videoGenerationEvents.id, jobId),
    });

    if (!job || !['queued', 'reserved'].includes(job.status)) {
      return;
    }

    let attempt = (job.retryCount ?? 0) + 1;
    let lastFailure = null;
    const referenceImages = await deps.loadReferenceImages(job.providerMetadata?.referenceImages ?? []);

    await deps.applyVideoJobThrottle(job);

    while (attempt <= (job.maxRetries ?? 2) + 1) {
      let tempFilePath = null;

      try {
        const provider = deps.providerFactory();
        let operation = await provider.startJob({
          prompt: job.prompt,
          durationSeconds: job.durationSeconds,
          resolution: job.resolution,
          aspectRatio: job.aspectRatio,
          mode: job.providerMetadata?.mode ?? 'lite',
          referenceImages,
        });
        const startedAt = deps.now();

        await deps.markVideoJobProcessing({
          jobId,
          providerJobId: operation.name,
          metadata: {
            attempt,
            operationName: operation.name,
            providerErrorCategory: null,
            processingStartedAt: new Date(startedAt).toISOString(),
          },
        });

        logVideoJobEvent('status_transition', job, {
          status: 'processing',
          attempt,
          extra: { providerJobId: operation.name },
        });

        await deps.recordProductEvent({
          orgId: job.orgId,
          userId: job.userId,
          eventName: 'video.job_started',
          metadata: buildVideoEventMetadata(job, {
            attempt,
            providerJobId: operation.name,
          }),
        });

        while (!operation.done) {
          if (deps.now() - startedAt > deps.timeoutMs) {
            throw buildVideoJobTimeoutError(job, deps.timeoutMs);
          }

          await deps.sleep(deps.pollIntervalMs);
          operation = await provider.pollJob(operation.raw);
        }

        if (operation.error) {
          throw buildProviderError(operation.error);
        }

        const generatedVideo = operation.generatedVideo?.video;
        if (!generatedVideo) {
          throw buildProviderError(new Error('Veo completed without a downloadable video payload.'));
        }

        await mkdir(TEMP_VIDEO_DIR, { recursive: true });
        tempFilePath = path.join(TEMP_VIDEO_DIR, `${job.id}-${Date.now()}.mp4`);

        await provider.downloadAsset({
          file: generatedVideo,
          downloadPath: tempFilePath,
        });

        const uploadedAsset = await deps.mediaStorage.uploadGeneratedVideo({
          filePath: tempFilePath,
          orgId: job.orgId,
          conversationId: job.conversationId,
          videoJobId: job.id,
          metadata: {
            duration: job.durationSeconds,
            resolution: job.resolution,
            aspectRatio: job.aspectRatio,
            mode: job.providerMetadata?.mode ?? 'lite',
          },
        });

        await deps.recordProductEvent({
          orgId: job.orgId,
          userId: job.userId,
          eventName: 'video.asset_uploaded',
          metadata: buildVideoEventMetadata(job, {
            storageProvider: uploadedAsset.storageProvider,
            publicId: uploadedAsset.publicId ?? null,
            deliveryUrl: uploadedAsset.deliveryUrl ?? uploadedAsset.secureUrl ?? null,
            bytes: uploadedAsset.bytes ?? null,
            format: uploadedAsset.format ?? null,
          }),
        });

        const cleanedReferenceAssets = await deps.cleanupReferenceImages(
          job.providerMetadata?.referenceImages ?? [],
        );
        const committed = await deps.commitVideoJob({
          jobId,
          outputUrl: uploadedAsset.deliveryUrl ?? uploadedAsset.secureUrl ?? null,
          outputFileName: uploadedAsset.fileName ?? uploadedAsset.publicId ?? null,
          providerJobId: operation.name,
          providerMetadata: {
            completedAt: new Date().toISOString(),
            providerErrorCategory: null,
            storageProvider: uploadedAsset.storageProvider,
            outputAsset: normalizeStoredAsset(uploadedAsset),
            referenceImages: cleanedReferenceAssets,
            referenceImageCleanupStatus: summarizeCleanupStatus(cleanedReferenceAssets),
          },
        });

        await createAssistantMessageForVideo(committed.job, {
          outputUrl: uploadedAsset.deliveryUrl ?? uploadedAsset.secureUrl ?? null,
          outputFileName: uploadedAsset.fileName ?? uploadedAsset.publicId ?? null,
          providerOperation: operation.name,
          uploadedAsset,
        });

        logVideoJobEvent('status_transition', committed.job ?? job, {
          status: 'completed',
          attempt,
          durationSecondsElapsed: Math.round((deps.now() - startedAt) / 1000),
          extra: {
            providerJobId: operation.name,
            storageProvider: uploadedAsset.storageProvider,
          },
        });

        await deps.recordProductEvent({
          orgId: job.orgId,
          userId: job.userId,
          eventName: 'video.job_completed',
          metadata: buildVideoEventMetadata(committed.job, {
            providerJobId: operation.name,
            storageProvider: uploadedAsset.storageProvider,
            publicId: uploadedAsset.publicId ?? null,
            deliveryUrl: uploadedAsset.deliveryUrl ?? uploadedAsset.secureUrl ?? null,
            bytes: uploadedAsset.bytes ?? null,
            attempt,
          }),
        });

        return committed.job;
      } catch (error) {
        lastFailure = classifyVideoJobFailure(error);

        if (!lastFailure.retryable || attempt > (job.maxRetries ?? 2)) {
          break;
        }

        await deps.incrementVideoJobRetry(jobId);
        attempt += 1;
        await deps.sleep(2_500 * attempt);
      } finally {
        if (tempFilePath) {
          await deleteTemporaryFile(tempFilePath);
        }
      }
    }

    const cleanedReferenceAssets = await deps.cleanupReferenceImages(job.providerMetadata?.referenceImages ?? []);
    const released = await deps.releaseVideoJob({
      jobId,
      status: 'failed',
      failureCode: lastFailure?.code ?? 'VIDEO_GENERATION_FAILED',
      failureMessage: lastFailure?.message ?? 'Video generation failed before render completion.',
      providerMetadata: {
        failedAt: new Date().toISOString(),
        providerErrorType: lastFailure?.errorType ?? null,
        providerErrorCategory: lastFailure?.category ?? 'provider_error',
        referenceImages: cleanedReferenceAssets,
        referenceImageCleanupStatus: summarizeCleanupStatus(cleanedReferenceAssets),
      },
    });

    await recordFailedVideoJob(released.job, {
      userId: job.userId,
      failure: lastFailure,
      deps,
    });

    logVideoJobEvent('status_transition', released.job ?? job, {
      status: released?.job?.status ?? 'failed',
      failureCode: lastFailure?.code ?? 'VIDEO_GENERATION_FAILED',
      failureCategory: lastFailure?.category ?? 'provider_error',
      failure: true,
    });
  } finally {
    PROCESSING_JOBS.delete(jobId);
  }
}

async function sweepTimedOutVideoJobs(deps) {
  const jobs = await deps.db.query.videoGenerationEvents.findMany({
    where: or(
      and(
        eq(videoGenerationEvents.status, 'processing'),
        lt(videoGenerationEvents.startedAt, new Date(deps.now() - deps.timeoutMs)),
      ),
      and(
        or(
          eq(videoGenerationEvents.status, 'queued'),
          eq(videoGenerationEvents.status, 'reserved'),
        ),
        lt(videoGenerationEvents.createdAt, new Date(deps.now() - deps.timeoutMs)),
      ),
    ),
    limit: 20,
  });

  for (const job of jobs) {
    const cleanedReferenceAssets = await deps.cleanupReferenceImages(job.providerMetadata?.referenceImages ?? []);
    const released = await deps.releaseVideoJob({
      jobId: job.id,
      status: 'failed',
      failureCode: 'VIDEO_JOB_TIMEOUT',
      failureMessage: `Video generation exceeded the ${Math.round(deps.timeoutMs / 1000)} second timeout window.`,
      providerMetadata: {
        timedOutAt: new Date().toISOString(),
        providerErrorCategory: 'timeout',
        referenceImages: cleanedReferenceAssets,
        referenceImageCleanupStatus: summarizeCleanupStatus(cleanedReferenceAssets),
      },
    });

    await recordFailedVideoJob(released.job, {
      userId: job.userId,
      failure: classifyVideoJobFailure(buildVideoJobTimeoutError(job, deps.timeoutMs)),
      deps,
    });
  }
}

async function recordFailedVideoJob(job, { userId, failure, deps }) {
  console.error('[VIDEO JOB FAILED]', {
    jobId: job.id,
    orgId: job.orgId,
    userId,
    provider: job.provider,
    model: job.model,
    failureCode: failure?.code ?? job.failureCode,
    failureCategory: failure?.category ?? job.providerMetadata?.providerErrorCategory ?? null,
    failureMessage: failure?.message ?? job.failureMessage,
  });

  await Promise.all([
    deps.recordProductEvent({
      orgId: job.orgId,
      userId,
      eventName: 'video.job_failed',
      metadata: buildVideoEventMetadata(job, {
        failureCode: failure?.code ?? job.failureCode,
        failureMessage: failure?.message ?? job.failureMessage,
        failureCategory: failure?.category ?? job.providerMetadata?.providerErrorCategory ?? null,
        errorType: failure?.errorType ?? job.providerMetadata?.providerErrorType ?? null,
      }),
    }),
    deps.recordProductEvent({
      orgId: job.orgId,
      userId,
      eventName: 'video.credits_released',
      metadata: buildVideoEventMetadata(job, {
        failureCode: failure?.code ?? job.failureCode,
        failureMessage: failure?.message ?? job.failureMessage,
        releasedCredits: job.creditsReserved ?? 0,
      }),
    }),
  ]);
}

async function createAssistantMessageForVideo(job, { outputUrl, outputFileName, providerOperation, uploadedAsset }) {
  if (!job.conversationId) {
    return null;
  }

  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, job.conversationId),
  });

  if (!conversation) {
    return null;
  }

  const agent = getAgent(conversation.agentId);
  const content = buildVideoMessage(agent?.name ?? 'PIXEL', job.prompt);
  const videoMode = job.providerMetadata?.mode ?? 'lite';
  const providerLabel = job.providerMetadata?.providerLabel ?? (videoMode === 'standard' ? 'Veo 3.1 Standard' : 'Veo 3.1 Lite');
  const route = videoMode === 'standard' ? 'veo-3.1-standard' : 'veo-3.1-lite';
  const routeReason = `Queued video generation through the ${providerLabel} provider.`;
  const [assistantMessage] = await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      role: 'assistant',
      content,
      metadata: {
        provider: 'google',
        route,
        routeReason,
        model: job.model,
        videoJobId: job.id,
        generatedVideos: [buildGeneratedVideoArtifact(job, uploadedAsset, {
          outputUrl,
          outputFileName,
          providerOperation,
          mode: videoMode,
          providerLabel,
        })],
      },
    })
    .returning();

  await db
    .update(videoGenerationEvents)
    .set({
      messageId: assistantMessage.id,
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationEvents.id, job.id));

  await db
    .update(conversations)
    .set({
      title: conversation.title || buildConversationTitle(`/video ${job.prompt}`),
      lastActiveAt: new Date(),
      messageCount: (conversation.messageCount ?? 0) + 1,
    })
    .where(eq(conversations.id, conversation.id));

  return assistantMessage;
}

function buildVideoMessage(agentName, prompt) {
  return `Generated a video concept with ${agentName}. Review the first render, then iterate if you want a different camera move, tone, or pacing.\n\nPrompt: ${prompt}`;
}

function buildConversationTitle(message) {
  return message.length > 60 ? `${message.slice(0, 57).trim()}...` : message.trim();
}

function buildProviderError(error) {
  const normalized = new Error(error?.message || 'Veo video generation failed.');
  normalized.code = error?.code ?? 'VIDEO_GENERATION_FAILED';
  normalized.status = error?.status ?? 503;
  normalized.provider = 'google';
  normalized.errorType = error?.name ?? 'VideoProviderError';
  return normalized;
}

function buildVideoJobTimeoutError(job, timeoutMs) {
  const error = new Error(
    `Video generation exceeded the ${Math.round(timeoutMs / 1000)} second timeout window.`,
  );
  error.code = 'VIDEO_JOB_TIMEOUT';
  error.status = 504;
  error.provider = job?.provider ?? 'google';
  error.errorType = 'VideoJobTimeoutError';
  return error;
}

function summarizeCleanupStatus(referenceAssets = []) {
  if (!Array.isArray(referenceAssets) || referenceAssets.length === 0) {
    return 'none';
  }

  if (referenceAssets.every((asset) => asset.cleanupStatus === 'retained_for_audit')) {
    return 'retained_for_audit';
  }

  if (referenceAssets.every((asset) => asset.cleanupStatus === 'deleted_after_job' || asset.cleanupStatus === 'already_removed')) {
    return 'deleted_after_job';
  }

  return 'partial';
}

function normalizeStoredAsset(asset = {}) {
  return {
    storageProvider: asset.storageProvider ?? 'local',
    publicId: asset.publicId ?? null,
    secureUrl: asset.secureUrl ?? null,
    deliveryUrl: asset.deliveryUrl ?? asset.secureUrl ?? null,
    resourceType: asset.resourceType ?? 'video',
    bytes: asset.bytes ?? null,
    duration: asset.duration ?? null,
    format: asset.format ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
    cleanupStatus: asset.cleanupStatus ?? 'retained',
  };
}

export function buildGeneratedVideoArtifact(job, uploadedAsset = {}, {
  outputUrl = null,
  outputFileName = null,
  providerOperation = null,
  mode = null,
  providerLabel = null,
} = {}) {
  return {
    prompt: job.prompt,
    mode: mode ?? job.providerMetadata?.mode ?? 'lite',
    providerLabel: providerLabel ?? job.providerMetadata?.providerLabel ?? null,
    durationSeconds: job.durationSeconds,
    resolution: job.resolution,
    aspectRatio: job.aspectRatio,
    referenceImageCount: Number(job.providerMetadata?.referenceImageCount ?? 0),
    url: outputUrl,
    fileName: outputFileName,
    providerOperation,
    storageProvider: uploadedAsset.storageProvider ?? 'local',
    publicId: uploadedAsset.publicId ?? null,
    secureUrl: uploadedAsset.secureUrl ?? null,
    deliveryUrl: uploadedAsset.deliveryUrl ?? uploadedAsset.secureUrl ?? null,
    resourceType: uploadedAsset.resourceType ?? 'video',
    bytes: uploadedAsset.bytes ?? null,
    duration: uploadedAsset.duration ?? job.durationSeconds,
    format: uploadedAsset.format ?? 'mp4',
    cleanupStatus: uploadedAsset.cleanupStatus ?? 'retained',
  };
}

function buildVideoEventMetadata(job, overrides = {}) {
  return {
    jobId: job.id,
    orgId: job.orgId,
    userId: job.userId ?? null,
    mode: job.providerMetadata?.mode ?? 'lite',
    providerLabel: job.providerMetadata?.providerLabel ?? null,
    durationSeconds: job.durationSeconds,
    resolution: job.resolution,
    aspectRatio: job.aspectRatio,
    referenceImageCount: Number(job.providerMetadata?.referenceImageCount ?? 0),
    creditsRequested: job.creditsRequested ?? 0,
    creditsReserved: job.creditsReserved ?? 0,
    creditsCommitted: job.creditsCommitted ?? 0,
    providerJobId: job.providerJobId ?? null,
    retryCount: job.retryCount ?? 0,
    maxRetries: job.maxRetries ?? 2,
    createdAt: job.createdAt,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
    ...overrides,
  };
}

function buildVideoGenerationDeps(options = {}) {
  const env = options.env ?? process.env;
  const timing = getVideoGenerationConfig(env);
  const mediaStorage = options.mediaStorage ?? getMediaStorage({ env });
  const processingTimeoutMs = Number(
    options.processingTimeoutMs
      ?? env.VIDEO_JOB_PROCESSING_TIMEOUT_MS
      ?? timing.timeoutMs,
  );
  const batchSize = Number(options.batchSize ?? env.VIDEO_WORKER_BATCH_SIZE ?? 3);

  return {
    db: options.db ?? db,
    providerFactory: options.providerFactory ?? (() => options.provider ?? getVeoVideoProvider()),
    mediaStorage,
    now: options.now ?? (() => Date.now()),
    sleep: options.sleep ?? sleep,
    timeoutMs: Number(options.timeoutMs ?? timing.timeoutMs),
    pollIntervalMs: Number(options.pollIntervalMs ?? timing.pollIntervalMs),
    processingTimeoutMs,
    batchSize,
    applyVideoJobThrottle: options.applyVideoJobThrottle ?? applyVideoJobThrottle,
    loadReferenceImages: options.loadReferenceImages
      ?? ((assets) => loadVideoReferenceImages(assets, { storage: mediaStorage })),
    cleanupReferenceImages: options.cleanupReferenceImages
      ?? ((assets) => cleanupVideoReferenceImages(assets, { storage: mediaStorage })),
    markVideoJobProcessing: options.markVideoJobProcessing ?? markVideoJobProcessing,
    commitVideoJob: options.commitVideoJob ?? commitVideoJob,
    releaseVideoJob: options.releaseVideoJob ?? releaseVideoJob,
    incrementVideoJobRetry: options.incrementVideoJobRetry ?? incrementVideoJobRetry,
    listQueuedVideoJobs: options.listQueuedVideoJobs ?? listQueuedVideoJobs,
    claimQueuedVideoJob: options.claimQueuedVideoJob ?? claimQueuedVideoJob,
    listStuckProcessingVideoJobs: options.listStuckProcessingVideoJobs ?? listStuckProcessingVideoJobs,
    recordProductEvent: options.recordProductEvent ?? recordProductEvent,
  };
}

async function deleteTemporaryFile(filePath) {
  try {
    await unlink(filePath);
  } catch {
    // Temporary-file cleanup is best effort.
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

import { randomUUID } from 'crypto';
import { mkdir, readFile } from 'fs/promises';
import path from 'path';
import { eq } from 'drizzle-orm';
import { getAgent } from '../agents/config.js';
import { db } from '../db/index.js';
import { conversations, messages, videoGenerationEvents } from '../db/schema.js';
import {
  commitVideoJob,
  incrementVideoJobRetry,
  listQueuedVideoJobs,
  markVideoJobProcessing,
  releaseVideoJob,
} from './billing-engine.js';
import { applyVideoJobThrottle } from './billing-throttle.js';
import { getVeoVideoProvider } from './providers/veo-video-provider.js';

const GENERATED_VIDEO_DIR = path.resolve(process.cwd(), 'storage', 'generated-videos');
const PROCESSING_JOBS = new Set();

export async function enqueueVideoGenerationJob(jobId) {
  if (!jobId || PROCESSING_JOBS.has(jobId)) {
    return;
  }

  queueMicrotask(() => {
    processQueuedVideoJob(jobId).catch((error) => {
      console.error('[VIDEO] Job processing failed:', error.message);
    });
  });
}

export async function processQueuedVideoJobs(limit = 5) {
  const jobs = await listQueuedVideoJobs(limit);

  for (const job of jobs) {
    await processQueuedVideoJob(job.id);
  }
}

export async function processQueuedVideoJob(jobId) {
  if (!jobId || PROCESSING_JOBS.has(jobId)) {
    return;
  }

  PROCESSING_JOBS.add(jobId);

  try {
    const job = await db.query.videoGenerationEvents.findFirst({
      where: eq(videoGenerationEvents.id, jobId),
    });

    if (!job || !['queued', 'reserved'].includes(job.status)) {
      return;
    }

    const provider = getVeoVideoProvider();
    let attempt = (job.retryCount ?? 0) + 1;
    let lastError = null;
    let operation = null;

    await applyVideoJobThrottle(job);

    while (attempt <= (job.maxRetries ?? 2) + 1) {
      try {
        operation = await provider.startJob({
          prompt: job.prompt,
          durationSeconds: job.durationSeconds,
          resolution: job.resolution,
          aspectRatio: job.aspectRatio,
        });
        await markVideoJobProcessing({
          jobId,
          providerJobId: operation.name,
          metadata: {
            attempt,
            operationName: operation.name,
          },
        });

        while (!operation.done) {
          await sleep(10_000);
          operation = await provider.pollJob(operation.raw);
        }

        if (operation.error) {
          throw buildProviderError(operation.error);
        }

        const generatedVideo = operation.generatedVideo?.video;
        if (!generatedVideo) {
          throw buildProviderError(new Error('Veo completed without a downloadable video payload.'));
        }

        await mkdir(GENERATED_VIDEO_DIR, { recursive: true });
        const fileName = `${Date.now()}-${randomUUID()}.mp4`;
        const filePath = path.join(GENERATED_VIDEO_DIR, fileName);

        await provider.downloadAsset({
          file: generatedVideo,
          downloadPath: filePath,
        });

        const outputUrl = `/generated-video-assets/${fileName}`;
        const committed = await commitVideoJob({
          jobId,
          outputUrl,
          outputFileName: fileName,
          providerJobId: operation.name,
          providerMetadata: {
            completedAt: new Date().toISOString(),
          },
        });

        await createAssistantMessageForVideo(committed.job, {
          outputUrl,
          outputFileName: fileName,
          providerOperation: operation.name,
        });

        return committed.job;
      } catch (error) {
        lastError = error;

        if (attempt > (job.maxRetries ?? 2)) {
          break;
        }

        await incrementVideoJobRetry(jobId);
        attempt += 1;
        await sleep(2_500 * attempt);
      }
    }

    await releaseVideoJob({
      jobId,
      status: 'failed',
      failureCode: lastError?.code ?? 'VIDEO_GENERATION_FAILED',
      failureMessage: lastError?.message ?? 'Video generation failed before render completion.',
      providerMetadata: {
        failedAt: new Date().toISOString(),
      },
    });
  } finally {
    PROCESSING_JOBS.delete(jobId);
  }
}

export async function readGeneratedVideoAsset(fileName) {
  const safeName = path.basename(fileName);

  if (!safeName || safeName !== fileName) {
    const error = new Error('Invalid video asset path.');
    error.status = 400;
    error.code = 'VIDEO_ASSET_INVALID';
    throw error;
  }

  return readFile(path.join(GENERATED_VIDEO_DIR, safeName));
}

async function createAssistantMessageForVideo(job, { outputUrl, outputFileName, providerOperation }) {
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
  const [assistantMessage] = await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      role: 'assistant',
      content,
      metadata: {
        provider: 'google',
        route: 'veo-3.1-lite',
        routeReason: 'Queued video generation through the Veo 3.1 Lite provider.',
        model: job.model,
        videoJobId: job.id,
        generatedVideos: [
          {
            prompt: job.prompt,
            durationSeconds: job.durationSeconds,
            resolution: job.resolution,
            aspectRatio: job.aspectRatio,
            url: outputUrl,
            fileName: outputFileName,
            providerOperation,
          },
        ],
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
  return normalized;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

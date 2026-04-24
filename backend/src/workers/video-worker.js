import { fileURLToPath } from 'url';
import {
  claimAndProcessNextVideoJobs,
  isVideoWorkerEnabled,
} from '../services/video-generation.js';

const DEFAULT_POLL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 3;

function readPollIntervalMs(env) {
  const raw = Number(
    env.VIDEO_WORKER_POLL_MS
    ?? env.VIDEO_JOB_POLL_INTERVAL_MS
    ?? env.VIDEO_QUEUE_POLL_INTERVAL_MS,
  );

  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_POLL_MS;
}

function readBatchSize(env) {
  const raw = Number(env.VIDEO_WORKER_BATCH_SIZE);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_BATCH_SIZE;
}

export async function runVideoWorkerTick(options = {}) {
  const env = options.env ?? process.env;
  const batchSize = Number(options.batchSize ?? readBatchSize(env));
  return claimAndProcessNextVideoJobs({ ...options, batchSize });
}

export async function runVideoWorkerLoop(options = {}) {
  const env = options.env ?? process.env;
  const pollMs = Number(options.pollMs ?? readPollIntervalMs(env));
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const shouldStop = options.shouldStop ?? (() => false);

  console.log(
    `[VIDEO WORKER] Starting loop (poll=${pollMs}ms, batchSize=${readBatchSize(env)}, enabled=${isVideoWorkerEnabled(env)})`,
  );

  while (!shouldStop()) {
    const startedAt = Date.now();

    try {
      const result = await runVideoWorkerTick(options);
      if (result?.claimed > 0) {
        console.log(`[VIDEO WORKER] Tick claimed ${result.claimed}/${result.candidates} jobs.`);
      }
    } catch (error) {
      console.error('[VIDEO WORKER] Tick failed:', error?.message ?? error);
    }

    const elapsed = Date.now() - startedAt;
    const delay = Math.max(pollMs - elapsed, 250);
    await sleep(delay);
  }
}

async function main() {
  try {
    await runVideoWorkerLoop();
  } catch (error) {
    console.error('[VIDEO WORKER] Fatal error:', error?.message ?? error);
    process.exitCode = 1;
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  main();
}

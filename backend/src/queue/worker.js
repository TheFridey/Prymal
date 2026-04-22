import { hasTriggerDevConfig } from './trigger.js';
import { processQueuedVideoJobs } from '../services/video-generation.js';

const POLL_INTERVAL_MS = Number(process.env.VIDEO_QUEUE_POLL_INTERVAL_MS ?? 15_000);

async function main() {
  if (hasTriggerDevConfig()) {
    console.log('Trigger.dev is configured. The local worker will still process queued Veo video jobs.');
  }

  console.log(`[VIDEO WORKER] Polling for queued jobs every ${POLL_INTERVAL_MS}ms.`);

  while (true) {
    try {
      await processQueuedVideoJobs();
    } catch (error) {
      console.error('[VIDEO WORKER] Poll failed:', error.message);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((error) => {
  console.error('[VIDEO WORKER] Fatal error:', error.message);
  process.exitCode = 1;
});

import { hasTriggerDevConfig } from './trigger.js';
import { runVideoWorkerLoop } from '../workers/video-worker.js';

async function main() {
  if (hasTriggerDevConfig()) {
    console.log('Trigger.dev is configured. The local worker will still process queued Veo video jobs.');
  }

  await runVideoWorkerLoop();
}

main().catch((error) => {
  console.error('[VIDEO WORKER] Fatal error:', error?.message ?? error);
  process.exitCode = 1;
});

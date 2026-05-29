import { hasTriggerDevConfig } from './trigger.js';
import { runVideoWorkerLoop } from '../workers/video-worker.js';
import { logger } from '../lib/logger.js';

const log = logger.child({ component: 'worker' });

async function main() {
  if (hasTriggerDevConfig()) {
    log.info('worker.trigger_dev_configured');
  }

  await runVideoWorkerLoop();
}

main().catch((error) => {
  log.error({ err: error }, 'worker.fatal_error');
  process.exitCode = 1;
});

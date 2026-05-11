#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');

await runNodeScript(['scripts/verify-local-db.mjs'], {
  label: 'local DB verification',
});

await runNodeScript(['scripts/run-tests.mjs', 'src/services/workflow-engine.test.js'], {
  label: 'DB-backed workflow concurrency proof',
  env: {
    PRYMAL_RUN_DB_WORKFLOW_CONCURRENCY_TESTS: 'true',
  },
});

async function runNodeScript(args, { label, env = {} } = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: backendRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...env,
      },
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${label ?? args.join(' ')} exited with signal ${signal}.`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`${label ?? args.join(' ')} failed with exit code ${code}.`));
        return;
      }

      resolve();
    });
  });
}

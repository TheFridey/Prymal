import { existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const cleanInstall = process.argv.includes('--clean');
const cleanupTargets = cleanInstall ? ['node_modules', 'dist'] : ['dist'];

for (const target of cleanupTargets) {
  const absoluteTarget = resolve(frontendRoot, target);
  if (existsSync(absoluteTarget)) {
    removeWithRetry(absoluteTarget);
  }
}

if (cleanInstall) {
  run('ci', '--force');
} else {
  console.log('[verify-build] Reusing existing node_modules. Pass --clean to force a fresh install.');
}

run('run', 'lint');
run('run', 'build');
run('run', 'test');

console.log('[verify-build] Lint, build, and tests completed successfully.');

function run(...args) {
  const result = spawnSync(npmCommand, args, {
    cwd: frontendRoot,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    if (result.error) {
      console.error(`[verify-build] Failed to run npm ${args.join(' ')}: ${result.error.message}`);
    }
    process.exit(result.status ?? 1);
  }
}

function removeWithRetry(targetPath, attempts = 6) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      rmSync(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      const isRetryable = ['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(error?.code);
      if (!isRetryable || attempt === attempts) {
        throw error;
      }

      const waitMs = attempt * 250;
      console.warn(`[verify-build] Retry ${attempt}/${attempts - 1} removing ${targetPath} after ${error.code}. Waiting ${waitMs}ms.`);
      sleep(waitMs);
    }
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

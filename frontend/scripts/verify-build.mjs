import { existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const cleanupTargets = ['node_modules', 'dist'];

for (const target of cleanupTargets) {
  const absoluteTarget = resolve(frontendRoot, target);
  if (existsSync(absoluteTarget)) {
    rmSync(absoluteTarget, { recursive: true, force: true });
  }
}

run('ci');
run('run', 'build');
run('run', 'test');

console.log('[verify-build] Clean install, build, and tests completed successfully.');

function run(...args) {
  const result = spawnSync(npmCommand, args, {
    cwd: frontendRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

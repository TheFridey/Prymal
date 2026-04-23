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
    rmSync(absoluteTarget, { recursive: true, force: true });
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

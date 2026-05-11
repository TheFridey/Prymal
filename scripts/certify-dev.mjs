#!/usr/bin/env node

import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  resolvePlaywrightEnv,
  validatePlaywrightAuthConfig,
} from '../frontend/scripts/playwright-auth-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const backendDir = path.join(repoRoot, 'backend');
const frontendDir = path.join(repoRoot, 'frontend');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const results = [];
let backendServer = null;
let backendServerStartedByScript = false;

try {
  await runTask('Backend lint', npmTask('lint', backendDir));
  await runTask('Backend tests', npmTask('test', backendDir));
  await runTask('Schema drift', nodeTask(['scripts/check-schema-drift.mjs'], backendDir));
  await runTask('Local DB verify', nodeTask(['scripts/verify-local-db.mjs'], backendDir));
  await runTask('Backend env validation (development)', nodeTask(['scripts/validate-env.mjs', '--scope', 'backend', '--mode', 'development'], backendDir));
  await runTask('Dev evidence generation', npmTask('dev:evidence', backendDir));
  await runTask('Workflow DB concurrency proof', npmTask('test:workflow:db', backendDir));

  await runTask('Frontend lint', npmTask('lint', frontendDir));
  await runTask('Frontend tests', npmTask('test', frontendDir));
  await runTask('Frontend build', npmTask('build', frontendDir));
  await runTask('Frontend verify-build', npmTask('verify-build', frontendDir));
  await runTask('Frontend env validation (development)', nodeTask(['scripts/validate-env.mjs', '--scope', 'frontend', '--mode', 'development'], backendDir));

  const backendReady = await isBackendHealthy();
  if (!backendReady) {
    backendServer = startBackendServer();
    backendServerStartedByScript = true;
    await waitForBackend();
  }

  await runTask('Playwright public certification', npmTask('test:e2e:public', frontendDir));
  await runTask('Playwright dev certification', npmTask('test:e2e:dev', frontendDir));
  const authStatus = getPlaywrightAuthStatus();
  if (authStatus.complete) {
    await runTask('Playwright auth preflight', npmTask('test:e2e:auth:check', frontendDir));
    await runTask('Playwright authenticated certification', npmTask('test:e2e:auth', frontendDir));
  } else {
    results.push({
      name: 'Playwright authenticated certification',
      status: 'UNPROVEN',
      detail: `Missing Playwright auth variables: ${authStatus.missing.join(', ')}.`,
    });
  }
  await runTask('Dev evidence inspection', npmTask('beta:evidence', backendDir));
} finally {
  if (backendServerStartedByScript && backendServer) {
    backendServer.kill();
  }
}

const finalAuthStatus = getPlaywrightAuthStatus();
results.push({
  name: 'Authenticated browser proof',
  status: finalAuthStatus.complete ? 'PASS' : 'UNPROVEN',
  detail: finalAuthStatus.complete
    ? 'Local QA auth credentials are configured and auth-backed browser suites are included in certification.'
    : `Missing Playwright auth variables: ${finalAuthStatus.missing.join(', ')}.`,
});

const failing = results.filter((result) => result.status === 'FAIL');

console.log('');
console.table(results.map((result) => ({
  area: result.name,
  status: result.status,
  detail: result.detail,
})));

console.log('');
if (failing.length > 0) {
  console.log(`DEV certification result: FAIL (${failing.length} failing check${failing.length === 1 ? '' : 's'}).`);
  process.exit(1);
}

console.log('DEV certification result: PASS with explicit UNPROVEN areas listed separately.');

async function runTask(name, task) {
  try {
    await task.run();
    results.push({ name, status: 'PASS', detail: task.detail });
  } catch (error) {
    results.push({ name, status: 'FAIL', detail: error.message });
    throw error;
  }
}

function npmTask(script, cwd, extraArgs = []) {
  return {
    detail: `npm run ${script}${extraArgs.length ? ` ${extraArgs.join(' ')}` : ''}`,
    run: () => runProcess(npmCommand, ['run', script, ...extraArgs], cwd),
  };
}

function nodeTask(args, cwd) {
  return {
    detail: `${process.execPath} ${args.join(' ')}`,
    run: () => runProcess(process.execPath, args, cwd),
  };
}

function runProcess(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = process.platform === 'win32'
      ? spawn(buildCommandLine(command, args), {
          cwd,
          stdio: 'inherit',
          env: process.env,
          shell: true,
        })
      : spawn(command, args, {
          cwd,
          stdio: 'inherit',
          env: process.env,
        });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} ${args.join(' ')} exited with signal ${signal}.`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}.`));
        return;
      }

      resolve();
    });
  });
}

async function isBackendHealthy() {
  try {
    const response = await fetch('http://127.0.0.1:3001/health');
    return response.ok;
  } catch {
    return false;
  }
}

function startBackendServer() {
  const env = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  if (process.platform === 'win32') {
    return spawn(buildCommandLine(process.execPath, ['src/index.js']), {
      cwd: backendDir,
      stdio: 'inherit',
      env,
      shell: true,
    });
  }

  return spawn(process.execPath, ['src/index.js'], {
    cwd: backendDir,
    stdio: 'inherit',
    env,
  });
}

async function waitForBackend(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isBackendHealthy()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error('Local backend did not become healthy on http://127.0.0.1:3001 within 30 seconds.');
}

function getPlaywrightAuthStatus() {
  const env = resolvePlaywrightEnv({ repoRoot });
  const validation = validatePlaywrightAuthConfig({
    env,
    requireAllRoles: true,
    requireApprovedDevUrls: true,
  });

  return {
    complete: validation.valid,
    missing: validation.missingVariables,
  };
}

function buildCommandLine(command, args) {
  return [command, ...args].map(quoteForShell).join(' ');
}

function quoteForShell(value) {
  const text = String(value ?? '');
  if (!text || /[\s"]/u.test(text)) {
    return `"${text.replace(/"/g, '\\"')}"`;
  }
  return text;
}

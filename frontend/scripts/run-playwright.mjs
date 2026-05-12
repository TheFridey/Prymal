#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_LOCAL_PLAYWRIGHT_API_URL,
  DEFAULT_LOCAL_PLAYWRIGHT_BASE_URL,
  PLAYWRIGHT_AUTH_SPEC_LIST,
  PLAYWRIGHT_DEV_SPEC_LIST,
  PLAYWRIGHT_PUBLIC_SPEC_LIST,
} from './playwright-auth-config.mjs';

const mode = (process.argv[2] ?? 'dev').trim().toLowerCase();
const extraArgs = process.argv.slice(3);

const profile = getProfile(mode);
const childEnv = {
  ...process.env,
  ...profile.env,
};
const testSelection = extraArgs.length > 0 ? extraArgs : profile.specs;
let managedBackend = null;

try {
  if (shouldManageLocalBackend(childEnv)) {
    managedBackend = await ensureLocalBackend(childEnv);
  }

  if (profile.preflight) {
    await runCommand(profile.preflight.commandLine, {
      cwd: profile.preflight.cwd,
      env: childEnv,
    });
  }

  await runCommand([
    'npm',
    'exec',
    'playwright',
    'test',
    '--',
    ...testSelection,
  ], {
    cwd: process.cwd(),
    env: childEnv,
  });
} catch (error) {
  process.exit(error?.exitCode ?? 1);
} finally {
  if (managedBackend?.started && managedBackend.process) {
    managedBackend.process.kill();
  }
}

function getProfile(requestedMode) {
  const localBaseUrl = DEFAULT_LOCAL_PLAYWRIGHT_BASE_URL;
  const localApiUrl = DEFAULT_LOCAL_PLAYWRIGHT_API_URL;

  if (requestedMode === 'public') {
    return {
      env: {
        PLAYWRIGHT_AUTH_REQUIRED: 'false',
        PLAYWRIGHT_BASE_URL: localBaseUrl,
        PLAYWRIGHT_API_URL: localApiUrl,
        PLAYWRIGHT_MANAGED_BACKEND: 'false',
        PLAYWRIGHT_MANAGED_WEBSERVER: 'true',
      },
      specs: [...PLAYWRIGHT_PUBLIC_SPEC_LIST],
    };
  }

  if (requestedMode === 'auth') {
    return {
      env: {
        PLAYWRIGHT_AUTH_REQUIRED: 'true',
        PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL ?? localBaseUrl,
        PLAYWRIGHT_API_URL: process.env.PLAYWRIGHT_API_URL ?? localApiUrl,
        PLAYWRIGHT_MANAGED_WEBSERVER: process.env.PLAYWRIGHT_BASE_URL ? 'false' : 'true',
      },
      preflight: shouldRunLocalQaFixtures()
        ? {
            cwd: resolveBackendDir(),
            commandLine: ['npm', 'run', 'dev:fixtures'],
          }
        : null,
      specs: [...PLAYWRIGHT_AUTH_SPEC_LIST],
    };
  }

  if (requestedMode !== 'dev') {
    console.error(`Unknown Playwright mode "${requestedMode}". Use dev, public, or auth.`);
    process.exit(1);
  }

  return {
    env: {
      PLAYWRIGHT_AUTH_REQUIRED: 'false',
      PLAYWRIGHT_BASE_URL: localBaseUrl,
      PLAYWRIGHT_API_URL: localApiUrl,
      PLAYWRIGHT_MANAGED_WEBSERVER: 'true',
    },
    specs: [...PLAYWRIGHT_DEV_SPEC_LIST],
  };
}

function quoteForShell(value) {
  const text = String(value ?? '');
  if (!text || /[\s"]/u.test(text)) {
    return `"${text.replace(/"/g, '\\"')}"`;
  }
  return text;
}

function shouldRunLocalQaFixtures() {
  return process.env.PLAYWRIGHT_REFRESH_DEV_FIXTURES !== 'false';
}

function resolveBackendDir() {
  return fileURLToPath(new URL('../../backend/', import.meta.url));
}

function shouldManageLocalBackend(env) {
  if (env.PLAYWRIGHT_MANAGED_BACKEND === 'false') {
    return false;
  }

  if (env.PLAYWRIGHT_MANAGED_WEBSERVER !== 'true') {
    return false;
  }

  const apiUrl = env.PLAYWRIGHT_API_URL ?? '';
  return isLocalApiUrl(apiUrl);
}

async function ensureLocalBackend(env) {
  if (await isBackendHealthy(env.PLAYWRIGHT_API_URL)) {
    return { started: false, process: null };
  }

  const backendDir = resolveBackendDir();
  const backendProcess = spawnCommand(['npm', 'start'], {
    cwd: backendDir,
    env: {
      ...env,
      NODE_ENV: env.NODE_ENV || 'development',
    },
  });

  try {
    await waitForBackend(env.PLAYWRIGHT_API_URL);
    return { started: true, process: backendProcess };
  } catch (error) {
    backendProcess.kill();
    throw error;
  }
}

async function isBackendHealthy(apiUrl) {
  try {
    const healthUrl = new URL(String(apiUrl ?? '').trim());
    healthUrl.pathname = '/health';
    healthUrl.search = '';
    healthUrl.hash = '';
    const response = await fetch(healthUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForBackend(apiUrl, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isBackendHealthy(apiUrl)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw Object.assign(
    new Error(`Local backend did not become healthy for ${apiUrl} within ${timeoutMs / 1000} seconds.`),
    { exitCode: 1 },
  );
}

function isLocalApiUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  } catch {
    return false;
  }
}

function runCommand(commandParts, { cwd, env }) {
  return new Promise((resolve, reject) => {
    const commandLine = commandParts.map(quoteForShell).join(' ');
    const child = spawnCommand(commandParts, { cwd, env });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      if ((code ?? 1) !== 0) {
        reject(Object.assign(new Error(`Command failed: ${commandLine}`), { exitCode: code ?? 1 }));
        return;
      }

      resolve();
    });
  });
}

function spawnCommand(commandParts, { cwd, env }) {
  const commandLine = commandParts.map(quoteForShell).join(' ');
  return spawn(commandLine, {
    cwd,
    stdio: 'inherit',
    env,
    shell: true,
  });
}

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

try {
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
    ...profile.specs,
    ...extraArgs,
  ], {
    cwd: process.cwd(),
    env: childEnv,
  });
} catch (error) {
  process.exit(error?.exitCode ?? 1);
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

function runCommand(commandParts, { cwd, env }) {
  return new Promise((resolve, reject) => {
    const commandLine = commandParts.map(quoteForShell).join(' ');
    const child = spawn(commandLine, {
      cwd,
      stdio: 'inherit',
      env,
      shell: true,
    });

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

#!/usr/bin/env node

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const node = process.execPath;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const steps = [
  {
    label: 'production env validation',
    run: () => runCommand(node, ['scripts/verify-production-env.mjs']),
  },
  {
    label: 'schema drift check',
    run: () => runCommand(node, ['scripts/check-schema-drift.mjs']),
  },
  {
    label: 'security headers verification',
    run: () => runCommand(node, ['scripts/verify-security-headers.mjs']),
  },
  {
    label: 'rate limit configuration verification',
    run: () => runCommand(node, ['scripts/verify-rate-limit-config.mjs']),
  },
  {
    label: 'media storage configuration verification',
    run: () => runCommand(node, ['scripts/verify-media-storage-config.mjs']),
  },
];

const warnings = [];
let failed = false;

for (const step of steps) {
  const result = step.run();
  if (result.status !== 0) {
    failed = true;
    console.error(`[fail] ${step.label}`);
    continue;
  }

  console.log(`[ok] ${step.label}`);
}

const auditResult = process.platform === 'win32'
  ? runCommand('cmd.exe', ['/d', '/s', '/c', 'npm audit --omit=dev --audit-level=high --json'], {
    allowFailure: true,
    captureOutput: true,
    echoOutput: false,
  })
  : runCommand(npmCommand, ['audit', '--omit=dev', '--audit-level=high', '--json'], {
  allowFailure: true,
  captureOutput: true,
    echoOutput: false,
  });
const parsedAuditResult = tryParseJson(auditResult.stdout);

if (auditResult.error && !parsedAuditResult) {
  warnings.push('npm audit could not be executed safely in this environment. Run `npm audit --omit=dev` manually before upload.');
} else if (auditResult.status === 0) {
  console.log('[ok] npm audit --omit=dev completed without high or critical findings.');
} else {
  const high = Number(parsedAuditResult?.metadata?.vulnerabilities?.high ?? 0);
  const critical = Number(parsedAuditResult?.metadata?.vulnerabilities?.critical ?? 0);

  if (high > 0 || critical > 0) {
    failed = true;
    console.error(`[fail] npm audit reported ${high} high and ${critical} critical production vulnerabilities.`);
  } else {
    warnings.push('npm audit returned a non-zero status, but the result could not be classified. Review `npm audit --omit=dev` manually before upload.');
  }
}

for (const warning of warnings) {
  console.warn(`[warn] ${warning}`);
}

if (failed) {
  console.error('[summary] Production security preflight failed.');
  process.exit(1);
}

console.log('[summary] Production security preflight passed.');

function runCommand(command, args, { allowFailure = false, captureOutput = false, echoOutput = true } = {}) {
  const result = spawnSync(command, args, {
    cwd: backendRoot,
    stdio: captureOutput ? 'pipe' : 'inherit',
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });

  if (captureOutput && echoOutput && result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (captureOutput && echoOutput && result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (!allowFailure && result.status !== 0) {
    return result;
  }

  return result;
}

function tryParseJson(value) {
  try {
    return JSON.parse(String(value ?? ''));
  } catch {
    return null;
  }
}

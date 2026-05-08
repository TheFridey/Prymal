#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const mode = getArgValue('--mode') ?? 'staging';
const authRequired = hasFlag('--auth-required') || mode === 'staging';
const includeEvidence = !hasFlag('--skip-evidence');
const evidenceSection = getArgValue('--evidence-section') ?? 'all';
const evidenceLimit = getArgValue('--evidence-limit') ?? '8';

const steps = [
  {
    label: 'backend env validation',
    command: 'node',
    args: ['scripts/validate-env.mjs', '--scope', 'backend', '--mode', mode],
  },
  {
    label: 'frontend env validation',
    command: 'node',
    args: ['scripts/validate-env.mjs', '--scope', 'frontend', '--mode', mode],
  },
];

if (mode === 'staging') {
  steps.push({
    label: authRequired ? 'playwright auth validation' : 'playwright env validation',
    command: 'node',
    args: [
      'scripts/validate-env.mjs',
      '--scope',
      'playwright',
      '--mode',
      mode,
      ...(authRequired ? ['--auth-required'] : []),
    ],
  });
}

if (includeEvidence) {
  steps.push({
    label: 'db evidence summary',
    command: 'node',
    args: [
      'scripts/beta-db-evidence.mjs',
      '--section',
      evidenceSection,
      '--limit',
      evidenceLimit,
    ],
  });
}

for (const step of steps) {
  console.log(`\n[beta:check] ${step.label}`);
  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    console.error(`\n[beta:check] ${step.label} failed.`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\n[beta:check] Completed successfully for mode=${mode}.`);
if (mode === 'staging') {
  console.log('[beta:check] Next: run the authenticated Playwright specs from frontend/ once staging creds are filled.');
}

function hasFlag(flag) {
  return args.includes(flag);
}

function getArgValue(flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
}

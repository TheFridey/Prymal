#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const checks = [
  ['schema:check', ['node', ['scripts/check-schema-drift.mjs']]],
  ['drizzle migrations present', ['node', ['-e', `
    const fs = require('fs');
    const required = ['0006_founding_claims_founder_period.sql', '0007_usage_estimate_events.sql'];
    const missing = required.filter((name) => !fs.existsSync('drizzle/' + name));
    if (missing.length) {
      console.error('Missing backend/drizzle migrations: ' + missing.join(', '));
      process.exit(1);
    }
    console.log('Drizzle migration check passed.');
  `]]],
];

for (const [label, [command, args]] of checks) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    console.error(`[db:verify-local] ${label} failed.`);
    process.exit(result.status ?? 1);
  }
}

console.log('[db:verify-local] Local schema verification passed.');

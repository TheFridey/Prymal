#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { validateRuntimeEnv } from '../src/env/runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

dotenv.config({ path: path.join(repoRoot, 'backend', '.env'), override: false });

const result = validateRuntimeEnv(process.env, {
  mode: 'production',
  strict: true,
});

for (const warning of result.warnings) {
  console.warn(`[warn] ${warning}`);
}

if (!result.valid) {
  for (const error of result.errors) {
    console.error(`[error] ${error}`);
  }
  process.exit(1);
}

console.log('[ok] Production runtime environment validation passed.');

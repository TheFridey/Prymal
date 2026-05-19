#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { validateMediaStorageConfiguration } from '../src/services/media-storage/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

dotenv.config({ path: path.join(repoRoot, 'backend', '.env'), override: false });

const result = validateMediaStorageConfiguration(process.env);

for (const warning of result.warnings) {
  console.warn(`[warn] ${warning}`);
}

if (!result.valid) {
  for (const error of result.errors) {
    console.error(`[error] ${error}`);
  }
  process.exit(1);
}

console.log(`[ok] Media storage configuration passed using driver=${result.driver}.`);

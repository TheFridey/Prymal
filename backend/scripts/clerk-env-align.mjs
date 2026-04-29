#!/usr/bin/env node
/**
 * Compares Clerk keys in frontend/.env vs backend/.env without printing secrets.
 * Run from repo: cd backend && npm run clerk:align
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const backendEnvPath = path.join(repoRoot, 'backend', '.env');
const frontendEnvPath = path.join(repoRoot, 'frontend', '.env');

function readEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return dotenv.parse(raw);
  } catch {
    return null;
  }
}

function clerkMode(key) {
  if (!key || typeof key !== 'string') return null;
  const m = key.trim().match(/^(pk|sk)_(test|live)_/);
  return m ? m[2] : null;
}

function preview(key, len = 18) {
  if (!key) return '(missing)';
  const t = key.trim();
  if (t.length <= len) return `${t.slice(0, 4)}…`;
  return `${t.slice(0, len)}…`;
}

const fileBe = readEnvFile(backendEnvPath);
const fileFe = readEnvFile(frontendEnvPath);

if (!fileBe) {
  console.error(`[clerk:align] Missing or unreadable: ${backendEnvPath}`);
  process.exit(1);
}

if (!fileFe) {
  console.error(`[clerk:align] Missing or unreadable: ${frontendEnvPath}`);
  process.exit(1);
}

const pkBackend = fileBe.CLERK_PUBLISHABLE_KEY?.trim() ?? '';
const pkFrontend = fileFe.VITE_CLERK_PUBLISHABLE_KEY?.trim() ?? '';
const skBackend = fileBe.CLERK_SECRET_KEY?.trim() ?? '';

const pkMatch = pkBackend && pkFrontend && pkBackend === pkFrontend;
const modePk = clerkMode(pkBackend);
const modeSk = clerkMode(skBackend);
const modeMatch = modePk && modeSk && modePk === modeSk;

console.log('[clerk:align] Publishable keys');
console.log(`  backend/.env CLERK_PUBLISHABLE_KEY  ${preview(pkBackend)}`);
console.log(`  frontend/.env VITE_CLERK_*          ${preview(pkFrontend)}`);
console.log(`  same string: ${pkMatch ? 'yes' : 'NO — fix before API will accept JWTs'}`);

console.log('');
console.log('[clerk:align] Secret key (file only)');
console.log(`  backend/.env CLERK_SECRET_KEY       ${preview(skBackend)} (mode: ${modeSk ?? 'unknown'})`);
console.log(`  publishable mode (test/live):      ${modePk ?? 'unknown'}`);
console.log(`  test/live alignment: ${modeMatch ? 'ok' : 'NO — sk_test pairs with pk_test, sk_live with pk_live'}`);

const procSk = process.env.CLERK_SECRET_KEY?.trim();
console.log('');
if (procSk) {
  const matchesFile = skBackend && procSk === skBackend;
  console.log('[clerk:align] Shell/system CLERK_SECRET_KEY');
  console.log(`  ${matchesFile ? 'matches backend/.env (ok)' : 'DIFFERS from backend/.env — Node uses this for the API, not the file'}`);
} else {
  console.log('[clerk:align] Shell/system CLERK_SECRET_KEY not inherited (API loads secret from backend/.env unless your host injects CLERK_*).');
}

if (procSk && skBackend && procSk !== skBackend) {
  console.warn('');
  console.warn('[clerk:align] Unset CLERK_SECRET_KEY in the shell / OS, or set it to the same value as backend/.env for this Clerk app.');
}

if (pkMatch && modeMatch) {
  console.log('');
  console.log('[clerk:align] File alignment looks good. If 401 persists, set CLERK_API_URL / CLERK_API_VERSION from Clerk Dashboard → API keys (regional instances), or confirm no stale CLERK_* in system env.');
  process.exit(0);
}

console.log('');
console.error('[clerk:align] Fix the mismatches above, restart the backend, and hard-refresh the SPA.');
process.exit(1);

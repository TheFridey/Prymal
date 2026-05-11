#!/usr/bin/env node

import path from 'node:path';
import {
  findRepoRoot,
  resolvePlaywrightEnv,
  validatePlaywrightAuthConfig,
} from './playwright-auth-config.mjs';

const repoRoot = findRepoRoot(process.cwd());
const env = resolvePlaywrightEnv({ repoRoot });
const result = validatePlaywrightAuthConfig({
  env,
  requireAllRoles: true,
  requireApprovedDevUrls: true,
});

console.log('Playwright auth preflight');
console.log(`- Base URL: ${result.resolved.baseUrl || '(missing)'}`);
console.log(`- API URL: ${result.resolved.apiUrl || '(missing)'}`);
console.log(`- Auth required: ${result.resolved.authRequired ? 'true' : 'false'}${result.resolved.authRequired ? '' : ' (test:e2e:auth will force true)'}`);
console.log(`- Env file: ${path.join(repoRoot, '.env.playwright')}`);

if (result.warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of result.warnings) {
    console.log(`- ${warning}`);
  }
}

if (!result.valid) {
  console.log('');
  console.log('FAIL');
  for (const error of result.errors) {
    console.log(`- ${error}`);
  }
  process.exit(1);
}

console.log('');
console.log('PASS');
console.log(`Configured auth roles: ${result.resolved.configuredRoles.join(', ')}`);

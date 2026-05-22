#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_LOCAL_PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:4173';
export const DEFAULT_LOCAL_PLAYWRIGHT_API_URL = 'http://127.0.0.1:3001/api';

export const PLAYWRIGHT_ROLE_ENV_MAP = Object.freeze({
  user: ['PLAYWRIGHT_TEST_USER_EMAIL', 'PLAYWRIGHT_TEST_USER_PASSWORD'],
  staff: ['PLAYWRIGHT_TEST_STAFF_EMAIL', 'PLAYWRIGHT_TEST_STAFF_PASSWORD'],
  invitee: ['PLAYWRIGHT_TEST_INVITEE_EMAIL', 'PLAYWRIGHT_TEST_INVITEE_PASSWORD'],
  onboarding: ['PLAYWRIGHT_TEST_ONBOARDING_EMAIL', 'PLAYWRIGHT_TEST_ONBOARDING_PASSWORD'],
  billing: ['PLAYWRIGHT_TEST_BILLING_EMAIL', 'PLAYWRIGHT_TEST_BILLING_PASSWORD'],
});

export const PLAYWRIGHT_AUTH_ROLE_NAMES = Object.freeze(Object.keys(PLAYWRIGHT_ROLE_ENV_MAP));

export const PLAYWRIGHT_PUBLIC_SPEC_LIST = Object.freeze([
  'tests/marketing-smoke.spec.js',
  'tests/mobile-layout.spec.js',
  'tests/onboarding-smoke.spec.js',
]);

export const PLAYWRIGHT_DEV_SPEC_LIST = Object.freeze([
  ...PLAYWRIGHT_PUBLIC_SPEC_LIST,
]);

export const PLAYWRIGHT_AUTH_SPEC_LIST = Object.freeze([
  'tests/admin-operator.spec.js',
  'tests/app-core.spec.js',
  'tests/authenticated-regression.spec.js',
  'tests/billing-portal.spec.js',
  'tests/chat-runtime.spec.js',
  'tests/dashboard-first-win.spec.js',
  'tests/invite-membership.spec.js',
  'tests/mobile-layout.spec.js',
  'tests/onboarding-regression.spec.js',
  'tests/security-boundaries.spec.js',
  'tests/settings-smoke.spec.js',
  'tests/workspace-smoke.spec.js',
]);

export function readPlaywrightEnvFile(repoRoot = findRepoRoot(process.cwd())) {
  const envPath = path.join(repoRoot, '.env.playwright');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

export function resolvePlaywrightEnv({
  repoRoot = findRepoRoot(process.cwd()),
  env = process.env,
} = {}) {
  return {
    ...readPlaywrightEnvFile(repoRoot),
    ...env,
  };
}

export function validatePlaywrightAuthConfig({
  env,
  requireAllRoles = true,
  requireApprovedDevUrls = true,
} = {}) {
  const errors = [];
  const warnings = [];
  const missingVariables = [];

  const baseUrl = String(env?.PLAYWRIGHT_BASE_URL ?? '').trim();
  const apiUrl = String(env?.PLAYWRIGHT_API_URL ?? '').trim();
  const authRequired = String(env?.PLAYWRIGHT_AUTH_REQUIRED ?? '').trim().toLowerCase() === 'true';

  if (!baseUrl) {
    missingVariables.push('PLAYWRIGHT_BASE_URL');
  }

  if (!apiUrl) {
    missingVariables.push('PLAYWRIGHT_API_URL');
  }

  if (baseUrl && requireApprovedDevUrls && !isApprovedDevUrl(baseUrl, { expectApi: false })) {
    errors.push(`PLAYWRIGHT_BASE_URL must point at localhost or an approved dev URL. Received: ${baseUrl}`);
  }

  if (apiUrl && requireApprovedDevUrls && !isApprovedDevUrl(apiUrl, { expectApi: true })) {
    errors.push(`PLAYWRIGHT_API_URL must point at localhost or an approved dev API URL. Received: ${apiUrl}`);
  }

  if (!authRequired) {
    warnings.push('PLAYWRIGHT_AUTH_REQUIRED is not set to true in the resolved environment. `npm run test:e2e:auth` will force strict auth mode anyway.');
  }

  for (const [role, [emailKey, passwordKey]] of Object.entries(PLAYWRIGHT_ROLE_ENV_MAP)) {
    const emailValue = String(env?.[emailKey] ?? '').trim();
    const passwordValue = String(env?.[passwordKey] ?? '').trim();

    const emailMissing = !emailValue || isPlaceholderValue(emailValue);
    const passwordMissing = !passwordValue || isPlaceholderValue(passwordValue);

    if (emailMissing) {
      missingVariables.push(emailKey);
    }
    if (passwordMissing) {
      missingVariables.push(passwordKey);
    }

    if (!requireAllRoles && (emailMissing || passwordMissing)) {
      continue;
    }

    if (!emailMissing && !looksLikeEmail(emailValue)) {
      errors.push(`${emailKey} must contain a valid email address.`);
    }

    if (!passwordMissing && passwordValue.length < 8) {
      errors.push(`${passwordKey} must be at least 8 characters long.`);
    }

    if ((emailMissing && !passwordMissing) || (!emailMissing && passwordMissing)) {
      errors.push(`Playwright role "${role}" must provide both ${emailKey} and ${passwordKey}.`);
    }
  }

  if (requireAllRoles && missingVariables.length > 0) {
    errors.push(`Missing required Playwright auth variables: ${dedupe(missingVariables).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missingVariables: dedupe(missingVariables),
    resolved: {
      baseUrl,
      apiUrl,
      authRequired,
      configuredRoles: PLAYWRIGHT_AUTH_ROLE_NAMES.filter((role) => {
        const [emailKey, passwordKey] = PLAYWRIGHT_ROLE_ENV_MAP[role];
        return !isPlaceholderValue(env?.[emailKey]) && !isPlaceholderValue(env?.[passwordKey]);
      }),
    },
  };
}

export function isApprovedDevUrl(rawValue, { expectApi = false } = {}) {
  try {
    const url = new URL(String(rawValue ?? '').trim());
    const host = url.hostname.toLowerCase();
    const approvedHost = host === 'localhost'
      || host === '127.0.0.1'
      || host.endsWith('.localhost')
      || host.endsWith('.local')
      || host.endsWith('.test');

    if (!approvedHost) {
      return false;
    }

    if (expectApi) {
      return url.pathname === '/api' || url.pathname.endsWith('/api');
    }

    return true;
  } catch {
    return false;
  }
}

export function findRepoRoot(startDir) {
  let current = path.resolve(startDir);
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git')) || fs.existsSync(path.join(current, 'backend')) && fs.existsSync(path.join(current, 'frontend'))) {
      return current;
    }
    current = path.dirname(current);
  }
  return path.resolve(startDir, '..');
}

function isPlaceholderValue(value) {
  const trimmed = String(value ?? '').trim().toLowerCase();
  return !trimmed || trimmed.includes('replace-with-real-password') || trimmed.includes('<') || trimmed.includes('your_');
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(String(value ?? '').trim());
}

function dedupe(values) {
  return [...new Set(values)];
}

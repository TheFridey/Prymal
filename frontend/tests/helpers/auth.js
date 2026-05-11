import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

import dotenv from 'dotenv';
import { clerk } from '@clerk/testing/playwright';

const ROLE_ENV_MAP = {
  user: ['PLAYWRIGHT_TEST_USER_EMAIL', 'PLAYWRIGHT_TEST_USER_PASSWORD'],
  staff: ['PLAYWRIGHT_TEST_STAFF_EMAIL', 'PLAYWRIGHT_TEST_STAFF_PASSWORD'],
  invitee: ['PLAYWRIGHT_TEST_INVITEE_EMAIL', 'PLAYWRIGHT_TEST_INVITEE_PASSWORD'],
  onboarding: ['PLAYWRIGHT_TEST_ONBOARDING_EMAIL', 'PLAYWRIGHT_TEST_ONBOARDING_PASSWORD'],
  billing: ['PLAYWRIGHT_TEST_BILLING_EMAIL', 'PLAYWRIGHT_TEST_BILLING_PASSWORD'],
};
export const PLAYWRIGHT_AUTH_ROLES = Object.freeze(Object.keys(ROLE_ENV_MAP));

const AUTH_STATE_DIR = path.resolve(process.cwd(), 'tests', '.auth');
const REPO_ROOT = findRepoRoot(process.cwd());
const API_BASE_URL = normalizeApiBaseUrl(
  process.env.PLAYWRIGHT_API_URL
  ?? process.env.VITE_API_URL
  ?? '',
);

hydrateLocalClerkTestingEnv();

export function authStatePath(role) {
  return path.join(AUTH_STATE_DIR, `${role}.json`);
}

export function getCredentials(role = 'user') {
  const keys = ROLE_ENV_MAP[role];
  if (!keys) {
    throw new Error(`Unknown Playwright auth role "${role}".`);
  }

  const [emailKey, passwordKey] = keys;
  const email = process.env[emailKey]?.trim() ?? '';
  const password = process.env[passwordKey]?.trim() ?? '';

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

export function hasCredentials(role = 'user') {
  return Boolean(getCredentials(role));
}

export function getConfiguredRoles() {
  return PLAYWRIGHT_AUTH_ROLES.filter((role) => hasCredentials(role));
}

export function getMissingRoles() {
  return PLAYWRIGHT_AUTH_ROLES.filter((role) => !hasCredentials(role));
}

export function isAuthRequired() {
  return process.env.PLAYWRIGHT_AUTH_REQUIRED === 'true';
}

export function missingRoles(roles = []) {
  return roles.filter((role) => !hasCredentials(role));
}

export function skipIfMissingCredentials(testApi, roles = ['user']) {
  const missing = missingRoles(roles);
  testApi.skip(
    missing.length > 0,
    `Missing Playwright auth credentials for: ${missing.join(', ')}`,
  );
}

export function skipIfNoCredentials(testApi) {
  skipIfMissingCredentials(testApi, ['user']);
}

export function skipIfNoStaffCredentials(testApi) {
  skipIfMissingCredentials(testApi, ['staff']);
}

export function validateAuthEnvironment({
  requiredRoles = isAuthRequired() ? ['user', 'staff', 'invitee', 'onboarding', 'billing'] : [],
  baseURL = process.env.PLAYWRIGHT_BASE_URL,
} = {}) {
  const errors = [];
  const warnings = [];

  if (isAuthRequired() && !String(baseURL ?? '').trim()) {
    errors.push('PLAYWRIGHT_BASE_URL must be set when PLAYWRIGHT_AUTH_REQUIRED=true.');
  }

  if (isAuthRequired() && !process.env.PLAYWRIGHT_API_URL?.trim()) {
    errors.push('PLAYWRIGHT_API_URL must be set when PLAYWRIGHT_AUTH_REQUIRED=true.');
  }

  for (const [role, [emailKey, passwordKey]] of Object.entries(ROLE_ENV_MAP)) {
    const hasEmail = Boolean(process.env[emailKey]?.trim());
    const hasPassword = Boolean(process.env[passwordKey]?.trim());

    if (hasEmail !== hasPassword) {
      errors.push(`Playwright role "${role}" has a partial credential pair. Set both ${emailKey} and ${passwordKey}, or neither.`);
    }
  }

  for (const role of requiredRoles) {
    if (!hasCredentials(role)) {
      const [emailKey, passwordKey] = ROLE_ENV_MAP[role];
      errors.push(`Missing ${emailKey} / ${passwordKey} for required Playwright role "${role}".`);
    }
  }

  if (!isAuthRequired() && getConfiguredRoles().length === 0) {
    warnings.push('No Playwright auth roles are configured. Authenticated specs will be reported as skipped.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function describeAuthConfiguration() {
  const configuredRoles = getConfiguredRoles();
  const missingRolesList = getMissingRoles();

  return {
    configuredRoles,
    missingRoles: missingRolesList,
    apiBaseUrl: API_BASE_URL || null,
    authRequired: isAuthRequired(),
  };
}

export function apiUrl(pathname) {
  if (!API_BASE_URL) {
    throw new Error('PLAYWRIGHT_API_URL or VITE_API_URL is required for authenticated API boundary tests.');
  }

  const normalizedPath = String(pathname ?? '').replace(/^\/+/, '');
  return `${API_BASE_URL}/${normalizedPath}`;
}

export async function ensureAuthStateDir() {
  await fs.mkdir(AUTH_STATE_DIR, { recursive: true });
}

export async function signInWith(page, { email, password, destination = '/app/dashboard' }) {
  if (!email || !password) {
    return false;
  }

  if (canUseClerkTestingSignIn()) {
    await signInWithTestingToken(page, { email, destination });
    return true;
  }

  return signInWithPassword(page, { email, password, destination });
}

export async function signIn(page) {
  return signInWith(page, {
    ...getCredentials('user'),
    destination: '/app/dashboard',
  });
}

export async function signInAsStaff(page) {
  return signInWith(page, {
    ...getCredentials('staff'),
    destination: '/app/admin',
  });
}

export async function createStorageStateForRole(browser, role, baseURL) {
  const credentials = getCredentials(role);
  if (!credentials) {
    return false;
  }

  await ensureAuthStateDir();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    await signInWith(page, {
      ...credentials,
      destination: null,
    });
    await context.storageState({ path: authStatePath(role) });
    return true;
  } finally {
    await context.close();
  }
}

export async function authFetch(page, url, init = {}) {
  const token = await waitForClerkSessionToken(page);
  const response = await page.request.fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return {
    ok: response.ok(),
    status: response.status(),
    data,
  };
}

export function uniqueSuffix(prefix = 'ci') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function signInWithTestingToken(page, { email, destination }) {
  await page.goto('/login');
  await clerk.loaded({ page });

  const frontendApiUrl = process.env.CLERK_FAPI?.trim();
  const options = frontendApiUrl
    ? { setupClerkTestingTokenOptions: { frontendApiUrl } }
    : {};

  await clerk.signIn({
    page,
    emailAddress: email,
    ...options,
  });

  await ensureSignedIntoWorkspace(page, destination);
}

async function signInWithPassword(page, { email, password, destination }) {
  await page.goto('/login');

  const emailField = page.getByLabel(/email/i).first();
  const passwordField = page.getByLabel(/password/i).first();

  await emailField.fill(email);
  await passwordField.fill(password);

  const continueButton = page.getByRole('button', { name: /^continue$/i });
  const signInButton = page.getByRole('button', { name: /^sign in$/i });

  if (await continueButton.count()) {
    await continueButton.first().click();
  } else {
    await signInButton.first().click();
  }

  const destinationResult = await Promise.race([
    page.waitForURL(/\/app\//, { timeout: 20_000 }).then(() => 'app'),
    page.waitForURL(/\/factor-two/, { timeout: 20_000 }).then(() => 'factor-two'),
  ]).catch(() => null);

  if (destinationResult === 'factor-two') {
    throw new Error(
      'Clerk sign-in reached factor-two verification. Provide inbox/OTP access or relax new-device verification for QA.',
    );
  }

  if (destinationResult !== 'app') {
    throw new Error(`Sign-in did not reach the workspace. Final URL: ${page.url()}`);
  }

  await ensureSignedIntoWorkspace(page, destination);
  return true;
}

function normalizeApiBaseUrl(value) {
  const trimmed = String(value ?? '').trim().replace(/\/$/, '');
  if (!trimmed) {
    return '';
  }

  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

function canUseClerkTestingSignIn() {
  return Boolean(process.env.CLERK_SECRET_KEY?.trim() && process.env.CLERK_PUBLISHABLE_KEY?.trim());
}

async function ensureSignedIntoWorkspace(page, destination) {
  const target = destination || '/app/dashboard';

  if (!page.url().includes('/app/')) {
    await page.goto(target);
  }

  const destinationResult = await Promise.race([
    page.waitForURL(/\/app\//, { timeout: 20_000 }).then(() => 'app'),
    page.waitForURL(/\/factor-two/, { timeout: 20_000 }).then(() => 'factor-two'),
  ]).catch(() => null);

  if (destinationResult === 'factor-two') {
    throw new Error(
      'Clerk sign-in reached factor-two verification. Provide inbox/OTP access or relax new-device verification for QA.',
    );
  }

  if (destinationResult !== 'app') {
    throw new Error(`Sign-in did not reach the workspace. Final URL: ${page.url()}`);
  }

  if (destination && !page.url().includes(destination)) {
    await page.goto(destination);
    await page.waitForURL(new RegExp(destination.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
}

async function waitForClerkSessionToken(page, timeoutMs = 10_000) {
  const token = await page.evaluate(
    async ({ timeout }) => {
      const start = Date.now();

      while (Date.now() - start < timeout) {
        const nextToken = await window.Clerk?.session?.getToken?.();
        if (nextToken) {
          return nextToken;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 200));
      }

      return null;
    },
    { timeout: timeoutMs },
  );

  if (!token) {
    throw new Error('Timed out waiting for an authenticated Clerk session token in Playwright.');
  }

  return token;
}

function hydrateLocalClerkTestingEnv() {
  const candidatePaths = [
    path.join(REPO_ROOT, 'backend', '.env'),
    path.join(REPO_ROOT, 'frontend', '.env'),
    path.join(REPO_ROOT, 'frontend', '.env.local'),
  ];

  for (const envPath of candidatePaths) {
    const parsed = parseEnvFile(envPath);
    if (!parsed) {
      continue;
    }

    if (!process.env.CLERK_SECRET_KEY && parsed.CLERK_SECRET_KEY) {
      process.env.CLERK_SECRET_KEY = parsed.CLERK_SECRET_KEY;
    }

    if (!process.env.CLERK_PUBLISHABLE_KEY) {
      process.env.CLERK_PUBLISHABLE_KEY = parsed.CLERK_PUBLISHABLE_KEY ?? parsed.VITE_CLERK_PUBLISHABLE_KEY ?? '';
    }
  }

  if (!process.env.CLERK_FAPI && process.env.CLERK_PUBLISHABLE_KEY) {
    process.env.CLERK_FAPI = parseClerkFrontendApi(process.env.CLERK_PUBLISHABLE_KEY);
  }
}

function parseEnvFile(filePath) {
  try {
    return dotenv.parse(readFileSyncUtf8(filePath));
  } catch {
    return null;
  }
}

function readFileSyncUtf8(filePath) {
  return Buffer.from(fsSync.readFileSync(filePath)).toString('utf8');
}

function parseClerkFrontendApi(publishableKey) {
  const value = String(publishableKey ?? '').trim();
  const parts = value.split('_');
  const encoded = parts.length >= 3 ? parts.slice(2).join('_') : '';
  if (!encoded) {
    return '';
  }

  try {
    return Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/u, '');
  } catch {
    return '';
  }
}

function findRepoRoot(startDir) {
  let current = path.resolve(startDir);
  while (current !== path.dirname(current)) {
    if (matchesRepoRoot(current)) {
      return current;
    }
    current = path.dirname(current);
  }
  return startDir;
}

function matchesRepoRoot(candidate) {
  try {
    return fsSync.existsSync(path.join(candidate, 'backend'))
      && fsSync.existsSync(path.join(candidate, 'frontend'));
  } catch {
    return false;
  }
}

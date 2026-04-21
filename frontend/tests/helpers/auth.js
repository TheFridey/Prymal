import fs from 'node:fs/promises';
import path from 'node:path';

const ROLE_ENV_MAP = {
  user: ['PLAYWRIGHT_TEST_USER_EMAIL', 'PLAYWRIGHT_TEST_USER_PASSWORD'],
  staff: ['PLAYWRIGHT_TEST_STAFF_EMAIL', 'PLAYWRIGHT_TEST_STAFF_PASSWORD'],
  invitee: ['PLAYWRIGHT_TEST_INVITEE_EMAIL', 'PLAYWRIGHT_TEST_INVITEE_PASSWORD'],
  onboarding: ['PLAYWRIGHT_TEST_ONBOARDING_EMAIL', 'PLAYWRIGHT_TEST_ONBOARDING_PASSWORD'],
  billing: ['PLAYWRIGHT_TEST_BILLING_EMAIL', 'PLAYWRIGHT_TEST_BILLING_PASSWORD'],
};

const AUTH_STATE_DIR = path.resolve(process.cwd(), 'tests', '.auth');

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
  return Object.keys(ROLE_ENV_MAP).filter((role) => hasCredentials(role));
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

  if (isAuthRequired() && !String(baseURL ?? '').trim()) {
    errors.push('PLAYWRIGHT_BASE_URL must be set when PLAYWRIGHT_AUTH_REQUIRED=true.');
  }

  for (const role of requiredRoles) {
    if (!hasCredentials(role)) {
      const [emailKey, passwordKey] = ROLE_ENV_MAP[role];
      errors.push(`Missing ${emailKey} / ${passwordKey} for required Playwright role "${role}".`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function ensureAuthStateDir() {
  await fs.mkdir(AUTH_STATE_DIR, { recursive: true });
}

export async function signInWith(page, { email, password, destination = '/app/dashboard' }) {
  if (!email || !password) {
    return false;
  }

  await page.goto('/login');

  const emailField = page.getByLabel(/email/i).first();
  const passwordField = page.getByLabel(/password/i).first();

  await emailField.fill(email);
  await passwordField.fill(password);

  await page.getByRole('button', { name: /sign in|continue/i }).first().click();
  await page.waitForURL(/\/app\//, { timeout: 20_000 });

  if (destination && !page.url().includes(destination)) {
    await page.goto(destination);
    await page.waitForURL(new RegExp(destination.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  return true;
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
  return page.evaluate(
    async ({ requestUrl, requestInit }) => {
      const token = await window.Clerk?.session?.getToken();
      const response = await fetch(requestUrl, {
        ...requestInit,
        headers: {
          'Content-Type': 'application/json',
          ...(requestInit.headers ?? {}),
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
        ok: response.ok,
        status: response.status,
        data,
      };
    },
    { requestUrl: url, requestInit: init },
  );
}

export function uniqueSuffix(prefix = 'ci') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

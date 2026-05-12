import { chromium } from '@playwright/test';
import {
  PLAYWRIGHT_AUTH_ROLES,
  authStatePath,
  createStorageStateForRole,
  describeAuthConfiguration,
  ensureAuthStateDir,
  getConfiguredRoles,
  validateAuthEnvironment,
} from './helpers/auth';
import {
  resolvePlaywrightEnv,
  validatePlaywrightAuthConfig,
} from '../scripts/playwright-auth-config.mjs';

export default async function globalSetup(config) {
  const baseURL = config.projects[0]?.use?.baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
  const validation = validateAuthEnvironment({ baseURL });
  const resolvedEnv = resolvePlaywrightEnv();
  const strictValidation = validatePlaywrightAuthConfig({
    env: resolvedEnv,
    requireAllRoles: process.env.PLAYWRIGHT_AUTH_REQUIRED === 'true',
    requireApprovedDevUrls: true,
  });

  await ensureAuthStateDir();
  await Promise.all(
    PLAYWRIGHT_AUTH_ROLES.map((role) =>
      writeStorageState(authStatePath(role), { cookies: [], origins: [] })),
  );

  if (!strictValidation.valid) {
    throw new Error(strictValidation.errors.join('\n'));
  }

  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'));
  }

  for (const warning of strictValidation.warnings ?? []) {
    console.warn(`[playwright-auth] ${warning}`);
  }

  for (const warning of validation.warnings ?? []) {
    console.warn(`[playwright-auth] ${warning}`);
  }

  const authConfig = describeAuthConfiguration();
  console.log(
    [
      '[playwright-auth]',
      `authRequired=${authConfig.authRequired}`,
      `configuredRoles=${authConfig.configuredRoles.length ? authConfig.configuredRoles.join(',') : 'none'}`,
      `missingRoles=${authConfig.missingRoles.length ? authConfig.missingRoles.join(',') : 'none'}`,
      `apiBaseUrl=${authConfig.apiBaseUrl ?? 'not configured'}`,
    ].join(' '),
  );

  if (!authConfig.authRequired) {
    return;
  }

  const roles = getConfiguredRoles();
  if (roles.length === 0) {
    return;
  }

  const browser = await chromium.launch();

  try {
    for (const role of roles) {
      await createStorageStateForRole(browser, role, baseURL);
    }
  } finally {
    await browser.close();
  }
}

async function writeStorageState(filePath, state) {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(filePath, JSON.stringify(state, null, 2));
}

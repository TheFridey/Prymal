import { chromium } from '@playwright/test';
import {
  createStorageStateForRole,
  describeAuthConfiguration,
  getConfiguredRoles,
  validateAuthEnvironment,
} from './helpers/auth';

export default async function globalSetup(config) {
  const baseURL = config.projects[0]?.use?.baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
  const validation = validateAuthEnvironment({ baseURL });

  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'));
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

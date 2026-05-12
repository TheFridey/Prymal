import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { defineConfig } from '@playwright/test';

const configDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(configDir, '.env'), quiet: true });
dotenv.config({ path: path.join(configDir, '.env.local'), override: true, quiet: true });
loadPlaywrightEnv();

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';
const managedWebServer = process.env.PLAYWRIGHT_MANAGED_WEBSERVER === 'true';
const authRequired = process.env.PLAYWRIGHT_AUTH_REQUIRED === 'true';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 1 : 0,
  workers: authRequired ? 1 : process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'list',
  outputDir: 'test-results',
  globalSetup: './tests/global.setup.js',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: managedWebServer
    ? {
        command: 'npm run build && npm run preview:e2e',
        port: 4173,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      }
    : undefined,
});

function loadPlaywrightEnv() {
  for (const envPath of [
    path.join(configDir, '..', '.env.playwright'),
    path.join(configDir, '.env.playwright'),
  ]) {
    const result = dotenv.config({ path: envPath, quiet: true, override: false, processEnv: {} });
    if (result.error || !result.parsed) {
      continue;
    }

    for (const [key, value] of Object.entries(result.parsed)) {
      if (!key.startsWith('PLAYWRIGHT_')) {
        continue;
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

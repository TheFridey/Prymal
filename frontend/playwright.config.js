import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'
import { defineConfig, devices } from '@playwright/test'

const configDir = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: path.join(configDir, '.env'), quiet: true })
dotenv.config({ path: path.join(configDir, '.env.local'), override: true, quiet: true })
dotenv.config({ path: path.join(configDir, '.env.test'), override: true, quiet: true })
loadPlaywrightEnv()

const isCi = Boolean(process.env.CI)
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
const managedWebServer = process.env.PLAYWRIGHT_MANAGED_WEBSERVER === 'true'
const authRequired = process.env.PLAYWRIGHT_AUTH_REQUIRED === 'true'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: isCi,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  retries: isCi ? 2 : 0,
  workers: isCi || authRequired ? 1 : undefined,
  reporter: isCi
    ? [['html', { outputFolder: 'playwright-report', open: 'never' }], ['github']]
    : 'list',
  outputDir: 'test-results',
  globalSetup: './tests/global.setup.js',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: '**/e2e/auth.setup.js' },
    {
      name: 'authenticated',
      testMatch: '**/e2e/workspace.smoke.js',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'marketing',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [
        '**/marketing.spec.js',
        '**/marketing-smoke.spec.js',
        '**/mobile-layout.spec.js',
        '**/onboarding-smoke.spec.js',
      ],
    },
    {
      name: 'legacy-authenticated',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [
        '**/e2e/**',
        '**/marketing-smoke.spec.js',
        '**/mobile-layout.spec.js',
        '**/onboarding-smoke.spec.js',
      ],
    },
  ],
  webServer: managedWebServer
    ? {
        command: 'npm run build && npm run preview:e2e',
        port: 4173,
        timeout: 120_000,
        reuseExistingServer: !isCi,
      }
    : isCi
      ? undefined
      : {
          command: 'npm run dev',
          port: 5173,
          reuseExistingServer: true,
        },
})

function loadPlaywrightEnv() {
  for (const envPath of [
    path.join(configDir, '..', '.env.playwright'),
    path.join(configDir, '.env.playwright'),
  ]) {
    const result = dotenv.config({ path: envPath, quiet: true, override: false, processEnv: {} })
    if (result.error || !result.parsed) {
      continue
    }

    for (const [key, value] of Object.entries(result.parsed)) {
      if (!key.startsWith('PLAYWRIGHT_')) {
        continue
      }

      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  }
}

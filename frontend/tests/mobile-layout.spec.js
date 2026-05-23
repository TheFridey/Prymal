import { test, expect } from '@playwright/test';
import { authStatePath, skipIfNoCredentials } from './helpers/auth';

const MOBILE_VIEWPORT = { width: 390, height: 844 };

const APP_MOBILE_ROUTES = [
  {
    name: 'dashboard',
    path: '/app/dashboard',
    readySelector: '.pm-dash__command',
    contentSelector: '.pm-dash__quick-grid',
    heading: /What do you want Prymal to help with today/i,
  },
  {
    name: 'settings',
    path: '/app/settings',
    readySelector: '.page-shell__inner',
    contentSelector: '.page-shell__inner',
    heading: /Workspace, billing, and operating controls/i,
  },
  {
    name: 'lore',
    path: '/app/lore',
    readySelector: '.page-shell__inner',
    contentSelector: '.page-shell__inner',
    heading: /Knowledge that the agents can actually retrieve/i,
  },
  {
    name: 'integrations',
    path: '/app/integrations',
    readySelector: '.integrations-page',
    contentSelector: '.integrations-page',
    heading: /Link the full account stack without losing the plot/i,
  },
  {
    name: 'agent-chat',
    path: '/app/agents/cipher',
    readySelector: '.workspace-studio--agents',
    contentSelector: '.workspace-studio--agents',
  },
];

async function readLayoutMetrics(page, selector) {
  return page.locator(selector).evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    };
  });
}

async function skipIfSetupGuard(page) {
  const setupGuard = await page
    .getByText(/VITE_CLERK_PUBLISHABLE_KEY/i)
    .first()
    .isVisible({ timeout: 2_000 })
    .catch(() => false);

  if (setupGuard) {
    test.skip(true, 'Clerk publishable key is not configured for this environment.');
  }
}

function expectCentredFullWidth(metrics, { minWidthRatio = 0.82, maxCenterOffsetRatio = 0.06 } = {}) {
  expect(metrics.width).toBeGreaterThan(metrics.viewportWidth * minWidthRatio);
  expect(metrics.left).toBeGreaterThanOrEqual(-1);
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);

  const centerOffset = Math.abs((metrics.left + metrics.width / 2) - metrics.viewportWidth / 2);
  expect(centerOffset).toBeLessThan(metrics.viewportWidth * maxCenterOffsetRatio);
}

async function expectAppShellUsesFullWidth(page, { contentSelector, minMainWidthRatio = 0.78, minContentWidthRatio = 0.85 }) {
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  await expect(page.getByText(/Application encountered an error/i)).not.toBeVisible();

  const main = page.locator('.app-main--studio');
  await expect(main).toBeVisible({ timeout: 20_000 });

  const mainMetrics = await readLayoutMetrics(page, '.app-main--studio');
  expect(mainMetrics.width).toBeGreaterThan(mainMetrics.viewportWidth * minMainWidthRatio);
  expect(mainMetrics.left).toBeLessThan(mainMetrics.viewportWidth * 0.08);

  if (contentSelector) {
    const content = page.locator(contentSelector).first();
    await expect(content).toBeVisible({ timeout: 20_000 });
    const contentMetrics = await readLayoutMetrics(page, contentSelector);
    expect(contentMetrics.width).toBeGreaterThan(mainMetrics.width * minContentWidthRatio);
  }
}

test.describe('Mobile auth layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test('login fits one viewport and stays centred', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await skipIfSetupGuard(page);

    const card = page.locator('.auth-card--gate');
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Sign in to Prymal/i })).toBeVisible({ timeout: 15_000 });

    const metrics = await readLayoutMetrics(page, '.auth-card--gate');
    expectCentredFullWidth(metrics);
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 4);

    await page.screenshot({ path: 'test-results/mobile-login-390.png', fullPage: false });
  });

  test('signup fits one viewport and stays centred', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });
    await skipIfSetupGuard(page);

    const card = page.locator('.auth-card--gate');
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Create your account|Sign up/i })).toBeVisible({ timeout: 15_000 });

    const metrics = await readLayoutMetrics(page, '.auth-card--gate');
    expectCentredFullWidth(metrics, { minWidthRatio: 0.8 });
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 4);
  });
});

test.describe('Mobile public agent profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test('agent profile loads without WebGL crash', async ({ page }) => {
    await page.goto('/agents/cipher', { waitUntil: 'domcontentloaded' });
    await skipIfSetupGuard(page);

    await expect(page.getByText(/Application encountered an error/i)).not.toBeVisible();
    await expect(page.locator('.agent-profile-shell')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.agent-profile-title')).toContainText(/./);

    const shellMetrics = await readLayoutMetrics(page, '.agent-profile-shell');
    expect(shellMetrics.width).toBeGreaterThan(shellMetrics.viewportWidth * 0.9);

    const heroScene = page.locator('.agent-profile__hero-scene');
    if (await heroScene.count()) {
      await expect(
        heroScene.locator('.prymal-cinematic-stage__fallback, .prymal-cinematic-stage__canvas-wrap'),
      ).toBeVisible({ timeout: 10_000 });
    }

    await page.screenshot({ path: 'test-results/mobile-agent-profile-cipher-390.png', fullPage: false });
  });
});

test.describe('Mobile app shell layout', () => {
  test.skip(
    () => process.env.PLAYWRIGHT_AUTH_REQUIRED !== 'true',
    'Authenticated app mobile layout checks require the authenticated Playwright profile.',
  );
  test.use({ storageState: authStatePath('user') });

  test.beforeEach(async ({ page }) => {
    skipIfNoCredentials(test);
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  for (const route of APP_MOBILE_ROUTES) {
    test(`${route.name} uses full mobile width`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      if (route.heading) {
        await expect(page.getByRole('heading', { name: route.heading })).toBeVisible({ timeout: 20_000 });
      } else {
        await expect(page.locator(route.readySelector).first()).toBeVisible({ timeout: 20_000 });
      }

      await expectAppShellUsesFullWidth(page, {
        contentSelector: route.contentSelector,
      });

      await page.screenshot({
        path: `test-results/mobile-${route.name}-390.png`,
        fullPage: false,
      });
    });
  }
});

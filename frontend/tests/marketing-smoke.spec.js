import { test, expect } from '@playwright/test';

test('landing page renders the Prymal marketing shell', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  const hasBrand = await page.getByText(/PRYMAL/i).first().isVisible({ timeout: 10_000 }).catch(() => false);
  const hasSetupGuard = await page.getByText(/VITE_CLERK_PUBLISHABLE_KEY/i).first().isVisible({ timeout: 3_000 }).catch(() => false);

  expect(hasBrand || hasSetupGuard).toBe(true);
});

test('pricing page renders shell content', async ({ page }) => {
  await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  const hasPricing = await page.getByText(/price|plan|£|\$/i).first().isVisible({ timeout: 8_000 }).catch(() => false);
  const hasSetupGuard = await page.getByText(/VITE_CLERK_PUBLISHABLE_KEY/i).first().isVisible({ timeout: 2_000 }).catch(() => false);
  expect(hasPricing || hasSetupGuard).toBe(true);
});

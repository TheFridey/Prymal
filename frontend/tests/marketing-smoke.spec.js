import { test, expect } from '@playwright/test';

test('landing page renders the Prymal marketing shell', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  const hasBrand = await page.getByText(/PRYMAL/i).first().isVisible({ timeout: 10_000 }).catch(() => false);
  const hasSetupGuard = await page.getByText(/VITE_CLERK_PUBLISHABLE_KEY/i).first().isVisible({ timeout: 3_000 }).catch(() => false);

  expect(hasBrand || hasSetupGuard).toBe(true);
});

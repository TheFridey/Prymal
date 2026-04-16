import { test, expect } from '@playwright/test';

test('landing page renders the Prymal marketing shell', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page.getByText(/PRYMAL/i).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('link', { name: /login/i }).first()).toBeVisible({ timeout: 10_000 });
});

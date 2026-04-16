import { test, expect } from '@playwright/test';

test('landing page renders the Prymal marketing shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: /^PRYMAL$/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Run your business like a primal operating system/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /login/i })).toBeVisible();
});

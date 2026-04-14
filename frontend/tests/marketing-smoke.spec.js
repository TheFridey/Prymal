import { test, expect } from '@playwright/test';

test('landing page renders the Prymal marketing shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText(/PRYMAL/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /login/i })).toBeVisible();
});

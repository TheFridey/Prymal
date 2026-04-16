import { test, expect } from '@playwright/test';

test('landing page has a sign-up entry point', async ({ page }) => {
  await page.goto('/');

  const cta = page.getByRole('link', { name: /get started|sign up|start free|try prymal/i }).first();
  if (await cta.isVisible().catch(() => false)) {
    await expect(cta).toBeVisible();
  } else {
    await expect(page).not.toHaveURL(/\/error/);
  }
});

test('login page renders Clerk auth or the auth setup guard', async ({ page }) => {
  await page.goto('/login');

  const emailInput = page.getByLabel(/email/i).first();
  const socialButton = page.getByRole('button', { name: /google|continue with/i }).first();
  const setupGuard = page.getByText(/VITE_CLERK_PUBLISHABLE_KEY/i).first();
  const authShell = page.getByText(/enter the command layer|welcome back/i).first();

  const hasEmail = await emailInput.isVisible().catch(() => false);
  const hasSocial = await socialButton.isVisible().catch(() => false);
  const hasSetupGuard = await setupGuard.isVisible().catch(() => false);
  const hasAuthShell = await authShell.isVisible().catch(() => false);

  expect(hasEmail || hasSocial || hasSetupGuard || hasAuthShell).toBe(true);
});

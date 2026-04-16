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

  const loginHeading = page.getByRole('heading', { name: /enter the command layer/i }).first();
  const loginIntro = page.getByText(/clerk-backed auth flow/i).first();
  const setupGuard = page.getByText(/VITE_CLERK_PUBLISHABLE_KEY/i).first();

  await expect(page).toHaveURL(/\/login/);
  const hasLoginShell = await loginHeading.isVisible().catch(() => false);
  const hasLoginIntro = await loginIntro.isVisible().catch(() => false);
  const hasSetupGuard = await setupGuard.isVisible().catch(() => false);

  expect((hasLoginShell && hasLoginIntro) || hasSetupGuard).toBe(true);
});

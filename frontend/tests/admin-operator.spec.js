import { test, expect } from '@playwright/test';
import { signInAsStaff, skipIfNoStaffCredentials } from './helpers/auth';

test.describe('Admin operator flows', () => {
  test.beforeEach(() => skipIfNoStaffCredentials(test));

  test('admin shell loads for staff users', async ({ page }) => {
    await signInAsStaff(page);
    await page.goto('/app/admin');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/Overview|Control plane|Staff admin/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('trace center renders and opens a trace detail drawer when data exists', async ({ page }) => {
    await signInAsStaff(page);
    await page.goto('/app/admin');
    await page.getByRole('button', { name: /^Traces$/i }).click();
    await expect(page.getByText(/Trace center/i).first()).toBeVisible({ timeout: 10_000 });

    const inspectButton = page.getByRole('button', { name: /Inspect|Open trace/i }).first();
    if (await inspectButton.isVisible().catch(() => false)) {
      await inspectButton.click();
      await expect(page.getByText(/Trace detail/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('scorecards and model policy tabs expose governance analytics', async ({ page }) => {
    await signInAsStaff(page);
    await page.goto('/app/admin');

    await page.getByRole('button', { name: /^Scorecards$/i }).click();
    await expect(page.getByText(/Agent enforcement scorecards|Governance summary/i).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /^Model Policy$/i }).click();
    await expect(page.getByText(/Active provider lanes|Provider posture|Gemini/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

import { test, expect } from '@playwright/test';
import { authStatePath, getCredentials, signInWith, skipIfMissingCredentials } from './helpers/auth';

test.describe('Admin operator regressions', () => {
  test('staff sign-in lands in the admin console', async ({ page }) => {
    skipIfMissingCredentials(test, ['staff']);

    await signInWith(page, {
      ...getCredentials('staff'),
      destination: '/app/admin',
    });

    await expect(page).toHaveURL(/\/app\/admin/);
    await expect(page.getByText(/staff admin|overview|control plane/i).first()).toBeVisible();
  });
});

test.describe('Runtime drilldown and held-output visibility', () => {
  test.use({ storageState: authStatePath('staff') });
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(() => {
    skipIfMissingCredentials(test, ['staff']);
  });

  test('trace center drilldown exposes execution, retrieval, and memory context', async ({ page }) => {
    await page.goto('/app/admin');
    await page.getByRole('button', { name: /^Traces$/i }).click();
    await expect(page.getByText(/trace center/i).first()).toBeVisible();

    const inspectButton = page.getByRole('button', { name: /^Inspect$/i }).first();
    await expect(inspectButton).toBeVisible({ timeout: 15_000 });
    await inspectButton.click();

    await expect(page.getByText(/trace detail/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/execution summary|retrieval diagnostics|runtime touches/i).first()).toBeVisible();
  });

  test('held traces surface SENTINEL reasoning clearly', async ({ page }) => {
    await page.goto('/app/admin');
    await page.getByRole('button', { name: /^Traces$/i }).click();
    await expect(page.getByText(/trace center/i).first()).toBeVisible();

    await page.getByLabel(/outcome/i).selectOption('held');
    const inspectButton = page.getByRole('button', { name: /^Inspect$/i }).first();
    await expect(inspectButton).toBeVisible({ timeout: 15_000 });
    await inspectButton.click();

    await expect(page.getByText(/sentinel hold|sentinel review|held/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/repair and fallback loop|safety and repair/i).first()).toBeVisible();
  });
});

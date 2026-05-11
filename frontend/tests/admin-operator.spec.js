import { test, expect } from '@playwright/test';
import { authStatePath, skipIfMissingCredentials } from './helpers/auth';

test.describe('Admin operator regressions', () => {
  test.use({ storageState: authStatePath('staff') });

  test('staff sign-in lands in the admin console', async ({ page }) => {
    skipIfMissingCredentials(test, ['staff']);

    await page.goto('/app/admin');
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
    await page.getByLabel(/open admin section/i).selectOption('traces');
    await expect(page.getByText(/trace center/i).first()).toBeVisible();

    const inspectButton = page.getByRole('button', { name: /^Inspect$/i }).first();
    await expect(inspectButton).toBeVisible({ timeout: 15_000 });
    await inspectButton.click();

    await expect(page.getByText(/trace detail/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/execution summary|retrieval diagnostics|runtime touches/i).first()).toBeVisible();
  });

  test('held traces surface SENTINEL reasoning clearly', async ({ page }) => {
    await page.goto('/app/admin');
    await page.getByLabel(/open admin section/i).selectOption('traces');
    await expect(page.getByText(/trace center/i).first()).toBeVisible();

    await page.getByLabel(/outcome/i).selectOption('held');
    const inspectButton = page.getByRole('button', { name: /^Inspect$/i }).first();
    await expect(inspectButton).toBeVisible({ timeout: 15_000 });
    await inspectButton.click();

    const detailDrawer = page.getByRole('complementary');
    await expect(detailDrawer.getByText(/SENTINEL HOLD|SENTINEL review/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(detailDrawer.getByText(/repair and fallback loop|safety and repair/i).first()).toBeVisible();
  });

  test('WARDEN and billing evidence tabs load with seeded dev data', async ({ page }) => {
    await page.goto('/app/admin');

    const sectionSelect = page.getByLabel(/open admin section/i);

    await sectionSelect.selectOption('warden-events');
    await expect(page.getByText(/WARDEN events/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/BLOCK|REQUIRE_CONFIRMATION|ALLOW_WITH_SANDBOX/i).first()).toBeVisible({ timeout: 15_000 });

    await sectionSelect.selectOption('credit-usage');
    await expect(page.getByText(/Credit usage/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Local QA Workspace|credits/i).first()).toBeVisible({ timeout: 15_000 });

    await sectionSelect.selectOption('product-events');
    await expect(page.getByText(/Product events/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/billing\.execution_(reserved|committed|released)/i).first()).toBeVisible({ timeout: 15_000 });
  });
});

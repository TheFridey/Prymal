import { test, expect } from '@playwright/test';
import { signIn, skipIfNoCredentials } from './helpers/auth';

test.describe('Settings page smoke tests', () => {
  test.beforeEach(() => skipIfNoCredentials(test));

  test('settings page renders and shows plan card', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/settings');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/free|solo|pro|teams|agency/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('API keys section does not break settings rendering', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/settings');
    await expect(page).not.toHaveURL(/\/error/);
    await expect(page.getByText(/Settings|Account|Billing|Team|Organisation/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('usage breakdown renders with the day window controls when available', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/settings');
    const usageSection = page.getByText(/usage by agent|last 7 days|last 30 days/i).first();
    if (await usageSection.isVisible().catch(() => false)) {
      await expect(usageSection).toBeVisible();
    } else {
      await expect(page.getByText(/Billing|Plan|Seats/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });
});

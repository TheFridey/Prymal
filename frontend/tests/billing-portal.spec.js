import { test, expect } from '@playwright/test';
import { authStatePath, skipIfMissingCredentials } from './helpers/auth';

test.describe('Billing upgrade and Stripe portal', () => {
  test.beforeEach(() => {
    skipIfMissingCredentials(test, ['user', 'billing']);
  });

  test('an owner can start a Stripe checkout upgrade flow', async ({ browser }) => {
    const context = await browser.newContext({ storageState: authStatePath('user') });

    try {
      const page = await context.newPage();
      await page.goto('/app/settings');
      await page.getByTestId('settings-tab-billing').click();

      const checkoutResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'POST'
        && /\/api\/billing\/checkout$/.test(response.url()),
      );

      await page.locator('[data-testid^="billing-upgrade-"]').first().click();

      const checkoutResponse = await checkoutResponsePromise;
      expect(checkoutResponse.status()).toBe(200);
      await page.waitForURL(/stripe\.com/i, { timeout: 20_000 });
    } finally {
      await context.close();
    }
  });

  test('a paid staging account can open the Stripe billing portal', async ({ browser }) => {
    const context = await browser.newContext({ storageState: authStatePath('billing') });

    try {
      const page = await context.newPage();
      await page.goto('/app/settings');
      await page.getByTestId('settings-tab-billing').click();
      await expect(page.getByTestId('billing-open-portal')).toBeVisible();

      const portalResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'POST'
        && /\/api\/billing\/portal$/.test(response.url()),
      );

      await page.getByTestId('billing-open-portal').click();

      const portalResponse = await portalResponsePromise;
      expect(portalResponse.status()).toBe(200);
      await page.waitForURL(/billing\.stripe\.com/i, { timeout: 20_000 });
    } finally {
      await context.close();
    }
  });
});

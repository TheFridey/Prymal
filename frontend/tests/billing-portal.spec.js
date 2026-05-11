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
      let checkoutCalls = 0;
      await page.route('**/api/billing/checkout', async (route) => {
        checkoutCalls += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: '/app/settings?billing=dev_checkout_mock' }),
        });
      });

      await page.goto('/app/settings');
      await page.getByTestId('settings-tab-billing').click();

      const checkoutResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'POST'
        && /\/api\/billing\/checkout$/.test(response.url()),
      );

      await page.locator('[data-testid^="billing-upgrade-"]').first().click();

      const checkoutResponse = await checkoutResponsePromise;
      expect(checkoutResponse.status()).toBe(200);
      await page.waitForURL(/\/app\/settings\?billing=dev_checkout_mock/i, { timeout: 20_000 });
      expect(checkoutCalls).toBe(1);
    } finally {
      await context.close();
    }
  });

  test('a paid local QA account can open the billing portal path safely', async ({ browser }) => {
    const context = await browser.newContext({ storageState: authStatePath('billing') });

    try {
      const page = await context.newPage();
      let portalCalls = 0;
      await page.route('**/api/billing/portal', async (route) => {
        portalCalls += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: '/app/settings?billing=dev_portal_mock' }),
        });
      });

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
      await page.waitForURL(/\/app\/settings\?billing=dev_portal_mock/i, { timeout: 20_000 });
      expect(portalCalls).toBe(1);
    } finally {
      await context.close();
    }
  });
});

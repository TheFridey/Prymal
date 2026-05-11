import { test, expect } from '@playwright/test';
import { authStatePath, skipIfMissingCredentials } from './helpers/auth';

test.describe('Billing upgrade flow', () => {
  test.use({ storageState: authStatePath('user') });

  test.beforeEach(() => {
    skipIfMissingCredentials(test, ['user']);
  });

  test('an owner can start a Stripe checkout upgrade flow', async ({ page }) => {
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
    await expect(page.getByTestId('settings-tab-billing')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('settings-tab-billing').click();

    const checkoutResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && /\/api\/billing\/checkout$/.test(response.url()),
    );

    await expect(page.locator('[data-testid^="billing-upgrade-"]').first()).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-testid^="billing-upgrade-"]').first().click();

    const checkoutResponse = await checkoutResponsePromise;
    expect(checkoutResponse.status()).toBe(200);
    await page.waitForURL(/\/app\/settings\?billing=dev_checkout_mock/i, { timeout: 20_000 });
    expect(checkoutCalls).toBe(1);
  });
});

test.describe('Billing portal flow', () => {
  test.use({ storageState: authStatePath('billing') });

  test.beforeEach(() => {
    skipIfMissingCredentials(test, ['billing']);
  });

  test('a paid local QA account can open the billing portal path safely', async ({ page }) => {
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
    await expect(page.getByTestId('settings-tab-billing')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('settings-tab-billing').click();
    await expect(page.getByTestId('billing-open-portal')).toBeVisible({ timeout: 20_000 });

    const portalResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && /\/api\/billing\/portal$/.test(response.url()),
    );

    await page.getByTestId('billing-open-portal').click();

    const portalResponse = await portalResponsePromise;
    expect(portalResponse.status()).toBe(200);
    await page.waitForURL(/\/app\/settings\?billing=dev_portal_mock/i, { timeout: 20_000 });
    expect(portalCalls).toBe(1);
  });
});

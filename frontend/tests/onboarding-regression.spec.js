import { test, expect } from '@playwright/test';
import { getCredentials, signInWith, skipIfMissingCredentials, uniqueSuffix } from './helpers/auth';

test.describe('Onboarding completion', () => {
  test('a staging onboarding user can complete workspace setup', async ({ page }) => {
    skipIfMissingCredentials(test, ['onboarding']);

    await signInWith(page, {
      ...getCredentials('onboarding'),
      destination: '/app/onboarding',
    });

    await expect(page).toHaveURL(/\/app\/onboarding/);

    const orgName = `Prymal E2E ${uniqueSuffix('onboard')}`;
    await page.getByTestId('onboarding-org-name').fill(orgName);
    await page.getByTestId('onboarding-next').click();
    await page.getByTestId('onboarding-submit').click();

    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 20_000 });
    await expect(page.getByText(/recommended first agent|dashboard|workspace/i).first()).toBeVisible();
  });
});

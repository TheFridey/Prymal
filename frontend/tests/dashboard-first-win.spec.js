import { test, expect } from '@playwright/test';
import { authStatePath, skipIfMissingCredentials } from './helpers/auth';

test.describe('Dashboard first-win copy', () => {
  test.use({ storageState: authStatePath('user') });
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(() => {
    skipIfMissingCredentials(test, ['user']);
  });

  test('shows command-centre quick actions and first-session guidance', async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page.locator('.pm-dash__command')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.pm-dash__quick-grid')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Quick actions' })).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(/Get your first win|Choose your first outcome|What do you want Prymal to help with today/i),
    ).toBeVisible({ timeout: 20_000 });
  });
});

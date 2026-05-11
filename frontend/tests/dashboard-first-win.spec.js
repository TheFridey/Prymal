import { test, expect } from '@playwright/test';
import { authStatePath, skipIfMissingCredentials } from './helpers/auth';

test.describe('Dashboard first-win copy', () => {
  test.use({ storageState: authStatePath('user') });
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(() => {
    skipIfMissingCredentials(test, ['user']);
  });

  test('shows first-session guidance or resume state with demo playbooks', async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page.getByText(/Get your first win|Continue where you left off/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Demo playbooks')).toBeVisible({ timeout: 20_000 });
  });
});

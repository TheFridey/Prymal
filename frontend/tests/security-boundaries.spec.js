import { test, expect } from '@playwright/test';
import { apiUrl, authFetch, authStatePath, skipIfMissingCredentials } from './helpers/auth';

test.describe('Authenticated security boundaries', () => {
  test.use({ storageState: authStatePath('user') });

  test.beforeEach(() => {
    skipIfMissingCredentials(test, ['user']);
  });

  test('non-staff workspace users cannot read staff admin API routes', async ({ page }) => {
    await page.goto('/app/dashboard');

    const response = await authFetch(page, apiUrl('/admin/revenue'));

    expect(response.status).toBe(403);
    expect(response.data?.code).toBe('STAFF_ONLY');
  });
});

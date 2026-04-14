import { test, expect } from '@playwright/test';
import { signIn, skipIfNoCredentials } from './helpers/auth';

test.describe('Workspace smoke tests', () => {
  test.beforeEach(() => skipIfNoCredentials(test));

  test('workspace shell loads after sign-in', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/agents/cipher');
    await expect(page.locator('.workspace-studio, [data-testid="workspace"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('agent sidebar renders at least one agent', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/agents/cipher');
    await expect(page.locator('.workspace-studio__sidebar').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.workspace-studio__agent-pill').first()).toBeVisible({ timeout: 10_000 });
  });

  test('LORE workspace renders document inventory or empty state', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/lore');
    await expect(page.getByText(/Document inventory|LORE is empty|Knowledge that the agents can actually retrieve/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('Workflows workspace renders workflow list or empty state', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/workflows');
    await expect(page.getByText(/Workspace workflows|No workflows yet|Workflow execution and operational oversight/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('SENTINEL hold route stays inside the authenticated app shell', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/agents/sentinel');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('.workspace-studio').first()).toBeVisible({ timeout: 10_000 });
  });
});

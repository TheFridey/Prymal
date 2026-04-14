import { test, expect } from '@playwright/test';
import { signIn, skipIfNoCredentials } from './helpers/auth';

test.describe('Authenticated app core flows', () => {
  test.beforeEach(() => skipIfNoCredentials(test));

  test('onboarding route stays inside the authenticated app', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/onboarding');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.getByText(/First-win onboarding|Workspace|Get from signup to your first useful AI output|dashboard/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('team settings exposes invite and seat controls', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/settings');
    await page.getByRole('button', { name: /^Team$/i }).click();
    await expect(
      page.getByText(/Invite teammates|Seat usage|Members|Invitations/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('organisation settings exposes routing controls and provider guidance', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/settings');
    await page.getByRole('button', { name: /^Organisation$/i }).click();
    await expect(page.getByText(/AI routing controls/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Anthropic|OpenAI|Gemini/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('workflow workspace opens the builder shell', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/workflows');
    await page.getByRole('button', { name: /Open workflow builder/i }).click();
    await expect(page.getByText(/Workflow builder/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('lore workspace renders inventory and ingest surfaces', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/lore');
    await expect(
      page.getByText(/Document inventory|Add knowledge|Search LORE|Knowledge that the agents can actually retrieve/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

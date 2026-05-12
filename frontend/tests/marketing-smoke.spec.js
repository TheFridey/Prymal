import { test, expect } from '@playwright/test';

test('landing page renders the Prymal marketing shell', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();

  const hasBrand = await page.getByText(/PRYMAL/i).first().isVisible({ timeout: 10_000 }).catch(() => false);
  const hasSetupGuard = await page.getByText(/VITE_CLERK_PUBLISHABLE_KEY/i).first().isVisible({ timeout: 3_000 }).catch(() => false);

  expect(hasBrand || hasSetupGuard).toBe(true);
  if (!hasSetupGuard) {
    await expect(page.getByRole('heading', { name: /See Prymal in action/i })).toBeVisible();
    await expect(page.getByText('Build me a 30-day content strategy')).toBeVisible();
    await expect(page.getByText('Full content calendar')).toBeVisible();
    await expect(page.getByText('Platform-specific posts')).toBeVisible();
    await expect(page.getByText('Audit my website')).toBeVisible();
    await expect(page.getByText('Actionable roadmap')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Try a guided task' })).toBeVisible();
  }
});

test('landing Simple Mode / Advanced Mode section is interactive on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const hasSetupGuard = await page.getByText(/VITE_CLERK_PUBLISHABLE_KEY/i).first().isVisible({ timeout: 2_000 }).catch(() => false);
  if (hasSetupGuard) {
    expect(hasSetupGuard).toBe(true);
    return;
  }

  await expect(page.getByRole('heading', { name: /Start simple\. Scale into the full system\./i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('tab', { name: 'Simple Mode' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Most popular starting point')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Generate a 30-day content plan/i })).toBeVisible();
  await page.getByRole('tab', { name: 'Advanced Mode' }).click();
  await expect(page.getByRole('heading', { name: /Scale into the full AI operating system/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Used for serious execution/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Build a workflow/i })).toBeVisible();
});

test('pricing page renders shell content', async ({ page }) => {
  await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('body')).toContainText(/Not all AI platforms are built the same|VITE_CLERK_PUBLISHABLE_KEY/i, {
    timeout: 8_000,
  });
});

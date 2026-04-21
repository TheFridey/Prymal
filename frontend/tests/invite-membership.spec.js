import { test, expect } from '@playwright/test';
import { authStatePath, getCredentials, skipIfMissingCredentials } from './helpers/auth';

test.describe('Team invite and membership flow', () => {
  test.use({ storageState: authStatePath('user') });
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(() => {
    skipIfMissingCredentials(test, ['user', 'invitee']);
  });

  test('owners can invite a teammate and the invitee can join the workspace', async ({ page, browser }) => {
    const inviteeEmail = getCredentials('invitee').email;

    await page.goto('/app/settings');
    await page.getByTestId('settings-tab-team').click();
    await expect(page.getByText(/invite teammates|seat usage|members/i).first()).toBeVisible();

    const memberPanel = page.locator('.surface-card').filter({ has: page.getByText(/^Members$/) }).first();
    const invitationPanel = page.locator('.surface-card').filter({ has: page.getByText(/^Invitations$/) }).first();

    const existingMemberRow = memberPanel.locator('div').filter({ hasText: inviteeEmail }).first();
    if (await existingMemberRow.isVisible().catch(() => false)) {
      await existingMemberRow.getByRole('button', { name: /remove/i }).click();
      await expect(memberPanel.locator('div').filter({ hasText: inviteeEmail })).toHaveCount(0, { timeout: 15_000 });
    }

    const pendingInviteRow = invitationPanel.locator('div').filter({ hasText: inviteeEmail }).first();
    if (await pendingInviteRow.isVisible().catch(() => false)) {
      const revokeButton = pendingInviteRow.getByRole('button', { name: /revoke/i });
      if (await revokeButton.isVisible().catch(() => false)) {
        await revokeButton.click();
        await expect(invitationPanel.locator('div').filter({ hasText: inviteeEmail })).toHaveCount(0, { timeout: 15_000 });
      }
    }

    const inviteResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && /\/api\/auth\/team\/invitations$/.test(response.url()),
    );

    await page.getByTestId('team-invite-email').fill(inviteeEmail);
    await page.getByTestId('team-invite-role').selectOption('member');
    await page.getByTestId('team-invite-submit').click();

    const inviteResponse = await inviteResponsePromise;
    let inviteResult = await inviteResponse.json();

    if (inviteResponse.status() === 409) {
      const resendResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'POST'
        && /\/api\/auth\/team\/invitations\/.+\/resend$/.test(response.url()),
      );

      await invitationPanel.locator('div').filter({ hasText: inviteeEmail }).getByRole('button', { name: /resend/i }).first().click();
      const resendResponse = await resendResponsePromise;
      expect(resendResponse.status()).toBe(200);
      inviteResult = await resendResponse.json();
    } else {
      expect(inviteResponse.status()).toBe(201);
    }

    expect(inviteResult.inviteUrl).toBeTruthy();

    const inviteeContext = await browser.newContext({ storageState: authStatePath('invitee') });

    try {
      const inviteePage = await inviteeContext.newPage();
      await inviteePage.goto(inviteResult.inviteUrl);

      await expect(inviteePage).toHaveURL(/\/app\/onboarding/);
      await expect(inviteePage.getByText(/accept invitation|join the prymal workspace/i).first()).toBeVisible();
      await inviteePage.getByTestId('onboarding-submit').click();

      await expect(inviteePage).toHaveURL(/\/app\/dashboard/, { timeout: 20_000 });
    } finally {
      await inviteeContext.close();
    }

    await page.reload();
    await page.getByTestId('settings-tab-team').click();
    await expect(memberPanel.locator('div').filter({ hasText: inviteeEmail }).first()).toBeVisible({ timeout: 20_000 });
  });
});

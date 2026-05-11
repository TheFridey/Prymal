import { test, expect } from '@playwright/test';
import { apiUrl, authFetch, authStatePath, getCredentials, skipIfMissingCredentials } from './helpers/auth';

test.describe('Team invite and membership flow', () => {
  test.use({ storageState: authStatePath('user') });
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(() => {
    skipIfMissingCredentials(test, ['user', 'invitee']);
  });

  test('owners can invite a teammate and the invitee can join the workspace', async ({ page, browser }) => {
    const inviteeEmail = getCredentials('invitee').email;

    await page.goto('/app/settings');

    const initialTeamState = await authFetch(page, apiUrl('/auth/team'));
    expect(initialTeamState.status).toBe(200);

    const existingMember = (initialTeamState.data?.members ?? []).find((member) =>
      member.email === inviteeEmail && !member.isCurrentUser,
    );
    if (existingMember?.id) {
      const removeMember = await authFetch(page, apiUrl(`/auth/team/members/${existingMember.id}`), {
        method: 'DELETE',
      });
      expect(removeMember.status).toBe(200);
    }

    const existingInvitation = (initialTeamState.data?.invitations ?? []).find((invitation) =>
      invitation.email === inviteeEmail && invitation.status === 'pending',
    );
    if (existingInvitation?.id) {
      const revokeInvitation = await authFetch(page, apiUrl(`/auth/team/invitations/${existingInvitation.id}`), {
        method: 'DELETE',
      });
      expect(revokeInvitation.status).toBe(200);
    }

    if (existingMember?.id || existingInvitation?.id) {
      await page.reload();
    }

    await page.getByTestId('settings-tab-team').click();
    await expect(page.getByText(/invite teammates|seat usage|members/i).first()).toBeVisible();

    const memberPanel = page.locator('.surface-card').filter({ has: page.getByText(/^Members$/) }).first();

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
      const teamResponse = await authFetch(page, apiUrl('/auth/team'));
      expect(teamResponse.status).toBe(200);

      const existingInvite = (teamResponse.data?.invitations ?? []).find((invitation) =>
        invitation.email === inviteeEmail && invitation.status === 'pending',
      );
      if (!existingInvite?.id) {
        throw new Error(`Invite returned 409 without a pending invitation for ${inviteeEmail}. Latest error: ${inviteResult?.error ?? 'unknown'}`);
      }

      const resendResponse = await authFetch(page, apiUrl(`/auth/team/invitations/${existingInvite.id}/resend`), {
        method: 'POST',
      });
      expect(resendResponse.status).toBe(200);
      inviteResult = resendResponse.data;
    } else {
      expect(inviteResponse.status()).toBe(201);
    }

    expect(inviteResult.inviteUrl).toBeTruthy();
    const inviteUrl = normalizeInviteUrlForLocalDev(inviteResult.inviteUrl, page.url());

    const inviteeContext = await browser.newContext({ storageState: authStatePath('invitee') });

    try {
      const inviteePage = await inviteeContext.newPage();
      await inviteePage.goto(inviteUrl);

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

function normalizeInviteUrlForLocalDev(inviteUrl, currentPageUrl) {
  const target = new URL(inviteUrl);
  const configuredBaseUrl = String(process.env.PLAYWRIGHT_BASE_URL ?? '').trim();
  const fallbackBaseUrl = currentPageUrl ? new URL(currentPageUrl).origin : '';
  const preferredBaseUrl = configuredBaseUrl || fallbackBaseUrl;

  if (!preferredBaseUrl) {
    return target.toString();
  }

  const preferred = new URL(preferredBaseUrl);
  const isLocalInviteHost = ['localhost', '127.0.0.1'].includes(target.hostname);
  const isDifferentLocalOrigin = target.origin !== preferred.origin;

  if (isLocalInviteHost && isDifferentLocalOrigin) {
    target.protocol = preferred.protocol;
    target.host = preferred.host;
  }

  return target.toString();
}

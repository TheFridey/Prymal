import {
  sendEmail,
  sendDay3Email,
  sendDay7Email,
  sendFeedbackReplyEmail,
  sendFounderAccessEmail,
  sendLoreStarterEmail,
  sendPaymentFailedEmail,
  sendSubscriptionStartedEmail,
  sendSubscriptionUpdatedEmail,
  sendTeamInviteEmail,
  sendUsageCapEmail,
  sendWelcomeEmail,
  sendWorkflowCatalogueEmail,
  sendWorkflowInstalledEmail,
  sendWorkflowRunFailedEmail,
  sendWorkspaceAlertEmail,
  sendBillingReceiptEmail,
  sendCreditsLowEmail,
} from './email/email-service.js';
import { getEmailAppUrl, paragraph, renderEmailLayout } from './email/email-layout.js';

export {
  sendBillingReceiptEmail,
  sendCreditsLowEmail,
  sendDay3Email,
  sendDay7Email,
  sendFeedbackReplyEmail,
  sendFounderAccessEmail,
  sendLoreStarterEmail,
  sendPaymentFailedEmail,
  sendSubscriptionStartedEmail,
  sendSubscriptionUpdatedEmail,
  sendTeamInviteEmail,
  sendUsageCapEmail,
  sendWelcomeEmail,
  sendWorkflowCatalogueEmail,
  sendWorkflowInstalledEmail,
  sendWorkflowRunFailedEmail,
  sendWorkspaceAlertEmail,
  sendEmail,
};

export async function sendInvitationEmail({ to, organisationName, inviterName, inviteUrl, role, expiresAt, inviteId, orgId, userId }) {
  const result = await sendTeamInviteEmail(to, {
    workspaceName: organisationName,
    inviterName,
    inviteUrl,
    role,
    expiresAt,
    inviteId,
  }, {
    orgId,
    userId,
  });

  return {
    delivered: result.ok,
    provider: result.provider ?? 'resend',
    fallback: result.skipped,
    emailId: result.providerMessageId ?? result.event?.providerMessageId ?? null,
    error: result.error ?? null,
  };
}

export async function sendWaitlistConfirmationEmail(to) {
  const appUrl = getEmailAppUrl();
  const bodyText = [
    "You're on the Prymal waitlist.",
    '',
    'Thanks for signing up. We will let you know when Prymal is ready for you.',
    '',
    `Visit Prymal: ${appUrl}`,
  ].join('\n');
  const rendered = renderEmailLayout({
    title: "You're on the Prymal waitlist",
    previewText: 'Thanks for signing up. We will let you know when Prymal is ready for you.',
    bodyHtml: [
      paragraph('Thanks for signing up. We will let you know when Prymal is ready for you.'),
      paragraph('Prymal is an AI operating system for business execution, built around agents, LORE memory and workflows.'),
    ].join(''),
    bodyText,
    cta: { label: 'Visit Prymal', url: appUrl },
    footerNote: 'You received this because you signed up for the Prymal waitlist.',
  });

  const result = await sendEmail({
    to,
    subject: "You're on the Prymal waitlist",
    html: rendered.html,
    text: rendered.text,
    emailType: 'waitlist_confirmation',
    idempotencyKey: `waitlist-confirmation:${String(to ?? '').toLowerCase()}`,
  });

  return {
    delivered: result.ok,
    provider: result.provider ?? 'resend',
    fallback: result.skipped,
    emailId: result.providerMessageId ?? result.event?.providerMessageId ?? null,
    error: result.error ?? null,
  };
}

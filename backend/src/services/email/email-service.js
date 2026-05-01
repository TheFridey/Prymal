import { renderTemplate } from './email-copy.js';
import { findEmailEventByIdempotencyKey, recordEmailEvent } from './email-events.js';
import { sendViaResend } from './resend-client.js';

export function buildEmailIdempotencyKey(type, parts = []) {
  return [type, ...parts.filter(Boolean)].join(':');
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  tags = [],
  metadata = {},
  userId = null,
  orgId = null,
  emailType = 'transactional',
  idempotencyKey = null,
  dbClient,
  fetchImpl,
}) {
  const recipient = String(to ?? '').trim().toLowerCase();
  if (!recipient) {
    const event = await recordEmailEvent({
      userId,
      orgId,
      recipient: 'missing',
      emailType,
      provider: 'none',
      status: 'skipped',
      idempotencyKey,
      metadata: { ...metadata, reason: 'missing_recipient' },
      dbClient,
    }).catch(() => null);
    return { ok: false, skipped: true, reason: 'missing_recipient', event };
  }

  try {
    if (idempotencyKey) {
      const existing = await findEmailEventByIdempotencyKey(idempotencyKey, { dbClient }).catch((error) => {
        console.warn('[EMAIL] Failed to check email idempotency:', error.message);
        return null;
      });
      if (existing?.status === 'sent' || existing?.status === 'skipped') {
        return { ok: existing.status === 'sent', skipped: true, idempotent: true, event: existing };
      }
    }

    const result = await sendViaResend({ to: recipient, subject, html, text, replyTo, tags, fetchImpl });

    const event = await recordEmailEvent({
      userId,
      orgId,
      recipient,
      emailType,
      provider: result.provider,
      providerMessageId: result.providerMessageId,
      status: result.skipped ? 'skipped' : 'sent',
      idempotencyKey,
      metadata,
      dbClient,
    }).catch((error) => {
      console.warn('[EMAIL] Failed to record email event:', error.message);
      return null;
    });

    return { ...result, event };
  } catch (error) {
    const event = await recordEmailEvent({
      userId,
      orgId,
      recipient,
      emailType,
      provider: 'resend',
      status: 'failed',
      idempotencyKey,
      metadata,
      error: error.message,
      dbClient,
    }).catch((recordError) => {
      console.warn('[EMAIL] Failed to record failed email event:', recordError.message);
      return null;
    });

    console.warn('[EMAIL] Send failed:', error.message);
    return { ok: false, skipped: false, error: error.message, event };
  }
}

export async function sendTransactionalEmail({ type, to, payload = {}, tags = [], metadata = {}, idempotencyKey, ...rest }) {
  const rendered = renderTemplate(type, payload);
  return sendEmail({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tags: [{ name: 'email_type', value: type }, ...tags],
    metadata,
    emailType: type,
    idempotencyKey,
    ...rest,
  });
}

export const sendWelcomeEmail = (to, payload = {}, options = {}) =>
  sendTransactionalEmail({
    type: 'welcome',
    to,
    payload,
    idempotencyKey: options.idempotencyKey || buildEmailIdempotencyKey('welcome', [options.orgId, options.userId]),
    metadata: payload,
    ...options,
  });

export const sendWorkflowCatalogueEmail = (to, payload = {}, options = {}) =>
  sendTransactionalEmail({ type: 'workflow-catalogue', to, payload, metadata: payload, ...options });

export const sendLoreStarterEmail = (to, payload = {}, options = {}) =>
  sendTransactionalEmail({ type: 'lore-starter', to, payload, metadata: payload, ...options });

export const sendTeamInviteEmail = (to, payload = {}, options = {}) =>
  sendTransactionalEmail({
    type: 'team-invite',
    to,
    payload,
    idempotencyKey: options.idempotencyKey || buildEmailIdempotencyKey('team-invite', [payload.inviteId]),
    metadata: { inviteId: payload.inviteId, workspaceName: payload.workspaceName },
    ...options,
  });

export const sendBillingReceiptEmail = (to, payload = {}, options = {}) =>
  sendTransactionalEmail({
    type: 'billing-receipt',
    to,
    payload,
    idempotencyKey: options.idempotencyKey || buildEmailIdempotencyKey('billing-receipt', [payload.invoiceId || payload.paymentId]),
    metadata: payload,
    ...options,
  });

export const sendSubscriptionStartedEmail = (to, payload = {}, options = {}) =>
  sendTransactionalEmail({
    type: 'subscription-started',
    to,
    payload,
    idempotencyKey: options.idempotencyKey || buildEmailIdempotencyKey('subscription-started', [payload.subscriptionId || payload.checkoutSessionId || options.orgId]),
    metadata: payload,
    ...options,
  });

export const sendSubscriptionUpdatedEmail = (to, payload = {}, options = {}) =>
  sendTransactionalEmail({
    type: 'subscription-updated',
    to,
    payload,
    idempotencyKey: options.idempotencyKey || buildEmailIdempotencyKey('subscription-updated', [payload.subscriptionId, payload.effectiveDate]),
    metadata: payload,
    ...options,
  });

export const sendPaymentFailedEmail = (to, payload = {}, options = {}) =>
  sendTransactionalEmail({
    type: 'payment-failed',
    to,
    payload,
    idempotencyKey: options.idempotencyKey || buildEmailIdempotencyKey('payment-failed', [payload.invoiceId || payload.paymentIntentId]),
    metadata: payload,
    ...options,
  });

export const sendCreditsLowEmail = (to, payload = {}, options = {}) =>
  sendTransactionalEmail({
    type: 'credits-low',
    to,
    payload,
    idempotencyKey: options.idempotencyKey || buildEmailIdempotencyKey('credits-low', [options.orgId, payload.thresholdPercent, payload.billingPeriodKey]),
    metadata: payload,
    ...options,
  });

export const sendUsageCapEmail = (to, payload = {}, options = {}) =>
  sendTransactionalEmail({
    type: 'usage-cap',
    to,
    payload,
    idempotencyKey: options.idempotencyKey || buildEmailIdempotencyKey('usage-cap', [options.orgId, payload.capState, payload.billingPeriodKey]),
    metadata: payload,
    ...options,
  });

export const sendWorkflowInstalledEmail = (to, payload = {}, options = {}) =>
  sendTransactionalEmail({
    type: 'workflow-installed',
    to,
    payload,
    idempotencyKey: options.idempotencyKey || buildEmailIdempotencyKey('workflow-installed', [payload.installedWorkflowId || payload.workflowId]),
    metadata: payload,
    ...options,
  });

export const sendWorkflowRunFailedEmail = (to, payload = {}, options = {}) =>
  sendTransactionalEmail({
    type: 'workflow-run-failed',
    to,
    payload,
    idempotencyKey: options.idempotencyKey || buildEmailIdempotencyKey('workflow-run-failed', [payload.workflowRunId]),
    metadata: payload,
    ...options,
  });

export const sendFounderAccessEmail = (to, payload = {}, options = {}) =>
  sendTransactionalEmail({
    type: 'founder-access',
    to,
    payload,
    idempotencyKey: options.idempotencyKey || buildEmailIdempotencyKey('founder-access', [options.orgId, payload.claimId || payload.subscriptionId]),
    metadata: payload,
    ...options,
  });

export const sendFeedbackReplyEmail = (to, payload = {}, options = {}) =>
  sendTransactionalEmail({ type: 'feedback-reply', to, payload, metadata: payload, ...options });

export const sendWorkspaceAlertEmail = (to, payload = {}, options = {}) =>
  sendTransactionalEmail({
    type: 'workspace-alert',
    to,
    payload,
    idempotencyKey: options.idempotencyKey || buildEmailIdempotencyKey('workspace-alert', [options.orgId, payload.eventId || payload.eventName, payload.occurredAt]),
    metadata: payload,
    ...options,
  });

export const sendDay3Email = sendLoreStarterEmail;
export const sendDay7Email = sendWorkflowCatalogueEmail;

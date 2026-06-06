/**
 * Gmail send action.
 * Requires an active Gmail OAuth integration on the org.
 */
import { getOAuthToken } from './oauth-tokens.js';
import { recordProductEvent } from '../telemetry.js';

/**
 * Send an email via Gmail API.
 * @param {object} payload - { to, subject, body, replyTo?, cc?, attachments? }
 * @param {object} context - { orgId, userId, workflowId? }
 * @returns {{ messageId, threadId, timestamp }}
 */
export async function sendEmail(payload, context) {
  const { to, subject, body, replyTo, cc } = payload;
  const { orgId, userId, workflowId } = context;

  if (!subject?.trim() || !body?.trim()) {
    const error = new Error('Email subject and body are required.');
    error.code = 'EMAIL_PAYLOAD_INVALID';
    throw error;
  }

  const accessToken = await getOAuthToken(orgId, 'gmail');

  const rawMessage = buildRawMessage({ to, subject, body, replyTo, cc });

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: rawMessage }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData?.error?.message ?? `Gmail API error: ${response.status}`);
    error.code = 'GMAIL_API_ERROR';
    throw error;
  }

  const data = await response.json();

  await recordProductEvent({
    orgId,
    userId,
    eventName: 'action_executed',
    metadata: {
      actionType: 'email.send',
      workflowId,
      messageId: data.id,
    },
  }).catch(() => {});

  return {
    messageId: data.id,
    threadId: data.threadId,
    timestamp: new Date().toISOString(),
  };
}

export function buildRawMessage({ to, subject, body, replyTo, cc }) {
  const lines = [];
  const recipients = normalizeRecipients(to);
  const ccRecipients = normalizeRecipients(cc);

  if (recipients.length === 0) {
    const error = new Error('At least one email recipient is required.');
    error.code = 'EMAIL_PAYLOAD_INVALID';
    throw error;
  }

  lines.push(`To: ${recipients.join(', ')}`);
  lines.push(`Subject: ${sanitizeHeaderValue(subject)}`);

  if (replyTo) {
    lines.push(`Reply-To: ${sanitizeHeaderValue(replyTo)}`);
  }

  if (ccRecipients.length > 0) {
    lines.push(`Cc: ${ccRecipients.join(', ')}`);
  }

  lines.push('MIME-Version: 1.0');
  lines.push('Content-Type: text/plain; charset=utf-8');
  lines.push('');
  lines.push(body ?? '');

  const raw = lines.join('\r\n');
  return Buffer.from(raw).toString('base64url');
}

function normalizeRecipients(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : String(value).split(/[;,]/);
  return values
    .map((entry) => sanitizeHeaderValue(entry))
    .filter(Boolean);
}

function sanitizeHeaderValue(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

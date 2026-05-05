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

  await recordProductEvent('action_executed', {
    orgId,
    userId,
    actionType: 'email.send',
    workflowId,
    messageId: data.id,
  }).catch(() => {});

  return {
    messageId: data.id,
    threadId: data.threadId,
    timestamp: new Date().toISOString(),
  };
}

function buildRawMessage({ to, subject, body, replyTo, cc }) {
  const lines = [];

  if (Array.isArray(to)) {
    lines.push(`To: ${to.join(', ')}`);
  } else {
    lines.push(`To: ${to}`);
  }

  lines.push(`Subject: ${subject}`);

  if (replyTo) {
    lines.push(`Reply-To: ${replyTo}`);
  }

  if (cc) {
    if (Array.isArray(cc)) {
      lines.push(`Cc: ${cc.join(', ')}`);
    } else {
      lines.push(`Cc: ${cc}`);
    }
  }

  lines.push('MIME-Version: 1.0');
  lines.push('Content-Type: text/plain; charset=utf-8');
  lines.push('');
  lines.push(body ?? '');

  const raw = lines.join('\r\n');
  return Buffer.from(raw).toString('base64url');
}

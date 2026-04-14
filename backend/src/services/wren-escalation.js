import { auditLogs, emailQueue } from '../db/schema.js';

const LEGAL_PATTERN =
  /\b(?:solicitor|attorney|legal action|sue|lawsuit|trading standards|financial ombudsman|small claims|court)\b/i;
const DISTRESS_PATTERN =
  /\b(?:crisis|harm|hurt myself|hurting myself|can't cope|desperate|suicidal|end my life|self-harm)\b/i;
const CHARGEBACK_PATTERN = /\b(?:chargeback|section 75|credit card dispute|fraudulent charge)\b/i;
const REFUND_PATTERN = /\b(?:refund|money back|want my money)\b/i;
const AMOUNT_PATTERN = /(?:£|\u00A3)(\d+(?:\.\d{2})?)/g;

function getRefundThreshold() {
  const raw = Number(process.env.WREN_REFUND_THRESHOLD_GBP ?? 50);
  return Number.isFinite(raw) && raw > 0 ? raw : 50;
}

function extractMaxAmount(text) {
  const matches = [...String(text ?? '').matchAll(AMOUNT_PATTERN)];
  if (!matches.length) {
    return null;
  }
  return Math.max(...matches.map((match) => parseFloat(match[1])));
}

/**
 * Detect escalation triggers in a WREN response.
 * @param {string} responseText
 * @param {Array<{role: string, content: string}>} conversationHistory
 * @param {{ previousEscalationCount?: number }} [options]
 * @returns {{ triggered: boolean, triggerReason: string|null, severity: 'high'|'medium'|'low'|null }}
 */
export function detectEscalationTrigger(responseText, conversationHistory = [], options = {}) {
  const fullText = [responseText, ...conversationHistory.map((message) => message.content ?? '')].join('\n');

  if (LEGAL_PATTERN.test(fullText)) {
    return { triggered: true, triggerReason: 'legal_threat', severity: 'high' };
  }

  if (DISTRESS_PATTERN.test(fullText)) {
    return { triggered: true, triggerReason: 'customer_distress', severity: 'high' };
  }

  if (CHARGEBACK_PATTERN.test(fullText)) {
    return { triggered: true, triggerReason: 'chargeback_dispute', severity: 'high' };
  }

  if (REFUND_PATTERN.test(fullText)) {
    const threshold = getRefundThreshold();
    const maxAmount = extractMaxAmount(fullText);
    if (maxAmount === null || maxAmount > threshold) {
      return { triggered: true, triggerReason: 'refund_demand', severity: 'medium' };
    }
  }

  if ((options.previousEscalationCount ?? 0) >= 2) {
    return { triggered: true, triggerReason: 'repeat_complaint', severity: 'medium' };
  }

  return { triggered: false, triggerReason: null, severity: null };
}

/**
 * Dispatch a WREN escalation notification.
 * Inserts into emailQueue and auditLogs.
 * @returns {{ dispatched: boolean }}
 */
export async function dispatchWrenEscalation({
  orgId,
  userId,
  conversationId,
  triggerReason,
  severity,
  recentMessages = [],
  db,
}) {
  const escalationEmail = process.env.WREN_ESCALATION_EMAIL?.trim();

  if (!escalationEmail) {
    console.warn('[WREN] WREN_ESCALATION_EMAIL is not configured - escalation will not be dispatched.');
    return { dispatched: false };
  }

  const thread = recentMessages
    .slice(-3)
    .map((message) => `[${message.role.toUpperCase()}] ${String(message.content ?? '').slice(0, 500)}`)
    .join('\n\n');

  const htmlBody = `
<p><strong>Prymal WREN Escalation Alert</strong></p>
<table>
  <tr><td><strong>Org ID:</strong></td><td>${orgId ?? '-'}</td></tr>
  <tr><td><strong>User ID:</strong></td><td>${userId ?? '-'}</td></tr>
  <tr><td><strong>Conversation ID:</strong></td><td>${conversationId ?? '-'}</td></tr>
  <tr><td><strong>Trigger:</strong></td><td>${triggerReason}</td></tr>
  <tr><td><strong>Severity:</strong></td><td>${severity}</td></tr>
</table>
<hr/>
<h3>Recent conversation</h3>
<pre style="white-space: pre-wrap;">${thread || '(no recent messages)'}</pre>
`.trim();

  try {
    await Promise.all([
      db.insert(emailQueue).values({
        toEmail: escalationEmail,
        templateName: 'wren_escalation',
        payload: {
          subject: `[Prymal WREN] Escalation: ${triggerReason} (${severity})`,
          html: htmlBody,
          orgId,
          userId,
          conversationId,
          triggerReason,
          severity,
        },
        sendAfter: new Date(),
      }),
      db.insert(auditLogs).values({
        orgId: orgId ?? null,
        actorUserId: userId ?? null,
        action: 'wren.escalation',
        targetType: 'conversation',
        targetId: conversationId ?? null,
        metadata: { triggerReason, severity, orgId, userId },
      }),
    ]);

    return { dispatched: true };
  } catch (error) {
    console.error('[WREN] Failed to dispatch escalation:', error.message);
    return { dispatched: false };
  }
}

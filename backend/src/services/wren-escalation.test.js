import test from 'node:test';
import assert from 'node:assert/strict';
import { auditLogs, emailQueue } from '../db/schema.js';
import { detectEscalationTrigger, dispatchWrenEscalation } from './wren-escalation.js';

test('detectEscalationTrigger returns triggered: false for normal conversation', () => {
  const result = detectEscalationTrigger('Thank you for reaching out, I will look into this for you.');
  assert.equal(result.triggered, false);
  assert.equal(result.triggerReason, null);
  assert.equal(result.severity, null);
});

for (const text of [
  'I will take you to court over this',
  'My solicitor has advised me to pursue this matter',
  'I am consulting an attorney',
  'I will take legal action if this is not resolved',
  'I plan to file a lawsuit against your company',
  'I will report this to trading standards',
  'I am contacting the financial ombudsman',
  'I will take this to small claims',
]) {
  test(`detectEscalationTrigger flags legal threat: ${text}`, () => {
    const result = detectEscalationTrigger(text);
    assert.equal(result.triggered, true);
    assert.equal(result.triggerReason, 'legal_threat');
    assert.equal(result.severity, 'high');
  });
}

for (const text of [
  "I'm in crisis right now",
  "I can't cope with this anymore",
  'I feel desperate',
  'I am having suicidal thoughts',
  'I want to end my life',
  'I am engaging in self-harm',
  'I feel like hurting myself',
]) {
  test(`detectEscalationTrigger flags customer distress: ${text}`, () => {
    const result = detectEscalationTrigger(text);
    assert.equal(result.triggered, true);
    assert.equal(result.triggerReason, 'customer_distress');
    assert.equal(result.severity, 'high');
  });
}

for (const text of [
  'I am filing a chargeback with my bank',
  'I will raise a section 75 claim',
  'I am opening a credit card dispute',
  'This is a fraudulent charge',
]) {
  test(`detectEscalationTrigger flags chargeback dispute: ${text}`, () => {
    const result = detectEscalationTrigger(text);
    assert.equal(result.triggered, true);
    assert.equal(result.triggerReason, 'chargeback_dispute');
    assert.equal(result.severity, 'high');
  });
}

test('detectEscalationTrigger flags refund demand without amount', () => {
  const result = detectEscalationTrigger('I want a refund immediately');
  assert.equal(result.triggered, true);
  assert.equal(result.triggerReason, 'refund_demand');
  assert.equal(result.severity, 'medium');
});

test('detectEscalationTrigger flags refund demand above threshold', () => {
  const result = detectEscalationTrigger('I want my money back, I paid £75 for this service');
  assert.equal(result.triggered, true);
  assert.equal(result.triggerReason, 'refund_demand');
  assert.equal(result.severity, 'medium');
});

test('detectEscalationTrigger ignores refund demand at or below threshold', () => {
  const result = detectEscalationTrigger('I want a refund for the £20 I paid');
  assert.equal(result.triggered, false);
});

test('detectEscalationTrigger flags money back language', () => {
  const result = detectEscalationTrigger('I want my money back. I spent £200 on this.');
  assert.equal(result.triggered, true);
});

test('detectEscalationTrigger respects refund threshold env override', () => {
  const originalEnv = process.env.WREN_REFUND_THRESHOLD_GBP;
  process.env.WREN_REFUND_THRESHOLD_GBP = '100';
  const result = detectEscalationTrigger('I want a refund, I paid £75 for this');
  process.env.WREN_REFUND_THRESHOLD_GBP = originalEnv;
  assert.equal(result.triggered, false);
});

test('detectEscalationTrigger flags repeat complaint from escalation count', () => {
  const result = detectEscalationTrigger('I am contacting you again about the same issue', [], { previousEscalationCount: 2 });
  assert.equal(result.triggered, true);
  assert.equal(result.triggerReason, 'repeat_complaint');
  assert.equal(result.severity, 'medium');
});

test('detectEscalationTrigger ignores repeat complaint below threshold', () => {
  const result = detectEscalationTrigger('I am contacting you again about the same issue', [], { previousEscalationCount: 1 });
  assert.equal(result.triggered, false);
});

test('detectEscalationTrigger prioritises legal threat over refund demand', () => {
  const result = detectEscalationTrigger('I want a refund and I will take you to court if I do not get one');
  assert.equal(result.triggerReason, 'legal_threat');
});

test('detectEscalationTrigger scans recent history as well as the current text', () => {
  const result = detectEscalationTrigger(
    'Thank you for your message.',
    [{ role: 'user', content: 'I have already spoken to my solicitor about this.' }],
  );
  assert.equal(result.triggered, true);
  assert.equal(result.triggerReason, 'legal_threat');
});

test('dispatchWrenEscalation returns dispatched: false when escalation email is missing', async () => {
  const originalEnv = process.env.WREN_ESCALATION_EMAIL;
  delete process.env.WREN_ESCALATION_EMAIL;

  const mockDb = {
    insert: () => ({
      values: () => Promise.resolve(),
    }),
  };

  const result = await dispatchWrenEscalation({
    orgId: 'org-1',
    userId: 'user-1',
    conversationId: 'conv-1',
    triggerReason: 'legal_threat',
    severity: 'high',
    recentMessages: [],
    db: mockDb,
  });

  assert.equal(result.dispatched, false);
  process.env.WREN_ESCALATION_EMAIL = originalEnv;
});

test('dispatchWrenEscalation inserts email and audit rows when configured', async () => {
  const originalEnv = process.env.WREN_ESCALATION_EMAIL;
  process.env.WREN_ESCALATION_EMAIL = 'support@example.com';

  const insertedEmailValues = [];
  const insertedAuditValues = [];
  const mockDb = {
    insert: (table) => ({
      values: (value) => {
        if (table === emailQueue) {
          insertedEmailValues.push(value);
        }
        if (table === auditLogs) {
          insertedAuditValues.push(value);
        }
        return Promise.resolve();
      },
    }),
  };

  const result = await dispatchWrenEscalation({
    orgId: 'org-1',
    userId: 'user-1',
    conversationId: 'conv-1',
    triggerReason: 'legal_threat',
    severity: 'high',
    recentMessages: [
      { role: 'user', content: 'I will take you to court.' },
      { role: 'assistant', content: 'I understand your frustration.' },
    ],
    db: mockDb,
  });

  assert.equal(result.dispatched, true);
  assert.equal(insertedEmailValues.length, 1);
  assert.equal(insertedAuditValues.length, 1);
  assert.equal(insertedEmailValues[0].toEmail, 'support@example.com');
  assert.equal(insertedEmailValues[0].templateName, 'wren_escalation');
  assert.equal(insertedAuditValues[0].action, 'wren.escalation');
  assert.equal(insertedAuditValues[0].targetType, 'conversation');

  process.env.WREN_ESCALATION_EMAIL = originalEnv;
});

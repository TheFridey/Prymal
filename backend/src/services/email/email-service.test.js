import assert from 'node:assert/strict';
import test from 'node:test';
import { EMAIL_TEMPLATE_BUILDERS, renderTemplate } from './email-copy.js';
import { sendEmail, sendWelcomeEmail } from './email-service.js';
import { buildInlineAssetAttachments } from './resend-client.js';

const OLD_ENV = { ...process.env };

test.afterEach(() => {
  process.env.RESEND_API_KEY = OLD_ENV.RESEND_API_KEY;
  process.env.EMAIL_FROM = OLD_ENV.EMAIL_FROM;
  process.env.RESEND_FROM_EMAIL = OLD_ENV.RESEND_FROM_EMAIL;
  process.env.FRONTEND_URL = OLD_ENV.FRONTEND_URL;
  process.env.APP_URL = OLD_ENV.APP_URL;
  process.env.EMAIL_LOGO_URL = OLD_ENV.EMAIL_LOGO_URL;
  process.env.EMAIL_HERALD_AVATAR_URL = OLD_ENV.EMAIL_HERALD_AVATAR_URL;
});

test('every transactional email template renders required fields and safe copy', () => {
  process.env.APP_URL = 'https://app.prymal.io';
  process.env.EMAIL_LOGO_URL = 'https://app.prymal.io/logo.png';

  for (const type of Object.keys(EMAIL_TEMPLATE_BUILDERS)) {
    const email = renderTemplate(type, samplePayload(type));
    assert.equal(typeof email.subject, 'string', type);
    assert.equal(typeof email.previewText, 'string', type);
    assert.equal(typeof email.html, 'string', type);
    assert.equal(typeof email.text, 'string', type);
    assert.match(email.html, /https:\/\/app\.prymal\.io\/logo\.png/, type);
    assert.match(email.html, /Herald/, type);
    assert.match(email.text, /Email & Communications Agent/, type);
    assert.doesNotMatch(`${email.subject}${email.previewText}${email.html}${email.text}`, /—/, type);
    assert.doesNotMatch(`${email.subject}${email.previewText}${email.html}${email.text}`, /unlimited/i, type);
    assert.doesNotMatch(`${email.subject}${email.previewText}${email.html}${email.text}`, /premium workflow marketplace is live/i, type);
    assert.match(email.text, /https:\/\/app\.prymal\.io|https:\/\/invite\.prymal\.io/, type);
  }
});

test('template render uses inline email asset CIDs by default', () => {
  process.env.APP_URL = 'https://app.prymal.io';
  delete process.env.EMAIL_LOGO_URL;
  delete process.env.EMAIL_HERALD_AVATAR_URL;
  const email = renderTemplate('welcome', {});
  assert.match(email.html, /cid:prymal-logo/);
  assert.match(email.html, /cid:herald-avatar/);
});

test('template render falls back safely without explicit Herald avatar URL', () => {
  process.env.APP_URL = 'https://app.prymal.io';
  delete process.env.EMAIL_HERALD_AVATAR_URL;
  const email = renderTemplate('welcome', {});
  assert.match(email.html, /cid:herald-avatar/);
  assert.match(email.text, /Herald/);
});

test('inline Prymal email assets are attached for cid images', async () => {
  const attachments = await buildInlineAssetAttachments('<img src="cid:prymal-logo"><img src="cid:herald-avatar">');
  assert.equal(attachments.length, 2);
  assert.equal(attachments[0].content_id, 'prymal-logo');
  assert.equal(attachments[1].content_id, 'herald-avatar');
  assert.equal(attachments[0].content_type, 'image/webp');
  assert.ok(attachments[0].content.length > 1000);
});

test('sendEmail sends via Resend and records a sent email event', async () => {
  process.env.RESEND_API_KEY = 're_test';
  process.env.EMAIL_FROM = 'Prymal <hello@prymal.io>';
  const events = [];
  const dbClient = fakeDb({ events });
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.to[0], 'user@example.com');
    assert.equal(body.subject, 'Hello');
    return { ok: true, json: async () => ({ id: 'email_123' }) };
  };

  const result = await sendEmail({
    to: 'USER@example.com',
    subject: 'Hello',
    html: '<p>Hello</p>',
    text: 'Hello',
    emailType: 'test',
    idempotencyKey: 'test:sent',
    dbClient,
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(events[0].status, 'sent');
  assert.equal(events[0].providerMessageId, 'email_123');
});

test('sendEmail records failed email events and does not throw', async () => {
  process.env.RESEND_API_KEY = 're_test';
  process.env.EMAIL_FROM = 'Prymal <hello@prymal.io>';
  const events = [];
  const dbClient = fakeDb({ events });
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({ message: 'Provider down' }) });

  const result = await sendEmail({
    to: 'user@example.com',
    subject: 'Hello',
    html: '<p>Hello</p>',
    text: 'Hello',
    emailType: 'test',
    idempotencyKey: 'test:failed',
    dbClient,
    fetchImpl,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'Provider down');
  assert.equal(events[0].status, 'failed');
});

test('sendEmail still sends if email event idempotency lookup is unavailable', async () => {
  process.env.RESEND_API_KEY = 're_test';
  process.env.EMAIL_FROM = 'Prymal <hello@prymal.io>';
  let fetchCalls = 0;
  const events = [];
  const dbClient = fakeDb({
    events,
    findError: new Error('database offline'),
  });

  const result = await sendEmail({
    to: 'user@example.com',
    subject: 'Hello',
    html: '<p>Hello</p>',
    text: 'Hello',
    emailType: 'test',
    idempotencyKey: 'test:tracking-outage',
    dbClient,
    fetchImpl: async () => {
      fetchCalls += 1;
      return { ok: true, json: async () => ({ id: 'email_sent_despite_tracking_outage' }) };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(fetchCalls, 1);
  assert.equal(events[0].status, 'sent');
});

test('sendWelcomeEmail respects sent idempotency events', async () => {
  process.env.RESEND_API_KEY = 're_test';
  process.env.EMAIL_FROM = 'Prymal <hello@prymal.io>';
  let fetchCalls = 0;
  const dbClient = fakeDb({
    existing: { status: 'sent', providerMessageId: 'email_existing' },
  });

  const result = await sendWelcomeEmail('user@example.com', {}, {
    orgId: 'org_123',
    userId: 'user_123',
    dbClient,
    fetchImpl: async () => {
      fetchCalls += 1;
      return { ok: true, json: async () => ({ id: 'email_new' }) };
    },
  });

  assert.equal(result.skipped, true);
  assert.equal(result.idempotent, true);
  assert.equal(fetchCalls, 0);
});

test('sendEmail skips safely when recipient is missing', async () => {
  const events = [];
  const result = await sendEmail({
    to: '',
    subject: 'Hello',
    html: '<p>Hello</p>',
    text: 'Hello',
    emailType: 'test',
    idempotencyKey: 'test:missing',
    dbClient: fakeDb({ events }),
  });

  assert.equal(result.skipped, true);
  assert.equal(events[0].status, 'skipped');
});

function samplePayload(type) {
  const base = {
    workspaceName: 'Acme',
    inviterName: 'Rhys',
    inviteUrl: 'https://invite.prymal.io/abc',
    role: 'member',
    planName: 'Pro',
    executionCredits: 2000,
    videoCredits: 5,
    oldPlanName: 'Solo',
    effectiveDate: '2026-04-30T12:00:00.000Z',
    amount: '£99',
    invoiceDate: '2026-04-30T12:00:00.000Z',
    thresholdPercent: 70,
    billingPeriodKey: '2026-04',
    capState: 'EXECUTION_CREDITS_REQUIRED',
    workflowTitle: '30-Day Content Engine',
    workflowId: 'workflow_123',
    installedWorkflowId: 'workflow_123',
    workflowRunId: 'run_123',
    workflowName: 'Weekly Report',
    failureSummary: 'A node failed after retry handling.',
    founderPeriodEndsAt: '2026-07-30T12:00:00.000Z',
    onboardingBonusCredits: 250,
    eventName: 'API key created',
    occurredAt: '2026-04-30T12:00:00.000Z',
  };
  if (type === 'team-invite') return base;
  return base;
}

function fakeDb({ events = [], existing = null, findError = null } = {}) {
  return {
    query: {
      emailEvents: {
        findFirst: async () => {
          if (findError) throw findError;
          return existing;
        },
      },
    },
    insert: () => ({
      values: (value) => ({
        onConflictDoUpdate: () => ({
          returning: async () => {
            events.push(value);
            return [value];
          },
        }),
        returning: async () => {
          events.push(value);
          return [value];
        },
      }),
    }),
  };
}

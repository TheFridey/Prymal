import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { setupTestEnv } from '../../../test-helpers.js';

setupTestEnv();

const {
  batchInviteSchema,
  batchInviteValidationHook,
  createBatchInviteHandler,
  dispatchWaitlistBatchInvite,
} = await import('./waitlist.js');

function buildUuid(index) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

test('dispatchWaitlistBatchInvite queues invite emails, updates invitedAt, and records a single admin receipt', async () => {
  const now = new Date('2026-04-08T12:30:00.000Z');
  const firstId = buildUuid(1);
  const secondId = buildUuid(2);
  const missingId = buildUuid(3);

  const entries = new Map([
    [firstId, { id: firstId, email: 'first@example.com', source: 'landing', invitedAt: null }],
    [secondId, { id: secondId, email: 'second@example.com', source: 'referral', invitedAt: null }],
  ]);
  const queuedEmails = [];
  const adminLogs = [];

  const result = await dispatchWaitlistBatchInvite({
    ids: [firstId, secondId, missingId],
    staff: { userId: 'staff_user_1', staffRole: 'support' },
    now,
    frontendUrl: 'https://app.prymal.com',
    findWaitlistEntryById: async (id) => entries.get(id) ?? null,
    inviteWaitlistEntry: async ({ entry, now: invitedAt, inviteUrl }) => {
      queuedEmails.push({
        toEmail: entry.email,
        templateName: 'waitlist_invite',
        payload: {
          subject: "You're invited to Prymal",
          email: entry.email,
          inviteUrl,
          source: entry.source ?? 'waitlist',
        },
        sendAfter: invitedAt,
      });

      entries.set(entry.id, {
        ...entry,
        invitedAt,
      });
    },
    recordAdminAction: async (payload) => {
      adminLogs.push(payload);
      return { id: 'receipt_1', ...payload };
    },
  });

  assert.deepEqual(result, {
    queued: 2,
    skipped: 1,
    invitedAt: now.toISOString(),
  });
  assert.equal(queuedEmails.length, 2);
  assert.equal(queuedEmails[0].toEmail, 'first@example.com');
  assert.equal(queuedEmails[0].payload.inviteUrl, 'https://app.prymal.com/signup');
  assert.equal(queuedEmails[1].payload.source, 'referral');
  assert.equal(entries.get(firstId)?.invitedAt?.toISOString(), now.toISOString());
  assert.equal(entries.get(secondId)?.invitedAt?.toISOString(), now.toISOString());
  assert.equal(adminLogs.length, 1);
  assert.equal(adminLogs[0].action, 'admin.waitlist.batch_invite');
  assert.equal(adminLogs[0].permission, 'admin.waitlist.write');
  assert.equal(adminLogs[0].reasonCode, 'manual_batch_invite');
  assert.deepEqual(adminLogs[0].metadata, {
    queued: 2,
    skipped: 1,
    totalRequested: 3,
  });
});

test('dispatchWaitlistBatchInvite skips waitlist entries that were already invited', async () => {
  const now = new Date('2026-04-08T13:00:00.000Z');
  const invitedAt = new Date('2026-04-01T09:00:00.000Z');
  const invitedId = buildUuid(4);
  const queuedEmails = [];

  const result = await dispatchWaitlistBatchInvite({
    ids: [invitedId],
    staff: { userId: 'staff_user_2', staffRole: 'ops' },
    now,
    findWaitlistEntryById: async () => ({
      id: invitedId,
      email: 'already-invited@example.com',
      source: 'waitlist',
      invitedAt,
    }),
    inviteWaitlistEntry: async (payload) => {
      queuedEmails.push(payload);
    },
    recordAdminAction: async () => null,
  });

  assert.deepEqual(result, {
    queued: 0,
    skipped: 1,
    invitedAt: now.toISOString(),
  });
  assert.equal(queuedEmails.length, 0);
});

function createValidationApp() {
  const app = new Hono();

  app.use('*', async (context, next) => {
    context.set('staff', { userId: 'staff_user_3', staffRole: 'support' });
    context.set('requestId', 'req_waitlist_test');
    await next();
  });

  app.post(
    '/waitlist/batch-invite',
    zValidator('json', batchInviteSchema, batchInviteValidationHook),
    createBatchInviteHandler({
      getNow: () => new Date('2026-04-08T14:00:00.000Z'),
      findWaitlistEntryById: async () => null,
      inviteWaitlistEntry: async () => undefined,
      recordAdminAction: async () => null,
    }),
  );

  return app;
}

test('waitlist batch invite returns 400 when ids is empty', async () => {
  const app = createValidationApp();

  const response = await app.request('/waitlist/batch-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [] }),
  });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, 'ids must include at least one waitlist entry UUID.');
});

test('waitlist batch invite returns 400 when ids exceeds the maximum batch size', async () => {
  const app = createValidationApp();
  const ids = Array.from({ length: 101 }, (_, index) => buildUuid(index + 100));

  const response = await app.request('/waitlist/batch-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, 'ids cannot contain more than 100 waitlist entry UUIDs.');
});

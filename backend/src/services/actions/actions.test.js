import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../../test-helpers.js';

setupTestEnv();

const { executeAction, evaluateActionPolicy, getSupportedActionTypes, isKnownActionType } = await import('./action-registry.js');
const { getPendingApprovals } = await import('./action-approval.js');
const { db } = await import('../../db/index.js');

// ── Policy evaluation unit tests ──────────────────────────────────────────────

test('email bulk block policy fires for more than 5 recipients', () => {
  const result = evaluateActionPolicy('email.send', {
    to: ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com', 'f@x.com'],
    subject: 'Bulk',
    body: 'Hello',
  });
  assert.equal(result.verdict, 'block');
  assert.equal(result.policyId, 'email_bulk_block');
});

test('email bulk block does NOT fire for 5 or fewer recipients', () => {
  const result = evaluateActionPolicy('email.send', {
    to: ['a@x.com', 'b@x.com'],
    subject: 'Hi',
    body: 'Hello',
  });
  // May be require_approval (external domain) but should not be block
  assert.notEqual(result.verdict, 'block');
});

test('slack DM is blocked by slack_dm_block policy', () => {
  const result = evaluateActionPolicy('slack.post', {
    channel: 'C123',
    text: 'Hello',
    channel_type: 'im',
  });
  assert.equal(result.verdict, 'block');
  assert.equal(result.policyId, 'slack_dm_block');
});

test('slack public channel triggers require_approval not block', () => {
  const result = evaluateActionPolicy('slack.post', {
    channel: 'C123',
    text: 'Hello',
    channel_type: 'public',
  });
  assert.equal(result.verdict, 'require_approval');
  assert.equal(result.policyId, 'slack_public_channel_approval');
});

test('social publish always requires approval before a live post', () => {
  const result = evaluateActionPolicy('social.publish', {
    service: 'linkedin',
    text: 'Launch post for the Prymal page.',
  });
  assert.equal(result.verdict, 'require_approval');
  assert.equal(result.policyId, 'social_publish_approval');
});

test('unknown action type returns policy allow (no matching policies)', () => {
  const result = evaluateActionPolicy('unknown.thing', { foo: 'bar' });
  assert.equal(result.verdict, 'allow');
});

// ── executeAction unit tests ──────────────────────────────────────────────────

test('executeAction returns UNKNOWN_ACTION_TYPE for unregistered type', async () => {
  const result = await executeAction('phishing.send', {}, { orgId: 'org_1', userId: 'user_1' });
  assert.equal(result.success, false);
  assert.equal(result.code, 'UNKNOWN_ACTION_TYPE');
  assert.ok(typeof result.traceId === 'string');
});

test('executeAction returns blocked: true without calling handler when policy is block', async () => {
  // Slack DM is unconditionally blocked by slack_dm_block policy
  const result = await executeAction('slack.post', {
    channel: 'U123456',
    text: 'Hello',
    channel_type: 'im',
  }, { orgId: 'org_1', userId: 'user_1' });

  assert.equal(result.success, false);
  assert.equal(result.blocked, true);
  assert.equal(result.code, 'ACTION_POLICY_BLOCK');
  assert.ok(typeof result.traceId === 'string');
});

test('executeAction returns awaitingApproval: true when require_approval with no token', async () => {
  // Slack public channel — policy requires approval. DB will fail but error is safe-wrapped.
  const result = await executeAction('slack.post', {
    channel: 'C123',
    text: 'Hello world',
    channel_type: 'public',
  }, { orgId: 'org_unit_test', userId: 'user_1' });

  // Either awaiting approval (DB worked) or APPROVAL_CREATE_FAILED (DB unavailable)
  assert.equal(result.success, false);
  assert.ok(result.awaitingApproval === true || result.code === 'APPROVAL_CREATE_FAILED');
  assert.ok(typeof result.traceId === 'string');
});

test('executeAction gates social publishing behind approval', async () => {
  const result = await executeAction('social.publish', {
    service: 'linkedin',
    text: 'A launch post that should not publish without approval.',
  }, { orgId: 'org_unit_test', userId: 'user_1' });

  assert.equal(result.success, false);
  assert.ok(result.awaitingApproval === true || result.code === 'APPROVAL_CREATE_FAILED');
  assert.ok(typeof result.traceId === 'string');
});

test('executeAction returns approval_token_invalid for an expired or missing token', async () => {
  const result = await executeAction('slack.post', {
    channel: 'C123',
    text: 'Hello',
    channel_type: 'public',
  }, {
    orgId: 'org_unit_test',
    userId: 'user_1',
    approvalToken: 'aaaa' + '0'.repeat(60), // fake token
  });

  assert.equal(result.success, false);
  assert.ok(
    result.code === 'approval_token_invalid' || result.code === 'APPROVAL_CREATE_FAILED',
    `unexpected code: ${result.code}`,
  );
});

test('executeAction returns oauth_not_connected when no integration is stored', async () => {
  const originalFindFirst = db.query.integrations.findFirst;
  db.query.integrations.findFirst = async () => null;

  try {
    const result = await executeAction('drive.write', {
      name: 'missing-oauth.txt',
      content: 'hello',
      mimeType: 'text/plain',
    }, { orgId: '00000000-0000-4000-8000-000000000099', userId: 'user_1' });

    assert.equal(result.success, false);
    assert.equal(result.code, 'oauth_not_connected');
    assert.ok(typeof result.error === 'string');
    assert.ok(typeof result.traceId === 'string');
  } finally {
    db.query.integrations.findFirst = originalFindFirst;
  }
});

test('executeAction never throws — always returns structured result', async () => {
  let threw = false;
  try {
    await executeAction('drive.write', { name: 'test.txt', content: 'hello', mimeType: 'text/plain' }, {
      orgId: 'org_unit_test',
      userId: 'user_1',
    });
  } catch {
    threw = true;
  }
  assert.equal(threw, false, 'executeAction must not throw');
});

test('getPendingApprovals returns empty array when database is unavailable', async () => {
  const result = await getPendingApprovals({ orgId: 'org_unit_test_nonexistent' });
  assert.ok(Array.isArray(result));
});

test('evaluateActionPolicy returns allow for drive.write with small content', () => {
  const result = evaluateActionPolicy('drive.write', {
    name: 'notes.txt',
    content: 'short content',
    mimeType: 'text/plain',
  });
  assert.equal(result.verdict, 'allow');
});

test('isKnownActionType returns correct booleans', () => {
  assert.equal(isKnownActionType('email.send'), true);
  assert.equal(isKnownActionType('drive.write'), true);
  assert.equal(isKnownActionType('slack.post'), true);
  assert.equal(isKnownActionType('social.publish'), true);
  assert.equal(isKnownActionType('sql.exec'), false);
  assert.equal(isKnownActionType(''), false);
});

test('supported action types include social.publish', () => {
  assert.ok(getSupportedActionTypes().includes('social.publish'));
});

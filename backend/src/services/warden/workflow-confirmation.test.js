import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approveWorkflowConfirmation,
  consumeWorkflowConfirmation,
  createWorkflowConfirmation,
  denyWorkflowConfirmation,
  getWorkflowConfirmation,
  isCriticalAdminWorkflow,
  summarizeWorkflowRisk,
} from './workflow-confirmation.js';
import { WARDEN_RISK_LEVELS, WARDEN_VERDICTS } from './warden-policy.js';

test('summarizeWorkflowRisk returns safe risk summary', () => {
  const summary = summarizeWorkflowRisk({
    verdict: WARDEN_VERDICTS.REQUIRE_CONFIRMATION,
    riskLevel: WARDEN_RISK_LEVELS.HIGH,
    categories: ['tool_abuse'],
    reasons: ['external input + tool execution'],
    metadata: { workflowHasExternalInput: true, workflowHasToolExecution: true },
  }, { id: 'wf_1', name: 'Test', nodes: [{ id: 'n1', agentId: 'lore' }] });

  assert.equal(summary.verdict, WARDEN_VERDICTS.REQUIRE_CONFIRMATION);
  assert.equal(summary.metadata.hasExternalInput, true);
  assert.equal(summary.metadata.hasToolExecution, true);
  assert.equal(summary.workflowName, 'Test');
  assert.equal(summary.affectedNodes.length, 1);
  assert.deepEqual(summary.categories, ['tool_abuse']);
});

test('isCriticalAdminWorkflow flags critical risk and admin/destructive categories', () => {
  assert.equal(isCriticalAdminWorkflow({ riskLevel: WARDEN_RISK_LEVELS.CRITICAL }), true);
  assert.equal(isCriticalAdminWorkflow({ categories: ['billing_admin_action'] }), true);
  assert.equal(isCriticalAdminWorkflow({ categories: ['destructive_action'] }), true);
  assert.equal(isCriticalAdminWorkflow({ categories: ['tool_abuse'] }), false);
});

test('createWorkflowConfirmation persists pending row with expires_at and risk summary', async () => {
  const inserted = [];
  const fakeDb = {
    insert: () => ({
      values: (value) => {
        inserted.push(value);
        return {
          returning: async () => [{ id: 'cf_1', ...value }],
        };
      },
    }),
  };

  const result = await createWorkflowConfirmation({
    orgId: '00000000-0000-4000-8000-000000000001',
    userId: 'user_1',
    workflowId: '00000000-0000-4000-8000-000000000002',
    wardenAuditId: 'audit_1',
    riskSummary: { verdict: WARDEN_VERDICTS.REQUIRE_CONFIRMATION },
    ttlMs: 60_000,
    dbClient: fakeDb,
  });

  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].status, 'pending');
  assert.ok(inserted[0].tokenHash, 'tokenHash should be stored');
  assert.equal(typeof result.confirmationToken, 'string');
  assert.notEqual(result.confirmationToken, inserted[0].tokenHash);
  assert.ok(result.expiresAt instanceof Date);
});

test('createWorkflowConfirmation rejects without orgId / workflowId', async () => {
  await assert.rejects(() => createWorkflowConfirmation({ orgId: null, workflowId: 'w' }));
  await assert.rejects(() => createWorkflowConfirmation({ orgId: 'o', workflowId: null }));
});

test('getWorkflowConfirmation enforces user and workflow scope', async () => {
  const row = {
    id: 'cf_1',
    orgId: 'org_1',
    userId: 'user_1',
    workflowId: 'wf_1',
    status: 'pending',
  };
  const fakeDb = {
    query: {
      workflowRiskConfirmations: {
        findFirst: async () => row,
      },
    },
  };

  assert.equal(await getWorkflowConfirmation({ confirmationId: 'cf_1', orgId: 'org_1', userId: 'user_1', workflowId: 'wf_1', dbClient: fakeDb }), row);
  assert.equal(await getWorkflowConfirmation({ confirmationId: 'cf_1', orgId: 'org_1', userId: 'user_2', workflowId: 'wf_1', dbClient: fakeDb }), null);
  assert.equal(await getWorkflowConfirmation({ confirmationId: 'cf_1', orgId: 'org_1', userId: 'user_1', workflowId: 'wf_2', dbClient: fakeDb }), null);
});

test('approve, deny and consume confirmation enforce lifecycle', async () => {
  const now = new Date('2026-05-01T12:00:00.000Z');
  const rows = new Map([
    ['pending', {
      id: 'pending',
      orgId: 'org_1',
      userId: 'user_1',
      workflowId: 'wf_1',
      status: 'pending',
      riskSummary: { verdict: WARDEN_VERDICTS.REQUIRE_CONFIRMATION, riskLevel: WARDEN_RISK_LEVELS.HIGH },
      expiresAt: new Date('2026-05-01T12:15:00.000Z'),
    }],
    ['expired', {
      id: 'expired',
      orgId: 'org_1',
      userId: 'user_1',
      workflowId: 'wf_1',
      status: 'pending',
      riskSummary: { verdict: WARDEN_VERDICTS.REQUIRE_CONFIRMATION },
      expiresAt: new Date('2026-05-01T11:59:00.000Z'),
    }],
    ['blocked', {
      id: 'blocked',
      orgId: 'org_1',
      userId: 'user_1',
      workflowId: 'wf_1',
      status: 'pending',
      riskSummary: { verdict: WARDEN_VERDICTS.BLOCK },
      expiresAt: new Date('2026-05-01T12:15:00.000Z'),
    }],
  ]);

  const fakeDb = {
    query: {
      workflowRiskConfirmations: {
        findFirst: async () => rows.get(currentId),
      },
    },
    update: () => ({
      set: (changes) => ({
        where: () => ({
          returning: async () => {
            const row = rows.get(currentId);
            if (!row) return [];
            Object.assign(row, changes);
            return [row];
          },
        }),
      }),
    }),
  };

  let currentId = 'pending';
  const approved = await approveWorkflowConfirmation({
    confirmationId: 'pending',
    orgId: 'org_1',
    userId: 'user_1',
    acknowledged: true,
    dbClient: fakeDb,
    now,
  });
  assert.equal(approved.ok, true);
  assert.equal(approved.confirmation.status, 'approved');

  const consumed = await consumeWorkflowConfirmation({
    confirmationId: 'pending',
    orgId: 'org_1',
    userId: 'user_1',
    workflowId: 'wf_1',
    dbClient: fakeDb,
    now,
  });
  assert.equal(consumed.ok, true);
  assert.equal(consumed.confirmation.status, 'used');

  currentId = 'expired';
  const expired = await approveWorkflowConfirmation({
    confirmationId: 'expired',
    orgId: 'org_1',
    userId: 'user_1',
    acknowledged: true,
    dbClient: fakeDb,
    now,
  });
  assert.equal(expired.ok, false);
  assert.equal(expired.code, 'EXPIRED');

  currentId = 'blocked';
  const blocked = await approveWorkflowConfirmation({
    confirmationId: 'blocked',
    orgId: 'org_1',
    userId: 'user_1',
    acknowledged: true,
    dbClient: fakeDb,
    now,
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'BLOCK_NOT_OVERRIDABLE');
});

test('denyWorkflowConfirmation changes pending confirmation to denied', async () => {
  const row = {
    id: 'cf_1',
    orgId: 'org_1',
    userId: 'user_1',
    workflowId: 'wf_1',
    status: 'pending',
    expiresAt: new Date(Date.now() + 60_000),
  };
  const fakeDb = {
    query: {
      workflowRiskConfirmations: {
        findFirst: async () => row,
      },
    },
    update: () => ({
      set: (changes) => ({
        where: () => ({
          returning: async () => {
            Object.assign(row, changes);
            return [row];
          },
        }),
      }),
    }),
  };

  const denied = await denyWorkflowConfirmation({
    confirmationId: 'cf_1',
    orgId: 'org_1',
    userId: 'user_1',
    dbClient: fakeDb,
  });

  assert.equal(denied.ok, true);
  assert.equal(denied.confirmation.status, 'denied');
});

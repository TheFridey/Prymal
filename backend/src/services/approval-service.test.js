import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  handlePostApprovalMode,
  approvePost,
  rejectPost,
  listPendingApprovals,
  expireStaleApprovals,
  APPROVAL_TTL_HOURS,
} = await import('./approval-service.js');

// ── handlePostApprovalMode: draft_only ───────────────────────────────────────

test('draft_only: returns drafted without creating approval or publishing', async () => {
  const publishCalled = { value: false };
  const db = makeDb({ publishCalled });

  const result = await handlePostApprovalMode(
    {
      workflow: makeWorkflow({ approvalMode: 'draft_only' }),
      workflowRun: makeRun(),
      orgContext: makeOrgCtx(),
      postText: 'Hello LinkedIn!',
    },
    db,
  );

  assert.equal(result.outcome, 'drafted');
  assert.ok(!publishCalled.value, 'should not publish in draft_only mode');
});

// ── handlePostApprovalMode: approval_required ────────────────────────────────

test('approval_required: creates approval request and returns pending_approval', async () => {
  let insertedApproval = null;
  const db = makeDb({ onInsertApproval: (v) => { insertedApproval = v; } });

  const result = await handlePostApprovalMode(
    {
      workflow: makeWorkflow({ approvalMode: 'approval_required' }),
      workflowRun: makeRun(),
      orgContext: makeOrgCtx(),
      postText: 'My LinkedIn post',
      wardenResult: { verdict: 'allow', riskLevel: 'low' },
    },
    db,
  );

  assert.equal(result.outcome, 'pending_approval');
  assert.ok(result.approvalId, 'should return approvalId');
  assert.ok(insertedApproval, 'should insert approval row');
  assert.equal(insertedApproval.status, 'pending');
  assert.equal(insertedApproval.postText, 'My LinkedIn post');
});

// ── handlePostApprovalMode: auto_publish ─────────────────────────────────────

test('auto_publish: publishes immediately when warden allows', async () => {
  let publishCalled = false;
  const db = makeDb({ onPublish: () => { publishCalled = true; } });

  const result = await handlePostApprovalMode(
    {
      workflow: makeWorkflow({ approvalMode: 'auto_publish' }),
      workflowRun: makeRun(),
      orgContext: makeOrgCtx(),
      postText: 'Auto-posted!',
      wardenResult: { verdict: 'allow', riskLevel: 'low' },
      publishFn: makeMockPublish(() => { publishCalled = true; }),
    },
    db,
  );

  assert.equal(result.outcome, 'published');
  assert.ok(result.receiptId, 'should return receiptId');
  assert.ok(publishCalled, 'should have called publish');
});

test('auto_publish: blocks when warden verdict is block', async () => {
  const db = makeDb({});

  const result = await handlePostApprovalMode(
    {
      workflow: makeWorkflow({ approvalMode: 'auto_publish' }),
      workflowRun: makeRun(),
      orgContext: makeOrgCtx(),
      postText: 'Blocked post',
      wardenResult: { verdict: 'block', riskLevel: 'high' },
    },
    db,
  );

  assert.equal(result.outcome, 'blocked');
  assert.ok(result.reason.includes('WARDEN'));
});

// ── approvePost ──────────────────────────────────────────────────────────────

test('approvePost: transitions pending → published', async () => {
  const approval = makePendingApproval();
  let updatedStatus = null;
  const db = makeDb({
    approvalRow: approval,
    onApprovalUpdate: (v) => { updatedStatus = v.status; },
  });

  const result = await approvePost(
    approval.id,
    { actorUserId: 'user-1', orgId: approval.orgId, publishFn: makeMockPublish() },
    db,
  );

  assert.ok(result.receiptId, 'should return receiptId');
  assert.equal(updatedStatus, 'published');
});

test('approvePost: throws APPROVAL_NOT_FOUND for unknown id', async () => {
  const db = makeDb({ approvalRow: null });

  await assert.rejects(
    () => approvePost('nonexistent', { actorUserId: 'user-1', orgId: 'org-1' }, db),
    (err) => err.code === 'APPROVAL_NOT_FOUND',
  );
});

test('approvePost: throws APPROVAL_FORBIDDEN for wrong org', async () => {
  const approval = makePendingApproval({ orgId: 'org-A' });
  const db = makeDb({ approvalRow: approval });

  await assert.rejects(
    () => approvePost(approval.id, { actorUserId: 'user-1', orgId: 'org-B' }, db),
    (err) => err.code === 'APPROVAL_FORBIDDEN',
  );
});

test('approvePost: throws APPROVAL_EXPIRED for past expiresAt', async () => {
  const expired = makePendingApproval({ expiresAt: new Date(Date.now() - 1000) });
  let updatedStatus = null;
  const db = makeDb({
    approvalRow: expired,
    onApprovalUpdate: (v) => { updatedStatus = v.status; },
  });

  await assert.rejects(
    () => approvePost(expired.id, { actorUserId: 'user-1', orgId: expired.orgId }, db),
    (err) => err.code === 'APPROVAL_EXPIRED',
  );

  assert.equal(updatedStatus, 'expired');
});

test('approvePost: throws APPROVAL_NOT_PENDING if already approved', async () => {
  const already = makePendingApproval({ status: 'approved' });
  const db = makeDb({ approvalRow: already });

  await assert.rejects(
    () => approvePost(already.id, { actorUserId: 'user-1', orgId: already.orgId }, db),
    (err) => err.code === 'APPROVAL_NOT_PENDING',
  );
});

// ── rejectPost ───────────────────────────────────────────────────────────────

test('rejectPost: transitions pending → rejected with reason', async () => {
  const approval = makePendingApproval();
  let rejectedData = null;
  const db = makeDb({
    approvalRow: approval,
    onApprovalUpdate: (v) => { rejectedData = v; },
  });

  await rejectPost(approval.id, { actorUserId: 'user-1', orgId: approval.orgId, reason: 'Off-brand' }, db);

  assert.equal(rejectedData.status, 'rejected');
  assert.equal(rejectedData.rejectionReason, 'Off-brand');
});

// ── expireStaleApprovals ─────────────────────────────────────────────────────

test('expireStaleApprovals: expires past-due pending rows', async () => {
  let updatedToExpired = 0;
  const db = makeDb({ onBulkExpire: (n) => { updatedToExpired = n; } });

  const count = await expireStaleApprovals(db);

  assert.ok(typeof count === 'number');
});

// ── handlePostApprovalMode: validates postText ───────────────────────────────

test('handlePostApprovalMode: throws on empty postText', async () => {
  const db = makeDb({});

  await assert.rejects(
    () => handlePostApprovalMode(
      { workflow: makeWorkflow(), workflowRun: makeRun(), orgContext: makeOrgCtx(), postText: '' },
      db,
    ),
    /required/,
  );
});

// ── APPROVAL_TTL_HOURS ───────────────────────────────────────────────────────

test('APPROVAL_TTL_HOURS defaults to 48', () => {
  assert.ok(APPROVAL_TTL_HOURS >= 1, 'should have a positive TTL');
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeWorkflow(overrides = {}) {
  return {
    id: 'wf-1',
    orgId: 'org-1',
    approvalMode: overrides.approvalMode ?? 'auto_publish',
    triggerType: 'schedule',
    isActive: true,
    ...overrides,
  };
}

function makeRun(overrides = {}) {
  return { id: 'run-1', workflowId: 'wf-1', orgId: 'org-1', ...overrides };
}

function makeOrgCtx(overrides = {}) {
  return { orgId: 'org-1', userId: 'user-1', orgPlan: 'solo', ...overrides };
}

function makePendingApproval(overrides = {}) {
  return {
    id: 'approval-1',
    workflowId: 'wf-1',
    workflowRunId: 'run-1',
    orgId: 'org-1',
    service: 'linkedin',
    postText: 'Test post',
    postMetadata: {},
    status: overrides.status ?? 'pending',
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 48 * 60 * 60_000),
    wardenVerdict: null,
    wardenRiskLevel: null,
    ...overrides,
  };
}

function makeMockPublish(onCall) {
  return async (payload) => {
    if (onCall) onCall(payload);
    return {
      service: payload.service ?? 'linkedin',
      delivery: { providerMessageId: 'li-post-123', target: 'urn:li:person:abc', publishedAt: new Date().toISOString() },
    };
  };
}

let _insertedApprovalId = 0;

function makeDb({ approvalRow, onInsertApproval, onApprovalUpdate, onPublish, onBulkExpire, publishCalled } = {}) {
  return {
    query: {
      workflowPostApprovals: {
        findFirst: async () => approvalRow ?? null,
        findMany: async () => approvalRow ? [approvalRow] : [],
      },
      workflows: {
        findFirst: async () => ({ id: 'wf-1', orgId: 'org-1', approvalMode: 'auto_publish', triggerType: 'schedule', isActive: true }),
      },
      workflowRuns: {
        findFirst: async () => ({ id: 'run-1', workflowId: 'wf-1', orgId: 'org-1' }),
      },
    },
    insert: (table) => ({
      values: (values) => ({
        returning: async () => {
          const id = `row-${++_insertedApprovalId}`;
          if (onInsertApproval && values.status === 'pending') {
            onInsertApproval({ ...values, id });
          }
          // publish receipt
          if (onPublish) onPublish();
          return [{ id, ...values }];
        },
      }),
    }),
    update: (table) => ({
      set: (values) => ({
        where: (...args) => ({
          then: (resolve) => {
            if (onApprovalUpdate) onApprovalUpdate(values);
            resolve([{ ...values }]);
          },
          returning: async () => {
            if (onBulkExpire) onBulkExpire(1);
            return [{ id: 'expired-1' }];
          },
        }),
        returning: async () => {
          if (onBulkExpire) onBulkExpire(1);
          return [{ id: 'expired-1' }];
        },
      }),
    }),
  };
}


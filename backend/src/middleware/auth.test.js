import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { db } = await import('../db/index.js');
const { requireOrg, requireRole, requireStaffPermission } = await import('./auth.js');

test('requireRole blocks members from admin-only actions', async () => {
  const middleware = requireRole('owner', 'admin');
  let response = null;
  let nextCalled = false;

  const context = {
    get: () => ({ userRole: 'member' }),
    json: (payload, status) => {
      response = { payload, status };
      return response;
    },
  };

  await middleware(context, async () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.status, 403);
  assert.equal(response.payload.code, 'INSUFFICIENT_ROLE');
});

test('requireRole allows owners through', async () => {
  const middleware = requireRole('owner', 'admin');
  let nextCalled = false;

  const context = {
    get: () => ({ userRole: 'owner' }),
    json: () => {
      throw new Error('should not block');
    },
  };

  await middleware(context, async () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test('requireStaffPermission blocks support users from org mutation actions', async () => {
  const middleware = requireStaffPermission('admin.org.update');
  let response = null;
  let nextCalled = false;

  const context = {
    get: () => ({ staffRole: 'support' }),
    json: (payload, status) => {
      response = { payload, status };
      return response;
    },
  };

  await middleware(context, async () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.status, 403);
  assert.equal(response.payload.code, 'STAFF_PERMISSION_DENIED');
});

test('requireOrg returns 401 when Clerk auth context is missing', async () => {
  let response = null;
  let nextCalled = false;
  const context = {
    get: (key) => (key === 'clerkAuth' ? () => ({ userId: null }) : null),
    req: { header: () => null, method: 'GET', path: '/api/auth/me' },
    json: (payload, status) => {
      response = { payload, status };
      return response;
    },
  };

  await requireOrg(context, async () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.status, 401);
});

test('requireOrg populates org context when Clerk auth is valid in the test harness', async () => {
  const originalUsers = db.query.users;
  const originalOrganisations = db.query.organisations;
  let orgContext = null;
  let nextCalled = false;

  db.query.users = {
    findFirst: async () => ({
      id: 'user_test',
      orgId: '00000000-0000-0000-0000-000000000001',
      role: 'owner',
      email: 'user@example.com',
    }),
  };
  db.query.organisations = {
    findFirst: async () => ({
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Test Org',
      plan: 'solo',
      seatLimit: 1,
      monthlyCreditLimit: 500,
      creditsUsed: 0,
      metadata: {},
    }),
  };

  const context = {
    get: (key) => (key === 'clerkAuth' ? () => ({ userId: 'user_test', sessionClaims: {} }) : null),
    set: (key, value) => {
      if (key === 'org') orgContext = value;
    },
    req: { header: () => 'Bearer test-token', method: 'GET', path: '/api/auth/me' },
    json: (payload, status) => ({ payload, status }),
  };

  try {
    await requireOrg(context, async () => {
      nextCalled = true;
    });
  } finally {
    db.query.users = originalUsers;
    db.query.organisations = originalOrganisations;
  }

  assert.equal(nextCalled, true);
  assert.equal(orgContext.userId, 'user_test');
  assert.equal(orgContext.orgId, '00000000-0000-0000-0000-000000000001');
});

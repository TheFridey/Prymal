import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { requireRole, requireStaffPermission } = await import('./auth.js');

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

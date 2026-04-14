import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  getStaffRole,
  hasStaffPermission,
  listStaffPermissions,
} = await import('./staff.js');

test('getStaffRole resolves tiered staff roles from env identity lists', () => {
  process.env.STAFF_SUPPORT_EMAILS = 'support@prymal.io';
  process.env.STAFF_OPS_EMAILS = 'ops@prymal.io';
  process.env.STAFF_FINANCE_EMAILS = 'finance@prymal.io';
  process.env.STAFF_SUPERADMIN_EMAILS = 'super@prymal.io';

  assert.equal(getStaffRole({ id: 'user_1', email: 'support@prymal.io' }), 'support');
  assert.equal(getStaffRole({ id: 'user_2', email: 'ops@prymal.io' }), 'ops');
  assert.equal(getStaffRole({ id: 'user_3', email: 'finance@prymal.io' }), 'finance');
  assert.equal(getStaffRole({ id: 'user_4', email: 'super@prymal.io' }), 'superadmin');
});

test('hasStaffPermission enforces per-role control-plane permissions', () => {
  assert.equal(hasStaffPermission({ staffRole: 'support' }, 'admin.org.update'), false);
  assert.equal(hasStaffPermission({ staffRole: 'ops' }, 'admin.org.update'), true);
  assert.equal(hasStaffPermission({ staffRole: 'ops' }, 'admin.memory.prune'), true);
  assert.equal(hasStaffPermission({ staffRole: 'finance' }, 'admin.billing.read'), true);
  assert.equal(hasStaffPermission({ staffRole: 'superadmin' }, 'admin.org.flags.write'), true);
});

test('listStaffPermissions returns explicit role permissions', () => {
  const permissions = listStaffPermissions('ops');

  assert.equal(permissions.includes('admin.workflow.replay'), true);
  assert.equal(permissions.includes('admin.credits.adjust'), true);
});

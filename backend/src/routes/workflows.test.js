import test from 'node:test';
import assert from 'node:assert/strict';

import { isOrgAdminUser } from './workflows.js';

test('isOrgAdminUser uses userRole instead of role', () => {
  assert.equal(isOrgAdminUser({ userRole: 'owner', role: 'member' }), true);
  assert.equal(isOrgAdminUser({ userRole: 'admin', role: 'member' }), true);
  assert.equal(isOrgAdminUser({ userRole: 'member', role: 'admin' }), false);
  assert.equal(isOrgAdminUser({ role: 'admin' }), false);
});

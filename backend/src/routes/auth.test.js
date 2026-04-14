import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { assertInvitationEligibility } = await import('./auth.js');

test('assertInvitationEligibility rejects mismatched invitation emails', () => {
  assert.throws(
    () =>
      assertInvitationEligibility({
        invitation: { email: 'member@company.com' },
        existingUser: { orgId: null },
        sessionEmail: 'other@company.com',
        organisationId: 'org_1',
      }),
    (error) => {
      assert.equal(error.code, 'INVITATION_EMAIL_MISMATCH');
      return true;
    },
  );
});

test('assertInvitationEligibility rejects cross-org account joins', () => {
  assert.throws(
    () =>
      assertInvitationEligibility({
        invitation: { email: 'member@company.com' },
        existingUser: { orgId: 'org_2' },
        sessionEmail: 'member@company.com',
        organisationId: 'org_1',
      }),
    (error) => {
      assert.equal(error.code, 'INVITATION_CROSS_ORG_CONFLICT');
      return true;
    },
  );
});

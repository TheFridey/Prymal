import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { db } = await import('../db/index.js');
const { assertSeatCapacity } = await import('./team.js');

test('assertSeatCapacity throws when no seats are available', async () => {
  const originalSelect = db.select;
  const originalOrgFind = db.query.organisations.findFirst;

  let selectCall = 0;
  db.select = () => ({
    from: () => ({
      where: async () => {
        selectCall += 1;
        return [{ count: selectCall === 1 ? 5 : 1 }];
      },
    }),
  });
  db.query.organisations.findFirst = async () => ({
    id: 'org_1',
    plan: 'teams',
    seatLimit: 5,
  });

  try {
    await assert.rejects(
      () => assertSeatCapacity('org_1'),
      (error) => {
        assert.equal(error.code, 'SEAT_LIMIT_REACHED');
        return true;
      },
    );
  } finally {
    db.select = originalSelect;
    db.query.organisations.findFirst = originalOrgFind;
  }
});

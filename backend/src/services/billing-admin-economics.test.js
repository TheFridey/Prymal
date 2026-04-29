import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { enrichAdminEconomicsDashboard } = await import('./billing-admin-economics.js');

test('enrichAdminEconomicsDashboard aggregates ledger splits and burn alerts', async () => {
  let executeCalls = 0;
  const mockDb = {
    query: {
      subscriptions: {
        findMany: async () => [
          { id: 's1', orgId: 'o1', plan: 'solo', cumulativeEstimatedCostGbp: 10 },
        ],
      },
      organisations: {
        findMany: async () => [{ id: 'o1', name: 'T Org', slug: 't' }],
      },
    },
    execute: async () => {
      executeCalls += 1;
      if (executeCalls === 1) {
        return { rows: [{ execution_gbp: 5, video_gbp: 3, total_gbp: 8 }] };
      }
      if (executeCalls === 2) {
        return { rows: [{ org_id: 'o1', burn: 4 }] };
      }
      return { rows: [{ user_id: 'user_1', email: 'a@b.com', burn: 2 }] };
    },
  };

  const out = await enrichAdminEconomicsDashboard(mockDb, {
    planDistribution: [{ plan: 'solo', count: 1, priceGbp: 49.99, estimatedMrrGbp: 49.99 }],
    rollUpEstimatedProviderCostGbp: 10,
    approxHeadroomToInternalCapGbp: 2,
    estimatedMrrTotalGbp: 49.99,
  });

  assert.equal(out.ledger.executionCostGbp, 5);
  assert.equal(out.ledger.videoCostGbp, 3);
  assert.ok(out.alerts.some((a) => a.code === 'WORKSPACES_GT_95_PCT_INTERNAL_CAP'));
});

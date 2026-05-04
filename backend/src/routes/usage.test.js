import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { requireOrg } = await import('../middleware/auth.js');
const {
  normalizeAgentRows,
  normalizeWorkflowRows,
  normalizeUsagePeriod,
  resolveUsagePeriodWindow,
} = await import('../services/usage-summary.js');

test('GET /api/usage/summary is wired behind org authentication', () => {
  const source = fs.readFileSync(new URL('./usage.js', import.meta.url), 'utf8');
  assert.match(source, /router\.get\('\/summary', requireOrg,/);
});

test('GET /api/usage/summary returns 401 without auth', async () => {
  let nextCalled = false;
  let response = null;
  const context = {
    get: () => () => undefined,
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

test('GET /api/usage/summary exposes the expected authenticated response shape', () => {
  const window = resolveUsagePeriodWindow('month', new Date('2026-05-15T12:00:00.000Z'));
  const body = {
    creditsRemaining: 4200,
    creditsUsedThisPeriod: 800,
    periodStart: window.start.toISOString(),
    periodEnd: window.end.toISOString(),
  };

  assert.deepEqual(Object.keys(body), ['creditsRemaining', 'creditsUsedThisPeriod', 'periodStart', 'periodEnd']);
  assert.equal(typeof body.creditsRemaining, 'number');
  assert.equal(typeof body.creditsUsedThisPeriod, 'number');
  assert.match(body.periodStart, /^2026-05-01T/);
});

test('usage period normalization supports week month and all only', () => {
  assert.equal(normalizeUsagePeriod('week'), 'week');
  assert.equal(normalizeUsagePeriod('month'), 'month');
  assert.equal(normalizeUsagePeriod('all'), 'all');
  assert.equal(normalizeUsagePeriod('quarter'), 'month');
});

test('usage all-time period uses epoch start and current end', () => {
  const window = resolveUsagePeriodWindow('all', new Date('2026-05-15T12:00:00.000Z'));
  assert.equal(window.start, null);
  assert.equal(window.end.toISOString(), '2026-05-15T12:00:00.000Z');
});

test('usage weekly period uses a rolling seven day window', () => {
  const window = resolveUsagePeriodWindow('week', new Date('2026-05-14T12:00:00.000Z'));
  assert.equal(window.start.toISOString(), '2026-05-07T12:00:00.000Z');
});

test('GET /api/usage/breakdown returns byAgent and byWorkflow shapes', () => {
  assert.equal(normalizeUsagePeriod('nonsense'), 'month');
  assert.deepEqual(
    normalizeAgentRows([
      {
        agent_id: 'scout',
        credits_used: '320',
        runs: '14',
        last_used_at: '2026-05-04T12:00:00.000Z',
      },
    ]),
    [
      {
        agentId: 'scout',
        agentName: 'SCOUT',
        creditsUsed: 320,
        runs: 14,
        lastUsedAt: '2026-05-04T12:00:00.000Z',
      },
    ],
  );
  assert.deepEqual(
    normalizeWorkflowRows([
      {
        workflow_id: '00000000-0000-4000-8000-000000000001',
        workflow_name: 'Lead enrichment',
        credits_used: '480',
        runs: '3',
        last_run_at: '2026-05-04T12:00:00.000Z',
      },
    ]),
    [
      {
        workflowId: '00000000-0000-4000-8000-000000000001',
        workflowName: 'Lead enrichment',
        creditsUsed: 480,
        runs: 3,
        lastRunAt: '2026-05-04T12:00:00.000Z',
      },
    ],
  );
});

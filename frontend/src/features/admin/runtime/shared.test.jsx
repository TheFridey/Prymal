import { diffReceipt, summarizeDetail } from './shared';

test('diffReceipt returns only changed fields', () => {
  expect(
    diffReceipt(
      { plan: 'pro', seatLimit: 5, metadata: { focus: 'sales' } },
      { plan: 'teams', seatLimit: 5, metadata: { focus: 'support' } },
    ),
  ).toEqual([
    { key: 'plan', before: 'pro', after: 'teams' },
    { key: 'metadata', before: { focus: 'sales' }, after: { focus: 'support' } },
  ]);
});

test('summarizeDetail produces a concise humanized preview', () => {
  expect(
    summarizeDetail({
      reviewedAgentId: 'ledger',
      policyClass: 'premium_reasoning',
      fallbackModel: 'claude-sonnet-4-6',
    }),
  ).toContain('ledger');
});

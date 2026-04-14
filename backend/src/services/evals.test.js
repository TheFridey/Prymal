import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  compareModelRuns,
  evaluateAgentOutput,
  evaluateStructuredOutput,
} = await import('./evals.js');

test('evaluateAgentOutput scores grounded source-backed lore output positively', () => {
  const evaluation = evaluateAgentOutput({
    agentId: 'lore',
    text: 'According to the pricing document, the Teams plan includes five seats. Source: Pricing handbook.',
    sources: [{ documentTitle: 'Pricing handbook', sourceType: 'pdf' }],
    usedTools: ['lore_search'],
  });

  assert.equal(evaluation.groundedness, 'well_grounded');
  assert.equal(evaluation.hallucinationRisk, 'low');
  assert.equal(evaluation.score >= 70, true);
});

test('evaluateStructuredOutput detects required JSON output blocks', () => {
  assert.equal(
    evaluateStructuredOutput({
      text: '```json\n{"agent":"cipher","summary":"ok"}\n```',
      structuredOutput: 'json_scorecard',
    }),
    true,
  );
});

test('compareModelRuns aggregates model comparison metrics', () => {
  const rows = [
    {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      outcomeStatus: 'succeeded',
      latencyMs: 1000,
      totalTokens: 2000,
      estimatedCostUsd: 0.01,
      metadata: { evaluation: { groundedness: 'well_grounded' } },
    },
    {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      outcomeStatus: 'failed',
      latencyMs: 1500,
      totalTokens: 1000,
      estimatedCostUsd: 0.005,
      metadata: { evaluation: { groundedness: 'ungrounded' } },
    },
  ];

  const comparison = compareModelRuns(rows);

  assert.equal(comparison.length, 1);
  assert.equal(comparison[0].successRate, 0.5);
  assert.equal(comparison[0].failureRate, 0.5);
});

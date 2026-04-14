import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { buildAgentScorecards } = await import('./agent-scorecards.js');

test('buildAgentScorecards aggregates usage, fallback, and citation metrics per agent', () => {
  const scorecards = buildAgentScorecards([
    {
      agentId: 'cipher',
      provider: 'openai',
      model: 'gpt-4.1',
      outcomeStatus: 'succeeded',
      fallbackUsed: false,
      latencyMs: 1200,
      totalTokens: 2500,
      estimatedCostUsd: 0.02,
      metadata: {
        evaluation: {
          citationRate: 1,
          groundedness: 'well_grounded',
          structuredOutputPass: true,
          hallucinationRisk: 'low',
          instructionAdherence: 'pass',
          toolUsePass: true,
        },
      },
    },
    {
      agentId: 'cipher',
      provider: 'openai',
      model: 'gpt-4.1',
      outcomeStatus: 'failed',
      failureClass: 'timeout',
      fallbackUsed: true,
      latencyMs: 2200,
      totalTokens: 500,
      estimatedCostUsd: 0.003,
      metadata: {
        evaluation: {
          citationRate: 0,
          groundedness: 'ungrounded',
          structuredOutputPass: false,
          hallucinationRisk: 'high',
          instructionAdherence: 'warn',
          toolUsePass: true,
        },
      },
    },
  ]);

  assert.equal(scorecards.length, 1);
  assert.equal(scorecards[0].agentId, 'cipher');
  assert.equal(scorecards[0].usageCount, 2);
  assert.equal(scorecards[0].completionSuccessRate, 0.5);
  assert.equal(scorecards[0].fallbackRate, 0.5);
  assert.equal(scorecards[0].errorRate, 0.5);
  assert.equal(scorecards[0].topFailureClasses[0].failureClass, 'timeout');
});

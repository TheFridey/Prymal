import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { buildAgentScorecards } = await import('./agent-scorecards.js');

test('buildAgentScorecards aggregates governance, repair, and fallback metrics per agent', () => {
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
        policyClass: 'premium_reasoning',
        schemaValidation: { verdict: 'pass' },
        contract: {
          escalationRules: {
            repairLoopCountField: 'cipher_repair_loops',
          },
        },
        routing: {
          policyClass: 'premium_reasoning',
          schemaRepair: { attempts: 0 },
          toolValidation: { valid: true },
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
        code: 'CONTRACT_TOOL_VIOLATION',
        evaluation: {
          citationRate: 0,
          groundedness: 'ungrounded',
          structuredOutputPass: false,
          hallucinationRisk: 'high',
          instructionAdherence: 'warn',
          toolUsePass: false,
          usageMetrics: {
            cipher_repair_loops: 2,
          },
        },
        schemaValidation: { verdict: 'failed' },
        sentinelReview: {
          verdict: 'HOLD',
          hold_reason: 'Structured output validation failed and could not be repaired safely.',
        },
        policyClass: 'premium_reasoning',
        contract: {
          escalationRules: {
            repairLoopCountField: 'cipher_repair_loops',
          },
        },
        routing: {
          policyClass: 'premium_reasoning',
          schemaRepair: { attempts: 1 },
          toolValidation: { valid: false },
        },
      },
    },
    {
      agentId: 'cipher',
      provider: 'anthropic',
      model: 'claude-sonnet',
      outcomeStatus: 'succeeded',
      fallbackUsed: false,
      latencyMs: 800,
      totalTokens: 1400,
      estimatedCostUsd: 0.01,
      metadata: {
        evaluation: {
          citationRate: 1,
          groundedness: 'partially_grounded',
          structuredOutputPass: true,
          hallucinationRisk: 'low',
          instructionAdherence: 'pass',
          toolUsePass: true,
        },
        schemaValidation: { verdict: 'repaired' },
        sentinelReview: {
          verdict: 'REPAIR',
        },
        policyClass: 'grounded_research',
        routing: {
          policyClass: 'grounded_research',
          schemaRepair: { attempts: 1 },
          toolValidation: { valid: true },
        },
      },
    },
  ]);

  assert.equal(scorecards.length, 1);
  assert.equal(scorecards[0].agentId, 'cipher');
  assert.equal(scorecards[0].usageCount, 3);
  assert.equal(scorecards[0].completionSuccessRate, 0.6667);
  assert.equal(scorecards[0].fallbackRate, 0.3333);
  assert.equal(scorecards[0].errorRate, 0.3333);
  assert.equal(scorecards[0].holdRate, 0);
  assert.equal(scorecards[0].schemaRepairRate, 0.3333);
  assert.equal(scorecards[0].schemaFailureRate, 0.3333);
  assert.equal(scorecards[0].repairLoopRate, 0.6667);
  assert.equal(scorecards[0].averageRepairLoops, 1);
  assert.equal(scorecards[0].toolPolicyViolationRate, 0.3333);
  assert.equal(scorecards[0].blockedToolAttemptRate, 0.3333);
  assert.equal(scorecards[0].sentinelInterventionRate, 0.6667);
  assert.equal(scorecards[0].dominantPolicyClass, 'premium_reasoning');
  assert.equal(scorecards[0].topFailureClasses[0].failureClass, 'timeout');
  assert.equal(scorecards[0].topHoldReasons[0].reason, 'Structured output validation failed and could not be repaired safely.');
});

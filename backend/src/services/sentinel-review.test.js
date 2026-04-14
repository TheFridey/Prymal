import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewAgentOutputWithSentinel, shouldRunSentinelReview } from './sentinel-review.js';

test('shouldRunSentinelReview activates only for eligible plans and agents', () => {
  assert.equal(shouldRunSentinelReview({ agentId: 'cipher', orgPlan: 'pro' }), true);
  assert.equal(shouldRunSentinelReview({ agentId: 'cipher', orgPlan: 'solo' }), false);
  assert.equal(shouldRunSentinelReview({ agentId: 'lore', orgPlan: 'agency' }), false);
});

test('reviewAgentOutputWithSentinel returns PASS for grounded, compliant output', () => {
  const review = reviewAgentOutputWithSentinel({
    agentId: 'cipher',
    orgPlan: 'teams',
    assistantText: 'Summary with cited evidence.',
    sources: [{ documentTitle: 'Board pack Q1' }],
    schemaValidation: { verdict: 'pass' },
    evaluation: {
      groundedness: 'well_grounded',
      hallucinationRisk: 'low',
      toolUsePass: true,
      instructionAdherence: 'pass',
    },
  });

  assert.equal(review.verdict, 'PASS');
  assert.equal(review.hold_reason, null);
  assert.equal(review.checks.accuracy.pass, true);
});

test('reviewAgentOutputWithSentinel returns REPAIR when schema was auto-repaired', () => {
  const review = reviewAgentOutputWithSentinel({
    agentId: 'vance',
    orgPlan: 'pro',
    assistantText: 'Structured deal summary.',
    sources: [{ documentTitle: 'Discovery notes' }],
    schemaValidation: { verdict: 'repaired', repairNotes: 'Auto-repaired missing fields: confidence, nextStep' },
    evaluation: {
      groundedness: 'partially_grounded',
      hallucinationRisk: 'medium',
      toolUsePass: true,
      instructionAdherence: 'warn',
    },
  });

  assert.equal(review.verdict, 'REPAIR');
  assert.ok(review.repair_actions.length >= 1);
  assert.equal(review.hold_reason, null);
});

test('reviewAgentOutputWithSentinel returns HOLD for ungrounded high-risk output', () => {
  const review = reviewAgentOutputWithSentinel({
    agentId: 'ledger',
    orgPlan: 'agency',
    assistantText: 'This definitely proves your reported numbers are correct.',
    sources: [],
    schemaValidation: { verdict: 'failed' },
    evaluation: {
      groundedness: 'ungrounded',
      hallucinationRisk: 'high',
      toolUsePass: true,
      instructionAdherence: 'failed',
    },
  });

  assert.equal(review.verdict, 'HOLD');
  assert.ok(review.riskScore >= 0.8);
  assert.match(review.hold_reason, /validation failed|approval threshold|grounding confidence/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMemoryPromotion } from './memory-promotion.js';
import { reviewMemoryCandidate } from './memory-safety.js';
import { getMemoryPolicyForAgent } from './memory-policies.js';

test('reviewMemoryCandidate rejects obvious secrets', () => {
  const verdict = reviewMemoryCandidate({
    content: 'here is the token sk-proj-abcdefghijklmnopqrstuvwxyz0123456789abc',
    memorySourceKind: 'conversation',
  });
  assert.equal(verdict.status, 'rejected');
  assert.ok(verdict.sentinelRequired);
});

test('evaluateMemoryPromotion promotes repeated session preference', () => {
  const decision = evaluateMemoryPromotion(
    { scope: 'temporary_session', memoryType: 'user_preference', confidence: 0.8 },
    { repetitionCount: 3, explicitUserInstruction: true },
  );
  assert.equal(decision.shouldPromote, true);
});

test('getMemoryPolicyForAgent returns bounded defaults', () => {
  const policy = getMemoryPolicyForAgent('lore');
  assert.ok(policy.maxMemories > 0);
  assert.ok(Array.isArray(policy.preferredTypes));
});

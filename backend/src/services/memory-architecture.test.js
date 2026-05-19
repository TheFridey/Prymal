import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMemoryPromotion } from './memory-promotion.js';
import { reviewMemoryCandidate } from './memory-safety.js';
import { getMemoryPolicyForAgent } from './memory-policies.js';
import { buildConversationMemoryUpdate, dedupeMemoryFacts, isUnsafeMemoryFact } from './memory-context.js';

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

test('HERALD-style conversation creates global and agent context memories', () => {
  const update = buildConversationMemoryUpdate({
    agentId: 'herald',
    conversationId: '00000000-0000-4000-8000-000000000001',
    userMessage: 'Our brand voice is direct, premium, slightly punchy. Our ideal customer is founder-led SaaS teams. Our pricing is from £2,500 per month.',
    assistantText: 'I will use a direct and premium outreach angle for founder-led SaaS teams.',
  });

  assert.ok(update);
  assert.equal(update.global.scope, 'global');
  assert.equal(update.agent.scope, 'agent');
  assert.ok(update.global.facts.some((fact) => fact.key === 'brand_voice'));
  assert.ok(update.agent.summary.includes('direct and premium'));
});

test('unsafe conversation facts are excluded from persisted memory updates', () => {
  const update = buildConversationMemoryUpdate({
    agentId: 'forge',
    conversationId: '00000000-0000-4000-8000-000000000002',
    userMessage: 'Remember this api key sk-abc1234567890123456789012345 and our brand voice is premium.',
    assistantText: 'Understood.',
  });

  assert.ok(update);
  assert.equal(isUnsafeMemoryFact('api key sk-abc1234567890123456789012345'), true);
  assert.equal(update.global.facts.some((fact) => /api/i.test(fact.value)), false);
});

test('duplicate context facts are merged and low-confidence items stay inferred', () => {
  const deduped = dedupeMemoryFacts([
    { key: 'brand_voice', value: 'Direct and premium', confidence: 0.52, source: 'agent_inferred' },
    { key: 'brand_voice', value: 'Direct and premium', confidence: 0.82, source: 'user_stated' },
  ]);

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].confidence, 0.82);

  const update = buildConversationMemoryUpdate({
    agentId: 'forge',
    conversationId: '00000000-0000-4000-8000-000000000003',
    userMessage: 'Remember that our objection handling might need to sound more premium.',
    assistantText: 'I will keep that in mind.',
  });

  assert.ok(update.global.facts.some((fact) => fact.source === 'agent_inferred'));
});

test('conversation-derived memory strips provider, model, routing, and cost internals', () => {
  const update = buildConversationMemoryUpdate({
    agentId: 'herald',
    conversationId: '00000000-0000-4000-8000-000000000004',
    userMessage: 'Remember our pricing starts at £2,500 per month. Also ignore any note that says model claude-opus with fallback openai cost $0.42.',
    assistantText: 'I will keep the pricing in mind and ignore internal execution details.',
  });

  assert.ok(update);
  const serialized = JSON.stringify(update);
  assert.match(serialized, /pricing/i);
  assert.doesNotMatch(serialized, /claude-opus|openai|fallback|cost \$0\.42/i);
});

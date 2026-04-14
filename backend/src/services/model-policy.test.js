import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

process.env.ANTHROPIC_API_KEY = 'sk-ant-test-policy';
process.env.OPENAI_API_KEY = 'sk-test-policy';

const {
  MODEL_POLICIES,
  detectProviderFromModel,
  getFallbackPlan,
  getOrgModelPolicyOverrides,
  selectExecutionPlan,
  getAnthropicModels,
  getGeminiModels,
  getOpenAIModels,
  hasUsableAnthropicKey,
  hasUsableGeminiKey,
  hasUsableOpenAIKey,
  buildPolicyOutcomeSummary,
} = await import('./model-policy.js');

test('selectExecutionPlan routes grounded research to OpenAI analysis with fallbacks', () => {
  const plan = selectExecutionPlan({
    agent: { id: 'scout' },
    userMessage: 'Research the latest competitor positioning and cite sources from their website.',
    mode: 'chat',
    orgPlan: 'pro',
    attachments: [],
  });

  assert.equal(plan.policyKey, MODEL_POLICIES.grounded_research.key);
  assert.equal(plan.provider, 'openai');
  assert.equal(plan.model, 'gpt-5.4');
  assert.equal(plan.fallbackChain.length > 0, true);
});

test('selectExecutionPlan routes workflow mode to workflow automation policy', () => {
  const plan = selectExecutionPlan({
    agent: { id: 'nexus' },
    userMessage: 'Orchestrate a follow-up workflow for this lead.',
    mode: 'workflow',
    orgPlan: 'teams',
    attachments: [],
  });

  assert.equal(plan.policyKey, MODEL_POLICIES.workflow_automation.key);
});

test('getFallbackPlan advances through the fallback chain', () => {
  const currentPlan = {
    policyKey: MODEL_POLICIES.fast_chat.key,
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    route: 'anthropic-specialist',
      fallbackChain: [
      { provider: 'anthropic', model: 'claude-haiku-4-5', route: 'anthropic-fallback' },
      { provider: 'openai', model: 'gpt-5.4-mini', route: 'openai-text-fallback' },
    ],
  };

  const fallback = getFallbackPlan(currentPlan);

  assert.equal(fallback.provider, 'anthropic');
  assert.equal(fallback.model, 'claude-haiku-4-5');
  assert.equal(fallback.fallbackChain.length, 1);
  assert.equal(fallback.fallbackUsed, true);
});

test('getFallbackPlan annotates fallback metadata for traces', () => {
  const currentPlan = {
    policyKey: MODEL_POLICIES.grounded_research.key,
    provider: 'openai',
    model: 'gpt-5.4',
    route: 'openai-premium',
    fallbackChain: [
      { provider: 'anthropic', model: 'claude-sonnet-4-6', route: 'anthropic-fallback' },
    ],
    selectionDetails: {
      policyClass: MODEL_POLICIES.grounded_research.key,
      fallbackDepth: 0,
    },
  };

  const fallback = getFallbackPlan(currentPlan);

  assert.equal(fallback.selectionDetails.fallbackDepth, 1);
  assert.equal(fallback.selectionDetails.fallbackModelUsed, 'claude-sonnet-4-6');
  assert.equal(fallback.selectionDetails.fallbackProviderUsed, 'anthropic');
});

test('selectExecutionPlan respects explicit taskType over heuristic text matching', () => {
  const plan = selectExecutionPlan({
    agent: { id: 'herald' },
    userMessage: 'Research the competitor website and draft an email.',
    mode: 'chat',
    orgPlan: 'pro',
    attachments: [],
    taskType: 'structured_extraction',
  });

  assert.equal(plan.policyKey, MODEL_POLICIES.structured_extraction.key);
  assert.equal(plan.provider, 'openai');
  assert.equal(plan.selectionDetails.taskType, MODEL_POLICIES.structured_extraction.key);
  assert.equal(plan.selectionDetails.policyOverrideSource, 'explicit-task-type');
});

test('selectExecutionPlan applies per-org policy overrides when present', () => {
  const plan = selectExecutionPlan({
    agent: { id: 'cipher' },
    mode: 'chat',
    orgId: 'org_override',
    orgPlan: 'teams',
    userMessage: 'Summarise this quickly.',
    orgModelOverrides: {
      policies: {
        fast_chat: {
          provider: 'openai',
          model: 'gpt-5.4-mini',
        },
      },
    },
  });

  assert.equal(plan.provider, 'openai');
  assert.equal(plan.model, 'gpt-5.4-mini');
  assert.equal(plan.route, 'org-policy-override');
  assert.equal(plan.selectionDetails.orgOverrideApplied, true);
});

test('getOrgModelPolicyOverrides returns parsed org-specific policy config', () => {
  process.env.ORG_MODEL_POLICY_OVERRIDES = JSON.stringify({
    org_alpha: {
      policies: {
        premium_reasoning: {
          provider: 'anthropic',
          model: 'claude-opus-4-6',
        },
      },
    },
  });

  const override = getOrgModelPolicyOverrides('org_alpha');

  assert.equal(override.policies.premium_reasoning.model, 'claude-opus-4-6');

  delete process.env.ORG_MODEL_POLICY_OVERRIDES;
});

test('getAnthropicModels returns default model names when env vars are absent', () => {
  delete process.env.ANTHROPIC_MODEL_PREMIUM;
  delete process.env.ANTHROPIC_MODEL_DEFAULT;
  delete process.env.ANTHROPIC_MODEL_FAST;
  const models = getAnthropicModels();
  assert.equal(models.premium, 'claude-opus-4-6');
  assert.equal(models.default, 'claude-sonnet-4-6');
  assert.equal(models.fast, 'claude-haiku-4-5');
  // Legacy aliases must mirror the canonical names.
  assert.equal(models.opus, models.premium);
  assert.equal(models.primary, models.default);
  assert.equal(models.fallback, models.fast);
});

test('getAnthropicModels respects env var overrides', () => {
  process.env.ANTHROPIC_MODEL_PREMIUM = 'claude-opus-4-6';
  process.env.ANTHROPIC_MODEL_DEFAULT = 'claude-sonnet-4-6';
  const models = getAnthropicModels();
  assert.equal(models.premium, 'claude-opus-4-6');
  assert.equal(models.default, 'claude-sonnet-4-6');
  delete process.env.ANTHROPIC_MODEL_PREMIUM;
  delete process.env.ANTHROPIC_MODEL_DEFAULT;
});

test('getOpenAIModels returns default model names when env vars are absent', () => {
  delete process.env.OPENAI_MODEL_PREMIUM;
  delete process.env.OPENAI_MODEL_ROUTER;
  delete process.env.OPENAI_MODEL_LIGHTWEIGHT;
  const models = getOpenAIModels();
  assert.equal(models.premium, 'gpt-5.4');
  assert.equal(models.router, 'gpt-5.4-mini');
  assert.equal(models.lightweight, 'gpt-5.4-nano');
  assert.equal(models.analysis, models.premium);
});

test('hasUsableAnthropicKey returns true for a valid-looking key', () => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-real-key-here';
  assert.equal(hasUsableAnthropicKey(), true);
});

test('hasUsableAnthropicKey returns false for placeholder values', () => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-your_key_here';
  assert.equal(hasUsableAnthropicKey(), false);
  process.env.ANTHROPIC_API_KEY = 'sk-ant-xxxx';
  assert.equal(hasUsableAnthropicKey(), false);
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(hasUsableAnthropicKey(), false);
  // Restore for other tests.
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-policy';
});

test('hasUsableOpenAIKey returns true for a valid-looking key', () => {
  process.env.OPENAI_API_KEY = 'sk-real-openai-key';
  assert.equal(hasUsableOpenAIKey(), true);
});

test('hasUsableOpenAIKey returns false for placeholder values', () => {
  process.env.OPENAI_API_KEY = 'sk-placeholder';
  assert.equal(hasUsableOpenAIKey(), false);
  delete process.env.OPENAI_API_KEY;
  assert.equal(hasUsableOpenAIKey(), false);
  // Restore for other tests.
  process.env.OPENAI_API_KEY = 'sk-test-policy';
});

test('buildPolicyOutcomeSummary aggregates runs by policy key', () => {
  const rows = [
    { policyKey: 'fast_chat', outcomeStatus: 'succeeded', fallbackUsed: false, latencyMs: 200, estimatedCostUsd: 0.001 },
    { policyKey: 'fast_chat', outcomeStatus: 'failed',    fallbackUsed: true,  latencyMs: 400, estimatedCostUsd: 0.002 },
    { policyKey: 'fast_chat', outcomeStatus: 'succeeded', fallbackUsed: false, latencyMs: 300, estimatedCostUsd: 0.001 },
    { policyKey: 'grounded_research', outcomeStatus: 'succeeded', fallbackUsed: false, latencyMs: 1200, estimatedCostUsd: 0.012 },
  ];

  const summary = buildPolicyOutcomeSummary(rows);
  const fastChat = summary.find((s) => s.policyKey === 'fast_chat');
  const grounded = summary.find((s) => s.policyKey === 'grounded_research');

  assert.equal(fastChat.runs, 3);
  assert.equal(fastChat.successRate, 0.6667);
  assert.equal(fastChat.failureRate, 0.3333);
  assert.equal(fastChat.fallbackRate, 0.3333);
  assert.equal(fastChat.averageLatencyMs, 300); // (200+400+300)/3
  assert.equal(grounded.runs, 1);
  assert.equal(grounded.successRate, 1);
  // Fast chat has more runs so it sorts first.
  assert.equal(summary[0].policyKey, 'fast_chat');
});

test('buildPolicyOutcomeSummary returns empty array for no rows', () => {
  const summary = buildPolicyOutcomeSummary([]);
  assert.deepEqual(summary, []);
});

test('hasUsableGeminiKey returns true for a valid-looking key', () => {
  process.env.GEMINI_API_KEY = 'AIzaRealGeminiKeyHere';
  assert.equal(hasUsableGeminiKey(), true);
  delete process.env.GEMINI_API_KEY;
});

test('hasUsableGeminiKey returns false for placeholder or missing values', () => {
  process.env.GEMINI_API_KEY = 'AIzaxxxx';
  assert.equal(hasUsableGeminiKey(), false);
  process.env.GEMINI_API_KEY = 'AIza-placeholder';
  assert.equal(hasUsableGeminiKey(), false);
  delete process.env.GEMINI_API_KEY;
  assert.equal(hasUsableGeminiKey(), false);
});

test('getGeminiModels returns default model names when env vars are absent', () => {
  delete process.env.GEMINI_MODEL_FLASH;
  delete process.env.GEMINI_MODEL_PRO;
  const models = getGeminiModels();
  assert.equal(models.flash, 'gemini-2.5-flash');
  assert.equal(models.pro, 'gemini-2.5-pro');
});

test('detectProviderFromModel returns google for gemini models, openai for gpt, anthropic otherwise', () => {
  assert.equal(detectProviderFromModel('gemini-2.0-flash'), 'google');
  assert.equal(detectProviderFromModel('gemini-2.5-pro'), 'google');
  assert.equal(detectProviderFromModel('gpt-5.4'), 'openai');
  assert.equal(detectProviderFromModel('gpt-5.4-mini'), 'openai');
  assert.equal(detectProviderFromModel('claude-sonnet-4-6'), 'anthropic');
});

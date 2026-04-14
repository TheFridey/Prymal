import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  classifyLLMFailure,
  estimateCostUsd,
  estimateModelCostUsd,
} = await import('./llm-observability.js');

test('estimateModelCostUsd computes provider/model cost estimates', () => {
  const estimate = estimateModelCostUsd({
    provider: 'openai',
    model: 'gpt-5.4',
    promptTokens: 100_000,
    completionTokens: 50_000,
  });

  assert.equal(estimate, 0.6);
});

test('classifyLLMFailure maps common failure classes', () => {
  assert.equal(classifyLLMFailure({ code: 'RATE_LIMIT_EXCEEDED' }), 'rate_limit');
  assert.equal(classifyLLMFailure({ code: 'MODEL_INVALID' }), 'configuration');
  assert.equal(classifyLLMFailure({ code: 'AUTH_FAILED' }), 'auth');
  assert.equal(classifyLLMFailure({ code: 'TIMEOUT' }), 'timeout');
});

test('estimateCostUsd calculates Gemini 2.0 Flash pricing', () => {
  const estimate = estimateCostUsd('google', 'gemini-2.0-flash', 1_000, 500);

  assert.equal(estimate, 0.0003);
});

test('estimateCostUsd calculates Gemini 2.5 Pro pricing', () => {
  const estimate = estimateCostUsd('google', 'gemini-2.5-pro', 1_000, 500);

  assert.equal(estimate, 0.00625);
});

test('estimateCostUsd returns null for unknown Gemini models', () => {
  const estimate = estimateCostUsd('google', 'gemini-experimental-unknown', 1_000, 500);

  assert.equal(estimate, null);
});

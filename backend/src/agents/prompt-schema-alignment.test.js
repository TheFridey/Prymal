import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { AGENTS } = await import('./config.js');
const { validateAgentOutput } = await import('../services/agent-output-validator.js');

function extractLastJsonBlock(text) {
  const matches = [...String(text ?? '').matchAll(/```json\s*([\s\S]*?)```/gi)];
  return matches.length > 0 ? matches[matches.length - 1][1].trim() : null;
}

test('every agent prompt example matches its structured output contract', () => {
  for (const [agentId, agent] of Object.entries(AGENTS)) {
    const example = extractLastJsonBlock(agent.systemPrompt);

    assert.ok(example, `Expected ${agentId} to include a JSON example in its system prompt.`);

    const validation = validateAgentOutput(agentId, example);

    assert.equal(
      validation.verdict,
      'pass',
      `${agentId} prompt example failed validation: ${validation.errors.join('; ')}`,
    );
  }
});

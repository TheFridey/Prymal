import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { cosineSimilarity, getLogicalMemoryKey, ruleBasedConflictSignals } = await import('./memory-contradictions.js');

test('cosineSimilarity returns 1 for identical vectors', () => {
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
});

test('cosineSimilarity returns 0 for orthogonal vectors', () => {
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test('ruleBasedConflictSignals detects tone polarity mismatch', () => {
  const left = 'Keep answers formal and concise.';
  const right = 'Prefer casual and playful wording.';
  const result = ruleBasedConflictSignals(left, right, 'preference');
  assert.equal(result.contradicts, true);
  assert.match(result.reason ?? '', /tone_polarity/);
});

test('ruleBasedConflictSignals ignores unrelated preferences', () => {
  const left = 'Use bullet lists for summaries.';
  const right = 'Always cite sources when quoting.';
  const result = ruleBasedConflictSignals(left, right, 'preference');
  assert.equal(result.contradicts, false);
});

test('logical memory key falls back to metadata for superseded or review records', () => {
  assert.equal(
    getLogicalMemoryKey({ key: 'brand_voice__candidate__123', metadata: { logicalKey: 'brand_voice' } }),
    'brand_voice',
  );
  assert.equal(getLogicalMemoryKey({ key: 'brand_voice' }), 'brand_voice');
});

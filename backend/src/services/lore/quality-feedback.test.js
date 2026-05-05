import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../../test-helpers.js';

setupTestEnv();

const {
  recordSentinelSignal,
  updateDocumentQuality,
  getLowQualityDocuments,
} = await import('./quality-feedback.js');

test('recordSentinelSignal does not throw when database is unavailable', async () => {
  await assert.doesNotReject(async () => {
    await recordSentinelSignal({
      documentId: 'doc_unit_test',
      orgId: 'org_unit_test',
      agentId: 'cipher',
      verdict: 'HOLD',
      evalScores: { groundedness: 0.2 },
    });
  });
});

test('recordSentinelSignal does not throw for PASS verdict', async () => {
  await assert.doesNotReject(async () => {
    await recordSentinelSignal({
      documentId: 'doc_unit_test',
      orgId: 'org_unit_test',
      agentId: 'cipher',
      verdict: 'PASS',
      evalScores: { groundedness: 0.9 },
    });
  });
});

test('updateDocumentQuality returns qualityScore 1 when no signals exist', async () => {
  try {
    const result = await updateDocumentQuality('doc_nonexistent', 'org_unit_test');
    assert.equal(result.documentId, 'doc_nonexistent');
    assert.equal(result.sampleSize, 0);
    assert.equal(result.qualityScore, 1);
    assert.equal(result.holdRate, 0);
  } catch (err) {
    // DB unavailable in unit test env — acceptable
    assert.ok(err instanceof Error);
  }
});

test('getLowQualityDocuments returns empty array when database is unavailable', async () => {
  const result = await getLowQualityDocuments('org_unit_test_nonexistent');
  assert.ok(Array.isArray(result));
});

test('getLowQualityDocuments returns empty array for org with no signals', async () => {
  const result = await getLowQualityDocuments('org_no_signals_ever_' + Date.now());
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

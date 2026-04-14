import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  buildVersionLineage,
  computeAuthorityScore,
  computeContradictionSignals,
  computeFreshnessScore,
} = await import('./rag.js');

test('computeFreshnessScore prefers recently verified documents', () => {
  const freshScore = computeFreshnessScore(new Date().toISOString(), {});
  const staleScore = computeFreshnessScore(new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(), {});
  const verifiedScore = computeFreshnessScore(
    new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
    { verifiedAt: new Date().toISOString() },
  );

  assert.equal(freshScore, 1);
  assert.equal(staleScore, 0.1575);
  assert.equal(verifiedScore, 1);
});

test('computeAuthorityScore rewards verified trusted sources and penalizes contradictions', () => {
  const verified = computeAuthorityScore({
    trustScore: 0.72,
    sourceType: 'pdf',
    metadata: { verified: true },
  });
  const contradicted = computeAuthorityScore({
    trustScore: 0.72,
    sourceType: 'url',
    metadata: { contradictionCount: 3 },
  });

  assert.ok(verified > contradicted);
  assert.equal(verified, 0.86);
});

test('buildVersionLineage marks superseded document chains', () => {
  const lineage = buildVersionLineage({
    documentId: 'doc_v1',
    documentVersion: 1,
    metadata: {
      versionChainId: 'chain_1',
      supersedesDocumentId: 'doc_v0',
      latestVersion: 2,
      isLatestVersion: false,
    },
  });

  assert.equal(lineage.versionChainId, 'chain_1');
  assert.equal(lineage.isSuperseded, true);
  assert.equal(lineage.version, 1);
});

test('computeContradictionSignals surfaces numeric conflicts and newer versions', () => {
  const candidate = {
    id: 'chunk_a',
    documentId: 'doc_a',
    documentTitle: 'Q1 Forecast',
    documentVersion: 1,
    content: 'Revenue is 120 and margin is 40.',
    metadata: { versionChainId: 'forecast_chain', isLatestVersion: false },
  };

  const rows = [
    candidate,
    {
      id: 'chunk_b',
      documentId: 'doc_b',
      documentTitle: 'Q1 Forecast',
      documentVersion: 2,
      content: 'Revenue is 140 and margin is 40.',
      metadata: { versionChainId: 'forecast_chain', isLatestVersion: true },
    },
  ];

  const signals = computeContradictionSignals(candidate, rows);

  assert.deepEqual(
    signals.map((signal) => signal.type),
    ['numeric_conflict'],
  );
});

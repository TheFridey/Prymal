import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  buildVersionLineage,
  computeAuthorityScore,
  computeContradictionSignals,
  computeFreshnessScore,
  normalizeEmbeddingResponseEntries,
  normalizeExecuteRows,
  rankLoreRows,
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

test('normalizeExecuteRows accepts both drizzle execute result shapes', () => {
  assert.deepEqual(
    normalizeExecuteRows({ rows: [{ id: 'row_a' }] }),
    [{ id: 'row_a' }],
  );
  assert.deepEqual(
    normalizeExecuteRows([{ id: 'row_b' }]),
    [{ id: 'row_b' }],
  );
  assert.deepEqual(normalizeExecuteRows(undefined), []);
});

test('normalizeEmbeddingResponseEntries handles SDK and array responses', () => {
  assert.deepEqual(
    normalizeEmbeddingResponseEntries({ data: [{ index: 0, embedding: [0.1, 0.2] }] }),
    [{ index: 0, embedding: [0.1, 0.2] }],
  );
  assert.deepEqual(
    normalizeEmbeddingResponseEntries([{ index: 1, embedding: [0.3, 0.4] }]),
    [{ index: 1, embedding: [0.3, 0.4] }],
  );
  assert.deepEqual(normalizeEmbeddingResponseEntries({ data: null }), []);
});

test('rankLoreRows labels lexical-only matches as fallback retrieval', () => {
  const rows = rankLoreRows(
    [
      {
        id: 'chunk_1',
        documentId: 'doc_1',
        content: 'Prymal business plans focus on launch, scale, and agent reliability.',
        chunkIndex: 0,
        metadata: {},
        documentTitle: 'Prymal Strategy',
        sourceType: 'manual',
        sourceUrl: null,
        documentVersion: 1,
        documentUpdatedAt: new Date().toISOString(),
        similarity: 0,
      },
    ],
    ['business', 'plans', 'launch'],
    1,
  );

  assert.equal(rows[0].retrievalMode, 'lexical_fallback');
  assert.equal(rows[0].confidenceLabel, 'low');
});

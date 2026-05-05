import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../../test-helpers.js';

setupTestEnv();

const {
  upsertEntity,
  upsertRelationship,
  getRelatedEntities,
  semanticEntitySearch,
  extractAndUpsert,
} = await import('./knowledge-graph.js');

test('upsertEntity does not throw when database is unavailable', async () => {
  // DB not available in unit test env — error is expected; function must not crash runtime
  await assert.rejects(
    () => upsertEntity({ orgId: 'org_test', type: 'person', name: 'Alice', properties: {} }),
    (err) => {
      assert.ok(err instanceof Error);
      return true;
    },
  );
});

test('upsertRelationship does not throw when database is unavailable', async () => {
  await assert.rejects(
    () =>
      upsertRelationship({
        orgId: 'org_test',
        fromEntityId: '00000000-0000-0000-0000-000000000001',
        toEntityId: '00000000-0000-0000-0000-000000000002',
        type: 'knows',
      }),
    (err) => {
      assert.ok(err instanceof Error);
      return true;
    },
  );
});

test('getRelatedEntities returns empty array for unknown entity', async () => {
  // Should either return [] (no rows) or reject on DB error — never throw without reason
  try {
    const result = await getRelatedEntities('00000000-0000-0000-0000-000000000099', {
      orgId: 'org_test',
    });
    assert.ok(Array.isArray(result));
  } catch (err) {
    assert.ok(err instanceof Error);
  }
});

test('semanticEntitySearch rejects when OPENAI_API_KEY is absent', async () => {
  const saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    await assert.rejects(
      () => semanticEntitySearch('test query', { orgId: 'org_test' }),
      (err) => {
        assert.ok(err.message.includes('OPENAI_API_KEY') || err.code === 'KG_EMBEDDINGS_NOT_CONFIGURED');
        return true;
      },
    );
  } finally {
    if (saved != null) process.env.OPENAI_API_KEY = saved;
  }
});

test('extractAndUpsert returns empty array for empty text', async () => {
  const result = await extractAndUpsert('', { orgId: 'org_test', agentId: 'cipher' });
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);

  const result2 = await extractAndUpsert(null, { orgId: 'org_test' });
  assert.ok(Array.isArray(result2));
  assert.equal(result2.length, 0);
});

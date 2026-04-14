import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  getTemporarySessionExpiryCutoff,
  pruneExpiredMemory,
} = await import('./memory-pruner.js');

test('getTemporarySessionExpiryCutoff defaults to a 24 hour fallback window', () => {
  const now = new Date('2026-04-06T12:00:00.000Z');
  const cutoff = getTemporarySessionExpiryCutoff({ now });

  assert.equal(cutoff.toISOString(), '2026-04-05T12:00:00.000Z');
});

test('pruneExpiredMemory returns a dry-run count without deleting rows', async () => {
  const loggerMessages = [];
  const repo = {
    async countExpiredTemporarySession() {
      return 12;
    },
  };

  const result = await pruneExpiredMemory({
    dryRun: true,
    repo,
    logger: {
      info(message) {
        loggerMessages.push(message);
      },
    },
  });

  assert.deepEqual(result, { pruned: 12, dryRun: true });
  assert.match(loggerMessages[0], /\[MEMORY-PRUNER\] Pruned 12 expired temporary_session records\./);
});

test('pruneExpiredMemory deletes expired session memory in batches', async () => {
  const deletedBatches = [];
  const pages = [
    ['mem_1', 'mem_2'],
    ['mem_3'],
    [],
  ];

  const repo = {
    async listExpiredTemporarySessionIds() {
      return pages.shift() ?? [];
    },
    async deleteMemoryIds(ids) {
      deletedBatches.push(ids);
      return ids.length;
    },
  };

  const result = await pruneExpiredMemory({
    batchSize: 2,
    repo,
    logger: { info() {} },
  });

  assert.deepEqual(result, { pruned: 3, dryRun: false });
  assert.deepEqual(deletedBatches, [['mem_1', 'mem_2'], ['mem_3']]);
});

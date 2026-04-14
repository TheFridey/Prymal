import { and, asc, count, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { getMemorySessionTtlHours } from '../env.js';
import { agentMemory } from '../db/schema.js';

function buildExpiredTemporarySessionPredicate({ now, staleBefore }) {
  return and(
    eq(agentMemory.scope, 'temporary_session'),
    or(
      lt(agentMemory.expiresAt, now),
      and(
        isNull(agentMemory.expiresAt),
        lt(agentMemory.updatedAt, staleBefore),
      ),
    ),
  );
}

function clampBatchSize(batchSize) {
  return Math.min(Math.max(Number(batchSize ?? 500), 1), 5_000);
}

function logPrunedCount(logger, pruned) {
  const message = `[MEMORY-PRUNER] Pruned ${pruned} expired temporary_session records.`;

  if (typeof logger?.info === 'function') {
    logger.info(message);
    return;
  }

  if (typeof logger?.log === 'function') {
    logger.log(message);
  }
}

export function getTemporarySessionExpiryCutoff({
  now = new Date(),
  ttlHours = getMemorySessionTtlHours(),
} = {}) {
  return new Date(now.getTime() - ttlHours * 60 * 60 * 1000);
}

export function createMemoryPrunerRepository(dbClient = db) {
  return {
    async countExpiredTemporarySession({ now, staleBefore }) {
      const [result] = await dbClient
        .select({ count: count() })
        .from(agentMemory)
        .where(buildExpiredTemporarySessionPredicate({ now, staleBefore }));

      return Number(result?.count ?? 0);
    },

    async listExpiredTemporarySessionIds({ now, staleBefore, limit }) {
      const rows = await dbClient
        .select({ id: agentMemory.id })
        .from(agentMemory)
        .where(buildExpiredTemporarySessionPredicate({ now, staleBefore }))
        .orderBy(asc(agentMemory.updatedAt))
        .limit(limit);

      return rows.map((row) => row.id);
    },

    async deleteMemoryIds(ids) {
      if (!ids.length) {
        return 0;
      }

      const deleted = await dbClient
        .delete(agentMemory)
        .where(inArray(agentMemory.id, ids))
        .returning({ id: agentMemory.id });

      return deleted.length;
    },
  };
}

// Prunes expired temporary_session memory records to prevent accumulation.
// Call pruneExpiredMemory() on a schedule or via the admin endpoint.
export async function pruneExpiredMemory({
  batchSize = 500,
  dryRun = false,
  now = new Date(),
  ttlHours = getMemorySessionTtlHours(),
  repo = createMemoryPrunerRepository(),
  logger = console,
} = {}) {
  const normalizedBatchSize = clampBatchSize(batchSize);
  const staleBefore = getTemporarySessionExpiryCutoff({ now, ttlHours });

  if (dryRun) {
    const pruned = await repo.countExpiredTemporarySession({ now, staleBefore });
    logPrunedCount(logger, pruned);
    return { pruned, dryRun: true };
  }

  let pruned = 0;

  while (true) {
    const ids = await repo.listExpiredTemporarySessionIds({
      now,
      staleBefore,
      limit: normalizedBatchSize,
    });

    if (ids.length === 0) {
      break;
    }

    pruned += await repo.deleteMemoryIds(ids);

    if (ids.length < normalizedBatchSize) {
      break;
    }
  }

  logPrunedCount(logger, pruned);
  return { pruned, dryRun: false };
}

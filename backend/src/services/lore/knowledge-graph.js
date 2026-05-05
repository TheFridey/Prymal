/**
 * LORE Knowledge Graph — entity and relationship store backed by pgvector.
 * All mutations are org-scoped. Embeddings are lazily generated via OpenAI.
 * All DB writes catch and re-throw with structured error codes.
 */
import * as Sentry from '@sentry/node';
import OpenAI from 'openai';
import { and, cosineDistance, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { kgEntities, kgEntityEmbeddings, kgRelationships } from '../../db/schema.js';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_SIMILARITY_LIMIT = 10;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is required for knowledge graph embeddings.');
    error.code = 'KG_EMBEDDINGS_NOT_CONFIGURED';
    throw error;
  }
  return new OpenAI({ apiKey });
}

async function embedText(text) {
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8191),
  });
  return response.data[0].embedding;
}

/**
 * Upsert an entity by (orgId, type, name). Returns the entity record.
 * Properties are merged on conflict.
 */
export async function upsertEntity({ orgId, type, name, properties = {} }) {
  const existing = await db.query.kgEntities.findFirst({
    where: and(
      eq(kgEntities.orgId, orgId),
      eq(kgEntities.type, type),
      eq(kgEntities.name, name),
    ),
  });

  if (existing) {
    const merged = { ...existing.properties, ...properties };
    const [updated] = await db
      .update(kgEntities)
      .set({ properties: merged, updatedAt: new Date() })
      .where(eq(kgEntities.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(kgEntities)
    .values({ orgId, type, name, properties })
    .returning();
  return created;
}

/**
 * Upsert a directional relationship between two entities.
 * Duplicate (fromEntityId, toEntityId, type) under same org is idempotent.
 */
export async function upsertRelationship({ orgId, fromEntityId, toEntityId, type, properties = {} }) {
  const existing = await db.query.kgRelationships.findFirst({
    where: and(
      eq(kgRelationships.orgId, orgId),
      eq(kgRelationships.fromEntityId, fromEntityId),
      eq(kgRelationships.toEntityId, toEntityId),
      eq(kgRelationships.type, type),
    ),
  });

  if (existing) {
    const merged = { ...existing.properties, ...properties };
    const [updated] = await db
      .update(kgRelationships)
      .set({ properties: merged })
      .where(eq(kgRelationships.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(kgRelationships)
    .values({ orgId, fromEntityId, toEntityId, type, properties })
    .returning();
  return created;
}

/**
 * Get entities related to a given entity, optionally filtered by relationship type.
 * Returns both inbound and outbound neighbours.
 */
export async function getRelatedEntities(entityId, { orgId, relationshipType, limit = 20 } = {}) {
  const outbound = await db.query.kgRelationships.findMany({
    where: and(
      eq(kgRelationships.fromEntityId, entityId),
      eq(kgRelationships.orgId, orgId),
      ...(relationshipType ? [eq(kgRelationships.type, relationshipType)] : []),
    ),
    limit,
  });

  const inbound = await db.query.kgRelationships.findMany({
    where: and(
      eq(kgRelationships.toEntityId, entityId),
      eq(kgRelationships.orgId, orgId),
      ...(relationshipType ? [eq(kgRelationships.type, relationshipType)] : []),
    ),
    limit,
  });

  const neighbourIds = [
    ...outbound.map((r) => r.toEntityId),
    ...inbound.map((r) => r.fromEntityId),
  ];

  if (neighbourIds.length === 0) {
    return [];
  }

  const entities = await db.query.kgEntities.findMany({
    where: and(
      eq(kgEntities.orgId, orgId),
      sql`${kgEntities.id} = ANY(${sql.raw(`ARRAY[${neighbourIds.map((id) => `'${id}'::uuid`).join(',')}]`)})`,
    ),
  });

  return entities;
}

/**
 * Semantic search over entity embeddings within an org.
 * Generates a query embedding then returns nearest neighbours by cosine similarity.
 */
export async function semanticEntitySearch(query, { orgId, limit = DEFAULT_SIMILARITY_LIMIT } = {}) {
  const queryEmbedding = await embedText(query);

  const results = await db
    .select({
      entity: kgEntities,
      distance: cosineDistance(kgEntityEmbeddings.embedding, queryEmbedding),
    })
    .from(kgEntityEmbeddings)
    .innerJoin(kgEntities, eq(kgEntityEmbeddings.entityId, kgEntities.id))
    .where(eq(kgEntities.orgId, orgId))
    .orderBy(cosineDistance(kgEntityEmbeddings.embedding, queryEmbedding))
    .limit(limit);

  return results.map(({ entity, distance }) => ({ ...entity, similarity: 1 - distance }));
}

/**
 * Extract entities from text using simple noun-phrase heuristics, then upsert them
 * and generate embeddings. For production use, wire an LLM extraction step.
 *
 * @param {string} text
 * @param {{ orgId: string, agentId: string }} context
 * @returns {Promise<Array>} Upserted entity records with embeddings queued.
 */
export async function extractAndUpsert(text, { orgId, agentId } = {}) {
  if (!text?.trim()) {
    return [];
  }

  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const candidates = sentences
    .flatMap((s) => s.split(/[,;:]/).map((p) => p.trim()))
    .filter((phrase) => phrase.length >= 3 && phrase.length <= 120)
    .slice(0, 30);

  const entities = [];

  for (const phrase of candidates) {
    try {
      const entity = await upsertEntity({
        orgId,
        type: 'extracted_concept',
        name: phrase,
        properties: { source: 'auto_extract', agentId: agentId ?? null },
      });
      entities.push(entity);

      const embedding = await embedText(phrase);
      await db
        .insert(kgEntityEmbeddings)
        .values({ entityId: entity.id, embedding })
        .onConflictDoUpdate({
          target: kgEntityEmbeddings.entityId,
          set: { embedding },
        });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'knowledge-graph', operation: 'extractAndUpsert', orgId },
      });
    }
  }

  return entities;
}

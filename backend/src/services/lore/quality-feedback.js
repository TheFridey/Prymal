/**
 * LORE Quality Feedback — records SENTINEL verdict signals against lore documents
 * and computes per-document quality scores for retrieval de-weighting.
 * Fire-and-forget writes; never blocks the agent execution path.
 */
import * as Sentry from '@sentry/node';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { loreDocuments, loreQualitySignals } from '../../db/schema.js';

const LOW_QUALITY_HOLD_RATE_THRESHOLD = 0.4;
const QUALITY_SCORE_WINDOW = 50;

/**
 * Record a SENTINEL verdict signal for a lore document.
 * Fire-and-forget — call without await on hot paths.
 *
 * @param {{ documentId: string, orgId: string, agentId: string, verdict: 'PASS'|'REPAIR'|'HOLD', evalScores: object }} signal
 */
export async function recordSentinelSignal({ documentId, orgId, agentId, verdict, evalScores = {} }) {
  try {
    await db.insert(loreQualitySignals).values({
      documentId,
      orgId,
      agentId,
      verdict,
      evalScores,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'lore-quality-feedback', operation: 'recordSentinelSignal', orgId },
    });
  }
}

/**
 * Recompute and persist the quality_score for a lore document based on
 * the last N SENTINEL verdict signals.
 *
 * Quality score is (1 - holdRate) where holdRate = HOLD signals / total signals.
 * Score is written back to loreDocuments.qualityScore if the column exists.
 *
 * @param {string} documentId
 * @param {string} orgId
 * @returns {{ documentId: string, holdRate: number, sampleSize: number, qualityScore: number }}
 */
export async function updateDocumentQuality(documentId, orgId) {
  const signals = await db.query.loreQualitySignals.findMany({
    where: and(
      eq(loreQualitySignals.documentId, documentId),
      eq(loreQualitySignals.orgId, orgId),
    ),
    orderBy: [desc(loreQualitySignals.createdAt)],
    limit: QUALITY_SCORE_WINDOW,
  });

  if (signals.length === 0) {
    return { documentId, holdRate: 0, sampleSize: 0, qualityScore: 1 };
  }

  const holdCount = signals.filter((s) => s.verdict === 'HOLD').length;
  const holdRate = holdCount / signals.length;
  const qualityScore = Math.max(0, 1 - holdRate);

  try {
    await db
      .update(loreDocuments)
      .set({ qualityScore })
      .where(and(eq(loreDocuments.id, documentId), eq(loreDocuments.orgId, orgId)));
  } catch {
    // qualityScore column may not yet exist in all environments — not fatal
  }

  return { documentId, holdRate, sampleSize: signals.length, qualityScore };
}

/**
 * Fetch documents whose hold rate exceeds LOW_QUALITY_HOLD_RATE_THRESHOLD.
 * Used by the LORE retrieval layer to de-weight or exclude low-quality sources.
 *
 * @param {string} orgId
 * @param {{ limit?: number }} options
 * @returns {Promise<Array<{ documentId: string, holdRate: number, sampleSize: number }>>}
 */
export async function getLowQualityDocuments(orgId, { limit = 100 } = {}) {
  try {
    const rows = await db
      .select({
        documentId: loreQualitySignals.documentId,
        total: count(loreQualitySignals.id),
        holdCount: sql`COUNT(*) FILTER (WHERE ${loreQualitySignals.verdict} = 'HOLD')`.mapWith(Number),
      })
      .from(loreQualitySignals)
      .where(eq(loreQualitySignals.orgId, orgId))
      .groupBy(loreQualitySignals.documentId)
      .limit(limit);

    return rows
      .map((row) => ({
        documentId: row.documentId,
        sampleSize: row.total,
        holdRate: row.total > 0 ? row.holdCount / row.total : 0,
      }))
      .filter((r) => r.holdRate >= LOW_QUALITY_HOLD_RATE_THRESHOLD);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'lore-quality-feedback', operation: 'getLowQualityDocuments', orgId },
    });
    return [];
  }
}

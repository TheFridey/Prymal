import { and, eq, gte, inArray, isNotNull, notInArray, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  contentAssets,
  conversations,
  loreDocuments,
  loreFeedback,
  videoGenerationEvents,
  workflowRuns,
} from '../db/schema.js';
import { getBillingSnapshotForOrg } from './billing-engine.js';

const MEDIA_CONTENT_TYPES = ['image', 'video'];
const DELIVERED_CONTENT_STATUSES = ['delivered', 'published'];
const LORE_CAP_PER_PERIOD = 5;

/**
 * @param {object} [options]
 * @param {Date|string|null} [options.billingPeriodStart]
 * @param {Date} [options.now]
 */
export function getTimeSavedPeriodBounds({ billingPeriodStart = null, now = new Date() } = {}) {
  const weekStart = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  weekStart.setUTCHours(0, 0, 0, 0);

  const monthStart = billingPeriodStart
    ? new Date(billingPeriodStart)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  return {
    weekStart,
    monthStart,
    weekLabel: 'Last 7 days',
    monthLabel: billingPeriodStart ? 'This billing cycle' : 'This calendar month',
  };
}

function capLoreCount(value) {
  return Math.min(Math.max(0, Number(value) || 0), LORE_CAP_PER_PERIOD);
}

/**
 * @param {import('drizzle-orm').NodePgDatabase|typeof db} runtimeDb
 * @param {string} orgId
 * @param {Date} periodStart
 */
export async function countTimeSavedActivity(runtimeDb, orgId, periodStart) {
  const [
    conversationRows,
    workflowRows,
    contentRows,
    feedbackRows,
    loreRows,
    imageRows,
    videoRows,
  ] = await Promise.all([
    runtimeDb
      .select({ count: sql`count(*)::int` })
      .from(conversations)
      .where(
        and(
          eq(conversations.orgId, orgId),
          gte(conversations.messageCount, 2),
          gte(conversations.lastActiveAt, periodStart),
        ),
      ),
    runtimeDb
      .select({ count: sql`count(*)::int` })
      .from(workflowRuns)
      .where(
        and(
          eq(workflowRuns.orgId, orgId),
          eq(workflowRuns.status, 'completed'),
          isNotNull(workflowRuns.completedAt),
          gte(workflowRuns.completedAt, periodStart),
        ),
      ),
    runtimeDb
      .select({ count: sql`count(*)::int` })
      .from(contentAssets)
      .where(
        and(
          eq(contentAssets.orgId, orgId),
          gte(contentAssets.createdAt, periodStart),
          notInArray(contentAssets.contentType, MEDIA_CONTENT_TYPES),
          inArray(contentAssets.deliveryStatus, DELIVERED_CONTENT_STATUSES),
        ),
      ),
    runtimeDb
      .select({ count: sql`count(*)::int` })
      .from(loreFeedback)
      .where(and(eq(loreFeedback.orgId, orgId), gte(loreFeedback.recordedAt, periodStart))),
    runtimeDb
      .select({ count: sql`count(*)::int` })
      .from(loreDocuments)
      .where(
        and(
          eq(loreDocuments.orgId, orgId),
          eq(loreDocuments.status, 'indexed'),
          gte(loreDocuments.createdAt, periodStart),
        ),
      ),
    runtimeDb
      .select({ count: sql`count(*)::int` })
      .from(contentAssets)
      .where(
        and(
          eq(contentAssets.orgId, orgId),
          eq(contentAssets.contentType, 'image'),
          gte(contentAssets.createdAt, periodStart),
          or(
            inArray(contentAssets.deliveryStatus, DELIVERED_CONTENT_STATUSES),
            sql`COALESCE(length(${contentAssets.body}), 0) > 0`,
          ),
        ),
      ),
    runtimeDb
      .select({ count: sql`count(*)::int` })
      .from(videoGenerationEvents)
      .where(
        and(
          eq(videoGenerationEvents.orgId, orgId),
          eq(videoGenerationEvents.status, 'completed'),
          gte(
            sql`COALESCE(${videoGenerationEvents.completedAt}, ${videoGenerationEvents.updatedAt})`,
            periodStart,
          ),
        ),
      ),
  ]);

  const loreDocumentsIndexed = capLoreCount(loreRows[0]?.count ?? 0);
  const imageGenerations = Number(imageRows[0]?.count ?? 0);
  const videoGenerations = Number(videoRows[0]?.count ?? 0);

  return {
    conversations: Number(conversationRows[0]?.count ?? 0),
    workflowRuns: Number(workflowRows[0]?.count ?? 0),
    contentAssets: Number(contentRows[0]?.count ?? 0),
    reportsOrAudits: Number(feedbackRows[0]?.count ?? 0),
    loreDocuments: loreDocumentsIndexed,
    mediaGenerations: imageGenerations + videoGenerations,
    imageGenerations,
    videoGenerations,
  };
}

/**
 * @param {object} params
 * @param {string} params.orgId
 * @param {Date|string|null} [params.billingPeriodStart]
 * @param {import('drizzle-orm').NodePgDatabase|typeof db} [params.runtimeDb]
 * @param {Date} [params.now]
 */
export async function getTimeSavedStatsForOrg({
  orgId,
  billingPeriodStart = null,
  runtimeDb = db,
  now = new Date(),
} = {}) {
  const bounds = getTimeSavedPeriodBounds({ billingPeriodStart, now });

  const [weekCounts, monthCounts] = await Promise.all([
    countTimeSavedActivity(runtimeDb, orgId, bounds.weekStart),
    countTimeSavedActivity(runtimeDb, orgId, bounds.monthStart),
  ]);

  return {
    periods: {
      week: {
        label: bounds.weekLabel,
        startAt: bounds.weekStart.toISOString(),
        counts: weekCounts,
      },
      month: {
        label: bounds.monthLabel,
        startAt: bounds.monthStart.toISOString(),
        counts: monthCounts,
      },
    },
    methodology: {
      conversations: 'Threads with at least two messages active in the period',
      workflowRuns: 'Workflow runs completed in the period',
      contentAssets: 'Delivered or published non-media outputs created in the period',
      reportsOrAudits: 'Recorded outcome feedback in the period',
      loreDocuments: `Indexed Business Memory sources added in the period (capped at ${LORE_CAP_PER_PERIOD})`,
      mediaGenerations: 'Completed image outputs and video renders in the period',
    },
  };
}

/**
 * @param {string} orgId
 * @param {object} [options]
 * @param {import('drizzle-orm').NodePgDatabase|typeof db} [options.runtimeDb]
 */
export async function getTimeSavedStatsForOrgWithBilling(orgId, { runtimeDb = db } = {}) {
  let billingPeriodStart = null;

  try {
    const snapshot = await getBillingSnapshotForOrg(orgId, { tx: runtimeDb });
    billingPeriodStart = snapshot.subscription?.currentPeriodStart ?? null;
  } catch {
    billingPeriodStart = null;
  }

  return getTimeSavedStatsForOrg({ orgId, billingPeriodStart, runtimeDb });
}

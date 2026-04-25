import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  contentAssets,
  conversations,
  executionUsageEvents,
  llmExecutionTraces,
  loreFeedback,
  messages,
  workflowRuns,
  workflowTemplates,
} from '../db/schema.js';

export const OUTCOME_TYPES = ['success', 'failure', 'partial'];
export const LEARNING_AGENT_IDS = new Set(['herald', 'forge', 'echo']);

function compactText(value, max = 900) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function normalizeResultMetadata(existing, next) {
  return {
    ...(existing ?? {}),
    ...(next ?? {}),
    updatedAt: new Date().toISOString(),
  };
}

async function linkDerivedContent(runtimeDb, { orgId, parentContentId, childContentId }) {
  if (!parentContentId || !childContentId || parentContentId === childContentId) return;

  const parent = await runtimeDb.query.contentAssets.findFirst({
    where: and(eq(contentAssets.id, parentContentId), eq(contentAssets.orgId, orgId)),
  });
  if (!parent) return;

  const derived = new Set(parent.derivedContentIds ?? []);
  derived.add(childContentId);
  await runtimeDb
    .update(contentAssets)
    .set({ derivedContentIds: [...derived], updatedAt: new Date() })
    .where(and(eq(contentAssets.id, parent.id), eq(contentAssets.orgId, orgId)));
}

export async function recordContentAsset({
  runtimeDb = db,
  orgId,
  userId = null,
  message = null,
  conversation = null,
  sourceAgent,
  contentType = 'agent_output',
  title = null,
  body = null,
  workflowId = null,
  workflowRunId = null,
  parentContentId = null,
  metadata = {},
}) {
  if (!orgId || !sourceAgent) return null;

  const messageId = message?.id ?? null;
  const existing = messageId
    ? await runtimeDb.query.contentAssets.findFirst({
      where: and(eq(contentAssets.orgId, orgId), eq(contentAssets.messageId, messageId)),
    })
    : null;

  const values = {
    orgId,
    messageId,
    conversationId: conversation?.id ?? message?.conversationId ?? null,
    workflowId,
    workflowRunId,
    sourceAgent,
    contentType,
    title: title ?? conversation?.title ?? null,
    body: compactText(body ?? message?.content ?? ''),
    parentContentId,
    metadata: {
      ...(existing?.metadata ?? {}),
      ...metadata,
      userId,
      learningEligible: LEARNING_AGENT_IDS.has(sourceAgent),
    },
    updatedAt: new Date(),
  };

  const [asset] = existing
    ? await runtimeDb
      .update(contentAssets)
      .set(values)
      .where(and(eq(contentAssets.id, existing.id), eq(contentAssets.orgId, orgId)))
      .returning()
    : await runtimeDb
      .insert(contentAssets)
      .values(values)
      .returning();

  await linkDerivedContent(runtimeDb, { orgId, parentContentId, childContentId: asset.id });
  return asset;
}

export async function resolveContentAsset({ runtimeDb = db, orgId, contentId, sourceAgent = null }) {
  if (!orgId || !contentId) return null;

  const byAssetId = await runtimeDb.query.contentAssets.findFirst({
    where: and(eq(contentAssets.id, contentId), eq(contentAssets.orgId, orgId)),
  });
  if (byAssetId) return byAssetId;

  const byMessageId = await runtimeDb.query.contentAssets.findFirst({
    where: and(eq(contentAssets.messageId, contentId), eq(contentAssets.orgId, orgId)),
  });
  if (byMessageId) return byMessageId;

  const message = await runtimeDb.query.messages.findFirst({
    where: eq(messages.id, contentId),
  });
  if (!message) return null;

  const conversation = await runtimeDb.query.conversations.findFirst({
    where: and(eq(conversations.id, message.conversationId), eq(conversations.orgId, orgId)),
  });
  if (!conversation) return null;

  return recordContentAsset({
    runtimeDb,
    orgId,
    sourceAgent: sourceAgent ?? conversation.agentId,
    contentType: 'agent_output',
    message,
    conversation,
    metadata: { recoveredFromMessageId: true },
  });
}

export async function recordLoreFeedback({
  runtimeDb = db,
  orgId,
  userId = null,
  contentId,
  outcomeType,
  outcomeMetric,
  notes = null,
  sourceAgent = null,
  workflowId = null,
  workflowRunId = null,
  value = null,
  metadata = {},
}) {
  if (!OUTCOME_TYPES.includes(outcomeType)) {
    throw new Error('Invalid outcome type.');
  }

  const asset = await resolveContentAsset({ runtimeDb, orgId, contentId, sourceAgent });
  if (!asset) {
    throw new Error('Content asset not found.');
  }

  const [feedback] = await runtimeDb
    .insert(loreFeedback)
    .values({
      orgId,
      contentId: asset.id,
      outcomeType,
      outcomeMetric,
      notes,
      sourceAgent: sourceAgent ?? asset.sourceAgent,
      workflowId: workflowId ?? asset.workflowId ?? null,
      workflowRunId: workflowRunId ?? asset.workflowRunId ?? null,
      value,
      metadata: { ...metadata, userId },
    })
    .returning();

  await runtimeDb
    .update(contentAssets)
    .set({
      resultMetadata: normalizeResultMetadata(asset.resultMetadata, {
        latestOutcomeType: outcomeType,
        latestOutcomeMetric: outcomeMetric,
        latestOutcomeNotes: notes,
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(contentAssets.id, asset.id), eq(contentAssets.orgId, orgId)));

  return { feedback, asset };
}

export async function recordDeliveryOutcome({
  runtimeDb = db,
  orgId,
  userId = null,
  contentId = null,
  messageId = null,
  sourceAgent = 'echo',
  contentType = 'social_post',
  delivered,
  metadata = {},
}) {
  let asset = contentId
    ? await resolveContentAsset({ runtimeDb, orgId, contentId, sourceAgent })
    : null;

  if (!asset && messageId) {
    asset = await resolveContentAsset({ runtimeDb, orgId, contentId: messageId, sourceAgent });
  }

  if (!asset && messageId) {
    asset = await recordContentAsset({
      runtimeDb,
      orgId,
      userId,
      message: { id: messageId, content: '' },
      sourceAgent,
      contentType,
      metadata: { createdFromDelivery: true },
    });
  }

  if (!asset) return null;

  const [updated] = await runtimeDb
    .update(contentAssets)
    .set({
      deliveryStatus: delivered ? 'delivered' : 'failed',
      deliveredAt: delivered ? new Date() : asset.deliveredAt,
      resultMetadata: normalizeResultMetadata(asset.resultMetadata, metadata),
      updatedAt: new Date(),
    })
    .where(and(eq(contentAssets.id, asset.id), eq(contentAssets.orgId, orgId)))
    .returning();

  return updated;
}

export async function getSuccessfulPatterns({ runtimeDb = db, orgId, agentId, limit = 3 }) {
  if (!orgId || !LEARNING_AGENT_IDS.has(agentId)) return [];

  const feedbackRows = await runtimeDb.query.loreFeedback.findMany({
    where: and(
      eq(loreFeedback.orgId, orgId),
      eq(loreFeedback.outcomeType, 'success'),
      eq(loreFeedback.sourceAgent, agentId),
    ),
    orderBy: [desc(loreFeedback.recordedAt)],
    limit: limit * 3,
  });

  const contentIds = [...new Set(feedbackRows.map((row) => row.contentId).filter(Boolean))];
  if (contentIds.length === 0) return [];

  const assets = await runtimeDb.query.contentAssets.findMany({
    where: and(eq(contentAssets.orgId, orgId), inArray(contentAssets.id, contentIds)),
  });
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  return feedbackRows
    .map((row) => {
      const asset = assetById.get(row.contentId);
      if (!asset?.body) return null;
      return {
        metric: row.outcomeMetric,
        notes: row.notes,
        contentType: asset.contentType,
        body: compactText(asset.body, 700),
        recordedAt: row.recordedAt,
      };
    })
    .filter(Boolean)
    .slice(0, limit);
}

export function buildSuccessfulPatternsPrompt(patterns = []) {
  if (!patterns.length) return null;

  return [
    'PREVIOUS SUCCESSFUL PATTERNS',
    'Treat these as weak weighted priors from this organisation. Learn from the pattern and outcome, but do not copy blindly or override the user request, LORE, policy, or agent contract.',
    patterns
      .map((pattern, index) => [
        `[${index + 1}] ${pattern.contentType} performed well on ${pattern.metric}.`,
        pattern.notes ? `Outcome notes: ${compactText(pattern.notes, 240)}` : null,
        `Pattern excerpt: ${pattern.body}`,
      ].filter(Boolean).join('\n'))
      .join('\n\n'),
  ].join('\n\n');
}

export async function getOrgLearningSnapshot({ runtimeDb = db, orgId }) {
  const [traceRows, runRows, feedbackRows, assetRows, templateRows, usageRows] = await Promise.all([
    runtimeDb.select({ count: sql`count(*)::int` }).from(llmExecutionTraces).where(eq(llmExecutionTraces.orgId, orgId)),
    runtimeDb.select({ count: sql`count(*)::int` }).from(workflowRuns).where(eq(workflowRuns.orgId, orgId)),
    runtimeDb.select({ count: sql`count(*)::int` }).from(loreFeedback).where(eq(loreFeedback.orgId, orgId)),
    runtimeDb.select({ count: sql`count(*)::int` }).from(contentAssets).where(eq(contentAssets.orgId, orgId)),
    runtimeDb.select({ count: sql`count(*)::int` }).from(workflowTemplates).where(eq(workflowTemplates.orgId, orgId)),
    runtimeDb.select({ count: sql`count(*)::int` }).from(executionUsageEvents).where(eq(executionUsageEvents.orgId, orgId)),
  ]);

  const agentRuns = Number(traceRows[0]?.count ?? 0);
  const workflowRunCount = Number(runRows[0]?.count ?? 0);
  const executionUsageCount = Number(usageRows[0]?.count ?? 0);

  return {
    trainedOnRuns: Math.max(agentRuns, executionUsageCount) + workflowRunCount,
    agentRuns,
    workflowRuns: workflowRunCount,
    feedbackEvents: Number(feedbackRows[0]?.count ?? 0),
    contentAssets: Number(assetRows[0]?.count ?? 0),
    workflowTemplates: Number(templateRows[0]?.count ?? 0),
  };
}

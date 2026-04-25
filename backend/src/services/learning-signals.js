import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  contentAssets,
  loreDocuments,
  loreFeedback,
  organisations,
  productEvents,
  workflowRuns,
  workflowTemplates,
} from '../db/schema.js';

const BRAND_AGENT_IDS = new Set(['forge', 'herald', 'echo']);
const POSITIVE_OUTCOMES = new Set(['success', 'partial']);
const REUSE_SOURCES = new Set(['run_again', 'replay']);

function normaliseAgentId(value) {
  return String(value ?? '').trim().toLowerCase();
}

function asDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function trendFrom(current, previous, threshold = 0) {
  if (previous == null) return current > threshold ? 'up' : 'flat';
  if (current > previous + threshold) return 'up';
  if (current < previous - threshold) return 'down';
  return 'flat';
}

function contentFormatForAsset(asset) {
  const type = String(asset?.contentType ?? 'agent_output');
  const service = String(asset?.resultMetadata?.service ?? asset?.resultMetadata?.provider ?? '').toLowerCase();
  const bodyLength = String(asset?.body ?? '').length;

  if (type === 'social_post' && service.includes('linkedin')) {
    return bodyLength > 900 ? 'long LinkedIn post' : 'short LinkedIn post';
  }
  if (type === 'social_post') return 'social post';
  if (type === 'email') return 'email campaign';
  if (type === 'image') return 'image asset';
  if (type === 'video') return 'video asset';
  if (type === 'blog_post') return 'blog post';
  if (asset?.workflowId || asset?.workflowRunId) return 'workflow output';
  return type.replace(/[_-]+/g, ' ');
}

function calculatePatternGroups({ feedbackRows = [], assetRows = [], since = null, until = null }) {
  const groups = new Set();
  const formatCounts = new Map();

  for (const asset of assetRows) {
    const createdAt = asDate(asset.createdAt);
    if (since && (!createdAt || createdAt < since)) continue;
    if (until && (!createdAt || createdAt >= until)) continue;
    const format = contentFormatForAsset(asset);
    formatCounts.set(format, (formatCounts.get(format) ?? 0) + 1);

    if (['delivered', 'success'].includes(asset.deliveryStatus)) {
      groups.add([asset.sourceAgent, format, 'delivered', asset.workflowId ?? 'no-workflow'].join('|'));
    }
  }

  for (const row of feedbackRows) {
    const recordedAt = asDate(row.recordedAt ?? row.createdAt);
    if (since && (!recordedAt || recordedAt < since)) continue;
    if (until && (!recordedAt || recordedAt >= until)) continue;
    if (!POSITIVE_OUTCOMES.has(row.outcomeType)) continue;
    const asset = assetRows.find((candidate) => candidate.id === row.contentId);
    const format = contentFormatForAsset(asset ?? { contentType: 'agent_output' });
    groups.add([row.sourceAgent ?? asset?.sourceAgent ?? 'unknown', format, row.outcomeMetric, row.workflowId ?? asset?.workflowId ?? 'no-workflow'].join('|'));
  }

  for (const [format, count] of formatCounts.entries()) {
    if (count >= 2) groups.add(['repeated', format, 'used_2_plus_times', 'no-workflow'].join('|'));
  }

  return groups;
}

function scoreFormatSamples({ feedbackRows = [], assetRows = [] }) {
  const scores = new Map();
  const bump = (format, amount, createdAt) => {
    const current = scores.get(format) ?? { score: 0, samples: 0, latestAt: null };
    current.score += amount;
    current.samples += 1;
    const date = asDate(createdAt);
    if (date && (!current.latestAt || date > current.latestAt)) current.latestAt = date;
    scores.set(format, current);
  };

  for (const asset of assetRows) {
    if (['delivered', 'success'].includes(asset.deliveryStatus)) {
      bump(contentFormatForAsset(asset), 2, asset.deliveredAt ?? asset.createdAt);
    }
  }

  for (const row of feedbackRows) {
    if (!POSITIVE_OUTCOMES.has(row.outcomeType)) continue;
    const asset = assetRows.find((candidate) => candidate.id === row.contentId);
    bump(contentFormatForAsset(asset ?? { contentType: 'agent_output' }), row.outcomeType === 'success' ? 3 : 1, row.recordedAt);
  }

  return [...scores.entries()]
    .map(([format, value]) => ({ format, ...value }))
    .sort((a, b) => b.score - a.score || b.samples - a.samples || ((b.latestAt?.getTime() ?? 0) - (a.latestAt?.getTime() ?? 0)));
}

function confidenceForSamples(samples) {
  if (samples >= 10) return 'high';
  if (samples >= 4) return 'medium';
  if (samples >= 1) return 'low';
  return 'low';
}

function countWorkflowReuse(rows, templates, since, until) {
  const runs = rows.filter((run) => {
    const createdAt = asDate(run.createdAt);
    if (!createdAt || createdAt < since || createdAt >= until) return false;
    if (REUSE_SOURCES.has(run.triggerSource)) return true;
    return Array.isArray(run.runLog) && run.runLog.some((entry) => entry?.type === 'run_again_input');
  }).length;

  const templateReuses = templates.filter((template) => {
    const updatedAt = asDate(template.updatedAt ?? template.createdAt);
    if (!updatedAt || updatedAt < since || updatedAt >= until) return false;
    return Number(template.usageCount ?? 0) > 0 || Boolean(template.metadata?.importedFromTemplateId);
  }).length;

  return runs + templateReuses;
}

function profileCompleteness(metadata = {}, docs = []) {
  const profile = metadata.brandVoiceProfile ?? metadata.brandVoice ?? metadata.voiceProfile ?? {};
  const businessContext = metadata.businessContext ?? metadata.onboarding ?? {};
  const values = [
    profile,
    metadata.tone,
    metadata.audience,
    metadata.workspaceFocus,
    businessContext,
  ];
  const filled = values.filter((value) => {
    if (!value) return false;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return String(value).trim().length > 0;
  }).length;
  const brandDocs = docs.filter((doc) => /brand|voice|tone|style|audience|positioning/i.test(`${doc.title ?? ''} ${doc.sourceType ?? ''}`)).length;
  return Math.min(40, filled * 7 + Math.min(brandDocs * 5, 12));
}

function successfulBrandOutputs({ feedbackRows, assetRows, since = null, until = null }) {
  const positiveFeedbackContentIds = new Set(
    feedbackRows
      .filter((row) => POSITIVE_OUTCOMES.has(row.outcomeType))
      .filter((row) => {
        const date = asDate(row.recordedAt);
        return (!since || (date && date >= since)) && (!until || (date && date < until));
      })
      .map((row) => row.contentId)
      .filter(Boolean),
  );

  return assetRows.filter((asset) => {
    const date = asDate(asset.deliveredAt ?? asset.updatedAt ?? asset.createdAt);
    if (since && (!date || date < since)) return false;
    if (until && (!date || date >= until)) return false;
    if (!BRAND_AGENT_IDS.has(normaliseAgentId(asset.sourceAgent))) return false;
    return positiveFeedbackContentIds.has(asset.id) || ['delivered', 'success'].includes(asset.deliveryStatus);
  }).length;
}

function calculateBrandVoiceConfidence({ organisation, loreDocs, feedbackRows, assetRows, now }) {
  const currentStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const previousStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const base = profileCompleteness(organisation?.metadata ?? {}, loreDocs);
  const positiveFeedback = feedbackRows.filter((row) => POSITIVE_OUTCOMES.has(row.outcomeType)).length;
  const currentOutputs = successfulBrandOutputs({ feedbackRows, assetRows, since: currentStart });
  const allOutputs = successfulBrandOutputs({ feedbackRows, assetRows });
  const previousOutputs = successfulBrandOutputs({ feedbackRows, assetRows, since: previousStart, until: currentStart });
  const previousFeedback = feedbackRows.filter((row) => {
    const date = asDate(row.recordedAt);
    return date && date >= previousStart && date < currentStart && POSITIVE_OUTCOMES.has(row.outcomeType);
  }).length;

  const value = clamp(base + Math.min(30, allOutputs * 3) + Math.min(20, positiveFeedback * 4) + Math.min(10, currentOutputs * 2));
  const previousValue = (previousOutputs || previousFeedback)
    ? clamp(base + Math.min(30, Math.max(0, allOutputs - currentOutputs) * 3) + Math.min(20, previousFeedback * 4) + Math.min(10, previousOutputs * 2))
    : null;

  return { value, previousValue, trend: trendFrom(value, previousValue, 3) };
}

function makeSignal(id, type, title, description, createdAt) {
  return { id, type, title, description, createdAt: asDate(createdAt)?.toISOString() ?? new Date().toISOString() };
}

function buildRecentSignals({ feedbackRows, assetRows, workflowRunRows, eventRows }) {
  const signals = [];

  for (const row of feedbackRows) {
    if (!POSITIVE_OUTCOMES.has(row.outcomeType)) continue;
    signals.push(makeSignal(
      `feedback:${row.id}`,
      'feedback',
      `${String(row.sourceAgent ?? 'Prymal').toUpperCase()} received ${row.outcomeType} feedback`,
      `Outcome metric: ${row.outcomeMetric}.`,
      row.recordedAt,
    ));
  }

  for (const asset of assetRows) {
    if (['delivered', 'success'].includes(asset.deliveryStatus)) {
      signals.push(makeSignal(
        `delivery:${asset.id}`,
        'delivery',
        `${contentFormatForAsset(asset)} delivered`,
        `${String(asset.sourceAgent ?? 'Prymal').toUpperCase()} output was marked delivered.`,
        asset.deliveredAt ?? asset.updatedAt ?? asset.createdAt,
      ));
    } else if (asset.contentType && BRAND_AGENT_IDS.has(normaliseAgentId(asset.sourceAgent))) {
      signals.push(makeSignal(
        `content:${asset.id}`,
        'content',
        `${String(asset.sourceAgent).toUpperCase()} created ${contentFormatForAsset(asset)}`,
        'Saved as part of your workspace content graph.',
        asset.createdAt,
      ));
    }
  }

  for (const run of workflowRunRows) {
    if (REUSE_SOURCES.has(run.triggerSource)) {
      signals.push(makeSignal(
        `workflow:${run.id}`,
        'workflow',
        'Workflow reused',
        `NEXUS queued a ${run.triggerSource.replace(/_/g, ' ')} run.`,
        run.createdAt,
      ));
    }
  }

  for (const event of eventRows) {
    if (!['workflow_template.created', 'workflow.run_again_queued', 'integration.published'].includes(event.eventName)) continue;
    const type = event.eventName.includes('workflow') ? 'workflow' : 'delivery';
    signals.push(makeSignal(
      `event:${event.id}`,
      type,
      event.eventName.replace(/\./g, ' '),
      event.metadata?.service ? `Service: ${event.metadata.service}.` : 'Workspace signal recorded.',
      event.createdAt,
    ));
  }

  return signals
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 5);
}

export function calculateLearningSignals({
  organisation = null,
  loreDocs = [],
  feedbackRows = [],
  assetRows = [],
  workflowRunRows = [],
  templateRows = [],
  eventRows = [],
  now = new Date(),
} = {}) {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const currentPatterns = calculatePatternGroups({ feedbackRows, assetRows, since: fourteenDaysAgo });
  const previousPatterns = calculatePatternGroups({
    feedbackRows,
    assetRows,
    since: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
    until: fourteenDaysAgo,
  });
  const allPatterns = calculatePatternGroups({ feedbackRows, assetRows });
  const workflowsCurrent = countWorkflowReuse(workflowRunRows, templateRows, sevenDaysAgo, now);
  const workflowsPrevious = countWorkflowReuse(workflowRunRows, templateRows, fourteenDaysAgo, sevenDaysAgo);
  const topFormats = scoreFormatSamples({ feedbackRows, assetRows });
  const topFormat = topFormats[0] ?? null;
  const brand = calculateBrandVoiceConfidence({ organisation, loreDocs, feedbackRows, assetRows, now });
  const recentSignals = buildRecentSignals({ feedbackRows, assetRows, workflowRunRows, eventRows });

  return {
    patternsLearned: {
      value: allPatterns.size,
      label: 'Business patterns learned',
      trend: trendFrom(currentPatterns.size, previousPatterns.size),
      explanation: allPatterns.size > 0
        ? 'Derived from positive feedback, delivered outputs, and repeated content formats in this workspace.'
        : 'Prymal will learn patterns as you generate, publish, and give feedback.',
    },
    workflowsReusedThisWeek: {
      value: workflowsCurrent,
      label: 'Workflows reused this week',
      trend: trendFrom(workflowsCurrent, workflowsPrevious),
      explanation: workflowsCurrent > 0
        ? 'Counts run-again, replayed workflow runs, and reused or imported workflow templates from the last 7 days.'
        : 'Reusable workflow signals appear once you run again, replay, clone, or import workflow templates.',
    },
    topPerformingContentFormat: {
      value: topFormat?.format ?? null,
      label: 'Top performing format',
      confidence: topFormat ? confidenceForSamples(topFormat.samples) : 'low',
      explanation: topFormat
        ? `Based on ${topFormat.samples} positive delivery or feedback signal${topFormat.samples === 1 ? '' : 's'}.`
        : 'No winning format yet. Publish outputs or record feedback to build this signal.',
    },
    brandVoiceConfidence: {
      value: brand.value,
      previousValue: brand.previousValue,
      trend: brand.trend,
      explanation: brand.value > 0
        ? 'Calculated from brand context completeness, successful FORGE/HERALD/ECHO outputs, feedback, and recent usage.'
        : 'Confidence increases as you add brand context, generate content, publish outputs, and give feedback.',
    },
    recentSignals,
  };
}

export async function getLearningSignalsForOrg({ runtimeDb = db, orgId }) {
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const [organisation, docs, feedbackRows, assetRows, runRows, templateRows, eventRows] = await Promise.all([
    runtimeDb.query.organisations.findFirst({ where: eq(organisations.id, orgId) }),
    runtimeDb.query.loreDocuments.findMany({ where: eq(loreDocuments.orgId, orgId), orderBy: [desc(loreDocuments.createdAt)], limit: 200 }),
    runtimeDb.query.loreFeedback.findMany({ where: eq(loreFeedback.orgId, orgId), orderBy: [desc(loreFeedback.recordedAt)], limit: 500 }),
    runtimeDb.query.contentAssets.findMany({ where: eq(contentAssets.orgId, orgId), orderBy: [desc(contentAssets.createdAt)], limit: 500 }),
    runtimeDb.query.workflowRuns.findMany({ where: and(eq(workflowRuns.orgId, orgId), gte(workflowRuns.createdAt, since)), orderBy: [desc(workflowRuns.createdAt)], limit: 500 }),
    runtimeDb.query.workflowTemplates.findMany({ where: eq(workflowTemplates.orgId, orgId), orderBy: [desc(workflowTemplates.updatedAt)], limit: 200 }),
    runtimeDb.query.productEvents.findMany({ where: and(eq(productEvents.orgId, orgId), gte(productEvents.createdAt, since)), orderBy: [desc(productEvents.createdAt)], limit: 200 }),
  ]);

  return calculateLearningSignals({
    organisation,
    loreDocs: docs,
    feedbackRows,
    assetRows,
    workflowRunRows: runRows,
    templateRows,
    eventRows,
  });
}

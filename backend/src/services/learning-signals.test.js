import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { calculateLearningSignals, getLearningSignalsForOrg } = await import('./learning-signals.js');

const NOW = new Date('2026-04-25T12:00:00.000Z');

function daysAgo(days) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function asset(overrides = {}) {
  return {
    id: overrides.id ?? `asset-${Math.random()}`,
    orgId: 'org-1',
    sourceAgent: 'FORGE',
    contentType: 'blog_post',
    body: 'Launch copy',
    workflowId: null,
    workflowRunId: null,
    deliveryStatus: null,
    resultMetadata: {},
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    ...overrides,
  };
}

function feedback(overrides = {}) {
  return {
    id: overrides.id ?? `feedback-${Math.random()}`,
    orgId: 'org-1',
    contentId: 'asset-1',
    outcomeType: 'success',
    outcomeMetric: 'engagement',
    sourceAgent: 'FORGE',
    workflowId: null,
    recordedAt: daysAgo(1),
    ...overrides,
  };
}

test('calculateLearningSignals returns safe zero and null states for an empty org', () => {
  const result = calculateLearningSignals({ now: NOW });

  assert.equal(result.patternsLearned.value, 0);
  assert.equal(result.workflowsReusedThisWeek.value, 0);
  assert.equal(result.topPerformingContentFormat.value, null);
  assert.equal(result.topPerformingContentFormat.confidence, 'low');
  assert.equal(result.brandVoiceConfidence.value, 0);
  assert.equal(result.brandVoiceConfidence.previousValue, null);
  assert.deepEqual(result.recentSignals, []);
});

test('patternsLearned uses positive feedback, delivery, and repeated real content groups', () => {
  const result = calculateLearningSignals({
    now: NOW,
    assetRows: [
      asset({ id: 'asset-1', contentType: 'social_post', deliveryStatus: 'delivered', resultMetadata: { service: 'linkedin' } }),
      asset({ id: 'asset-2', contentType: 'social_post', resultMetadata: { service: 'linkedin' } }),
    ],
    feedbackRows: [
      feedback({ id: 'feedback-1', contentId: 'asset-1', outcomeType: 'success', outcomeMetric: 'clicks' }),
      feedback({ id: 'feedback-2', contentId: 'asset-2', outcomeType: 'failure', outcomeMetric: 'clicks' }),
    ],
  });

  assert.equal(result.patternsLearned.value, 3);
  assert.equal(result.patternsLearned.trend, 'up');
});

test('workflowsReusedThisWeek compares current and previous seven day windows', () => {
  const result = calculateLearningSignals({
    now: NOW,
    workflowRunRows: [
      { id: 'current-run', triggerSource: 'run_again', runLog: [], createdAt: daysAgo(2) },
      { id: 'previous-run-a', triggerSource: 'run_again', runLog: [], createdAt: daysAgo(9) },
      { id: 'previous-run-b', triggerSource: 'replay', runLog: [], createdAt: daysAgo(10) },
    ],
    templateRows: [
      { id: 'current-template', usageCount: 2, metadata: {}, updatedAt: daysAgo(3), createdAt: daysAgo(20) },
    ],
  });

  assert.equal(result.workflowsReusedThisWeek.value, 2);
  assert.equal(result.workflowsReusedThisWeek.trend, 'flat');
});

test('topPerformingContentFormat reports low, medium, and high confidence from sample counts', () => {
  const low = calculateLearningSignals({
    now: NOW,
    assetRows: [asset({ id: 'low-1', contentType: 'email', deliveryStatus: 'delivered' })],
  });

  const medium = calculateLearningSignals({
    now: NOW,
    assetRows: Array.from({ length: 4 }, (_, index) => asset({ id: `medium-${index}`, contentType: 'image', deliveryStatus: 'delivered' })),
  });

  const high = calculateLearningSignals({
    now: NOW,
    assetRows: Array.from({ length: 10 }, (_, index) => asset({ id: `high-${index}`, contentType: 'video', deliveryStatus: 'delivered' })),
  });

  assert.equal(low.topPerformingContentFormat.value, 'email campaign');
  assert.equal(low.topPerformingContentFormat.confidence, 'low');
  assert.equal(medium.topPerformingContentFormat.value, 'image asset');
  assert.equal(medium.topPerformingContentFormat.confidence, 'medium');
  assert.equal(high.topPerformingContentFormat.value, 'video asset');
  assert.equal(high.topPerformingContentFormat.confidence, 'high');
});

test('brandVoiceConfidence clamps between zero and one hundred', () => {
  const result = calculateLearningSignals({
    now: NOW,
    organisation: {
      metadata: {
        brandVoiceProfile: { tone: 'clear', values: 'trustworthy' },
        tone: 'direct',
        audience: 'founders',
        workspaceFocus: 'growth',
        businessContext: { offer: 'automation' },
      },
    },
    loreDocs: [
      { title: 'Brand voice guide', sourceType: 'doc' },
      { title: 'Audience positioning', sourceType: 'doc' },
      { title: 'Tone rules', sourceType: 'doc' },
    ],
    assetRows: Array.from({ length: 20 }, (_, index) => asset({
      id: `brand-${index}`,
      sourceAgent: index % 2 === 0 ? 'HERALD' : 'ECHO',
      deliveryStatus: 'delivered',
      createdAt: daysAgo(1),
      deliveredAt: daysAgo(1),
    })),
    feedbackRows: Array.from({ length: 20 }, (_, index) => feedback({
      id: `brand-feedback-${index}`,
      contentId: `brand-${index}`,
      outcomeType: 'success',
      recordedAt: daysAgo(1),
    })),
  });

  assert.equal(result.brandVoiceConfidence.value, 100);
  assert.equal(result.brandVoiceConfidence.trend, 'up');
});

test('recentSignals returns newest first and at most five items', () => {
  const result = calculateLearningSignals({
    now: NOW,
    feedbackRows: Array.from({ length: 7 }, (_, index) => feedback({
      id: `feedback-${index}`,
      recordedAt: daysAgo(index),
    })),
  });

  assert.equal(result.recentSignals.length, 5);
  assert.deepEqual(result.recentSignals.map((signal) => signal.id), [
    'feedback:feedback-0',
    'feedback:feedback-1',
    'feedback:feedback-2',
    'feedback:feedback-3',
    'feedback:feedback-4',
  ]);
});

test('getLearningSignalsForOrg uses org-scoped query filters for every source', async () => {
  const calls = [];
  const findMany = (name, rows = []) => async (options) => {
    calls.push({ name, options });
    return rows;
  };
  const runtimeDb = {
    query: {
      organisations: {
        findFirst: async (options) => {
          calls.push({ name: 'organisations', options });
          return { id: 'org-1', metadata: {} };
        },
      },
      loreDocuments: { findMany: findMany('loreDocuments') },
      loreFeedback: { findMany: findMany('loreFeedback', [feedback({ id: 'feedback-1', contentId: 'asset-1' })]) },
      contentAssets: { findMany: findMany('contentAssets', [asset({ id: 'asset-1' })]) },
      workflowRuns: { findMany: findMany('workflowRuns') },
      workflowTemplates: { findMany: findMany('workflowTemplates') },
      productEvents: { findMany: findMany('productEvents') },
    },
  };

  const result = await getLearningSignalsForOrg({ runtimeDb, orgId: 'org-1' });

  assert.equal(result.patternsLearned.value, 1);
  assert.equal(calls.length, 7);
  assert.ok(calls.every((call) => call.options?.where), 'every moat source query must include an org-scoped where filter');
});

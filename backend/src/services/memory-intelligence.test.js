import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { buildMemoryIntelligenceSummary } = await import('./memory-intelligence.js');

test('memory intelligence highlights contradictions, stale facts, and missing business context', () => {
  const summary = buildMemoryIntelligenceSummary([
    {
      key: 'brand_voice',
      confidence: 0.9,
      provenanceKind: 'confirmed',
      memoryItemStatus: 'active',
      updatedAt: new Date('2026-05-19T10:00:00.000Z'),
      metadata: { contextLayer: 'global' },
    },
    {
      key: 'target_market',
      confidence: 0.58,
      provenanceKind: 'inferred',
      memoryItemStatus: 'conflicted',
      contradictionDetected: true,
      updatedAt: new Date('2026-05-18T10:00:00.000Z'),
      metadata: { contextLayer: 'global' },
    },
    {
      key: 'project_context:prymal-beta-launch:summary',
      confidence: 0.72,
      provenanceKind: 'confirmed',
      memoryItemStatus: 'active',
      updatedAt: new Date('2026-05-17T10:00:00.000Z'),
      metadata: { contextLayer: 'project', projectStatus: 'active' },
    },
  ], { internal: true });

  assert.equal(summary.overview.contradictionsCount, 1);
  assert.equal(summary.overview.activeProjectsCount, 1);
  assert.ok(summary.categories.some((entry) => entry.key === 'brand_voice' && entry.confidenceLevel === 'high'));
  assert.ok(summary.categories.some((entry) => entry.key === 'pricing' && entry.topMissingContext));
});

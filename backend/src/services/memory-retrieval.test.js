import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { rankScore } = await import('./memory-retrieval.js');

test('retrieval prefers latest confirmed fact over older stale inferred fact', () => {
  const now = new Date('2026-05-19T12:00:00.000Z');
  const policy = {
    preferredTypes: ['business_fact', 'project_fact'],
    includeContradictions: false,
  };

  const staleInferred = {
    key: 'target_market',
    value: 'dentists',
    title: 'Target market',
    memoryType: 'business_fact',
    scope: 'org',
    provenanceKind: 'inferred',
    confidence: 0.74,
    effectiveConfidence: 0.52,
    freshnessScore: 0.28,
    authorityScore: 0.4,
    status: 'stale',
    memoryItemStatus: 'active',
    lastSeenAt: new Date('2026-02-01T12:00:00.000Z'),
    updatedAt: new Date('2026-02-01T12:00:00.000Z'),
    createdAt: new Date('2026-02-01T12:00:00.000Z'),
    metadata: { contextLayer: 'global' },
  };

  const recentConfirmed = {
    key: 'target_market',
    value: 'UK legal firms',
    title: 'Target market',
    memoryType: 'business_fact',
    scope: 'org',
    provenanceKind: 'confirmed',
    confidence: 0.91,
    effectiveConfidence: 0.91,
    freshnessScore: 0.9,
    authorityScore: 0.72,
    status: 'fresh',
    memoryItemStatus: 'active',
    lastSeenAt: new Date('2026-05-15T12:00:00.000Z'),
    lastConfirmedAt: new Date('2026-05-15T12:00:00.000Z'),
    updatedAt: new Date('2026-05-15T12:00:00.000Z'),
    createdAt: new Date('2026-05-01T12:00:00.000Z'),
    metadata: { contextLayer: 'global' },
  };

  const staleScore = rankScore(staleInferred, policy, 'target market legal firms', now).retrievalScore;
  const confirmedScore = rankScore(recentConfirmed, policy, 'target market legal firms', now).retrievalScore;

  assert.ok(confirmedScore > staleScore);
});

test('active project context outranks archived project context unless the query is ambiguous', () => {
  const now = new Date('2026-05-19T12:00:00.000Z');
  const policy = {
    preferredTypes: ['project_fact'],
    includeContradictions: false,
  };

  const archivedProject = {
    key: 'project_context:old-launch:project_objective',
    value: 'Close the old beta waitlist.',
    title: 'Project Context - project objective',
    memoryType: 'project_fact',
    scope: 'org',
    provenanceKind: 'confirmed',
    confidence: 0.88,
    effectiveConfidence: 0.88,
    freshnessScore: 0.72,
    authorityScore: 0.62,
    status: 'aging',
    memoryItemStatus: 'active',
    lastSeenAt: new Date('2026-04-02T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    createdAt: new Date('2026-03-20T12:00:00.000Z'),
    metadata: { contextLayer: 'project', projectId: 'old-launch', projectName: 'Old Launch', projectStatus: 'archived' },
  };

  const activeProject = {
    key: 'project_context:prymal-beta-launch:project_objective',
    value: 'Launch private beta with security-first positioning.',
    title: 'Project Context - project objective',
    memoryType: 'project_fact',
    scope: 'org',
    provenanceKind: 'confirmed',
    confidence: 0.89,
    effectiveConfidence: 0.89,
    freshnessScore: 0.86,
    authorityScore: 0.7,
    status: 'fresh',
    memoryItemStatus: 'active',
    lastSeenAt: new Date('2026-05-17T12:00:00.000Z'),
    lastConfirmedAt: new Date('2026-05-17T12:00:00.000Z'),
    updatedAt: new Date('2026-05-17T12:00:00.000Z'),
    createdAt: new Date('2026-05-10T12:00:00.000Z'),
    metadata: { contextLayer: 'project', projectId: 'prymal-beta-launch', projectName: 'Prymal Beta Launch', projectStatus: 'active' },
  };

  const archivedScore = rankScore(archivedProject, policy, 'beta launch security-first positioning', now).retrievalScore;
  const activeScore = rankScore(activeProject, policy, 'beta launch security-first positioning', now).retrievalScore;

  assert.ok(activeScore > archivedScore);
});

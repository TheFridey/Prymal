import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUserSafeEvidenceSummary,
  sanitizeAssistantDoneEventForUser,
  sanitizeAssistantMessageMetadataForUser,
} from './agent-response-sanitizer.js';

test('normal-user sanitization strips provider and routing metadata while keeping safe evidence', () => {
  const safe = sanitizeAssistantDoneEventForUser({
    provider: 'openai',
    model: 'gpt-secret',
    route: 'premium_reasoning',
    routeReason: 'internal',
    sources: [
      {
        documentTitle: 'Pricing handbook',
        sourceType: 'markdown',
        sourceUrl: 'https://example.com/pricing',
        freshnessScore: 0.82,
        confidenceLabel: 'high',
        contradictionSignals: [],
      },
    ],
    usedMemories: [{ id: 'mem-1', title: 'Brand voice', redacted: false }],
  });

  assert.equal('provider' in safe, false);
  assert.equal('model' in safe, false);
  assert.equal(safe.sources[0].title, 'Pricing handbook');
  assert.equal(safe.sources[0].freshness, 'fresh');
  assert.equal(safe.evidenceSummary.confidenceLevel, 'high');
  assert.equal(safe.usedMemories[0].title, 'Brand voice');
});

test('sanitized assistant metadata keeps only safe evidence drawer fields', () => {
  const metadata = sanitizeAssistantMessageMetadataForUser({
    provider: 'anthropic',
    model: 'claude-secret',
    policyKey: 'premium',
    routeReason: 'internal route',
    sources: [
      {
        title: 'Live source',
        sourceType: 'web',
        mode: 'search',
        contradictionSignals: [{ type: 'version_conflict' }],
      },
    ],
    generatedVideos: [{ outputUrl: '/video.mp4', mode: 'standard', providerLabel: 'Hidden Provider' }],
  });

  assert.equal(metadata.sources[0].origin, 'live_research');
  assert.equal(metadata.sources[0].contradictionSeverity, 'medium');
  assert.equal(metadata.generatedVideos[0].laneLabel, 'Cinematic');
  assert.equal('providerLabel' in metadata.generatedVideos[0], false);
});

test('evidence summary reports not-enough-evidence when no sources exist', () => {
  const summary = buildUserSafeEvidenceSummary({ sources: [] });
  assert.equal(summary.notEnoughEvidence, true);
  assert.equal(summary.missingEvidenceReason?.length > 0, true);
});

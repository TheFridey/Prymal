import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { calculateMemoryDecay } = await import('./memory-decay.js');

test('pinned memory resists decay', () => {
  const row = {
    scope: 'org',
    memoryType: 'fact',
    provenanceKind: 'inferred',
    pinned: true,
    createdAt: new Date(Date.now() - 120 * 86400000),
    lastUsedAt: null,
    memoryItemStatus: 'active',
  };
  const { decayFactor } = calculateMemoryDecay(row);
  assert.ok(decayFactor >= 0.85);
});

test('temporary_session memory decays faster than org memory at same age', () => {
  const created = new Date(Date.now() - 30 * 86400000);
  const temp = {
    scope: 'temporary_session',
    memoryType: 'instruction',
    provenanceKind: 'inferred',
    createdAt: created,
    lastUsedAt: created,
    memoryItemStatus: 'active',
  };
  const org = {
    scope: 'org',
    memoryType: 'fact',
    provenanceKind: 'inferred',
    createdAt: created,
    lastUsedAt: created,
    memoryItemStatus: 'active',
  };

  const dTemp = calculateMemoryDecay(temp).decayFactor;
  const dOrg = calculateMemoryDecay(org).decayFactor;
  assert.ok(dTemp < dOrg);
});

test('never_forget enforces floor', () => {
  const row = {
    scope: 'user',
    memoryType: 'user_preference',
    provenanceKind: 'inferred',
    neverForget: true,
    createdAt: new Date(Date.now() - 800 * 86400000),
    lastUsedAt: null,
    memoryItemStatus: 'active',
  };
  const { decayFactor, reason } = calculateMemoryDecay(row);
  assert.equal(reason, 'never_forget_floor');
  assert.ok(decayFactor >= 0.55);
});

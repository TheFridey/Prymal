import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrowthSnapshot } from './growth.js';

function date(value) {
  return new Date(value);
}

test('buildGrowthSnapshot returns activation, lore, power-user, and inactivity signals', () => {
  const now = date('2026-04-14T12:00:00.000Z');
  const snapshot = buildGrowthSnapshot({
    now,
    organisations: [
      {
        id: 'org_1',
        name: 'Acme',
        plan: 'teams',
        seatLimit: 5,
        createdAt: date('2026-04-01T10:00:00.000Z'),
        updatedAt: now,
      },
      {
        id: 'org_2',
        name: 'Quiet Co',
        plan: 'pro',
        seatLimit: 2,
        createdAt: date('2026-02-20T10:00:00.000Z'),
        updatedAt: now,
        metadata: {},
      },
      {
        id: 'org_3',
        name: 'Agency Ops',
        plan: 'agency',
        seatLimit: 8,
        createdAt: date('2026-03-28T10:00:00.000Z'),
        updatedAt: now,
        metadata: {
          aiControls: {
            providerPreference: 'google',
            fastLane: 'gemini_flash',
            experimentationEnabled: true,
          },
        },
      },
    ],
    users: [
      { id: 'u1', orgId: 'org_1' },
      { id: 'u2', orgId: 'org_1' },
      { id: 'u3', orgId: 'org_1' },
      { id: 'u4', orgId: 'org_1' },
      { id: 'u5', orgId: 'org_2' },
      { id: 'u6', orgId: 'org_3' },
      { id: 'u7', orgId: 'org_3' },
    ],
    events: [
      { id: 'e1', orgId: 'org_1', eventName: 'onboarding.completed', createdAt: date('2026-04-01T10:30:00.000Z'), metadata: {} },
      { id: 'e2', orgId: 'org_1', eventName: 'billing.plan_changed', createdAt: date('2026-04-02T08:00:00.000Z'), metadata: { plan: 'teams' } },
      { id: 'e3', orgId: 'org_2', eventName: 'billing.subscription_cancelled', createdAt: date('2026-03-25T08:00:00.000Z'), metadata: {} },
      { id: 'e4', orgId: 'org_3', eventName: 'onboarding.completed', createdAt: date('2026-04-08T08:00:00.000Z'), metadata: {} },
    ],
    traces: Array.from({ length: 14 }, (_, index) => ({
      id: `t${index}`,
      orgId: 'org_1',
      agentId: index < 8 ? 'cipher' : 'lore',
      provider: index < 10 ? 'openai' : 'anthropic',
      outcomeStatus: 'succeeded',
      latencyMs: 600 + index * 10,
      createdAt: date(`2026-04-${String(2 + (index % 6)).padStart(2, '0')}T12:00:00.000Z`),
    })).concat([
      {
        id: 't_agency_1',
        orgId: 'org_3',
        agentId: 'nexus',
        provider: 'google',
        outcomeStatus: 'succeeded',
        latencyMs: 500,
        createdAt: date('2026-04-09T12:00:00.000Z'),
      },
    ]),
    workflows: [
      { id: 'wf_1', orgId: 'org_1', createdAt: date('2026-04-03T09:00:00.000Z') },
      { id: 'wf_2', orgId: 'org_3', createdAt: date('2026-04-07T09:00:00.000Z') },
    ],
    workflowRuns: [
      { id: 'wr_1', orgId: 'org_1', workflowId: 'wf_1', status: 'completed', createdAt: date('2026-04-05T09:00:00.000Z') },
      { id: 'wr_2', orgId: 'org_1', workflowId: 'wf_1', status: 'completed', createdAt: date('2026-04-08T09:00:00.000Z') },
      { id: 'wr_3', orgId: 'org_1', workflowId: 'wf_1', status: 'completed', createdAt: date('2026-04-10T09:00:00.000Z') },
      { id: 'wr_4', orgId: 'org_1', workflowId: 'wf_1', status: 'completed', createdAt: date('2026-04-11T09:00:00.000Z') },
      { id: 'wr_5', orgId: 'org_1', workflowId: 'wf_1', status: 'completed', createdAt: date('2026-04-12T09:00:00.000Z') },
      { id: 'wr_6', orgId: 'org_3', workflowId: 'wf_2', status: 'completed', createdAt: date('2026-04-10T09:00:00.000Z') },
    ],
    documents: [
      { id: 'doc_1', orgId: 'org_1', sourceType: 'url', status: 'indexed', createdAt: date('2026-04-04T09:00:00.000Z'), updatedAt: date('2026-04-04T09:00:00.000Z'), metadata: { contradictionCount: 2 } },
      { id: 'doc_2', orgId: 'org_2', sourceType: 'text', status: 'indexed', createdAt: date('2025-12-04T09:00:00.000Z'), updatedAt: date('2025-12-04T09:00:00.000Z'), metadata: {} },
      { id: 'doc_3', orgId: 'org_3', sourceType: 'file', status: 'indexed', createdAt: date('2026-04-10T09:00:00.000Z'), updatedAt: date('2026-04-10T09:00:00.000Z'), metadata: {} },
    ],
    apiKeys: [
      { id: 'key_1', orgId: 'org_3', isActive: true, createdAt: date('2026-04-10T09:00:00.000Z') },
    ],
  });

  assert.equal(snapshot.activationFunnel.signups, 2);
  assert.equal(snapshot.activationFunnel.onboardingCompleted, 2);
  assert.equal(snapshot.activationFunnel.paidConversion, 1);
  assert.equal(snapshot.workflowConversion.workflowsCreated, 2);
  assert.equal(snapshot.workflowConversion.workflowsActivated, 2);
  assert.equal(snapshot.loreUsage.documentsUploaded30d, 2);
  assert.equal(snapshot.loreUsage.conflictedDocuments, 1);
  assert.equal(snapshot.powerUserOrgs[0].orgId, 'org_1');
  assert.equal(snapshot.inactivityAlerts[0].orgId, 'org_2');
  assert.equal(snapshot.churnSignals[0].orgId, 'org_2');
  assert.equal(snapshot.featureAdoptionByPlan.find((entry) => entry.plan === 'teams')?.counts.workflowOrgs, 1);
  assert.equal(snapshot.featureAdoptionByPlan.find((entry) => entry.plan === 'agency')?.counts.apiKeyOrgs, 1);
  assert.equal(snapshot.featureAdoptionByPlan.find((entry) => entry.plan === 'agency')?.counts.overrideOrgs, 1);
});

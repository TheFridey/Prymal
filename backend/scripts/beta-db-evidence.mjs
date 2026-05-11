#!/usr/bin/env node

import { desc, inArray, sql } from 'drizzle-orm';
import { loadBackendEnv } from '../src/env/parse.js';

const args = process.argv.slice(2);
const section = getArgValue('--section') ?? 'all';
const limit = Math.max(1, Number.parseInt(getArgValue('--limit') ?? '10', 10) || 10);
const strictEnv = hasFlag('--strict-env');

loadBackendEnv({ mode: process.env.NODE_ENV ?? 'development' });

if (!strictEnv) {
  // Evidence collection is read-only and should stay usable while env separation is being repaired.
  process.env.NODE_ENV = 'test';
}

if (!String(process.env.DATABASE_URL ?? '').trim()) {
  console.error('DATABASE_URL is required for beta evidence queries.');
  process.exit(1);
}

const { db } = await import('../src/db/index.js');
const {
  actionApprovals,
  integrations,
  productEvents,
  wardenAuditEvents,
  workflowRuns,
} = await import('../src/db/schema.js');

const sections = section === 'all'
  ? ['integrations', 'approvals', 'workflows', 'warden', 'billing']
  : [section];

for (const name of sections) {
  if (name === 'integrations') {
    await printIntegrationsEvidence(limit);
    continue;
  }
  if (name === 'approvals') {
    await printApprovalEvidence(limit);
    continue;
  }
  if (name === 'workflows') {
    await printWorkflowEvidence(limit);
    continue;
  }
  if (name === 'warden') {
    await printWardenEvidence(limit);
    continue;
  }
  if (name === 'billing') {
    await printBillingEvidence(limit);
    continue;
  }

  console.error(`Unknown --section "${name}". Use all, integrations, approvals, workflows, warden, or billing.`);
  process.exit(1);
}

async function printIntegrationsEvidence(rowLimit) {
  printHeader('OAuth Integrations');

  const providerRows = await db
    .select({
      service: integrations.service,
      isActive: integrations.isActive,
      tokenExpiresAt: integrations.tokenExpiresAt,
      updatedAt: integrations.updatedAt,
    })
    .from(integrations)
    .where(inArray(integrations.service, ['google', 'slack', 'notion']))
    .orderBy(desc(integrations.updatedAt))
    .limit(Math.max(rowLimit, 25));

  const now = Date.now();
  const summary = summarizeBy(providerRows, (row) => {
    const status = classifyIntegrationStatus(row, now);
    return `${row.service}:${status}`;
  });

  if (providerRows.length === 0) {
    console.log('No Google/Slack/Notion integrations found.');
    console.log('');
    return;
  }

  console.table(summary);
  console.table(providerRows.slice(0, rowLimit).map((row) => ({
    service: row.service,
    status: classifyIntegrationStatus(row, now),
    tokenExpiresAt: formatDate(row.tokenExpiresAt),
    updatedAt: formatDate(row.updatedAt),
  })));
  console.log('');
}

async function printApprovalEvidence(rowLimit) {
  printHeader('Action Approvals');

  const rows = await db
    .select({
      id: actionApprovals.id,
      orgId: actionApprovals.orgId,
      userId: actionApprovals.userId,
      actionType: actionApprovals.actionType,
      expiresAt: actionApprovals.expiresAt,
      usedAt: actionApprovals.usedAt,
      verdict: actionApprovals.verdict,
      workflowId: actionApprovals.workflowId,
      nodeId: actionApprovals.nodeId,
      createdAt: actionApprovals.createdAt,
    })
    .from(actionApprovals)
    .orderBy(desc(actionApprovals.createdAt))
    .limit(Math.max(rowLimit, 25));

  const now = Date.now();
  console.table(summarizeBy(rows, (row) => classifyApprovalStatus(row, now)));

  if (rows.length > 0) {
    console.table(rows.slice(0, rowLimit).map((row) => ({
      createdAt: formatDate(row.createdAt),
      actionType: row.actionType,
      status: classifyApprovalStatus(row, now),
      verdict: row.verdict ?? '',
      workflowId: row.workflowId ?? '',
      nodeId: row.nodeId ?? '',
      expiresAt: formatDate(row.expiresAt),
      usedAt: formatDate(row.usedAt),
    })));
  }
  console.log('');
}

async function printWorkflowEvidence(rowLimit) {
  printHeader('Workflow Runs');

  const counts = await db
    .select({
      status: workflowRuns.status,
      count: sql`count(*)::int`,
    })
    .from(workflowRuns)
    .groupBy(workflowRuns.status)
    .orderBy(workflowRuns.status);

  const rows = await db
    .select({
      id: workflowRuns.id,
      workflowId: workflowRuns.workflowId,
      orgId: workflowRuns.orgId,
      status: workflowRuns.status,
      triggerSource: workflowRuns.triggerSource,
      executionMode: workflowRuns.executionMode,
      failureClass: workflowRuns.failureClass,
      replayOfRunId: workflowRuns.replayOfRunId,
      creditsUsed: workflowRuns.creditsUsed,
      createdAt: workflowRuns.createdAt,
      completedAt: workflowRuns.completedAt,
    })
    .from(workflowRuns)
    .orderBy(desc(workflowRuns.createdAt))
    .limit(rowLimit);

  if (counts.length === 0) {
    console.log('No workflow_runs rows found.');
    console.log('');
    return;
  }

  console.table(counts);
  console.table(rows.map((row) => ({
    createdAt: formatDate(row.createdAt),
    status: row.status,
    failureClass: row.failureClass ?? '',
    replayOfRunId: row.replayOfRunId ?? '',
    triggerSource: row.triggerSource,
    executionMode: row.executionMode,
    creditsUsed: row.creditsUsed,
    workflowId: row.workflowId,
  })));
  console.log('');
}

async function printWardenEvidence(rowLimit) {
  printHeader('WARDEN Audit');

  const counts = await db
    .select({
      verdict: wardenAuditEvents.verdict,
      riskLevel: wardenAuditEvents.riskLevel,
      count: sql`count(*)::int`,
    })
    .from(wardenAuditEvents)
    .groupBy(wardenAuditEvents.verdict, wardenAuditEvents.riskLevel)
    .orderBy(wardenAuditEvents.verdict, wardenAuditEvents.riskLevel);

  const rows = await db
    .select({
      createdAt: wardenAuditEvents.createdAt,
      surface: wardenAuditEvents.surface,
      sourceType: wardenAuditEvents.sourceType,
      action: wardenAuditEvents.action,
      verdict: wardenAuditEvents.verdict,
      riskLevel: wardenAuditEvents.riskLevel,
      redactionCount: wardenAuditEvents.redactionCount,
      provider: wardenAuditEvents.provider,
      toolName: wardenAuditEvents.toolName,
    })
    .from(wardenAuditEvents)
    .orderBy(desc(wardenAuditEvents.createdAt))
    .limit(rowLimit);

  if (counts.length === 0) {
    console.log('No warden_audit_event rows found.');
    console.log('');
    return;
  }

  console.table(counts);
  console.table(rows.map((row) => ({
    createdAt: formatDate(row.createdAt),
    verdict: row.verdict,
    riskLevel: row.riskLevel,
    surface: row.surface,
    action: row.action,
    redactions: row.redactionCount,
    provider: row.provider ?? '',
    toolName: row.toolName ?? '',
  })));
  console.log('');
}

async function printBillingEvidence(rowLimit) {
  printHeader('Billing Telemetry');

  const eventNames = [
    'billing.execution_reserved',
    'billing.execution_committed',
    'billing.execution_released',
  ];

  const counts = await db
    .select({
      eventName: productEvents.eventName,
      count: sql`count(*)::int`,
      latestAt: sql`max(${productEvents.createdAt})`,
    })
    .from(productEvents)
    .where(inArray(productEvents.eventName, eventNames))
    .groupBy(productEvents.eventName)
    .orderBy(productEvents.eventName);

  const recentRows = await db
    .select({
      createdAt: productEvents.createdAt,
      eventName: productEvents.eventName,
      orgId: productEvents.orgId,
      userId: productEvents.userId,
      metadata: productEvents.metadata,
    })
    .from(productEvents)
    .where(inArray(productEvents.eventName, eventNames))
    .orderBy(desc(productEvents.createdAt))
    .limit(rowLimit);

  if (counts.length === 0) {
    console.log('No billing execution lifecycle product_events rows found.');
    console.log('');
    return;
  }

  console.table(counts.map((row) => ({
    eventName: row.eventName,
    count: row.count,
    latestAt: formatDate(row.latestAt),
  })));

  console.table(recentRows.map((row) => ({
    createdAt: formatDate(row.createdAt),
    eventName: row.eventName,
    orgId: row.orgId ?? '',
    userId: row.userId ?? '',
    metadata: summarizeBillingMetadata(row.metadata),
  })));

  const duplicateCandidates = findDuplicateBillingCandidates(recentRows);
  if (duplicateCandidates.length > 0) {
    console.log('Potential duplicate billing lifecycle candidates:');
    console.table(duplicateCandidates);
  } else {
    console.log('No duplicate billing lifecycle candidates found in the recent sample.');
  }
  console.log('');
}

function classifyIntegrationStatus(row, now = Date.now()) {
  if (!row.isActive) {
    return 'revoked_or_inactive';
  }
  if (row.tokenExpiresAt && new Date(row.tokenExpiresAt).getTime() <= now) {
    return 'expired';
  }
  return 'active';
}

function classifyApprovalStatus(row, now = Date.now()) {
  if (row.usedAt) {
    return 'used';
  }
  if (row.verdict === 'denied') {
    return 'denied';
  }
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= now) {
    return 'expired';
  }
  return 'pending';
}

function summarizeBy(rows, keyFn) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function summarizeBillingMetadata(metadata) {
  const value = metadata && typeof metadata === 'object' ? metadata : {};
  return JSON.stringify({
    reservationId: value.reservationId ?? null,
    executionEventId: value.executionEventId ?? null,
    videoEventId: value.videoEventId ?? null,
    workflowRunId: value.workflowRunId ?? null,
    reason: value.reason ?? null,
  });
}

function findDuplicateBillingCandidates(rows) {
  const counts = new Map();
  for (const row of rows) {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const correlationValues = [
      metadata.reservationId ?? '',
      metadata.executionEventId ?? '',
      metadata.videoEventId ?? '',
      metadata.workflowRunId ?? '',
    ].map((value) => String(value ?? '').trim());

    if (correlationValues.every((value) => value.length === 0)) {
      continue;
    }

    const identity = [
      row.eventName,
      ...correlationValues,
    ].join('|');
    counts.set(identity, (counts.get(identity) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([identity, count]) => ({ identity, count }))
    .sort((a, b) => b.count - a.count);
}

function printHeader(label) {
  console.log(`\n=== ${label} ===`);
}

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function getArgValue(flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
}

function hasFlag(flag) {
  return args.includes(flag);
}

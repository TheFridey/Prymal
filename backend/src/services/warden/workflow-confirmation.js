import crypto, { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { workflowRiskConfirmations } from '../../db/schema.js';
import { WARDEN_VERDICTS, WARDEN_RISK_LEVELS } from './warden-policy.js';

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const CRITICAL_REQUIRES_ADMIN_CATEGORIES = new Set([
  'billing_admin_action',
  'destructive_action',
]);

export function summarizeWorkflowRisk(decision = {}, workflow = {}) {
  return {
    verdict: decision.verdict ?? null,
    riskLevel: decision.riskLevel ?? null,
    categories: [...new Set(decision.categories ?? [])],
    reasons: decision.reasons ?? [],
    workflowId: workflow.id ?? null,
    workflowName: workflow.name ?? null,
    affectedNodes: (workflow.nodes ?? []).map((node) => ({
      id: node.id,
      agentId: node.agentId,
      label: node.label ?? null,
    })),
    metadata: {
      hasExternalInput: decision.metadata?.workflowHasExternalInput ?? null,
      hasToolExecution: decision.metadata?.workflowHasToolExecution ?? null,
      hasDestructiveAction: decision.metadata?.workflowHasDestructiveAction ?? null,
    },
  };
}

export function isCriticalAdminWorkflow(decision = {}) {
  if (decision.riskLevel === WARDEN_RISK_LEVELS.CRITICAL) return true;
  return (decision.categories ?? []).some((category) => CRITICAL_REQUIRES_ADMIN_CATEGORIES.has(category));
}

export async function createWorkflowConfirmation({
  orgId,
  userId,
  workflowId,
  workflowRunId = null,
  wardenAuditId = null,
  riskSummary = {},
  ttlMs = DEFAULT_TTL_MS,
  dbClient = db,
} = {}) {
  if (!orgId || !workflowId) {
    throw new Error('orgId and workflowId required to create a workflow confirmation.');
  }
  const token = randomUUID().replace(/-/g, '');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMs);

  const [row] = await dbClient
    .insert(workflowRiskConfirmations)
    .values({
      orgId,
      userId: userId ?? null,
      workflowId,
      workflowRunId,
      wardenAuditId,
      riskSummary,
      status: 'pending',
      tokenHash,
      expiresAt,
    })
    .returning();

  return {
    confirmationId: row.id,
    confirmationToken: token,
    expiresAt: row.expiresAt,
    riskSummary: row.riskSummary,
    status: row.status,
  };
}

export async function getWorkflowConfirmation({
  confirmationId,
  orgId,
  userId = null,
  workflowId = null,
  dbClient = db,
} = {}) {
  if (!confirmationId || !orgId) return null;
  const row = await dbClient.query.workflowRiskConfirmations.findFirst({
    where: and(
      eq(workflowRiskConfirmations.id, confirmationId),
      eq(workflowRiskConfirmations.orgId, orgId),
    ),
  });
  if (!row) return null;
  if (userId && row.userId && row.userId !== userId) return null;
  if (workflowId && row.workflowId !== workflowId) return null;
  return row;
}

export async function approveWorkflowConfirmation({
  confirmationId,
  orgId,
  userId,
  isAdmin = false,
  acknowledged = false,
  dbClient = db,
  now = new Date(),
} = {}) {
  if (!acknowledged) {
    return { ok: false, code: 'ACKNOWLEDGEMENT_REQUIRED' };
  }

  const row = await getWorkflowConfirmation({ confirmationId, orgId, userId, dbClient });
  if (!row) {
    return { ok: false, code: 'NOT_FOUND' };
  }
  if (row.status !== 'pending') {
    return { ok: false, code: 'INVALID_STATE', status: row.status };
  }
  if (row.expiresAt && new Date(row.expiresAt).getTime() < now.getTime()) {
    await markConfirmationStatus({
      confirmationId,
      orgId,
      status: 'expired',
      dbClient,
    });
    return { ok: false, code: 'EXPIRED' };
  }

  const summary = row.riskSummary ?? {};
  if (summary.verdict === WARDEN_VERDICTS.BLOCK) {
    return { ok: false, code: 'BLOCK_NOT_OVERRIDABLE' };
  }
  if (isCriticalAdminWorkflow(summary) && !isAdmin) {
    return { ok: false, code: 'ADMIN_REQUIRED' };
  }

  const [approved] = await dbClient
    .update(workflowRiskConfirmations)
    .set({
      status: 'approved',
      usedAt: now,
    })
    .where(and(
      eq(workflowRiskConfirmations.id, confirmationId),
      eq(workflowRiskConfirmations.orgId, orgId),
      eq(workflowRiskConfirmations.status, 'pending'),
    ))
    .returning();

  if (!approved) {
    return { ok: false, code: 'INVALID_STATE' };
  }

  return {
    ok: true,
    confirmation: approved,
    approvedBy: userId ?? null,
  };
}

export async function denyWorkflowConfirmation({ confirmationId, orgId, userId, dbClient = db, now = new Date() } = {}) {
  const row = await getWorkflowConfirmation({ confirmationId, orgId, userId, dbClient });
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  if (row.status !== 'pending') return { ok: false, code: 'INVALID_STATE', status: row.status };

  const [denied] = await dbClient
    .update(workflowRiskConfirmations)
    .set({ status: 'denied', usedAt: now })
    .where(and(
      eq(workflowRiskConfirmations.id, confirmationId),
      eq(workflowRiskConfirmations.orgId, orgId),
      eq(workflowRiskConfirmations.status, 'pending'),
    ))
    .returning();
  return { ok: true, confirmation: denied, deniedBy: userId ?? null };
}

export async function consumeWorkflowConfirmation({
  confirmationId,
  orgId,
  userId = null,
  workflowId = null,
  dbClient = db,
  now = new Date(),
} = {}) {
  const row = await getWorkflowConfirmation({ confirmationId, orgId, userId, workflowId, dbClient });
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  if (row.status !== 'approved') {
    return { ok: false, code: 'NOT_APPROVED', status: row.status };
  }
  if (row.expiresAt && new Date(row.expiresAt).getTime() < now.getTime()) {
    await markConfirmationStatus({ confirmationId, orgId, status: 'expired', dbClient });
    return { ok: false, code: 'EXPIRED' };
  }
  const [used] = await dbClient
    .update(workflowRiskConfirmations)
    .set({ status: 'used', usedAt: now })
    .where(and(
      eq(workflowRiskConfirmations.id, confirmationId),
      eq(workflowRiskConfirmations.orgId, orgId),
      eq(workflowRiskConfirmations.status, 'approved'),
    ))
    .returning();
  if (!used) {
    return { ok: false, code: 'CONSUMED' };
  }
  return { ok: true, confirmation: used };
}

async function markConfirmationStatus({ confirmationId, orgId, status, dbClient = db }) {
  await dbClient
    .update(workflowRiskConfirmations)
    .set({ status })
    .where(and(
      eq(workflowRiskConfirmations.id, confirmationId),
      eq(workflowRiskConfirmations.orgId, orgId),
    ));
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
